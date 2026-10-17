import { Router } from 'express';
import { one, q } from '../db/index.js';
import { hashPassword, verifyPassword, createToken, publicUser, requireAuth } from '../auth.js';

const r = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

r.post('/signup', async (req, res) => {
  const { name, email, password, role = 'user', businessName } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Enter your name.' });
  if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'Enter a valid email address.' });
  if ((password || '').length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (!['user', 'creator'].includes(role)) return res.status(400).json({ error: 'Invalid account type.' });
  const exists = await one('SELECT id FROM users WHERE lower(email)=lower($1)', [email]);
  if (exists) return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
  const user = await one(`INSERT INTO users (name, email, password_hash, role, business_name)
    VALUES ($1, lower($2), $3, $4, $5) RETURNING *`, [name.trim(), email.trim(), await hashPassword(password), role, businessName?.trim() || null]);
  res.json({ token: createToken(user.id), user: publicUser(user) });
});

r.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await one('SELECT * FROM users WHERE lower(email)=lower($1)', [email || '']);
  if (!user || !(await verifyPassword(password || '', user.password_hash))) {
    return res.status(401).json({ error: 'Wrong email or password.' });
  }
  res.json({ token: createToken(user.id), user: publicUser(user) });
});

r.get('/me', requireAuth, async (req, res) => {
  const u = req.user;
  const stats = await one(`SELECT
      (SELECT count(*)::int FROM projects WHERE user_id=$1) AS projects,
      (SELECT count(*)::int FROM renders WHERE user_id=$1 AND status='done') AS videos`, [u.id]);
  res.json({ user: publicUser(u), stats });
});

r.patch('/me', requireAuth, async (req, res) => {
  const { name, businessName } = req.body || {};
  const u = await one(`UPDATE users SET name=COALESCE($2, name), business_name=COALESCE($3, business_name)
    WHERE id=$1 RETURNING *`, [req.user.id, name?.trim() || null, businessName?.trim() || null]);
  res.json({ user: publicUser(u) });
});

// Business owners who also want to sell styles can switch on creator mode.
r.post('/me/become-creator', requireAuth, async (req, res) => {
  const u = await one(`UPDATE users SET role='creator' WHERE id=$1 AND role='user' RETURNING *`, [req.user.id]);
  res.json({ user: publicUser(u || req.user) });
});

export default r;
export { q };
