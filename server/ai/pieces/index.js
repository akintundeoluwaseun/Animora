// Animora Pieces engine: every video is "spelled" from the motion library (server/ai/motion/browser/pieces*.js).
// The business's facts decide WHICH pieces fit (photos -> photo shots, a price -> price burst, a date -> countdown,
// an address -> map pin ...). The seed (brand + Regenerate) decides HOW each one plays: variations, backgrounds,
// camera moves, transitions. So two businesses, or two presses of Regenerate, never get the same film.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GSAP_CDN } from '../../engine/prompts.js';
import { lookFor, fontsUrl } from '../motion/looks.js';
import { geminiGenerate } from '../../engine/gemini.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'motion', 'browser');
let RUNTIME = null;
const runtime = () => (RUNTIME ||= ['pieces.js', 'atoms.js', 'pieces2.js', 'premium.js', 'signature.js'].map((f) => readFileSync(path.join(dir, f), 'utf8')).join('\n;\n'));
export const PIECES_ASPECTS = ['9:16'];   // the library is laid out for vertical video; other sizes use the Motion engine
const SIZES = { '9:16': [1080, 1920], '4:5': [1080, 1350] };
// the eight signature templates (recipes live in motion/browser/signature.js); they work at every size
export const TEMPLATE_IDS = ['type-reactor', 'luxury-product', 'hud-tech', 'liquid-chrome', 'sports-hype', 'swiss-editorial', 'visualizer', 'cinematic-logo'];
const TPL_SIZES = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };
export const isTemplateBrief = (brief) => TEMPLATE_IDS.includes(brief?.template);
const DUR = { 'open-depth': 3.8, 'open-sweep': 3.6, 'open-split': 3.4, 'open-shapes': 3.8, 'open-light': 3.8, title: 3.6, 'text-cascade': 3.2, 'text-slot': 4.2, 'text-marquee': 3.8, 'text-stack': 3.6, 'photo-depth': 3.8, 'photo-pop': 4.0, 'photo-split': 4.0, 'photo-phone': 4.2, 'photo-cinema': 4.0, 'info-price': 3.6, 'info-checks': 3.8, 'info-stat': 3.6, 'info-quote': 4.2, 'info-tiles': 3.8, 'info-countdown': 4.0, 'info-location': 3.8, 'info-compare': 3.8, 'end-particles': 4.2, 'end-press': 4.2, 'end-draw': 4.0, 'end-glass': 4.0 };
const OVERLAP = 0.5;   // what a scene spends on its transition, on average (measured)
const DARK_ONLY = new Set(['photo-depth', 'photo-cinema', 'open-light', 'end-glass']);

