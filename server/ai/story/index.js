// Animora Story engine (server side): turns the owner's answers into an art-directed film plan.
// It decides the look (six directions), the story beats and their order, each beat's layout, the transitions,
// and how long each beat holds so the film lands on the exact length asked for. The browser runtime
// (server/ai/motion/browser/story.js) draws it. Only the owner's own words are used; nothing is invented.

const HEX = /^#[0-9a-f]{6}$/i;
const hashStr = (t) => { let h = 2166136261; for (const c of String(t)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const lum = (h) => { const n = parseInt(String(h || '#777777').slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ---------------------------------------------------------------- the six art directions
export const LOOKS = {
  editorial: {
    label: 'Editorial', dark: false, bg: '#F2EDE4', bg2: '#E7DFD1', ink: '#1B1916', mute: '#6E665B', A: '#B4532A', A2: '#2F4A3A',
    display: "'Fraunces', Georgia, serif", ui: "'Inter', system-ui, sans-serif", dw: 600, upper: false, center: false,
    accentWord: true, accentCss: 'font-style:italic', radius: 4, pill: false, motion: 'smooth', grain: 0.10, vignette: 0.18, leak: null,
    grade: 'linear-gradient(180deg, rgba(255,214,170,.18), rgba(40,20,0,.18))', gradeBlend: 'soft-light', photoLabel: '#F2D3B3',
    fonts: ['Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,600', 'Inter:wght@400;500;600;700'], trans: ['wipe', 'rise', 'dissolve', 'portal', 'liquid'], surfaces: ['base', 'alt', 'base', 'accent'],
  },
  noir: {
    label: 'Noir', dark: true, bg: '#0B0A09', bg2: '#15120E', ink: '#F3ECDF', mute: '#A89D8A', A: '#C9A45C', A2: '#E8D5A8',
    display: "'Playfair Display', Georgia, serif", ui: "'Manrope', system-ui, sans-serif", dw: 600, upper: false, center: true,
    accentWord: true, accentCss: 'font-style:italic;color:#C9A45C', radius: 2, pill: false, motion: 'calm', grain: 0.12, vignette: 0.55, leak: '#C9A45C',
    grade: 'linear-gradient(180deg, rgba(201,164,92,.20), rgba(0,0,0,.35))', gradeBlend: 'soft-light', photoLabel: '#E8D5A8',
    fonts: ['Playfair Display:ital,wght@0,600;1,600', 'Manrope:wght@400;500;600;700'], trans: ['dissolve', 'iris', 'through', 'rise', 'liquid'], surfaces: ['base', 'alt', 'base', 'alt'],
  },
  bold: {
    label: 'Bold', dark: true, bg: '#111111', bg2: '#F4F1EA', ink: '#FFFFFF', mute: 'rgba(255,255,255,.72)', A: '#FF4D2E', A2: '#FFD23F',
    display: "'Archivo Black', 'Arial Black', sans-serif", ui: "'Inter', system-ui, sans-serif", dw: 400, upper: true, center: false,
    accentWord: true, accentCss: '', radius: 0, pill: false, motion: 'snap', grain: 0.06, vignette: 0.2, leak: null,
    grade: null, photoLabel: '#FFD23F',
    fonts: ['Archivo Black', 'Inter:wght@400;500;600;700;800'], trans: ['block', 'crash', 'whip', 'open', 'wipe', 'glitch'], surfaces: ['base', 'accent', 'base', 'accent'],
  },
  fresh: {
    label: 'Fresh', dark: false, bg: '#FAFAF6', bg2: '#EEF3EE', ink: '#14171A', mute: '#5E676F', A: '#2F6BFF', A2: '#16B88A',
    display: "'Plus Jakarta Sans', system-ui, sans-serif", ui: "'Plus Jakarta Sans', system-ui, sans-serif", dw: 800, upper: false, center: true,
    accentWord: true, accentCss: '', radius: 36, pill: true, motion: 'smooth', grain: 0, vignette: 0, leak: null,
    grade: 'linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.08))', gradeBlend: 'soft-light', photoLabel: '#FFFFFF',
    fonts: ['Plus Jakarta Sans:wght@400;500;600;700;800'], trans: ['iris', 'portal', 'whip', 'rise', 'dissolve'], surfaces: ['base', 'alt', 'accent', 'base'],
  },
  tech: {
    label: 'Tech', dark: true, bg: '#070B14', bg2: '#0C1322', ink: '#EAF1FF', mute: '#8391AC', A: '#4CC9F0', A2: '#7B61FF',
    display: "'Space Grotesk', system-ui, sans-serif", ui: "'JetBrains Mono', ui-monospace, monospace", dw: 700, upper: false, center: false,
    accentWord: true, accentCss: '', radius: 14, pill: false, motion: 'snap', grain: 0.05, vignette: 0.4, leak: '#4CC9F0',
    grade: 'linear-gradient(180deg, rgba(40,90,255,.18), rgba(0,0,20,.3))', gradeBlend: 'soft-light', photoLabel: '#4CC9F0',
    fonts: ['Space Grotesk:wght@500;600;700', 'JetBrains Mono:wght@400;500;600'], trans: ['glitch', 'crash', 'wipe', 'open', 'block'], surfaces: ['base', 'alt', 'base', 'alt'],
  },
  clean: {
    label: 'Clean', dark: false, bg: '#FFFFFF', bg2: '#F1F1F3', ink: '#0B0B0C', mute: '#6C6C72', A: '#2D5BFF', A2: '#111111',
    display: "'Inter', system-ui, sans-serif", ui: "'Inter', system-ui, sans-serif", dw: 800, upper: false, center: true,
    accentWord: true, accentCss: '', radius: 26, pill: true, motion: 'smooth', grain: 0, vignette: 0, leak: null,
    grade: null, photoLabel: '#FFFFFF',
    fonts: ['Inter:wght@400;500;600;700;800'], trans: ['rise', 'through', 'portal', 'dissolve', 'wipe'], surfaces: ['base', 'alt', 'base', 'accent'],
  },
};
export const LOOK_IDS = Object.keys(LOOKS);
const AFFINITY = [
  [/luxur|jewel|perfume|fragrance|watch|hotel|lounge|wine|spirit|champagne|real estate|propert|wedding|bridal|event plan|interior|fashion|couture|gold/i, ['noir', 'editorial']],
  [/caf[eé]|coffee|bakery|bake|cake|restaurant|kitchen|food|chef|catering|boutique|beauty|salon|spa|lash|nail|makeup|hair|skin|photograph|book|florist|flower|tailor/i, ['editorial', 'noir', 'fresh']],
  [/gym|fitness|sport|football|promo|sale|music|party|club|street|sneaker|fast food|burger|pizza|grill|suya|church|concert|show|barber|car wash|logistic|dispatch|delivery/i, ['bold', 'tech']],
  [/pharma|clinic|hospital|health|dental|kid|child|school|tutor|clean|laundry|grocery|market|supermarket|pet|vet|care|organic|farm|water|juice|smoothie|yoga/i, ['fresh', 'clean']],
  [/tech|software|app\b|apps|repair|laptop|phone|gadget|crypto|fintech|payment|bank|digital|computer|electronic|solar|cctv|security|internet|web|game|gaming|data/i, ['tech', 'clean']],
  [/law|legal|consult|account|finance|insur|agency|studio|architect|print|brand|marketing|auto|car\b|cars|motor/i, ['clean', 'editorial', 'noir']],
];

// ---------------------------------------------------------------- choose the look
export function pickLook({ facts, style, brief, salt, previous }) {
  const text = [facts.category, facts.name, ...(facts.features || [])].join(' ');
  const fits = new Set(AFFINITY.filter(([re]) => re.test(text)).flatMap(([, ids]) => ids));
  const prev = (String(previous || '').match(/animora-direction:story-([a-z]+);/) || [])[1];
  // a style the owner picked sets the mood (dark or light); a style chosen for them only nudges
  const mood = style && !brief?.styleAuto ? (style?.palette?.theme === 'light' || /light|white|fresh|clean|bloom|studio/i.test(style.slug || '') ? 'light' : /dark|night|neon|midnight|noir|luxe|glow/i.test(style.slug || '') ? 'dark' : null) : null;
  const w = LOOK_IDS.filter((id) => id !== prev).map((id) => [id, (fits.has(id) ? (prev ? 3 : 9) : 1) * (mood ? (LOOKS[id].dark === (mood === 'dark') ? 2 : 0.35) : 1)]);
  const r = mulberry(hashStr(`${facts.name}|${text}|${salt}|look`) % 2147483647 || 3)();
  let t = r * w.reduce((n, [, x]) => n + x, 0);
  for (const [id, x] of w) { t -= x; if (t <= 0) return id; }
  return w[0][0];
}

// ---------------------------------------------------------------- the story
const BASE = { sting: 1.9, hook: 3.8, stack: 3.8, matte: 4.8, cover: 4.4, photo: 3.1, pip: 3.6, popout: 3.8, phone: 3.9, chat: 0, features: 0, offer: 3.0, products: 0, info: 2.8, statement: 3.0, end: 4.2 };
const featDur = (n, v) => (v === 'seq' ? 0.7 + 1.45 * n : 1.9 + 0.75 * n);
const prodDur = (n) => (n === 1 ? 3.2 : 1.7 + 0.75 * n);

export function composeStory({ facts: f, duration, seed, look: lookId, aspect, overlap = 0.7 }) {
  const r = mulberry(seed), pick = (a) => a[Math.floor(r() * a.length)];
  const L = { id: lookId, ...LOOKS[lookId] };
  const head = f.heads[0] || f.name;
  const cuts = new Set(f.cutouts || []);
  const photos = f.photos.map((url) => ({ url, fit: f.fits[url] || 'cover', cut: cuts.has(url), pos: `${45 + Math.round(r() * 10)}% ${40 + Math.round(r() * 20)}%` }));
  const beats = [];
  const add = (type, data, keep, v, extra = {}) => beats.push({ type, data, keep, v, ...extra });
  const keyWord = (t) => String(t).split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}&'-]/gu, '')).filter(Boolean).sort((x, y) => y.length - x.length)[0] || f.name;
  // the opening: a photo when there is a good one (full, split, magazine cover or photo-in-type), otherwise type (plain or stacked blocks)
  const p0 = photos.find((p) => p.fit === 'cover' && !p.cut) || null;
  let hookType = 'hook', hookV = 'type';
  if (p0) {
    hookV = pick(['full', 'full', 'split']);
    const roll = r();
    if (L.id === 'editorial' && roll < 0.4) hookType = 'cover';
    else if ((L.id === 'noir' || L.id === 'clean' || L.id === 'fresh') && roll < 0.35) hookType = 'matte';
  } else if (['bold', 'fresh', 'tech'].includes(L.id) && r() < 0.55) hookType = 'stack';
  const feats = f.features.slice(0, 4);
  const word = f.name.length <= 12 ? f.name : keyWord(head);
  const hookData = { headline: head, label: f.category || f.name, sub: f.sub && f.sub !== head ? f.sub : '', ...(p0 && hookV !== 'type' ? { photo: p0.url, fit: p0.fit, pos: p0.pos } : {}) };
  if (hookType === 'cover') hookData.lines = feats.slice(0, 3);
  if (hookType === 'matte') hookData.word = word;
  add(hookType, hookData, 10, hookType === 'hook' ? hookV : undefined);
  const rest = photos.filter((p) => !(p0 && hookV !== 'type' && p === p0));
  const cap = (i) => feats[i] || f.products[i]?.title || '';
  // each further picture gets the layout that suits it: a cut-out product steps out of a frame, an app shows on a phone,
  // two pictures together become a picture-in-picture, otherwise full screen or framed
  let usedPhone = false;
  const photoBeat = (caption, label, keep, forceV) => {
    if (!rest.length) return;
    const p = rest.shift();
    if (p.cut) return add('popout', { photo: p.url, caption, label }, keep);
    if (f.appy && !usedPhone && p.fit === 'cover') { usedPhone = true; return add('phone', { photo: p.url, fit: p.fit, caption: caption || head, cta: f.cta }, keep); }
    const q = rest.find((x) => !x.cut);
    if (q && r() < 0.5) { rest.splice(rest.indexOf(q), 1); return add('pip', { photo: p.url, fit: p.fit, pos: p.pos, photo2: q.url, fit2: q.fit, caption, label }, keep); }
    add('photo', { photo: p.url, fit: p.fit, pos: p.pos, caption, label, treat: L.id === 'bold' ? pick(['duotone', 'halftone', 'none']) : 'none' }, keep, forceV || pick(['full', 'frame']));
  };
  let used = 0;
  photoBeat(hookType === 'hook' && hookV === 'type' ? (f.sub && f.sub !== head ? f.sub : '') : '', f.category || '', 6);
  if (feats.length >= 2) {
    if (f.whatsapp && r() < 0.6) add('chat', { items: feats, cta: f.cta }, 8);
    else { const v = feats.length <= 3 && r() < 0.45 ? 'seq' : 'list'; add('features', { items: feats, title: f.category || f.name, ...(aspect === '16:9' && rest[0] && !rest[0].cut ? { photo: rest[0].url, fit: rest[0].fit, pos: rest[0].pos } : {}) }, 8, v); }
    used = feats.length;
  } else if (feats.length === 1) add('statement', { text: feats[0] }, 5);
  photoBeat(cap(used) || '', f.name, 5);
  const priced = f.products.filter((p) => p.price);
  if (priced.length) add('products', { items: priced.slice(0, 4), title: 'Prices' }, 8, priced.length === 1 ? 'hero' : 'list', { surface: L.dark ? 'alt' : 'base' });
  if (f.offer) add('offer', { offer: f.offer, label: 'Special offer' }, 9, 'center', { surface: 'accent' });
  photoBeat('', '', 4, 'full');
  if (f.when) add('info', { when: f.when, place: f.place }, 6);
  add('end', { cta: f.cta, phone: f.phone, whatsapp: f.whatsapp, place: f.place }, 10, L.center ? 'center' : pick(['center', 'left']));
  if (duration >= 20 && (L.id === 'noir' || r() < 0.4)) beats.unshift({ type: 'sting', data: {}, keep: 2 });

  // material for long films, best first; when it runs out the list starts again with new crops and layouts
  const ideas = [];
  if (f.place && !f.when) ideas.push(() => ({ type: 'info', data: { place: f.place }, keep: 3 }));
  if (f.heads[1] && f.heads[1] !== head) ideas.push(() => ({ type: 'statement', data: { text: f.heads[1], label: f.name }, keep: 3 }));
  if (f.sub && f.sub !== head && hookV !== 'type') ideas.push(() => ({ type: 'statement', data: { text: f.sub, label: f.name }, keep: 3 }));
  photos.forEach((p, i) => ideas.push(() => (p.cut ? { type: 'popout', data: { photo: p.url, caption: feats[(i + 1) % Math.max(1, feats.length)] || '', label: f.name }, keep: 2 } : { type: 'photo', data: { photo: p.url, fit: p.fit, pos: `${30 + Math.round(r() * 40)}% ${30 + Math.round(r() * 40)}%`, caption: feats[(i + 1) % Math.max(1, feats.length)] || '', label: f.name }, keep: 2, v: pick(['frame', 'full']) })));
  feats.forEach((x) => ideas.push(() => ({ type: 'statement', data: { text: x, label: f.category || f.name }, keep: 2 })));
  priced.forEach((p) => ideas.push(() => ({ type: 'products', data: { items: [p], title: 'Prices' }, keep: 2, v: 'hero' })));
  if (f.offer) ideas.push(() => ({ type: 'offer', data: { offer: f.offer, label: 'Special offer' }, keep: 2, surface: 'accent' }));
  if (f.cta) ideas.push(() => ({ type: 'statement', data: { text: f.cta, label: f.name }, keep: 2 }));
  ideas.push(() => ({ type: 'statement', data: { text: head, label: f.category || f.name }, keep: 2 }));
  if (!beats.some((b) => b.type === 'sting')) ideas.push(() => ({ type: 'sting', data: {}, keep: 2 }));

  const base = (b) => (b.type === 'features' ? featDur(b.data.items.length, b.v) : b.type === 'chat' ? 1.6 + 1.05 * (b.data.items.length + (b.data.cta ? 1 : 0)) : b.type === 'products' ? prodDur(b.data.items.length) : BASE[b.type]);
  beats.forEach((b) => { b.dur = base(b); });
  const total = () => beats.reduce((n, b) => n + b.dur, 0) - overlap * (beats.length - 1);
  // too long: drop the least important beats, then tighten
  while (total() > duration + 0.01) {
    const droppable = beats.filter((b) => b.keep < 9);
    if (!droppable.length || beats.length <= 3) break;
    const worst = droppable.reduce((a, b) => (b.keep < a.keep ? b : a));
    beats.splice(beats.indexOf(worst), 1);
  }
  if (total() > duration) { const k = Math.max(0.6, (duration + overlap * (beats.length - 1) - 2.6) / (beats.reduce((n, b) => n + b.dur, 0) - beats[beats.length - 1].dur)); beats.forEach((b, i) => { if (i < beats.length - 1) b.dur *= k; }); }
  // too short: add more of the owner's material (spread through the film, never the same kind twice in a row)
  const MAXB = 7, MAXE = 8;
  const room = () => duration - total() - beats.slice(0, -1).reduce((n, b) => n + Math.max(0, MAXB - b.dur) * 0.35, 0);
  let k = 0;
  while (room() > 3 && ideas.length && k < ideas.length * 2 && beats.length < 24) {
    const sting = ideas[k % ideas.length]().type === 'sting';
    const b = ideas[k % ideas.length](); k++;
    if (sting && (k > ideas.length || beats.some((x) => x.type === 'sting'))) continue;
    if (k > ideas.length && b.type === 'info') continue;
    b.dur = base(b);
    if (sting) { beats.unshift(b); continue; }
    const slots = [];
    for (let i = beats.findIndex((x) => ['hook', 'stack', 'matte', 'cover'].includes(x.type)) + 1; i < beats.length; i++) if (beats[i - 1].type !== b.type && beats[i].type !== b.type) slots.push(i);
    const at = slots.length ? slots[(k * 3) % slots.length] : beats.length - 1;
    beats.splice(at, 0, b);
  }
  const endB = beats[beats.length - 1];
  let gap = duration - total();
  if (gap > 0) { const grow = Math.min(gap, Math.max(0, Math.min(MAXE, 5.5) - endB.dur)); endB.dur += grow; gap -= grow; }
  if (gap > 0) { const mids = beats.slice(0, -1).filter((b) => b.type !== 'sting'), cap = mids.reduce((n, b) => n + Math.max(0, MAXB - b.dur), 0); if (cap > 0) { const use = Math.min(gap, cap); mids.forEach((b) => { b.dur += use * (Math.max(0, MAXB - b.dur) / cap); }); gap -= use; } }
  if (gap > 0) { const grow = Math.min(gap, Math.max(0, MAXE - endB.dur)); endB.dur += grow; gap -= grow; }
  if (gap > 0) { const mids = beats.slice(0, -1).filter((b) => b.type !== 'sting'); mids.forEach((b) => { b.dur += gap / mids.length; }); }
  // exact: the closing beat takes what is left
  endB.dur = +(endB.dur + (duration - total())).toFixed(3);
  beats.forEach((b) => { b.dur = +b.dur.toFixed(3); });

  // surfaces and transitions: never the same twice in a row
  let sIdx = Math.floor(r() * 2), lastT = null;
  beats.forEach((b, i) => {
    if (!b.surface) { const photoFull = (b.type === 'photo' && b.v === 'full') || (b.type === 'hook' && b.v === 'full') || ['matte', 'cover', 'pip'].includes(b.type); b.surface = photoFull ? 'base' : L.surfaces[(sIdx++) % L.surfaces.length]; }
    if (b.type === 'end') b.surface = L.dark ? 'base' : (r() < 0.5 ? 'base' : 'alt');
    if (i > 0 && beats[i - 1].surface === b.surface && b.surface === 'accent') b.surface = 'base';
    if (i) { const pool = L.trans.filter((x) => x !== lastT); b.trans = pool[Math.floor(r() * pool.length)]; lastT = b.trans; }
  });
  return beats;
}

// the colours: the owner's colour leads when it reads well on the look
export function lookFor(id, own) {
  const L = { id, ...LOOKS[id] };
  if (HEX.test(own?.primary || '')) {
    const p = own.primary;
    if (contrast(p, L.bg) >= 2.2) L.A = p; else L.A2 = p;
    if (HEX.test(own.secondary || '') && contrast(own.secondary, L.bg) >= 2) L.A2 = own.secondary;
    if (id === 'noir') L.accentCss = `font-style:italic;color:${L.A}`;
    if (L.leak) L.leak = L.A;
  }
  return L;
}

export const fontLink = (look) => `https://fonts.googleapis.com/css2?${look.fonts.map((f) => { const [n, ax] = f.split(':'); return `family=${n.replace(/ /g, '+')}${ax ? ':' + ax : ''}`; }).join('&')}&display=block`;
export const fontFamilies = (look) => look.fonts.map((f) => f.split(':')[0]);

// ---------------------------------------------------------------- music: a bed that suits the look, and cuts on the beat
import { readFileSync } from 'node:fs';
const LIB = (() => { try { return JSON.parse(readFileSync(new URL('../../../assets/music/library.json', import.meta.url), 'utf8')).tracks || {}; } catch { return {}; } })();
export const musicLibrary = () => LIB;
const POOL_FOR = { piano: 'noir', soft: 'clean' };
/** Pick a track for this look (never the one the last version used). */
export function pickTrack({ look, seed, avoid = null, pool = null }) {
  const want = POOL_FOR[pool] || pool || look;
  let ids = Object.keys(LIB).filter((id) => LIB[id].look === want && id !== avoid);
  if (!ids.length) ids = Object.keys(LIB).filter((id) => id !== avoid);
  if (!ids.length) return null;
  return ids[Math.floor(mulberry((seed * 31 + 17) % 2147483647 || 3)() * ids.length)];
}
export const trackMusic = (id) => (LIB[id] ? { url: `/music/${id}.mp3`, id, title: LIB[id].title, artist: LIB[id].artist, bpm: LIB[id].bpm } : null);
/**
 * Nudge each cut onto the music's beat (bars first, then any beat), never more than a third of a second,
 * keeping every beat long enough and the film's total length exact (the closing beat absorbs the rest).
 */
export function snapToBeats(beats, trackId, duration, overlap = 0.7) {
  const t = LIB[trackId]; if (!t || beats.length < 2) return beats;
  const grid = t.beats || [], bars = t.bars || [];
  const near = (x, arr) => arr.reduce((b, v) => (Math.abs(v - x) < Math.abs(b - x) ? v : b), Infinity);
  let start = 0;
  const cutAt = 0.32;   // the moment a cut is felt: a little into the transition
  for (let i = 0; i < beats.length - 1; i++) {
    const nextStart = start + beats[i].dur - overlap;
    const feel = nextStart + cutAt;
    const bar = near(feel, bars), any = near(feel, grid);
    const target = Math.abs(bar - feel) <= 0.34 ? bar : Math.abs(any - feel) <= 0.3 ? any : feel;
    const nd = +(beats[i].dur + (target - feel)).toFixed(3);
    if (nd >= 1.4) beats[i].dur = nd;
    start += beats[i].dur - overlap;
  }
  const last = beats[beats.length - 1];
  last.dur = +(duration - start).toFixed(3);
  if (last.dur < 2.4) { // the closing card needs room: give back time from the longest middle beat
    const need = 2.4 - last.dur, long = beats.slice(0, -1).reduce((a, b) => (b.dur > a.dur ? b : a));
    long.dur = +(long.dur - need).toFixed(3); last.dur = 2.4;
  }
  return beats;
}
