// Plan rules, the ad gate, and creator royalties.
//
//  FREE : every video needs a 15s ad. Max 60s videos.
//  PRO  : N5,000/month, 30 ad-free videos. After 30, keep creating by watching ads. Max 5 min.
//  Counter resets every calendar month (see auth.refreshUser).
//  CREATORS : 30% of the revenue a video earns goes to the creator of the style it used.
//     revenue of an ad-supported video = what the advertiser pays for that ad view
//     revenue of a Pro video            = N5,000 / 30 = N166.67 (subscription value per video)

import { config } from './config.js';
import { one, q, tx } from './db/index.js';

const P = config.pricing;
const round2 = (n) => Math.round(n * 100) / 100;

export function renderAllowance(user, durationSeconds) {
  if (config.noAuth) {
    return durationSeconds > P.proMaxSeconds
      ? { ok: false, code: 'TOO_LONG', error: `Videos can be up to ${P.proMaxSeconds / 60} minutes.` }
      : { ok: true, needsAd: false, proLeft: Infinity };
  }
  const max = user.plan === 'pro' ? P.proMaxSeconds : P.freeMaxSeconds;
  if (durationSeconds > max) {
    return { ok: false, code: 'TOO_LONG', error: user.plan === 'pro' ? `Videos can be up to ${max / 60} minutes.` : `Free videos can be up to ${max} seconds. Upgrade to Pro for 1–5 minute videos.` };
  }
  const proLeft = user.plan === 'pro' ? Math.max(0, P.proVideosPerMonth - user.videos_used_this_month) : 0;
  return { ok: true, needsAd: proLeft === 0, proLeft };
}

/** Was this exact version of the video made before and deleted after its few minutes? Then making it again is free. */
export async function freeRedo(userId, project) {
  if (!project?.code_html) return null;
  return one(`SELECT id, paid_via FROM renders WHERE project_id=$1 AND user_id=$2 AND error='expired' AND code_md5=md5($3)
    ORDER BY created_at DESC LIMIT 1`, [project.id, userId, project.code_html]).catch(() => null);
}

/** Start an ad view: pick an active ad (round robin by least shown). */
export async function startAdView(user, projectId) {
  const ad = await one(`SELECT a.*, (SELECT count(*) FROM ad_views v WHERE v.ad_id=a.id) AS shown
    FROM ads a WHERE active ORDER BY shown ASC, random() LIMIT 1`);
  if (!ad) throw Object.assign(new Error('No ads available right now.'), { status: 503 });
  const view = await one('INSERT INTO ad_views (user_id, ad_id, project_id) VALUES ($1,$2,$3) RETURNING *', [user.id, ad.id, projectId || null]);
  return { adViewId: view.id, ad: { id: ad.id, advertiser: ad.advertiser, title: ad.title, videoUrl: ad.video_url, posterUrl: ad.poster_url, durationSeconds: ad.duration_seconds } };
}

/** Mark an ad as fully watched. The server checks real elapsed time, so skipping is not possible. */
export async function completeAdView(user, viewId) {
  const view = await one(`SELECT v.*, a.duration_seconds, a.revenue_per_view FROM ad_views v LEFT JOIN ads a ON a.id=v.ad_id
    WHERE v.id=$1 AND v.user_id=$2`, [viewId, user.id]);
  if (!view) throw Object.assign(new Error('Ad view not found.'), { status: 404 });
  if (view.watched_at) return { ok: true, adViewId: view.id };
  const elapsed = (Date.now() - new Date(view.started_at).getTime()) / 1000;
  const needed = (view.duration_seconds || P.adSeconds) - 1.5;
  if (elapsed < needed) throw Object.assign(new Error(`Please watch the full ad (${Math.ceil(needed - elapsed)}s left).`), { status: 400 });
  await q('UPDATE ad_views SET watched_at=now(), revenue_ngn=$2 WHERE id=$1', [view.id, view.revenue_per_view ?? P.adRevenuePerViewNgn]);
  return { ok: true, adViewId: view.id };
}

/**
 * Create a render job atomically: checks allowance, consumes a Pro credit or a watched ad,
 * increments the monthly counter and snapshots the code.
 */
