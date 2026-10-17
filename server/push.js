// Phone/computer notifications that arrive even when Animora (and the browser) is closed: Web Push.
// The VAPID keys are made once and kept in the database, so there is nothing to configure.
import webpush from 'web-push';
import { one, q } from './db/index.js';
import { config } from './config.js';

let vapid = null;
async function keys() {
  if (vapid) return vapid;
  let row = await one("SELECT value FROM settings WHERE key='vapid'");
  if (!row) {
    const k = webpush.generateVAPIDKeys();
    await q("INSERT INTO settings (key, value) VALUES ('vapid', $1) ON CONFLICT (key) DO NOTHING", [JSON.stringify(k)]);
    row = await one("SELECT value FROM settings WHERE key='vapid'");
  }
  vapid = row.value;
  webpush.setVapidDetails(`mailto:hello@${new URL(config.publicBaseUrl).hostname || 'animora.app'}`, vapid.publicKey, vapid.privateKey);
  return vapid;
}

export async function publicKey() { return (await keys()).publicKey; }

export async function saveSubscription(userId, sub) {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw Object.assign(new Error('Invalid subscription'), { status: 400 });
  await q(`INSERT INTO push_subscriptions (endpoint, user_id, keys) VALUES ($1,$2,$3)
    ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, keys=EXCLUDED.keys`, [sub.endpoint, userId, JSON.stringify(sub.keys)]);
}

/** Send { title, body, url, tag } to every device this user turned notifications on for. Never throws. */
export async function notifyUser(userId, message) {
  try {
    await keys();
    const subs = await q('SELECT endpoint, keys FROM push_subscriptions WHERE user_id=$1', [userId]);
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(message), { TTL: 3600, urgency: 'high' });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await q('DELETE FROM push_subscriptions WHERE endpoint=$1', [s.endpoint]);
        else console.warn('[push]', e.statusCode || e.message);
      }
    }));
  } catch (e) {
    console.warn('[push] failed:', e.message);
  }
}
