// MP4s made by a GitHub Actions run (Vercel can't run Chrome + FFmpeg for minutes).
// 1. The site creates the render and asks GitHub to start .github/workflows/render.yml with a job URL.
// 2. The run fetches the job (video code), records it with the same engine as everywhere else,
//    reports progress, and uploads the MP4 in pieces (Vercel accepts ~4.5 MB per request).
// 3. The MP4 is served back in pieces too (range requests), so it plays and downloads normally.
// Each job has its own random token; nothing else is needed to talk to these endpoints.
import { Router, raw } from 'express';
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { one, q } from '../db/index.js';
import { putObject, getDbObject } from '../storage.js';
import { settleRender, refundRender } from '../billing.js';
import { notifyUser } from '../push.js';

const r = Router();
const PART = 3.5 * 1024 * 1024;   // bytes per uploaded piece
const SERVE = 4 * 1024 * 1024;    // bytes per served range

export async function dispatchRender(render) {
  const token = randomBytes(24).toString('hex');
  await q('UPDATE renders SET job_token=$2 WHERE id=$1', [render.id, token]);
  const jobUrl = `${config.publicBaseUrl}/api/render-jobs/${render.id}?t=${token}`;
  const res = await fetch(`https://api.github.com/repos/${config.githubRepo}/actions/workflows/render.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.githubToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'animora' },
    body: JSON.stringify({ ref: config.githubRef, inputs: { job_url: jobUrl } }),
  });
  if (!res.ok) {
    const t = (await res.text()).slice(0, 200);
    await q("UPDATE renders SET status='failed', error=$2, finished_at=now() WHERE id=$1", [render.id, 'Something went wrong. Please try again later.']);
    console.error(`[render] GitHub dispatch ${res.status}: ${t}`);
    await refundRender(render.id);
    throw Object.assign(new Error('Something went wrong. Please try again later.'), { status: 502 });
  }
}

async function job(req, res) {
  const j = await one('SELECT * FROM renders WHERE id=$1', [req.params.id]).catch(() => null);
  if (!j || !j.job_token || req.query.t !== j.job_token) { res.status(403).json({ error: 'Bad job token' }); return null; }
  return j;
}

// the run asks what to record
r.get('/render-jobs/:id', async (req, res) => {
  const j = await job(req, res); if (!j) return;
  if (j.status === 'cancelled') return res.status(410).json({ error: 'Cancelled' });
  await q("UPDATE renders SET status='rendering', started_at=COALESCE(started_at, now()), worker_id='github' WHERE id=$1 AND status='queued'", [j.id]);
  res.json({ id: j.id, html: j.code_html, aspectRatio: j.aspect_ratio, duration: j.duration_seconds, sfx: j.sfx_on !== false, partSize: PART });
});

r.post('/render-jobs/:id/progress', async (req, res) => {
  const j = await job(req, res); if (!j) return;
  const p = req.body || {};
  await q("UPDATE renders SET progress=$2, frames_done=$3, total_frames=$4, eta_seconds=$5 WHERE id=$1 AND status IN ('queued','rendering')",
    [j.id, Math.min(98, Number(p.percent) || 0), Number(p.framesDone) || 0, Number(p.totalFrames) || 0, Number(p.etaSeconds) || null]);
  const now = await one('SELECT status FROM renders WHERE id=$1', [j.id]);
  res.json({ cancelled: now?.status === 'cancelled' });
});

r.post('/render-jobs/:id/part/:n', raw({ type: '*/*', limit: '4.4mb' }), async (req, res) => {
  const j = await job(req, res); if (!j) return;
  const n = Number(req.params.n);
  if (!Number.isInteger(n) || n < 0 || n > 400 || !req.body?.length) return res.status(400).json({ error: 'Bad part' });
  await putObject(`renders/${j.id}.mp4.part${n}`, req.body, 'video/mp4');
  res.json({ ok: true });
});

r.post('/render-jobs/:id/thumb', raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const j = await job(req, res); if (!j) return;
  const url = await putObject(`renders/${j.id}.jpg`, req.body, 'image/jpeg');
  await q('UPDATE renders SET thumbnail_url=$2 WHERE id=$1', [j.id, url]);
  await q('UPDATE projects SET thumbnail_url=$2 WHERE id=$1', [j.project_id, url]);
  res.json({ ok: true });
});

r.post('/render-jobs/:id/done', async (req, res) => {
  const j = await job(req, res); if (!j) return;
  const { parts, size } = req.body || {};
  const url = `${config.publicBaseUrl}/api/render-file/${j.id}`;
  await q(`UPDATE renders SET status='done', progress=100, frames_done=total_frames, eta_seconds=0, video_url=$2, file_size=$3,
    chunk_count=$4, chunk_size=$5, finished_at=now(), job_token=NULL WHERE id=$1`, [j.id, url, Number(size) || null, Number(parts) || 0, PART]);
  await settleRender(j.id).catch(() => {});
  clearOldVideos().catch((e) => console.warn('[renders] cleanup:', e.message));
  const p = await one('SELECT title FROM projects WHERE id=$1', [j.project_id]);
  await notifyUser(j.user_id, { title: 'Your MP4 is ready', body: `${p?.title || 'Your video'}: tap to download it.`, url: `/p/${j.project_id}/render`, tag: `render-${j.id}` });
  res.json({ ok: true, url });
});

r.post('/render-jobs/:id/fail', async (req, res) => {
  const j = await job(req, res); if (!j) return;
  await q("UPDATE renders SET status='failed', error=$2, finished_at=now(), job_token=NULL WHERE id=$1 AND status<>'cancelled'",
    [j.id, 'Making the MP4 failed. Please try again.']);
  await refundRender(j.id);
  await notifyUser(j.user_id, { title: "Your MP4 didn't finish", body: 'Open Animora and try again.', url: `/p/${j.project_id}/render`, tag: `render-${j.id}` });
  res.json({ ok: true });
});

// Keep the free database small: finished MP4s are cleared after KEEP_DAYS (the video's design stays, so the
// owner can make the MP4 again for free with one tap). Runs after each finished render.
const KEEP_DAYS = Number(process.env.MP4_KEEP_DAYS) || 3;
export async function clearOldVideos() {
  const old = await q(`SELECT id FROM renders WHERE status='done' AND chunk_count > 0 AND finished_at < now() - ($1 || ' days')::interval LIMIT 50`, [String(KEEP_DAYS)]);
  for (const { id } of old) {
    await q("DELETE FROM files WHERE key LIKE $1", [`renders/${id}.mp4%`]);
    await q("UPDATE renders SET status='failed', chunk_count=0, video_url=NULL, error=$2 WHERE id=$1", [id, `This MP4 was cleared after ${KEEP_DAYS} days to keep Animora free. Press Generate Video to make it again (free).`]);
  }
  if (old.length) console.log(`[renders] cleared ${old.length} old MP4(s)`);
}

// The finished MP4, served in ranges of at most 4 MB (players and our download button ask for the next part).
r.get('/render-file/:id', async (req, res) => {
  const j = await one('SELECT id, file_size, chunk_count, chunk_size FROM renders WHERE id=$1 AND status=$2', [req.params.id, 'done']);
  if (!j?.chunk_count) return res.status(404).send('Video not found');
  const size = Number(j.file_size), part = Number(j.chunk_size);
  const m = String(req.headers.range || '').match(/bytes=(\d*)-(\d*)/);
  let start = m && m[1] ? Number(m[1]) : 0;
  let end = m && m[2] ? Number(m[2]) : size - 1;
  if (start >= size) return res.status(416).set('Content-Range', `bytes */${size}`).end();
  end = Math.min(end, size - 1, start + SERVE - 1);
  const chunks = [];
  for (let n = Math.floor(start / part); n <= Math.floor(end / part); n++) {
    const f = await getDbObject(`renders/${j.id}.mp4.part${n}`);
    if (!f) return res.status(500).send('Part missing');
    const s0 = n * part;
    chunks.push(f.data.subarray(Math.max(0, start - s0), Math.min(f.data.length, end - s0 + 1)));
  }
  const body = Buffer.concat(chunks);
  res.status(206).set({
    'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${start + body.length - 1}/${size}`,
    'Content-Length': body.length, 'Cache-Control': 'public, max-age=31536000, immutable', 'CDN-Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*',
  }).send(body);
});

export default r;
