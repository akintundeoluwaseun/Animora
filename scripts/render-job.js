// Runs on a GitHub Actions computer (see .github/workflows/render.yml): fetch one video job from the
// Animora website, record it with the same engine the server uses, and send the MP4 back in pieces.
// Usage: node scripts/render-job.js "<job url>"
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderVideo, snapshotFrames } from '../server/engine/renderer.js';
import { addSfxToVideo } from '../server/engine/sfx.js';

const jobUrl = process.argv[2];
if (!jobUrl) { console.error('usage: node scripts/render-job.js <job url>'); process.exit(2); }
const u = new URL(jobUrl);
const base = `${u.origin}${u.pathname}`, token = u.searchParams.get('t');
const at = (sub) => `${base}${sub}?t=${encodeURIComponent(token)}`;
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
  const result = await renderVideo({
    html: job.html, outFile, aspectRatio: job.aspectRatio, duration: job.duration, signal: controller.signal,
    onProgress: (p) => {
      if (Date.now() - last < 4000 && p.framesDone < p.totalFrames) return;   // progress every 4 s (fewer calls to the free server)
      last = Date.now();
      post('/progress', { percent: Math.round(p.percent * 0.95), framesDone: p.framesDone, totalFrames: p.totalFrames, etaSeconds: p.etaSeconds })
        .then((r) => { if (r.cancelled) controller.abort(); }).catch(() => {});
    },
  });
  let finalFile = outFile;
  if (job.sfx && (result.sfx?.length || result.music)) {
    try { finalFile = await addSfxToVideo(outFile, path.join(dir, 'video-sfx.mp4'), result.sfx || [], job.duration, { music: result.music }); }
    catch (e) { console.warn('sound skipped:', e.message); }
  }
  const [thumb] = await snapshotFrames(job.html, [Math.min(2, job.duration / 4)], { aspectRatio: job.aspectRatio, scale: 0.4 }).catch(() => [null]);
  if (thumb) await post('/thumb', thumb, 'image/jpeg').catch(() => {});
  const buf = await readFile(finalFile);
  const parts = Math.ceil(buf.length / job.partSize);
  for (let n = 0; n < parts; n++) {
    await post(`/part/${n}`, buf.subarray(n * job.partSize, (n + 1) * job.partSize), 'application/octet-stream');
    await post('/progress', { percent: 95 + Math.round(((n + 1) / parts) * 3) }).catch(() => {});
  }
  await post('/done', { parts, size: (await stat(finalFile)).size });
  console.log(`done in ${result.elapsedSeconds}s, ${(buf.length / 1e6).toFixed(1)} MB in ${parts} part(s)`);
} catch (e) {
  console.error('render failed:', e);
  await post('/fail', { error: String(e.message).slice(0, 300) }).catch(() => {});
  process.exit(1);
}
