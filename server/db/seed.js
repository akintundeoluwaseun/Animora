// Seeds starter styles, demo ads and demo accounts. Runs automatically on first start
// (empty database) and can be re-run with `npm run seed` (it skips anything that exists).
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../config.js';
import { initDb, one, q, closeDb } from './index.js';
import { initStorage, putObject } from '../storage.js';
import { hashPassword } from '../auth.js';
import { templateFromPlan } from '../ai/templates.js';
import { STARTER_STYLES, DEMO_ADS } from './starter.js';

const ASSETS = path.join(ROOT, 'assets');
const PASSWORD = 'demo1234';
// Bump when assets/styles/*.mp4|jpg are re-rendered so existing databases pick up the new files.
const STYLE_ASSETS_VERSION = 5;

async function upload(rel, type, prefix = 'demo') {
  const file = path.join(ASSETS, rel);
  return existsSync(file) ? putObject(`${prefix}/${rel}`, file, type) : null;
}

async function ensureUser({ name, email, role, plan = 'free', used = 0, business }) {
  const existing = await one('SELECT * FROM users WHERE email=$1', [email]);
  if (existing) return existing;
  return one(`INSERT INTO users (name, email, password_hash, role, plan, plan_renews_at, videos_used_this_month, business_name)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
  [name, email, await hashPassword(PASSWORD), role, plan, plan === 'pro' ? new Date(Date.now() + 20 * 864e5).toISOString() : null, used, business || null]);
}

/**
 * Make sure every starter style exists and is up to date (runs on every start, so new styles and engine
 * upgrades reach databases created by older versions). Only touches the starter styles by slug.
 */
export async function syncStarterStyles(creatorRow) {
  const creator = creatorRow || await ensureUser({ name: 'Tunde Motion', email: 'creator@adflash.ng', role: 'creator' });
  const styles = {};
  for (const s of STARTER_STYLES) {
    const html = templateFromPlan(s.example, { themeKey: s.palette.theme });
    const palette = JSON.stringify({ ...s.palette, category: s.category, assets_v: STYLE_ASSETS_VERSION });
    let row = await one('SELECT * FROM styles WHERE slug=$1', [s.slug]);
    // Copy the preview video/poster into storage only when they are new or were re-rendered (version bump).
    const fresh = !row || !row.preview_url || row.palette?.assets_v !== STYLE_ASSETS_VERSION;
    const preview = fresh ? await upload(`styles/${s.slug}.mp4`, 'video/mp4', `demo/v${STYLE_ASSETS_VERSION}`) : null;
    const poster = fresh ? await upload(`styles/${s.slug}.jpg`, 'image/jpeg', `demo/v${STYLE_ASSETS_VERSION}`) : null;
    if (!row) {
      row = await one(`INSERT INTO styles (creator_id, slug, name, description, rules, base_code, palette, font, preview_url, poster_url)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [creator.id, s.slug, s.name, s.description, s.rules, html, palette, s.font, preview, poster]);
    } else {
      row = await one(`UPDATE styles SET name=$2, description=$3, rules=$4, base_code=$5, palette=$6, font=$7,
          preview_url=COALESCE($8, preview_url), poster_url=COALESCE($9, poster_url) WHERE id=$1 RETURNING *`,
      [row.id, s.name, s.description, s.rules, html, palette, s.font, preview, poster]);
    }
    styles[s.slug] = row;
  }
  return styles;
}

