// Animora Cinema: the premium motion engine for 9:16 videos.
//   data  = { W, H, duration, seed, brand, font, palette, scenes:[{ type, dur, ...props }] }
//   html  = cinemaHtml(data)        (one self-contained page; defines a paused window.__timeline and window.__sfx)
//   plan  = composeCinema(...)      (rule-based storyboard, always works)
//   AI    = directCinema(...)       (Gemini writes the storyboard; falls back to composeCinema)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GSAP_CDN } from '../../engine/prompts.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'browser');
const read = (f) => readFileSync(path.join(dir, f), 'utf8');
const MARK = '  // ================================================================ BUILD';
const CAM = '  // camera: never still.';
let cache = null;
function runtime() {
  if (cache) return cache;
  let js = read('cinema.js');
  js = js.replace(CAM, () => `${read('worlds.js')}\n${CAM}`);
  js = js.replace(MARK, () => `${read('scenes2.js')}\n${read('scenes3.js')}\n${MARK}`);
  cache = { css: read('cinema.css'), js };
  return cache;
}

const esc = (s) => String(s).replace(/</g, '\\u003c');
const FONTS = { Inter: 'Inter:wght@500;600;700;800;900', Poppins: 'Poppins:wght@500;600;700;800;900', 'DM Sans': 'DM+Sans:wght@500;700;800;900', Montserrat: 'Montserrat:wght@500;600;700;800;900', 'Playfair Display': 'Playfair+Display:wght@700;800;900' };

export const CINEMA_ASPECTS = ['9:16'];
export const isCinema = (html) => /window\.CINEMA = /.test(String(html || ''));
export const readCinema = (html) => {
  const m = String(html || '').match(/window\.CINEMA = (.*);\n/);
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
};

export function cinemaHtml(data) {
  const { css, js } = runtime();
  const font = FONTS[data.font] ? data.font : 'Inter';
  const total = Math.round(data.scenes.reduce((a, s) => a + s.dur, 0) * 100) / 100;
  const d = { ...data, font, duration: total };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="adflash" content="width=${d.W},height=${d.H},duration=${total},fps=30,engine=cinema-v1">
<title>${String(d.brand || 'Animora video').replace(/[<>&]/g, '')}</title>
<link href="https://fonts.googleapis.com/css2?family=${FONTS[font]}&display=block" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div id="stage"></div>
<script src="${GSAP_CDN}/gsap.min.js"></script>
<script>
window.CINEMA = ${esc(JSON.stringify(d))};
</script>
<script>
${js}
</script>
</body>
</html>
`;
}

export { composeCinema, paletteFor } from './compose.js';
export { directCinema, cinemaEdit, sanitizeScenes, SCENE_GUIDE } from './director.js';
