// Animora Motion looks: what a style means for the Motion engine. Each look is a full visual language:
// the stage (light or dark, tinted by the style's background), a display font for big type with its own
// treatment, an animated background world (deco), and the pacing of cuts.
//   theme  light | dark      base stage
//   display / dw             display font and weight for big type (UI cards keep the clean `ui` font)
//   text                     treatment: plain | marker | serif | neon | condensed | outline | sport | spaced | gradient | sticker | glow
//   deco                     the world behind every beat (see browser/motion.js DECO)
//   energy                   calm | medium | high (durations and transitions)
export const LOOKS = {
  'naija-bold':     { theme: 'dark',  display: 'Poppins', dw: 800, ui: 'Poppins', text: 'marker', deco: 'sunburst', energy: 'high', upper: false },
  'gold-luxe':      { theme: 'dark',  display: 'Playfair Display', dw: 700, ui: 'DM Sans', text: 'serif', deco: 'golddust', energy: 'calm' },
  'clean-pro':      { theme: 'light', display: 'DM Sans', dw: 700, ui: 'DM Sans', text: 'plain', deco: 'dotgrid', energy: 'medium' },
  'neon-nights':    { theme: 'dark',  display: 'Orbitron', dw: 800, ui: 'Inter', text: 'neon', deco: 'neongrid', energy: 'high' },
  'street-hype':    { theme: 'dark',  display: 'Anton', dw: 400, ui: 'Inter', text: 'condensed', deco: 'tape', energy: 'high', upper: true },
  'owambe-party':   { theme: 'dark',  display: 'Baloo 2', dw: 800, ui: 'Baloo 2', text: 'sticker', deco: 'confetti', energy: 'high' },
  'fresh-market':   { theme: 'light', display: 'Fredoka', dw: 700, ui: 'Fredoka', text: 'sticker', deco: 'bubbles', energy: 'medium' },
  'tech-pulse':     { theme: 'dark',  display: 'Space Grotesk', dw: 700, ui: 'Space Grotesk', text: 'gradient', deco: 'orbits', energy: 'medium' },
  'glory-light':    { theme: 'dark',  display: 'Cinzel', dw: 700, ui: 'Inter', text: 'spaced', deco: 'beams', energy: 'calm', upper: true },
  'beauty-bloom':   { theme: 'light', display: 'DM Serif Display', dw: 400, ui: 'DM Sans', text: 'serif', deco: 'petals', energy: 'calm' },
  'retro-pop':      { theme: 'light', display: 'Bungee', dw: 400, ui: 'Inter', text: 'outline', deco: 'halftone', energy: 'high', upper: true },
  'sports-blitz':   { theme: 'dark',  display: 'Oswald', dw: 700, ui: 'Inter', text: 'sport', deco: 'speed', energy: 'high', upper: true },
  'prime-estate':   { theme: 'dark',  display: 'Montserrat', dw: 700, ui: 'Montserrat', text: 'spaced', deco: 'blueprint', energy: 'calm', upper: true },
  'kiddies-fun':    { theme: 'light', display: 'Luckiest Guy', dw: 400, ui: 'Nunito', text: 'sticker', deco: 'bubbles', energy: 'high' },
  'mono-editorial': { theme: 'light', display: 'Archivo Black', dw: 400, ui: 'Inter', text: 'plain', deco: 'paper', energy: 'medium' },
  'afro-vibes':     { theme: 'dark',  display: 'Righteous', dw: 400, ui: 'Nunito', text: 'marker', deco: 'kente', energy: 'medium' },
  'ocean-breeze':   { theme: 'light', display: 'Nunito', dw: 900, ui: 'Nunito', text: 'plain', deco: 'waves', energy: 'calm' },
  'studio-white':   { theme: 'light', display: 'Inter', dw: 650, ui: 'Inter', text: 'plain', deco: 'none', energy: 'calm' },
  'midnight-glow':  { theme: 'dark',  display: 'Inter', dw: 600, ui: 'Inter', text: 'glow', deco: 'glow', energy: 'calm' },
  'fintech-blue':   { theme: 'light', display: 'Figtree', dw: 750, ui: 'Figtree', text: 'plain', deco: 'ribbon', energy: 'medium' },
  'health-pulse':   { theme: 'light', display: 'Inter', dw: 650, ui: 'Inter', text: 'plain', deco: 'pulse', energy: 'calm' },
  'graphite-pro':   { theme: 'dark',  display: 'Inter', dw: 650, ui: 'Inter', text: 'plain', deco: 'spot', energy: 'medium' },
};
// old theme keys (themes.js) -> the style that uses them
const BY_THEME = { bold: 'naija-bold', luxe: 'gold-luxe', clean: 'clean-pro', neon: 'neon-nights', street: 'street-hype', owambe: 'owambe-party', market: 'fresh-market', tech: 'tech-pulse', glory: 'glory-light', bloom: 'beauty-bloom', retro: 'retro-pop', blitz: 'sports-blitz', prime: 'prime-estate', kids: 'kiddies-fun', mono: 'mono-editorial', afro: 'afro-vibes', ocean: 'ocean-breeze', apple: 'studio-white', midnight: 'midnight-glow', fintech: 'fintech-blue', pulse: 'health-pulse', graphite: 'graphite-pro' };

// Google Fonts families with the weights each one really has (asking for a missing weight breaks the request)
export const FONT_AXES = {
  Inter: 'wght@400;500;600;700;800', Poppins: 'wght@400;500;600;700;800', 'Playfair Display': 'ital,wght@0,600;0,700;1,600;1,700', 'DM Sans': 'wght@400;500;600;700;800',
  Orbitron: 'wght@500;700;800', Anton: '', 'Baloo 2': 'wght@500;600;700;800', Fredoka: 'wght@500;600;700', 'Space Grotesk': 'wght@500;600;700', Cinzel: 'wght@600;700;800',
  'DM Serif Display': 'ital@0;1', Bungee: '', Oswald: 'wght@500;600;700', Montserrat: 'wght@500;600;700;800', 'Luckiest Guy': '', 'Archivo Black': '', Righteous: '',
  Nunito: 'wght@500;600;700;800;900', Figtree: 'wght@500;600;700;800', 'Plus Jakarta Sans': 'wght@400;500;600;700;800', Manrope: 'wght@400;500;600;700;800', Outfit: 'wght@400;500;600;700;800', Sora: 'wght@400;500;600;700;800',
};
export const fontsUrl = (families) => {
  const fams = [...new Set(families.filter((f) => f in FONT_AXES))];
  if (!fams.length) return '';
  return `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f.replace(/ /g, '+')}${FONT_AXES[f] ? `:${FONT_AXES[f]}` : ''}`).join('&')}&display=block`;
};

const OK = /^#[0-9a-f]{6}$/i;
const lum = (h) => { const n = parseInt(String(h).slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

/**
 * The look for a style (by slug or old theme key) with the style's palette folded in.
 * Unknown / creator-made styles get a look built from their palette (dark or light stage, clean type).
 */
export function lookFor(styleKey, palette = {}) {
  const key = LOOKS[styleKey] ? styleKey : BY_THEME[styleKey] || null;
  const base = key ? LOOKS[key] : { theme: OK.test(palette.background || '') && lum(palette.background) < 0.3 ? 'dark' : 'light', display: 'Inter', dw: 650, ui: 'Inter', text: 'plain', deco: 'none', energy: 'medium' };
  const out = { key: key || 'custom', ...base };
  if (OK.test(palette.background || '')) out.bg = palette.background;       // tints the stage
  if (OK.test(palette.secondary || '')) out.accent2 = palette.secondary;
  return out;
}
