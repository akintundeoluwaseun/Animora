// AdFlash style themes for the built-in motion engine v3 (server/ai/templates.js + runtime/motion.js).
//
// A theme sets the LOOK (mode, colours, fonts, ambient background, skin CSS) and the DIRECTION:
//   prefer.*      which shots the beat planner picks for each kind of content (rotated for variety)
//   transitions   cut types used between beats: whip | zoom | morph | line | wipe | rise | flash
//   textIn        how words arrive: rise (out of a mask) | blur (focus pull) | slide
//   accentStyle   marker (bar sweeps behind the key word) | color (key word in the accent colour)
//   energy        1 calm, 2 lively, 3 crazy (camera shakes on impacts)
//   calm          premium (Apple-style) direction: small clean type, UI morphs, no punch-word zooms
//   textScale     shrinks the classic shots' type for calm styles; drift = slow camera tilt
// Keys bold / luxe / clean are kept for styles saved before v2.

const sans = (f) => `'${f}','Inter','Poppins','DejaVu Sans',Arial,sans-serif`;
const serif = (f) => `'${f}','Playfair Display','DejaVu Serif',Georgia,serif`;

const P = (o) => ({
  hook: ['slam', 'zoomword', 'poster', 'kinetic', 'type', 'words'],
  text: ['reveal', 'words', 'split', 'marquee3d', 'kinetic', 'type'],
  price: ['counter', 'card', 'hero'],
  list: ['wheel', 'pills', 'phone', 'grid'],
  features: ['flow', 'grid', 'orbit', 'wheel'],
  brand: ['brand', 'notify', 'orbit', 'split'],
  cta: ['lockup'],
  ...o,
});

