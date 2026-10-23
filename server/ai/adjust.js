// Quick manual changes from the editor's "Adjust" panel (no AI, instant): size / aspect ratio, colours,
// text size and speed. The video keeps its exact shots and timing; only what was changed is different.
import { CANVAS } from '../engine/renderer.js';
import { templateFromPlan } from './templates.js';
import { readData } from './director.js';
import { readFlyer, flyerHtml, isFlyer } from './flyer.js';
import { THEMES } from './themes.js';
import { storyLookInfo, storyAdjust } from './pieces/index.js';

const HEX = /^#[0-9a-f]{6}$/i;
const VIDEO_SIZES = ['9:16', '1:1', '4:5', '16:9'];
const FLYER_SIZES = ['4:5', '9:16', '1:1', 'A4'];
const getVar = (html, name) => (String(html).match(new RegExp(`--${name}:\\s*([^;]+);`)) || [])[1];
const setVar = (html, name, value) => html.replace(new RegExp(`(--${name}:\\s*)([^;]+)(;)`), `$1${value}$3`);

// the looks a design can switch to, with their names and colours (for the swatches in the panel)
const THEME_LIST = Object.entries(THEMES).map(([key, t]) => ({ key, label: t.label || key, colors: t.colors, mode: t.mode }));
const MUSIC = { piano: { url: '/music/piano.mp3', builtin: 'piano' }, soft: { url: '/music/soft.mp3', builtin: 'soft' } };

/** What the panel shows as the current values. */
export function currentLook(html) {
  const story = storyLookInfo(html); if (story) return story;
  if (isFlyer(html)) {
    const d = readFlyer(html) || {};
    return { flyer: true, theme: d.theme, themes: THEME_LIST, colors: { primary: d.colors?.primary, secondary: d.colors?.secondary, background: d.colors?.background, text: d.colors?.text } };
  }
  const data = readData(html) || {};
  return {
    flyer: false, theme: data.theme?.key, themes: THEME_LIST, music: data.music?.builtin || (data.music?.url ? 'own' : 'none'),
    colors: { primary: getVar(html, 'primary'), secondary: getVar(html, 'secondary'), background: getVar(html, 'bg'), text: getVar(html, 'text') },
    scale: Number(getVar(html, 'scale') || 1), speed: Number((String(html).match(/const SPEED = ([\d.]+);/) || [])[1] || 1),
  };
}

/**
 * changes: { aspect?, colors?: { primary?, secondary?, background?, text? }, textScale? (multiplier), speed? (multiplier) }
 * Returns { html, aspect, summary } ; throws a plain message when nothing could change.
 */
