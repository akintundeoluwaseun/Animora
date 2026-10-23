# Animora

**Motion-design video ads and flyers for small businesses, directed by AI and made in minutes.**

A business owner answers a few questions (name, what they sell, their message, their pictures). Animora plans
every shot, shows a live preview, takes changes in plain words ("make the text bigger", "use red", "30 seconds")
and gives back an MP4 for WhatsApp, TikTok, Instagram or YouTube. It also designs flyers to post or print.

```
 Questions (chat)  ──>  Story engine: look, scenes, music on the beat  ──>  Live preview  ──>  Edit in plain words
                                                                                                    │
     Download (kept 5 minutes, re-make is free)  <──  MP4 recorded on GitHub Actions  <──  "Generate Video"
```

---

## What it does

- **Chat, Edit, Video.** Every project has three pages and you can move between them at any time with the
  tabs at the top: *Chat* (the questions and your answers), *Edit* (preview + changes in plain words, with undo)
  and *Video* (make and download the MP4).
- **Story engine** (`server/ai/story/`, `server/ai/motion/browser/story.js`). Builds each video from the
  business's own words and pictures. Nothing is invented: no prices, phone numbers, addresses or claims the owner
  didn't give.
  - 6 looks: Editorial, Noir, Bold, Fresh, Tech, Clean.
  - Scenes include an opening hook, a magazine cover, photo-in-type, stacked headlines, framed and full-screen photos,
    picture-in-picture, a product stepping out of its frame, a phone mock-up, a WhatsApp-style chat, features, an offer,
    prices, where-and-when, a statement and the closing card.
  - More than ten transitions (wipe, iris, portal, liquid, glitch and others), drawn underlines, shape morphs, light sweeps and
    gentle camera moves (GSAP with MorphSVG and MotionPath).
  - Every business and every *Regenerate* gets a different, seeded video.
  - **Every size works:** 9:16, 4:5, 1:1 and 16:9. Text is fitted to the frame, and photos are laid out by their
    real shape (a wide photo is never cropped to a sliver in a tall video).
- **Sound.** 24 royalty-free (CC0) music tracks, four per look, with the cuts snapped to the beat, plus soft sound effects from
  `assets/sfx` (never a heavy "impact"). Choices: music + effects (default), effects only, your own music, or no sound.
  Credits: `assets/CREDITS-SOUND.md`.
- **Flyers** (`server/ai/flyer.js`, `server/ai/flyer2.js`): nine layouts (poster, price burst, event ticket, menu
  board, full photo, diagonal, collage, services, hiring), downloaded as pictures.
- **Light and dark mode**, a phone-friendly layout with a bottom bar, and an **Android app** (`mobile/`, see its README).
- **Owner dashboard** at `/admin` (needs `ADMIN_KEY`): people, videos, flyers, MP4s, money, failures, the last 30 days,
  and **database space** with a *Free up space now* button.

## Nothing is stored for long

MP4s are big, so Animora doesn't keep them:

- An MP4 is **deleted 5 minutes after it's ready** (`MP4_KEEP_MINUTES`). A download that is still running is never
  cut off. The video page shows a countdown.
- The video's design stays, so **making the same MP4 again is free** (no credit, no ad). An edited video counts as new.
- Pieces from failed or cancelled renders, old covers, replaced narration and removed pictures are deleted
  automatically. Deleting a project deletes all its files.
- The owner dashboard shows what is using the database and can hand the space back.

---

## Run it on your computer

Needs **Node.js 20+** and **FFmpeg** (`ffmpeg -version` should work).

```bash
npm install
cp .env.example .env        # optional: everything works without keys
npm run build               # build the website
npm start                   # http://localhost:3000
```

For development with hot reload: `npm run dev` and open http://localhost:5173.

Without keys Animora still works: a built-in practice AI instead of Gemini, an embedded Postgres (PGlite) in
`data/pglite` instead of `DATABASE_URL`, and local files in `data/storage`. MP4s are recorded on your own machine.

---

## Deploy (Vercel + GitHub Actions)

`vercel.json` is ready: import the repository at vercel.com/new and deploy. The website and API run on Vercel.
Vercel can't run Chrome + FFmpeg for minutes, so each MP4 is recorded by a GitHub Actions run
(`.github/workflows/render.yml`) that the site starts by itself and that sends the MP4 back in pieces.

Set these in Vercel → Project → Settings → Environment Variables, then redeploy:

| Name | What it is |
|---|---|
| `DATABASE_URL` | **Required.** Your Postgres connection string (Neon or Supabase pooler). Tables are created on start. |
| `GEMINI_API_KEY` | Google Gemini key (https://aistudio.google.com/apikey). Without it the practice AI is used. |
| `AUTH_SECRET` | Any long random string. |
| `GH_DISPATCH_TOKEN` | A GitHub token that can run Actions on this repository (fine-grained token, *Actions: read and write*). Turns MP4 export on. |
| `GH_REPO` / `GH_REF` | Optional. The repository and branch for renders; Vercel fills them in by default. |
| `ADMIN_KEY` | Any secret word. Turns on the owner dashboard at `/admin`. |
| `MP4_KEEP_MINUTES` | Optional. How long an MP4 is kept (default 5). |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` or `FLW_SECRET_KEY` | Optional. Turns on paid video packs. |
| `AUTH` | `off` (default: no sign-in) or `on` (accounts). |

**Keep the database small:** if you use Neon, set its history retention (restore window) to the lowest value:
Vercel → Storage → your database → Open in Neon → Settings.

**Other hosting:** the `Dockerfile` runs the website, API and render worker in one container (Railway, Render.com or a
VPS); give it at least 2 vCPU / 2 GB RAM.

---

## Project layout

```
server/
  index.js            Express app: API, files, website
  config.js           every setting, read from the environment
  billing.js          credits, plans, free re-makes
  storage.js          files (database, Supabase or local disk) and their clean-up
  ai/story/           the Story engine composer (looks, beats, timing, music)
  ai/motion/browser/  the in-browser film runtime (story.js) and the motion library
  ai/pieces/          builds each film from the business's facts, plain-words edits
  ai/flyer*.js        flyers
  engine/             recorder (Chrome + FFmpeg), sound mixing, Gemini client
  routes/             projects, renders, render jobs (GitHub), money, admin
  db/schema.sql       tables (created and updated on start)
web/src/              React website: Home, Plan (chat), Studio (edit), Render (video), Dashboard, Admin
assets/               music, sound effects, style previews
mobile/               Android app (Capacitor)
scripts/              render job, tests, tools
.github/workflows/    render.yml (MP4s), make-video.yml, inspect-video.yml
docs/motion-library.html  gallery of the motion library
```

## Tests

```bash
npm test          # engine, Gemini paths (stubbed), API flow, media
npm run test:ui   # clicks through the site in headless Chrome (server must be running)
```

---

Designed and developed by **Oluwaseun Joshua**.
