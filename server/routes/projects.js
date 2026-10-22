import { Router } from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { one, q } from '../db/index.js';
import { requireAuth } from '../auth.js';
import { putObject } from '../storage.js';
import { waitUntil } from '@vercel/functions';
import { notifyUser } from '../push.js';
import { chatTurn, generateCode, editCode, limitsFor, aiMode } from '../ai/index.js';
import { validateHtml, inspectProblems, validatePlan } from '../engine/validate.js';
import { inspectAnimation, snapshotFrames } from '../engine/renderer.js';
import { probeBuffer, toMp3 } from '../media.js';
import { voiceoverFormats, generateVoiceTrack, VOICES, hasOfflineVoice } from '../ai/voice.js';
import { config } from '../config.js';
import { cleanBrief, briefToPlanRules, suggest, autoStyleSlug, parseBrief } from '../ai/brief.js';
import { makeFlyer, flyerFitNotice } from '../ai/flyer.js';
import { adjustDesign, aspectOf, currentLook } from '../ai/adjust.js';
import { useCredit, NEED_CREDITS } from '../billing.js';
import { describeAssets } from '../ai/describe.js';
import { loadImage } from '../ai/index.js';

const MAX_IMAGES = 10;

const r = Router();
r.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const IMAGE = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/;
const AUDIO = /^audio\/(mpeg|mp3|wav|x-wav|aac|mp4|x-m4a|ogg)$/;

const MAX_VERSIONS = 15;

