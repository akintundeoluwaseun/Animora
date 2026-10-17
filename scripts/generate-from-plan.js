// End-to-end: plan JSON -> Gemini writes the animation -> validated -> rendered to MP4.
// Usage: GEMINI_API_KEY=... node scripts/generate-from-plan.js samples/plan-30s.json [output/out.mp4] ["optional edit request"]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { generateAnimation, editAnimation } from '../server/engine/gemini.js';
import { renderVideo } from '../server/engine/renderer.js';

const [planFile = 'samples/plan-30s.json', outFile = 'output/from-plan.mp4', editRequest] = process.argv.slice(2);
const plan = JSON.parse(await readFile(planFile, 'utf8'));
await mkdir(path.dirname(outFile), { recursive: true });
const status = (s) => console.log(`[ai] ${s}`);

let gen = await generateAnimation(plan, { onStatus: status });
if (editRequest) {
  console.log(`[ai] Applying edit: "${editRequest}"`);
  gen = await editAnimation(gen.html, editRequest, { aspectRatio: plan.aspect_ratio, duration: plan.duration_seconds, onStatus: status });
}
const htmlFile = outFile.replace(/\.mp4$/, '.html');
await writeFile(htmlFile, gen.html);
console.log(`[ai] Code saved to ${htmlFile} (${gen.rounds} repair round(s))`);
if (gen.problems.length) console.log('[ai] Remaining issues:\n - ' + gen.problems.join('\n - '));

const result = await renderVideo({
  html: gen.html, outFile, aspectRatio: plan.aspect_ratio, duration: plan.duration_seconds,
  log: (m) => console.log(`[render] ${m}`),
  onProgress: (p) => process.stdout.write(`\r[render] ${p.percent}%  ${p.framesDone}/${p.totalFrames}  ETA ${p.etaSeconds}s   `),
});
console.log('\n' + JSON.stringify(result, null, 2));
