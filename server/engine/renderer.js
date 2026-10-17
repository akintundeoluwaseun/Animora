// AdFlash render engine: deterministic HTML (GSAP timeline) -> MP4.
//
// How it works
//   1. Headless Chrome (Puppeteer) opens the generated HTML at the exact canvas size.
//   2. We wait for fonts, images and window.__timeline.
//   3. For every frame we seek the paused timeline to frame/fps, wait for two paints,
//      and screenshot. Nothing runs on wall-clock time, so output is perfectly smooth
//      no matter how slow the server is.
//   4. Frames are piped straight into FFmpeg (H.264, yuv420p, +faststart).
//   5. Long videos are split into N contiguous segments rendered in parallel pages,
//      then joined losslessly with the FFmpeg concat demuxer. MP4s are always silent;
//      any narration script is delivered separately for external TTS tools.

import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir, cpus } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const GSAP_DIST = (() => { try { return path.dirname(require.resolve('gsap/dist/gsap.min.js')); } catch { return path.resolve('node_modules/gsap/dist'); } })();

export const CANVAS = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
};

const DEFAULTS = {
  fps: 30,
    // Parallel capture: each extra worker gets its own browser process (stable on Windows too).
  workers: Number(process.env.ADFLASH_WORKERS) || Math.max(1, Math.min(4, Math.floor(cpus().length / 2))),
  // 'beginframe': Chrome headless-shell renders + captures each frame in ONE call (about 1.8x faster).
  // 'screenshot': classic seek -> 2x requestAnimationFrame -> page.screenshot (works on any Chrome).
  // 'auto': try beginframe, fall back to screenshot.
  captureMode: process.env.ADFLASH_CAPTURE_MODE || 'auto',
  // Capture scale: 0.6667 renders 1080p layouts at 720p (2.25x fewer pixels, about 2x faster). 1 = full 1080p.
  scale: Number(process.env.ADFLASH_SCALE) || 0.6667,
  frameFormat: 'jpeg', // 'jpeg' is ~3x faster to capture than 'png'; quality 95 is visually lossless after H.264
  jpegQuality: 90,
  crf: 20,
  preset: 'veryfast',
  loadTimeoutMs: 30000,
  assetTimeoutMs: 8000,
};

// --------------------------------------------------------------------------
// Page setup helpers
// --------------------------------------------------------------------------

