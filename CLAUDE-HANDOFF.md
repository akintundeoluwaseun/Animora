# Animora: changes from 20–21 October (handoff, update 2)

Unzip this into the root of the Animora repository and replace files when asked.
Every path below is relative to the repository root.

## What to tell Claude in the new chat
"I unzipped the Animora changes into my project folder. Read CLAUDE-HANDOFF.md, check the
changed files build and run (npm run build, start the server, make one 9:16 video, one flyer),
fix anything that breaks, then commit and push."

## What changed

### New: premium motion library (vertical videos)
- `server/ai/motion/browser/pieces.js`   – 12 scene pieces, 7 transitions, backgrounds, camera moves, grain/vignette, the sequence builder (`PIECE_SEQUENCE`)
- `server/ai/motion/browser/atoms.js`    – the `title` scene: 25 text entrances, 10 layouts, 11 key-word highlights, 10 more backgrounds, 8 more transitions
- `server/ai/motion/browser/pieces2.js`  – 12 more scene pieces (stat, review, tiles, countdown, map pin, before/after, phone, type wall, logo draw, split slam, cinematic photo, price compare)
- `server/ai/motion/browser/premium.js`  – After Effects-style shape accents, 11 premium text entrances, 3 transitions, 4 pieces (shape intro, light rise, word stack, glass card)
- `server/ai/pieces/index.js`            – the engine: picks pieces from the business's facts, seeds the variations (every business and every Regenerate differs), builds the page, and handles plain-words edits
- `server/ai/index.js`                   – 9:16 videos now use the Pieces engine first, then fall back to Motion. Set `ANIMORA_ENGINE=motion` to switch back.
- Sound: only the app's own `assets/sfx` (whoosh, pop, tick, chime, click), kept soft; the heavy "impact" is never used.
- `docs/motion-library.html`             – the 1,149-demo gallery with the Template studio (open in a browser; tap a demo for sound)

### New: eight signature templates (After Effects-style recipes)
- `server/ai/motion/browser/signature.js` (new) – Type Reactor (kinetic type), Luxury Product, Futuristic HUD, Liquid Chrome, Sports Hype, Swiss Editorial, Music Visualizer, Cinematic Logo. Each is a recipe of its own beats, transitions, look and sound profile. They work at 9:16, 16:9, 1:1 (and 4:5), in 6, 15 or 30 seconds. Controls: intensity (elegant / aggressive / mechanical / fluid), sound (beat / cinematic / ambient / none, library sounds only), quality (preview / premium / max). Entry point: `TEMPLATE_FILM(cfg)`.
- `server/ai/motion/browser/pieces.js` – scenes can set their own length (`data.dur`), background and camera; intensity and quality reach every piece
- `server/ai/pieces/index.js` – `templateFilm()`: when the brief has a template, the film is built from it (all sizes); plain-words edits work on template films too ("faster", "red", "30 seconds", new words)
- `server/ai/brief.js` – new brief fields: `template`, `intensity`, `soundStyle`, `quality`
- `server/ai/index.js` – template briefs use the Pieces engine at every size
- `web/src/pages/Plan.jsx` – two new questions after the style: pick a signature template (or "Mix my own film"), then how it should move. The scene picker is skipped when a template is chosen.
- `mt/library.mjs` – builds `docs/motion-library.html` (`node mt/library.mjs`); the gallery now opens with a Template studio and 112 template demos (1,149 demos in all). It needs the sample photos and sounds in `mt/lib/` (not included; any jpg/mp3 with those names works).

### Flyers
- `server/ai/flyer2.js` (new) – 9 flyer layouts (poster, price burst, event ticket, menu board, full photo, diagonal, collage, services, hiring) using each style's fonts and backgrounds
- `server/ai/flyer.js`  – chooses the layout from the flyer type / offer / date / photos; old flyers still open and edit

### Style demos and looks
- `server/ai/motion/looks.js` (new), `motion.js`, `motion.css`, `page.js`, `compose.js`, `director.js` – per-style fonts, text effects, background worlds
- `assets/styles/*` – 22 new demo videos, posters and pages; `server/db/seed.js` bumps STYLE_ASSETS_VERSION to 7 so they refresh

### App and navigation
- `web/src/components/Shell.jsx`, `web/src/main.jsx`, `web/src/pages/NewProject.jsx` (new) – one way in: `/new/video` and `/new/flyer`; same menu on every signed-in page; project top bar with back button, name and steps
- `web/src/pages/Home.jsx` – "Make a video" and "Make a flyer" side by side
- `web/src/pages/Plan.jsx`, `Studio.jsx`, `Render.jsx`, `Dashboard.jsx` – kind banner + switch on the first question, video tile menu (Generate, Generate & download, Delete), auto-download, full screen fixes
- `web/src/components/Preview.jsx` – full screen starts inside the tap and sits above everything
- `web/src/pages/Pricing.jsx`, `Auth.jsx`, `Landing.jsx`, `Checkout.jsx`, `components/ui.jsx` – creator sign-up removed; links go to `/new/video`
- `web/src/styles.css`

### Rendering and expired videos
- `server/routes/renderJobs.js`, `projects.js`, `renders.js` – an expired MP4 shows nothing (no "rendered", no notice)
- `scripts/render-job.js` – faster jobs (parallel sound + thumbnail)
- `.github/workflows/render.yml` – faster render workflow (replace the file by hand if your editor protects it)

## After unzipping
1. `npm install` (no new packages), then `npm run build`
2. Restart the server
3. Make one 9:16 video, one 16:9 video with a signature template, and one flyer to check
4. Commit and push
