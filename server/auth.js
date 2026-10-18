// Email + password auth with signed, stateless tokens (no third-party auth service needed).
import { scrypt, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';
import { one, q } from './db/index.js';

const scryptAsync = promisify(scrypt);
const TOKEN_DAYS = 30;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [, salt, hex] = String(stored).split('$');
  if (!salt || !hex) return false;
  const key = await scryptAsync(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (data) => createHmac('sha256', config.authSecret).update(data).digest('base64url');

export function createToken(userId) {
  const payload = b64(JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_DAYS * 864e5 }));
  return `${payload}.${sign(payload)}`;
}

export function readToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

// Keeps plan + monthly counter correct every time a user is loaded:
//  - new calendar month -> videos_used_this_month resets to 0
//  - Pro period ended without renewal -> back to Free
export async function refreshUser(user) {
  if (!user) return null;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let changed = false;
  if (new Date(user.usage_period_start) < monthStart) {
    user.videos_used_this_month = 0;
    user.usage_period_start = monthStart.toISOString();
    changed = true;
  }
  if (user.plan === 'pro' && user.plan_renews_at && new Date(user.plan_renews_at) < new Date()) {
    user.plan = 'free';
    changed = true;
  }
  if (changed) {
    await q('UPDATE users SET videos_used_this_month=$2, usage_period_start=$3, plan=$4 WHERE id=$1',
      [user.id, user.videos_used_this_month, user.usage_period_start, user.plan]);
  }
  return user;
}

export function publicUser(u) {
  if (!u) return null;
  const { pricing } = config;
  const limit = pricing.proVideosPerMonth;
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, plan: u.plan,
    planRenewsAt: u.plan_renews_at, businessName: u.business_name,
    videosUsedThisMonth: u.videos_used_this_month,
    proVideosRemaining: u.plan === 'pro' ? Math.max(0, limit - u.videos_used_this_month) : 0,
    needsAdForNextVideo: !config.noAuth && !(u.plan === 'pro' && u.videos_used_this_month < limit),
    maxSeconds: u.plan === 'pro' || config.noAuth ? pricing.proMaxSeconds : pricing.freeMaxSeconds,
    testMode: config.noAuth,
    credits: { enabled: config.credits.enabled, unlimited: !!u.unlimited, free: u.free_left ?? 0, paid: u.credits ?? 0, left: u.unlimited ? null : (u.free_left ?? 0) + (u.credits ?? 0), packSize: config.credits.packSize, packPriceNgn: config.credits.packPriceNgn },
    bank: u.bank_account_number ? { bankName: u.bank_name, accountNumber: u.bank_account_number, accountName: u.bank_account_name } : null,
  };
}

export async function loadUser(id) {
  return refreshUser(await one('SELECT * FROM users WHERE id=$1', [id]));
}

// No-sign-in mode: everyone is this one local user (created on first use).
let localUserId = null;
export async function localUser() {
  if (!localUserId) {
    const u = await one("SELECT id FROM users WHERE email='local@adflash.ng'")
      || await one(`INSERT INTO users (name, email, password_hash, role, plan) VALUES ('AdFlash Tester', 'local@adflash.ng', 'none', 'creator', 'pro') RETURNING id`);
    localUserId = u.id;
  }
  return loadUser(localUserId);
}

// No-sign-in mode with private devices: each phone/browser sends its own secret key (made on the device,
// kept in its storage). Only a hash of it is stored here. Opening a "use on another device" link copies
// the key to a second device, so both see the same videos.
const keyHash = (k) => createHash('sha256').update(String(k)).digest('hex');
const deviceCache = new Map();
export async function deviceUser(key) {
  const h = keyHash(key);
  let id = deviceCache.get(h);
  if (!id) {
    const u = await one('SELECT user_id AS id FROM device_keys WHERE key_hash=$1', [h])
      || await one('SELECT id FROM users WHERE device_key_hash=$1', [h])
      || await one(`INSERT INTO users (name, email, password_hash, role, plan, device_key_hash) VALUES ('Animora user', $1, 'none', 'creator', 'pro', $2)
          ON CONFLICT (email) DO UPDATE SET device_key_hash=EXCLUDED.device_key_hash RETURNING id`, [`device-${h.slice(0, 24)}@animora.app`, h]);
    id = u.id;
    if (deviceCache.size > 5000) deviceCache.clear();
    deviceCache.set(h, id);
  }
  return loadUser(id);
}
export const forgetDevice = (key) => deviceCache.delete(keyHash(key));
export { keyHash };
export const validKey = (k) => typeof k === 'string' && /^[A-Za-z0-9_-]{24,128}$/.test(k);

// Express middleware
export function requireAuth(req, res, next) {
  if (config.noAuth) {
    const key = req.get('x-animora-key');
    if (validKey(key)) return deviceUser(key).then((user) => { req.user = user; next(); }).catch(next);
    if (!config.serverless && !config.privateDevices) return localUser().then((user) => { req.user = user; next(); }).catch(next);
    return res.status(401).json({ error: 'Please reload Animora.' });
  }
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  const data = readToken(token);
  if (!data) return res.status(401).json({ error: 'Please log in again.' });
  loadUser(data.uid).then((user) => {
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    req.user = user;
    next();
  }).catch(next);
}

export function requireRole(...roles) {
  return (req, res, next) => (roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Not allowed for your account type.' }));
}