// Runs before any page script: seeded Math.random so "random" values are repeatable.
const DETERMINISM_SHIM = `
(() => {
  let s = 0x9e3779b9;
  Math.random = function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

// Serve GSAP from our own node_modules instead of the CDN: faster, works offline,
// and every render uses the exact same GSAP build.
function localGsapFor(url) {
  const m = url.match(/gsap[^?#]*\/([A-Za-z]+)(?:\.min)?\.js(?:[?#].*)?$/);
  if (!m) return null;
  const file = path.join(GSAP_DIST, `${m[1]}.min.js`);
  return file.startsWith(GSAP_DIST) ? file : null;
}

async function newPage(browser, mode, { width, height }, sc = 1) {
  width = Math.round((width * sc) / 2) * 2; height = Math.round((height * sc) / 2) * 2;
  if (mode !== 'beginframe') return { page: await browser.newPage(), cdp: null };
  const bs = await browser.target().createCDPSession();
  const { targetId } = await bs.send('Target.createTarget', {
    url: 'about:blank', enableBeginFrameControl: true, width, height,
  });
  await bs.detach().catch(() => {});
  const target = await browser.waitForTarget((t) => t._targetId === targetId);
  const page = await target.page();
  const cdp = await page.createCDPSession();
  await cdp.send('HeadlessExperimental.enable').catch(() => {});
  return { page, cdp };
}

// In beginframe mode Chrome only paints when we ask, so keep frames flowing while loading.
function startPump(ctx) {
  if (!ctx.cdp) return async () => {};
  let stop = false;
  const loop = (async () => {
    while (!stop) {
      ctx.ticks += 33;
      await ctx.cdp.send('HeadlessExperimental.beginFrame', { frameTimeTicks: ctx.ticks, interval: 33 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 10));
    }
  })();
  return async () => { stop = true; await loop; };
}

async function openPage(browser, htmlFile, { width, height }, opts, log) {
  const { page, cdp } = await newPage(browser, opts.mode, { width, height }, opts.scale && opts.scale < 1 ? opts.scale : 1);
  const ctx = { page, cdp, ticks: 0 };
  const stopPump = startPump(ctx);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e?.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') log(`[page console] ${m.text()}`); });

  // Fast capture: the 1080p layout is drawn into a smaller window (same layout, fewer pixels to paint and encode).
  const sc = opts.scale && opts.scale < 1 ? opts.scale : 1;
  const vw = Math.round((width * sc) / 2) * 2, vh = Math.round((height * sc) / 2) * 2;
  await page.setViewport({ width: vw, height: vh, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(DETERMINISM_SHIM);
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const url = req.url();
    try {
      const local = /^https?:/.test(url) ? localGsapFor(url) : null;
      if (local) {
        return req.respond({ status: 200, contentType: 'application/javascript', body: await readFile(local) });
      }
      return req.continue();
    } catch {
      return req.abort().catch(() => {});
    }
  });

  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load', timeout: opts.loadTimeoutMs });
  if (sc < 1) {
    await page.addStyleTag({ content: `html,body{width:${vw}px!important;height:${vh}px!important;overflow:hidden!important}
      #stage{transform:scale(${vw / width});transform-origin:0 0}` });
  }

  // Wait for the timeline, fonts and images. Font/image waits are capped so a blocked
  // font CDN degrades to the fallback font instead of hanging the render.
  const info = await page.evaluate(async (assetTimeoutMs) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const capped = (p) => Promise.race([p, sleep(assetTimeoutMs)]);

    const t0 = Date.now();
    while (!window.__timeline && Date.now() - t0 < 10000) await sleep(50);
    if (!window.__timeline) return { error: 'window.__timeline was never defined' };

    await capped(document.fonts ? document.fonts.ready : Promise.resolve());
    await capped(Promise.all([...document.images].map((img) =>
      img.complete ? (img.decode ? img.decode().catch(() => {}) : null)
        : new Promise((r) => { img.onload = img.onerror = r; }))));
    // CSS background images
    const bgUrls = new Set();
    document.querySelectorAll('*').forEach((el) => {
      const bg = getComputedStyle(el).backgroundImage;
      for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) bgUrls.add(m[1]);
    });
    await capped(Promise.all([...bgUrls].map((src) => new Promise((r) => {
      const i = new Image(); i.onload = i.onerror = r; i.src = src;
    }))));

    const tl = window.__timeline;
    const gsap = window.gsap;
    // Anything animating outside the master timeline would run on wall-clock time.
    // Freeze it so the render stays deterministic, and report it.
    let stray = 0;
    if (gsap && gsap.globalTimeline) {
      stray = gsap.globalTimeline.getChildren(false, true, true).filter((c) => c !== tl).length;
      tl.pause();
      gsap.globalTimeline.pause();
    }
    const cssAnimations = document.getAnimations ? document.getAnimations().length : 0;
    const sfx = Array.isArray(window.__sfx) ? window.__sfx.slice(0, 400) : [];
    const music = (window.ADFLASH_DATA && window.ADFLASH_DATA.music) || null;
    return {
      duration: tl.duration(),
      wasPaused: tl.paused(),
      repeat: typeof tl.repeat === 'function' ? tl.repeat() : 0,
      stray,
      cssAnimations,
      sfx,
      music,
      failedImages: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src).slice(0, 5),
    };
  }, opts.assetTimeoutMs);

  await stopPump();
  if (info.error) throw new Error(info.error);
  if (errors.length) info.pageErrors = errors.slice(0, 5);
  return { page, ctx, info };
}