export const THEMES = {
  bold: {
    label: 'Naija Bold', font: 'Poppins', fontParam: 'Poppins:wght@500;600;800;900', stack: sans('Poppins'),
    headWeight: 900, tracking: -2, mode: 'dark',
    colors: { primary: '#E8530E', secondary: '#FFC93C', background: '#1B0F08', text: '#FFF6E9' },
    accentStyle: 'marker', textIn: 'rise', energy: 3,
    ambient: ['glow', 'rays', 'particles'],
    transitions: ['whip', 'zoom', 'morph', 'wipe', 'flash'],
    prefer: P({ hook: ['zoomword', 'kinetic', 'words'], price: ['counter', 'hero', 'card'], list: ['pills', 'wheel', 'phone'] }),
    css: () => `.zw-main, .kin-line.big span { text-shadow: 0 ${'8px'} 0 color-mix(in srgb, var(--primary) 65%, black); }`,
  },
  luxe: {
    label: 'Gold Luxe', font: 'Playfair Display', fontParam: 'Playfair+Display:ital,wght@0,600;1,600;1,700&family=Montserrat:wght@500;600',
    stack: serif('Playfair Display'), subStack: sans('Montserrat'), headWeight: 600, italic: true, tracking: 0, mode: 'dark',
    colors: { primary: '#C9A227', secondary: '#F3E3B3', background: '#0E0B08', text: '#F8F1E4' },
    accentStyle: 'color', textIn: 'blur', energy: 1,
    ambient: ['glow', 'sparkles', 'frame'],
    transitions: ['zoom', 'line', 'morph', 'rise'],
    prefer: P({ hook: ['words', 'type', 'zoomword'], text: ['words', 'type', 'split'], price: ['card', 'counter'], list: ['wheel', 'pills'], features: ['wheel', 'orbit', 'flow'], brand: ['brand', 'orbit'] }),
    css: () => `.tx-sub, .chip, .lk-text .tx-sub { text-transform: uppercase; letter-spacing: .3em; font-size: .8em; }`,
  },
  clean: {
    label: 'Clean Pro', font: 'DM Sans', fontParam: 'DM+Sans:wght@500;700;800', stack: sans('DM Sans'),
    headWeight: 700, tracking: -2, mode: 'light',
    colors: { primary: '#1F6FEB', secondary: '#16C784', background: '#F5F7FB', text: '#0B1B33' },
    accentStyle: 'color', textIn: 'rise', energy: 2,
    ambient: ['grid', 'glow'],
    transitions: ['whip', 'morph', 'line', 'rise'],
    prefer: P({ hook: ['words', 'type', 'kinetic'], price: ['card', 'counter'], list: ['wheel', 'phone', 'grid'], features: ['flow', 'grid', 'wheel'], brand: ['notify', 'brand', 'split'] }),
    css: () => '',
  },
  neon: {
    label: 'Neon Nights', font: 'Orbitron', fontParam: 'Orbitron:wght@600;800&family=Rajdhani:wght@600;700', stack: sans('Orbitron'), subStack: sans('Rajdhani'),
    headWeight: 800, upper: true, tracking: 2, mode: 'dark',
    colors: { primary: '#FF2E88', secondary: '#00E5FF', background: '#07021A', text: '#F7F2FF' },
    accentStyle: 'color', textIn: 'blur', energy: 3,
    ambient: ['glow', 'streaks', 'scan', 'dots'],
    transitions: ['zoom', 'whip', 'flash', 'line'],
    prefer: P({ hook: ['zoomword', 'type', 'kinetic'], price: ['counter', 'card'], list: ['wheel', 'phone', 'pills'], brand: ['brand', 'notify'] }),
    css: () => `.tx-line, .zw-main, .kin-line span, .brand-name { text-shadow: 0 0 18px var(--primary), 0 0 50px color-mix(in srgb, var(--primary) 70%, transparent); }
  .acc .wi, .kin-line.acc span { text-shadow: 0 0 18px var(--secondary), 0 0 50px var(--secondary); }`,
  },
  street: {
    label: 'Street Hype', font: 'Anton', fontParam: 'Anton&family=Archivo:wght@600;800', stack: sans('Anton'), subStack: sans('Archivo'),
    headWeight: 400, upper: true, tracking: 1, mode: 'dark',
    colors: { primary: '#C6FF00', secondary: '#FFFFFF', background: '#0A0A0A', text: '#FFFFFF' },
    accentStyle: 'marker', textIn: 'slide', energy: 3,
    ambient: ['marquee', 'dots'],
    transitions: ['whip', 'flash', 'zoom', 'wipe'],
    prefer: P({ hook: ['zoomword', 'kinetic'], text: ['kinetic', 'words', 'split'], price: ['hero', 'counter', 'card'], list: ['pills', 'wheel'], features: ['grid', 'wheel'] }),
    css: () => '',
  },
  owambe: {
    label: 'Owambe Party', font: 'Baloo 2', fontParam: 'Baloo+2:wght@600;800', stack: sans('Baloo 2'),
    headWeight: 800, tracking: -1, mode: 'color',
    colors: { primary: '#FF3EA5', secondary: '#FFC83D', background: '#2A0845', text: '#FFF7FB' },
    accentStyle: 'color', textIn: 'rise', energy: 3,
    ambient: ['glow', 'rays', 'confetti'],
    transitions: ['morph', 'zoom', 'wipe', 'whip'],
    prefer: P({ hook: ['kinetic', 'zoomword', 'words'], price: ['counter', 'hero', 'card'], list: ['pills', 'wheel', 'grid'], features: ['orbit', 'grid', 'flow'], brand: ['brand', 'orbit'] }),
    css: () => '',
  },
  market: {
    label: 'Fresh Market', font: 'Fredoka', fontParam: 'Fredoka:wght@500;600;700', stack: sans('Fredoka'),
    headWeight: 700, tracking: -1, mode: 'light',
    colors: { primary: '#18A558', secondary: '#FF5A36', background: '#FFF6E5', text: '#1E2A1E' },
    accentStyle: 'marker', textIn: 'rise', energy: 2,
    ambient: ['glow', 'bubbles'],
    transitions: ['morph', 'whip', 'rise', 'wipe'],
    prefer: P({ hook: ['kinetic', 'words', 'zoomword'], price: ['hero', 'card', 'counter'], list: ['pills', 'grid', 'phone'] }),
    css: () => '',
  },
  tech: {
    label: 'Tech Pulse', font: 'Space Grotesk', fontParam: 'Space+Grotesk:wght@500;700', stack: sans('Space Grotesk'),
    headWeight: 700, tracking: -2, mode: 'dark',
    colors: { primary: '#3D7BFF', secondary: '#2CF6B3', background: '#050B1F', text: '#EAF2FF' },
    accentStyle: 'color', textIn: 'blur', energy: 2,
    ambient: ['glow', 'streaks', 'grid'],
    transitions: ['line', 'whip', 'morph', 'zoom'],
    prefer: P({ hook: ['words', 'type', 'zoomword'], price: ['card', 'counter'], list: ['phone', 'wheel', 'grid'], features: ['flow', 'grid', 'wheel'], brand: ['brand', 'notify'] }),
    css: () => `.acc .wi { background: linear-gradient(90deg, var(--primary), var(--secondary)); -webkit-background-clip: text; background-clip: text; color: transparent; }`,
  },
  glory: {
    label: 'Glory Light', font: 'Cinzel', fontParam: 'Cinzel:wght@700;900&family=Montserrat:wght@500;600', stack: serif('Cinzel'), subStack: sans('Montserrat'),
    headWeight: 900, upper: true, tracking: 2, mode: 'dark',
    colors: { primary: '#F5C542', secondary: '#FFFFFF', background: '#0A1033', text: '#FFFFFF' },
    accentStyle: 'color', textIn: 'blur', energy: 2,
    ambient: ['glow', 'beams', 'sparkles'],
    transitions: ['zoom', 'line', 'morph', 'rise'],
    prefer: P({ hook: ['zoomword', 'words'], text: ['words', 'zoomword', 'split'], features: ['wheel', 'flow', 'orbit'], brand: ['brand', 'orbit'] }),
    css: () => `.tx-line, .zw-main { text-shadow: 0 0 40px color-mix(in srgb, var(--primary) 45%, transparent); }`,
  },
  bloom: {
    label: 'Beauty Bloom', font: 'DM Serif Display', fontParam: 'DM+Serif+Display:ital@0;1&family=DM+Sans:wght@500;700', stack: serif('DM Serif Display'), subStack: sans('DM Sans'),
    headWeight: 400, tracking: -1, mode: 'light',
    colors: { primary: '#E2557C', secondary: '#F6A5BC', background: '#FFEFF3', text: '#4A1838' },
    accentStyle: 'color', textIn: 'blur', energy: 2,
    ambient: ['glow', 'sparkles'],
    transitions: ['morph', 'line', 'zoom', 'rise'],
    prefer: P({ hook: ['words', 'type', 'zoomword'], price: ['card', 'hero', 'counter'], list: ['pills', 'wheel'], features: ['orbit', 'flow'], brand: ['brand', 'orbit'] }),
    css: () => `.acc .wi { font-style: italic; }`,
  },
  retro: {
    label: 'Retro Pop', font: 'Bungee', fontParam: 'Bungee&family=Rubik:wght@600;800', stack: sans('Bungee'), subStack: sans('Rubik'),
    headWeight: 400, upper: true, tracking: 0, mode: 'color',
    colors: { primary: '#FF3B3B', secondary: '#2D5BFF', background: '#FFE45E', text: '#111111' },
    accentStyle: 'marker', textIn: 'slide', energy: 3,
    ambient: ['halftone', 'rays'],
    transitions: ['wipe', 'whip', 'flash', 'morph'],
    prefer: P({ hook: ['zoomword', 'kinetic'], text: ['kinetic', 'split', 'words'], price: ['counter', 'hero'], list: ['pills', 'grid'] }),
    css: () => `.zw-main, .kin-line span { color: #fff; -webkit-text-stroke: 4px #111; paint-order: stroke fill; text-shadow: 7px 7px 0 #111; }
  .pill, .ui-card, .tile, .flow-card, .cta-btn, .notif { border: 5px solid #111 !important; box-shadow: 8px 8px 0 #111 !important; }`,
  },
  blitz: {
    label: 'Sports Blitz', font: 'Oswald', fontParam: 'Oswald:wght@600;700', stack: sans('Oswald'),
    headWeight: 700, upper: true, italic: true, tracking: 0, mode: 'dark',
    colors: { primary: '#FF1E1E', secondary: '#FFFFFF', background: '#0B0B0F', text: '#FFFFFF' },
    accentStyle: 'marker', textIn: 'slide', energy: 3,
    ambient: ['glow', 'streaks'],
    transitions: ['whip', 'flash', 'zoom', 'wipe'],
    prefer: P({ hook: ['zoomword', 'kinetic'], text: ['kinetic', 'split', 'words'], price: ['counter', 'card'], list: ['pills', 'wheel'], features: ['grid', 'flow'] }),
    css: () => `.kin-line span, .zw-main { transform: skewX(-8deg); display: inline-block; }`,
  },
  prime: {
    label: 'Prime Estate', font: 'Montserrat', fontParam: 'Montserrat:wght@500;600;800', stack: sans('Montserrat'),
    headWeight: 800, tracking: -1, mode: 'dark',
    colors: { primary: '#E8C27A', secondary: '#7FB7BE', background: '#0F1E2E', text: '#F4F7FA' },
    accentStyle: 'color', textIn: 'rise', energy: 2,
    ambient: ['glow', 'grid'],
    transitions: ['line', 'whip', 'rise', 'morph'],
    prefer: P({ hook: ['words', 'type', 'zoomword'], price: ['card', 'counter'], list: ['wheel', 'pills'], features: ['flow', 'wheel', 'grid'], brand: ['brand', 'split'] }),
    css: () => `.tx-sub, .chip { letter-spacing: .2em; text-transform: uppercase; font-size: .8em; }`,
  },
  kids: {
    label: 'Kiddies Fun', font: 'Luckiest Guy', fontParam: 'Luckiest+Guy&family=Nunito:wght@700;900', stack: sans('Luckiest Guy'), subStack: sans('Nunito'),
    headWeight: 400, tracking: 1, mode: 'light',
    colors: { primary: '#FF8A00', secondary: '#8E44FF', background: '#E7F6FF', text: '#1D1A4F' },
    accentStyle: 'color', textIn: 'rise', energy: 3,
    ambient: ['bubbles', 'confetti'],
    transitions: ['morph', 'zoom', 'wipe', 'rise'],
    prefer: P({ hook: ['kinetic', 'zoomword'], text: ['kinetic', 'split', 'words'], price: ['counter', 'card'], list: ['grid', 'pills'], features: ['grid', 'orbit'] }),
    css: () => `.zw-main, .kin-line span { color: var(--primary); text-shadow: 6px 6px 0 var(--secondary); }`,
  },
  mono: {
    label: 'Mono Editorial', font: 'Archivo Black', fontParam: 'Archivo+Black&family=Inter:wght@500;700', stack: sans('Archivo Black'), subStack: sans('Inter'),
    headWeight: 400, upper: true, tracking: -3, mode: 'light',
    colors: { primary: '#FF4D00', secondary: '#111111', background: '#F2EFE8', text: '#111111' },
    accentStyle: 'marker', textIn: 'rise', energy: 2,
    ambient: ['marquee', 'grid'],
    transitions: ['whip', 'wipe', 'line', 'rise'],
    prefer: P({ hook: ['kinetic', 'type', 'zoomword'], text: ['kinetic', 'type', 'words'], price: ['counter', 'card'], list: ['pills', 'wheel'], features: ['grid', 'flow'] }),
    css: () => '',
  },
  afro: {
    label: 'Afro Vibes', font: 'Righteous', fontParam: 'Righteous&family=Poppins:wght@600;800', stack: sans('Righteous'), subStack: sans('Poppins'),
    headWeight: 400, tracking: 0, mode: 'dark',
    colors: { primary: '#F2A900', secondary: '#D62828', background: '#1C1007', text: '#FFF4E0' },
    accentStyle: 'marker', textIn: 'rise', energy: 3,
    ambient: ['glow', 'kente', 'particles'],
    transitions: ['wipe', 'morph', 'whip', 'zoom'],
    prefer: P({ hook: ['kinetic', 'zoomword', 'words'], text: ['kinetic', 'split', 'words'], price: ['hero', 'counter', 'card'], list: ['pills', 'wheel'] }),
    css: () => '',
  },
  ocean: {
    label: 'Ocean Breeze', font: 'Nunito', fontParam: 'Nunito:wght@700;900', stack: sans('Nunito'),
    headWeight: 900, tracking: -2, mode: 'light',
    colors: { primary: '#0096C7', secondary: '#FFB703', background: '#E6FAFF', text: '#023047' },
    accentStyle: 'color', textIn: 'rise', energy: 2,
    ambient: ['glow', 'waves', 'bubbles'],
    transitions: ['morph', 'whip', 'rise', 'line'],
    prefer: P({ hook: ['words', 'kinetic', 'zoomword'], price: ['card', 'hero', 'counter'], list: ['phone', 'wheel', 'pills'], features: ['orbit', 'flow', 'grid'], brand: ['notify', 'brand'] }),
    css: () => '',
  },

  // ---------------- premium (Apple-style) styles: small type, lots of space, UI pieces that morph
  apple: {
    label: 'Studio White', font: 'Inter', fontParam: 'Inter:wght@500;600;700;800', stack: sans('Inter'),
    headWeight: 700, tracking: -1, mode: 'light', calm: true, textScale: 0.9, drift: 0.6,
    colors: { primary: '#0071E3', secondary: '#FF375F', background: '#FFFFFF', text: '#1D1D1F' },
    accentStyle: 'color', textIn: 'focus', energy: 1,
    ambient: ['glow'],
    transitions: ['focus', 'dive', 'swoosh', 'morph'],
    prefer: P({ hook: ['flip', 'sentence', 'scatter'], text: ['sentence', 'scatter', 'flip'], price: ['isocard', 'card', 'counter'], list: ['stack', 'ticker', 'widgets'],
      features: ['widgets', 'ticker', 'stack', 'collage'], brand: ['iconmorph', 'collage', 'brand'], cta: ['lockup', 'chat'] }),
    css: () => '',
  },
  midnight: {
    label: 'Midnight Glow', font: 'Inter', fontParam: 'Inter:wght@500;600;700', stack: sans('Inter'),
    headWeight: 600, tracking: -1, mode: 'dark', calm: true, textScale: 0.9, drift: 0.5,
    colors: { primary: '#1E9BFF', secondary: '#6FE3FF', background: '#040A17', text: '#EAF2FF' },
    accentStyle: 'color', textIn: 'focus', energy: 1,
    ambient: ['glow', 'streaks'],
    transitions: ['focus', 'line', 'dive', 'morph'],
    prefer: P({ hook: ['sentence', 'flip', 'scatter'], text: ['sentence', 'flip', 'scatter'], price: ['isocard', 'counter', 'card'], list: ['ticker', 'flow', 'stack'],
      features: ['flow', 'ticker', 'widgets', 'grid'], brand: ['brand', 'iconmorph', 'isocard'], cta: ['lockup'] }),
    css: () => `.sent-line .acc .wi, .flip-c.acc, .tx-line .acc .wi { text-shadow: 0 0 22px color-mix(in srgb, var(--primary) 80%, transparent); }
      .ui-card, .flow-card, .im-box, .chat-bar, .bub.them { background: rgba(14,34,66,.55); border-color: color-mix(in srgb, var(--primary) 45%, transparent); box-shadow: 0 0 40px color-mix(in srgb, var(--primary) 30%, transparent); }`,
  },
  fintech: {
    label: 'Fintech Blue', font: 'Figtree', fontParam: 'Figtree:wght@500;600;700;800', stack: sans('Figtree'),
    headWeight: 700, tracking: -1, mode: 'light', calm: true, textScale: 0.9, drift: 0.8,
    colors: { primary: '#1A2CFF', secondary: '#12A8FF', background: '#F4F6FB', text: '#0A0F2C' },
    accentStyle: 'color', textIn: 'focus', energy: 2,
    ambient: ['glow'],
    transitions: ['swoosh', 'focus', 'morph', 'dive'],
    prefer: P({ hook: ['sentence', 'scatter', 'flip'], text: ['sentence', 'scatter', 'flip'], price: ['isocard', 'card', 'counter'], list: ['stack', 'widgets', 'ticker'],
      features: ['stack', 'widgets', 'flow'], brand: ['isocard', 'iconmorph', 'notify'], cta: ['lockup', 'chat'] }),
    css: () => '',
  },
  pulse: {
    label: 'Health Pulse', font: 'Inter', fontParam: 'Inter:wght@500;600;700;800', stack: sans('Inter'),
    headWeight: 700, tracking: -1, mode: 'light', calm: true, textScale: 0.9, drift: 0.6,
    colors: { primary: '#FF2D55', secondary: '#FF9F0A', background: '#F2F2F5', text: '#1C1C1E' },
    accentStyle: 'color', textIn: 'focus', energy: 1,
    ambient: ['glow'],
    transitions: ['morph', 'focus', 'dive', 'swoosh'],
    prefer: P({ hook: ['sentence', 'flip', 'scatter'], text: ['sentence', 'flip', 'scatter'], price: ['card', 'isocard', 'counter'], list: ['widgets', 'stack', 'ticker'],
      features: ['widgets', 'collage', 'stack'], brand: ['iconmorph', 'collage', 'brand'], cta: ['lockup', 'chat'] }),
    css: () => '',
  },
  graphite: {
    label: 'Graphite Pro', font: 'Inter', fontParam: 'Inter:wght@500;600;700;800', stack: sans('Inter'),
    headWeight: 700, tracking: -1, mode: 'dark', calm: true, textScale: 0.9, drift: 0.6,
    colors: { primary: '#2997FF', secondary: '#BF5AF2', background: '#161617', text: '#F5F5F7' },
    accentStyle: 'color', textIn: 'focus', energy: 2,
    ambient: ['glow', 'grid'],
    transitions: ['dive', 'focus', 'whip', 'morph'],
    prefer: P({ hook: ['flip', 'scatter', 'sentence'], text: ['sentence', 'type', 'scatter', 'flip'], price: ['counter', 'isocard', 'card'], list: ['ticker', 'phone', 'stack'],
      features: ['widgets', 'ticker', 'collage', 'flow'], brand: ['iconmorph', 'notify', 'brand'], cta: ['lockup', 'chat'] }),
    css: () => '',
  },
};

