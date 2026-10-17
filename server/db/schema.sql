-- AdFlash database schema (Postgres / Supabase). Safe to run on every start.

CREATE TABLE IF NOT EXISTS users (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL,
  email                  text NOT NULL UNIQUE,
  password_hash          text NOT NULL,
  role                   text NOT NULL DEFAULT 'user' CHECK (role IN ('user','creator','admin')),
  plan                   text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  plan_renews_at         timestamptz,
  videos_used_this_month integer NOT NULL DEFAULT 0,
  usage_period_start     timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  business_name          text,
  bank_name              text,
  bank_account_number    text,
  bank_account_name      text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS styles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  slug         text UNIQUE,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  rules        text NOT NULL DEFAULT '',          -- style rules injected into the AI prompt
  base_code    text,                              -- optional example HTML in this style
  palette      jsonb NOT NULL DEFAULT '{}'::jsonb,
  font         text NOT NULL DEFAULT 'Poppins',
  preview_url  text,
  poster_url   text,
  times_used   integer NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'live' CHECK (status IN ('live','hidden')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            text NOT NULL DEFAULT 'Untitled video',
  chat_history     jsonb NOT NULL DEFAULT '[]'::jsonb,
  plan_json        jsonb,
  plan_summary     text,
  code_html        text,
  code_versions    jsonb NOT NULL DEFAULT '[]'::jsonb,
  edit_history     jsonb NOT NULL DEFAULT '[]'::jsonb,
  aspect_ratio     text NOT NULL DEFAULT '9:16',
  duration_seconds integer NOT NULL DEFAULT 30,
  style_id         uuid REFERENCES styles(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','coding','ready','rendered')),
  ai_source        text,
  thumbnail_url    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_user_idx ON projects(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  kind        text NOT NULL DEFAULT 'image',
  mime        text,
  url         text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser        text NOT NULL,
  title             text NOT NULL,
  video_url         text NOT NULL,
  poster_url        text,
  duration_seconds  integer NOT NULL DEFAULT 15,
  revenue_per_view  numeric(12,2) NOT NULL DEFAULT 40,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_views (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_id         uuid REFERENCES ads(id) ON DELETE SET NULL,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  render_id     uuid,
  started_at    timestamptz NOT NULL DEFAULT now(),
  watched_at    timestamptz,
  revenue_ngn   numeric(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS renders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  style_id         uuid REFERENCES styles(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','rendering','done','failed','cancelled')),
  progress         numeric(5,1) NOT NULL DEFAULT 0,
  frames_done      integer NOT NULL DEFAULT 0,
  total_frames     integer NOT NULL DEFAULT 0,
  eta_seconds      integer,
  code_html        text NOT NULL,
  aspect_ratio     text NOT NULL,
  duration_seconds integer NOT NULL,
  music_url        text,
  video_url        text,
  file_size        bigint,
  thumbnail_url    text,
  error            text,
  paid_via         text NOT NULL CHECK (paid_via IN ('pro','ad')),
  ad_view_id       uuid REFERENCES ad_views(id) ON DELETE SET NULL,
  revenue_ngn      numeric(12,2) NOT NULL DEFAULT 0,
  worker_id        text,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS renders_queue_idx ON renders(status, created_at);
CREATE INDEX IF NOT EXISTS renders_user_idx ON renders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payouts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_ngn   numeric(12,2) NOT NULL,
  status       text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','paid','failed')),
  reference    text NOT NULL UNIQUE,
  provider     text NOT NULL,
  bank_name    text,
  account_number text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  paid_at      timestamptz
);

CREATE TABLE IF NOT EXISTS royalties (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  render_id   uuid NOT NULL UNIQUE REFERENCES renders(id) ON DELETE CASCADE,
  style_id    uuid REFERENCES styles(id) ON DELETE SET NULL,
  amount      numeric(12,2) NOT NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  payout_id   uuid REFERENCES payouts(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS royalties_creator_idx ON royalties(creator_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      numeric(12,2) NOT NULL,
  type        text NOT NULL DEFAULT 'subscription',
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  reference   text NOT NULL UNIQUE,
  provider    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  paid_at     timestamptz
);

-- ---- v2: images placed by the AI, voiceover scripts and audio ----
ALTER TABLE assets   ADD COLUMN IF NOT EXISTS role text;                 -- logo | photo | music | voice
ALTER TABLE assets   ADD COLUMN IF NOT EXISTS width integer;
ALTER TABLE assets   ADD COLUMN IF NOT EXISTS height integer;
ALTER TABLE assets   ADD COLUMN IF NOT EXISTS has_alpha boolean;
ALTER TABLE assets   ADD COLUMN IF NOT EXISTS duration_seconds numeric(8,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS voice_url text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS voice_duration numeric(8,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS voice_source text;          -- upload | gemini
ALTER TABLE projects ADD COLUMN IF NOT EXISTS fit_to_voice boolean NOT NULL DEFAULT false;
ALTER TABLE renders  ADD COLUMN IF NOT EXISTS voice_url text;
ALTER TABLE renders  ADD COLUMN IF NOT EXISTS time_scale numeric(6,4) NOT NULL DEFAULT 1;

-- ---- v3: guided question flow (answers saved once, never asked twice) ----
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief_json jsonb;

-- ---- v4: motion-graphics sound effects (on by default, per video) ----
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sfx_on boolean NOT NULL DEFAULT true;
ALTER TABLE renders  ADD COLUMN IF NOT EXISTS sfx_on boolean NOT NULL DEFAULT true;

ALTER TABLE assets   ADD COLUMN IF NOT EXISTS is_light boolean;   -- light logo (needs a dark background)

-- Uploaded files kept in the database (used on Vercel, where there is no lasting disk and no Supabase Storage key).
CREATE TABLE IF NOT EXISTS files (
  key          text PRIMARY KEY,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  data         bytea NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Supabase publishes tables in "public" through its REST API. The app connects as the database owner
-- (which bypasses row level security), so switching RLS on with no policies keeps that API closed.
ALTER TABLE users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE styles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_views  ENABLE ROW LEVEL SECURITY;
ALTER TABLE renders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE files     ENABLE ROW LEVEL SECURITY;

-- ---- v5: background video making + phone notifications ----
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gen_state text;            -- working | done | failed
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gen_message text;          -- what the AI is doing right now
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gen_error text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gen_started_at timestamptz;
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint    text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keys        jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ---- v6: MP4s made by GitHub Actions (Vercel has no Chrome); the file comes back in pieces ----
ALTER TABLE renders ADD COLUMN IF NOT EXISTS job_token text;
ALTER TABLE renders ADD COLUMN IF NOT EXISTS chunk_count integer;
ALTER TABLE renders ADD COLUMN IF NOT EXISTS chunk_size integer;
