// Animora Motion: builds the self-contained page for a Motion storyboard.
//   data = { W, H, seed, brand, logo, font, accent, accent2, beats:[{ type, dur, bg, out, ...props }] }
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GSAP_CDN } from '../../engine/prompts.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'browser');
let cache = null;
const runtime = () => (cache ||= { css: readFileSync(path.join(dir, 'motion.css'), 'utf8'), js: readFileSync(path.join(dir, 'motion.js'), 'utf8') });

export const MOTION_FONTS = {
  Inter: 'Inter:wght@400;500;600;700;800',
  'DM Sans': 'DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800',
  'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@400;500;600;700;800',
  Manrope: 'Manrope:wght@400;500;600;700;800',
  Outfit: 'Outfit:wght@400;500;600;700;800',
  Sora: 'Sora:wght@400;500;600;700;800',
};
export const isMotion = (html) => /window\.MOTION = /.test(String(html || ''));
export const readMotion = (html) => {
  const m = String(html || '').match(/window\.MOTION = (.*);\n/);
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
};
const esc = (s) => String(s).replace(/</g, '\\u003c');

export function motionHtml(data) {
  const { css, js } = runtime();
  const font = MOTION_FONTS[data.font] ? data.font : 'Inter';
  const total = Math.round(data.beats.reduce((a, s) => a + s.dur, 0) * 100) / 100;
  const d = { ...data, font, duration: total };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="adflash" content="width=${d.W},height=${d.H},duration=${total},fps=30,engine=motion-v1">
<title>${String(d.brand || 'Animora video').replace(/[<>&]/g, '')}</title>
<link href="https://fonts.googleapis.com/css2?family=${MOTION_FONTS[font]}&display=block" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div id="stage"></div>
<script src="${GSAP_CDN}/gsap.min.js"></script>
<script>
window.MOTION = ${esc(JSON.stringify(d))};
window.ADFLASH_DATA = ${esc(JSON.stringify({ music: d.music || null }))};
</script>
<script>
${js}
</script>
</body>
</html>
`;
}
