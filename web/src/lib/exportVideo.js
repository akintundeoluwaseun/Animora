import { masterTrack } from '../../../server/engine/master.js';
// Make the MP4 in the browser, straight from the video's code: no video server and nothing stored online.
// The animation plays frame by frame in a hidden frame; each frame is drawn to a canvas (fastCapture.js),
// encoded to H.264 with the browser's WebCodecs encoder, and the music + sound effects are mixed and
// encoded to AAC. mp4-muxer packs both into an .mp4 the user downloads.
import { prepareFastCapture } from './fastCapture.js';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const SIZES = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350], 'A4': [1240, 1754] };
const SR = 44100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function canExportVideo() {
  return typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;
}

async function pickVideoCodec(width, height, fps) {
  // motion graphics are mostly flat colour: ~3.5 Mbps at 1080p looks the same and keeps a 20 s video around 9 MB
  const bitrate = Math.min(4_000_000, Math.round(width * height * fps * 0.056));
  // H.264 first (plays everywhere: WhatsApp, Instagram, TikTok); VP9 / AV1 only where H.264 encoding is missing
  const options = [
    ['avc', 'avc1.640033', { avc: { format: 'avc' } }], ['avc', 'avc1.640028', { avc: { format: 'avc' } }],
    ['avc', 'avc1.4d0033', { avc: { format: 'avc' } }], ['avc', 'avc1.42e033', { avc: { format: 'avc' } }],
    ['vp9', 'vp09.00.40.08', {}], ['av1', 'av01.0.08M.08', {}],
  ];
  for (const [mux, codec, extra] of options) {
    const config = { codec, width, height, bitrate, framerate: fps, ...extra };
    try { if ((await VideoEncoder.isConfigSupported(config)).supported) return { mux, config }; } catch { /* try the next one */ }
  }
  return null;
}

async function pickAudioCodec() {
  if (!('AudioEncoder' in window)) return null;
  for (const [mux, codec] of [['aac', 'mp4a.40.2'], ['opus', 'opus']]) {
    const config = { codec, sampleRate: SR, numberOfChannels: 1, bitrate: 96000 };
    try { if ((await AudioEncoder.isConfigSupported(config)).supported) return { mux, config }; } catch { /* next */ }
  }
  return null;
}

/** The same mix as the server: soft effects lifted to a steady level, music under them with fades. */
async function mixAudio(sfx, music, duration) {
  const n = Math.ceil(duration * SR);
  const mix = new Float32Array(n);
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Ctx) return null;
  const dec = new Ctx(1, SR, SR);
  const load = async (url) => { try { const r = await fetch(url); return await dec.decodeAudioData(await r.arrayBuffer()); } catch { return null; } };
  const names = [...new Set((sfx || []).map((e) => e.k))];
  const bank = Object.fromEntries(await Promise.all(names.map(async (k) => [k, await load(`/sfx/${k}.wav`)])));
  for (const e of sfx || []) {
    const b = bank[e.k]; if (!b) continue;
    const s = b.getChannelData(0), start = Math.round(e.t * SR), v = (Number(e.v) || 1) * 0.6;
    for (let i = 0; i < s.length && start + i < n; i++) if (start + i >= 0) mix[start + i] += s[i] * v;
  }
  const musicUrl = music?.url || null;   // built-in songs retired: effects only, or the owner's own music
  const mb = musicUrl ? await load(musicUrl) : null;
  if (mb) {
    const m = mb.getChannelData(0);
    let mp = 0; for (let i = 0; i < m.length; i++) mp = Math.max(mp, Math.abs(m[i]));
    const g = mp > 0 ? 0.22 / mp : 0, fin = SR * 0.4, fout = SR * 1.6;
    for (let i = 0; i < n; i++) mix[i] += m[i % m.length] * g * Math.min(1, i / fin, (n - i) / fout);
  }
  if (!sfx?.length && !mb) return null;
  masterTrack(mix, SR, { target: -12.5 });   // same mastering as the server MP4
  return mix;
}

