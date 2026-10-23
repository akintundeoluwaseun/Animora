// Owner dashboard: one private page with the numbers that matter.
//   GET /api/admin/stats     needs the header  x-admin-key: <ADMIN_KEY>
// It is switched off until ADMIN_KEY is set in the environment (Vercel > Settings > Environment Variables).
import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { q, one } from '../db/index.js';
import { clearOldVideos } from './renderJobs.js';

const r = Router();

const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
function adminOnly(req, res, next) {
  if (!config.adminKey) return res.status(404).json({ error: 'The admin dashboard is off. Set ADMIN_KEY to turn it on.' });
  const key = req.get('x-admin-key') || '';
  if (!key || !same(key, config.adminKey)) return res.status(403).json({ error: 'Wrong admin key.' });
  next();
}

const days = (rows, field = 'n') => Object.fromEntries(rows.map((x) => [String(x.d).slice(0, 10), Number(x[field])]));
const series = (map, n = 30) => Array.from({ length: n }, (_, i) => { const d = new Date(Date.now() - (n - 1 - i) * 864e5).toISOString().slice(0, 10); return { day: d, n: map[d] || 0 }; });
const num = (v) => Number(v || 0);
const safe = async (fn, fallback) => { try { return await fn(); } catch (e) { console.warn('[admin]', e.message); return fallback; } };

r.get('/admin/stats', adminOnly, async (req, res) => {
  const users = await safe(() => one(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS week,
      count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS month,
      count(*) FILTER (WHERE plan = 'pro')::int AS pro FROM users`), {});
  const projects = await safe(() => one(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE kind = 'video')::int AS videos,
      count(*) FILTER (WHERE kind = 'flyer')::int AS flyers,
      count(*) FILTER (WHERE code_html IS NOT NULL)::int AS designed,
      count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS today,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS week FROM projects`), {});
  const renders = await safe(() => one(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE status = 'done')::int AS done,
      count(*) FILTER (WHERE status = 'failed')::int AS failed,
      count(*) FILTER (WHERE status IN ('queued','rendering'))::int AS busy,
      count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS today FROM renders`), {});
  const pay = await safe(() => one(`SELECT count(*) FILTER (WHERE status = 'success')::int AS paid,
      COALESCE(sum(amount) FILTER (WHERE status = 'success'), 0) AS revenue,
      COALESCE(sum(amount) FILTER (WHERE status = 'success' AND paid_at > now() - interval '30 days'), 0) AS month FROM payments`), {});
  const perDay = async (table, col = 'created_at', where = '') => days(await safe(() => q(`SELECT date_trunc('day', ${col})::date AS d, count(*)::int AS n FROM ${table} WHERE ${col} > now() - interval '30 days' ${where} GROUP BY 1`), []));
  const [uDay, vDay, fDay, rDay] = await Promise.all([perDay('users'), perDay('projects', 'created_at', "AND kind='video'"), perDay('projects', 'created_at', "AND kind='flyer'"), perDay('renders', 'created_at', "AND status='done'")]);
  const failures = await safe(() => q(`SELECT left(COALESCE(error, 'unknown'), 120) AS msg, count(*)::int AS n FROM renders WHERE status = 'failed' AND created_at > now() - interval '30 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 6`), []);
  const recent = await safe(() => q(`SELECT p.title, p.kind, p.aspect_ratio, p.status, p.created_at, p.duration_seconds FROM projects p
      WHERE p.code_html IS NOT NULL ORDER BY p.created_at DESC LIMIT 12`), []);
  const styles = await safe(() => q(`SELECT COALESCE(s.name, 'Auto') AS name, count(*)::int AS n FROM projects p LEFT JOIN styles s ON s.id = p.style_id WHERE p.code_html IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 6`), []);
  const aspects = await safe(() => q(`SELECT aspect_ratio AS name, count(*)::int AS n FROM projects WHERE code_html IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`), []);
  res.json({
    at: new Date().toISOString(),
    users: { total: num(users.total), week: num(users.week), month: num(users.month), pro: num(users.pro) },
    projects: { total: num(projects.total), videos: num(projects.videos), flyers: num(projects.flyers), designed: num(projects.designed), today: num(projects.today), week: num(projects.week) },
    renders: { total: num(renders.total), done: num(renders.done), failed: num(renders.failed), busy: num(renders.busy), today: num(renders.today) },
    money: { paid: num(pay.paid), revenue: num(pay.revenue), month: num(pay.month) },
    daily: { users: series(uDay), videos: series(vDay), flyers: series(fDay), renders: series(rDay) },
    failures, recent, styles, aspects,
  });
});

// What is using the database space, and a button to give it back.
async function storageReport() {
  const total = await safe(() => one('SELECT pg_database_size(current_database())::bigint AS b'), {});
  const tables = await safe(() => q(`SELECT relname AS name, pg_total_relation_size(c.oid)::bigint AS bytes FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY 2 DESC LIMIT 12`), []);
  const files = await safe(() => q(`SELECT CASE WHEN key LIKE 'renders/%.mp4%' THEN 'MP4 videos' WHEN key LIKE 'renders/%' OR key LIKE 'thumbs/%' THEN 'Covers'
      WHEN key LIKE 'uploads/%' THEN 'Pictures and music people uploaded' WHEN key LIKE 'voice/%' THEN 'Narration'
      WHEN key LIKE 'styles/%' THEN 'Style previews' ELSE 'Other' END AS name, count(*)::int AS n, COALESCE(sum(octet_length(data)), 0)::bigint AS bytes
      FROM files GROUP BY 1 ORDER BY 3 DESC`), []);
  return { total: num(total.b), tables: tables.map((x) => ({ name: x.name, bytes: num(x.bytes) })), files: files.map((x) => ({ name: x.name, n: x.n, bytes: num(x.bytes) })) };
}

r.get('/admin/storage', adminOnly, async (req, res) => res.json(await storageReport()));

// Delete expired MP4s and leftovers now, then hand the freed space back (VACUUM FULL rewrites the tables, which takes a moment).
r.post('/admin/storage/clean', adminOnly, async (req, res) => {
  const before = await storageReport();
  await clearOldVideos({ force: true }).catch((e) => console.warn('[admin] clean:', e.message));
  for (const t of ['files', 'renders']) await q(`VACUUM FULL ${t}`).catch((e) => console.warn('[admin] vacuum', t, e.message));
  res.json({ before: before.total, ...(await storageReport()) });
});

export default r;
