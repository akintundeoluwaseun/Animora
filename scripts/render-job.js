// Runs on a GitHub Actions computer (see .github/workflows/render.yml): fetch one video job from the
// Animora website, record it with the same engine the server uses, and send the MP4 back in pieces.
// Usage: node scripts/render-job.js "<job url>"
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { renderVideo, inspectAnimation } from '../server/engine/renderer.js';
import { addSfxToVideo } from '../server/engine/sfx.js';
import { writeFile, readFile as readText } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Natural voice-over for premium films (scripts/voice.py, Kokoro on this machine). The script travels inside the film's code,
// and the film shows every spoken line as on-screen captions; the voice's exact timing is put back into the page before recording.
function voiceData(html) {
  const m = String(html).match(/window\.ANIMORA_PREMIUM=(\{.*?\});(?:\(function\(\)\{var a=|window\.__hyperframes)/);
  try { const d = m ? JSON.parse(m[1]) : null; return d?.voice?.lines?.length ? d.voice : null; } catch { return null; }
}
function makeVoice(spec, dir) {
  return new Promise((resolve) => {
    const file = path.join(dir, 'voice.wav'), specFile = path.join(dir, 'voice.json');
    writeFile(specFile, JSON.stringify(spec)).then(() => {
      const py = spawn('python3', [fileURLToPath(new URL('./voice.py', import.meta.url)), specFile, file], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = ''; py.stdout.on('data', (d) => { out += d; }); py.stderr.on('data', (d) => { out += d; });
      py.on('close', (code) => { console.log('voice:', out.trim().split('\n').pop()); resolve(code === 0 ? file : null); });
      py.on('error', () => resolve(null));
    });
  });
}

const jobUrl = process.argv[2];
if (!jobUrl) { console.error('usage: node scripts/render-job.js <job url>'); process.exit(2); }
const u = new URL(jobUrl);
const base = `${u.origin}${u.pathname}`, token = u.searchParams.get('t');
const at = (sub) => `${base}${sub}?t=${encodeURIComponent(token)}`;
// a thumbnail straight from the finished MP4 (no second browser to start)
const thumbFrom = (file, t) => new Promise((resolve) => {
  const ff = spawn('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', 'scale=432:-2', '-q:v', '4', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-'], { stdio: ['ignore', 'pipe', 'ignore'] });
  const chunks = []; ff.stdout.on('data', (d) => chunks.push(d));
  ff.on('close', (code) => resolve(code === 0 && chunks.length ? Buffer.concat(chunks) : null)); ff.on('error', () => resolve(null));
});
const post = async (sub, body, type = 'application/json') => {
  for (let tries = 0; ; tries++) {
    try {
      const res = await fetch(at(sub), { method: 'POST', headers: { 'Content-Type': type }, body: type === 'application/json' ? JSON.stringify(body) : body });
      if (!res.ok) throw new Error(`${sub} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
      return res.json();
    } catch (e) { if (tries >= 3) throw e; await new Promise((r) => setTimeout(r, 1500 * (tries + 1))); }
  }
};

try {
  const res = await fetch(jobUrl);
  if (!res.ok) throw new Error(`job -> ${res.status}`);
  const job = await res.json();
  console.log(`render ${job.id}: ${job.duration}s ${job.aspectRatio}`);
  const dir = await mkdtemp(path.join(tmpdir(), 'animora-'));
  const outFile = path.join(dir, 'video.mp4');
  const controller = new AbortController();
  let last = 0;
  // voice first: its exact timing decides when each caption word appears
  let html = job.html, voiceFile = null;
  const voice = voiceData(html);
  if (voice) {
    try {
      const info = await inspectAnimation(html, { aspectRatio: job.aspectRatio });
      const plan = info.caps || [];
      voiceFile = await makeVoice({ voice: voice.voice, lines: voice.lines, show: voice.show, times: plan.map((c) => c.t0), duration: info.duration }, dir);
      if (voiceFile) {
        const caps = await readText(`${voiceFile}.captions.json`, 'utf8');
        html = html.replace(/<head>/i, () => `<head><script>window.__captions=${caps.replace(/</g, '\\u003c')};</script>`);
      }
    } catch (e) { console.warn('voice skipped:', e.message); voiceFile = null; }
  }
  const result = await renderVideo({
    html, outFile, aspectRatio: job.aspectRatio, duration: job.duration, signal: controller.signal,
    onProgress: (p) => {
      if (Date.now() - last < 4000 && p.framesDone < p.totalFrames) return;   // progress every 4 s (fewer calls to the free server)
      last = Date.now();
      post('/progress', { percent: Math.round(p.percent * 0.95), framesDone: p.framesDone, totalFrames: p.totalFrames, etaSeconds: p.etaSeconds })
        .then((r) => { if (r.cancelled) controller.abort(); }).catch(() => {});
    },
  });
  // sound mixing and the thumbnail run side by side
  const withSound = (job.sfx && (result.sfx?.length || result.music)) || voiceFile
    ? addSfxToVideo(outFile, path.join(dir, 'video-sfx.mp4'), job.sfx ? result.sfx || [] : [], result.duration || job.duration, { music: job.sfx ? result.music : null, voiceFile }).catch((e) => { console.warn('sound skipped:', e.message); return outFile; })
    : Promise.resolve(outFile);
  const thumbSent = thumbFrom(outFile, Math.min(2, job.duration / 4)).then((t) => (t ? post('/thumb', t, 'image/jpeg') : null)).catch(() => {});
  const finalFile = await withSound;
  await thumbSent;
  const buf = await readFile(finalFile);
  const parts = Math.ceil(buf.length / job.partSize);
  // upload two pieces at a time
  let next = 0, sent = 0;
  const lane = async () => {
    while (next < parts) {
      const n = next++;
      await post(`/part/${n}`, buf.subarray(n * job.partSize, (n + 1) * job.partSize), 'application/octet-stream');
      sent++; post('/progress', { percent: 95 + Math.round((sent / parts) * 3) }).catch(() => {});
    }
  };
  await Promise.all([lane(), lane()]);
  await post('/done', { parts, size: (await stat(finalFile)).size });
  console.log(`done in ${result.elapsedSeconds}s, ${(buf.length / 1e6).toFixed(1)} MB in ${parts} part(s)`);
} catch (e) {
  console.error('render failed:', e);
  await post('/fail', { error: String(e.message).slice(0, 300) }).catch(() => {});
  process.exit(1);
}