export async function createRender(user, project, { adViewId } = {}) {
  if (!project.code_html) throw Object.assign(new Error('Generate the animation code first.'), { status: 400 });
  const outSeconds = project.duration_seconds;
  // the same video again after its MP4 was deleted: no credit, no ad
  const redo = await freeRedo(user.id, project);
  if (redo) {
    return one(`INSERT INTO renders (project_id, user_id, style_id, code_html, code_md5, aspect_ratio, duration_seconds,
        total_frames, music_url, voice_url, time_scale, paid_via, ad_view_id, revenue_ngn, sfx_on)
      VALUES ($1,$2,$3,$4,md5($4),$5,$6,$7,NULL,NULL,1,$8,NULL,0,$9) RETURNING *`,
    [project.id, user.id, project.style_id, project.code_html, project.aspect_ratio, outSeconds, outSeconds * 30, redo.paid_via, project.sfx_on !== false]);
  }
  const allowance = renderAllowance(user, outSeconds);
  if (!allowance.ok) throw Object.assign(new Error(allowance.error), { status: 402, code: allowance.code });

  return tx(async (t) => {
    // Re-read the user inside the transaction so two quick clicks can't both use the last Pro credit.
    const u = await t.one('SELECT * FROM users WHERE id=$1 FOR UPDATE', [user.id]);
    const proLeft = config.noAuth ? 1 : u.plan === 'pro' ? P.proVideosPerMonth - u.videos_used_this_month : 0;
    let paidVia, revenue, viewId = null;

    if (proLeft > 0) {
      paidVia = 'pro';
      revenue = round2(P.proPriceNgn / P.proVideosPerMonth);
    } else {
      if (!adViewId) throw Object.assign(new Error('Watch a short ad to unlock this video.'), { status: 402, code: 'AD_REQUIRED' });
      const view = await t.one('SELECT * FROM ad_views WHERE id=$1 AND user_id=$2 FOR UPDATE', [adViewId, u.id]);
      if (!view || !view.watched_at) throw Object.assign(new Error('Please finish watching the ad first.'), { status: 402, code: 'AD_REQUIRED' });
      if (view.render_id) {
        // Allowed to reuse only if the earlier render failed or was cancelled (free retry).
        const prev = await t.one('SELECT status FROM renders WHERE id=$1', [view.render_id]);
        if (prev && !['failed', 'cancelled'].includes(prev.status)) throw Object.assign(new Error('That ad was already used for a video. Watch another one.'), { status: 402, code: 'AD_REQUIRED' });
      }
      paidVia = 'ad';
      revenue = Number(view.revenue_ngn) || P.adRevenuePerViewNgn;
      viewId = view.id;
    }

    const render = await t.one(`INSERT INTO renders (project_id, user_id, style_id, code_html, code_md5, aspect_ratio, duration_seconds,
        total_frames, music_url, voice_url, time_scale, paid_via, ad_view_id, revenue_ngn, sfx_on)
      VALUES ($1,$2,$3,$4,md5($4),$5,$6,$7,NULL,NULL,1,$8,$9,$10,$11) RETURNING *`,
    [project.id, u.id, project.style_id, project.code_html, project.aspect_ratio, outSeconds,
      outSeconds * 30, paidVia, viewId, revenue, project.sfx_on !== false]);
    if (viewId) await t.q('UPDATE ad_views SET render_id=$2 WHERE id=$1', [viewId, render.id]);
    await t.q('UPDATE users SET videos_used_this_month = videos_used_this_month + 1 WHERE id=$1', [u.id]);
    return render;
  });
}

/** Called by the worker when a render finishes. Pays the style's creator 30%. */
export async function settleRender(renderId) {
  return tx(async (t) => {
    const r = await t.one(`SELECT r.*, s.creator_id FROM renders r LEFT JOIN styles s ON s.id=r.style_id WHERE r.id=$1`, [renderId]);
    if (!r || r.status !== 'done') return null;
    await t.q("UPDATE projects SET status='rendered', updated_at=now() WHERE id=$1", [r.project_id]);
    if (!r.style_id) return null;
    await t.q('UPDATE styles SET times_used = times_used + 1 WHERE id=$1', [r.style_id]);
    if (!r.creator_id) return null;
    const amount = round2(Number(r.revenue_ngn) * P.creatorShare);
    return t.one(`INSERT INTO royalties (creator_id, render_id, style_id, amount) VALUES ($1,$2,$3,$4)
      ON CONFLICT (render_id) DO NOTHING RETURNING *`, [r.creator_id, r.id, r.style_id, amount]);
  });
}

/** Failed/cancelled renders give the video credit back. */
export async function refundRender(renderId) {
  await q(`UPDATE users SET videos_used_this_month = GREATEST(0, videos_used_this_month - 1)
    WHERE id = (SELECT user_id FROM renders WHERE id=$1 AND revenue_ngn > 0)`, [renderId]);   // a free re-make used no credit
}

export function publicPricing() {
  return {
    proPriceNgn: P.proPriceNgn, proVideosPerMonth: P.proVideosPerMonth, freeMaxSeconds: P.freeMaxSeconds,
    proMaxSeconds: P.proMaxSeconds, adSeconds: P.adSeconds, creatorSharePercent: Math.round(P.creatorShare * 100),
    adRevenuePerViewNgn: P.adRevenuePerViewNgn, proRevenuePerVideoNgn: round2(P.proPriceNgn / P.proVideosPerMonth),
  };
}

// ---------------------------------------------------------------------------
// Credits (no sign-in): each new video or flyer uses one credit the first time it is made.
// Free credits first, then paid ones. Regenerating and editing the same video is free.
// ---------------------------------------------------------------------------
export async function useCredit(user, projectId) {
  if (!config.credits.enabled) return { ok: true };
  const p = await one('SELECT paid_at FROM projects WHERE id=$1', [projectId]);
  if (p?.paid_at) return { ok: true };
  const u = await one(`UPDATE users SET
      free_left = CASE WHEN unlimited THEN free_left WHEN free_left > 0 THEN free_left - 1 ELSE free_left END,
      credits   = CASE WHEN unlimited OR free_left > 0 THEN credits ELSE credits - 1 END
    WHERE id=$1 AND (unlimited OR free_left > 0 OR credits > 0) RETURNING free_left, credits`, [user.id]);
  if (!u) return { ok: false };
  await q('UPDATE projects SET paid_at=now() WHERE id=$1', [projectId]);
  return { ok: true, left: u.free_left + u.credits };
}
export const NEED_CREDITS = () => Object.assign(new Error(`You've used your free videos. Buy ${config.credits.packSize} more videos for ₦${config.credits.packPriceNgn.toLocaleString('en-NG')} to keep going.`), { status: 402, code: 'NEED_CREDITS' });