export async function seed({ history = process.env.SEED_DEMO_HISTORY !== 'false' } = {}) {
  console.log('[seed] adding starter styles, demo ads and demo accounts');
  const creator = await ensureUser({ name: 'Tunde Motion', email: 'creator@adflash.ng', role: 'creator' });
  await q("UPDATE users SET bank_name='GTBank|058', bank_account_number='0123456789', bank_account_name='TUNDE MOTION' WHERE id=$1 AND bank_account_number IS NULL", [creator.id]);
  const demo = await ensureUser({ name: 'Ada Okafor', email: 'demo@adflash.ng', role: 'user', business: "Ada's Kitchen" });
  const pro = await ensureUser({ name: 'Bayo Adeyemi', email: 'pro@adflash.ng', role: 'user', plan: 'pro', used: 29, business: 'Bayo Gadgets' });
  await ensureUser({ name: 'AdFlash Admin', email: 'admin@adflash.ng', role: 'admin' });

  const styles = await syncStarterStyles(creator);

  if (!(await one('SELECT id FROM ads LIMIT 1'))) {
    for (const ad of DEMO_ADS) {
      const url = await upload(`ads/${ad.file}.mp4`, 'video/mp4');
      if (!url) { console.warn(`[seed] assets/ads/${ad.file}.mp4 missing - run: node scripts/build-demo-assets.js`); continue; }
      await q('INSERT INTO ads (advertiser, title, video_url, poster_url, duration_seconds, revenue_per_view) VALUES ($1,$2,$3,$4,$5,$6)',
        [ad.advertiser, ad.title, url, await upload(`ads/${ad.file}.jpg`, 'image/jpeg'), ad.plan.duration_seconds, ad.revenue]);
    }
  }

  // Demo history so the creator dashboard and "my videos" aren't empty in the pitch.
  if (history && !(await one('SELECT id FROM royalties LIMIT 1'))) {
    const sampleUrl = await upload('samples/jollof-15s.mp4', 'video/mp4');
    const sampleCode = existsSync(path.join(ROOT, 'samples/sample-15s.html')) ? await readFile(path.join(ROOT, 'samples/sample-15s.html'), 'utf8') : null;
    if (sampleUrl && sampleCode) {
      const proj = await one(`INSERT INTO projects (user_id, title, code_html, aspect_ratio, duration_seconds, style_id, status, ai_source)
        VALUES ($1, 'Iya Basira''s Kitchen - Jollof promo', $2, '9:16', 15, $3, 'rendered', 'template') RETURNING *`, [demo.id, sampleCode, styles['naija-bold'].id]);
      // 60 videos over the last 4 weeks, mostly Naija Bold; the oldest 12 royalties are already paid out.
      const mix = ['naija-bold', 'naija-bold', 'gold-luxe', 'naija-bold', 'clean-pro'];
      const N = 60;
      for (let i = 0; i < N; i++) {
        const slug = mix[(i * 7) % mix.length];
        const viaPro = i % 3 === 0;
        const revenue = viaPro ? 166.67 : 40;
        const when = new Date(Date.now() - ((N - i) / N) * 27 * 864e5 - 3600e3).toISOString();
        const r = await one(`INSERT INTO renders (project_id, user_id, style_id, status, progress, frames_done, total_frames, code_html, aspect_ratio,
            duration_seconds, video_url, paid_via, revenue_ngn, created_at, started_at, finished_at)
          VALUES ($1,$2,$3,'done',100,450,450,$4,'9:16',15,$5,$6,$7,$8,$8,$8) RETURNING id`,
        [proj.id, viaPro ? pro.id : demo.id, styles[slug].id, sampleCode, sampleUrl, viaPro ? 'pro' : 'ad', revenue, when]);
        await q(`INSERT INTO royalties (creator_id, render_id, style_id, amount, status, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
          [creator.id, r.id, styles[slug].id, Math.round(revenue * 0.3 * 100) / 100, i < 12 ? 'paid' : 'pending', when]);
        await q('UPDATE styles SET times_used=times_used+1 WHERE id=$1', [styles[slug].id]);
      }
      const paid = await one("SELECT sum(amount) AS s FROM royalties WHERE status='paid'");
      const po = await one(`INSERT INTO payouts (creator_id, amount_ngn, status, reference, provider, bank_name, account_number, created_at, paid_at)
        VALUES ($1,$2,'paid','AFPAY-DEMO-0001','sandbox','GTBank','0123456789', now() - interval '20 days', now() - interval '20 days') RETURNING id`, [creator.id, paid.s]);
      await q("UPDATE royalties SET payout_id=$1 WHERE status='paid'", [po.id]);
    }
  }
  console.log(`[seed] done. Demo logins (password "${PASSWORD}"): demo@adflash.ng (free), pro@adflash.ng (pro, 29/30 used), creator@adflash.ng (creator)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await initDb();
  await initStorage();
  await seed();
  await closeDb();
}