// Seek the timeline to time t (seconds) and return one encoded frame.
async function captureFrame(ctx, t, opts) {
  const { page, cdp } = ctx;
  const imageOpts = opts.frameFormat === 'jpeg' ? { format: 'jpeg', quality: opts.jpegQuality } : { format: 'png' };
  if (cdp) {
    await page.evaluate(SEEK_FN, t, false);
    // A frame can come back without pixels if nothing was damaged; ask again.
    for (let attempt = 0; attempt < 4; attempt++) {
      ctx.ticks += 1000 / opts.fps;
      const r = await cdp.send('HeadlessExperimental.beginFrame', {
        frameTimeTicks: ctx.ticks, interval: 1000 / opts.fps, screenshot: imageOpts,
      });
      if (r.screenshotData) {
        ctx.lastFrame = Buffer.from(r.screenshotData, 'base64');
        return ctx.lastFrame;
      }
    }
    if (ctx.lastFrame) return ctx.lastFrame;
    throw new Error(`No frame data at t=${t}`);
  }
  await page.evaluate(SEEK_FN, t, process.env.ADFLASH_PAINT_WAIT === '1');
  return page.screenshot({
    type: imageOpts.format,
    ...(imageOpts.quality ? { quality: imageOpts.quality } : {}),
    optimizeForSpeed: true,
    captureBeyondViewport: false,
  });
}

function SEEK_FN(t, waitPaint) {
  window.__timeline.seek(t, false);
  // Safety net: if any CSS animation/transition slipped in, drive it from the same clock.
  if (document.getAnimations) {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
  }
  if (waitPaint) return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// --------------------------------------------------------------------------
// FFmpeg helpers
// --------------------------------------------------------------------------

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err}`))));
  });
}

function startEncoder(outFile, { fps, frameFormat, crf, preset, outW, outH }) {
  const args = [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps),
    '-c:v', frameFormat === 'png' ? 'png' : 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', preset, '-crf', String(crf),
    // fast captures are upscaled back to full HD with a sharp filter (cheap compared with painting 1080p)
    '-vf', outW ? `scale=${outW}:${outH}:flags=lanczos:in_range=full:out_range=tv` : 'scale=in_range=full:out_range=tv',
    '-pix_fmt', 'yuv420p', '-r', String(fps), '-video_track_timescale', String(fps * 1000),
    outFile,
  ];
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  ff.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); });
  const done = new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr}`))));
  });
  let pipeError = null;
  ff.stdin.on('error', (e) => { pipeError = e; });
  const write = (buf) => new Promise((resolve, reject) => {
    if (pipeError) return reject(new Error(`ffmpeg input closed: ${pipeError.message} ${stderr}`));
    if (ff.stdin.write(buf)) resolve();
    else ff.stdin.once('drain', resolve);
  });
  const end = () => { ff.stdin.end(); return done; };
  return {
    write,
    end,
    kill: () => {
      done.catch(() => {});
      if (!ff.killed) ff.kill('SIGKILL');
    },
  };
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Inspect generated HTML without rendering: confirms it loads, exposes a paused
 * window.__timeline, and reports its duration and any determinism problems.
 * Used by the Gemini generate -> validate -> repair loop.
 */
