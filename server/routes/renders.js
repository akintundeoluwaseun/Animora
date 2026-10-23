import { Router } from 'express';
import { one, q } from '../db/index.js';
import { requireAuth, publicUser, loadUser } from '../auth.js';
import { createRender, startAdView, completeAdView, renderAllowance, freeRedo } from '../billing.js';
import { queuePosition } from '../worker.js';
import { config } from '../config.js';
import { dispatchRender, KEEP_MIN } from './renderJobs.js';

const r = Router();
r.use(['/projects', '/renders', '/ads'], requireAuth);

function shape(x, extra = {}) {
  return {
    id: x.id, projectId: x.project_id, status: x.status, progress: Number(x.progress), framesDone: x.frames_done,
    totalFrames: x.total_frames, etaSeconds: x.eta_seconds, videoUrl: x.video_url, thumbnailUrl: x.thumbnail_url,
    fileSize: x.file_size, error: x.error, paidVia: x.paid_via, adViewId: x.ad_view_id, aspectRatio: x.aspect_ratio,
    durationSeconds: x.duration_seconds, createdAt: x.created_at, startedAt: x.started_at, finishedAt: x.finished_at,
    stale: x.stale === true,
    // when this MP4 is deleted (it can be made again, free)
    expiresAt: x.status === 'done' && x.finished_at ? new Date(new Date(x.finished_at).getTime() + KEEP_MIN * 60e3).toISOString() : null,
    ...extra,   // stale: the video has been edited since this MP4 was made
  };
}

// What does the user need to do before rendering this project?
r.get('/projects/:id/render-check', async (req, res) => {
  const p = await one(`SELECT id, duration_seconds, code_html, code_html IS NOT NULL AS has_code
    FROM projects WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
  if (!p) return res.status(404).json({ error: 'Project not found.' });
  const redo = await freeRedo(req.user.id, p);
  const allow = renderAllowance(req.user, p.duration_seconds);
  res.json({ ...allow, ...(redo ? { ok: true, needsAd: false, redo: true } : {}), keepMinutes: KEEP_MIN, hasCode: p.has_code, user: publicUser(req.user) });
});

r.post('/projects/:id/renders', async (req, res) => {
  if (!config.renderEnabled) {
    return res.status(503).json({ code: 'NO_RENDERER', error: "MP4 export isn't switched on for this website yet. You can still plan, preview and edit your video." });
  }
  const p = await one('SELECT * FROM projects WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!p) return res.status(404).json({ error: 'Project not found.' });
  if (p.kind === 'flyer') return res.status(400).json({ error: 'Flyers are downloaded as pictures. Open your video to make an MP4.' });
  try {
    const render = await createRender(req.user, p, { adViewId: req.body?.adViewId });
    if (config.githubRender && config.serverless) await dispatchRender(render);   // a GitHub Actions run makes the MP4
    res.json({ render: shape(render, { queuePosition: await queuePosition(render.id) }), user: publicUser(await loadUser(req.user.id)) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, code: e.code });
  }
});

r.get('/renders', async (req, res) => {
  const rows = await q(`SELECT r.id, r.project_id, r.status, r.progress, r.frames_done, r.total_frames, r.eta_seconds, r.video_url, r.thumbnail_url, r.file_size, r.error,
      r.paid_via, r.ad_view_id, r.aspect_ratio, r.duration_seconds, r.created_at, r.started_at, r.finished_at, p.title,
      (r.code_html IS DISTINCT FROM p.code_html) AS stale FROM renders r JOIN projects p ON p.id=r.project_id
    WHERE r.user_id=$1 AND NOT (r.status='failed' AND (r.error='expired' OR r.error LIKE 'This MP4 was cleared%')) ORDER BY r.created_at DESC LIMIT 100`, [req.user.id]);
  res.json({ renders: rows.map((x) => shape(x, { title: x.title })) });
});

r.get('/renders/:id', async (req, res) => {
  const x = await one(`SELECT r.*, p.title, (r.code_html IS DISTINCT FROM p.code_html) AS stale FROM renders r JOIN projects p ON p.id=r.project_id WHERE r.id=$1 AND r.user_id=$2`, [req.params.id, req.user.id]);
  if (!x) return res.status(404).json({ error: 'Render not found.' });
  if (x.status === 'failed' && (x.error === 'expired' || /^This MP4 was cleared/.test(x.error || ''))) return res.json({ render: null });   // expired: say nothing
  res.json({ render: shape(x, { title: x.title, queuePosition: x.status === 'queued' ? await queuePosition(x.id) : 0 }) });
});

r.post('/renders/:id/cancel', async (req, res) => {
  const x = await one(`UPDATE renders SET status='cancelled', error='Cancelled.', finished_at=now()
    WHERE id=$1 AND user_id=$2 AND status IN ('queued','rendering') RETURNING *`, [req.params.id, req.user.id]);
  if (!x) return res.status(400).json({ error: 'This render cannot be cancelled.' });
  // Queued jobs never reach the worker, so give the credit back here. Rendering jobs are refunded by the worker.
  if (x.started_at === null && Number(x.revenue_ngn) > 0) await q('UPDATE users SET videos_used_this_month = GREATEST(0, videos_used_this_month-1) WHERE id=$1', [req.user.id]);
  res.json({ render: shape(x) });
});

// ---------------- ads (free plan / Pro over limit) ----------------
r.post('/ads/start', async (req, res) => {
  res.json(await startAdView(req.user, req.body?.projectId));
});

r.post('/ads/:viewId/complete', async (req, res) => {
  try {
    res.json(await completeAdView(req.user, req.params.viewId));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default r;
