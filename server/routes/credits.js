// Credits and linked devices (no sign-in).
//   GET  /credits                 how many videos this device has left
//   POST /credits/checkout        start a Paystack payment for one pack -> { url }
//   GET  /credits/verify?ref=...  after Paystack sends the buyer back: check and add the credits (once)
//   POST /devices/code            a 6-digit code (10 minutes) to link another phone or computer
//   POST /devices/link { code }   this device joins the account that made the code (same videos, same credits)
import { Router } from 'express';
import { randomInt } from 'node:crypto';
import { config } from '../config.js';
import { one, q, tx } from '../db/index.js';
import { requireAuth, publicUser, loadUser, keyHash, validKey, forgetDevice } from '../auth.js';
import { newReference } from '../payments.js';

const r = Router();

const PS = 'https://api.paystack.co';
const psFetch = async (path, opts = {}) => {
  const res = await fetch(`${PS}${path}`, { ...opts, headers: { Authorization: `Bearer ${config.paystack.secretKey}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }, signal: AbortSignal.timeout(20000) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.status === false) throw Object.assign(new Error(j.message || `Paystack error (${res.status})`), { status: 502 });
  return j.data;
};

// Add a paid pack exactly once (safe to call many times for the same reference).
async function settle(reference, userId) {
  const pay = await one('SELECT * FROM credit_payments WHERE reference=$1 AND user_id=$2', [reference, userId]);
  if (!pay) throw Object.assign(new Error('Payment not found.'), { status: 404 });
  if (pay.status === 'paid') return { status: 'paid', already: true };
  const d = await psFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (d.status !== 'success') {
    if (['failed', 'abandoned', 'reversed'].includes(d.status)) await q("UPDATE credit_payments SET status='failed' WHERE reference=$1 AND status='pending'", [reference]);
    return { status: d.status || 'pending' };
  }
  if (Number(d.amount) < Math.round(Number(pay.amount_ngn) * 100) || d.currency !== 'NGN') throw Object.assign(new Error('The amount paid does not match.'), { status: 400 });
  await tx(async (t) => {
    const done = await t.one("UPDATE credit_payments SET status='paid', paid_at=now() WHERE reference=$1 AND status <> 'paid' RETURNING credits", [reference]);
    if (done) await t.q('UPDATE users SET credits = credits + $2 WHERE id=$1', [userId, done.credits]);
  });
  return { status: 'paid' };
}

r.get('/credits', requireAuth, async (req, res) => {
  // a payment that was made but not confirmed (closed tab): check it now
  if (config.credits.enabled && config.paystack.secretKey) {
    const open = await q("SELECT reference FROM credit_payments WHERE user_id=$1 AND status='pending' AND created_at > now() - interval '2 days' ORDER BY created_at DESC LIMIT 3", [req.user.id]);
    for (const p of open) await settle(p.reference, req.user.id).catch(() => {});
  }
  res.json({ user: publicUser(await loadUser(req.user.id)) });
});

r.post('/credits/checkout', requireAuth, async (req, res) => {
  if (!config.credits.enabled || !config.paystack.secretKey) return res.status(503).json({ error: 'Payments are not switched on yet. Message the developer on WhatsApp to buy videos.' });
  const { packSize, packPriceNgn } = config.credits;
  const email = String(req.body?.email || '').trim().toLowerCase();
  const reference = newReference('ANM');
  await q('INSERT INTO credit_payments (reference, user_id, credits, amount_ngn) VALUES ($1,$2,$3,$4)', [reference, req.user.id, packSize, packPriceNgn]);
  const back = `${config.publicBaseUrl}/videos?paid=${reference}`;
  const d = await psFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : `buyer-${req.user.id.slice(0, 8)}@animora.app`,
      amount: Math.round(packPriceNgn * 100), currency: 'NGN', reference, callback_url: back,
      metadata: { user_id: req.user.id, credits: packSize, custom_fields: [{ display_name: 'Animora videos', variable_name: 'videos', value: String(packSize) }] },
    }),
  });
  res.json({ url: d.authorization_url, reference });
});

r.get('/credits/verify', requireAuth, async (req, res) => {
  const ref = String(req.query.ref || '').slice(0, 80);
  if (!ref) return res.status(400).json({ error: 'Missing payment reference.' });
  const out = await settle(ref, req.user.id);
  res.json({ ...out, user: publicUser(await loadUser(req.user.id)) });
});

// ---------------- linking devices ----------------
r.post('/devices/code', requireAuth, async (req, res) => {
  await q('DELETE FROM device_codes WHERE expires_at < now() OR user_id=$1', [req.user.id]);
  let code;
  for (let i = 0; i < 5; i++) {
    code = String(randomInt(0, 1e6)).padStart(6, '0');
    const ok = await one("INSERT INTO device_codes (code, user_id, expires_at) VALUES ($1,$2, now() + interval '10 minutes') ON CONFLICT DO NOTHING RETURNING code", [code, req.user.id]);
    if (ok) break;
  }
  res.json({ code, minutes: 10 });
});

r.post('/devices/link', requireAuth, async (req, res) => {
  const code = String(req.body?.code || '').replace(/\D/g, '');
  const key = req.get('x-animora-key');
  if (code.length !== 6 || !validKey(key)) return res.status(400).json({ error: 'Enter the 6-digit code from your other device.' });
  const c = await one('SELECT * FROM device_codes WHERE code=$1 AND expires_at > now()', [code]);
  if (!c) return res.status(400).json({ error: 'That code is wrong or has expired. Make a new one on your other device.' });
  if (c.user_id === req.user.id) return res.json({ user: publicUser(await loadUser(req.user.id)), same: true });
  const from = req.user.id, to = c.user_id;
  await tx(async (t) => {
    // bring this device's videos (and any bought videos) along, then point this device at the account
    for (const table of ['projects', 'renders', 'assets', 'push_subscriptions']) await t.q(`UPDATE ${table} SET user_id=$2 WHERE user_id=$1`, [from, to]);
    const old = await t.one('SELECT credits FROM users WHERE id=$1', [from]);
    if (old?.credits > 0) { await t.q('UPDATE users SET credits = credits + $2 WHERE id=$1', [to, old.credits]); await t.q('UPDATE users SET credits=0 WHERE id=$1', [from]); }
    await t.q('INSERT INTO device_keys (key_hash, user_id) VALUES ($1,$2) ON CONFLICT (key_hash) DO UPDATE SET user_id=EXCLUDED.user_id', [keyHash(key), to]);
    await t.q('UPDATE users SET device_key_hash=NULL WHERE id=$1 AND device_key_hash=$2', [from, keyHash(key)]);
    await t.q('DELETE FROM device_codes WHERE code=$1', [code]);
  });
  forgetDevice(key);
  res.json({ user: publicUser(await loadUser(to)), linked: true });
});

export default r;
