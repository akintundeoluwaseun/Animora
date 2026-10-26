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
export function mixSfx(events, duration, { timeScale = 1, gain = 0.6, music = null, voice = null } = {}) {
  const b = sounds();
  const n = Math.ceil(duration * SR), mix = new Float32Array(n);
  for (const e of events || []) {
    const s = b[e.k]; if (!s) continue;
    const start = Math.round(e.t * timeScale * SR), v = (Number(e.v) || 1) * gain;
    // a cue with a length (typing under typed text) loops the sound to that length and fades its last 80 ms
    const len = Number(e.len) > 0 ? Math.round(Number(e.len) * timeScale * SR) : s.length, fade = Math.round(0.08 * SR);
    for (let i = 0; i < len && start + i < n; i++) if (start + i >= 0) mix[start + i] += s[i % s.length] * v * (Number(e.len) > 0 && i > len - fade ? (len - i) / fade : 1);
  }
  // music (the owner's own) sits under the effects before mastering
  // the music bed sits underneath: looped, faded in and out, about -10 dB at its peak
  if (music?.length) { const bed = musicBed(music, n, SR, events, { timeScale }); for (let i = 0; i < n; i++) mix[i] += bed[i]; }
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

/** Write the sound track next to the video and mux it in (video stream copied, AAC audio). */
export async function addSfxToVideo(videoFile, outFile, events, duration, opts = {}) {
  const wav = `${videoFile}.sfx.wav`;
  let music = null;
  const src = musicSource(opts.music);
  if (src) { try { music = await decode(src); } catch (e) { console.warn('[sfx] music skipped:', e.message); } }
  let voice = null;
  if (opts.voiceFile) { try { voice = await decode(opts.voiceFile); } catch (e) { console.warn('[sfx] voice skipped:', e.message); } }
  await writeFile(wav, mixSfx(events, duration, { ...opts, music, voice }));
  await ffmpeg(['-y', '-loglevel', 'error', '-i', videoFile, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', outFile]);
  return outFile;
}
