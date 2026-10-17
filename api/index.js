// Vercel entry: the whole Express API runs as one serverless function.
// Static files (the built website, demo videos, sounds, GSAP) are served by Vercel directly; see vercel.json.
import { createApp } from '../server/index.js';

let appPromise;
export default async function handler(req, res) {
  appPromise ||= createApp().catch((e) => { appPromise = null; throw e; });
  let app;
  try {
    app = await appPromise;
  } catch (e) {
    // Startup failed (usually DATABASE_URL). Say why instead of a bare 500, without echoing the connection string.
    console.error('[startup]', e);
    const msg = String(e?.message || e).replace(/postgres(ql)?:\/\/\S+/g, '[connection string]');
    const hint = /password authentication/i.test(msg) ? ' The password in DATABASE_URL is wrong.'
      : /ENOTFOUND|getaddrinfo|ENETUNREACH/i.test(msg) ? ' The address in DATABASE_URL is wrong; use the Transaction pooler string.' : '';
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: `The server couldn't start: ${msg.slice(0, 200)}.${hint}` }));
  }
  return app(req, res);
}
