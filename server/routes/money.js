// Pricing, Pro subscription checkout, styles marketplace and the creator dashboard.
import { Router } from 'express';
import { one, q, tx } from '../db/index.js';
import { requireAuth, requireRole, publicUser, loadUser } from '../auth.js';
import { config } from '../config.js';
import { publicPricing } from '../billing.js';
import { provider, BANKS, newReference } from '../payments.js';
import { validateHtml, inspectProblems } from '../engine/validate.js';
import { inspectAnimation, renderVideo, snapshotFrames } from '../engine/renderer.js';
import { templateFromPlan } from '../ai/templates.js';
import { STARTER_STYLES } from '../db/starter.js';
import { THEME_KEYS } from '../ai/themes.js';
import { putObject } from '../storage.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Render a short preview video for a newly uploaded style (in the background).
async function makeStylePreview(style) {
  const dir = await mkdtemp(path.join(tmpdir(), 'adflash-style-'));
  try {
    const theme = style.palette?.theme || 'bold';
    const example = STARTER_STYLES.find((s) => s.palette.theme === theme)?.example || STARTER_STYLES[0].example;
    const plan = { ...example, aspect_ratio: '9:16', style: { colors: { ...example.style.colors, ...style.palette } } };
    let html = style.base_code;
    let aspect = '9:16';
    if (html) aspect = /width=1920/.test(html) ? '16:9' : /width=1080,height=1080/.test(html) ? '1:1' : '9:16';
    else html = templateFromPlan(plan, { themeKey: theme });
    const out = path.join(dir, 'preview.mp4');
    await renderVideo({ html, outFile: out, aspectRatio: aspect, workers: 1 });
    const url = await putObject(`styles/${style.id}.mp4`, out, 'video/mp4');
    const [img] = await snapshotFrames(html, [2.4], { aspectRatio: aspect, scale: 0.5, quality: 80 });
    const poster = await putObject(`styles/${style.id}.jpg`, img, 'image/jpeg');
    await q('UPDATE styles SET preview_url=$2, poster_url=$3, base_code=COALESCE(base_code, $4) WHERE id=$1', [style.id, url, poster, html]);
  } catch (e) {
    console.warn('[style preview]', e.message);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const r = Router();

// ---------------- public ----------------
r.get('/pricing', (req, res) => res.json({ pricing: publicPricing(), paymentProvider: provider().name }));
r.get('/banks', (req, res) => res.json({ banks: BANKS }));

r.get('/styles', async (req, res) => {
  const rows = await q(`SELECT s.id, s.slug, s.name, s.description, s.palette, s.font, s.preview_url, s.poster_url, s.times_used, s.created_at,
      u.name AS creator_name, s.creator_id
    FROM styles s LEFT JOIN users u ON u.id=s.creator_id WHERE s.status='live' ORDER BY s.times_used DESC, s.created_at`);
  res.json({ styles: rows });
});

r.get('/styles/:id/example', async (req, res) => {
  const s = await one("SELECT base_code FROM styles WHERE id=$1 AND status='live'", [req.params.id]);
  if (!s?.base_code) return res.status(404).json({ error: 'No example for this style.' });
  res.json({ html: s.base_code });
});

// ---------------- Pro subscription ----------------
async function activatePro(paymentId) {
  return tx(async (t) => {
    const p = await t.one("UPDATE payments SET status='success', paid_at=now() WHERE id=$1 AND status<>'success' RETURNING *", [paymentId]);
    if (!p) return null;
    const u = await t.one('SELECT plan, plan_renews_at FROM users WHERE id=$1 FOR UPDATE', [p.user_id]);
    // Renewing early stacks on the current period; upgrading starts a fresh 30-video allowance.
    const base = u.plan === 'pro' && u.plan_renews_at && new Date(u.plan_renews_at) > new Date() ? new Date(u.plan_renews_at) : new Date();
    const renews = new Date(base.getTime() + 30 * 864e5);
    await t.q(`UPDATE users SET plan='pro', plan_renews_at=$2,
      videos_used_this_month = CASE WHEN plan='pro' THEN videos_used_this_month ELSE 0 END WHERE id=$1`, [p.user_id, renews.toISOString()]);
    return p;
  });
}

r.post('/billing/subscribe', requireAuth, async (req, res) => {
  const wallet = String(req.body?.walletAccountNo || '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(wallet)) return res.status(400).json({ error: 'Enter your 10-digit Access wallet / account number.' });
  const amount = config.pricing.proPriceNgn;
  const reference = newReference('AFPRO');
  const pay = await one(`INSERT INTO payments (user_id, amount, type, reference, provider) VALUES ($1,$2,'subscription',$3,$4) RETURNING *`,
    [req.user.id, amount, reference, provider().name]);
  let result;
  try {
    result = await provider().charge({ reference, amount, walletAccountNo: wallet, narration: `Animora Pro - ${req.user.email}` });
  } catch (e) {
    await q("UPDATE payments SET status='failed' WHERE id=$1", [pay.id]);
    return res.status(502).json({ error: `Payment could not start: ${e.message}`, reference });
  }
  if (result.status === 'SUCCESS') await activatePro(pay.id);
  if (result.status === 'FAILED') await q("UPDATE payments SET status='failed' WHERE id=$1", [pay.id]);
  res.json({ status: result.status, reference, message: result.message, user: publicUser(await loadUser(req.user.id)) });
});

// Poll a PENDING payment until the bank confirms it.
r.get('/billing/payments/:reference', requireAuth, async (req, res) => {
  const pay = await one('SELECT * FROM payments WHERE reference=$1 AND user_id=$2', [req.params.reference, req.user.id]);
  if (!pay) return res.status(404).json({ error: 'Payment not found.' });
  if (pay.status === 'pending') {
    const s = await provider().status(pay.reference).catch(() => ({ status: 'PENDING' }));
    if (s.status === 'SUCCESS') await activatePro(pay.id);
    if (s.status === 'FAILED') await q("UPDATE payments SET status='failed' WHERE id=$1", [pay.id]);
  }
  const fresh = await one('SELECT reference, status, amount, created_at, paid_at FROM payments WHERE id=$1', [pay.id]);
  res.json({ payment: fresh, user: publicUser(await loadUser(req.user.id)) });
});

r.get('/billing/payments', requireAuth, async (req, res) => {
  res.json({ payments: await q('SELECT reference, status, amount, type, provider, created_at, paid_at FROM payments WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]) });
});

// Sandbox only: lets the demo show renewal/expiry without waiting 30 days.
r.post('/billing/sandbox/expire', requireAuth, async (req, res) => {
  if (provider().name !== 'sandbox') return res.status(404).end();
  await q("UPDATE users SET plan_renews_at = now() - interval '1 minute' WHERE id=$1", [req.user.id]);
  res.json({ user: publicUser(await loadUser(req.user.id)) });
});

// ---------------- creators ----------------
const creator = Router();
creator.use(requireAuth, requireRole('creator', 'admin'));

creator.get('/dashboard', async (req, res) => {
  const id = req.user.id;
  const [styles, totals, recent, payouts, monthly] = await Promise.all([
    q(`SELECT s.id, s.name, s.description, s.status, s.times_used, s.preview_url, s.poster_url, s.palette, s.created_at,
         COALESCE((SELECT sum(amount) FROM royalties WHERE style_id=s.id), 0) AS earned
       FROM styles s WHERE s.creator_id=$1 ORDER BY s.times_used DESC`, [id]),
    one(`SELECT COALESCE(sum(amount),0) AS total,
         COALESCE(sum(amount) FILTER (WHERE status='pending'),0) AS pending,
         COALESCE(sum(amount) FILTER (WHERE status='paid'),0) AS paid,
         count(*)::int AS videos FROM royalties WHERE creator_id=$1`, [id]),
    q(`SELECT ro.amount, ro.status, ro.created_at, s.name AS style_name, r.paid_via, r.duration_seconds
       FROM royalties ro JOIN renders r ON r.id=ro.render_id LEFT JOIN styles s ON s.id=ro.style_id
       WHERE ro.creator_id=$1 ORDER BY ro.created_at DESC LIMIT 25`, [id]),
    q('SELECT reference, amount_ngn, status, bank_name, account_number, created_at, paid_at FROM payouts WHERE creator_id=$1 ORDER BY created_at DESC', [id]),
    q(`SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, sum(amount) AS amount, count(*)::int AS videos
       FROM royalties WHERE creator_id=$1 AND created_at > now() - interval '30 days' GROUP BY 1 ORDER BY 1`, [id]),
  ]);
  res.json({
    user: publicUser(req.user), styles, totals, recent, payouts, daily: monthly,
    sharePercent: Math.round(config.pricing.creatorShare * 100), minPayoutNgn: config.pricing.minPayoutNgn,
  });
});

async function checkStyleCode(html) {
  if (!html) return [];
  const problems = validateHtml(html, {});
  if (problems.length) return problems;
  const aspect = /width=1920/.test(html) ? '16:9' : /width=1080,height=1080/.test(html) ? '1:1' : '9:16';
  try { return inspectProblems(await inspectAnimation(html, { aspectRatio: aspect })); } catch (e) { return [e.message]; }
}

creator.post('/styles', async (req, res) => {
  const { name, description, rules, baseCode, palette = {}, font = 'Poppins', theme = 'bold' } = req.body || {};
  if (!name?.trim() || !rules?.trim()) return res.status(400).json({ error: 'A style needs a name and style rules.' });
  const problems = await checkStyleCode(baseCode);
  if (problems.length) return res.status(400).json({ error: 'The example code breaks the Animora rules.', problems });
  const s = await one(`INSERT INTO styles (creator_id, name, description, rules, base_code, palette, font)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
  [req.user.id, name.trim().slice(0, 60), (description || '').slice(0, 300), rules.slice(0, 4000), baseCode || null,
    JSON.stringify({ ...palette, theme: THEME_KEYS.includes(theme) ? theme : 'bold' }), font.slice(0, 40)]);
  makeStylePreview(s); // preview video appears on the dashboard in about a minute
  res.json({ style: s });
});

creator.patch('/styles/:id', async (req, res) => {
  const { name, description, rules, status } = req.body || {};
  const s = await one(`UPDATE styles SET name=COALESCE($3,name), description=COALESCE($4,description), rules=COALESCE($5,rules),
    status=COALESCE($6,status) WHERE id=$1 AND creator_id=$2 RETURNING *`,
  [req.params.id, req.user.id, name || null, description ?? null, rules || null, ['live', 'hidden'].includes(status) ? status : null]);
  if (!s) return res.status(404).json({ error: 'Style not found.' });
  res.json({ style: s });
});

creator.post('/bank', async (req, res) => {
  const { bankCode, accountNumber } = req.body || {};
  const bank = BANKS.find((b) => b.code === bankCode);
  if (!bank) return res.status(400).json({ error: 'Choose your bank.' });
  if (!/^\d{10}$/.test(accountNumber || '')) return res.status(400).json({ error: 'Account number must be 10 digits.' });
  try {
    const { accountName } = await provider().nameEnquiry({ accountNo: accountNumber, bankCode });
    const u = await one(`UPDATE users SET bank_name=$2, bank_account_number=$3, bank_account_name=$4 WHERE id=$1 RETURNING *`,
      [req.user.id, `${bank.name}|${bank.code}`, accountNumber, accountName]);
    res.json({ user: publicUser(u), accountName });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

creator.post('/payouts', async (req, res) => {
  const u = req.user;
  if (!u.bank_account_number) return res.status(400).json({ error: 'Add your bank account first.' });
  const [bankName, bankCode] = String(u.bank_name).split('|');
  const reference = newReference('AFPAY');
  // Lock the pending royalties into this payout first, so they can't be paid twice.
  const payout = await tx(async (t) => {
    const sum = await t.one("SELECT COALESCE(sum(amount),0) AS total FROM royalties WHERE creator_id=$1 AND status='pending' AND payout_id IS NULL", [u.id]);
    if (Number(sum.total) < config.pricing.minPayoutNgn) {
      throw Object.assign(new Error(`You can withdraw once you have at least ₦${config.pricing.minPayoutNgn.toLocaleString()} pending.`), { status: 400 });
    }
    const p = await t.one(`INSERT INTO payouts (creator_id, amount_ngn, reference, provider, bank_name, account_number)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [u.id, sum.total, reference, provider().name, bankName, u.bank_account_number]);
    await t.q("UPDATE royalties SET payout_id=$2 WHERE creator_id=$1 AND status='pending' AND payout_id IS NULL", [u.id, p.id]);
    return p;
  }).catch((e) => { res.status(e.status || 500).json({ error: e.message }); return null; });
  if (!payout) return;

  try {
    const r2 = await provider().transfer({ reference, amount: Number(payout.amount_ngn), bankCode, accountNo: u.bank_account_number, accountName: u.bank_account_name });
    if (r2.status === 'SUCCESS') {
      await q("UPDATE payouts SET status='paid', paid_at=now() WHERE id=$1", [payout.id]);
      await q("UPDATE royalties SET status='paid' WHERE payout_id=$1", [payout.id]);
    } else if (r2.status === 'FAILED') throw new Error('The bank declined the transfer.');
  } catch (e) {
    await q("UPDATE payouts SET status='failed' WHERE id=$1", [payout.id]);
    await q("UPDATE royalties SET payout_id=NULL WHERE payout_id=$1", [payout.id]);
    return res.status(502).json({ error: `Payout failed: ${e.message}` });
  }
  res.json({ payout: await one('SELECT reference, amount_ngn, status, bank_name, account_number, created_at, paid_at FROM payouts WHERE id=$1', [payout.id]) });
});

r.use('/creator', creator);
export default r;
