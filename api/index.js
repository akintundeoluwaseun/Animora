// Vercel entry: the whole Express API runs as one serverless function.
// Static files (the built website, demo videos, sounds, GSAP) are served by Vercel directly; see vercel.json.
import { createApp } from '../server/index.js';

let appPromise;
export default async function handler(req, res) {
  appPromise ||= createApp().catch((e) => { appPromise = null; throw e; });
  const app = await appPromise;
  return app(req, res);
}