export async function inspectAnimation(html, { aspectRatio = '9:16', ...rest } = {}) {
  const opts = { ...DEFAULTS, ...rest };
  const canvas = CANVAS[aspectRatio];
  if (!canvas) throw new Error(`Unknown aspect ratio ${aspectRatio}`);
  const dir = await mkdtemp(path.join(tmpdir(), 'adflash-inspect-'));
  const htmlFile = path.join(dir, 'index.html');
  await writeFile(htmlFile, html);
  const browser = await launchBrowser('screenshot');
  try {
    const { info } = await openPage(browser, htmlFile, canvas, { ...opts, mode: 'screenshot' }, () => {});
    return info;
  } finally {
    await browser.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const BASE_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
  '--font-render-hinting=none', '--force-color-profile=srgb',
  '--hide-scrollbars', '--mute-audio', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
];
const BEGIN_FRAME_ARGS = [
  '--deterministic-mode', '--enable-begin-frame-control', '--run-all-compositor-stages-before-draw',
  '--disable-new-content-rendering-timeout', '--disable-threaded-animation',
  '--disable-threaded-scrolling', '--disable-checker-imaging', '--disable-image-animation-resync',
];

function launchBrowser(mode) {
  return puppeteer.launch({
    // beginframe needs chrome-headless-shell ('shell'); screenshot mode works with any Chrome.
    headless: mode === 'beginframe' ? 'shell' : true,
    // Use a system Chrome/Chromium if provided (Docker images, VPS), else Puppeteer's download.
    executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: mode === 'beginframe' ? [...BASE_ARGS, ...BEGIN_FRAME_ARGS] : BASE_ARGS,
  });
}

// Launch the browser and open the first page, choosing the fastest capture mode that works.
async function startSession(htmlFile, canvas, opts, log) {
  const modes = opts.captureMode === 'auto' ? ['beginframe', 'screenshot'] : [opts.captureMode];
  let lastErr;
  for (const mode of modes) {
    let browser;
    try {
      browser = await launchBrowser(mode);
      const o = { ...opts, mode };
      const first = await openPage(browser, htmlFile, canvas, o, log);
      if (mode === 'beginframe') await captureFrame(first.ctx, 0, o); // prove capture works
      return { browser, first, opts: o };
    } catch (err) {
      lastErr = err;
      await browser?.close().catch(() => {});
      // Problems in the animation itself are not a capture-mode issue: stop here.
      if (/__timeline|Timeline/.test(err.message)) throw err;
      if (modes.length > 1) log(`Capture mode "${mode}" unavailable (${err.message.split('\n')[0]}); trying next`);
    }
  }
  throw lastErr;
}

/**
 * Render an AdFlash animation to MP4.
 *
 * @param {object}   job
 * @param {string}   job.html          Full HTML document (must define a paused window.__timeline)
 * @param {string}   job.outFile       Path of the MP4 to write
 * @param {string}  [job.aspectRatio]  '9:16' | '1:1' | '16:9' (default '9:16')
 * @param {number}  [job.duration]     Seconds. Defaults to window.__timeline.duration()
 * @param {function}[job.onProgress]   ({framesDone,totalFrames,percent,fpsRate,etaSeconds}) => void
 * @param {function}[job.log]          (msg) => void
 * @param {AbortSignal}[job.signal]    Cancel the render
 * @returns {Promise<{outFile,duration,totalFrames,elapsedSeconds,warnings}>}
 */
export async function renderVideo(job) {
  const opts = { ...DEFAULTS, ...job };
  const { html, outFile, aspectRatio = '9:16', signal } = job;
  const log = job.log || (() => {});
  const onProgress = job.onProgress || (() => {});
  const canvas = CANVAS[aspectRatio];
  if (!canvas) throw new Error(`Unknown aspect ratio ${aspectRatio}`);
  if (!html || !outFile) throw new Error('renderVideo needs html and outFile');

  const started = Date.now();
  const warnings = [];
  const dir = await mkdtemp(path.join(tmpdir(), 'adflash-render-'));
  const htmlFile = path.join(dir, 'index.html');
  await writeFile(htmlFile, html);

  const encoders = [];
  const extraBrowsers = [];
  let browser;
  try {
    // Preflight on the first page to learn the duration (and pick the capture mode).
    const session = await startSession(htmlFile, canvas, opts, log);
    browser = session.browser;
    const ropts = session.opts;
    const { first } = session;
    const { info } = first;
    if (!info.wasPaused) warnings.push('Timeline was not created paused (it was paused by the renderer).');
    if (info.stray) warnings.push(`${info.stray} tween(s) live outside window.__timeline and were frozen.`);
    if (info.cssAnimations) warnings.push(`${info.cssAnimations} CSS animation(s) found; driven from the timeline clock.`);
    if (info.failedImages?.length) warnings.push(`Images failed to load: ${info.failedImages.join(', ')}`);
    if (info.pageErrors?.length) warnings.push(`Page errors: ${info.pageErrors.join(' | ')}`);
    if (info.repeat === -1 || !Number.isFinite(info.duration)) throw new Error('Timeline repeats forever; duration is not finite.');

    const duration = job.duration ?? info.duration;
    if (!(duration > 0)) throw new Error(`Invalid duration ${duration}`);
    if (Math.abs(info.duration - duration) > 0.25) {
      warnings.push(`Timeline is ${info.duration.toFixed(2)}s but ${duration}s was requested; rendering ${duration}s.`);
    }
    const totalFrames = Math.round(duration * opts.fps);
    const workers = Math.max(1, Math.min(opts.workers, Math.ceil(totalFrames / 60)));
    log(`Rendering ${totalFrames} frames (${duration}s @ ${opts.fps}fps, ${canvas.width}x${canvas.height}) with ${workers} worker(s), ${ropts.mode} capture`);

    // Split into contiguous segments.
    const per = Math.ceil(totalFrames / workers);
    const segments = Array.from({ length: workers }, (_, i) => ({
      index: i,
      from: i * per,
      to: Math.min(totalFrames, (i + 1) * per),
      file: path.join(dir, `seg-${String(i).padStart(3, '0')}.mp4`),
    })).filter((s) => s.to > s.from);

    let framesDone = 0;
    let lastReport = 0;
    const report = (force) => {
      const now = Date.now();
      if (!force && now - lastReport < 250) return;
      lastReport = now;
      const secs = (now - started) / 1000;
      const fpsRate = framesDone / Math.max(secs, 0.001);
      onProgress({
        framesDone, totalFrames,
        percent: Math.min(100, Math.round((framesDone / totalFrames) * 1000) / 10),
        fpsRate: Math.round(fpsRate * 10) / 10,
        etaSeconds: Math.round((totalFrames - framesDone) / Math.max(fpsRate, 0.001)),
      });
    };

    const renderSegment = async (seg, ctx) => {
      const enc = startEncoder(seg.file, { ...ropts, outW: ropts.scale < 1 ? canvas.width : 0, outH: canvas.height });
      encoders.push(enc);
      for (let f = seg.from; f < seg.to; f++) {
        if (signal?.aborted) throw new Error('Render cancelled');
        await enc.write(await captureFrame(ctx, Math.min(info.duration, f / ropts.fps), ropts));
        framesDone++;
        report(false);
      }
      await enc.end();
      await ctx.page.close();
    };

    // Extra workers: one browser each, opened in parallel (one shared browser serialises the capture).
    const ctxs = [first.ctx, ...await Promise.all(segments.slice(1).map(async () => {
      const b = await launchBrowser(ropts.mode);
      extraBrowsers.push(b);
      const ctx = (await openPage(b, htmlFile, canvas, ropts, log)).ctx;
      if (ropts.mode === 'beginframe') await captureFrame(ctx, 0, ropts);
      return ctx;
    }))];
    await Promise.all(segments.map((seg, i) => renderSegment(seg, ctxs[i])));
    report(true);

    // Join segments without adding audio streams.
    const listFile = path.join(dir, 'segments.txt');
    await writeFile(listFile, segments.map((s) => `file '${s.file.replace(/'/g, "'\\''")}'`).join('\n'));
    const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-map', '0:v:0', '-an', '-c:v', 'copy'];
    args.push('-movflags', '+faststart', outFile);
    log('Joining silent video segments');
    await run('ffmpeg', args);

    const elapsedSeconds = Math.round((Date.now() - started) / 100) / 10;
    log(`Done in ${elapsedSeconds}s -> ${outFile}`);
    return { outFile, duration, totalFrames, elapsedSeconds, warnings, sfx: info.sfx || [], music: info.music || null };
  } catch (err) {
    encoders.forEach((e) => e.kill());
    throw err;
  } finally {
    await browser?.close().catch(() => {});
    await Promise.all(extraBrowsers.map((b) => b.close().catch(() => {})));
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Capture still frames (JPEG buffers) at the given times. Used for thumbnails, style
 * previews and the contact sheets in tests. One browser, screenshot capture.
 */
export async function snapshotFrames(html, times, { aspectRatio = '9:16', scale = 1, quality = 85 } = {}) {
  const canvas = CANVAS[aspectRatio];
  if (!canvas) throw new Error(`Unknown aspect ratio ${aspectRatio}`);
  const dir = await mkdtemp(path.join(tmpdir(), 'adflash-snap-'));
  const htmlFile = path.join(dir, 'index.html');
  await writeFile(htmlFile, html);
  const browser = await launchBrowser('screenshot');
  try {
    const opts = { ...DEFAULTS, mode: 'screenshot', frameFormat: 'jpeg', jpegQuality: quality };
    const { ctx } = await openPage(browser, htmlFile, canvas, opts, () => {});
    if (scale !== 1) await ctx.page.setViewport({ ...canvas, deviceScaleFactor: scale });
    const out = [];
    for (const t of times) out.push(await captureFrame(ctx, t, opts));
    return out;
  } finally {
    await browser.close().catch(() => {});
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
