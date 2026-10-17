// Small FFmpeg/ffprobe helpers for uploaded images and audio.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function run(cmd, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = []; let err = '';
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => { err = (err + d).slice(-3000); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`${cmd} failed: ${err}`))));
    if (input) p.stdin.end(input); else p.stdin.end();
  });
}

export async function withTemp(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'adflash-media-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

/** Probe a local file: { width, height, hasAlpha, duration } (fields missing when not applicable). */
export async function probeFile(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,pix_fmt:format=duration', '-of', 'json', file]);
  const j = JSON.parse(out.toString());
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  const a = (j.streams || []).find((s) => s.codec_type === 'audio');
  const info = {};
  if (v) Object.assign(info, { width: v.width, height: v.height, hasAlpha: /rgba|bgra|argb|abgr|ya8|ya16|yuva|gbrap|pal8/.test(v.pix_fmt || '') });
  if (a || !v) { const d = Number(j.format?.duration); if (d > 0) info.duration = Math.round(d * 100) / 100; }
  return info;
}

/** Size + transparency straight from PNG / JPEG / WebP / GIF headers (no ffprobe needed, e.g. on Vercel). */
export function imageHeaderInfo(buf) {
  try {
    if (buf.length > 26 && buf.readUInt32BE(0) === 0x89504e47) {   // PNG
      const colorType = buf[25];
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), hasAlpha: colorType === 4 || colorType === 6 || buf.indexOf('tRNS') > 0 };
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {                        // JPEG: find the SOF marker
      for (let i = 2; i < buf.length - 9;) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), hasAlpha: false };
        i += 2 + len;
      }
    }
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const fmt = buf.toString('ascii', 12, 16);
      if (fmt === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), hasAlpha: !!(buf[20] & 0x10) };
      if (fmt === 'VP8L') { const b0 = buf.readUInt32LE(21); return { width: (b0 & 0x3fff) + 1, height: ((b0 >> 14) & 0x3fff) + 1, hasAlpha: !!((b0 >> 28) & 1) }; }
      if (fmt === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, hasAlpha: false };
    }
    if (buf.toString('ascii', 0, 3) === 'GIF') return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), hasAlpha: true };
  } catch { /* not an image we can read */ }
  return {};
}

/** Probe uploaded bytes (images: size + transparency; audio: duration). SVGs are skipped. */
export async function probeBuffer(buf, ext = '') {
  if (/svg/i.test(ext)) return {};
  const header = imageHeaderInfo(buf);
  if (header.width) return header;
  return withTemp(async (dir) => {
    const f = path.join(dir, `in${ext || '.bin'}`);
    await writeFile(f, buf);
    return probeFile(f).catch(() => ({}));
  });
}

/** Any audio bytes -> normalized MP3 (44.1 kHz stereo) + its duration. rawPcm: 24 kHz 16-bit mono PCM without header. */
export async function toMp3(buf, { rawPcm = false, sampleRate = 24000 } = {}) {
  return withTemp(async (dir) => {
    const inFile = path.join(dir, rawPcm ? 'in.pcm' : 'in.audio');
    const outFile = path.join(dir, 'out.mp3');
    await writeFile(inFile, buf);
    const inArgs = rawPcm ? ['-f', 's16le', '-ar', String(sampleRate), '-ac', '1', '-i', inFile] : ['-i', inFile];
    await run('ffmpeg', ['-y', '-v', 'error', ...inArgs, '-ar', '44100', '-ac', '2', '-b:a', '160k', outFile]);
    const { duration } = await probeFile(outFile);
    return { mp3: await readFile(outFile), duration };
  });
}

/**
 * Lay out per-scene voice clips on one track: each clip starts at its scene start.
 * clips: [{ mp3: Buffer, start: seconds, maxLength: seconds }]. Clips longer than their scene are sped up
 * (up to 1.25x) so the voice never runs into the next scene.
 */
export async function assembleVoiceTrack(clips, totalSeconds) {
  return withTemp(async (dir) => {
    const inputs = [];
    const filters = [];
    for (let i = 0; i < clips.length; i++) {
      const f = path.join(dir, `c${i}.mp3`);
      await writeFile(f, clips[i].mp3);
      inputs.push('-i', f);
      const { duration = 0 } = await probeFile(f);
      const speed = clips[i].maxLength && duration > clips[i].maxLength ? Math.min(1.25, duration / clips[i].maxLength) : 1;
      const delay = Math.round(clips[i].start * 1000);
      filters.push(`[${i}:a]${speed > 1.001 ? `atempo=${speed.toFixed(3)},` : ''}adelay=${delay}|${delay}[a${i}]`);
    }
    const mix = `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0:duration=longest,apad,atrim=0:${totalSeconds}[out]`;
    const outFile = path.join(dir, 'voice.mp3');
    await run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', [...filters, mix].join(';'), '-map', '[out]', '-ar', '44100', '-ac', '2', '-b:a', '160k', outFile]);
    return { mp3: await readFile(outFile), duration: totalSeconds };
  });
}
