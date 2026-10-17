# AdFlash

**Plan a video ad by chatting with AI, preview it live, and download an MP4 rendered by our own engine.**
Built for the Access Bank *Youth Tech Forge* (Africa Fintech Foundry), Track 03: Creative Technology.

```
 Chat (Gemini)  ──>  Plan (scene list)  ──>  Code (HTML + GSAP)  ──>  Live preview + edit in plain words
                                                                                │
           Download MP4  <──  FFmpeg H.264  <──  frame-by-frame capture  <──  AdFlash render engine (ours)
```

- **External:** only Google Gemini (planning chat + writing animation code).
- **Ours:** everything else. The render engine (headless Chrome + FFmpeg + GSAP running on our server), the
  template engine, validation and auto-repair of AI code, plans and ads, royalties and payouts.

---

## 0. Test mode: no sign-in (current setting)

`AUTH=off` in `.env` (the default right now): no sign-in, no accounts, no ads, no plan limits. Open
http://localhost:3000 and you go straight to picking a style and making a video (15 seconds to 5 minutes).
Set `AUTH=on` later to bring back sign-up/log-in, Free vs Pro, the ad gate and the demo accounts below.

## Images and narration script

**Your logo and photos.** Upload them in the chat (📎) or with **Add logo / Add photos**. AdFlash records each image's
size and whether it has a transparent background, and the AI *sees* the pictures (Gemini). Before planning, it always
asks about images, then decides per scene where each one goes: logo in the opening and the final call to action
(never cropped; on a clean card if it has a solid background), product photos as the hero of the offer scenes or as a
full-screen background with a dark overlay, sized to each photo's shape. The plan shows 🖼 for each placement.

**Narration script.** Before planning it asks: *1) I have my own script, 2) write one for me, 3) no script.*
With a script, every scene gets its line, and each scene is timed to how long the line takes to say (about 2.3 words
per second), so the visual pacing follows the narration. Your own words are kept exactly. Captions appear on screen.
After **Generate Code**, the **Script** tab gives you:
- the script per scene with timings,
- **Plain text** ready for ElevenLabs, CapCut, TikTok, Google AI Studio (₦15,000 becomes "fifteen thousand naira";
  phone numbers are read digit by digit),
- **SSML** with pauses for Google Cloud / Azure / Amazon Polly, and a **timed script** for recording yourself,
- copy and text-file download controls for each script format.

**Every MP4 is silent.** AdFlash does not add narration or music to the video; use the script separately in
ElevenLabs or another audio generator if you want a soundtrack.

## 1. Run it (5 minutes)

Needs **Node.js 20+** and **FFmpeg** (`ffmpeg -version` should work).

```bash
npm install
npx puppeteer browsers install chrome-headless-shell   # fastest render mode
# .env is included and set up: your Gemini key, offline data (built-in database + local files), test payments
npm run check:gemini                                   # confirms the Gemini key works
npm run build                                          # build the website
npm start                                              # http://localhost:3000
```

On first start AdFlash creates its database, the 22 starter styles, 2 demo ads and these accounts
(password `demo1234`):

| Email | Account |
|---|---|
| `demo@adflash.ng` | Business, Free plan |
| `pro@adflash.ng` | Business, Pro with **29 of 30** videos used (shows the limit → ads switch-over) |
| `creator@adflash.ng` | Creator "Tunde Motion": owns the starter styles, 60 videos of royalty history, ₦1,184 ready to withdraw |

For development with hot reload: `npm run dev` and open http://localhost:5173.

Royalty history, the sample project and the creator balance are **demo data** (turn off with `SEED_DEMO_HISTORY=false`).

### Works with no keys at all
| Without… | AdFlash uses… |
|---|---|
| `GEMINI_API_KEY` | the built-in **practice AI**: a scripted planner + our template engine (edits: text size, colours, speed) |
| `DATABASE_URL` | an embedded Postgres (PGlite) in `data/pglite`, same SQL as Supabase |
| `SUPABASE_URL` / key | local disk storage in `data/storage` |
| Access Bank keys | the **sandbox** payment provider (no real money) |

The practice AI is also the safety net in production: if Gemini is down or keeps writing broken code,
users get a working video from the template engine instead of an error.

---

## 2. Add your keys