/** Load the video code in a hidden same-origin frame at full size and wait until it is ready to seek. */
export async function loadFrame(html, width, height) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-${width + 100}px;top:0;width:${width}px;height:${height}px;border:0;pointer-events:none;`;
  frame.srcdoc = html;
  document.body.appendChild(frame);
  await new Promise((r) => { frame.onload = r; });
  const win = frame.contentWindow, doc = frame.contentDocument;
  for (let i = 0; i < 200 && !win.__timeline; i++) await sleep(50);
  if (!win.__timeline) { frame.remove(); throw new Error("The video's code didn't start. Press Regenerate and try again."); }
  const capped = (p) => Promise.race([p, sleep(8000)]);
  await capped(doc.fonts ? doc.fonts.ready : Promise.resolve());
  await capped(Promise.all([...doc.images].map((img) => (img.complete ? (img.decode ? img.decode().catch(() => {}) : null) : new Promise((r) => { img.onload = img.onerror = r; })))));
  const tl = win.__timeline;
  tl.pause();
  if (win.gsap?.globalTimeline) win.gsap.globalTimeline.getChildren(false, true, true).forEach((c) => { if (c !== tl) c.pause(); });
  return { frame, win, doc, tl };
}

/**
 * @param {object} o
 * @param {string} o.html       the video's HTML (already prepared for the preview: local GSAP)
 * @param {string} o.aspect     '9:16' | '16:9' | '1:1'
 * @param {number} [o.fps=30]
 * @param {(p:{stage:string, done:number, total:number})=>void} [o.onProgress]
 * @param {AbortSignal} [o.signal]
 * @returns {Promise<Blob>} an MP4
 */
export async function exportVideo({ html, aspect = '9:16', fps = 30, quality = 'hd', onProgress = () => {}, signal }) {
  if (!canExportVideo()) throw new Error("This browser can't make videos. Open Animora in Chrome (Android or computer) or Edge to download the MP4.");
  const [W, H] = SIZES[aspect] || SIZES['9:16'];
  // 'fast' = 720p: the page is still laid out at full size, then drawn smaller (about twice as quick)
  const k = quality === 'fast' ? 2 / 3 : 1;
  const width = Math.round((W * k) / 2) * 2, height = Math.round((H * k) / 2) * 2;
  const v = await pickVideoCodec(width, height, fps);
  if (!v) throw new Error("This browser can't encode HD video. Try Chrome on a computer.");
  onProgress({ stage: 'Getting ready', done: 0, total: 1 });

  const { frame, win, doc, tl } = await loadFrame(html, W, H);
  try {
    const duration = tl.duration();
    const total = Math.max(1, Math.round(duration * fps));
    const a = await pickAudioCodec();
    const audio = a ? await mixAudio(win.__sfx || [], (win.ADFLASH_DATA || {}).music || null, duration) : null;

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target, fastStart: 'in-memory', firstTimestampBehavior: 'offset',
      video: { codec: v.mux, width, height, frameRate: fps },
      ...(audio ? { audio: { codec: a.mux, sampleRate: SR, numberOfChannels: 1 } } : {}),
    });
    let failure = null;
    // Phones stop (and Chrome takes back) the video encoder when you leave the app. So when the page is
    // hidden we pause, and when you come back we start a fresh encoder from the last frame that was saved.
    let venc = null, outCount = 0, reclaimed = false;
    const makeEncoder = () => {
      const enc = new VideoEncoder({
        output: (chunk, meta) => { muxer.addVideoChunk(chunk, meta); outCount++; },
        error: (e) => { if (e?.name === 'QuotaExceededError' || /reclaim|inactiv/i.test(e?.message || '')) reclaimed = true; else failure = e; },
      });
      enc.configure(v.config);
      return enc;
    };
    venc = makeEncoder();

    // draw frames: stylesheet, fonts and pictures are embedded once; several frames rasterize at the same time
    const capture = await prepareFastCapture(doc, { width: W, height: H, outWidth: width, outHeight: height });
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const g = canvas.getContext('2d');
    const bg = win.getComputedStyle(doc.body).backgroundColor || '#000';
    let started = performance.now(), base = 0;
    let queue = [];
    let sent = 0, next = 0, forceKey = true;
    const report = () => {
      const elapsed = (performance.now() - started) / 1000, made = Math.max(1, sent - base);
      onProgress({ stage: 'Recording', done: sent, total, eta: Math.round((elapsed / made) * (total - sent)) });
    };
    const emit = async () => {
      const img = await queue.shift();
      g.fillStyle = bg; g.fillRect(0, 0, width, height);
      g.drawImage(img, 0, 0, width, height);
      const vf = new VideoFrame(canvas, { timestamp: Math.round((sent * 1e6) / fps), duration: Math.round(1e6 / fps) });
      venc.encode(vf, { keyFrame: forceKey || sent % (fps * 2) === 0 });
      forceKey = false;
      vf.close();
      sent++;
      while (venc.state === 'configured' && venc.encodeQueueSize > 6) await sleep(4);
      report();
    };
    const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const pause = async () => {
      onProgress({ stage: 'Paused', done: sent, total });
      try { if (venc.state === 'configured') await Promise.race([venc.flush(), sleep(1500)]); } catch { /* taken back */ }
      await new Promise((r) => {
        const on = () => { if (!hidden()) { document.removeEventListener('visibilitychange', on); r(); } };
        document.addEventListener('visibilitychange', on); on();
      });
      await sleep(250);
      try { if (venc.state === 'configured') await venc.flush(); } catch { /* taken back */ }
      if (reclaimed || venc.state !== 'configured' || outCount < sent) {
        // start again from the last frame that made it into the file
        try { if (venc.state !== 'closed') venc.close(); } catch { /* ignore */ }
        reclaimed = false; failure = null;
        venc = makeEncoder();
        sent = outCount; next = outCount; queue = []; forceKey = true;
      }
      started = performance.now(); base = sent;
      report();
    };
    while (sent < total) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (hidden() || reclaimed) { await Promise.allSettled(queue); await pause(); continue; }
      if (failure) throw failure;
      if (next < total) {
        const t = Math.min(duration, next / fps);
        tl.seek(t, false);
        if (doc.getAnimations) for (const an of doc.getAnimations()) { an.pause(); an.currentTime = t * 1000; }
        queue.push(capture());          // the copy of this frame is taken now; rasterizing runs in the background
        next++;
        if (queue.length >= 3) await emit();
      } else await emit();
    }
    while (hidden()) await pause();
    await venc.flush();
    if (reclaimed || outCount < total) throw new Error('The phone stopped the recording. Press Download MP4 again and keep Animora open.');
    venc.close();

    if (audio) {
      while (hidden()) await new Promise((r) => setTimeout(r, 300));
      onProgress({ stage: 'Adding sound', done: total, total });
      const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { failure = e; } });
      aenc.configure(a.config);
      const step = 4096;
      for (let o = 0; o < audio.length; o += step) {
        const part = audio.subarray(o, Math.min(audio.length, o + step));
        const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: part.length, numberOfChannels: 1, timestamp: Math.round((o / SR) * 1e6), data: part });
        aenc.encode(ad); ad.close();
      }
      await aenc.flush(); aenc.close();
      if (failure) throw failure;
    }
    muxer.finalize();
    onProgress({ stage: 'Done', done: total, total });
    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    blob.codec = v.mux;
    return blob;
  } finally {
    frame.remove();
  }
}

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** A still picture of the video (for the thumbnail in My videos). Returns a JPEG Blob. */
export async function snapshot({ html, aspect = '9:16', at = 1.8, width = 360 }) {
  const [W, H] = SIZES[aspect] || SIZES['9:16'];
  const height = Math.round((width * H) / W);
  const { frame, win, doc, tl } = await loadFrame(html, W, H);
  try {
    const capture = await prepareFastCapture(doc, { width: W, height: H, outWidth: width, outHeight: height });
    tl.seek(Math.min(at, tl.duration() * 0.4), false);
    const img = await capture();
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const g = c.getContext('2d'); g.fillStyle = win.getComputedStyle(doc.body).backgroundColor || '#000'; g.fillRect(0, 0, width, height);
    g.drawImage(img, 0, 0, width, height);
    return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
  } finally { frame.remove(); }
}
