// End-to-end API test of the whole business flow, on a throwaway database.
//   free user: sign up -> plan by chat -> generate -> edit -> ad gate -> render MP4 -> download
//   pro user: pay N5,000 (sandbox) -> render without ad -> 30-video limit -> ad again
//   creator: royalty (30%) appears -> add bank -> withdraw
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { STARTER_STYLES } from '../server/db/starter.js';

const dataDir = await mkdtemp(path.join(tmpdir(), 'adflash-test-'));
const PORT = 3999;
Object.assign(process.env, {
  DATA_DIR: dataDir, PORT: String(PORT), PUBLIC_BASE_URL: `http://localhost:${PORT}`, AI_MODE: 'offline', AUTH: 'on',
  PAYMENT_PROVIDER: 'sandbox', DATABASE_URL: '', SUPABASE_URL: '', SEED_DEMO_HISTORY: 'false', RUN_WORKER: 'true',
});

const { createApp } = await import('../server/index.js');
const { startWorker } = await import('../server/worker.js');
const { q, closeDb } = await import('../server/db/index.js');
const app = await createApp();
const server = app.listen(PORT);
const stopWorker = await startWorker();
await q('UPDATE ads SET duration_seconds=2, revenue_per_view=40'); // don't wait 15s per ad in tests