Put them in `.env` (see `.env.example` for every option), then restart.

**Gemini (most important):** your key is already in `.env`. Check it works with `npm run check:gemini`; it says in
plain words whether the key is accepted and which models answer. If it says the key is rejected, make a new one at
https://aistudio.google.com/apikey and replace `GEMINI_API_KEY=...` in `.env`.
If a model isn't available on your key, AdFlash automatically switches to the next one (e.g. `gemini-2.5-pro`).
The top bar's "Practice mode" notice disappears when it's active. Models default to
`gemini-flash-latest` (chat) and `gemini-pro-latest` (code); override with `GEMINI_CHAT_MODEL` / `GEMINI_CODE_MODEL`.

**Supabase:** create a project, then
- `DATABASE_URL` = Project Settings → Database → Connection string (URI, *Session pooler*).
  Tables are created automatically on start (`server/db/schema.sql`).
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` = Project Settings → API. A public bucket `adflash` is created
  automatically for uploads and MP4s. (Supabase's free plan limits files to 50 MB; a 5-minute 1080p video is usually 30–60 MB.
  Raise the limit in Storage settings on a paid plan if needed.)

**Access Bank (Wallet-as-a-Service):** ask the Foundry (AFF@ACCESSBANKPLC.com) for sandbox credentials, then
```
PAYMENT_PROVIDER=accessbank
ACCESSBANK_AUTHORIZATION_KEY=...   ACCESSBANK_SUBSCRIPTION_KEY=...   ACCESSBANK_MERCHANT_ID=...
ACCESSBANK_PAYOUT_WALLET=...       # AdFlash wallet that pays creators
```
The adapter (`server/payments.js`) follows the public WaaS docs: `POST /waas/Client/authenticate`,
`debitWallet` (Pro subscription), `nameEnquiry` (verify creator bank), `wallet2OtherBank` (payouts) and
`transactionStatusCheck`. **It has not been run against the live sandbox yet** (no credentials). Test it first;
the field names may need small adjustments.

---

## 3. Deploy

Rendering takes minutes, so the app needs a real server, not serverless. Easiest: **one Docker container**
(website + API + render worker) on Railway, Render.com or a VPS.

```bash
docker build -t adflash .
docker run -p 3000:3000 -v adflash-data:/data --env-file .env adflash
```

- **Railway / Render.com:** "Deploy from repo" → it detects the Dockerfile. Set the env vars, set
  `PUBLIC_BASE_URL` to the public URL, and pick at least **2 vCPU / 2 GB RAM** (4 vCPU renders twice as fast).
- With Supabase set, the container is stateless. Without it, mount a volume at `/data`.
- More render capacity: run extra workers on other machines with `npm run worker` (same `DATABASE_URL`,
  Supabase storage required) and set `RUN_WORKER=false` on the web server if you like.

Render speed (measured on 2 vCPU, scales with cores):

| Video | 2 vCPU | 4 vCPU (est.) |
|---|---|---|
| 30 s | ~1.5 min | ~45 s |
| 1 min | ~3 min | ~1.5 min |
| 5 min | ~15 min | ~8 min |

---

## 4. Tests

```bash
npm test          # engine + Gemini paths (stubbed) + full business flow API test
npm run test:ui   # clicks through the whole site in headless Chrome, saves screenshots (server must be running)
```

- `scripts/test-engine.js` renders a 15 s video twice and checks: H.264/yuv420p, 1080×1920, exactly 450 frames,
  every frame at the right time (±½ frame), never backwards, identical output with 2 vs 3 parallel workers
  (single-worker comparison on Windows, where multiple Chromium capture pages are less reliable).
- `scripts/test-gemini-stub.js` checks the real Gemini code paths with a fake Gemini: plan extraction,
  auto-repair of broken code, style rules in prompts, fallback to the template engine, edits.
- `scripts/test-api.js` (34 checks): sign-up → chat → plan → generate → edit → undo → ad gate (can't skip, one ad =
  one video) → render → MP4 download; free 60 s cap; Pro payment (success + failure); Pro renders ad-free;
  cancel refunds; 30-video limit → ads; monthly reset; creator gets exactly 30%; bank name enquiry; payout.

---

## 5. How it works

### Guided questions + AI director (v4)
- **New video starts with questions, not a style grid.** One question at a time, like a chat: business name, what
  you do, goal, main message (AI-suggested options), selling points (pick up to 3), products/prices, call to action,
  contact, format (portrait / landscape / square), length, pictures (up to 5, upload or paste with Ctrl+V), colours
  (style / match my logo / your own), style (or let AdFlash choose), narration script, and finally any special
  instructions. Every answer is saved once (`projects.brief_json`), so nothing is asked twice; "Change" on any
  answer jumps back to it.
- **AI director.** Gemini no longer writes a whole HTML file (slow and often rejected). It directs the video shot
  by shot as a small JSON list using the motion engine's shot vocabulary (`server/ai/director.js`), following your
  special instructions (e.g. "zoom into the logo" -> a `logo` shot with a `dive` cut into it). Edits work the same
  way: Gemini rewrites the shot list (plus colours, text size, speed). Set `AI_CODE_MODE=html` for the old mode.
- **Reliable Gemini.** A busy (429/5xx) or missing model falls through to the next one in the chain, so an
  overloaded model no longer sends you to the backup arrangement.
- **Landscape.** 16:9 layouts are scaled up to fill the wide frame.
- **Faster renders.** Motion blur is switched on only during cuts, background layers are composited once, no extra
  paint wait per frame, and capture runs in parallel browsers (about 3x faster).

### Motion engine v3 (`server/ai/templates.js` + `server/ai/themes.js` + `server/ai/runtime/motion.js`)
- **Pro motion-design shots, not slides.** The server splits every plan scene into fast 1-2 s *beats* (punch word,
  then the rest, a price, a list, the CTA) and picks a different shot for each: zooming punch words with outline
  echoes, kinetic stacks, type-on in a selection box, brand reveal, logo-to-notification morph, orbiting chips,
  odometer price inside a drawing ring, dot -> pill -> UI card morph, pill stacks, scroll-wheel lists, flow cards
  with light lines, icon grids, split screens, 3D product hero, phone mockup, stat slab, and a CTA lockup with a
  cursor that clicks the button. Usage limits per shot stop the video from following a pattern.
- **Cuts:** motion-blur whips (SVG feGaussianBlur), zoom-throughs, collapse-to-a-dot morphs, glowing line draws,
  two-tone wipes and flash cuts with a camera punch. Only one beat is on screen at a time.
- **Premium launch styles** (Studio White, Midnight Glow, Fintech Blue, Health Pulse, Graphite Pro): small clean type,
  sentences that build word by word, an app icon opening into a widget card, watch-style widget tiles with filling
  rings, a glowing card on an isometric platform that flips into a stat tile, a logo + ticker list, stacked buttons, a
  chat that types/sends/replies, a photo collage ring; cuts by blur-focus, a camera dive into the key word and a
  swooping ribbon; the whole frame drifts slowly.
- **17 classic starter styles** (Naija Bold, Gold Luxe, Clean Pro, Neon Nights, Street Hype, Owambe Party, Fresh Market,
  Tech Pulse, Glory Light, Beauty Bloom, Retro Pop, Sports Blitz, Prime Estate, Kiddies Fun, Mono Editorial,
  Afro Vibes, Ocean Breeze), each a theme with fonts, colours, ambient layers, favourite shots and cuts. Add one in
  `themes.js` + `server/db/starter.js`, then `node scripts/build-demo-assets.js` for its preview.
- The plan becomes JSON (`window.ADFLASH_DATA`) and the browser runtime builds the DOM and one paused GSAP timeline.
  Text auto-fits the safe area after fonts load; offline edits (bigger/smaller, colours, speed) still work.

### Render engine (`server/engine/renderer.js`)
1. Gemini must put **all** motion on one paused GSAP timeline exposed as `window.__timeline` (rules in
   `server/engine/prompts.js`, enforced by `server/engine/validate.js` and a browser pre-flight).
2. Headless Chrome opens the page at the exact canvas size (1080×1920, 1080×1080 or 1920×1080).
3. For each frame: `seek(frame / 30)` → capture. In `beginframe` mode Chrome paints and captures in one call.
4. Frames stream into FFmpeg → H.264, yuv420p, `+faststart`. Long videos are split into segments rendered in
   parallel and joined without re-encoding. MP4 exports contain no audio streams.
5. Determinism: seeded `Math.random`, stray tweens frozen, CSS animations driven from the same clock, fonts and
   images awaited (with a cap so a blocked font can't hang a render).

The preview page drives the iframe the same way (seek-based), so what users scrub is what they get.
Windows defaults to one render worker for Chromium stability; set `ADFLASH_WORKERS` to override. Other platforms
default to up to four workers.

### AI layer (`server/ai/`, `server/engine/gemini.js`)
- **Planner** chats, respects plan limits (Free ≤ 60 s), outputs a validated JSON scene list.
- **Code writer** gets the plan + the chosen creator style's rules and example code.
- Every result goes through static checks + a headless browser pre-flight; failures go back to Gemini with
  the exact problems (up to 2 repair rounds), then fall back to the template engine.
- **Edit by prompt** returns the full updated file; every version is kept for **Undo**.

### Business rules (`server/billing.js`)
| | Free | Pro (₦5,000/month) |
|---|---|---|
| Ads | 15 s ad before each video (server-timed, can't be skipped) | none for 30 videos, then 1 ad per video |
| Length | 15–60 s | 15 s – 5 min |
| Counter | resets on the 1st of each month | same |

Creator royalty = **30% of the revenue each video earns**: an ad-supported video earns what the advertiser paid
for that ad view (₦40 demo rate → ₦12 to the creator); a Pro video earns ₦5,000 ÷ 30 = ₦166.67 (→ ₦50).
Credits are refunded if a render fails or is cancelled. All values are configurable in `.env`.

### Project layout
```
server/
  index.js          Express app: API, files, website
  worker.js         render queue worker (DB-backed, FOR UPDATE SKIP LOCKED)
  billing.js        plans, ad gate, royalties
  payments.js       sandbox + Access Bank WaaS adapters
  ai/               AI service, practice planner, template engine
  engine/           renderer, prompts, validator, Gemini client
  routes/           auth, projects (chat/generate/edit), renders + ads, money (pricing/checkout/creators)
  db/               schema.sql, seed, starter styles + demo ads
