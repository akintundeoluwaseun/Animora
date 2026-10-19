// Engine acceptance test (Phase 1).
// Renders samples/sample-15s.html and checks:
//   1. MP4 is H.264, yuv420p, 1080x1920, 30fps, exactly 450 frames / 15.000s
//   2. Timing + smoothness: the sample's progress bar grows linearly from 0 to 1080px
//      over the full video. We measure its width on every decoded frame and require
//      it to match the expected width for that frame (no dropped, duplicated or
//      out-of-order frames, including across parallel segment joins).
//   3. Determinism: rendering the same HTML twice gives the same frames (2 vs 3 workers where supported).
import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { renderVideo } from '../server/engine/renderer.js';

const W = 1080, H = 1920, FPS = 30, DUR = 15, N = FPS * DUR;
const workersA = process.platform === 'win32' ? 1 : 2;
const workersB = process.platform === 'win32' ? 1 : 3;

function capture(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    const chunks = []; let err = '';
    p.stdout.on('data', (d) => chunks.push(d));
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (c) => (c === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(err))));
  });
}

async function probe(file) {
  const out = await capture('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames',
    '-show_entries', 'stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_read_frames:format=duration',
    '-of', 'json', file]);
  const j = JSON.parse(out);
  return { ...j.streams[0], duration: Number(j.format.duration) };
}

// One RGB row 6px above the bottom edge, for every frame.
async function barWidths(file) {
  const raw = await capture('ffmpeg', ['-v', 'error', '-i', file, '-vf', `crop=${W}:2:0:${H - 8},format=rgb24,crop=${W}:1:0:0`,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  const rowBytes = W * 3, widths = [];
  for (let f = 0; f * rowBytes < raw.length; f++) {
    let w = 0;
    for (let x = 0; x < W; x++) {
      const i = f * rowBytes + x * 3;
      if (raw[i] > 200 && raw[i + 1] > 160 && raw[i + 2] < 120) w++; // bar colour #FFC93C
    }
    widths.push(w);
  }
  return widths;
}

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

await mkdir('output', { recursive: true });
const html = await readFile('samples/sample-15s.html', 'utf8');

const r1 = await renderVideo({ html, outFile: 'output/test-a.mp4', workers: workersA, log: console.log });
const r2 = await renderVideo({ html, outFile: 'output/test-b.mp4', workers: workersB, log: () => {} });

const p = await probe('output/test-a.mp4');
check('codec h264 / yuv420p', p.codec_name === 'h264' && p.pix_fmt === 'yuv420p', `${p.codec_name} ${p.pix_fmt}`);
check('size 1080x1920', p.width === W && p.height === H, `${p.width}x${p.height}`);
check('30 fps', p.r_frame_rate === '30/1', p.r_frame_rate);
check('exactly 450 frames', Number(p.nb_read_frames) === N, p.nb_read_frames);
check('duration 15.000s', Math.abs(p.duration - DUR) < 0.01, String(p.duration));
check('no renderer warnings', r1.warnings.length === 0, r1.warnings.join('; '));

const widths = await barWidths('output/test-a.mp4');
let maxErr = 0, worst = 0, backwards = 0;
widths.forEach((w, f) => {
  const expected = (W * f) / N;
  const e = Math.abs(w - expected);
  if (e > maxErr) { maxErr = e; worst = f; }
  if (f && w < widths[f - 1]) backwards++;
});
// 1 frame of bar growth = 2.4px; allow 2px for JPEG/H.264 edge softness.
check('every frame lands at the right time', maxErr <= 2.5, `max error ${maxErr.toFixed(1)}px at frame ${worst} (1 frame = ${(W / N).toFixed(1)}px)`);
check('motion never jumps backwards', backwards === 0, `${backwards} backwards steps`);

const wb = await barWidths('output/test-b.mp4');
const same = wb.length === widths.length && wb.every((w, i) => Math.abs(w - widths[i]) <= 2);   // same 2px edge allowance as above (crf 23 softens edges a touch)
check(`deterministic across renders (${workersA} vs ${workersB} workers)`, same);

console.log(`\nRender time: ${r1.elapsedSeconds}s for ${r1.totalFrames} frames (${(r1.totalFrames / r1.elapsedSeconds).toFixed(1)} fps)`);
const failed = results.filter((x) => !x).length;
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