export function adjustDesign({ html, plan = {}, assets = [], changes = {} }) {
  const story = storyAdjust(html, changes); if (story) return story;   // Story films are re-told from their own recipe
  const done = [];
  const colors = Object.fromEntries(Object.entries(changes.colors || {}).filter(([, v]) => HEX.test(String(v || ''))));

  if (isFlyer(html)) {
    const d = readFlyer(html);
    if (!d) throw new Error("This flyer can't be adjusted. Try Regenerate.");
    let aspect = null;
    if (changes.aspect && FLYER_SIZES.includes(changes.aspect)) {
      const { width, height } = CANVAS[changes.aspect];
      if (width !== d.W || height !== d.H) { d.W = width; d.H = height; aspect = changes.aspect; done.push(`size ${changes.aspect}`); }
    }
    if (changes.theme && THEMES[changes.theme] && changes.theme !== d.theme) { d.theme = changes.theme; d.colors = { ...THEMES[changes.theme].colors }; done.push(`look (${THEMES[changes.theme].label || changes.theme})`); }
    if (Object.keys(colors).length) { d.colors = { ...d.colors, ...colors }; done.push('colours'); }
    if (!done.length) throw new Error('Nothing to change.');
    return { html: flyerHtml(d), aspect, summary: `Changed the ${done.join(' and ')}.` };
  }

  const data = readData(html);
  if (!data) throw new Error("This video can't be adjusted. Try Regenerate.");
  let out = html, aspect = null;
  if (changes.aspect && VIDEO_SIZES.includes(changes.aspect)) {
    const { width, height } = CANVAS[changes.aspect];
    if (width !== data.W || height !== data.H) {
      // rebuild the page at the new size, then put back this video's exact shots, timing, look, colours and speed
      const fresh = templateFromPlan({ ...plan, aspect_ratio: changes.aspect }, { themeKey: data.theme?.key || 'bold', assets, beats: data.beats, look: data.theme });
      out = fresh.replace(/window\.ADFLASH_DATA = (.*);\n/, () => `window.ADFLASH_DATA = ${JSON.stringify({ ...data, W: width, H: height }).replace(/</g, '\\u003c')};\n`);
      for (const v of ['primary', 'secondary', 'bg', 'text', 'scale']) { const old = getVar(html, v); if (old) out = setVar(out, v, old); }
      const sp = String(html).match(/const SPEED = ([\d.]+);/); if (sp) out = out.replace(/const SPEED = ([\d.]+);/, sp[0]);
      aspect = changes.aspect; done.push(`size ${changes.aspect}`);
    }
  }
  if (changes.theme && THEMES[changes.theme] && changes.theme !== data.theme?.key) {
    // a whole new look (fonts, colours, background, motion style); the shots, words and timing stay
    const cur = readData(out) || data;
    const { width, height } = { width: cur.W, height: cur.H };
    const asp = Object.entries(CANVAS).find(([, c]) => c.width === width && c.height === height)?.[0] || plan.aspect_ratio || '9:16';
    const keep = Object.fromEntries(['preset', 'tempo', 'finish', 'leaks', 'chroma', 'glow', 'halo'].filter((k) => cur.theme?.[k] !== undefined).map((k) => [k, cur.theme[k]]));
    const fresh = templateFromPlan({ ...plan, aspect_ratio: asp, style: { ...(plan.style || {}), colors: undefined } }, { themeKey: changes.theme, assets, beats: cur.beats, look: keep });
    const nd = readData(fresh);
    out = fresh.replace(/window\.ADFLASH_DATA = (.*);\n/, () => `window.ADFLASH_DATA = ${JSON.stringify({ ...nd, beats: cur.beats, music: cur.music, captions: cur.captions }).replace(/</g, '\\u003c')};\n`);
    const sp = String(html).match(/const SPEED = ([\d.]+);/); if (sp) out = out.replace(/const SPEED = ([\d.]+);/, sp[0]);
    done.push(`look (${THEMES[changes.theme].label || changes.theme})`);
  }
  if (changes.music && ['none', 'piano', 'soft'].includes(changes.music)) {
    const cur = readData(out);
    if (cur) {
      const next = MUSIC[changes.music] || null;
      if ((cur.music?.builtin || (cur.music ? 'own' : 'none')) !== changes.music) {
        out = out.replace(/window\.ADFLASH_DATA = (.*);\n/, () => `window.ADFLASH_DATA = ${JSON.stringify({ ...cur, music: next }).replace(/</g, '\\u003c')};\n`);
        done.push(changes.music === 'none' ? 'no background music' : changes.music === 'piano' ? 'soft piano music' : 'soft background music');
      }
    }
  }
  if (Object.keys(colors).length) {
    if (colors.primary) out = setVar(out, 'primary', colors.primary);
    if (colors.secondary) out = setVar(out, 'secondary', colors.secondary);
    if (colors.background) out = setVar(out, 'bg', colors.background);
    if (colors.text) out = setVar(out, 'text', colors.text);
    done.push('colours');
  }
  const ts = Number(changes.textScale);
  if (ts > 0.4 && ts < 2.5 && ts !== 1) {
    const next = Math.max(0.5, Math.min(1.8, Math.round(Number(getVar(out, 'scale') || 1) * ts * 100) / 100));
    out = setVar(out, 'scale', String(next)); done.push(ts > 1 ? 'bigger text' : 'smaller text');
  }
  const sp = Number(changes.speed);
  if (sp > 0.4 && sp < 2.5 && sp !== 1) {
    const m = out.match(/const SPEED = ([\d.]+);/);
    if (m) { const next = Math.max(0.5, Math.min(2, Math.round(Number(m[1]) * sp * 100) / 100)); out = out.replace(m[0], `const SPEED = ${next};`); done.push(sp > 1 ? 'faster animations' : 'slower animations'); }
  }
  if (!done.length) throw new Error('Nothing to change.');
  return { html: out, aspect, summary: `Changed: ${done.join(', ')}.` };
}

/** The size of a design, read from its own code (so Undo puts the size back too). */
export function aspectOf(html) {
  const d = isFlyer(html) ? readFlyer(html) : readData(html);
  if (!d?.W || !d?.H) return null;
  return Object.entries(CANVAS).find(([, c]) => c.width === d.W && c.height === d.H)?.[0] || null;
}
