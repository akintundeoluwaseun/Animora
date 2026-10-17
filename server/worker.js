// Render worker: takes queued jobs from the database and runs the AdFlash engine.
// Runs inside the web server by default (RUN_WORKER=true). For more capacity, run extra
// workers on other machines with `npm run worker` against the same DATABASE_URL.

import { hostname, tmpdir } from 'node:os';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { initDb, one, q } from './db/index.js';
import { initStorage, putObject } from './storage.js';
import { renderVideo, snapshotFrames } from './engine/renderer.js';
import { addSfxToVideo } from './engine/sfx.js';
import { settleRender, refundRender } from './billing.js';

const WORKER_ID = `${hostname()}-${process.pid}`;
let running = 0;
let stopped = false;

async function claimJob() {
  return one(`UPDATE renders SET status='rendering', started_at=now(), worker_id=$1
    WHERE id = (SELECT id FROM renders WHERE status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING *`, [WORKER_ID]);
}

const friendly = (msg) => {
  if (/__timeline/.test(msg)) return 'The animation code is broken (no timeline). Try "Regenerate" on the preview page.';
  if (/Timeout|timed out/i.test(msg)) return 'The animation took too long to load. Check uploaded images and try again.';
  if (/cancelled/i.test(msg)) return 'Cancelled.';
  return 'Rendering failed. Please try again. If it keeps failing, regenerate the code.';
};

async function runJob(job) {
  const dir = await mkdtemp(path.join(tmpdir(), 'adflash-job-'));
  const outFile = path.join(dir, 'video.mp4');
  const controller = new AbortController();
  let lastWrite = 0;

  // Watch for cancellation by the user.
  const cancelWatch = setInterval(async () => {
    const r = await one('SELECT status FROM renders WHERE id=$1', [job.id]).catch(() => null);
    if (r?.status === 'cancelled') controller.abort();
  }, 2000);

  try {
    console.log(`[worker] render ${job.id}: ${job.duration_seconds}s ${job.aspect_ratio}`);
    const result = await renderVideo({
      html: job.code_html,
      outFile,
      aspectRatio: job.aspect_ratio,
      duration: job.duration_seconds,
      signal: controller.signal,
      onProgress: (p) => {
        const now = Date.now();
        if (now - lastWrite < 1000 && p.framesDone < p.totalFrames) return;
        lastWrite = now;
        // Leave the last 2% for encoding/upload so the bar never sits at 100% while still working.
        q("UPDATE renders SET progress=$2, frames_done=$3, total_frames=$4, eta_seconds=$5 WHERE id=$1 AND status='rendering'",
          [job.id, Math.min(98, p.percent), p.framesDone, p.totalFrames, p.etaSeconds]).catch(() => {});
      },
    });
    if (result.warnings.length) console.log(`[worker] ${job.id} warnings: ${result.warnings.join(' | ')}`);
    // sound effects: mix the animation's cues into the MP4 (unless switched off for this video)
    let finalFile = outFile;
    if (job.sfx_on !== false && (result.sfx?.length || result.music)) {
      try { finalFile = await addSfxToVideo(outFile, path.join(dir, 'video-sfx.mp4'), result.sfx || [], job.duration_seconds, { music: result.music }); }
      catch (e) { console.warn(`[worker] ${job.id} sound effects skipped:`, e.message); finalFile = outFile; }
    }

    const [thumb] = await snapshotFrames(job.code_html, [Math.min(2, job.duration_seconds / 4)], { aspectRatio: job.aspect_ratio, scale: 0.4 }).catch(() => [null]);
    const videoUrl = await putObject(`renders/${job.id}.mp4`, finalFile, 'video/mp4');
    const thumbUrl = thumb ? await putObject(`renders/${job.id}.jpg`, thumb, 'image/jpeg') : null;
    const size = (await stat(finalFile)).size;

    await q(`UPDATE renders SET status='done', progress=100, frames_done=total_frames, eta_seconds=0, video_url=$2,
      thumbnail_url=$3, file_size=$4, finished_at=now() WHERE id=$1`, [job.id, videoUrl, thumbUrl, size]);
    if (thumbUrl) await q('UPDATE projects SET thumbnail_url=$2 WHERE id=$1', [job.project_id, thumbUrl]);
    const royalty = await settleRender(job.id);
    console.log(`[worker] render ${job.id} done in ${result.elapsedSeconds}s${royalty ? ` (royalty ₦${royalty.amount})` : ''}`);
  } catch (err) {
    const cancelled = controller.signal.aborted;
    console.error(`[worker] render ${job.id} ${cancelled ? 'cancelled' : 'failed'}:`, err.message);
    await q(`UPDATE renders SET status=$2, error=$3, finished_at=now() WHERE id=$1`,
      [job.id, cancelled ? 'cancelled' : 'failed', cancelled ? 'Cancelled.' : friendly(err.message)]);
    await refundRender(job.id);
  } finally {
    clearInterval(cancelWatch);
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function tick() {
  while (!stopped && running < config.workerConcurrency) {
    const job = await claimJob().catch((e) => { console.error('[worker] claim failed:', e.message); return null; });
    if (!job) break;
    running++;
    runJob(job).finally(() => { running--; setImmediate(tick); });
  }
}

export async function startWorker() {
  // Jobs that were mid-render when this machine last stopped go back to the queue.
  const reset = await q(`UPDATE renders SET status='queued', progress=0, frames_done=0, worker_id=NULL
    WHERE status='rendering' AND (worker_id LIKE $1 OR worker_id IS NULL) RETURNING id`, [`${hostname()}-%`]);
  if (reset.length) console.log(`[worker] re-queued ${reset.length} interrupted render(s)`);
  const timer = setInterval(tick, 1500);
  tick();
  console.log(`[worker] started (${WORKER_ID}, concurrency ${config.workerConcurrency})`);
  return () => { stopped = true; clearInterval(timer); };
}

export const queuePosition = async (renderId) => {
  const r = await one(`SELECT count(*)::int AS ahead FROM renders WHERE status='queued'
    AND created_at < (SELECT created_at FROM renders WHERE id=$1)`, [renderId]);
  return r?.ahead ?? 0;
};

// `npm run worker` -> standalone worker process (needs DATABASE_URL; PGlite is single-process).
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!config.databaseUrl) {
    console.error('A separate worker needs DATABASE_URL (Supabase Postgres). Locally, the worker runs inside `npm start`.');
    process.exit(1);
  }
  await initDb();
  await initStorage();
  await startWorker();
}
