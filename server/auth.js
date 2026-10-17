// Email + password auth with signed, stateless tokens (no third-party auth service needed).
import { scrypt, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
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

// Express middleware
export function requireAuth(req, res, next) {
  if (config.noAuth) {
    return localUser().then((user) => { req.user = user; next(); }).catch(next);
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