async function loadProject(req, res) {
  const p = await one('SELECT * FROM projects WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!p) res.status(404).json({ error: 'Project not found.' });
  return p;
}

async function loadStyle(id) {
  if (!id) return null;
  return one(`SELECT s.*, u.name AS creator_name FROM styles s LEFT JOIN users u ON u.id=s.creator_id WHERE s.id=$1`, [id])
    .then((s) => s && { ...s, creatorName: s.creator_name });
}

const projectAssets = (projectId) => q(`SELECT id, name, kind, role, mime, url, width, height, has_alpha, duration_seconds, is_light, description
  FROM assets WHERE project_id=$1 AND (role IS NULL OR role <> 'voice') ORDER BY created_at`, [projectId]);

// Whole-second total length: the final scene absorbs any fraction.
function normalizePlan(plan) {
  if (!plan?.scenes?.length) return plan;
  const D = Math.ceil(Number(plan.duration_seconds) - 0.001);
  plan.duration_seconds = D;
  plan.scenes[plan.scenes.length - 1].end = D;
  return plan;
}

function shape(p, extra = {}) {
  return {
    id: p.id, kind: p.kind || 'video', sourceProjectId: p.source_project_id || null, title: p.title, status: p.status, aspectRatio: p.aspect_ratio, durationSeconds: p.duration_seconds,
    styleId: p.style_id, plan: p.plan_json, planSummary: p.plan_summary, chat: p.chat_history,
    code: p.code_html, versions: (p.code_versions || []).length, editHistory: p.edit_history,
    brief: p.brief_json || null, sfx: p.sfx_on !== false, aiSource: p.ai_source, thumbnailUrl: p.thumbnail_url, createdAt: p.created_at, updatedAt: p.updated_at,
    gen: p.gen_state ? {
      state: p.gen_state === 'working' && p.gen_started_at && Date.now() - new Date(p.gen_started_at).getTime() > 6 * 60e3 ? 'failed' : p.gen_state,
      message: p.gen_message || '', error: p.gen_error || (p.gen_state === 'working' && p.gen_started_at && Date.now() - new Date(p.gen_started_at).getTime() > 6 * 60e3 ? "It didn't finish. Press Make my video to try again." : ''),
      startedAt: p.gen_started_at,
    } : null,
    voice: p.voice_url ? { url: p.voice_url, duration: Number(p.voice_duration), source: p.voice_source, fitToVoice: p.fit_to_voice } : null,
    ...extra,
  };
}

async function thumbnail(projectId, html, aspect) {
  if (config.serverless) { await q('UPDATE projects SET thumbnail_url=NULL WHERE id=$1', [projectId]).catch(() => {}); return null; }   // needs Chrome (not on Vercel): the browser makes it
  try {
    const [img] = await snapshotFrames(html, [1.6], { aspectRatio: aspect, scale: 0.35 });
    const url = await putObject(`thumbs/${projectId}-${randomBytes(3).toString('hex')}.jpg`, img, 'image/jpeg');
    await q('UPDATE projects SET thumbnail_url=$2 WHERE id=$1', [projectId, url]);
    return url;
  } catch (e) {
    console.warn('[thumb]', e.message);
    return null;
  }
}

// ---------------- list / create / read / update / delete ----------------
r.get('/', async (req, res) => {
  // New projects nobody has put anything into are not kept: they never show in the lists, and old ones are cleared away.
  await q(`DELETE FROM projects p WHERE p.user_id=$1 AND p.code_html IS NULL AND p.plan_json IS NULL AND (p.brief_json IS NULL OR (COALESCE(p.brief_json->>'name','')='' AND COALESCE(p.brief_json->>'category','')='' AND COALESCE(p.brief_json->>'headline','')='' AND COALESCE(p.brief_json->>'goal','')='' AND COALESCE(p.brief_json->>'cta','')='' AND COALESCE(p.brief_json->>'contact','')='' AND COALESCE(p.brief_json->>'offer','')='' AND COALESCE(p.brief_json->>'pasteText','')='' AND jsonb_array_length(COALESCE(p.brief_json->'features','[]'::jsonb))=0 AND jsonb_array_length(COALESCE(p.brief_json->'products','[]'::jsonb))=0)) AND NOT EXISTS (SELECT 1 FROM assets a WHERE a.project_id=p.id) AND p.created_at < now() - interval '15 minutes'`, [req.user.id]).catch(() => {});
  // an MP4 that expired is simply not mentioned: no "Video ready", no "failed"
  const rows = await q(`SELECT p.id, p.kind, p.title, p.aspect_ratio, p.duration_seconds, p.thumbnail_url, p.updated_at, p.created_at,
      CASE WHEN p.status='rendered' AND NOT EXISTS (SELECT 1 FROM renders r2 WHERE r2.project_id=p.id AND r2.status='done') THEN 'ready' ELSE p.status END AS status,
      s.name AS style_name,
      (SELECT row_to_json(x) FROM (SELECT id, status, progress, video_url, created_at FROM renders WHERE project_id=p.id AND NOT (status='failed' AND (error='expired' OR error LIKE 'This MP4 was cleared%')) ORDER BY created_at DESC LIMIT 1) x) AS last_render
    FROM projects p LEFT JOIN styles s ON s.id=p.style_id WHERE p.user_id=$1 AND NOT (p.code_html IS NULL AND p.plan_json IS NULL AND (p.brief_json IS NULL OR (COALESCE(p.brief_json->>'name','')='' AND COALESCE(p.brief_json->>'category','')='' AND COALESCE(p.brief_json->>'headline','')='' AND COALESCE(p.brief_json->>'goal','')='' AND COALESCE(p.brief_json->>'cta','')='' AND COALESCE(p.brief_json->>'contact','')='' AND COALESCE(p.brief_json->>'offer','')='' AND COALESCE(p.brief_json->>'pasteText','')='' AND jsonb_array_length(COALESCE(p.brief_json->'features','[]'::jsonb))=0 AND jsonb_array_length(COALESCE(p.brief_json->'products','[]'::jsonb))=0)) AND NOT EXISTS (SELECT 1 FROM assets a WHERE a.project_id=p.id)) ORDER BY p.updated_at DESC`, [req.user.id]);
  res.json({ projects: rows });
});

r.post('/', async (req, res) => {
  const { title, styleId } = req.body || {};
  const kind = req.body?.kind === 'flyer' ? 'flyer' : 'video';
  const style = styleId ? await one("SELECT id FROM styles WHERE id=$1 AND status='live'", [styleId]) : null;
  const def = style || await one("SELECT id FROM styles WHERE slug='naija-bold'");
  // a style picked before starting (e.g. "use this style" on a style card) counts as the style answer
  const p = await one(`INSERT INTO projects (user_id, title, style_id, brief_json, kind) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.id, title?.trim() || (kind === 'flyer' ? 'New flyer' : 'New video'), def?.id || null, JSON.stringify(style ? { styleId: style.id } : {}), kind]);
  res.json({ project: shape(p, { assets: [] }) });
});

// A flyer made from a video: same answers, pictures and style, then the AI designs it straight away.
r.post('/:id/flyer', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  if (!p.brief_json && !p.plan_json) return res.status(400).json({ error: 'Answer the questions for this video first.' });
  if (req.user.unlimited !== true && config.credits.enabled) {
    const u = await one('SELECT free_left, credits FROM users WHERE id=$1', [req.user.id]);
    if (!u || (u.free_left + u.credits) <= 0) { const e = NEED_CREDITS(); return res.status(402).json({ error: e.message, code: e.code }); }
  }
  const brief = { ...(p.brief_json || {}), aspect: ['4:5', '9:16', '1:1', 'A4'].includes(req.body?.aspect) ? req.body.aspect : '4:5' };
  const plan = { ...(p.plan_json || {}), aspect_ratio: brief.aspect };
  const f = await one(`INSERT INTO projects (user_id, title, style_id, brief_json, plan_json, aspect_ratio, duration_seconds, kind, source_project_id, status, gen_state, gen_message, gen_started_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'flyer',$8,'coding','working','Designing your flyer',now()) RETURNING *`,
    [req.user.id, `${(p.brief_json?.name || p.title).slice(0, 80)} flyer`, p.style_id, JSON.stringify(brief), JSON.stringify(plan), brief.aspect, p.duration_seconds || 15, p.id]);
  await q(`INSERT INTO assets (user_id, project_id, name, kind, role, mime, url, width, height, has_alpha, duration_seconds, is_light, description)
    SELECT user_id, $2, name, kind, role, mime, url, width, height, has_alpha, duration_seconds, is_light, description FROM assets WHERE project_id=$1 AND kind='image'`, [p.id, f.id]);
  await useCredit(req.user, f.id);
  res.status(202).json({ project: shape(f) });
  const job = runGenerate(f, req.user);
  if (config.serverless) waitUntil(job); else job.catch(() => {});
});

r.get('/:id', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  res.json({ project: shape(p, { assets: await projectAssets(p.id) }), aiMode: aiMode(), limits: limitsFor(req.user) });
});

r.patch('/:id', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  const { title, styleId } = req.body || {};
  if (typeof req.body?.sfx === 'boolean') {
    // switching sound off removes the sound cues from the video code itself (and back on adds them)
    const code = p.code_html ? p.code_html.replace(/window\.ADFLASH_DATA = (.*);\n/, (m, j) => {
      try { const d = JSON.parse(j); d.theme = { ...d.theme, sound: req.body.sfx ? 'soft' : 'off' }; return `window.ADFLASH_DATA = ${JSON.stringify(d).replace(/</g, '\\u003c')};\n`; } catch { return m; }
    }) : null;
    await q('UPDATE projects SET sfx_on=$2, code_html=COALESCE($3, code_html), plan_json=CASE WHEN plan_json IS NULL THEN NULL ELSE plan_json || jsonb_build_object(\'sfx\', $2::boolean) END WHERE id=$1', [p.id, req.body.sfx, code]);
  }
  if (styleId && !(await one("SELECT id FROM styles WHERE id=$1 AND status='live'", [styleId]))) return res.status(400).json({ error: 'Style not found.' });
  const u = await one(`UPDATE projects SET title=COALESCE($2,title), style_id=COALESCE($3,style_id), updated_at=now() WHERE id=$1 RETURNING *`,
    [p.id, title?.trim() || null, styleId || null]);
  res.json({ project: shape(u) });
});

r.delete('/:id', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  // its MP4s and thumbnails go too, so deleted videos don't keep using the free database space
  const rs = await q('SELECT id FROM renders WHERE project_id=$1', [p.id]).catch(() => []);
  for (const { id } of rs) await q('DELETE FROM files WHERE key LIKE $1', [`renders/${id}.%`]).catch(() => {});
  await q('DELETE FROM renders WHERE project_id=$1', [p.id]).catch(() => {});
  await q('DELETE FROM projects WHERE id=$1', [p.id]);
  res.json({ ok: true });
});

// ---------------- uploads (logo / product photos / music) ----------------
r.post('/:id/assets', upload.single('file'), async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  const f = req.file;
  if (!f) return res.status(400).json({ error: 'No file received.' });
  const kind = IMAGE.test(f.mimetype) ? 'image' : AUDIO.test(f.mimetype) ? 'audio' : null;
  if (!kind) return res.status(400).json({ error: 'Upload a PNG, JPG, WebP or SVG image, or an MP3/WAV audio file.' });
  if (kind === 'image') {
    const n = await one("SELECT count(*)::int AS n FROM assets WHERE project_id=$1 AND kind='image'", [p.id]);
    if (n.n >= MAX_IMAGES) return res.status(400).json({ error: `You can add up to ${MAX_IMAGES} pictures. Remove one to add another.` });
  }
  if (kind === 'image' && f.size > 8 * 1024 * 1024) return res.status(400).json({ error: 'Images must be under 8 MB.' });
  const ext = (f.originalname.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase();
  const key = `uploads/${req.user.id}/${p.id}/${Date.now()}-${randomBytes(3).toString('hex')}${ext}`;
  const url = await putObject(key, f.buffer, f.mimetype);
  const meta = await probeBuffer(f.buffer, ext);
  // Role: what the AI should treat it as. Logos are placed uncropped; photos are hero images.
  let role = ['logo', 'photo', 'music'].includes(req.body.role) ? req.body.role : null;
  if (!role) role = kind === 'audio' ? 'music' : /logo/i.test(f.originalname + (req.body.name || '')) ? 'logo' : 'photo';
  let label = (req.body.name || (role === 'logo' ? 'logo' : f.originalname.replace(/\.[^.]+$/, ''))).replace(/[^\w\s&'-]+/g, ' ').trim().slice(0, 50) || role;
  const taken = new Set((await q('SELECT lower(name) AS n FROM assets WHERE project_id=$1', [p.id])).map((r) => r.n));
  for (let k = 2, base = label; taken.has(label.toLowerCase()); k++) label = `${base} ${k}`;
  // the browser measures how light the picture is (a white logo needs a dark card behind it)
  const isLight = req.body.light === 'true' ? true : req.body.light === 'false' ? false : null;
  const hasAlpha = meta.hasAlpha ?? (req.body.alpha === 'true' ? true : req.body.alpha === 'false' ? false : null);
  const asset = await one(`INSERT INTO assets (user_id, project_id, name, kind, role, mime, url, width, height, has_alpha, duration_seconds, is_light)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING id, name, kind, role, mime, url, width, height, has_alpha, duration_seconds, is_light`,
  [req.user.id, p.id, label, kind, role, f.mimetype, url, meta.width || null, meta.height || null, hasAlpha, meta.duration || null, isLight]);
  res.json({ asset });
  // Read what the picture shows now, in the background, so "Make my video / flyer" doesn't wait for the AI to look at it later.
  if (kind === 'image' && config.useGemini) {
    const job = describeAssets([asset], loadImage).catch(() => {});
    if (config.serverless) waitUntil(job);
  }
});

// The browser makes the thumbnail (a still of the video) when the server can't (no Chrome on Vercel).
r.post('/:id/thumbnail', upload.single('file'), async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  if (!req.file || !/^image\/(jpeg|png|webp)$/.test(req.file.mimetype) || req.file.size > 600e3) return res.status(400).json({ error: 'Bad thumbnail' });
  const url = await putObject(`thumbs/${p.id}-${randomBytes(3).toString('hex')}.jpg`, req.file.buffer, req.file.mimetype);
  await q('UPDATE projects SET thumbnail_url=$2 WHERE id=$1', [p.id, url]);
  res.json({ thumbnailUrl: url });
});

r.delete('/:id/assets/:assetId', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  await q('DELETE FROM assets WHERE id=$1 AND project_id=$2', [req.params.assetId, p.id]);
  res.json({ ok: true });
});

// ---------------- Page 1: guided questions (brief) ----------------
// Answers are saved after every step, so the flow resumes where you left off and never asks twice.
r.patch('/:id/brief', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  const brief = cleanBrief({ ...(p.brief_json || {}), ...(req.body?.brief || {}) });
  const u = await one(`UPDATE projects SET brief_json=$2, title=CASE WHEN $3::text <> '' AND title IN ('New video','Untitled video') THEN $3 ELSE title END,
    style_id=COALESCE($4, style_id), updated_at=now() WHERE id=$1 RETURNING *`,
  [p.id, JSON.stringify(brief), brief.name || '', brief.styleId && (await one("SELECT id FROM styles WHERE id=$1 AND status='live'", [brief.styleId])) ? brief.styleId : null]);
  res.json({ project: shape(u, { assets: await projectAssets(p.id) }) });
});

// AI-suggested options for the open questions (headline, selling points)
// "I'll paste everything": read the text into the brief; the page then asks only what's missing.
r.post('/:id/brief/parse', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  const text = String(req.body?.text || '').trim();
  if (text.length < 10) return res.status(400).json({ error: 'Paste a few sentences about your business and the ad you want.' });
  const current = p.brief_json || {};
  const { aiError, ...found } = await parseBrief(text, current, { flyer: p.kind === 'flyer' });
  // never overwrite answers the user already gave one by one
  const merged = cleanBrief({ ...found, ...Object.fromEntries(Object.entries(current).filter(([, v]) => v !== undefined && v !== '')), pasteText: found.pasteText, mode: 'paste' });
  if (!merged.name) { const nm = text.match(/^\s*([A-Z][\w'&.-]*(?:\s+[A-Z][\w'&.-]*){0,3})\s+(?:is|are|sells|makes|offers|does|runs)\b/); if (nm) merged.name = nm[1].trim(); }
  const u = await one('UPDATE projects SET brief_json=$2, updated_at=now() WHERE id=$1 RETURNING *', [p.id, JSON.stringify(merged)]);
  res.json({ project: shape(u, { assets: await projectAssets(p.id) }), found: ['name', 'category', 'goals', 'headlines', 'features', 'products', 'ctas', 'contact', 'aspect', 'duration', 'voiceover', 'sound'].filter((k) => found[k] !== undefined && found[k] !== '' && !(Array.isArray(found[k]) && !found[k].length)), aiError });
});

r.post('/:id/suggest', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  const kind = req.body?.kind === 'features' ? 'features' : 'headline';
  res.json({ options: await suggest(kind, { ...(p.brief_json || {}), ...(req.body?.brief || {}) }, { flyer: p.kind === 'flyer' }) });
});

// All questions answered: turn the brief into the plan (Gemini, or our rules), then the studio generates the video.
r.post('/:id/build', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  const brief = cleanBrief({ ...(p.brief_json || {}), ...(req.body?.brief || {}), done: true });
  if (!brief.name) return res.status(400).json({ error: 'Tell me your business name first.' });
  let styleId = brief.styleId && !brief.styleAuto ? brief.styleId : null;
  if (!styleId) styleId = (await one("SELECT id FROM styles WHERE slug=$1 AND status='live'", [autoStyleSlug(brief)]))?.id || p.style_id;
  const style = await loadStyle(styleId);
  const assets = await projectAssets(p.id);
  const pal = style?.palette ? { primary: style.palette.primary, secondary: style.palette.secondary, background: style.palette.background, text: style.palette.text } : null;
  // Instant plan from the answers; the AI director writes the creative (copy, shots, look) in one call afterwards.
  const plan = briefToPlanRules(brief, { assets, limits: limitsFor(req.user), palette: pal }), source = 'rules';
  normalizePlan(plan);
  if (p.kind === 'flyer') plan.aspect_ratio = ['4:5', '9:16', '1:1', 'A4'].includes(brief.aspect) ? brief.aspect : '4:5';
  const u = await one(`UPDATE projects SET brief_json=$2, plan_json=$3, aspect_ratio=$4, duration_seconds=$5, title=$6, style_id=$7, sfx_on=$8, updated_at=now() WHERE id=$1 RETURNING *`,
    [p.id, JSON.stringify(brief), JSON.stringify(plan), plan.aspect_ratio, Math.round(plan.duration_seconds), (plan.title || p.title).slice(0, 120), styleId, brief.sound !== 'none']);
  res.json({ project: shape(u, { assets }), source });
});

// ---------------- Page 1: planning chat ----------------
r.post('/:id/chat', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  const message = String(req.body?.message || '').trim().slice(0, 4000);
  const newAssetIds = req.body?.assetIds || [];
  if (!message && !newAssetIds.length) return res.status(400).json({ error: 'Type a message.' });

  const assets = await projectAssets(p.id);
  const newAssets = assets.filter((a) => newAssetIds.includes(a.id));
  const attachNote = newAssets.length ? `\n[Uploaded: ${newAssets.map((a) => `${a.name} (${a.kind}) ${a.url}`).join(', ')}]` : '';
  const history = [...(p.chat_history || []), { role: 'user', text: (message || 'Here are my files.') + attachNote, at: new Date().toISOString() }];

  const out = await chatTurn({ history, user: req.user, style: await loadStyle(p.style_id), assets, newAssets });
  history.push({ role: 'model', text: out.reply, ask: out.ask, at: new Date().toISOString() });

  let planUpdate = '';
  const params = [p.id, JSON.stringify(history)];
  if (out.plan) {
    normalizePlan(out.plan);
    // Prefer the user's real uploads over anything the AI invented.
    out.plan.assets = (out.plan.assets || []).filter((a) => assets.some((x) => x.url === a.url));
    if (!out.plan.assets.length) out.plan.assets = assets.filter((a) => a.kind === 'image').map((a) => ({ name: a.name, url: a.url, use: /logo/i.test(a.name) ? 'logo' : 'product photo' }));
    params.push(JSON.stringify(out.plan), out.plan.aspect_ratio, Math.round(out.plan.duration_seconds), (out.plan.title || p.title).slice(0, 120));
    planUpdate = ', plan_json=$3, aspect_ratio=$4, duration_seconds=$5, title=$6';
  }
  const u = await one(`UPDATE projects SET chat_history=$2${planUpdate}, updated_at=now() WHERE id=$1 RETURNING *`, params);
  res.json({ project: shape(u, { assets }), reply: out.reply, planReady: !!out.plan, notice: out.notice, source: out.source });
});

// Manual plan edits from the plan sidebar (scene text / timings).
r.put('/:id/plan', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  const plan = normalizePlan(req.body?.plan);
  const problems = validatePlan(plan, limitsFor(req.user));
  if (problems.length) return res.status(400).json({ error: problems.join('; ') });
  const u = await one(`UPDATE projects SET plan_json=$2, aspect_ratio=$3, duration_seconds=$4, updated_at=now() WHERE id=$1 RETURNING *`,
    [p.id, JSON.stringify(plan), plan.aspect_ratio, Math.round(plan.duration_seconds)]);
  res.json({ project: shape(u) });
});

// ---------------- Page 2: code generation, edits, undo ----------------
// Making the video runs in the background on the server: the page can close; the phone is notified when it's done.
r.post('/:id/generate', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  if (!p.plan_json) return res.status(400).json({ error: 'Finish planning in the chat first.' });
  const problems = validatePlan(p.plan_json, limitsFor(req.user));
  if (problems.length) return res.status(400).json({ error: `The plan needs fixing: ${problems.join('; ')}` });
  const fresh = p.gen_state === 'working' && p.gen_started_at && Date.now() - new Date(p.gen_started_at).getTime() < 6 * 60e3;
  if (fresh) return res.status(202).json({ project: shape(p), started: false });
  if (!(await useCredit(req.user, p.id)).ok) { const e = NEED_CREDITS(); return res.status(402).json({ error: e.message, code: e.code }); }
  const u = await one("UPDATE projects SET status='coding', gen_state='working', gen_message='Reading your answers', gen_error=NULL, gen_started_at=now() WHERE id=$1 RETURNING *", [p.id]);
  res.status(202).json({ project: shape(u), started: true });
  const job = runGenerate(p, req.user);
  if (config.serverless) waitUntil(job); else job.catch(() => {});
});

async function runGenerate(p, user) {
  const setMsg = (m) => q('UPDATE projects SET gen_message=$2 WHERE id=$1', [p.id, String(m).slice(0, 120)]).catch(() => {});
  const name = p.brief_json?.name || p.title;
  try {
    let out;
    if (p.kind === 'flyer') {
      setMsg('Looking at your pictures');
      const style = await loadStyle(p.style_id);
      const assets = config.useGemini ? await describeAssets(await projectAssets(p.id), loadImage) : await projectAssets(p.id);
      setMsg('Designing your flyer');
      out = { html: await makeFlyer({ brief: p.brief_json || {}, plan: p.plan_json, style, assets, previous: p.code_html || null, useAI: config.useGemini }), source: config.useGemini ? 'gemini' : 'template' };
      out.notice = flyerFitNotice(out.html);
    } else out = await generateCode({ plan: p.plan_json, style: await loadStyle(p.style_id), assets: await projectAssets(p.id), brief: p.brief_json || null, previous: p.code_html || null, onStatus: setMsg });
    const versions = [...(p.code_versions || []), ...(p.code_html ? [p.code_html] : [])].slice(-MAX_VERSIONS);
    const u = await one(`UPDATE projects SET code_html=$2, code_versions=$3, status='ready', ai_source=$4, edit_history='[]'::jsonb, updated_at=now(),
      gen_state='done', gen_message=$5, gen_error=NULL WHERE id=$1 RETURNING *`, [p.id, out.html, JSON.stringify(versions), out.source, out.notice || '']);
    thumbnail(p.id, out.html, u.aspect_ratio);
    await notifyUser(user.id, p.kind === 'flyer'
      ? { title: 'Your flyer is ready', body: `${name}: tap to see it and download it.`, url: `/p/${p.id}/studio`, tag: `gen-${p.id}` }
      : { title: 'Your video is ready', body: `${name}: tap to watch it and download the MP4.`, url: `/p/${p.id}/studio`, tag: `gen-${p.id}` });
  } catch (e) {
    console.error('[generate]', e);
    await q(`UPDATE projects SET status=CASE WHEN code_html IS NULL THEN 'planning' ELSE 'ready' END, gen_state='failed', gen_error=$2 WHERE id=$1`,
      [p.id, `Something went wrong making the video (${String(e.message).slice(0, 120)}). Press Make my video to try again.`]).catch(() => {});
    await notifyUser(user.id, { title: "Your video didn't finish", body: `${name}: open Animora and press Make my video to try again.`, url: `/p/${p.id}/studio`, tag: `gen-${p.id}` });
  }
}

r.post('/:id/edit', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  const instruction = String(req.body?.instruction || '').trim().slice(0, 1000);
  if (!instruction) return res.status(400).json({ error: 'Describe the change you want.' });
  if (!p.code_html) return res.status(400).json({ error: 'Generate the code first.' });
  const out = await editCode({ html: p.code_html, instruction, aspectRatio: p.aspect_ratio, duration: p.duration_seconds, plan: p.plan_json, assets: await projectAssets(p.id), brief: p.brief_json || null, history: p.edit_history || [] });
  const history = [...(p.edit_history || []), { role: 'user', text: instruction }, { role: 'model', text: out.summary }];
  if (out.unchanged) {
    const u = await one('UPDATE projects SET edit_history=$2 WHERE id=$1 RETURNING *', [p.id, JSON.stringify(history)]);
    return res.json({ project: shape(u), summary: out.summary, changed: false });
  }
  const versions = [...(p.code_versions || []), p.code_html].slice(-MAX_VERSIONS);
  const u = await one(`UPDATE projects SET code_html=$2, code_versions=$3, edit_history=$4, updated_at=now() WHERE id=$1 RETURNING *`,
    [p.id, out.html, JSON.stringify(versions), JSON.stringify(history)]);
  thumbnail(p.id, out.html, u.aspect_ratio);
  res.json({ project: shape(u), summary: out.summary, changed: true });
});

// The editor's Adjust panel: size, colours, text size and speed, changed instantly without the AI.
r.get('/:id/look', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  res.json(p.code_html ? currentLook(p.code_html) : {});
});
r.post('/:id/adjust', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  if (!p.code_html) return res.status(400).json({ error: 'Make the design first.' });
  let out;
  try { out = adjustDesign({ html: p.code_html, plan: p.plan_json || {}, assets: await projectAssets(p.id), changes: req.body || {} }); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const versions = [...(p.code_versions || []), p.code_html].slice(-MAX_VERSIONS);
  const history = [...(p.edit_history || []), { role: 'model', text: out.summary }];
  const plan = out.aspect && p.plan_json ? { ...p.plan_json, aspect_ratio: out.aspect } : p.plan_json;
  const u = await one(`UPDATE projects SET code_html=$2, code_versions=$3, edit_history=$4, aspect_ratio=COALESCE($5, aspect_ratio), plan_json=$6, updated_at=now() WHERE id=$1 RETURNING *`,
    [p.id, out.html, JSON.stringify(versions), JSON.stringify(history), out.aspect, plan ? JSON.stringify(plan) : null]);
  thumbnail(p.id, out.html, u.aspect_ratio);
  res.json({ project: shape(u), summary: out.summary });
});

r.post('/:id/undo', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  const versions = [...(p.code_versions || [])];
  if (!versions.length) return res.status(400).json({ error: 'Nothing to undo.' });
  const prev = versions.pop();
  const history = [...(p.edit_history || []), { role: 'model', text: '↩︎ Undid the last change.' }];
  const size = aspectOf(prev);   // undoing a size change puts the old size back too
  const u = await one(`UPDATE projects SET code_html=$2, code_versions=$3, edit_history=$4, aspect_ratio=COALESCE($5, aspect_ratio), updated_at=now() WHERE id=$1 RETURNING *`,
    [p.id, prev, JSON.stringify(versions), JSON.stringify(history), size]);
  res.json({ project: shape(u) });
});

// Hand edits in the code tab: checked before saving so a typo can't break rendering.
r.put('/:id/code', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  const html = String(req.body?.html || '');
  const problems = validateHtml(html, { duration: p.duration_seconds });
  if (!problems.length) {
    try {
      problems.push(...inspectProblems(await inspectAnimation(html, { aspectRatio: p.aspect_ratio }), { duration: p.duration_seconds }));
    } catch (e) { problems.push(e.message); }
  }
  if (problems.length) return res.status(400).json({ error: 'The code has problems', problems });
  const versions = [...(p.code_versions || []), p.code_html].filter(Boolean).slice(-MAX_VERSIONS);
  const u = await one(`UPDATE projects SET code_html=$2, code_versions=$3, updated_at=now() WHERE id=$1 RETURNING *`, [p.id, html, JSON.stringify(versions)]);
  res.json({ project: shape(u) });
});

// ---------------- voiceover ----------------
r.get('/:id/voiceover', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  res.json({
    formats: p.plan_json ? voiceoverFormats(p.plan_json) : null,
    voices: VOICES, canGenerate: config.useGemini || hasOfflineVoice, gemini: config.useGemini, basicVoice: hasOfflineVoice,
    voice: shape(p).voice, videoDuration: p.duration_seconds,
  });
});

async function saveVoice(p, mp3, duration, source) {
  const url = await putObject(`voice/${p.id}-${Date.now()}.mp3`, mp3, 'audio/mpeg');
  return one(`UPDATE projects SET voice_url=$2, voice_duration=$3, voice_source=$4, fit_to_voice=false, updated_at=now() WHERE id=$1 RETURNING *`,
    [p.id, url, duration, source]);
}

r.post('/:id/voiceover/generate', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  if (!p.plan_json) return res.status(400).json({ error: 'Plan your video first.' });
  if (!config.useGemini && !hasOfflineVoice) return res.status(400).json({ error: 'Something went wrong. Please try again later.' });
  const voice = VOICES.some((v) => v.name === req.body?.voice) ? req.body.voice : 'Sulafat';
  const style = String(req.body?.style || '').slice(0, 120) || undefined;
  const engine = req.body?.engine === 'basic' || !config.useGemini ? 'basic' : 'gemini';
  try {
    let out;
    try {
      out = await generateVoiceTrack(p.plan_json, { voice, style, engine });
    } catch (e) {
      // Gemini unreachable: fall back to the basic offline voice so the user isn't stuck.
      if (engine !== 'gemini' || !hasOfflineVoice) throw e;
      console.warn('[voice] Gemini failed, using basic voice:', e.message);
      out = { ...(await generateVoiceTrack(p.plan_json, { engine: 'basic' })), fellBack: true };
    }
    const u = await saveVoice(p, out.mp3, out.duration, out.engine);
    res.json({ project: shape(u), notice: out.fellBack ? "The AI voice service couldn't be reached, so a basic offline voice was used. Try again later for the natural AI voice." : undefined });
  } catch (e) {
    console.warn('[voice]', e.message);
    res.status(502).json({ error: `Couldn't make the voice right now (${e.message.slice(0, 160)}). Try again, or use the script in a text-to-speech app and upload the audio.` });
  }
});

r.post('/:id/voiceover/upload', upload.single('file'), async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  const f = req.file;
  if (!f || !AUDIO.test(f.mimetype)) return res.status(400).json({ error: 'Upload an MP3, WAV, M4A or OGG audio file.' });
  try {
    const { mp3, duration } = await toMp3(f.buffer);
    if (!(duration > 0.5)) return res.status(400).json({ error: 'That audio file seems to be empty.' });
    if (duration > config.pricing.proMaxSeconds + 5) return res.status(400).json({ error: `Voiceovers can be up to ${config.pricing.proMaxSeconds / 60} minutes.` });
    const u = await saveVoice(p, mp3, duration, 'upload');
    res.json({ project: shape(u) });
  } catch (e) {
    res.status(400).json({ error: 'Could not read that audio file. Try exporting it again as MP3.' });
  }
});

// Fit the video to the voice: the animation is slowed down or sped up (within 0.7x-1.4x) to match the audio length.
r.patch('/:id/voiceover', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  if (!p.voice_url) return res.status(400).json({ error: 'Add a voiceover first.' });
  const fit = !!req.body?.fitToVoice;
  if (fit) {
    const ratio = p.duration_seconds / Number(p.voice_duration);
    if (ratio < 0.7 || ratio > 1.4) return res.status(400).json({ error: 'The voice and the video are too different in length to stretch nicely. Change the plan length in the chat, or record a shorter/longer voice.' });
  }
  const u = await one('UPDATE projects SET fit_to_voice=$2, updated_at=now() WHERE id=$1 RETURNING *', [p.id, fit]);
  res.json({ project: shape(u) });
});

r.delete('/:id/voiceover', async (req, res) => {
  const p = await loadProject(req, res); if (!p) return;
  const u = await one('UPDATE projects SET voice_url=NULL, voice_duration=NULL, voice_source=NULL, fit_to_voice=false WHERE id=$1 RETURNING *', [p.id]);
  res.json({ project: shape(u) });
});

export default r;
