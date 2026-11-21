// Sound effects mixer: turns the animation's sound cues (window.__sfx: [{ t, k, v }]) into an audio track
// and muxes it into the rendered MP4. Sounds live in assets/sfx (made by scripts/make-sfx.py).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { masterTrack, musicBed } from './master.js';

export const SFX_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/sfx');
export const MUSIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/music');
const SR = 44100;
let bank = null;

// 16-bit mono PCM WAV -> Float32Array
function readWav(file) {
  const b = readFileSync(file);
  let o = 12, data = null, rate = SR;
  while (o + 8 <= b.length) {
    const id = b.toString('ascii', o, o + 4), size = b.readUInt32LE(o + 4);
    if (id === 'fmt ') rate = b.readUInt32LE(o + 12);
    if (id === 'data') { data = b.subarray(o + 8, o + 8 + size); break; }
    o += 8 + size + (size % 2);
  }
  if (!data || rate !== SR) return null;
  const out = new Float32Array(data.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = data.readInt16LE(i * 2) / 32768;
  return out;
}

export function sounds() {
  if (bank) return bank;
  bank = {};
  if (existsSync(SFX_DIR)) for (const f of readdirSync(SFX_DIR)) if (f.endsWith('.wav')) { const w = readWav(path.join(SFX_DIR, f)); if (w) bank[f.slice(0, -4)] = w; }
  // house rule: never a heavy impact; any old request for one gets a soft pop instead
  for (const k of Object.keys(bank)) if (/impact|thud/.test(k) && bank['pop-soft']) bank[k] = bank['pop-soft'];
  return bank;
}

// Decode any audio file/URL to mono 44.1 kHz floats with FFmpeg.
function decode(src) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-i', src, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = []; let err = '';
    p.stdout.on('data', (d) => out.push(d)); p.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
    p.on('error', reject);
    p.on('close', (c) => { if (c) return reject(new Error(`decode: ${err}`)); const b = Buffer.concat(out); resolve(new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4))); });
  });
}
// Music: the owner's own upload, or a CC0 bed from assets/music chosen to suit the film's look.
// library tracks (/music/<name>.mp3) are read from disk; anything else is a URL
const musicSource = (m) => { const u = m?.url || null; return u && /^\/music\/[\w-]+\.mp3$/.test(u) ? path.join(MUSIC_DIR, path.basename(u)) : u; };