web/src/            React pages: Landing, Auth, Dashboard, Plan, Studio, Render, Pricing, Checkout, Creator
assets/             pre-rendered demo videos (style previews, ads, samples)
samples/            reference animation + example plan
scripts/            tests, UI walkthrough, demo asset builder, dev runner
```

### Database
`users, projects, assets, styles, renders, ads, ad_views, royalties, payouts, payments`; see
`server/db/schema.sql`. It extends the plan's starting schema with assets, ads, payouts, poster/thumbnail URLs and
code version history.

---

## 6. Live demo script (about 4 minutes)

1. **Landing page:** the problem in one line; style previews made by creators.
2. Log in as `demo@adflash.ng` → **New video** → pick *Naija Bold*.
3. **Chat:** "Kemi Cakes, we bake birthday cakes" → prices → phone → "pink and gold, WhatsApp status, 30 seconds" → "yes".
4. **Generate Code** → the ad plays in the phone. Say *"change the background to purple"* → it updates. Show **Code** tab.
5. **Generate Video** → the 15-second ad gate → live progress (frames, ETA) → **Download MP4**. Play it on a phone.
6. Log in as `pro@adflash.ng` (29/30 used): first video is ad-free, the next asks for an ad.
7. Log in as `creator@adflash.ng`: royalties per video, styles used, withdraw to bank.

Tip: keep a pre-rendered 1-minute and 5-minute video ready in case the venue's server is slow.
`assets/samples/` has ready-made sample ads.

---

## 7. Pitch deck
The 11-slide deck was made in Claude (Slides), and you can present it there or download it as PowerPoint/PDF. Fill in the
bracketed placeholders on the last two slides (`[email]`, `[demo link]`, ad rate confirmation).
To check the Gemini output quality once you have a key: `GEMINI_API_KEY=... node scripts/generate-from-plan.js samples/plan-30s.json output/test.mp4`.

## 8. Not done yet / next
- Access Bank WaaS adapter needs a run against the real sandbox (credentials).
- Gemini prompts are written and stub-tested; tune them with a real key on 10–20 real businesses.
- Real ad network instead of the in-house ad slot; email verification and password reset.
- Pidgin, Yoruba, Hausa and Igbo planning; more creator styles; Ghana and Kenya.
