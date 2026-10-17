// Animora server: API + website + (by default) the render worker, in one process.
import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { SFX_DIR, MUSIC_DIR } from './engine/sfx.js';
import { config, ROOT } from './config.js';
import { initDb, one, withStartupLock } from './db/index.js';
import { initStorage, localPathFor, getDbObject } from './storage.js';
import { startWorker } from './worker.js';
import { seed, syncStarterStyles } from './db/seed.js';
import { aiMode } from './ai/index.js';
import { provider } from './payments.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import renderRoutes from './routes/renders.js';
import moneyRoutes from './routes/money.js';
import transcribeRoutes from './routes/transcribe.js';

const require = createRequire(import.meta.url);

export async function createApp() {
  await initDb();
  await initStorage();
  await withStartupLock(async () => {
    if (!(await one('SELECT id FROM styles LIMIT 1'))) await seed();
    else await syncStarterStyles().catch((e) => console.warn('[styles] sync failed:', e.message));
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4mb' }));

  // --- API ---
  app.get('/api/status', (req, res) => res.json({
    ok: true, auth: config.noAuth ? 'off' : 'on', ai: aiMode(), storage: config.storageMode, payments: provider().name,
    database: config.databaseUrl ? 'postgres' : 'local', worker: config.runWorkerInProcess, render: config.renderEnabled,
  }));
  // Is the AI working? Runs one tiny Gemini request and reports the result (no secrets).
  app.get('/api/ai-check', async (req, res) => {
    if (!config.useGemini) return res.json({ ok: false, reason: 'No GEMINI_API_KEY on this server' });
    const { geminiGenerate } = await import('./engine/gemini.js');
    const t = Date.now();
    try {
      const r = await geminiGenerate({ system: 'Reply with JSON only.', messages: [{ role: 'user', text: 'Return {"ok": true}' }], json: true, timeoutMs: 40000, maxOutputTokens: 2048 });
      res.json({ ok: true, model: r.model, seconds: (Date.now() - t) / 1000, reply: r.text.slice(0, 60), finishReason: r.finishReason });
    } catch (e) {
      res.json({ ok: false, seconds: (Date.now() - t) / 1000, error: String(e.message).replace(/key=\S+/g, '').slice(0, 400) });
    }
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api', renderRoutes);
  app.use('/api', moneyRoutes);
  app.use('/api', transcribeRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // --- files ---
  // Local storage (uploads, MP4s). Range requests work, so videos can be scrubbed.
  if (config.storageMode === 'local') {
    // CORS: animations load images with crossorigin="anonymous" (preview iframe and renderer both need this).
    app.use('/files', (req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); next(); },
      express.static(localPathFor(''), { maxAge: '7d', fallthrough: false }));
  }
  if (config.storageMode === 'db') {
    app.get(/^\/files\/(.+)$/, async (req, res, next) => {
      try {
        const f = await getDbObject(decodeURIComponent(req.params[0]));
        if (!f) return res.status(404).send('File not found');
        res.set({ 'Content-Type': f.type, 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' }).send(f.data);
      } catch (e) { next(e); }
    });
  }
  // GSAP served from our own server for the preview iframe (same build the renderer uses).
  app.use('/sfx', express.static(SFX_DIR, { maxAge: '30d' }));   // sound effects for the live preview
  app.use('/music', express.static(MUSIC_DIR, { maxAge: '30d' })); // background music beds
  // (on Vercel these are static files copied by scripts/vercel-build.js, and gsap isn't in the function bundle)
  try { app.use('/vendor/gsap', express.static(path.dirname(require.resolve('gsap/dist/gsap.min.js')), { maxAge: '30d' })); }
  catch { console.warn('[gsap] not found; /vendor/gsap must be served as static files'); }
  // Download with a friendly filename.
  app.get('/download/:renderId', async (req, res) => {
    const r = await one(`SELECT r.video_url, p.title FROM renders r JOIN projects p ON p.id=r.project_id WHERE r.id=$1 AND r.status='done'`, [req.params.renderId]);
    if (!r) return res.status(404).send('Video not found');
    const name = `${(r.title || 'adflash-video').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'adflash-video'}.mp4`;
    const prefix = `${config.publicBaseUrl}/files/`;
    if (config.storageMode === 'local' && r.video_url.startsWith(prefix)) return res.download(localPathFor(r.video_url.slice(prefix.length)), name);
    res.redirect(`${r.video_url}?download=${encodeURIComponent(name)}`);
  });

  // --- website (built React app) ---
  const dist = path.join(ROOT, 'web/dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get(/^\/(?!api|files|vendor|sfx|music).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    app.get('/', (req, res) => res.send('Animora API is running. Build the website with `npm run build`, or run `npm run dev`.'));
  }

  // --- errors ---
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error('[error]', req.method, req.path, err);
    if (res.headersSent) return;
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File is too large.' });
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.' });
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const app = await createApp();
  app.listen(config.port, () => {
    console.log(`\n  Animora running at ${config.publicBaseUrl}`);
    console.log(`  AI: ${aiMode()} · storage: ${config.storageMode} · payments: ${provider().name}\n`);
  });
  if (config.runWorkerInProcess) await startWorker();
}
