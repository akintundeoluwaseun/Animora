// Sound effects mixer: turns the animation's sound cues (window.__sfx: [{ t, k, v }]) into an audio track
// and muxes it into the rendered MP4. Sounds live in assets/sfx (made by scripts/make-sfx.py).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

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
const musicSource = (m) => (m?.k ? path.join(MUSIC_DIR, `${String(m.k).replace(/[^a-z]/g, '')}.mp3`) : m?.url || null);

/** Mix the cues into a WAV buffer (mono, 44.1 kHz) of `duration` seconds. timeScale stretches cue times. */
export function mixSfx(events, duration, { timeScale = 1, gain = 0.6, music = null } = {}) {
  const b = sounds();
  const n = Math.ceil(duration * SR), mix = new Float32Array(n);
  for (const e of events || []) {
    const s = b[e.k]; if (!s) continue;
    const start = Math.round(e.t * timeScale * SR), v = (Number(e.v) || 1) * gain;
    for (let i = 0; i < s.length && start + i < n; i++) if (start + i >= 0) mix[start + i] += s[i] * v;
  }
  // level the effects (loudest moment about -7 dB)
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mix[i]));
  const lift = peak > 0 ? Math.min(2, (music ? 0.38 : 0.45) / peak) : 1;
  for (let i = 0; i < n; i++) mix[i] *= lift;
  // the music bed sits underneath: looped, faded in and out, about -10 dB at its peak
  if (music?.length) {
    let mp = 0; for (let i = 0; i < music.length; i++) mp = Math.max(mp, Math.abs(music[i]));
    const g = mp > 0 ? 0.32 / mp : 0, fin = SR * 0.4, fout = SR * 1.6;
    for (let i = 0; i < n; i++) {
      const fade = Math.min(1, i / fin, (n - i) / fout);
      mix[i] += music[i % music.length] * g * fade;
    }
  }
  const pcm = Buffer.alloc(44 + n * 2);
  for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round(Math.tanh(mix[i] * 1.1) * 0.95 * 32767), 44 + i * 2);
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
  await writeFile(wav, mixSfx(events, duration, { ...opts, music }));
  await ffmpeg(['-y', '-loglevel', 'error', '-i', videoFile, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', outFile]);
  return outFile;
}
