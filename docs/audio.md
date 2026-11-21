# Animora audio: how sound, voice and music are timed

## Phase 1: what was wrong (audit, 26 Oct 2026)

Traced through `server/ai/premium/index.js` (page code), `server/engine/renderer.js` (recording),
`server/engine/sfx.js` + `master.js` (mixing), `scripts/render-job.js` (render server) and
`web/src/components/Preview.jsx` (live preview).

1. **Sound picked from a fixed list, not from what moved.** Early premium pages played one generic sound per
   "something appeared" with a half-second gap, so most sounds did not match the action on screen.
2. **Long films froze.** The renderer recorded the planned length (e.g. 30 s) even when the film ended sooner, so the
   last frame sat still for seconds. Premium films now render at their own length.
3. **Dead air.** Templates have holds where nothing moves; empty padding tweens (`tl.to({}, …)`) were counted as
   motion, so some holds survived. They are now ignored and every still stretch over 1.2 s is fast-forwarded.
4. **Preview played sounds late.** Sounds fired when the playhead message arrived (every animation frame), up to a
   frame late and dropped on seeks. They are now scheduled on the audio clock 250 ms ahead.
5. **Mixer details.** No fades (clicks on cut sounds), a 96 kbps mono AAC, `-shortest` deciding the length, peaks up to
   -1.3 dBFS. Now: 2 ms fade-ins, fade-outs on trimmed sounds, 48 kHz stereo AAC 160 kbps, exact length, true peak
   under -4 dBFS.
6. **Element positions measured at the wrong scale.** The renderer shrinks the page to 0.667x after load; sizes and
   positions are now measured against the film's own frame, so a centred logo is still seen as centred.

## Phase 2–4: the timeline model and sound selection

Everything runs on **the film's own timeline** (the paused GSAP timeline the renderer seeks frame by frame).
`server/ai/premium/browser/sound.js` runs inside the film page:

- `events(tl)` reads every tween of the real timeline and makes **visual events in integer milliseconds**:
  `move` (with distance and speed), `appear` (text / headline / card / image / logo / ui), `slam`, `zoom`,
  `reveal` (mask), `typing`, `word` (staggered words, each at its own reveal time), `item` (list rows),
  `cut` (picture swaps), `exit`, plus `scene` (added by films). Staggered tweens become one event per target.
  Each event has a **stable id** (`kind@element#n`), so retiming an animation moves its sound and keeps its settings.
- Times are then moved onto the film's clock (dead air removed, scenes joined) by `remapEvents`.
- `choose(events)` asks for a role per event (e.g. a fast slide wants a short directional whoosh, a big title landing
  wants a deep impact) and **scores every sound in the registry**: role, length vs the motion, intensity vs the
  element's size and speed, attack (sharp/soft), tone, the hand-picked kit first, minus repetition. A seeded random
  tie-break makes the same project sound the same every time; "Pick different sounds" changes the seed.
- Restraint: per-role cooldowns, word runs get every 2nd word (Fewer: every 3rd, More: all), one sound per frame
  (the more important one), nothing over the closing hit, things leaving the screen are silent unless they travel.
- Alignment: whooshes are placed so their loudest point lands just before the move's fastest moment
  (`attack` of the sound file, minus a frame); hits land on the frame; a riser **ends** on the final reveal.
- Editor overrides live in the film (`window.ANIMORA_PREMIUM.audio`): `sfxGain`, `density`, `mute[]`, `swap{id: key}`,
  `seed`, `music`, `musicOffset`, `musicGain`. The voice settings are in `.voice` (voice id, captions on/off).

## The sound registry

`scripts/build-sfx-registry.py` → `assets/sfx/registry.json`. Every WAV is decoded and measured (duration, useful
length, peak, loudness, attack, crest, brightness) and gets a role, tags, intensity, transient and tone. Licence and
source come from `assets/CREDITS-SOUND.md` and `assets/sfx/CREDITS-motion-kit.md`; a sound without a recorded licence
is not used (today: `glitch-big`). 161 of 162 sounds are usable: CC0 (Kenney, Freesound via
github.com/Barty-Bart/motion-graphics, alvana-audio, Woven SFX) and Animora's own synthesised sounds.

## Phase 5: rendering and mixing

The page publishes `window.__sfx` (`{t, k, v, len?, fo?, id, kind, label, at, alts, muted?}`). The renderer reads it
after the timeline is ready; `sfx.js` places each sound **sample-exact** at `round(t × 44100)`, loops typing to
`len`, lets long tails ring only `fo` ms, ducks effects and music ~7 dB under the voice, masters to about -16 LUFS with
true peaks under -4 dBFS, and writes 48 kHz stereo AAC exactly as long as the video.

**Music**: `scripts/build-music-beats.py` makes a beat grid per library track (librosa), checked against the kick
drum below 120 Hz (shifted by half a beat when librosa locked onto the off-beat); grids that don't sit on the kick
(> 75 ms) are not used. When a song is chosen in the editor, the song's **start point** is chosen so the film's big
moments land on beats; the animation is never moved. The preview plays the song from the same point.

**Voice** (render server): `scripts/voice.py` (Kokoro-82M) voices the lines first, writes the exact word times, and
the render job puts them into the page (`window.__captions`) before recording, so captions and voice match.

## Phase 8: the editor

"Sound & voice" tab (`web/src/components/SoundPanel.jsx`): voice library (15 voices, each with a sample in
`web/public/voices/`), captions on/off, effects volume, Fewer/Normal/More, "Pick different sounds", a timeline with
a mark for every sound on the moment that made it (tap: hear the moment, see the waveform, swap for another fitting
sound, switch off), music with beat-aligned start and volume. Every change is a new version (Undo works).

## Phase 6: tests

`node scripts/test-audio.js` (needs Chrome + FFmpeg) — real page code, real browser, real mixer:
headline whoosh; staggered words; logo riser + impact; same-frame dedupe; no clipping with 12 overlapping hits;
music aligned to a scene change; retimed animation (same id, sound moves, mute survives); missing asset; exact
length without music; ducking under voice; a full render whose sounds are found in the exported AAC by
cross-correlation with the original files.

## Known limits

- The live preview has no voice (it is made on the render server); it shows the captions with estimated timing.
- Beat alignment only for library songs with a reliable grid; an owner's own uploaded song plays from its start.
- Sound selection is rule-based scoring on measured features, not listening; the editor lets people swap any choice.
- Old engines (pieces/motion/cinema, used for square and 4:5 videos) keep their own hand-written sound cues.