const base = `http://localhost:${PORT}`;
let failures = 0;
const ok = (name, cond, detail = '') => { if (!cond) failures++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
async function api(method, url, body, token) {
  const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitRender(id, token) {
  for (let i = 0; i < 400; i++) {
    const { render } = await api('GET', `/api/renders/${id}`, null, token);
    if (['done', 'failed', 'cancelled'].includes(render.status)) return render;
    await sleep(1000);
  }
  throw new Error('render timeout');
}

try {
  // ---------- free user ----------
  const s = await api('POST', '/api/auth/signup', { name: 'Kemi', email: 'kemi@test.ng', password: 'secret1', businessName: 'Kemi Cakes' });
  ok('signup', !!s.token && s.user.plan === 'free');
  const T = s.token;
  ok('wrong password rejected', (await api('POST', '/api/auth/login', { email: 'kemi@test.ng', password: 'nope' })).status === 401);
  ok('auth required', (await api('GET', '/api/projects')).status === 401);

  const { styles } = await api('GET', '/api/styles');
  ok(`${STARTER_STYLES.length} starter styles`, styles.length === STARTER_STYLES.length, styles.map((x) => x.name).join(', '));
  const bold = styles.find((x) => x.slug === 'naija-bold');

  let { project } = await api('POST', '/api/projects', { title: 'Cake promo', styleId: bold.id }, T);
  ok('project created', !!project.id);
  const P = project.id;

  for (const msg of ["Kemi Cakes, we bake birthday and wedding cakes", 'Birthday cake ₦15,000, Cupcakes (6) ₦4,500, Free delivery in Ado',
    '08061234567, 3 Fajuyi Road, Ado Ekiti', 'no', '3', 'pink and gold, whatsapp status, 20 seconds']) {
    await api('POST', `/api/projects/${P}/chat`, { message: msg }, T);
  }
  let chat = await api('POST', `/api/projects/${P}/chat`, { message: 'yes, generate it' }, T);
  ok('chat produces a plan', chat.planReady && chat.project.plan?.scenes?.length > 2, `${chat.project.plan?.scenes?.length} scenes, ${chat.project.durationSeconds}s`);

  const gen = await api('POST', `/api/projects/${P}/generate`, {}, T);
  ok('code generated', gen.project?.code?.includes('window.__timeline'), gen.source);
  const ed = await api('POST', `/api/projects/${P}/edit`, { instruction: 'make the text bigger' }, T);
  ok('edit by prompt', ed.changed && ed.project.code.includes('--scale: 1.3'), ed.summary);
  const un = await api('POST', `/api/projects/${P}/undo`, {}, T);
  ok('undo', un.project.code.includes('--scale: 1;'));
  const bad = await api('PUT', `/api/projects/${P}/code`, { html: un.project.code.replace('{ paused: true,', '{') }, T);
  ok('broken hand edit rejected', bad.status === 400, bad.problems?.[0]);

  const check = await api('GET', `/api/projects/${P}/render-check`, null, T);
  ok('free user needs an ad', check.needsAd === true);
  const noAd = await api('POST', `/api/projects/${P}/renders`, {}, T);
  ok('render blocked without ad', noAd.status === 402 && noAd.code === 'AD_REQUIRED');
  const ad = await api('POST', '/api/ads/start', { projectId: P }, T);
  const early = await api('POST', `/api/ads/${ad.adViewId}/complete`, {}, T);
  ok('cannot skip the ad', early.status === 400, early.error);
  await sleep(1200);
  const done = await api('POST', `/api/ads/${ad.adViewId}/complete`, {}, T);
  ok('ad completed', done.ok);
  const rr = await api('POST', `/api/projects/${P}/renders`, { adViewId: ad.adViewId }, T);
  ok('render queued', rr.render?.status === 'queued' && rr.user.videosUsedThisMonth === 1);
  const reuse = await api('POST', `/api/projects/${P}/renders`, { adViewId: ad.adViewId }, T);
  ok('one ad = one video', reuse.status === 402);
  const r1 = await waitRender(rr.render.id, T);
  ok('render done', r1.status === 'done' && r1.videoUrl, `${r1.totalFrames} frames`);
  const vid = await fetch(r1.videoUrl);
  ok('MP4 downloadable', vid.ok && vid.headers.get('content-type') === 'video/mp4', `${(Number(vid.headers.get('content-length')) / 1e6).toFixed(1)} MB`);
  const dl = await fetch(`${base}/download/${r1.id}`);
  ok('download has filename', /attachment; filename=.*\.mp4/.test(dl.headers.get('content-disposition') || ''));

  // free plan limit: 2 minutes not allowed
  const plan2 = { ...chat.project.plan, duration_seconds: 120, scenes: [...chat.project.plan.scenes.slice(0, -1), { ...chat.project.plan.scenes.at(-1), end: 120 }] };
  const tooLong = await api('PUT', `/api/projects/${P}/plan`, { plan: plan2 }, T);
  ok('free users capped at 60s', tooLong.status === 400, tooLong.error);

  // ---------- creator royalties ----------
  const c = await api('POST', '/api/auth/login', { email: 'creator@adflash.ng', password: 'demo1234' });
  const dash = await api('GET', '/api/creator/dashboard', null, c.token);
  ok('creator earned 30% of ad revenue', Number(dash.totals.total) === 12 && dash.styles.find((x) => x.name === 'Naija Bold').times_used === 1, `₦${dash.totals.total}`);
  ok('business users cannot open creator dashboard', (await api('GET', '/api/creator/dashboard', null, T)).status === 403);

  // ---------- pro ----------
  const failPay = await api('POST', '/api/billing/subscribe', { walletAccountNo: '0123456780' }, T);
  ok('sandbox failed payment', failPay.status === 'FAILED' && failPay.user.plan === 'free');
  const pay = await api('POST', '/api/billing/subscribe', { walletAccountNo: '0123456781' }, T);
  ok('Pro activated after ₦5,000 payment', pay.status === 'SUCCESS' && pay.user.plan === 'pro' && pay.user.proVideosRemaining === 30);
  const rp = await api('POST', `/api/projects/${P}/renders`, {}, T);
  ok('Pro renders without an ad', rp.render?.paidVia === 'pro' && rp.user.proVideosRemaining === 29);
  const cancel = await api('POST', `/api/renders/${rp.render.id}/cancel`, {}, T);
  ok('cancel refunds the credit', cancel.render?.status === 'cancelled');
  await sleep(2500);
  const me = await api('GET', '/api/auth/me', null, T);
  ok('credit returned', me.user.proVideosRemaining === 30, `${me.user.proVideosRemaining} left`);
  await q("UPDATE users SET videos_used_this_month=30 WHERE email='kemi@test.ng'");
  const over = await api('POST', `/api/projects/${P}/renders`, {}, T);
  ok('Pro past 30 videos must watch ads', over.status === 402 && over.code === 'AD_REQUIRED');
  await q("UPDATE users SET usage_period_start = now() - interval '40 days' WHERE email='kemi@test.ng'");
  ok('monthly counter resets', (await api('GET', '/api/auth/me', null, T)).user.videosUsedThisMonth === 0);

  // ---------- creator payout ----------
  const bank = await api('POST', '/api/creator/bank', { bankCode: '058', accountNumber: '0123456781' }, c.token);
  ok('bank account verified (name enquiry)', !!bank.accountName, bank.accountName);
  const tooSmall = await api('POST', '/api/creator/payouts', {}, c.token);
  ok('payout needs ₦1,000 minimum', tooSmall.status === 400);
  await q("UPDATE royalties SET amount=1500");
  const po = await api('POST', '/api/creator/payouts', {}, c.token);
  ok('payout sent', po.payout?.status === 'paid', `₦${po.payout?.amount_ngn}`);

  // ---------- creator uploads a style ----------
  const st = await api('POST', '/api/creator/styles', { name: 'Test Style', rules: 'Use big neon text.', theme: 'clean' }, c.token);
  ok('creator uploads a style', !!st.style?.id);
  const badStyle = await api('POST', '/api/creator/styles', { name: 'Bad', rules: 'x', baseCode: '<!DOCTYPE html><html><body><script>setInterval(()=>{},9)</script></body></html>' }, c.token);
  ok('broken style code rejected', badStyle.status === 400);
} catch (e) {
  failures++;
  console.error(e);
} finally {
  stopWorker();
  server.close();
  await closeDb();
  await rm(dataDir, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll API checks passed');
process.exit(failures ? 1 : 0);
