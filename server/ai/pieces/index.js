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
import { composeStory, pickLook, lookFor as storyLook, fontLink as storyFonts, fontFamilies as storyFams, LOOK_IDS, LOOKS as STORY_LOOKS, pickTrack, trackMusic, snapToBeats, musicLibrary } from '../story/index.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'motion', 'browser');
let RUNTIME = null;
const runtime = () => (RUNTIME ||= ['pieces.js', 'atoms.js', 'pieces2.js', 'premium.js', 'signature.js', 'story.js'].map((f) => readFileSync(path.join(dir, f), 'utf8')).join('\n;\n'));
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
// cut at a whole word, never in the middle of one ("This flyer was mad", "fix your devi")
const str = (v, n = 80) => { const t = v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); if (t.length <= n) return t; const c = t.slice(0, n), sp = c.lastIndexOf(' '); return (sp > n * 0.5 ? c.slice(0, sp) : c).replace(/[\s,;:&–—-]+$/, ''); };
const hashStr = (t) => { let h = 2166136261; for (const c of String(t)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const lum = (h) => { const n = parseInt(String(h || '#777777').slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const HEX = /^#[0-9a-f]{6}$/i;

// the facts a video may use, taken from the owner's answers (never invented)
export function factsOf(plan = {}, brief = {}, assets = []) {
  const photos = assets.filter((a) => (a.kind || 'image') === 'image' && a.role !== 'logo' && !/logo/i.test(a.name || '')).map((a) => a.url);
  // What each picture can honestly do: small, very wide/tall or flat pictures are shown whole on a dimmed copy of themselves, never cropped into a circle or blown up.
  const fitOf = (m) => { const w = Number(m.width) || 0, h = Number(m.height) || 0; if (!w || !h) return 'cover'; const ratio = w / h; return Math.min(w, h) < 600 || ratio > 2.1 || ratio < 0.48 ? 'contain' : 'cover'; };
  const fits = {}, ratios = {}, taps = {}; for (const a of assets) if (a.url) { fits[a.url] = fitOf(a); if (Number(a.width) && Number(a.height)) ratios[a.url] = Math.round((a.width / a.height) * 1000) / 1000; const m = String(a.focus || '').match(/^([\d.]+),([\d.]+)$/); if (m) taps[a.url] = { x: Math.min(0.95, Math.max(0.05, +m[1])), y: Math.min(0.95, Math.max(0.05, +m[2])) }; }
  const logo = assets.find((a) => (a.kind || 'image') === 'image' && (a.role === 'logo' || /logo/i.test(a.name || '')))?.url || null;
  const name = str(brief.name || plan.business?.name || 'Your business', 40);
  const heads = [].concat(brief.headlines || [], brief.headline || []).map((h) => str(h, 60)).filter(Boolean);
  const features = [].concat(brief.features || []).map((f) => str(f, 34)).filter(Boolean).slice(0, 4);
  const products = [].concat(brief.products || []).map((p) => { const m = String(p).match(/^(.*?)[\s:–-]*((?:₦|N|NGN|\$)\s?[\d,.]+\s?[km]?)\s*$/i); return m ? { title: str(m[1], 34), price: m[2].replace(/^N(?=\d)/, '₦') } : { title: str(p, 34) }; });
  const priced = products.find((p) => p.price);
  const contact = str(brief.contact, 120), phone = (contact.match(/(\+?\d[\d\s-]{7,}\d)/) || [])[1] || '';
  // the address: given, or the part of the contact line that is not a phone number, a handle or a link
  const segs = contact.split(/\s*[·|•;]\s*|\s+-\s+/).map((x) => x.trim()).filter(Boolean);
  const placeSeg = segs.find((x) => !/https?:|www\.|\.com|@/i.test(x) && /\b(street|st|road|rd|way|avenue|ave|lagos|abuja|ibadan|lekki|ikeja|island|close|estate|plaza|mall|area|crescent|junction|opposite|beside|gra|phase|market|shop|suite|floor|off)\b/i.test(x))
    || segs.find((x) => !/\d{6,}|\d[\d\s-]{7,}\d|@|https?:|www\.|\.com|whats\s?app|instagram|ig:|email/i.test(x) && /\p{L}{3,}/u.test(x));
  const linkSeg = segs.find((x) => /https?:\/\/|www\.|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|app|ng|net|org|io|co|shop|store|site|online)\b/i.test(x) && !/@/.test(x));
  const link = str(String(linkSeg || '').replace(/^https?:\/\//i, '').replace(/\/$/, ''), 40);
  const place = str(brief.address || (placeSeg && placeSeg !== linkSeg ? placeSeg : '') || '', 60);
  const whatsapp = /whats\s?app|wa\.me/i.test(String(brief.contact || '') + ' ' + String(brief.cta || ''));
  // pictures with a see-through background (product cut-outs) can step out of a frame
  const cutouts = assets.filter((a) => (a.kind || 'image') === 'image' && a.role !== 'logo' && !/logo/i.test(a.name || '') && (a.transparent || a.has_alpha)).map((a) => a.url);
  const appy = /\b(app|apps|software|saas|platform|online store|e-?commerce|delivery app|mobile app|website|web ?site|game|gaming|fintech|payments?)\b/i.test([brief.category, brief.name, ...[].concat(brief.features || [])].join(' ')) && !/repair|fix|service centre|service center/i.test(brief.category || '');
  const steps = [].concat(brief.steps || []).map((x) => str(x, 40)).filter(Boolean).slice(0, 8);
  return { link, note: str(brief.endNote, 60), taps, steps, cutouts, appy: appy || steps.length > 0, whatsapp, fits, ratios, name, mono: name.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter((w) => !/^(the|and|of)$/i.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'A', heads, features, products, priced, offer: str(brief.offer, 30), when: str(brief.when, 60), cta: str(brief.cta || [].concat(brief.ctas || [])[0] || 'Order now', 28), phone, place, photos, logo, category: str(brief.category, 40), sub: str(heads[1] || brief.goal || '', 90) };
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
    keep.push({ piece: x.piece, data: x.data(fi), fill: true }); total += cost(x.piece); lastPiece = x.piece; fi++;
  }
  // no scene twice in a row, and never the same piece as the opener or the ending right next to it
  // A story arc, not a shuffle: hero shot first, then the benefits, then the offer, then where/when, with a bold statement between the information scenes so the film breathes.
  const RANK = (m) => /^photo/.test(m.piece) ? 1 : /^(info-checks|info-tiles|info-stat|info-quote|info-compare)$/.test(m.piece) ? 3 : m.piece === 'info-price' ? 4 : m.piece === 'info-countdown' ? 5 : m.piece === 'info-location' ? 6 : 2;
  const core = keep.filter((m) => !m.fill).map((m, i) => ({ m, k: RANK(m) + (/^photo/.test(m.piece) && m !== keep.find((x) => /^photo/.test(x.piece)) ? 1.5 : 0) + r() * 0.2 })).sort((x, y) => x.k - y.k).map((x) => x.m);
  const breaths = shuffle(keep.filter((m) => m.fill));
  const ordered = [];
  const gapEvery = core.length ? Math.max(1, Math.ceil(breaths.length / Math.max(1, core.length))) : breaths.length;
  core.forEach((m, i) => { ordered.push(m); for (let g = 0; g < gapEvery && breaths.length && !(i === core.length - 1 && g >= 1); g++) ordered.push(breaths.shift()); });
  while (breaths.length) ordered.push(breaths.shift());
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
  if (!(!salt && isTemplateBrief(brief)) && process.env.ANIMORA_DIRECTOR !== 'pieces') {
    const out = storyFilm({ plan, brief, assets, style, salt, previous });
    out.html = out.html.replace('</body>', `<!--animora-direction:story-${out.data.story.look.id};--></body>`);
    return out;
  }
  const dir = !salt && isTemplateBrief(brief) ? brief.template : pickDirection({ brief, plan, salt, previous, aspect });
  const out = dir !== 'mix' && TEMPLATE_IDS.includes(dir)
    ? templateFilm({ plan, brief: { ...brief, template: dir, intensity: 'auto' }, assets, themeColors, salt })
    : mixFilm({ plan, brief, assets, style, themeColors, salt });
  out.html = out.html.includes('</body>') ? out.html.replace('</body>', `<!--animora-direction:${dir};--></body>`) : `${out.html}<!--animora-direction:${dir};-->`;
  return out;
}
/** The Story engine: an art-directed film from the owner's facts (looks, beats and timing live in server/ai/story). */
export function storyFilm({ plan = {}, brief = {}, assets = [], style = null, salt = '', previous = null, look: forceLook = null, seed: forceSeed = null }) {
  const aspect = TPL_SIZES[plan.aspect_ratio] ? plan.aspect_ratio : '9:16', [W, H] = TPL_SIZES[aspect];
  const facts = factsOf(plan, brief, assets);
  const seed = forceSeed || (hashStr(`${facts.name}|${salt}|story`) % 2147483647 || 7);
  const duration = Math.max(6, Math.min(120, Math.round(Number(plan.duration_seconds) || Number(brief.duration) || 20)));
  const lookId = LOOK_IDS.includes(forceLook) ? forceLook : pickLook({ facts, style, brief, salt, previous });
  // the owner's own colours lead; a style they picked gives its accent; otherwise the look keeps its house colours
  const own = { ...(brief.colorMode && brief.colorMode !== 'style' ? brief.colors || {} : {}), ...(plan.style?.colors && brief.colorMode && brief.colorMode !== 'style' ? plan.style.colors : {}) };
  if (!HEX.test(own.primary || '') && style && !brief.styleAuto && HEX.test(style.palette?.primary || '')) own.primary = style.palette.primary;
  // sound: 'all' (default) = music that suits the look + effects; 'sfx' = effects only; 'own' = the owner's track + effects; 'none' = silent
  const mode = soundMode(plan, brief);
  const prevTrack = (String(previous || '').match(/"music":\{"url":"\/music\/([\w-]+)\.mp3"/) || [])[1] || null;
  const cfg = buildStory({ facts, lookId, own, seed, duration, aspect, mode, ownMusic: plan.music_url || null, avoidTrack: prevTrack, pool: ['piano', 'soft'].includes(plan.sound) ? plan.sound : null });
  return { html: piecesHtml(cfg, cfg.music), data: cfg };
}
const soundMode = (plan = {}, brief = {}) => { const s = plan.sound || brief.sound || (plan.sfx === false ? 'none' : 'all'); return s === 'own' ? (plan.music_url ? 'own' : 'all') : ['none', 'sfx'].includes(s) ? s : 'all'; };
function buildStory({ facts, lookId, own = {}, seed, duration, aspect, sound, mode = null, tweak = {}, ownMusic = null, trackId = null, avoidTrack = null, pool = null }) {
  const [W, H] = TPL_SIZES[aspect] || TPL_SIZES['9:16'];
  mode = mode || (sound === 'none' ? 'none' : 'sfx');
  const look = storyLook(lookId, own);
  if (tweak.motion) look.motion = tweak.motion;
  let beats = composeStory({ facts, duration, seed, look: lookId, aspect });
  // music: a library bed for the look (cuts land on its beat), the owner's own track, or none
  const track = mode === 'all' ? (trackId && trackMusic(trackId) ? trackId : pickTrack({ look: lookId, seed, avoid: avoidTrack, pool })) : null;
  if (track) beats = snapToBeats(beats, track, duration, 0.7);
  const music = mode === 'own' && ownMusic ? { url: ownMusic } : track ? trackMusic(track) : null;
  const snd = mode === 'none' ? 'none' : 'on';
  const story = { W, H, seed, target: duration, aspect, own, tweak, textScale: tweak.textScale || 1, facts, look, beats, brand: facts.name, category: facts.category, logo: facts.logo, mono: facts.mono, sound: snd, mode, track, ownMusic: mode === 'own' ? ownMusic : null, music: !!music, overlap: 0.7 };
  return { W, H, seed, story, brand: facts.name, sound: snd, music, fontUrl: storyFonts(look), fams: storyFams(look), look: { display: look.display, ui: look.ui } };
}
// Plain-words change to a Story film: the AI edits the owner's words, the look, the accent colour or the length; the film is then re-told.
async function storyEdit({ cfg, say, instruction, useAi, html }) {
  const S = cfg.story, f = JSON.parse(JSON.stringify(S.facts || {}));
  let lookId = S.look.id, own = { ...(S.own || {}) }, seed = S.seed, duration = S.target, summary = '';
  const tweak = { ...(S.tweak || {}) };
  let musicMode = null, newTrack = false;
  const bigger = () => { tweak.textScale = Math.min(1.35, +((tweak.textScale || 1) * 1.15).toFixed(2)); }, smaller = () => { tweak.textScale = Math.max(0.75, +((tweak.textScale || 1) / 1.15).toFixed(2)); };
  const COL = { red: '#E5383B', green: '#1F8A4C', blue: '#1F6FEB', yellow: '#FFC93C', gold: '#C9A45C', orange: '#E8530E', purple: '#7B2CBF', pink: '#E83E8C', teal: '#0FA3A3', black: '#111111', brown: '#7A4A2A' };
  if (useAi) {
    try {
      const { text } = await geminiGenerate({
        system: `You edit a short video ad for a small business. It is described as JSON: { look: one of ${LOOK_IDS.join(', ')} (${LOOK_IDS.map((id) => `${id}`).join('/')}: editorial = warm paper and serif, noir = black and gold luxury, bold = loud colour blocks, fresh = light and friendly, tech = dark blue digital, clean = white and simple), accent: hex colour or null, seconds: number, text: "bigger"|"smaller"|"same", pace: "calmer"|"faster"|"same", music: "same"|"another song"|"off"|"on"|"silent", words: { name, headlines: [..], sub, category, features: [..up to 4], products: [{ title, price }], offer, when, place, phone, cta } }. Change only what the owner asks for. Never invent prices, phone numbers, addresses or claims. Keep words short (headline under 8 words, features under 4 words). Return the same JSON plus "summary": one short friendly sentence of what you changed.`,
        messages: [{ role: 'user', text: `VIDEO: ${JSON.stringify({ look: lookId, accent: own.primary || null, seconds: duration, text: 'same', pace: 'same', music: 'same', words: { name: f.name, headlines: f.heads, sub: f.sub, category: f.category, features: f.features, products: f.products, offer: f.offer, when: f.when, place: f.place, phone: f.phone, cta: f.cta } })}\n\nCHANGE: ${instruction}` }],
        temperature: 0.4, maxOutputTokens: 3000, json: true, timeoutMs: 45000, thinking: 'low',
      });
      const o = JSON.parse(String(text).match(/\{[\s\S]*\}/)[0]);
      if (LOOK_IDS.includes(o.look)) lookId = o.look;
      if (o.text === 'bigger') bigger(); else if (o.text === 'smaller') smaller();
      if (o.pace === 'calmer') tweak.motion = 'calm'; else if (o.pace === 'faster') tweak.motion = 'snap';
      if (o.music === 'another song') { newTrack = true; musicMode = 'all'; } else if (o.music === 'off') musicMode = 'sfx'; else if (o.music === 'on') musicMode = 'all'; else if (o.music === 'silent') musicMode = 'none';
      if (o.accent === null) delete own.primary; else if (HEX.test(o.accent || '')) own.primary = o.accent;
      const sec = Math.round(Number(o.seconds)); if (sec >= 6 && sec <= 120) duration = sec;
      const w = o.words || {};
      for (const k of ['name', 'sub', 'category', 'offer', 'when', 'place', 'phone', 'cta']) if (typeof w[k] === 'string') f[k] = str(w[k], k === 'sub' ? 90 : 60);
      if (Array.isArray(w.headlines)) f.heads = w.headlines.map((x) => str(x, 60)).filter(Boolean);
      if (Array.isArray(w.features)) f.features = w.features.map((x) => str(x, 34)).filter(Boolean).slice(0, 4);
      if (Array.isArray(w.products)) f.products = w.products.filter((x) => x && x.title).map((x) => ({ title: str(x.title, 34), ...(x.price ? { price: str(x.price, 16) } : {}) })).slice(0, 4);
      summary = str(o.summary, 200);
    } catch (e) { console.warn('[story] AI edit failed, trying simple changes:', e.message); }
  }
  if (!summary) {
    const done = [];
    // music first, so "another song" is not read as "another look"
    let musicSaid = true;
    if (/no sound|mute (it|everything|all)|silent|without sound/.test(say)) { musicMode = 'none'; done.push('no sound'); }
    else if (/(no|remove|without|stop|off).{0,12}music|music.{0,8}off/.test(say)) { musicMode = 'sfx'; done.push('no music (sound effects stay)'); }
    else if (/(another|different|new|change|other|switch).{0,12}(song|music|track|beat|tune)/.test(say)) { musicMode = 'all'; newTrack = true; done.push('a different song'); }
    else if (/(add|put|with|turn on|bring back|want).{0,12}music|music back/.test(say)) { musicMode = 'all'; done.push('background music'); }
    else musicSaid = false;
    if (!musicSaid && /different|another|new look|remix|shuffle|change (it|the look|style)/.test(say)) { seed = (seed * 7 + 13) % 2147483647; lookId = LOOK_IDS[(LOOK_IDS.indexOf(lookId) + 1 + (seed % (LOOK_IDS.length - 1))) % LOOK_IDS.length]; done.push(`a new look (${lookId})`); }
    const named = LOOK_IDS.find((id) => new RegExp(`\\b${id}\\b`).test(say)); if (named) { lookId = named; done.push(`the ${named} look`); }
    if (/\bdark|black background|night/.test(say) && !named) { lookId = ['noir', 'tech', 'bold'].find((x) => x !== lookId); done.push('a darker look'); }
    else if (/\blight|bright|white background/.test(say) && !named) { lookId = ['clean', 'fresh', 'editorial'].find((x) => x !== lookId); done.push('a lighter look'); }
    const c = Object.keys(COL).find((x) => new RegExp(`\\b${x}\\b`).test(say)); if (c) { own.primary = COL[c]; done.push(`${c} accents`); }
    if (/(bigger|larger|increase).*(text|word|font|letter)|(text|word|font|letter)s?.*(bigger|larger)/.test(say)) { bigger(); done.push('bigger text'); }
    else if (/(smaller|reduce).*(text|word|font|letter)|(text|word|font|letter)s?.*smaller/.test(say)) { smaller(); done.push('smaller text'); }
    if (!musicSaid && /calm|slow|smooth|soft/.test(say)) { tweak.motion = 'calm'; done.push('calmer motion'); } else if (/fast|energ|punch|snappy|quick/.test(say)) { tweak.motion = 'snap'; done.push('snappier motion'); }
    const n = Number((say.match(/\b(\d{1,3})\s*(s|sec|secs|seconds)\b/) || [])[1]); if (n >= 6 && n <= 120) { duration = n; done.push(`${n} seconds long`); }
    if (!done.length) return null;
    summary = `Done: ${done.join(', ')}.`;
  }
  const next = buildStory({ facts: f, lookId, own, seed, duration, aspect: S.aspect || '9:16', sound: S.sound, mode: musicMode || S.mode, tweak, ownMusic: S.ownMusic || (readMusic(html)?.url && !readMusic(html)?.id ? readMusic(html).url : null), trackId: newTrack ? null : S.track, avoidTrack: S.track });
  const out = piecesHtml(next, next.music).replace('</body>', `<!--animora-direction:story-${lookId};--></body>`);
  return { html: out, summary: summary || 'Done! Check the video.' };
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
  const r = mulberry(seed + 99), off = Math.floor(r() * 4), kinds = look.dark ? ['dark', 'dark', 'brand', 'light'] : ['light', 'light', 'brand', 'dark'];
  comp.scenes.forEach((s, i) => { if (!s.kind) { const prevK = comp.scenes[i - 1]?.kind; let kk = DARK_ONLY.has(s.piece) ? 'dark' : i === 0 ? (look.dark ? 'dark' : 'light') : kinds[(i + off) % kinds.length]; if (kk === prevK && kk !== 'brand' && !DARK_ONLY.has(s.piece)) kk = kinds[(i + off + 1) % kinds.length]; s.kind = kk; } if (s.kind === 'light' && lum(A) > 0.4) s.kind = 'dark'; });
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
  const fams = cfg.fams || [cfg.look.display, cfg.look.ui].map((f) => String(f).split("'")[1]).filter(Boolean);
  const fontLink = cfg.fontUrl || fontsUrl(fams) || `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700;800`).join('&')}&display=block`;
  const est = cfg.story ? cfg.story.target : cfg.template ? cfg.template.duration : cfg.target ? Math.round(cfg.target) : Math.round(cfg.scenes.reduce((a, s) => a + (DUR[s.piece] || 3.8), 0) * 0.95);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="adflash" content="width=${cfg.W},height=${cfg.H},duration=${est},fps=30,engine=${cfg.story ? 'story-v1' : 'pieces-v1'}">
<title>${String(cfg.brand || 'Animora video').replace(/[<>&]/g, '')}</title>
<link href="${fontLink.replace(/&/g, '&amp;')}" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}html,body{width:${cfg.W}px;height:${cfg.H}px;overflow:hidden;background:#000;-webkit-font-smoothing:antialiased}</style>
</head>
<body>
<div id="stage"></div>
<script src="${GSAP_CDN}/gsap.min.js"></script>
${cfg.story ? `<script src="${GSAP_CDN}/MorphSVGPlugin.min.js"></script>\n<script src="${GSAP_CDN}/MotionPathPlugin.min.js"></script>\n` : ''}<script>
window.PIECES_FILM = ${esc(JSON.stringify(cfg))};
window.ADFLASH_DATA = ${esc(JSON.stringify({ music }))};
</script>
<script>
${runtime()}
</script>
<script>
(function(){ var F = window.PIECES_FILM, fams = ${JSON.stringify(fams)};
  var load = document.fonts && document.fonts.load ? Promise.all(fams.flatMap(function(f){ return ['400','600','700','800','italic 600'].map(function(w){ return document.fonts.load(w + ' 80px "' + f + '"').catch(function(){}); }); })) : Promise.resolve();
  var fail = function(e){ try { window.dispatchEvent(new ErrorEvent('error', { message: 'The film could not start: ' + String((e && e.message) || e) })); } catch(_) {} };
  // if the animation library did not arrive (blocked or slow network), try a second source before giving up
  var needGsap = new Promise(function(res){ if (window.gsap) return res(); var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js'; s.onload = s.onerror = function(){ res(); }; document.head.appendChild(s); setTimeout(res, 8000); });
  Promise.race([load, new Promise(function(r){ setTimeout(r, 4000); })]).then(function(){ return needGsap; }).then(function(){
    // the shape and path plugins are optional extras for Story films: try a second source, never wait long
    if (!F.story || !window.gsap) return;
    var want = ['MorphSVGPlugin', 'MotionPathPlugin'].filter(function(n){ return !window[n]; });
    return Promise.race([Promise.all(want.map(function(n){ return new Promise(function(res){ var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/' + n + '.min.js'; s.onload = s.onerror = function(){ res(); }; document.head.appendChild(s); }); })), new Promise(function(r){ setTimeout(r, 4000); })]);
  }).then(function(){ if (!window.gsap) throw new Error('the animation library did not load. Check your internet connection and press Regenerate'); if (F.story) STORY_FILM(F.story); else if (F.template) TEMPLATE_FILM(F.template); else PIECE_SEQUENCE(F); if (F.sound === 'none') window.__sfx = []; }).catch(fail);
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
  if (cfg.story) return storyEdit({ cfg, next, say, instruction, useAi, html });
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

// ---------------------------------------------------------------- the editor's Adjust panel for Story films (instant, no AI)
export function storyLookInfo(html) {
  const cfg = readPieces(html); if (!cfg?.story) return null;
  const S = cfg.story, t = S.track ? musicLibrary()[S.track] : null;
  return {
    flyer: false, story: true, theme: S.look.id,
    themes: LOOK_IDS.map((id) => ({ key: id, label: STORY_LOOKS[id].label, colors: { background: STORY_LOOKS[id].bg, primary: STORY_LOOKS[id].A, secondary: STORY_LOOKS[id].A2 } })),
    music: S.mode || (S.sound === 'none' ? 'none' : S.ownMusic ? 'own' : 'sfx'), song: t ? `${t.title} by ${t.artist}` : null,
    colors: { primary: S.look.A, secondary: S.look.A2 }, scale: S.textScale || 1,
  };
}
export function storyAdjust(html, changes = {}) {
  const cfg = readPieces(html); if (!cfg?.story) return null;
  const S = cfg.story, done = [];
  let lookId = S.look.id, aspect = S.aspect || '9:16', mode = S.mode || (S.sound === 'none' ? 'none' : 'sfx'), trackId = S.track, avoid = null;
  const own = { ...(S.own || {}) }, tweak = { ...(S.tweak || {}) };
  if (changes.aspect && TPL_SIZES[changes.aspect] && changes.aspect !== aspect) { aspect = changes.aspect; done.push(`size ${aspect}`); }
  if (changes.theme && LOOK_IDS.includes(changes.theme) && changes.theme !== lookId) { lookId = changes.theme; trackId = null; done.push(`the ${STORY_LOOKS[lookId].label} look`); }
  const c = changes.colors || {};
  if (HEX.test(c.primary || '')) { own.primary = c.primary; done.push('main colour'); }
  if (HEX.test(c.secondary || '')) { own.secondary = c.secondary; done.push('second colour'); }
  const ts = Number(changes.textScale); if (ts > 0.4 && ts < 2.5 && ts !== 1) { tweak.textScale = Math.max(0.75, Math.min(1.35, +((tweak.textScale || 1) * ts).toFixed(2))); done.push(ts > 1 ? 'bigger text' : 'smaller text'); }
  const sp = Number(changes.speed); if (sp > 0.4 && sp < 2.5 && sp !== 1) { tweak.motion = sp > 1 ? 'snap' : 'calm'; done.push(sp > 1 ? 'snappier motion' : 'calmer motion'); }
  if (['all', 'another', 'sfx', 'none'].includes(changes.music)) {
    if (changes.music === 'another') { mode = 'all'; avoid = trackId; trackId = null; done.push('a different song'); }
    else if (changes.music !== mode) { mode = changes.music; done.push(mode === 'all' ? 'background music' : mode === 'sfx' ? 'sound effects only' : 'no sound'); }
  }
  if (!done.length) throw new Error('Nothing to change.');
  const next = buildStory({ facts: S.facts, lookId, own, seed: S.seed, duration: S.target, aspect, mode, tweak, ownMusic: S.ownMusic, trackId, avoidTrack: avoid || trackId });
  return { html: piecesHtml(next, next.music).replace('</body>', `<!--animora-direction:story-${lookId};--></body>`), aspect: aspect !== (S.aspect || '9:16') ? aspect : null, summary: `Changed: ${done.join(', ')}.` };
}
