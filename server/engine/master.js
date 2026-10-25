// Mastering for the effects track: the same code runs on the server (Node) and in the browser (phone export),
// so both MP4s sound the same.
//   1. glue: a gentle compressor so soft and loud effects sit together
//   2. loudness: gated loudness measured like LUFS (400 ms blocks, K-weighting approximated by a high-shelf boost
//      and a low cut), then the whole track is lifted to the social-media level (about -14 LUFS)
//   3. a look-ahead peak limiter keeps everything under -1 dBFS, so nothing crackles on phone speakers

const db = (x) => 20 * Math.log10(Math.max(1e-9, x));
const lin = (d) => 10 ** (d / 20);

// one-pole filters for the loudness weighting
function weighted(x, sr) {
  const out = new Float32Array(x.length);
  const aH = Math.exp(-2 * Math.PI * 80 / sr);        // low cut ~80 Hz
  const aS = Math.exp(-2 * Math.PI * 1500 / sr);      // high shelf from ~1.5 kHz (+4 dB, like K-weighting)
  let hpPrev = 0, hpOut = 0, lpOut = 0;
  for (let i = 0; i < x.length; i++) {
    hpOut = aH * (hpOut + x[i] - hpPrev); hpPrev = x[i];
    lpOut = (1 - aS) * hpOut + aS * lpOut;
    out[i] = hpOut + (hpOut - lpOut) * 0.58;
  }
  return out;
}

/** Integrated loudness (LUFS-like, mono) with the absolute (-70) and relative (-10 LU) gates. */
export function loudness(x, sr) {
  const w = weighted(x, sr), block = Math.round(sr * 0.4), hop = Math.round(sr * 0.1), pw = [];
  for (let s = 0; s + block <= w.length; s += hop) {
    let e = 0; for (let i = s; i < s + block; i++) e += w[i] * w[i];
    pw.push(e / block);
  }
  const lufs = (p) => -0.691 + 10 * Math.log10(Math.max(1e-12, p));
  const abs = pw.filter((p) => lufs(p) > -70);
  if (!abs.length) return -70;
  const mean = abs.reduce((a, b) => a + b, 0) / abs.length;
  const rel = abs.filter((p) => lufs(p) > lufs(mean) - 10);
  return lufs(rel.reduce((a, b) => a + b, 0) / rel.length);
}

function compress(x, sr, { threshold = -20, ratio = 2.5, attack = 0.006, release = 0.12 } = {}) {
  const aA = Math.exp(-1 / (sr * attack)), aR = Math.exp(-1 / (sr * release));
  let envDb = -90;
  for (let i = 0; i < x.length; i++) {
    const lvl = db(Math.abs(x[i]));
    envDb = lvl > envDb ? aA * envDb + (1 - aA) * lvl : aR * envDb + (1 - aR) * lvl;
    const over = envDb - threshold;
    if (over > 0) x[i] *= lin(-over * (1 - 1 / ratio));
  }
  return x;
}

function limit(x, sr, ceiling = lin(-2.2), lookMs = 5, releaseMs = 80) {   // -2.2 dB leaves room for the AAC encoder (its overshoot reached +0.6 dB at -1.5)
  const look = Math.max(1, Math.round(sr * lookMs / 1000)), aR = Math.exp(-1 / (sr * releaseMs / 1000));
  const n = x.length, need = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = Math.abs(x[i]); need[i] = a > ceiling ? ceiling / a : 1; }
  // minimum of the needed gain over the look-ahead window (sliding window via a monotonic deque)
  const minAhead = new Float32Array(n), dq = new Int32Array(n); let h = 0, tl = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (tl > h && need[dq[tl - 1]] >= need[i]) tl--;
    dq[tl++] = i;
    while (dq[h] > i + look) h++;
    minAhead[i] = need[dq[h]];
  }
  let g = 1;
  for (let i = 0; i < n; i++) {
    const target = minAhead[i];
    g = target < g ? target : aR * g + (1 - aR) * target;
    x[i] *= g;
  }
  return x;
}

/** Master a mono effects track in place. Returns { gainDb, lufs } for logging. */
// true peaks stay under -4 dBFS (measured on the exported AAC), as the sound-pass method asks, so phone speakers never crackle
export function masterTrack(x, sr, { target = -14, ceilingDb = -4.6 } = {}) {
  if (!x?.length) return { gainDb: 0, lufs: -70 };
  compress(x, sr, { attack: 0.018, release: 0.16 });   // a slower attack lets the start of each effect through, so it reads over the music
  const before = loudness(x, sr);
  const gainDb = before > -69 ? Math.max(-12, Math.min(24, target - before)) : 0;
  const g = lin(gainDb);
  for (let i = 0; i < x.length; i++) x[i] *= g;
  limit(x, sr, lin(ceilingDb));
  return { gainDb, lufs: loudness(x, sr) };
}

/**
 * The music bed under the effects (same code on the server and in the phone export):
 *  - levelled by its loudness (not its peak) so every song sits at the same place under the effects;
 *  - looped with a 2-second crossfade if the film is longer than the song (no click at the seam);
 *  - faded in quickly and out over the last 2 seconds;
 *  - gently ducked (about -3.5 dB) under each sound effect so whooshes and chimes read clearly.
 */
export function musicBed(music, n, sr, events = [], { timeScale = 1, level = -34 } = {}) {
  const out = new Float32Array(n);
  const len = music.length; if (!len) return out;
  // loudness-ish level: RMS over the first minute
  const m = Math.min(len, sr * 60); let e = 0; for (let i = 0; i < m; i++) e += music[i] * music[i];
  const rms = Math.sqrt(e / Math.max(1, m)), g = rms > 1e-6 ? lin(level) / rms : 0;
  const xf = Math.min(Math.floor(len / 4), sr * 2);
  for (let i = 0; i < n; i++) {
    if (len >= n || i < len - xf) { out[i] = music[i % len]; continue; }
    // past the first pass: crossfade the tail into the start, then keep looping the same way
    const period = len - xf, k = (i - (len - xf)) % period, inFade = k < xf;
    const a = inFade ? music[len - xf + k] : 0, b = music[k];
    out[i] = inFade ? a * Math.cos((k / xf) * Math.PI / 2) + b * Math.sin((k / xf) * Math.PI / 2) : b;
  }
  const fin = sr * 0.25, fout = sr * 2;
  const duck = new Float32Array(n).fill(1), depth = lin(-3.5), att = sr * 0.05, hold = sr * 0.3, rel = sr * 0.35;
  for (const ev of events || []) {
    const s = Math.round((Number(ev.t) || 0) * timeScale * sr) - att, w = (Number(ev.v) || 1) >= 0.5 ? 1 : 0.5;
    for (let i = Math.max(0, s); i < Math.min(n, s + att + hold + rel); i++) {
      const p = i - s, amt = p < att ? p / att : p < att + hold ? 1 : 1 - (p - att - hold) / rel;
      const gg = 1 - (1 - depth) * amt * w; if (gg < duck[i]) duck[i] = gg;
    }
  }
  for (let i = 0; i < n; i++) out[i] *= g * duck[i] * Math.min(1, i / fin, (n - i) / fout);
  return out;
}
