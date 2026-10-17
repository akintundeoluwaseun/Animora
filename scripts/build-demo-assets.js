// Pre-renders the demo videos with our own engine: 3 style previews and 2 ads.
// Usage: node scripts/build-demo-assets.js   (takes a few minutes; output in assets/)
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { renderVideo, snapshotFrames } from '../server/engine/renderer.js';
import { templateFromPlan } from '../server/ai/templates.js';
import { STARTER_STYLES, DEMO_ADS } from '../server/db/starter.js';

const jobs = [
  ...STARTER_STYLES.map((s) => ({ out: `assets/styles/${s.slug}`, plan: s.example, theme: s.palette.theme })),
  ...DEMO_ADS.map((a) => ({ out: `assets/ads/${a.file}`, plan: a.plan, theme: a.theme })),
];
for (const d of ['assets/styles', 'assets/ads', 'assets/samples']) await mkdir(d, { recursive: true });
for (const j of jobs) {
  // Poster frame shown while the video loads.
  if (!existsSync(`${j.out}.jpg`) || process.argv.includes('--force')) {
    const [img] = await snapshotFrames(templateFromPlan(j.plan, { themeKey: j.theme }), [2.4], { aspectRatio: j.plan.aspect_ratio, scale: 0.5, quality: 80 });
    await writeFile(`${j.out}.jpg`, img);
  }
  if (existsSync(`${j.out}.mp4`) && !process.argv.includes('--force')) { console.log(`skip ${j.out}.mp4 (exists)`); continue; }
  const html = templateFromPlan(j.plan, { themeKey: j.theme });
  await writeFile(`${j.out}.html`, html);
  const r = await renderVideo({ html, outFile: `${j.out}.mp4`, aspectRatio: j.plan.aspect_ratio, duration: j.plan.duration_seconds });
  console.log(`rendered ${j.out}.mp4 in ${r.elapsedSeconds}s ${r.warnings.join(' ')}`);
}
// The style previews double as the pitch sample videos.
for (const s of STARTER_STYLES) {
  if (existsSync(`assets/styles/${s.slug}.mp4`)) await copyFile(`assets/styles/${s.slug}.mp4`, `assets/samples/${s.slug}-sample.mp4`);
}
console.log('done');