/** Mix the cues into a WAV buffer (mono, 44.1 kHz) of `duration` seconds. timeScale stretches cue times. */
export function mixSfx(events, duration, { timeScale = 1, gain = 0.6, music = null, voice = null, musicOffset = 0, musicGain = 0 } = {}) {
  const b = sounds();
  const n = Math.ceil(duration * SR), mix = new Float32Array(n);
  for (const e of events || []) {
    const s = b[e.k]; if (!s) continue;
    if (e.muted || !(Number(e.v) > 0)) continue;                       // switched off in the editor
    const start = Math.round(e.t * timeScale * SR), v = Number(e.v) * gain;   // sample-exact start on the film's clock
    // len: loop the sound to exactly that length (typing under typed text); fo: let it ring only that long (a long tail
    // on a short move); both end with a short fade so nothing cuts with a click. Every sound starts with a 2 ms fade-in.
    const loopLen = Number(e.len) > 0 ? Math.round(Number(e.len) * timeScale * SR) : 0;
    const ringLen = Number(e.fo) > 0 ? Math.min(s.length, Math.round(Number(e.fo) / 1000 * timeScale * SR)) : 0;
    const len = loopLen || ringLen || s.length, fadeOut = loopLen || ringLen ? Math.round(0.06 * SR) : 0, fadeIn = Math.round(0.002 * SR);
    for (let i = 0; i < len && start + i < n; i++) {
      if (start + i < 0) continue;
      const g = Math.min(1, (i + 1) / fadeIn, fadeOut ? (len - i) / fadeOut : 1);
      mix[start + i] += s[i % s.length] * v * g;
    }
  }
  // music (the owner's own) sits under the effects before mastering
  // the music bed sits underneath: looped, faded in and out, about -10 dB at its peak
  if (music?.length) { const bed = musicBed(music, n, SR, events, { timeScale, offset: Math.round(musicOffset * SR), level: -34 + musicGain }); for (let i = 0; i < n; i++) mix[i] += bed[i]; }
  // voice-over on top: effects and music duck about 7 dB while someone is speaking (smoothed so it never pumps)
  if (voice?.length) {
    const win = Math.round(0.05 * SR), env = new Float32Array(n); let acc = 0;
    for (let i = 0; i < n; i++) { const v = i < voice.length ? voice[i] : 0; acc += v * v; if (i >= win) { const o = i - win < voice.length ? voice[i - win] : 0; acc -= o * o; } env[i] = Math.sqrt(Math.max(0, acc) / win); }
    let g = 1; const att = Math.exp(-1 / (0.03 * SR)), rel = Math.exp(-1 / (0.35 * SR));
    for (let i = 0; i < n; i++) { const want = env[i] > 0.02 ? 0.45 : 1; g = want < g ? want + (g - want) * att : want + (g - want) * rel; mix[i] = mix[i] * g + (i < voice.length ? voice[i] * 0.9 : 0); }
  }
  // master: glue, loudness to the social-media level (about -14 LUFS measured; the built-in meter reads ~1.5 dB low), peaks under -1.5 dBFS
  // with music the whole mix goes to the social-media level; effects alone stay gentle (lifting sparse effects to -14 LUFS made them harsh)
  masterTrack(mix, SR, { target: music?.length || voice?.length ? -14.5 : -15 });   // about -16 LUFS on the exported file
  const pcm = Buffer.alloc(44 + n * 2);
  for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i])) * 32767), 44 + i * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + n * 2, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(SR, 24);
  pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(n * 2, 40);
  return pcm;
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', (d) => { err = (err + d).slice(-3000); });
    p.on('error', reject); p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg: ${err}`))));
  });
}

let BEATS = null;
/** The beat grid of a library track (assets/music/beats.json, made by scripts/build-music-beats.py); null if unknown or unreliable. */
export function beatsFor(file) {
  try { BEATS ||= JSON.parse(readFileSync(path.join(MUSIC_DIR, 'beats.json'), 'utf8')); } catch { BEATS = {}; }
  const b = BEATS[path.basename(String(file))];
  return b?.ok && b.kickErrorMs <= 75 && b.beats?.length >= 8 ? b.beats : null;   // a grid that doesn't sit on the kick drum isn't used
}
/** Pick where the song starts so the film's big moments land on beats. Returns { offset (s), errorMs, baseMs }. */
export function alignMusic(beats, events) {
  const keys = (events || []).filter((e) => !e.muted && /impact|transition|sting|whoosh-3|riser/.test(e.k)).map((e) => (/riser/.test(e.k) ? null : e.t)).filter((t) => t != null);
  if (!keys.length) return { offset: 0, errorMs: 0, baseMs: 0 };
  const near = (x) => { let lo = 0, hi = beats.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (beats[m] < x) lo = m; else hi = m; } return Math.min(Math.abs(beats[lo] - x), Math.abs(beats[hi] - x)); };
  const cost = (o) => keys.reduce((a, t) => a + near(t + o), 0) / keys.length;
  const base = cost(0); let best = { offset: 0, err: base };
  // candidate starts: put the first big moment exactly on each of the song's first 32 beats
  for (const b of beats.slice(0, 32)) { const o = b - keys[0]; if (o < 0 || o > 30) continue; const c = cost(o); if (c < best.err - 0.004) best = { offset: o, err: c }; }
  return { offset: best.offset, errorMs: best.err * 1000, baseMs: base * 1000 };
}

/** Write the sound track next to the video and mux it in (video stream copied, AAC audio). */
export async function addSfxToVideo(videoFile, outFile, events, duration, opts = {}) {
  const wav = `${videoFile}.sfx.wav`;
  let music = null;
  const src = musicSource(opts.music);
  if (src) { try { music = await decode(src); } catch (e) { console.warn('[sfx] music skipped:', e.message); } }
  // music on the beat: the song starts at the point where its beats best meet the film's big moments
  // (hits, scene changes, the ending). The animation is never moved; only the song's starting point is chosen.
  let musicOffset = 0;
  if (music?.length && Number.isFinite(Number(opts.music?.offset)) && Number(opts.music.offset) > 0) {
    musicOffset = Number(opts.music.offset);   // chosen in the editor (same start the preview plays)
  } else if (music?.length && src && !/^https?:/.test(src)) {
    const grid = beatsFor(src);
    if (grid) { const a = alignMusic(grid, events); musicOffset = a.offset; console.log(`[sfx] music aligned: start ${a.offset.toFixed(3)} s into the song, beat error ${Math.round(a.errorMs)} ms (was ${Math.round(a.baseMs)} ms)`); }
  }
  let voice = null;
  if (opts.voiceFile) { try { voice = await decode(opts.voiceFile); } catch (e) { console.warn('[sfx] voice skipped:', e.message); } }
  await writeFile(wav, mixSfx(events, duration, { ...opts, music, voice, musicOffset, musicGain: Number(opts.music?.gain) || 0 }));
  // the sound track is exactly as long as the film (no -shortest guessing), resampled once to 48 kHz stereo AAC
  await ffmpeg(['-y', '-loglevel', 'error', '-i', videoFile, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', `apad,atrim=0:${Number(duration).toFixed(3)}`, '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '160k', '-t', Number(duration).toFixed(3), '-movflags', '+faststart', outFile]);
  return outFile;
}