export const isPieces = (html) => /window\.PIECES_FILM = /.test(String(html || ''));
export const readPieces = (html) => { const m = String(html || '').match(/window\.PIECES_FILM = (.*);\n/); try { return m ? JSON.parse(m[1]) : null; } catch { return null; } };
const esc = (s) => String(s).replace(/</g, '\\u003c');
const str = (v, n = 80) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n));
const hashStr = (t) => { let h = 2166136261; for (const c of String(t)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const lum = (h) => { const n = parseInt(String(h || '#777777').slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const HEX = /^#[0-9a-f]{6}$/i;

// the facts a video may use, taken from the owner's answers (never invented)
function factsOf(plan = {}, brief = {}, assets = []) {
  const photos = assets.filter((a) => (a.kind || 'image') === 'image' && a.role !== 'logo' && !/logo/i.test(a.name || '')).map((a) => a.url);
  // What each picture can honestly do: small, very wide/tall or flat pictures are shown whole on a dimmed copy of themselves, never cropped into a circle or blown up.
  const fitOf = (m) => { const w = Number(m.width) || 0, h = Number(m.height) || 0; if (!w || !h) return 'cover'; const ratio = w / h; return Math.min(w, h) < 600 || ratio > 2.1 || ratio < 0.48 ? 'contain' : 'cover'; };
  const fits = {}; for (const a of assets) if (a.url) fits[a.url] = fitOf(a);
  const logo = assets.find((a) => (a.kind || 'image') === 'image' && (a.role === 'logo' || /logo/i.test(a.name || '')))?.url || null;
  const name = str(brief.name || plan.business?.name || 'Your business', 40);
  const heads = [].concat(brief.headlines || [], brief.headline || []).map((h) => str(h, 60)).filter(Boolean);
  const features = [].concat(brief.features || []).map((f) => str(f, 34)).filter(Boolean).slice(0, 4);
  const products = [].concat(brief.products || []).map((p) => { const m = String(p).match(/^(.*?)[\s:–-]*((?:₦|N|NGN|\$)\s?[\d,.]+\s?[km]?)\s*$/i); return m ? { title: str(m[1], 34), price: m[2].replace(/^N(?=\d)/, '₦') } : { title: str(p, 34) }; });
  const priced = products.find((p) => p.price);
  const contact = str(brief.contact, 120), phone = (contact.match(/(\+?\d[\d\s-]{7,}\d)/) || [])[1] || '';
  const place = str(brief.address || (contact.split(/[·|,]/).find((x) => /street|road|way|avenue|lagos|abuja|ibadan|lekki|ikeja|island|close|estate|plaza|mall|area/i.test(x)) || ''), 60);
  return { fits, name, mono: name.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter((w) => !/^(the|and|of)$/i.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'A', heads, features, products, priced, offer: str(brief.offer, 30), when: str(brief.when, 60), cta: str(brief.cta || [].concat(brief.ctas || [])[0] || 'Order now', 28), phone, place, photos, logo, category: str(brief.category, 40), sub: str(heads[1] || brief.goal || '', 90) };
}
const split2 = (t) => { const w = String(t).split(/\s+/); if (w.length < 3) return w.join(' '); const k = Math.ceil(w.length / 2); return w.slice(0, k).join(' ') + '|' + w.slice(k).join(' '); };

/** Choose the pieces for this business and this seed, and fill each with the business's own words. */
export function composePieces({ facts: f, duration = 24, seed = 1, energy = 'medium' }) {
  const r = mulberry(seed), pick = (a) => a[Math.floor(r() * a.length)];
  const head = f.heads[0] || f.name, key = String(head).split(/\s+/).sort((a, b) => b.length - a.length)[0] || '';
  const words = (f.features.length ? f.features : f.products.map((p) => p.title)).map((w) => w.split(/\s+/).slice(0, 2).join(' ')).slice(0, 3);
  // A phone mock-up only fits businesses that live in an app or online. A laptop repair shop is not shown as a phone.
  const appy = /\b(app|apps|software|saas|platform|social media|online store|e-?commerce|delivery app|mobile app|website|web ?site|game|gaming)\b/i.test([f.category, f.name, ...(f.features || [])].join(' ')) && !/repair|fix|service centre|service center/i.test(f.category || '');
  const scenes = [];
  const opener = pick(['open-depth', 'open-sweep', 'open-split', 'open-shapes', 'open-light', 'title', 'title']);
  scenes.push({ piece: opener, data: opener === 'open-sweep' || opener === 'open-shapes' || opener === 'open-light' ? { headline: f.name, sub: f.category || f.sub } : opener === 'open-split' ? { headline: (words[0] || f.name) + '|' + (words[1] || ''), sub: f.name } : opener === 'open-depth' ? { headline: split2(head), words: f.features, sub: f.name } : { kicker: f.category || f.name, headline: split2(head), key, sub: f.sub } });
  const middle = [];
  f.photos.slice(0, Math.max(2, Math.min(5, Math.round(duration / 9)))).forEach((img, i) => { const p = pick(i ? ['photo-pop', 'photo-split', ...(appy ? ['photo-phone'] : [])] : ['photo-depth', 'photo-cinema', 'photo-pop', ...(appy ? ['photo-phone'] : [])]); middle.push({ piece: p, data: p === 'photo-depth' ? { img, tag: f.category || f.name, headline: f.sub || head } : p === 'photo-pop' ? { img, callouts: [f.features[0], f.features[1], f.priced ? `${f.priced.title} ${f.priced.price}` : f.features[2]].filter(Boolean) } : p === 'photo-split' ? { img, headline: head } : p === 'photo-phone' ? { img, headline: head, title: f.name, subtitle: f.category, price: f.priced?.price || '', cta: f.cta.split(' ')[0] } : { img, kicker: f.category, headline: head } }); });
  if (f.offer || f.priced) middle.push({ piece: 'info-price', kind: 'brand', data: { label: f.offer && !/\d/.test(f.offer) ? f.offer : f.priced?.title || 'Now', old: '', price: /\d/.test(f.offer) ? f.offer : f.priced?.price, note: f.priced && /\d/.test(f.offer) ? f.priced.title : '' } });
  if (f.when) middle.push({ piece: 'info-countdown', data: { kicker: 'Coming up', date: f.when, days: 3, hours: 12, mins: 45 } });
  if (f.features.length >= 3) middle.push(pick([{ piece: 'info-checks', data: { headline: `Why ${f.name}`, items: f.features } }, { piece: 'info-tiles', data: { headline: `${f.name} gives you`, items: f.features } }]));
  if (words.length >= 2) middle.push(pick([{ piece: 'text-slot', data: { lead: 'Always', words } }, { piece: 'text-stack', data: { word: (f.name.split(/\s+/)[0].length >= 3 ? f.name.split(/\s+/)[0] : words[0]), tag: f.category || f.name } }, { piece: 'text-marquee', data: { words: words.map((w) => w.toUpperCase()), brand: f.name } }, { piece: 'text-cascade', data: { headline: split2(f.heads[1] || head), key, sub: f.sub } }]));
  if (f.place) middle.push({ piece: 'info-location', data: { kicker: 'Find us', place: f.place, hours: '' } });
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  // the business's photo, its offer and its date always make the cut; the rest come in a different order each time
  const must = middle.filter((m, i) => (m.piece.startsWith('photo') && middle.findIndex((x) => x.piece.startsWith('photo')) === i) || m.piece === 'info-price' || m.piece === 'info-countdown');
  middle.splice(0, middle.length, ...must, ...shuffle(middle.filter((m) => !must.includes(m))));
  const ending = f.phone ? pick(['end-press', 'end-glass', 'end-press', 'end-particles', 'end-draw']) : pick(['end-particles', 'end-draw', 'end-glass']);
  const end = { piece: ending, data: ending === 'end-press' ? { headline: f.sub ? f.sub.split('.')[0] + '.' : head, cta: f.cta, phone: f.phone, where: [f.name, f.place].filter(Boolean).join(' · ') } : ending === 'end-glass' ? { name: f.name, line: f.sub || head, cta: f.cta, phone: f.phone } : { mono: f.mono, name: f.name, tagline: f.place || f.category, logo: ending === 'end-particles' ? f.logo : undefined } };
  // fit the length: keep the opener and the ending, take as many middle scenes as the duration allows
  const cost = (p) => (DUR[p] || 3.8) + OVERLAP; let total = cost(opener) + cost(ending); const keep = [];
  for (const m of middle) { if (total + cost(m.piece) > duration + 0.2) continue; keep.push(m); total += cost(m.piece); }
  // Long films: every extra scene is a DIFFERENT piece with DIFFERENT words from the owner's own details, never the same two scenes again.
  const lines = [...new Set([...f.heads, ...f.features, ...f.products.map((p) => p.title), f.sub, f.cta, f.category].map((x) => str(x, 60)).filter((x) => x && x.length > 2))];
  const L = (i) => lines[i % Math.max(1, lines.length)] || head;
  const keyOf = (t) => String(t).split(/\s+/).sort((a, b) => b.length - a.length)[0] || '';
  const uniqWords = [...new Set(lines.join(' ').split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, '')).filter((w) => w.length >= 3))];
  const wordsAt = (i, n) => Array.from({ length: n }, (_, k) => uniqWords[(i * 2 + k) % Math.max(1, uniqWords.length)] || f.name);
  const leads = ['Always', 'Simply', 'Truly', 'Just'];
  const FILL = [
    { piece: 'text-cascade', data: (i) => ({ headline: split2(L(i)), key: keyOf(L(i)), sub: '' }) },
    { piece: 'title', data: (i) => ({ kicker: f.category || f.name, headline: split2(L(i + 1)), key: keyOf(L(i + 1)), sub: '' }) },
    { piece: 'text-stack', data: (i) => ({ word: keyOf(L(i)), tag: f.name }) },
    { piece: 'text-marquee', data: (i) => ({ words: wordsAt(i, 5).map((w) => w.toUpperCase()), brand: f.name }) },
    { piece: 'text-slot', ok: () => uniqWords.length >= 2, data: (i) => ({ lead: leads[i % leads.length], words: wordsAt(i, 3) }) },
    { piece: 'open-sweep', data: (i) => ({ headline: f.name, sub: L(i) }) },
    { piece: 'open-split', ok: () => uniqWords.length >= 2, data: (i) => ({ headline: wordsAt(i, 2).join('|'), sub: f.name }) },
    { piece: 'open-shapes', data: (i) => ({ headline: f.name, sub: L(i + 2) }) },
    { piece: 'open-light', data: (i) => ({ headline: L(i + 1), sub: f.name }) },
  ].filter((x) => !x.ok || x.ok());
  const cycle = () => { const c = shuffle(FILL.slice()); return c; };
  let fillQ = cycle(), fi = 0, lastPiece = keep.length ? keep[keep.length - 1].piece : opener;
  while (total + cost('title') <= duration + 0.2 && fi < 60) {
    if (!fillQ.length) fillQ = cycle();
    let k = fillQ.findIndex((x) => x.piece !== lastPiece && !keep.slice(-2).some((m) => m.piece === x.piece)); if (k < 0) k = fillQ.findIndex((x) => x.piece !== lastPiece); if (k < 0) { fillQ = cycle(); continue; }
    const x = fillQ.splice(k, 1)[0]; if (total + cost(x.piece) > duration + 0.2) break;
    keep.push({ piece: x.piece, data: x.data(fi) }); total += cost(x.piece); lastPiece = x.piece; fi++;
  }
  // no scene twice in a row, and never the same piece as the opener or the ending right next to it
  const ordered = shuffle(keep.slice());
  for (let a = 1; a < ordered.length; a++) if (ordered[a].piece === ordered[a - 1].piece) { const b = ordered.findIndex((m, x) => x > a && m.piece !== ordered[a - 1].piece && (ordered[x + 1] ? ordered[x + 1].piece !== ordered[a].piece : true)); if (b > 0) [ordered[a], ordered[b]] = [ordered[b], ordered[a]]; }
  const all = [scenes[0], ...ordered, end];
  for (const sc of all) if (sc.data && sc.data.img && f.fits) sc.data.fit = f.fits[sc.data.img] || 'cover';
  return { scenes: all, energy };
}

// The computer chooses the direction. People never pick a template: the business decides what fits, the seed decides the rest,
// and every Regenerate suggests a different direction than the last one (read back from a marker left in the previous film).
const AFFINITY = [
  [/jewel|watch|perfum|fragrance|fashion|luxur|boutique|cosmetic|skin|beauty|salon|spa|furniture|interior|car|auto/i, ['luxury-product', 'liquid-chrome', 'cinematic-logo', 'swiss-editorial']],
  [/tech|software|app\b|laptop|computer|phone|gadget|it |digital|data|cyber|crypto|fintech|ai\b|repair|electronic/i, ['hud-tech', 'liquid-chrome', 'type-reactor', 'cinematic-logo']],
  [/gym|fitness|sport|football|training|boxing|athlet|run|yoga|health club/i, ['sports-hype', 'type-reactor', 'hud-tech']],
  [/music|dj|party|event|concert|club|church|festival|show|ticket|artist|band|studio/i, ['visualizer', 'type-reactor', 'sports-hype', 'cinematic-logo']],
  [/real estate|property|architect|design|agency|consult|school|education|law|finance|account|photograph|media|brand/i, ['swiss-editorial', 'cinematic-logo', 'type-reactor']],
  [/food|bake|cake|restaurant|cafe|kitchen|chop|grill|drink|juice|catering|pharmacy|clinic|shop|store|market|fresh/i, ['type-reactor', 'swiss-editorial', 'luxury-product']],
];
function pickDirection({ brief, plan, salt, previous, aspect }) {
  const text = [brief.category, brief.name, plan?.business?.category, [].concat(brief.features || []).join(' ')].filter(Boolean).join(' ');
  const fits = new Set(AFFINITY.filter(([re]) => re.test(text)).flatMap(([, ids]) => ids));
  const prev = (String(previous || '').match(/animora-direction:([a-z-]+);/) || [])[1];
  const options = [...(SIZES[aspect] ? [['mix', 4]] : []), ...(TPL_SIZES[aspect] ? TEMPLATE_IDS.map((id) => [id, fits.has(id) ? 3 : 0.3]) : [])].filter(([id]) => id !== prev);
  const r = mulberry(hashStr(`${brief.name}|${text}|${salt}|dir`) % 2147483647 || 5)();
  let t = r * options.reduce((n, [, w]) => n + w, 0);
  for (const [id, w] of options) { t -= w; if (t <= 0) return id; }
  return options[0][0];
}
export function piecesFilm({ plan = {}, brief = {}, assets = [], style = null, themeColors = {}, salt = '', previous = null }) {
  const aspect = TPL_SIZES[plan.aspect_ratio] ? plan.aspect_ratio : '9:16';
  const dir = !salt && isTemplateBrief(brief) ? brief.template : pickDirection({ brief, plan, salt, previous, aspect });
  const out = dir !== 'mix' && TEMPLATE_IDS.includes(dir)
    ? templateFilm({ plan, brief: { ...brief, template: dir, intensity: 'auto' }, assets, themeColors, salt })
    : mixFilm({ plan, brief, assets, style, themeColors, salt });
  out.html = out.html.includes('</body>') ? out.html.replace('</body>', `<!--animora-direction:${dir};--></body>`) : `${out.html}<!--animora-direction:${dir};-->`;
  return out;
}
function mixFilm({ plan = {}, brief = {}, assets = [], style = null, themeColors = {}, salt = '' }) {
  const aspect = SIZES[plan.aspect_ratio] ? plan.aspect_ratio : '9:16', [W, H] = SIZES[aspect];
  const look0 = lookFor(style?.slug || style?.palette?.theme || '', { ...(style?.palette || {}), ...themeColors });
  const colors = { ...themeColors, ...(plan.style?.colors || {}) };
  const A = HEX.test(colors.primary || '') ? colors.primary : HEX.test(style?.palette?.primary || '') ? style.palette.primary : '#5B4BFF';
  const A2 = HEX.test(look0.accent2 || '') ? look0.accent2 : HEX.test(colors.secondary || '') ? colors.secondary : '#FFC93C';
  const q = (f) => `'${f}', 'Inter', system-ui, sans-serif`;
  const look = { display: q(look0.display || 'Inter'), dw: look0.dw || 800, ui: q(look0.ui || 'Inter'), upper: !!look0.upper, A, A2, dark: look0.theme !== 'light', bg: HEX.test(look0.bg || '') && lum(look0.bg) < 0.2 ? look0.bg : '#0E0D12', bgLight: HEX.test(look0.bg || '') && lum(look0.bg) > 0.6 ? look0.bg : '#F4F3F8' };
  const facts = factsOf(plan, brief, assets);
  const seed = hashStr(`${facts.name}|${salt}`) % 2147483647 || 7;
  const duration = Math.max(10, Math.round(Number(plan.duration_seconds) || 24));
  // Every business and every Regenerate gets its own colour play, not just a new scene order (the chosen style keeps its fonts and mood).
  { const rv = mulberry(seed + 7); if (rv() < 0.5 && !plan.style?.colors?.primary && look.A2 && HEX.test(look.A2)) { const t = look.A; look.A = look.A2; look.A2 = t; } if (rv() < 0.3) look.upper = !look.upper; }
  const comp = composePieces({ facts, duration, seed, energy: look0.energy || 'medium' });
  const r = mulberry(seed + 99), kinds = look.dark ? ['dark', 'dark', 'brand', 'light'] : ['light', 'light', 'brand', 'dark'];
  comp.scenes.forEach((s, i) => { if (!s.kind) s.kind = DARK_ONLY.has(s.piece) ? 'dark' : i === 0 ? (look.dark ? 'dark' : 'light') : kinds[Math.floor(r() * kinds.length)]; if (s.kind === 'light' && lum(A) > 0.4) s.kind = 'dark'; });
  const sound = plan.sound || (plan.sfx === false ? 'none' : 'sfx');
  const music = sound === 'own' && plan.music_url ? { url: plan.music_url } : sound === 'piano' || sound === 'soft' ? { url: `/music/${sound}.mp3`, builtin: sound } : null;
  const cfg = { target: duration, W, H, seed, look, energy: comp.energy, scenes: comp.scenes, sound: sound === 'none' ? 'none' : 'on', brand: facts.name, logo: facts.logo };
  return { html: piecesHtml(cfg, music), data: cfg };
}

/** A signature template film: the recipe is fixed by the template, the words, colours, size, length and mood by the owner. */
export function templateFilm({ plan = {}, brief = {}, assets = [], themeColors = {}, salt = '' }) {
  const aspect = TPL_SIZES[plan.aspect_ratio] ? plan.aspect_ratio : '9:16', [W, H] = TPL_SIZES[aspect];
  const f = factsOf(plan, brief, assets);
  const seed = hashStr(`${f.name}|${brief.template}|${salt}`) % 2147483647 || 7;
  const want = Number(plan.duration_seconds || brief.duration) || 15, duration = Math.max(6, Math.min(120, Math.round(want)));
  // the owner's own colours win; otherwise the template keeps its house colours
  const own = { ...(brief.colorMode && brief.colorMode !== 'style' ? brief.colors || {} : {}), ...(plan.style?.colors && brief.colorMode && brief.colorMode !== 'style' ? plan.style.colors : {}) };
  const colors = HEX.test(own.primary || '') ? { A: own.primary, A2: HEX.test(own.secondary || '') ? own.secondary : undefined } : undefined;
  const head = f.heads[0] || f.name;
  const fields = { brand: f.name, headline: split2(head), sub: f.sub || f.category, cta: f.cta, points: (f.features.length ? f.features : f.products.map((p) => p.title)).slice(0, 4), words: (f.features.length ? f.features : [f.category || f.name]).map((w) => w.split(/\s+/)[0]).slice(0, 3), img: f.photos[0] || '', fit: f.fits[f.photos[0]] || 'cover', logo: f.logo || '', mono: f.mono, date: f.when, place: f.place, contact: f.phone || f.place };
  const sound = plan.sound || (plan.sfx === false ? 'none' : 'sfx');
  const music = sound === 'own' && plan.music_url ? { url: plan.music_url } : sound === 'piano' || sound === 'soft' ? { url: `/music/${sound}.mp3`, builtin: sound } : null;
  const template = { template: brief.template, W, H, seed, duration, intensity: brief.intensity === 'auto' ? undefined : brief.intensity, sound: sound === 'none' ? 'none' : brief.soundStyle, quality: brief.quality || 'premium', colors, fields };
  const cfg = { W, H, seed, template, brand: f.name, sound: sound === 'none' ? 'none' : 'on', look: { display: TPL_FONTS[brief.template][0], ui: TPL_FONTS[brief.template][1], A: colors?.A || '', A2: colors?.A2 || '', dark: true } };
  return { html: piecesHtml(cfg, music), data: cfg };
}
const TPL_FONTS = { 'type-reactor': ["'Anton'", "'Inter'"], 'luxury-product': ["'Playfair Display'", "'DM Sans'"], 'hud-tech': ["'Orbitron'", "'Space Grotesk'"], 'liquid-chrome': ["'Syne'", "'Inter'"], 'sports-hype': ["'Oswald'", "'Inter'"], 'swiss-editorial': ["'Archivo Black'", "'Inter'"], visualizer: ["'Unbounded'", "'Inter'"], 'cinematic-logo': ["'Cinzel'", "'Inter'"] };

export function piecesHtml(cfg, music = null) {
  const fams = [cfg.look.display, cfg.look.ui].map((f) => String(f).split("'")[1]).filter(Boolean);
  const fontLink = fontsUrl(fams) || `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700;800`).join('&')}&display=block`;
  const est = cfg.template ? cfg.template.duration : cfg.target ? Math.round(cfg.target) : Math.round(cfg.scenes.reduce((a, s) => a + (DUR[s.piece] || 3.8), 0) * 0.95);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="adflash" content="width=${cfg.W},height=${cfg.H},duration=${est},fps=30,engine=pieces-v1">
<title>${String(cfg.brand || 'Animora video').replace(/[<>&]/g, '')}</title>
<link href="${fontLink.replace(/&/g, '&amp;')}" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}html,body{width:${cfg.W}px;height:${cfg.H}px;overflow:hidden;background:#000;-webkit-font-smoothing:antialiased}</style>
</head>
<body>
<div id="stage"></div>
<script src="${GSAP_CDN}/gsap.min.js"></script>
<script>
window.PIECES_FILM = ${esc(JSON.stringify(cfg))};
window.ADFLASH_DATA = ${esc(JSON.stringify({ music }))};
</script>
<script>
${runtime()}
</script>
<script>
(function(){ var F = window.PIECES_FILM, fams = ${JSON.stringify(fams)};
  var load = document.fonts && document.fonts.load ? Promise.all(fams.flatMap(function(f){ return ['400','600','700','800'].map(function(w){ return document.fonts.load(w + ' 80px "' + f + '"').catch(function(){}); }); })) : Promise.resolve();
  var fail = function(e){ try { window.dispatchEvent(new ErrorEvent('error', { message: 'The film could not start: ' + String((e && e.message) || e) })); } catch(_) {} };
  // if the animation library did not arrive (blocked or slow network), try a second source before giving up
  var needGsap = new Promise(function(res){ if (window.gsap) return res(); var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js'; s.onload = s.onerror = function(){ res(); }; document.head.appendChild(s); setTimeout(res, 8000); });
  Promise.race([load, new Promise(function(r){ setTimeout(r, 4000); })]).then(function(){ return needGsap; }).then(function(){ if (!window.gsap) throw new Error('the animation library did not load. Check your internet connection and press Regenerate'); if (F.template) TEMPLATE_FILM(F.template); else PIECE_SEQUENCE(F); if (F.sound === 'none') window.__sfx = []; }).catch(fail);
})();
</script>
</body>
</html>
`;
}

/** Plain-words change: the AI rewrites the film's words / colours / pieces; without the AI, simple changes still work. */
export async function piecesEdit({ html, instruction, useAi = true }) {
  const cfg = readPieces(html); if (!cfg) throw new Error('Not a Pieces film');
  const say = String(instruction || '').toLowerCase();
  const next = JSON.parse(JSON.stringify(cfg)); const done = [];
  if (cfg.template) return templateEdit({ cfg, next, say, instruction, useAi, html });
  if (useAi) {
    try {
      const { text } = await geminiGenerate({
        system: 'You edit a short video ad described as JSON: { look: { A, A2 (hex colours), dark (bool) }, energy: "calm"|"medium"|"high", scenes: [{ piece, kind: "dark"|"light"|"brand", data: {...words} }] }. Change only what the owner asks. Keep every piece name from the input (you may remove, reorder or repeat scenes). Never invent prices, phone numbers or addresses. Return JSON: { "look": {...}, "energy": "...", "scenes": [...], "summary": "one short sentence of what you changed" }.',
        messages: [{ role: 'user', text: `FILM: ${JSON.stringify({ look: { A: cfg.look.A, A2: cfg.look.A2, dark: cfg.look.dark }, energy: cfg.energy, scenes: cfg.scenes })}\n\nCHANGE: ${instruction}` }],
        temperature: 0.4, maxOutputTokens: 6000, json: true, timeoutMs: 45000, thinking: 'low',
      });
      const o = JSON.parse(String(text).match(/\{[\s\S]*\}/)[0]);
      if (HEX.test(o.look?.A || '')) next.look.A = o.look.A; if (HEX.test(o.look?.A2 || '')) next.look.A2 = o.look.A2; if (typeof o.look?.dark === 'boolean') next.look.dark = o.look.dark;
      if (['calm', 'medium', 'high'].includes(o.energy)) next.energy = o.energy;
      if (Array.isArray(o.scenes) && o.scenes.length >= 2) next.scenes = o.scenes.filter((s) => s && DUR[s.piece]).map((s) => ({ piece: s.piece, kind: ['dark', 'light', 'brand'].includes(s.kind) ? s.kind : 'dark', data: s.data || {} }));
      return { html: piecesHtml(next, readMusic(html)), summary: str(o.summary, 200) || 'Done! Check the video.' };
    } catch (e) { console.warn('[pieces] AI edit failed, trying simple changes:', e.message); }
  }
  if (/different|another|new mix|remix|shuffle|regenerate|change it/.test(say)) { next.seed = (cfg.seed * 7 + 13) % 2147483647; done.push('a fresh mix of moves and transitions'); }
  if (/dark/.test(say)) { next.look.dark = true; next.scenes.forEach((s) => { if (s.kind === 'light') s.kind = 'dark'; }); done.push('darker scenes'); }
  else if (/light|bright|white/.test(say)) { next.look.dark = false; next.scenes.forEach((s) => { if (s.kind === 'dark' && !DARK_ONLY.has(s.piece)) s.kind = 'light'; }); done.push('lighter scenes'); }
  if (/fast|energ|punch/.test(say)) { next.energy = 'high'; done.push('punchier transitions'); } else if (/slow|calm|soft/.test(say)) { next.energy = 'calm'; done.push('calmer transitions'); }
  const COL = { red: '#E5383B', green: '#1F8A4C', blue: '#1F6FEB', yellow: '#FFC93C', gold: '#D4A24C', orange: '#E8530E', purple: '#7B2CBF', pink: '#E83E8C', teal: '#0FA3A3', black: '#111111' };
  const c = Object.keys(COL).find((w) => new RegExp(`\\b${w}\\b`).test(say)); if (c) { next.look.A = COL[c]; done.push(`${c} accents`); }
  if (!done.length) return null;
  return { html: piecesHtml(next, readMusic(html)), summary: `Done: ${done.join(', ')}.` };
}
async function templateEdit({ cfg, next, say, instruction, useAi, html }) {
  const T = next.template, done = [];
  if (useAi) {
    try {
      const { text } = await geminiGenerate({
        system: `You edit a short video made from a signature motion template, described as JSON: { template: one of ${TEMPLATE_IDS.join(', ')}, intensity: "elegant"|"aggressive"|"mechanical"|"fluid", sound: "beat"|"cinematic"|"ambient"|"none", duration: 6|15|30, colors: { A, A2 } (hex, or null for the template's own), fields: { brand, headline (use | for a line break), sub, cta, points[] } }. Change only what the owner asks. Never invent prices, phone numbers or addresses. Return JSON with the same keys plus "summary": one short sentence of what you changed.`,
        messages: [{ role: 'user', text: `VIDEO: ${JSON.stringify({ template: T.template, intensity: T.intensity || null, sound: T.sound || null, duration: T.duration, colors: T.colors || null, fields: { brand: T.fields.brand, headline: T.fields.headline, sub: T.fields.sub, cta: T.fields.cta, points: T.fields.points } })}\n\nCHANGE: ${instruction}` }],
        temperature: 0.4, maxOutputTokens: 3000, json: true, timeoutMs: 45000, thinking: 'low',
      });
      const o = JSON.parse(String(text).match(/\{[\s\S]*\}/)[0]);
      if (TEMPLATE_IDS.includes(o.template)) T.template = o.template;
      if (['elegant', 'aggressive', 'mechanical', 'fluid'].includes(o.intensity)) T.intensity = o.intensity;
      if (['beat', 'cinematic', 'ambient', 'none'].includes(o.sound)) T.sound = o.sound;
      if ([6, 15, 30].includes(Number(o.duration))) T.duration = Number(o.duration);
      if (o.colors === null) delete T.colors; else if (HEX.test(o.colors?.A || '')) T.colors = { A: o.colors.A, A2: HEX.test(o.colors.A2 || '') ? o.colors.A2 : undefined };
      for (const k of ['brand', 'headline', 'sub', 'cta']) if (typeof o.fields?.[k] === 'string' && o.fields[k].trim()) T.fields[k] = str(o.fields[k], 80);
      if (Array.isArray(o.fields?.points)) T.fields.points = o.fields.points.map((x) => str(x, 40)).filter(Boolean).slice(0, 4);
      next.look = { ...next.look, display: TPL_FONTS[T.template][0], ui: TPL_FONTS[T.template][1] };
      return { html: piecesHtml(next, readMusic(html)), summary: str(o.summary, 200) || 'Done! Check the video.' };
    } catch (e) { console.warn('[pieces] AI template edit failed, trying simple changes:', e.message); }
  }
  if (/different|another|new mix|remix|shuffle|regenerate|change it/.test(say)) { T.seed = next.seed = (cfg.seed * 7 + 13) % 2147483647; done.push('a fresh cut'); }
  if (/fast|energ|punch|aggress|hype/.test(say)) { T.intensity = 'aggressive'; done.push('harder, faster motion'); }
  else if (/slow|calm|soft|elegant|smooth/.test(say)) { T.intensity = 'elegant'; done.push('calmer, smoother motion'); }
  else if (/fluid|liquid|flow/.test(say)) { T.intensity = 'fluid'; done.push('fluid motion'); }
  else if (/tech|robot|mechanic/.test(say)) { T.intensity = 'mechanical'; done.push('mechanical motion'); }
  const n = (say.match(/\b(6|15|30)\s*(s|sec|seconds)\b/) || [])[1]; if (n) { T.duration = Number(n); done.push(`${n} seconds long`); }
  if (/no sound|mute|silent/.test(say)) { T.sound = 'none'; done.push('no sound'); }
  const COL = { red: '#E5383B', green: '#1F8A4C', blue: '#1F6FEB', yellow: '#FFC93C', gold: '#D4A24C', orange: '#E8530E', purple: '#7B2CBF', pink: '#E83E8C', teal: '#0FA3A3' };
  const c = Object.keys(COL).find((w) => new RegExp(`\\b${w}\\b`).test(say)); if (c) { T.colors = { A: COL[c], A2: T.colors?.A2 }; done.push(`${c} accents`); }
  if (!done.length) return null;
  return { html: piecesHtml(next, readMusic(html)), summary: `Done: ${done.join(', ')}.` };
}
const readMusic = (html) => { const m = String(html || '').match(/window\.ADFLASH_DATA = (.*);\n/); try { return m ? JSON.parse(m[1]).music : null; } catch { return null; } };