// Every style gets the premium direction (clean type, lots of space, UI pieces that morph, slow drift).
// Each style keeps its own colours, fonts, background and accents, so videos still look different.
const PREMIUM_SHOTS = {
  hook: ['sentence', 'flip', 'scatter'], text: ['sentence', 'scatter', 'flip'], price: ['isocard', 'card', 'counter'],
  list: ['stack', 'ticker', 'widgets'], features: ['widgets', 'ticker', 'stack', 'collage'], brand: ['iconmorph', 'brand', 'collage'], cta: ['lockup', 'chat'],
};
const mix = (a = [], b = []) => { const out = []; for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); } return [...new Set(out)]; };
for (const t of Object.values(THEMES)) {
  if (t.calm) continue;
  t.calm = true;
  t.textScale = t.textScale || 0.92;
  t.drift = t.drift ?? 0.5;
  t.energy = Math.min(t.energy || 2, 2);
  t.textIn = t.textIn === 'slide' ? 'focus' : t.textIn;
  t.ambient = (t.ambient || ['glow']).filter((a) => a !== 'particles').slice(0, 2);
  t.transitions = mix(['focus', 'dive', 'swoosh'], (t.transitions || []).filter((x) => x !== 'flash'));
  const pref = t.prefer || P({});
  t.prefer = Object.fromEntries(Object.keys(pref).map((k) => [k, mix(PREMIUM_SHOTS[k], pref[k])]));
}

export const THEME_KEYS = Object.keys(THEMES);

// v4 premium shots join every style's rotation: giant type slams / posters for loud styles, box reveals for calm ones.
for (const t of Object.values(THEMES)) {
  const add = (cat, front, back = []) => { t.prefer[cat] = [...new Set([...front, ...(t.prefer[cat] || []), ...back])]; };
  if (t.calm) { add('hook', ['reveal'], []); add('text', ['reveal']); }
  else { add('hook', t.energy >= 3 ? ['slam', 'poster'] : ['poster', 'slam']); add('text', ['reveal'], ['marquee3d']); }
}
