// Central configuration. Values come from .env (see .env.example).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

const env = (k, d = '') => (process.env[k] ?? '').trim() || d;
const num = (k, d) => (process.env[k] ? Number(process.env[k]) : d);

const PORT = num('PORT', 3000);
// On Vercel the app runs as a serverless function: the disk is read-only except /tmp, and long jobs are cut off.
const SERVERLESS = !!process.env.VERCEL;
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

export const config = {
  port: PORT,
  serverless: SERVERLESS,
  publicBaseUrl: env('PUBLIC_BASE_URL', SERVERLESS && vercelUrl ? `https://${vercelUrl}` : `http://localhost:${PORT}`).replace(/\/$/, ''),
  dataDir: path.resolve(ROOT, env('DATA_DIR', SERVERLESS ? '/tmp/animora' : 'data')),
  authSecret: env('AUTH_SECRET', 'dev-only-secret-change-me'),

  // Database: Supabase Postgres connection string in production; embedded Postgres (PGlite) locally.
  databaseUrl: env('DATABASE_URL'),

  // Storage: Supabase Storage if both are set; local disk otherwise.
  supabaseUrl: env('SUPABASE_URL').replace(/\/$/, ''),
  supabaseServiceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseBucket: env('SUPABASE_BUCKET', 'adflash'),

  // AI: Gemini is the only external service. Without a key, the built-in practice AI is used.
  geminiApiKey: env('GEMINI_API_KEY'),
  aiMode: env('AI_MODE', 'auto'), // auto | gemini | offline

  // Render worker
  runWorkerInProcess: env('RUN_WORKER', 'true') !== 'false',
  // MP4 export needs Chrome + FFmpeg running for minutes, which serverless hosts (Vercel) can't do.
  // On Vercel, MP4s are made by a GitHub Actions run (see .github/workflows/render.yml) when GH_DISPATCH_TOKEN is set.
  githubRender: !!env('GH_DISPATCH_TOKEN'),
  githubToken: env('GH_DISPATCH_TOKEN'),
  adminKey: env('ADMIN_KEY'),   // turns the private /admin dashboard on
  githubRepo: env('GH_REPO', process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}` : 'akintundeoluwaseun/animora'),
  githubRef: env('GH_REF', process.env.VERCEL_GIT_COMMIT_REF || 'main'),
  renderEnabled: env('RENDER_ENABLED', SERVERLESS ? (env('GH_DISPATCH_TOKEN') ? 'true' : 'false') : 'true') !== 'false',
  workerConcurrency: num('WORKER_CONCURRENCY', 1),

  // Payments
  paymentProvider: env('PAYMENT_PROVIDER', 'sandbox'), // sandbox | accessbank
  // Access Bank Wallet-as-a-Service (Africa Fintech Foundry). Sandbox: https://api-sandbox.accessbankplc.com
  accessBank: {
    baseUrl: env('ACCESSBANK_BASE_URL', 'https://api-sandbox.accessbankplc.com').replace(/\/$/, ''),
    authorizationKey: env('ACCESSBANK_AUTHORIZATION_KEY'),
    subscriptionKey: env('ACCESSBANK_SUBSCRIPTION_KEY'),
    merchantId: env('ACCESSBANK_MERCHANT_ID'),
    sourceWallet: env('ACCESSBANK_PAYOUT_WALLET'),          // AdFlash wallet that pays creators
    sourceWalletName: env('ACCESSBANK_PAYOUT_WALLET_NAME', 'ADFLASH'),
  },

  // Credits: every device gets FREE_VIDEOS, then buys packs (no sign-in). Switched on by the Paystack key.
  credits: {
    enabled: env('CREDITS', env('FLW_SECRET_KEY') || env('PAYSTACK_SECRET_KEY') ? 'on' : 'off') === 'on',
    free: num('FREE_VIDEOS', 2),
    packSize: num('CREDIT_PACK_SIZE', 5),
    packPriceNgn: num('CREDIT_PACK_PRICE_NGN', 4000),
  },
  paystack: { secretKey: env('PAYSTACK_SECRET_KEY'), publicKey: env('PAYSTACK_PUBLIC_KEY') },
  flutterwave: { secretKey: env('FLW_SECRET_KEY') },
  // which checkout to use: Flutterwave when its key is set, otherwise Paystack
  get payProvider() { return this.flutterwave.secretKey ? 'flutterwave' : this.paystack.secretKey ? 'paystack' : null; },

  // Business rules
  pricing: {
    proPriceNgn: num('PRO_PRICE_NGN', 5000),
    proVideosPerMonth: num('PRO_VIDEOS_PER_MONTH', 30),
    freeMaxSeconds: num('FREE_MAX_SECONDS', 60),
    proMaxSeconds: num('PRO_MAX_SECONDS', 300),
    minSeconds: num('MIN_SECONDS', 15),
    adSeconds: num('AD_SECONDS', 15),
    adRevenuePerViewNgn: num('AD_REVENUE_PER_VIEW_NGN', 40),
    creatorShare: num('CREATOR_SHARE', 0.3),
    minPayoutNgn: num('MIN_PAYOUT_NGN', 1000),
  },
};

// AUTH=off (default for now): no sign-in, no ads, no plan limits. Everyone is the local test user.
config.noAuth = env('AUTH', 'off') !== 'on';

// Storage: Supabase Storage if its key is set; on Vercel with a database, files go in the database; else local disk.
config.storageMode = config.supabaseUrl && config.supabaseServiceKey ? 'supabase'
  : config.serverless && config.databaseUrl ? 'db' : 'local';
if (['local', 'db', 'supabase'].includes(env('STORAGE_MODE'))) config.storageMode = env('STORAGE_MODE');
config.useGemini = config.aiMode === 'gemini' || (config.aiMode === 'auto' && !!config.geminiApiKey);

if (config.authSecret === 'dev-only-secret-change-me' && process.env.NODE_ENV === 'production') {
  console.warn('[config] AUTH_SECRET is not set. Set a long random value in production.');
}
