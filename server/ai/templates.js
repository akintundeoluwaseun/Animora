// Animora built-in motion engine v3.
// Turns a plan (scene list) into contract-compliant GSAP HTML without calling any AI.
// Used for the offline "practice AI", every starter style's reference code and preview video, and as a
// safety net when Gemini is unreachable or keeps producing broken code.
//
// How it works
//   1. The BEAT PLANNER below turns every plan scene into 1-3 fast beats (~1-2.5s) and picks a SHOT for
//      each one from the style's preferences: zoom-through words, kinetic stacks, type-on boxes, brand
//      reveals, notifications, orbit rings, rolling price counters, morphing UI cards, pill stacks,
//      scroll-wheel menus, flow cards, icon grids, split screens, product heroes, phone mockups, stat slabs
//      and a cursor-click CTA lockup. Cuts between beats are whips/zooms/morphs/line-draws/wipes/flashes.
//   2. The page embeds the beats as JSON plus the motion runtime (runtime/motion.js), which builds the DOM
//      and ONE paused GSAP timeline deterministically. Only one beat is ever on screen at a time.

import { readFileSync } from 'node:fs';
import { CANVAS } from '../engine/renderer.js';
import { GSAP_CDN } from '../engine/prompts.js';
import { THEMES } from './themes.js';

export { THEMES };

const RUNTIME = readFileSync(new URL('./runtime/motion.js', import.meta.url), 'utf8');
// Background music beds (assets/music, made by scripts/make-music.py): mood -> { bpm, seconds }
export const MUSIC = (() => { try { return JSON.parse(readFileSync(new URL('../../assets/music/tracks.json', import.meta.url), 'utf8')); } catch { return {}; } })();
const MUSIC_FOR_THEME = { bold: 'warm', owambe: 'warm', market: 'warm', afro: 'warm', kids: 'bright', retro: 'bright', bloom: 'calm', ocean: 'bright',
  tech: 'pulse', neon: 'pulse', street: 'pulse', blitz: 'pulse', mono: 'pulse', clean: 'calm', luxe: 'cinematic', glory: 'cinematic', prime: 'cinematic',
  apple: 'calm', midnight: 'cinematic', fintech: 'pulse', pulse: 'calm', graphite: 'pulse' };

/** Snap every cut to the music's beat (every beat, or every 2 beats for fast tracks) so the edit feels on the music. */
function snapToBeat(beats, bpm, duration) {
  const grid = (60 / bpm) * (bpm >= 100 ? 2 : 1);
  let prev = 0;
  return beats.map((b, i) => {
    const o = { ...b, t0: prev };
    if (i === beats.length - 1) { o.t1 = duration; return o; }
    let t = Math.round(b.t1 / grid) * grid;
    if (t - prev < 0.9) t = prev + Math.ceil(0.9 / grid) * grid;
    if (duration - t < (beats.length - 1 - i) * 0.9 + 1.4) t = Math.max(prev + 0.9, b.t1);   // no room left: keep the planned time
    o.t1 = Math.round(t * 100) / 100; prev = o.t1;
    return o;
  });
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PRICE_RE = /(₦|NGN\s?|N(?=\d))\s?(\d[\d,]*(?:\.\d+)?)(\s?k\b)?/i;
const PHONE_RE = /(\+?234[\s-]?|0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}/;
const SPLIT_RE = /\s*[·•|]\s*/;

function lineList(scene) {
  const t = scene.on_screen_text ?? scene.text ?? [];
  return (Array.isArray(t) ? t : String(t).split(/\n|\s\|\s/)).map((x) => String(x).trim()).filter(Boolean);
}

function priceOf(line) {
  const m = line.match(PRICE_RE);
  if (!m) return null;
  let n = Number(m[2].replace(/,/g, ''));
  if (m[3]) n *= 1000;
  return { value: n, label: line.replace(m[0], '').replace(/[-–:|]+\s*$/, '').replace(/\s{2,}/g, ' ').trim() };
}

function prng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function hashStr(str) { let h = 2166136261; for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
function luminance(hex) {
  const m = String(hex || '').match(/^#?([0-9a-f]{6})$/i);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

const ICON_WORDS = [
  ['dumbbell', /gym|fitness|train|boxing|workout|muscle/i],
  ['food', /jollof|rice|food|lunch|dinner|breakfast|chicken|amala|ewedu|menu|eat|restaurant|chops|suya|burger|fries|shawarma|pizza|kitchen|meal|soup|grill|fish/i],
  ['cake', /cake|bake|bakery|parfait|cupcake|pastr/i],
  ['cup', /drink|chapman|juice|smoothie|milkshake|cocktail|bottle|coffee|tea\b|shisha|bar\b/i],
  ['truck', /deliver|shipping|dispatch/i],
  ['chat', /whatsapp|chat|message|dm\b/i],
  ['phone', /call|phone|download|app\b/i],
  ['pin', /road|street|avenue|address|location|ikeja|lagos|abuja|akure|ibadan|ekiti|lekki|yaba|wuse|branch|jetty|market\b/i],
  ['clock', /hour|\bpm\b|\bam\b|open|24\/7|tonight|friday|saturday|sunday|weekend|date|session/i],
  ['gift', /gift|bonus|free|cashback|reward/i],
  ['tag', /price|off\b|discount|sale|promo|deal|offer/i],
  ['school', /school|academy|admission|class|lesson|educat|coding|science|lab|creche|nursery|primary|secondary|jss|sss|learn|grow/i],
  ['scissors', /hair|salon|barb|cut\b/i],
  ['sparkle', /lash|brow|nail|beauty|makeup|skin|glow|spa\b/i],
  ['music', /music|\bdj\b|party|club|concert|praise|worship|owambe|\bmc\b|decor/i],
  ['bed', /hotel|room|suite|stay|lodge|bed/i],
  ['drop', /pool|water|wash|laundry|jet ski|boat|beach/i],
  ['car', /\bcar\b|bus|ride|drive|transport/i],
  ['card', /card|wallet|bank|pay|transfer|bill|airtime/i],
  ['shield', /safe|secure|cctv|protect|c of o|gated/i],
  ['home', /home|house|estate|terrace|property|apartment|duplex/i],
  ['shirt', /fashion|shirt|hoodie|tee\b|dress|kaftan|cloth|wear|cap\b|hat\b|ankara|adire|aso|pants|drop\b/i],
  ['camera', /photo|camera|shoot|studio|video|reel/i],
  ['leaf', /leaf|fresh|farm|organic|tomato|yam|plantain|egg|vegetable|fruit|basket/i],
  ['fire', /hot|spicy|power|energy/i],
  ['users', /people|team|family|kids|child|members|everyone|welcome/i],
  ['trophy', /win|champion|award|best/i],
  ['heart', /love|heart|care|health/i],
  ['star', /star|premium|vip|luxury|deluxe/i],
  ['wifi', /wifi|internet|online|digital/i],
  ['sun', /sun|summer|holiday|trip|escape|travel/i],
];
function iconFor(text, fallback = 'check') {
  const hit = ICON_WORDS.find(([, re]) => re.test(text));
  return hit ? hit[0] : fallback;
}

/** Classify every scene (same rules as before: cta / list / offer / text) and attach images. */
function buildScenes(plan, assets) {
  const scenes = plan.scenes || [];
  const images = (assets || []).filter((a) => (a.kind || 'image') === 'image');
  const logo = images.find((a) => a.role === 'logo' || /logo/i.test(a.name + ' ' + (a.use || ''))) || null;
  const photos = images.filter((a) => a !== logo);
  let photoIdx = 0;
  const phone = plan.business?.phone || '';
  const resolve = (im) => {
    const url = im.url || images.find((a) => a.name === im.asset || a.url === im.asset)?.url;
    if (!url) return null;
    const a = images.find((x) => x.url === url) || {};
    return { ...a, ...im, url, isLogo: im.role === 'logo' || a.role === 'logo' || /logo/i.test(`${im.asset || ''} ${a.name || ''}`) };
  };
  return scenes.map((sc, i) => {
    const lines = lineList(sc);
    const last = i === scenes.length - 1;
    const priced = lines.map(priceOf);
    const nPriced = priced.filter(Boolean).length;
    const base = { i, start: Number(sc.start), end: Number(sc.end), lines, purpose: (sc.purpose || '').toLowerCase(), caption: String(sc.voiceover || '').trim() };
    let s;
    if (last) {
      const ph = lines.find((l) => PHONE_RE.test(l)) || (phone && !PHONE_RE.test(plan.cta || '') ? phone : '');
      const rest = lines.filter((l) => l !== ph);
      s = { ...base, kind: 'cta', head: rest[0] || plan.cta || 'Order now', button: ph || plan.cta || '', subs: rest.slice(1) };
    } else if (nPriced >= 2) {
      s = { ...base, kind: 'list', head: lines.find((l, k) => !priced[k]) || '', rows: lines.map((l, k) => priced[k] && { name: priced[k].label || l, price: priced[k].value }).filter(Boolean) };
    } else if (nPriced === 1) {
      const k = priced.findIndex(Boolean);
      const others = lines.filter((_, j) => j !== k);
      const label = priced[k].label;
      s = { ...base, kind: 'offer', head: others[0] || label || 'Special offer', price: priced[k].value, subs: others.slice(1).concat(others[0] && label ? [label] : []) };
      if (photos.length && !Array.isArray(sc.images)) s.photo = photos[photoIdx++ % photos.length];
    } else {
      s = { ...base, kind: 'text', head: lines[0] || '', subs: lines.slice(1) };
      if (photos.length && !Array.isArray(sc.images) && /product|show|feature|hero/.test(base.purpose)) s.photo = photos[photoIdx++ % photos.length];
    }
    if (Array.isArray(sc.images)) {
      const list = sc.images.map(resolve).filter(Boolean);
      s.bg = list.find((im) => /background|full/i.test(im.placement || '')) || null;
      s.logo = list.find((im) => im.isLogo && im !== s.bg) || null;
      s.photo = list.find((im) => !im.isLogo && im !== s.bg) || null;
    }
    return s;
  });
}

function captionChunks(text, size = 6) {
  const w = String(text).split(/\s+/).filter(Boolean);
  const out = [];
  for (let k = 0; k < w.length; k += size) out.push(w.slice(k, k + size).join(' '));
  if (out.length > 1 && out[out.length - 1].split(' ').length < 3) out[out.length - 2] += ` ${out.pop()}`;
  return out;
}

// ---------------------------------------------------------------------------
// Beat planner
// ---------------------------------------------------------------------------
const words = (t) => String(t || '').split(/\s+/).filter(Boolean);
const STAT_RE = /(?<![₦\d,])(24\/7|\d+(?:\.\d+)?\s?(?:%|\+|k\+|m\+))(?![\w])/i;   // 24/7, 100%, 10+, 5k+ (not dates or plain numbers)

export const SHOT_VALID = {
  zoomword: (b) => words(b.text).length <= 3 && String(b.text).length <= 16,
  kinetic: (b) => words(b.text).length >= 2 && words(b.text).length <= 7,
  type: (b) => String(b.text).length <= 42,
  words: () => true,
  split: (b) => words(b.text).length >= 2 && String(b.text).length <= 60,
  hero: (b) => !!b.img,
  counter: (b) => b.price != null,
  card: () => true,
  pills: (b) => b.items && b.items.length >= 2 && b.items.length <= 5,
  wheel: (b) => b.items && b.items.length >= 2,
  phone: (b) => b.items && b.items.length >= 2 && b.items.length <= 5,
  grid: (b) => b.items && b.items.length >= 3,
  flow: (b) => b.items && b.items.length >= 2 && b.items.length <= 3,
  orbit: (b) => b.items && b.items.length >= 3 && !!b.text,
  brand: () => true,
  notify: (b) => !!(b.subs && b.subs.length),
  lockup: () => true,
  logo: (b) => !!b.hasLogo,
  sentence: (b) => words(b.text).length >= 1 && words(b.text).length <= 14 && String(b.text).length <= 80,
  flip: (b) => words(b.text).length >= 2 && words(b.text).length <= 6 && String(b.text).length <= 40,
  scatter: (b) => words(b.text).length >= 2 && words(b.text).length <= 6 && String(b.text).length <= 40,
  widgets: (b) => b.items && b.items.length >= 2 && b.items.length <= 3,
  iconmorph: (b) => !!b.text && String(b.text).length <= 40,
  isocard: (b) => b.price != null || !!b.number || (!!b.text && String(b.text).length <= 24),
  ticker: (b) => b.items && b.items.length >= 3 && b.items.length <= 6,
  collage: (b) => !!b.text && String(b.text).length <= 40 && ((b.imgs && b.imgs.length >= 4) || (b.items && b.items.length >= 3)),
  stack: (b) => b.items && b.items.length >= 2 && b.items.length <= 4,
  chat: (b) => !!b.text && String(b.text).length <= 60,
  slam: (b) => words(b.text).length >= 1 && words(b.text).length <= 3 && String(b.text).length <= 18,
  poster: (b) => (b.lines && b.lines.length >= 2 && b.lines.length <= 5 && b.lines.every((l) => String(l).length <= 14)) || (words(b.text).length >= 2 && words(b.text).length <= 5 && String(b.text).length <= 36),
  reveal: (b) => !!b.text && String(b.text).length <= 34,
  tunnel: (b) => !!b.text && String(b.text).length <= 40 && ((b.imgs && b.imgs.length >= 2) || (b.items && b.items.length >= 2)),
  parallax: (b) => !!b.img && !!b.text && String(b.text).length <= 50,
  marquee3d: (b) => !!b.text && String(b.text).length <= 40,
  flare: (b) => !!b.text && String(b.text).length <= 34,
  ring3d: (b) => !!b.text && String(b.text).length <= 40,
  chipfield: (b) => !!b.text && String(b.text).length <= 24 && b.items && b.items.length >= 2,
  rule: (b) => !!b.text && String(b.text).length <= 40 && (String(b.text).includes('|') || !!b.sub || words(b.text).length >= 2),
  glowproduct: (b) => !!b.img,
  colorslide: (b) => !!b.text && String(b.text).length <= 40,
  fan: (b) => b.imgs && b.imgs.length >= 2,
  dotsphere: (b) => !!b.text && String(b.text).length <= 40,
  stepstack: (b) => (b.lines && b.lines.length >= 2) || (b.items && b.items.length >= 2),
  bigcount: (b) => /\d/.test(String(b.number || '')) || b.price != null,
  toggle: (b) => !!b.text && String(b.text).length <= 30,
  assemble: (b) => !!b.text && String(b.text).length <= 14,
  avatars: (b) => (b.imgs && b.imgs.length >= 2) || (b.items && b.items.length >= 2),
  cardstack: (b) => (b.imgs && b.imgs.length >= 1) || (b.items && b.items.length >= 2),
  numbered: (b) => !!b.text && String(b.text).length <= 28,
  bracket: (b) => !!b.text && String(b.text).length <= 36,
  status: (b) => (b.items && b.items.length >= 2) || (!!b.text && !!b.sub),
  stars: (b) => /^\d(\.\d)?$/.test(String(b.number || '').trim()) && Number(b.number) <= 5,
  prompt: (b) => !!b.text && String(b.text).length <= 60,
  wordswap: (b) => (b.items && b.items.length >= 2) || /[\/,|]/.test(String(b.text || '')),
  rollword: (b) => !!b.text && String(b.text).length <= 20 && ((b.lines && b.lines.length >= 2) || (b.items && b.items.length >= 2)),
  endcard: (b) => !!b.text && String(b.text).length <= 40,
};

// ---------------------------------------------------------------------------
// Premium only: the first-generation shots (loud, template-looking) are swapped for their premium
// equivalents, whoever planned the video (the AI director or the offline planner).
// ---------------------------------------------------------------------------
const LEGACY = {
  words: (b) => (String(b.text).length <= 34 ? 'reveal' : 'sentence'),
  kinetic: () => 'poster', zoomword: () => 'slam', split: () => 'reveal', type: () => 'prompt',
  brand: (b) => (b.hasLogo ? 'logo' : String(b.text).length <= 14 ? 'assemble' : 'reveal'),
  pills: (b) => ((b.items || []).length <= 4 ? 'stack' : 'ticker'),
  wheel: (b) => ((b.items || []).length >= 3 ? 'ticker' : 'stack'),
  grid: (b) => ((b.items || []).length <= 4 ? 'stack' : 'ticker'),
  orbit: () => 'chipfield',
  stat: (b) => (/\d/.test(String(b.number || '')) && /^\D*[\d,.]+\D*$/.test(String(b.number)) ? 'bigcount' : 'isocard'),
  hero: (b) => (b.full ? 'hero' : 'parallax'),
};
export const LEGACY_SHOTS = Object.keys(LEGACY).filter((k) => k !== 'hero');
export function premiumize(beats) {
  const out = swapLegacy(beats);
  // never the same shot twice in a row
  for (let i = 1; i < out.length; i++) {
    if (out[i].shot !== out[i - 1].shot || out[i].shot === 'numbered') continue;
    for (const alt of ['sentence', 'flip', 'reveal', 'scatter']) { const o = { ...out[i], shot: alt }; if (alt !== out[i - 1].shot && SHOT_VALID[alt](o)) { out[i] = o; break; } }
  }
  return out;
}
function swapLegacy(beats) {
  return (beats || []).map((b) => {
    const to = LEGACY[b.shot] && LEGACY[b.shot](b);
    if (!to || to === b.shot) return b;
    const o = { ...b, shot: to };
    if (to === 'stack' || to === 'ticker') o.title = o.title || '';
    if (SHOT_VALID[to] && SHOT_VALID[to](o)) return o;
    const alt = { ...b, shot: 'sentence' };
    return SHOT_VALID.sentence(alt) ? alt : b;
  });
}
// calm, uncluttered backgrounds only
const PREMIUM_AMBIENT = ['glow', 'grid', 'dots', 'frame', 'beams', 'sparkles', 'particles'];
const cleanAmbient = (list) => { const out = (list || []).filter((x) => PREMIUM_AMBIENT.includes(x)).slice(0, 2); return out.length ? out : ['glow']; };
const VALID = SHOT_VALID;
export const ICON_NAMES = ['phone','chat','pin','clock','cart','star','heart','check','bolt','gift','truck','leaf','cup','food','cake','calendar','shield','tag','home','sparkle','scissors','book','dumbbell','music','wifi','card','users','trophy','camera','globe','arrow','bed','car','school','fire','shirt','drop','sun'];
export { iconFor, priceOf };

function makePlanner(theme, rnd) {
  const counters = {};
  const used = {};
  const LIMIT = { status: 1, stars: 1, prompt: 1, wordswap: 1, rollword: 2, endcard: 1, stepstack: 2, bigcount: 2, toggle: 1, assemble: 1, avatars: 1, cardstack: 1, numbered: 5, bracket: 2, flare: 2, ring3d: 1, chipfield: 1, rule: 2, glowproduct: 2, colorslide: 3, fan: 1, dotsphere: 1, slam: 2, poster: 2, reveal: 2, tunnel: 1, parallax: 2, marquee3d: 1, logo: 1, widgets: 1, iconmorph: 1, isocard: 1, ticker: 1, collage: 1, stack: 1, chat: 1, scatter: 2, flip: 2, split: 1, card: 1, counter: 1, notify: 1, orbit: 1, phone: 1, brand: 1, wheel: 1, pills: 1, grid: 1, flow: 1, stat: 1, type: 2, hero: 2, zoomword: 3, kinetic: 3 };
  let last = '';
  const ok = (shot, b) => VALID[shot] && VALID[shot](b) && (used[shot] || 0) < (LIMIT[shot] || 9);
  const take = (shot) => { used[shot] = (used[shot] || 0) + 1; last = shot; return shot; };

  return function pick(cat, b, extra = []) {
    const list = [...(theme.prefer[cat] || []), ...extra];
    const start = counters[cat] = ((counters[cat] ?? Math.floor(rnd() * list.length)) + 1);
    for (let k = 0; k < list.length; k++) {
      const shot = list[(start + k) % list.length];
      if (shot !== last && ok(shot, b)) return take(shot);
    }
    for (const shot of list) if (ok(shot, b)) return take(shot);
    if (b.items && b.items.length >= 2) {   // a list must always land on a list shot, even past the usual limits
      for (const shot of [...list, 'grid', 'pills', 'wheel', 'stack', 'flow']) if (shot !== last && VALID[shot] && VALID[shot](b)) return take(shot);
    }
    const fallback = theme.calm ? ['sentence', 'flip', 'words'] : ['words', 'kinetic', 'type', 'zoomword'];
    for (const shot of fallback) if (shot !== last && VALID[shot](b)) return take(shot);
    return take(theme.calm ? 'sentence' : 'words');
  };
}

/**
 * No shot may hang on screen. A beat much longer than ~3 s (a 60 s video with only a few shots) is cut down,
 * and the freed time is filled with new shots built from the video's own words (messages, selling points,
 * products, the brand), each animated differently, so long videos keep moving instead of holding still.
 */
function fillPacing(beats, duration, plan, theme, rnd) {
  if (!beats?.length) return beats;
  const L = duration <= 20 ? 2.8 : duration <= 40 ? 3.1 : 3.4;
  const used = new Set(beats.map((b) => String(b.text || '').toLowerCase()));
  const pool = [];
  for (const sc of plan.scenes || []) for (const t of [].concat(sc.on_screen_text || [])) {
    for (const part of String(t || '').split(/\s*[·|•]\s*/)) {
      const x = part.trim();
      if (x.length >= 3 && x.length <= 60 && !used.has(x.toLowerCase()) && !/^(\+?\d[\d\s-]{6,})$/.test(x)) { pool.push(x); used.add(x.toLowerCase()); }
    }
  }
  const brand = plan.business?.name;
  const textShots = (theme.calm ? ['sentence', 'flip', 'scatter', 'words', 'type'] : ['kinetic', 'sentence', 'split', 'words', 'flip', 'type']);
  const shotFor = (text, avoid) => {
    const ok = textShots.filter((k) => SHOT_VALID[k] && SHOT_VALID[k]({ text }) && k !== avoid);
    return ok.length ? ok[Math.floor(rnd() * ok.length)] : 'words';
  };
  const cuts = ['focus', 'morph', 'swoosh', 'whip', 'dive', 'zoom'].filter((c) => !theme.calm || c !== 'zoom');
  const out = [];
  let pi = 0;
  beats.forEach((b, i) => {
    const len = b.t1 - b.t0;
    const isLast = i === beats.length - 1;
    const keep = isLast ? Math.min(len, Math.max(L, 3.2)) : L;
    if (len <= keep * 1.45) { out.push(b); return; }
    // the original shot keeps the start of its slot (the final call to action keeps the end)
    const extraTime = len - keep;
    const n = Math.max(1, Math.round(extraTime / L));
    const step = extraTime / n;
    const fresh = [];
    // nothing new left: restate the key lines in turn (each in a different animation), never the same twice in a row
    const again = [...new Set([b.text, brand, ...(plan.scenes || []).map((sc) => [].concat(sc.on_screen_text || [])[0])].map((x) => String(x || '').trim()).filter((x) => x && x.length <= 60))];
    let ri = 0;
    for (let k = 0; k < n; k++) {
      let text = pool[pi++];
      if (!text) {
        const prev = (fresh[fresh.length - 1] || b).text;
        text = again.find((x, j) => j >= ri && x !== prev) || again.find((x) => x !== prev) || again[0];
        ri = (again.indexOf(text) + 1) % Math.max(1, again.length);
      }
      if (!text) break;
      fresh.push({ shot: shotFor(text, (fresh[fresh.length - 1] || b).shot), text, cut: { type: cuts[Math.floor(rnd() * cuts.length)], d: 0.3 } });
    }
    if (!fresh.length) { out.push(b); return; }
    const realStep = extraTime / fresh.length;
    if (isLast) {
      let t = b.t0;
      fresh.forEach((f) => { out.push({ ...f, t0: Math.round(t * 100) / 100, t1: Math.round((t + realStep) * 100) / 100 }); t += realStep; });
      out.push({ ...b, t0: Math.round(t * 100) / 100 });
    } else {
      const t = b.t0 + keep;
      out.push({ ...b, t1: Math.round(t * 100) / 100, cut: b.cut || { type: 'focus', d: 0.3 } });
      fresh.forEach((f, k) => out.push({ ...f, t0: Math.round((t + k * realStep) * 100) / 100, t1: k === fresh.length - 1 ? b.t1 : Math.round((t + (k + 1) * realStep) * 100) / 100, ...(k === fresh.length - 1 && b.cut ? { cut: b.cut } : {}) }));
    }
    void step;
  });
  return out;
}

function planBeats(plan, scenes, theme, rnd, ctx) {
  const pick0 = makePlanner(theme, rnd);
  const pick = (cat, b, extra = []) => pick0(cat, b, theme.calm ? extra.filter((x) => !['zoomword', 'kinetic', 'split'].includes(x)) : extra);
  const beats = [];
  const add = (scene, specs) => {
    // specs: [{ weight, ...beat }] -> spread over the scene, minimum 0.9s each
    const len = scene.end - scene.start;
    let list = specs.filter(Boolean);
    while (list.length > 1 && len / list.length < 1.0) list = list.slice(1);
    const total = list.reduce((a, s) => a + (s.weight || 1), 0);
    let t = scene.start;
    list.forEach((s, k) => {
      const t1 = k === list.length - 1 ? scene.end : Math.round((t + (len * (s.weight || 1)) / total) * 100) / 100;
      const { weight, ...b } = s;
      beats.push({ ...b, t0: t, t1, scene: scene.i });
      t = t1;
    });
  };

  // Split a line into a short "punch" (1-2 words) and the rest, for zoom-through + follow-up beats.
  const STOP = /^(a|an|the|your|our|my|is|are|in|on|of|for|to|and|or|now|at|with|from|we|you|it|this|that|be|by)$/i;
  const punchSplit = (text) => {
    const w = words(text);
    if (w.length < 3) return null;
    // 1) natural break: "Hungry? | Lunch is ready!"
    const br = w.findIndex((x, k) => k < w.length - 1 && /[?!,:.]$/.test(x));
    if (br >= 0 && br <= 2) return [w.slice(0, br + 1).join(' '), w.slice(br + 1).join(' ')];
    // 2) first content word(s): never end the punch on a stop word, keep it short
    let n = 1;
    while (n < w.length - 1 && (STOP.test(w[n - 1].replace(/[^\w]/g, '')) || w.slice(0, n).join(' ').length < 4)) n++;
    const punch = w.slice(0, n).join(' ');
    if (punch.length > 16) return null;
    if (n === 1 && (punch.replace(/[^\w]/g, '').length < 5 || /^(where|what|when|who|how|why|this|these|those|get|come|book|make|term|from)$/i.test(punch.replace(/[^\w]/g, '')))) return null;   // a weak lone word is not a punch
    return [w.slice(0, n).join(' '), w.slice(n).join(' ')];
  };
  const textBeats = (s, text, cat, sub, weightA = 1, weightB = 1.2) => {
    const len = s.end - s.start;
    if (theme.calm) {
      if (sub && len >= 3.2) return [{ weight: 1.2, shot: pick(cat, { text }), text, icon: iconFor(text, 'sparkle') }, { weight: 1, shot: pick('text', { text: sub }, ['sentence']), text: sub, icon: iconFor(sub, 'sparkle') }];
      return [{ weight: 1, shot: pick(cat, { text }), text, sub, icon: iconFor(text + ' ' + (sub || ''), 'sparkle') }];
    }
    const ps = punchSplit(text);
    if (ps && len >= 2.6) {
      return [{ weight: weightA, shot: pick(cat, { text: ps[0] }, ['zoomword']), text: ps[0] },
        { weight: weightB, shot: pick('text', { text: ps[1] }), text: ps[1], sub, icon: iconFor(text + ' ' + (sub || ''), 'sparkle') }];
    }
    return [{ weight: weightA + weightB, shot: pick(cat, { text }), text, sub, icon: iconFor(text + ' ' + (sub || ''), 'sparkle') }];
  };

  scenes.forEach((s, i) => {
    const len = s.end - s.start;
    const photoUrl = s.photo?.url, photoRatio = s.photo?.width && s.photo?.height ? s.photo.height / s.photo.width : 1;

    if (s.kind === 'cta') {
      const lock = { shot: 'lockup', text: ctx.brand, subs: [s.head, ...s.subs].filter((x) => x && x !== ctx.brand).slice(0, 2), button: s.button };
      if (len >= 4 && (theme.prefer.cta || []).includes('chat') && s.head && s.head.length <= 60) {
        add(s, [{ weight: 1.2, shot: 'chat', text: s.head, sub: s.subs[0] || `Yes! ${s.button ? s.button : "We're ready for you."}` }, { weight: 1.2, ...lock }]);
      } else if (len >= 6 && theme.prefer.list.includes('phone') && ctx.menu.length >= 2) {
        add(s, [{ weight: 0.8, shot: pick('hook', { text: s.head }), text: s.head }, { weight: 1, shot: 'phone', title: '', items: ctx.menu.slice(0, 3), button: s.button }, { weight: 1.3, ...lock }]);
      } else if (len >= 3.6) {
        add(s, [{ weight: 0.8, shot: pick('hook', { text: s.head }, ['kinetic']), text: s.head }, { weight: 1.4, ...lock }]);
      } else add(s, [{ ...lock, text: s.head }]);
      return;
    }

    if (s.kind === 'offer') {
      if (photoUrl || s.bg) {
        add(s, [...(len >= 4 ? [{ weight: 0.7, shot: pick('text', { text: s.head }, ['zoomword']), text: s.head }] : []),
          { weight: 1.3, shot: 'hero', text: s.head, price: s.price, img: (s.bg || s.photo).url, imgRatio: photoRatio, full: !!s.bg, bigword: ctx.brand }]);
        return;
      }
      const shot = pick('price', { price: s.price, text: s.head });
      const ps = punchSplit(s.head);
      const leadText = shot === 'card' && ps ? ps[0] : s.head;
      const lead = { weight: 0.8, shot: pick('text', { text: leadText }, ['zoomword', 'kinetic']), text: leadText };
      if (shot === 'card') add(s, [lead, { weight: 1.3, shot: 'card', text: s.head, price: s.price, subs: s.subs, icon: iconFor(s.head + ' ' + s.subs.join(' '), 'tag') }]);
      else add(s, [lead, { weight: 1.3, shot, text: s.subs[0] || '', price: s.price }]);
      return;
    }

    if (s.kind === 'list') {
      const items = s.rows.map((r) => ({ name: r.name, price: r.price, text: r.name, icon: iconFor(r.name, 'tag') }));
      const shot = pick('list', { items });
      const icon = iconFor(s.head + ' ' + s.rows.map((r) => r.name).join(' '), 'tag');
      const lead = s.head ? { weight: 0.7, shot: pick('text', { text: s.head }, ['zoomword']), text: s.head } : (len >= 4 && ctx.brand.length <= 18 ? { weight: 0.6, shot: pick('hook', { text: ctx.brand }, ['zoomword']), text: ctx.brand } : null);
      add(s, [lead, { weight: 1.6, shot, items, title: '', icon, useMark: shot === 'wheel' && !!ctx.logo }]);
      return;
    }

    // ---- text scenes
    if (photoUrl || s.bg) {
      add(s, [{ shot: !s.bg && String(s.head || '').length <= 50 ? 'parallax' : 'hero', text: s.head, img: (s.bg || s.photo).url, imgRatio: photoRatio, full: !!s.bg, bigword: ctx.brand }]);
      return;
    }
    let parts = s.head.split(SPLIT_RE).filter(Boolean);
    // premium styles: a stack of short lines ("Invoices / Payroll / Inventory") is a feature list too
    if (theme.calm && parts.length < 2 && s.subs.length >= 2 && [s.head, ...s.subs].every((x) => x.length <= 20)) { parts = [s.head, ...s.subs]; s = { ...s, subs: [] }; }
    if (parts.length >= 2) {
      const items = parts.map((p) => ({ text: p, icon: iconFor(p, 'check') }));
      const shot = pick('features', { items });
      const lead = s.subs[0] ? { weight: 0.7, shot: pick('text', { text: s.subs[0] }), text: s.subs[0] } : null;
      add(s, [lead, { weight: 1.5, shot, items, text: '', title: '' }]);
      return;
    }
    const isBrand = i > 0 && (i === 1 || /brand|intro|logo/.test(s.purpose) || !!s.logo);
    if (isBrand) {
      const subItems = s.subs.flatMap((x) => x.split(SPLIT_RE)).filter(Boolean);
      const b = { hasLogo: !!ctx.logo, text: s.head, subs: subItems, items: subItems.map((t) => ({ text: t, icon: iconFor(t, 'sparkle') })), imgs: ctx.photos, number: s.head };
      const shot = pick('brand', b, ctx.logo ? ['logo'] : []);
      const second = s.subs.length ? (subItems.length >= 3 ? { weight: 1, shot: pick('features', { items: b.items }), items: b.items }
        : { weight: 1, shot: pick('text', { text: s.subs.join(' ') }, ['split']), text: s.subs.join(' '), icon: iconFor(s.subs.join(' '), 'sparkle'), useMark: false }) : null;
      if (shot === 'notify') add(s, [{ weight: 1, shot: 'brand', text: s.head, subs: [] }, { weight: 1, shot, text: s.subs[0], subs: s.subs.slice(1) }]);
      else if (shot === 'split') add(s, [{ weight: 1.2, shot, text: s.head, sub: s.subs.join(' · '), useMark: true }]);
      else if (shot === 'orbit') add(s, [{ weight: 1.2, shot, text: s.head, items: b.items }]);
      else if (shot === 'logo') add(s, [{ weight: 1, shot, text: s.head, sub: s.subs.join(' · ') }, second]);
      else if (shot === 'iconmorph') add(s, [{ weight: 1, shot, text: s.head, sub: s.subs.join(' · '), icon: iconFor(s.head + ' ' + s.subs.join(' '), 'sparkle') }]);
      else if (shot === 'collage') add(s, [{ weight: 1, shot, text: s.head, items: b.items, imgs: ctx.photos }]);
      else if (shot === 'isocard') add(s, [{ weight: 1, shot, number: s.head, text: s.subs.join(' · ') }]);
      else add(s, [{ weight: 1.1, shot: 'brand', text: s.head, subs: [] }, second]);
      return;
    }
    const stat = s.head.match(STAT_RE);
    if (stat && !PHONE_RE.test(s.head) && i > 0) {
      if (theme.calm) { add(s, [{ shot: 'isocard', number: stat[1].replace(/\s/g, ''), text: s.head.replace(stat[0], '').replace(/\s{2,}/g, ' ').trim() || s.subs[0] || '' }]); return; }
      add(s, [{ shot: 'stat', number: stat[1].replace(/\s/g, ''), text: s.head.replace(stat[0], '').replace(/\s{2,}/g, ' ').trim() || s.subs[0] || '' }]);
      return;
    }
    const sub = s.subs.join(' · ');
    add(s, textBeats(s, s.head, i === 0 ? 'hook' : 'text', sub));
  });

  // Cuts: rotate through the style's transitions; beats inside the same scene prefer morph/whip.
  const T = theme.transitions;
  let prev = '';
  beats.forEach((b, k) => {
    if (k === beats.length - 1) return;
    const same = beats[k + 1].scene === b.scene;
    let type = T[(k + (ctx.seed % T.length)) % T.length];
    if (same && T.includes('morph') && prev !== 'morph') type = 'morph';
    if (type === prev) type = T[(T.indexOf(type) + 1) % T.length];
    b.cut = { type, d: type === 'wipe' ? 0.34 : type === 'dive' ? 0.42 : type === 'swoosh' ? 0.36 : 0.28 };
    prev = type;
  });
  // icons for every beat that shows one
  beats.forEach((b) => { if (!b.icon) b.icon = iconFor(`${b.text || ''} ${b.title || ''}`, 'sparkle'); });
  return beats;
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
function css(theme, c, W, H) {
  const side = Math.min(W, H), U = side / 1080;
  const n = (v) => `${Math.round(v * U)}px`;
  const lightBg = luminance(c.background) > 0.45;
  const onP = luminance(c.primary) > 0.5 ? '#111111' : '#FFFFFF';
  const onS = luminance(c.secondary) > 0.5 ? '#111111' : '#FFFFFF';
  const subStack = theme.subStack || theme.stack;
  const surface = lightBg ? '#FFFFFF' : 'rgba(255,255,255,.08)';
  const line = lightBg ? 'rgba(15,15,40,.09)' : 'rgba(255,255,255,.16)';
  const shadow = lightBg ? `0 ${n(30)} ${n(70)} ${n(-20)} rgba(20,20,60,.25)` : `0 ${n(30)} ${n(90)} ${n(-20)} rgba(0,0,0,.65)`;
  return `
  :root { --primary: ${c.primary}; --secondary: ${c.secondary}; --bg: ${c.background}; --text: ${c.text}; --scale: 1;
    --on-primary: ${onP}; --on-secondary: ${onS}; --surface: ${surface}; --line: ${line}; --shadow: ${shadow};
    --muted: color-mix(in srgb, var(--text) 62%, var(--bg)); }
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: var(--bg); }
  * { box-sizing: border-box; }
  #stage { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: var(--bg); color: var(--text); font-family: ${theme.stack}; }
  #bg, #cam, #fx { position: absolute; inset: 0; }
  #bg { overflow: hidden; z-index: 0; } #cam { z-index: 5; } #fx { z-index: 50; pointer-events: none; overflow: hidden; }
  .bt { position: absolute; inset: 0; visibility: hidden; opacity: 0; perspective: ${n(1600)}; }
  .bx, .bi { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; transform-style: preserve-3d; }
  .fitbox { position: relative; transform-origin: 50% 50%; }
  .col { display: flex; flex-direction: column; } .center { align-items: center; text-align: center; }
  .col > * + * { margin-top: ${n(34)}; }

  /* ---------- type ---------- */
  .tx-line { font-weight: ${theme.headWeight}; line-height: 1.06; letter-spacing: ${theme.tracking ?? -1}px; max-width: ${W - side * 0.14}px;
    ${theme.upper ? 'text-transform: uppercase;' : ''} ${theme.italic ? 'font-style: italic;' : ''} }
  .tx-line.small { font-weight: ${Math.min(700, theme.headWeight)}; }
  .tx-sub { font-family: ${subStack}; font-weight: 600; color: var(--muted); line-height: 1.3; max-width: ${W - side * 0.14}px; }
  .wd { display: inline-block; overflow: hidden; vertical-align: top; position: relative; padding: .08em .05em .16em; margin: -.08em -.05em -.16em; }
  .wi { display: inline-block; position: relative; z-index: 1; }
  .acc .wi { color: var(--primary); }
  .mkd .wi { color: var(--on-primary); padding: 0 .12em; }
  .mk { position: absolute; z-index: 0; left: 0; right: 0; top: .1em; bottom: .12em; background: var(--primary); border-radius: .14em; transform-origin: 0 50%; }
  .kin { display: flex; flex-direction: column; align-items: flex-start; text-align: left; }
  .kin-line { font-weight: ${theme.headWeight}; line-height: .98; letter-spacing: ${theme.tracking ?? -1}px; white-space: nowrap; ${theme.upper ? 'text-transform: uppercase;' : ''} ${theme.italic ? 'font-style: italic;' : ''} }
  .kin-line.small { font-family: ${subStack}; font-weight: 600; color: var(--muted); margin: ${n(6)} 0; }
  .kin-line.acc span { color: var(--primary); }
  .zw { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .zw-main, .zw-echo { font-weight: ${theme.headWeight}; line-height: 1; white-space: nowrap; letter-spacing: ${theme.tracking ?? -1}px; ${theme.upper ? 'text-transform: uppercase;' : ''} ${theme.italic ? 'font-style: italic;' : ''} }
  .zw-echo { position: absolute; color: transparent; -webkit-text-stroke: ${n(3)} var(--primary); }
  .zw-sub { position: absolute; top: 100%; margin-top: ${n(40)}; white-space: nowrap; }
  .sel { position: relative; display: inline-block; padding: ${n(18)} ${n(30)}; border: ${n(4)} solid var(--primary); }
  .sel-text { position: relative; z-index: 2; white-space: nowrap; font-weight: ${theme.headWeight}; line-height: 1.1; ${theme.upper ? 'text-transform: uppercase;' : ''} }
  .ch { display: inline-block; }
  .hd { position: absolute; width: ${n(22)}; height: ${n(22)}; background: #fff; border: ${n(4)} solid var(--primary); border-radius: ${n(5)}; z-index: 3; }
  .hd.tl { left: ${n(-13)}; top: ${n(-13)}; } .hd.tr { right: ${n(-13)}; top: ${n(-13)}; } .hd.bl { left: ${n(-13)}; bottom: ${n(-13)}; } .hd.br { right: ${n(-13)}; bottom: ${n(-13)}; }
  .cursor { position: absolute; right: ${n(-6)}; top: 15%; bottom: 15%; width: ${n(6)}; background: var(--primary); z-index: 3; }
  .sel-fill { position: absolute; inset: 0; background: color-mix(in srgb, var(--primary) 22%, transparent); transform-origin: 0 50%; z-index: 1; }

  /* ---------- brand / marks ---------- */
  .mark { position: relative; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 26%; }
  .mark.mono { background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 55%, var(--secondary))); color: var(--on-primary);
    font-weight: 800; font-family: ${theme.stack}; box-shadow: var(--shadow); }
  .mark.logo img { width: 100%; height: 100%; object-fit: contain; }
  .mark.logo.card { background: #fff; box-shadow: var(--shadow); }
  .mark.logo.card img { width: 80%; height: 80%; }   /* inner space as a share of the mark (padding % would follow the page width) */
  .mark.logo.photo { overflow: hidden; } .mark.logo.photo img { width: 100%; height: 100%; object-fit: cover; }
  .mark.logo.card.ink { background: #0B0A12; }   /* light logos sit on a dark card */
  .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: ${n(16)}; max-width: ${W - side * 0.14}px; }
  .chip { font-family: ${subStack}; font-weight: 600; font-size: ${n(40)}; padding: ${n(14)} ${n(30)}; border-radius: 999px; background: var(--surface); border: ${n(2)} solid var(--line); }
  .burst-dot { position: absolute; left: 50%; top: 50%; margin: -6px 0 0 -6px; border-radius: 50%; background: var(--primary); z-index: 0; }
  .burst-dot.c1 { background: var(--secondary); } .burst-dot.c2 { background: var(--text); opacity: .6; }

  /* ---------- orbit ---------- */
  .orbit { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
  .orb { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: ${n(14)}; white-space: nowrap; font-family: ${subStack}; font-weight: 700; font-size: ${n(58)};
    padding: ${n(20)} ${n(34)}; border-radius: 999px; background: var(--surface); border: ${n(2)} solid var(--line); box-shadow: var(--shadow); }
  .orb .ic { width: ${n(44)}; height: ${n(44)}; color: var(--primary); }
  .orb.photo { padding: 0; width: ${n(220)}; height: ${n(220)}; border-radius: ${n(40)}; overflow: hidden; }
  .orb.photo img { width: 100%; height: 100%; object-fit: cover; }
  .orbit-c { z-index: 15; }

  /* ---------- counter ---------- */
  .ringbox { position: relative; display: flex; align-items: center; justify-content: center; }
  .ringbox svg { position: absolute; inset: 0; transform: rotate(-90deg); }
  .rg-bg { fill: none; stroke: var(--line); stroke-width: 3; }
  .rg { fill: none; stroke: var(--secondary); stroke-width: 3.4; stroke-linecap: round; }
  .rg-dot { position: absolute; left: 50%; top: 50%; width: ${n(30)}; height: ${n(30)}; border-radius: 50%; background: var(--primary); box-shadow: 0 0 ${n(30)} var(--primary); }
  .odo { display: inline-flex; align-items: center; font-weight: 800; line-height: 1; font-family: ${theme.upper ? theme.stack : subStack}; letter-spacing: -0.02em; white-space: nowrap; }
  .odo-pre { font-family: 'Poppins','DejaVu Sans',Arial,sans-serif; margin-right: .05em; }
  .odo-d { display: inline-block; height: 1em; overflow: hidden; }
  .odo-col { display: flex; flex-direction: column; } .odo-col span { height: 1em; line-height: 1; }
  .odo.big { color: var(--text); }
  .odo.chip { background: var(--primary); color: var(--on-primary); padding: .14em .4em; border-radius: 999px; }

  /* ---------- card ---------- */
  .card-hold { perspective: ${n(1400)}; display: flex; align-items: center; justify-content: center; }
  .ui-card { position: relative; background: var(--surface); border: ${n(2)} solid var(--line); box-shadow: var(--shadow); overflow: hidden; display: flex; align-items: center; justify-content: center;
    transform-style: preserve-3d; }
  .cc { align-items: flex-start; text-align: left; }
  .cc > * + * { margin-top: ${n(22)}; }
  .cc-ic { width: ${n(130)}; height: ${n(130)}; border-radius: ${n(32)}; background: var(--primary); color: var(--on-primary); display: flex; align-items: center; justify-content: center; }
  .cc-ic .ic { width: 58%; height: 58%; }
  .cc-title { font-weight: ${Math.min(800, theme.headWeight)}; line-height: 1.1; ${theme.upper ? 'text-transform: uppercase;' : ''} }
  .odo.card { color: var(--primary); }
  .cc-sub { font-family: ${subStack}; color: var(--muted); font-weight: 600; }
  .cc-btn { display: inline-flex; align-items: center; gap: ${n(14)}; padding: ${n(18)} ${n(34)}; border-radius: 999px; background: var(--primary); color: var(--on-primary); font-family: ${subStack}; font-weight: 700; font-size: ${n(38)}; }
  .cc-btn .ic { width: ${n(38)}; height: ${n(38)}; }

  /* ---------- pills / wheel / flow / grid ---------- */
  .pills { display: flex; flex-direction: column; gap: ${n(22)}; width: ${WIDE(W, H) ? n(1200) : n(900)}; }
  .pill { display: flex; justify-content: space-between; align-items: center; gap: ${n(24)}; padding: ${n(30)} ${n(30)} ${n(30)} ${n(48)}; border-radius: 999px;
    background: var(--surface); border: ${n(2)} solid var(--line); box-shadow: var(--shadow); font-family: ${subStack}; font-weight: 700; }
  .pill-n { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pill-p { background: var(--primary); color: var(--on-primary); padding: ${n(12)} ${n(28)}; border-radius: 999px; white-space: nowrap; }
  .wheel-wrap { display: flex; flex-direction: column; align-items: center; gap: ${n(40)}; }
  .wheel-wrap.row { flex-direction: row; gap: ${n(70)}; }
  .ic-badge { width: ${n(220)}; height: ${n(220)}; border-radius: 30%; background: var(--primary); color: var(--on-primary); display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow); }
  .ic-badge .ic { width: 52%; height: 52%; }
  .wheel { position: relative; width: ${WIDE(W, H) ? n(1000) : n(880)}; overflow: hidden;
    -webkit-mask: linear-gradient(transparent, #000 28%, #000 72%, transparent); mask: linear-gradient(transparent, #000 28%, #000 72%, transparent); }
  .wheel-list { position: absolute; left: 0; right: 0; top: 0; }
  .wheel-row { display: flex; justify-content: space-between; align-items: center; gap: ${n(30)}; padding: 0 ${n(40)}; font-family: ${subStack}; font-weight: 700; transform-origin: 50% 50%; white-space: nowrap; }
  .wheel-row b { color: var(--muted); }
  .wheel-row.on { color: var(--text); } .wheel-row.on b { color: var(--primary); }
  .wheel-row.on::before { content: ''; position: absolute; left: 0; right: 0; top: 8%; bottom: 8%; border-radius: 999px; background: var(--surface); border: ${n(2)} solid var(--line); z-index: -1; }
  .flow { display: flex; flex-direction: column; align-items: center; }
  .flow.row { flex-direction: row; }
  .flow-card { display: flex; align-items: center; gap: ${n(24)}; padding: ${n(30)} ${n(44)}; border-radius: ${n(36)}; background: var(--surface); border: ${n(2)} solid var(--line);
    box-shadow: var(--shadow), 0 0 ${n(60)} color-mix(in srgb, var(--primary) 25%, transparent); font-family: ${subStack}; font-weight: 700; min-width: ${n(560)}; }
  .flow.row .flow-card { flex-direction: column; min-width: ${n(320)}; text-align: center; }
  .fc-ic { width: ${n(90)}; height: ${n(90)}; border-radius: ${n(26)}; background: color-mix(in srgb, var(--primary) 18%, transparent); color: var(--primary); display: flex; align-items: center; justify-content: center; flex: none; }
  .fc-ic .ic { width: 58%; height: 58%; }
  .flow-link { position: relative; width: ${n(6)}; height: ${n(90)}; background: color-mix(in srgb, var(--primary) 40%, transparent); overflow: hidden; transform-origin: 50% 0; }
  .flow.row .flow-link { width: ${n(110)}; height: ${n(6)}; transform-origin: 0 50%; }
  .flow-pulse { position: absolute; left: 0; top: 0; width: 100%; height: 40%; background: linear-gradient(transparent, var(--secondary), transparent); }
  .flow.row .flow-pulse { width: 40%; height: 100%; background: linear-gradient(90deg, transparent, var(--secondary), transparent); }
  .grid { display: grid; gap: ${n(24)}; }
  .grid.g2 { grid-template-columns: repeat(2, ${n(450)}); } .grid.g3 { grid-template-columns: repeat(3, ${n(380)}); }
  .tile { display: flex; flex-direction: column; align-items: center; gap: ${n(18)}; padding: ${n(36)} ${n(24)}; border-radius: ${n(40)}; background: var(--surface); border: ${n(2)} solid var(--line);
    box-shadow: var(--shadow); font-family: ${subStack}; font-weight: 700; text-align: center; }
  .tile b { color: var(--primary); }
  .tile-ic { width: ${n(110)}; height: ${n(110)}; border-radius: 30%; background: var(--primary); color: var(--on-primary); display: flex; align-items: center; justify-content: center; }
  .tile-ic .ic { width: 55%; height: 55%; }

  /* ---------- split ---------- */
  .split-panel { position: absolute; background: var(--primary); display: flex; align-items: center; justify-content: center; z-index: 2;
    ${WIDE(W, H) ? 'right: 0; top: 0; bottom: 0; width: 46%; border-radius: ' + n(70) + ' 0 0 ' + n(70) + ';' : 'left: 0; right: 0; bottom: 0; height: 44%; border-radius: ' + n(70) + ' ' + n(70) + ' 0 0;'} }
  .split-circle { width: ${n(330)}; height: ${n(330)}; border-radius: 50%; background: #fff; color: var(--primary); display: flex; align-items: center; justify-content: center; box-shadow: 0 ${n(30)} ${n(80)} rgba(0,0,0,.25); }
  .split-circle .ic { width: 50%; height: 50%; }
  .split-text { position: absolute; z-index: 3; align-items: flex-start; text-align: left;
    ${WIDE(W, H) ? `left: ${n(110)}; top: 50%; width: 46%; transform-origin: 0 50%; margin-top: 0;` : `left: ${n(80)}; right: ${n(80)}; top: 8%; height: 46%; justify-content: center;`} }

  /* ---------- hero ---------- */
  .hero-word { position: absolute; left: 0; white-space: nowrap; font-weight: ${theme.headWeight}; line-height: 1; color: transparent; -webkit-text-stroke: ${n(3)} color-mix(in srgb, var(--primary) 60%, transparent); z-index: 0; ${theme.upper ? '' : 'text-transform: uppercase;'} }
  .hero-word.w0 { top: 14%; } .hero-word.w1 { bottom: 14%; -webkit-text-stroke-color: color-mix(in srgb, var(--secondary) 60%, transparent); }
  .hero-photo { position: relative; z-index: 2; border-radius: ${n(50)}; box-shadow: var(--shadow); ${lightBg ? `border: ${n(12)} solid #fff;` : ''} transform-style: preserve-3d; }
  .hp-in { position: absolute; inset: 0; overflow: hidden; border-radius: ${n(lightBg ? 38 : 50)}; }
  .hp-in img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hero-chip { position: absolute; right: ${n(-30)}; top: ${n(-40)}; transform: rotate(-8deg); z-index: 3; }
  .hero-full { position: absolute; inset: 0; overflow: hidden; } .hero-full img { width: 100%; height: 100%; object-fit: cover; }
  .hero-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.55) 55%, rgba(0,0,0,.85)); }
  .hero-over { z-index: 2; } .hero-over .tx-line { color: #fff; }

  /* ---------- phone / notify / stat / lockup ---------- */
  .phone-wrap { display: flex; flex-direction: column; align-items: center; gap: ${n(40)}; perspective: ${n(1400)}; }
  .phone-wrap.row { flex-direction: row; gap: ${n(80)}; }
  .phone { position: relative; border-radius: ${n(76)}; background: #0B0B12; padding: ${n(16)}; box-shadow: var(--shadow), 0 0 0 ${n(3)} rgba(255,255,255,.12) inset; transform-style: preserve-3d; }
  .notch { position: absolute; left: 50%; top: ${n(30)}; width: 30%; height: ${n(34)}; margin-left: -15%; border-radius: 999px; background: #000; z-index: 3; }
  .scr { position: relative; width: 100%; height: 100%; border-radius: ${n(62)}; overflow: hidden; background: ${lightBg ? '#FFFFFF' : 'color-mix(in srgb, var(--bg) 85%, white)'};
    display: flex; flex-direction: column; padding: ${n(90)} ${n(34)} ${n(34)}; color: var(--text); font-family: ${subStack}; }
  .scr-head { display: flex; align-items: center; gap: ${n(18)}; padding-bottom: ${n(24)}; border-bottom: ${n(2)} solid var(--line); }
  .scr-name { font-weight: 800; font-size: ${n(44)}; line-height: 1.1; }
  .scr-body { display: flex; flex-direction: column; gap: ${n(18)}; padding-top: ${n(26)}; }
  .scr-row { display: flex; justify-content: space-between; gap: ${n(14)}; padding: ${n(22)} ${n(24)}; border-radius: ${n(24)}; background: color-mix(in srgb, var(--primary) 9%, transparent); font-weight: 700; font-size: ${n(38)}; }
  .scr-row b { color: var(--primary); white-space: nowrap; }
  .scr-btn { display: flex; align-items: center; justify-content: center; gap: ${n(12)}; margin-top: ${n(10)}; padding: ${n(24)}; border-radius: 999px; background: var(--primary); color: var(--on-primary); font-weight: 800; font-size: ${n(30)}; }
  .scr-btn .ic { width: ${n(36)}; height: ${n(36)}; }
  .notif-wrap { display: flex; flex-direction: column; align-items: center; gap: ${n(24)}; }
  .notif { display: flex; align-items: center; gap: ${n(26)}; padding: ${n(20)}; border-radius: ${n(48)}; background: var(--surface); border: ${n(2)} solid var(--line); box-shadow: var(--shadow); overflow: hidden; }
  .notif-ic { flex: none; }
  .notif-tx { flex: none; font-family: ${subStack}; }
  .nt-top { display: flex; justify-content: space-between; gap: ${n(20)}; color: var(--muted); font-weight: 600; }
  .nt-top b { color: var(--text); }
  .nt-msg { font-weight: 700; margin-top: ${n(6)}; line-height: 1.2; }
  .slab { padding: ${n(60)} ${n(90)}; border-radius: ${n(60)}; background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 50%, var(--secondary))); color: var(--on-primary);
    box-shadow: var(--shadow), 0 ${n(40)} 0 color-mix(in srgb, var(--primary) 50%, black); }
  .slab-num { font-weight: 800; line-height: 1; white-space: nowrap; }
  .lockup { align-items: center; }
  .lk-top { display: flex; flex-direction: column; align-items: center; gap: ${n(36)}; }
  .lockup.row .lk-top { flex-direction: row; text-align: left; }
  .lk-div { display: block; width: ${n(260)}; height: ${n(5)}; border-radius: 9px; background: var(--primary); }
  .lockup.row .lk-div { width: ${n(5)}; height: ${n(240)}; }
  .lk-text { display: flex; flex-direction: column; gap: ${n(14)}; align-items: center; }
  .lockup.row .lk-text { align-items: flex-start; }
  .cta-btn { position: relative; display: inline-flex; align-items: center; gap: ${n(22)}; padding: ${n(34)} ${n(60)}; border-radius: 999px; background: var(--primary); color: var(--on-primary);
    font-family: ${subStack}; font-weight: 800; white-space: nowrap; box-shadow: 0 ${n(24)} ${n(60)} color-mix(in srgb, var(--primary) 45%, transparent); }
  .cta-btn .ic { width: 1.1em; height: 1.1em; }
  .click-ring { position: absolute; inset: ${n(-10)}; border-radius: 999px; border: ${n(6)} solid var(--primary); opacity: 0; }
  .cursor-arrow { position: absolute; width: ${n(70)}; height: ${n(70)}; z-index: 20; filter: drop-shadow(0 ${n(8)} ${n(12)} rgba(0,0,0,.35)); }
  .cursor-arrow svg { width: 100%; height: 100%; } .cursor-arrow path { fill: #fff; stroke: #111; stroke-width: 1.6; stroke-linejoin: round; }

  /* ---------- transitions ---------- */
  .fx-dot { position: absolute; left: 50%; top: 50%; width: ${n(170)}; height: ${n(170)}; margin: ${n(-85)} 0 0 ${n(-85)}; border-radius: 50%; background: var(--primary); visibility: hidden;
    box-shadow: 0 0 ${n(80)} color-mix(in srgb, var(--primary) 60%, transparent); }
  .fx-line { position: absolute; inset: 0; width: 100%; height: 100%; visibility: hidden; }
  .fx-line path { fill: none; stroke: var(--primary); stroke-width: ${n(16)}; stroke-linecap: round; filter: drop-shadow(0 0 ${n(16)} var(--primary)); }
  .fx-wipe { position: absolute; top: -5%; bottom: -5%; left: -5%; width: 110%; border-radius: ${n(90)}; }
  .fx-wipe.a { background: var(--primary); } .fx-wipe.b { background: var(--secondary); }
  .fx-flash { position: absolute; inset: 0; background: #fff; opacity: 0; }


  /* ---------- logo shot ---------- */
  .lg-rings { position: relative; display: flex; align-items: center; justify-content: center; }
  .lg-ring { position: absolute; inset: 0; border-radius: 50%; border: ${n(6)} solid var(--primary); opacity: 0; }
  .lg-mark { position: relative; z-index: 2; box-shadow: 0 ${n(30)} ${n(90)} color-mix(in srgb, var(--primary) 45%, transparent); }
  .lg-mark.logo:not(.card) { box-shadow: none; } .lg-mark.logo:not(.card) img { filter: drop-shadow(0 ${n(24)} ${n(50)} color-mix(in srgb, var(--primary) 40%, transparent)); }
  /* ---------- premium shots ---------- */
  .sent { max-width: ${W - side * 0.16}px; }
  .sent-line { font-weight: ${Math.min(700, theme.headWeight)}; line-height: 1.18; letter-spacing: -0.02em; text-align: center; max-width: ${W - side * 0.16}px; }
  .sent-line.small { font-weight: 600; color: var(--muted); }
  .sw { display: inline-block; } .sw .wi { display: inline-block; } .sl { display: inline-block; }
  .flip { display: grid; place-items: center; }
  .flip-c { grid-area: 1 / 1; white-space: nowrap; font-weight: ${Math.min(700, theme.headWeight)}; letter-spacing: -0.03em; line-height: 1.05; }
  .flip-c.acc { color: var(--primary); }
  .wg-row { display: flex; gap: ${n(30)}; align-items: center; }
  .wg { position: relative; flex: none; display: flex; flex-direction: column; justify-content: space-between; padding: ${n(28)}; border-radius: ${n(64)};
    background: linear-gradient(160deg, color-mix(in srgb, var(--primary) 26%, #15151c), #0d0d12); color: #fff; box-shadow: var(--shadow); font-family: ${subStack}; }
  .wg-top { display: flex; align-items: center; gap: ${n(12)}; font-weight: 700; font-size: ${n(34)}; white-space: nowrap; overflow: hidden; }
  .wg-top span { overflow: hidden; text-overflow: ellipsis; }
  .wg-top i { flex: none; width: ${n(16)}; height: ${n(16)}; border-radius: 50%; background: var(--secondary); }
  .wg-ring { position: relative; width: 62%; aspect-ratio: 1; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
  .wg-ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
  .wg-rb { fill: none; stroke: rgba(255,255,255,.12); stroke-width: 3.4; } .wg-r { fill: none; stroke: var(--primary); stroke-width: 3.4; stroke-linecap: round; }
  .wg-ring .ic { width: 42%; height: 42%; color: var(--primary); }
  .wg-val { font-weight: 800; font-size: ${n(46)}; white-space: nowrap; }
  .im { display: flex; align-items: center; justify-content: center; }
  .im-box { display: flex; align-items: center; gap: ${n(34)}; overflow: hidden; border-radius: ${n(64)}; background: var(--surface); border: ${n(2)} solid var(--line); box-shadow: var(--shadow); }
  .im-ic { flex: none; width: ${n(150)}; height: ${n(150)}; border-radius: ${n(40)}; display: flex; align-items: center; justify-content: center; color: var(--primary);
    background: color-mix(in srgb, var(--primary) 12%, transparent); }
  .im-ic .ic { width: 56%; height: 56%; }
  .im-tx { flex: none; display: flex; flex-direction: column; gap: ${n(10)}; padding-right: ${n(40)}; font-family: ${subStack}; }
  .im-title { font-weight: 800; line-height: 1.1; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .im-sub { color: var(--muted); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .im-bar { height: ${n(16)}; border-radius: 99px; background: var(--line); overflow: hidden; margin-top: ${n(8)}; }
  .im-bar i { display: block; height: 100%; border-radius: 99px; background: var(--primary); transform-origin: 0 50%; }
  .iso { perspective: ${n(1800)}; display: flex; align-items: center; justify-content: center; }
  .iso-scene { position: relative; transform-style: preserve-3d; }
  .iso-pl { position: absolute; inset: 0; border-radius: ${n(70)}; border: ${n(4)} solid color-mix(in srgb, var(--primary) 80%, white);
    background: color-mix(in srgb, var(--primary) 28%, transparent); box-shadow: 0 0 ${n(90)} color-mix(in srgb, var(--primary) 70%, transparent), inset 0 0 ${n(60)} color-mix(in srgb, var(--primary) 50%, transparent); }
  .iso-pl.b { inset: 9%; border-radius: ${n(50)}; }
  .iso-card { position: absolute; inset: 17% 14%; border-radius: ${n(40)}; transform-style: preserve-3d;
    background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 85%, white), var(--primary) 55%, color-mix(in srgb, var(--primary) 60%, black));
    box-shadow: 0 ${n(30)} ${n(70)} color-mix(in srgb, var(--primary) 55%, transparent); color: #fff; }
  .iso-face { position: absolute; inset: 0; padding: ${n(30)}; }
  .iso-face .mark { width: ${n(70)} !important; height: ${n(70)} !important; }
  .iso-dots { position: absolute; right: ${n(34)}; bottom: ${n(30)}; width: ${n(80)}; height: ${n(44)};
    background: radial-gradient(circle at 30% 50%, rgba(255,255,255,.9) 0 ${n(20)}, transparent ${n(21)}), radial-gradient(circle at 70% 50%, rgba(255,255,255,.55) 0 ${n(20)}, transparent ${n(21)}); }
  .iso-stat { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: ${n(20)}; gap: ${n(8)}; }
  .iso-num { font-weight: 800; line-height: 1; white-space: nowrap; letter-spacing: -0.03em; }
  .iso-lab { font-family: ${subStack}; font-weight: 600; opacity: .85; line-height: 1.2; }
  .tk { display: flex; align-items: flex-start; gap: ${n(26)}; }
  .tk-caret { display: flex; align-items: center; color: var(--primary); } .tk-caret svg { width: ${n(26)}; height: ${n(26)}; fill: currentColor; }
  .tk-vp { overflow: hidden; -webkit-mask: linear-gradient(#000 0%, #000 28%, transparent 100%); mask: linear-gradient(#000 0%, #000 28%, transparent 100%); }
  .tk-row { position: relative; display: flex; align-items: center; white-space: nowrap; font-weight: 600; font-family: ${subStack}; }
  .tk-off { color: var(--muted); } .tk-on { position: absolute; left: 0; color: var(--primary); text-shadow: 0 0 ${n(24)} color-mix(in srgb, var(--primary) 70%, transparent); }
  .coll { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
  .coll-t { position: absolute; left: 0; top: 0; border-radius: ${n(36)}; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow);
    background: var(--surface); border: ${n(2)} solid var(--line); color: var(--primary); }
  .coll-t.c1 { background: var(--primary); color: var(--on-primary); } .coll-t.c2 { background: color-mix(in srgb, var(--secondary) 22%, var(--surface)); color: var(--text); }
  .coll-t .ic { width: 46%; height: 46%; } .coll-t.photo img { width: 100%; height: 100%; object-fit: cover; }
  .coll-c { z-index: 15; padding: ${n(30)} ${n(44)}; border-radius: ${n(40)}; background: color-mix(in srgb, var(--bg) 82%, transparent); }
  .stk-wrap { perspective: ${n(1400)}; }
  .stk { display: flex; flex-direction: column; align-items: center; gap: ${n(14)}; transform-style: preserve-3d; }
  .stk-b { display: flex; align-items: center; justify-content: space-between; gap: ${n(30)}; min-width: ${n(620)}; padding: ${n(30)} ${n(50)}; border-radius: ${n(34)}; white-space: nowrap;
    background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 82%, white), var(--primary)); color: var(--on-primary); font-family: ${subStack}; font-weight: 700;
    box-shadow: 0 ${n(20)} ${n(50)} color-mix(in srgb, var(--primary) 40%, transparent); }
  .stk-b b { opacity: .85; }
  .chat { display: flex; flex-direction: column; gap: ${n(30)}; }
  .chat-area { display: flex; flex-direction: column; gap: ${n(18)}; min-height: ${n(420)}; justify-content: flex-end; }
  .bub { max-width: 82%; padding: ${n(22)} ${n(34)}; border-radius: ${n(40)}; font-family: ${subStack}; font-weight: 600; line-height: 1.25; }
  .bub.me { align-self: flex-end; background: var(--primary); color: var(--on-primary); border-bottom-right-radius: ${n(12)}; transform-origin: 100% 100%; }
  .bub.them { align-self: flex-start; background: var(--surface); border: ${n(2)} solid var(--line); color: var(--text); border-bottom-left-radius: ${n(12)}; transform-origin: 0 100%; box-shadow: var(--shadow); }
  .bub.dots { display: flex; gap: ${n(10)}; } .bub.dots i { width: ${n(16)}; height: ${n(16)}; border-radius: 50%; background: var(--muted); display: block; }
  .chat-bar { display: flex; align-items: center; gap: ${n(18)}; padding: ${n(14)}; border-radius: 999px; background: var(--surface); border: ${n(2)} solid var(--line); box-shadow: var(--shadow); }
  .chat-plus { flex: none; width: ${n(84)}; height: ${n(84)}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-style: normal; font-size: ${n(52)}; color: var(--primary);
    background: color-mix(in srgb, var(--primary) 12%, transparent); font-family: ${subStack}; }
  .chat-field { flex: 1; display: flex; align-items: center; white-space: nowrap; overflow: hidden; font-family: ${subStack}; font-weight: 600; color: var(--text); }
  .chat-caret { display: inline-block; width: ${n(4)}; height: 1.1em; background: var(--primary); margin-left: ${n(4)}; }
  .chat-send { flex: none; width: ${n(84)}; height: ${n(84)}; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; }
  .chat-send svg { width: 55%; height: 55%; fill: none; stroke: var(--on-primary); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
  .fx-swoosh { position: absolute; inset: 0; width: 100%; height: 100%; visibility: hidden; }
  .fx-swoosh path { fill: none; stroke: var(--primary); stroke-width: ${n(34)}; stroke-linecap: round; filter: drop-shadow(0 ${n(10)} ${n(24)} color-mix(in srgb, var(--primary) 45%, transparent)); }

  /* ---------- background ---------- */
  /* moving background layers get their own compositor layer: painted once, then only moved (2x faster renders) */
  .bg-glow, .bg-streak, .bg-beam, .bg-rays, .bg-grid, .bg-dots, .bg-halftone, .bg-kente, .bg-wave, .bg-marq, .bg-p, .bg-frame { will-change: transform, opacity; }
  .bg-base { position: absolute; inset: 0; background: ${lightBg
    ? 'radial-gradient(ellipse at 50% 35%, #ffffff 0%, var(--bg) 70%)'
    : 'radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--primary) 18%, var(--bg)) 0%, var(--bg) 70%)'}; }
  .bg-grid { position: absolute; inset: ${n(-200)}; background-image: linear-gradient(var(--line) ${n(2)}, transparent ${n(2)}), linear-gradient(90deg, var(--line) ${n(2)}, transparent ${n(2)}); background-size: ${n(90)} ${n(90)};
    -webkit-mask: radial-gradient(ellipse at 50% 50%, #000 20%, transparent 70%); mask: radial-gradient(ellipse at 50% 50%, #000 20%, transparent 70%); }
  .bg-dots { position: absolute; inset: ${n(-200)}; background-image: radial-gradient(var(--line) ${n(3)}, transparent ${n(3)}); background-size: ${n(60)} ${n(60)}; }
  .bg-glow { position: absolute; width: ${Math.round(W * 1.1)}px; height: ${Math.round(W * 1.1)}px; border-radius: 50%; left: ${Math.round(-W * 0.3)}px; top: ${Math.round(H * 0.05)}px;
    background: radial-gradient(circle, color-mix(in srgb, var(--primary) ${lightBg ? 22 : 38}%, transparent) 0%, transparent 65%); }
  .bg-glow.g2 { left: auto; right: ${Math.round(-W * 0.35)}px; top: auto; bottom: ${Math.round(H * 0.02)}px; background: radial-gradient(circle, color-mix(in srgb, var(--secondary) ${lightBg ? 22 : 30}%, transparent) 0%, transparent 65%); }
  .bg-streak { position: absolute; left: 0; top: 40%; width: ${Math.round(W * 0.9)}px; height: ${n(70)}; border-radius: 999px; filter: blur(${n(18)});
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--secondary) 75%, transparent), transparent); opacity: .55; }
  .bg-streak.s1 { top: 62%; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--primary) 80%, transparent), transparent); }
  .bg-streak.s2 { top: 22%; height: ${n(30)}; }
  .bg-beam { position: absolute; top: ${-Math.round(H * 0.2)}px; left: 50%; width: ${Math.round(W * 0.34)}px; height: ${Math.round(H * 1.5)}px; margin-left: ${-Math.round(W * 0.17)}px; transform-origin: 50% 0;
    background: linear-gradient(color-mix(in srgb, var(--primary) 40%, transparent), transparent 75%); opacity: .5; }
  .bg-rays { position: absolute; left: 50%; top: 45%; width: ${Math.round(Math.hypot(W, H) * 1.3)}px; height: ${Math.round(Math.hypot(W, H) * 1.3)}px;
    margin: ${-Math.round(Math.hypot(W, H) * 0.65)}px 0 0 ${-Math.round(Math.hypot(W, H) * 0.65)}px; border-radius: 50%;
    background: repeating-conic-gradient(color-mix(in srgb, var(--secondary) ${lightBg ? 20 : 12}%, transparent) 0 7deg, transparent 7deg 18deg);
    -webkit-mask: radial-gradient(circle, #000 0%, transparent 62%); mask: radial-gradient(circle, #000 0%, transparent 62%); }
  .bg-halftone { position: absolute; inset: ${n(-120)}; background-image: radial-gradient(color-mix(in srgb, var(--primary) 55%, transparent) 30%, transparent 32%); background-size: ${n(46)} ${n(46)};
    -webkit-mask: radial-gradient(circle at 85% 12%, #000, transparent 50%), radial-gradient(circle at 12% 90%, #000, transparent 45%); mask: radial-gradient(circle at 85% 12%, #000, transparent 50%), radial-gradient(circle at 12% 90%, #000, transparent 45%); }
  .bg-kente { position: absolute; left: ${-W}px; width: ${W * 3}px; height: ${n(90)};
    background: repeating-linear-gradient(90deg, var(--primary) 0 60px, var(--bg) 60px 72px, var(--secondary) 72px 120px, var(--bg) 120px 132px, #0B8A3D 132px 180px, var(--bg) 180px 192px); opacity: .9; }
  .bg-kente.k1 { top: 0; } .bg-kente.k2 { bottom: 0; }
  .bg-wave { position: absolute; left: 0; bottom: 0; width: ${W * 2}px; height: ${Math.round(H * 0.18)}px; background: color-mix(in srgb, var(--primary) 20%, transparent);
    -webkit-mask: radial-gradient(70px 44px at 70px 0, transparent 98%, #000) 0 0 / 140px 100% repeat-x; mask: radial-gradient(70px 44px at 70px 0, transparent 98%, #000) 0 0 / 140px 100% repeat-x; }
  .bg-wave.w2 { height: ${Math.round(H * 0.11)}px; background: color-mix(in srgb, var(--primary) 34%, transparent); }
  .bg-marq { position: absolute; left: 0; white-space: nowrap; font-weight: ${theme.headWeight}; font-size: ${Math.round(side * 0.3)}px; line-height: 1; color: transparent;
    -webkit-text-stroke: ${n(3)} color-mix(in srgb, var(--text) 12%, transparent); ${theme.upper ? '' : 'text-transform: uppercase;'} }
  .bg-marq.m0 { top: 6%; } .bg-marq.m1 { bottom: 6%; }
  .bg-p { position: absolute; display: block; }
  .bg-p.pt { border-radius: 50%; background: var(--primary); opacity: .35; } .bg-p.pt.c1 { background: var(--secondary); } .bg-p.pt.c2 { background: var(--text); opacity: .18; }
  .bg-p.cf { border-radius: 4px; background: var(--primary); } .bg-p.cf.c1 { background: var(--secondary); } .bg-p.cf.c2 { background: #fff; }
  .bg-p.sk { background: var(--secondary); opacity: 0; clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%); }
  .bg-p.bb { border-radius: 50%; background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.75), color-mix(in srgb, var(--primary) 35%, transparent) 60%); opacity: .5; }
  .bg-p.bb.c1 { background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.75), color-mix(in srgb, var(--secondary) 35%, transparent) 60%); }
  .bg-scan { position: absolute; inset: 0; background: repeating-linear-gradient(rgba(0,0,0,.18) 0 2px, transparent 2px 6px); }
  .bg-frame { position: absolute; inset: ${n(34)}; border: ${n(3)} solid color-mix(in srgb, var(--primary) 70%, transparent); border-radius: ${n(40)}; }
  .bg-vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 50%, transparent 55%, ${lightBg ? 'rgba(0,0,0,.06)' : 'rgba(0,0,0,.45)'} 100%); }

  /* ---------- captions ---------- */
  .cap { position: absolute; z-index: 60; left: ${Math.round(side * 0.07)}px; right: ${Math.round(side * 0.07)}px; bottom: ${Math.round(H * 0.06)}px; display: flex; justify-content: center; opacity: 0; visibility: hidden; }
  .cap span { background: rgba(10,8,20,.8); color: #fff; font-family: 'Poppins','DejaVu Sans',Arial,sans-serif; font-weight: 700; font-size: ${Math.round(side * 0.042)}px; line-height: 1.25;
    padding: ${n(16)} ${n(30)}; border-radius: ${n(22)}; text-align: center; }
  .ic { display: block; }
${theme.css ? theme.css() : ''}`;
}
const WIDE = (W, H) => W > H;
// The look a video gets when nobody chose one: matched to the style (light calm -> Apple, dark calm -> glow, loud -> kinetic).
function defaultLook(theme, c) {
  const light = luminance(c.background) > 0.45;
  if (theme.calm) return light ? { halo: 1, finish: 0.4, leaks: 0, chroma: 0, textIn: 'focus' } : { glow: 1, finish: 0.8, leaks: 0, chroma: 0, textIn: 'focus' };
  if (theme.energy >= 3) return { finish: 0.8, chroma: 0.8, leaks: 0, textIn: 'chars' };
  return light ? { finish: 0.5, leaks: 0, chroma: 0, halo: 1, textIn: 'focus' } : { finish: 0.9, leaks: 0.8, chroma: 0, textIn: 'focus' };
}

/** Build a complete Animora HTML document from a plan. */
export function templateFromPlan(plan, { themeKey = 'bold', assets = plan.assets || [], beats: directed = null, look = null, salt = '' } = {}) {
  const key = themeKey in THEMES ? themeKey : 'bold';
  const theme = THEMES[key];
  const { width: W, height: H } = CANVAS[plan.aspect_ratio] || CANVAS['9:16'];
  const duration = Number(plan.duration_seconds) || 30;
  const c = { ...theme.colors, ...(plan.style?.colors || {}) };
  const seed = (hashStr(`${key}|${plan.title || ''}|${duration}|${salt}`) % 2147483646) + 1;
  const rnd = prng(seed);
  const scenes = buildScenes(plan, assets);
  const images = (assets || []).filter((a) => (a.kind || 'image') === 'image');
  const logoAsset = scenes.find((s) => s.logo)?.logo || images.find((a) => a.role === 'logo' || /logo/i.test(a.name || '')) || null;
  const brandScene = scenes.find((s, i) => i > 0 && s.kind === 'text' && (i === 1 || /brand|intro/.test(s.purpose)));
  const brand = plan.business?.name || brandScene?.head || plan.title?.split(/[-–|]/)[0]?.trim() || 'Animora';
  const menu = scenes.filter((s) => s.kind === 'list').flatMap((s) => s.rows.map((r) => ({ name: r.name, price: r.price })));
  const photos = scenes.map((s) => s.photo?.url).filter(Boolean);
  const beats = directed?.length ? directed : planBeats(plan, scenes, theme, rnd, { brand, logo: logoAsset, menu, seed, photos });
  // sound: 'all' = soft music + effects, 'sfx' = effects only, 'own' = the user's music + effects, 'none' = silent
  const sound = plan.sound || (plan.sfx === false ? 'none' : 'sfx');
  const mood = MUSIC[look?.music] ? look.music : MUSIC[plan.music_mood] ? plan.music_mood : MUSIC_FOR_THEME[key] || 'calm';
  // built-in background songs are off (people preferred effects only); only the owner's own music is used
  const music = sound === 'own' && plan.music_url ? { url: plan.music_url } : null;
  const paced = premiumize(fillPacing(beats, duration, plan, theme, rnd));
  const tempo = music?.bpm || Number(look?.tempo) || ({ 1: 96, 2: 112, 3: 124 }[look?.energy || theme.energy] || 112);
  let finalBeats = directed?.length ? snapToBeat(paced, tempo, duration) : paced;
  // "zoom into the logo" in the special instructions (no AI director): open on the logo and dive into it
  if (!directed?.length && logoAsset && /logo/i.test(plan.special_instructions || '') && /(zoom|dive|fly|start|open|first|begin)/i.test(plan.special_instructions || '')) {
    finalBeats[0] = { ...finalBeats[0], shot: 'logo', text: brand, sub: '', hasLogo: true, cut: { type: 'dive', d: 0.42 } };
  }

  const withCaps = !!(plan.voiceover?.enabled && plan.voiceover?.captions !== false && scenes.some((s) => s.caption));
  const captions = [];
  if (withCaps) {
    scenes.forEach((s, i) => {
      const chunks = s.caption ? captionChunks(s.caption) : [];
      const len = s.end - s.start, slot = (len - 0.3) / Math.max(1, chunks.length);
      chunks.forEach((text, k) => captions.push({ text, t0: Math.round((s.start + 0.15 + k * slot) * 100) / 100, t1: Math.round((s.start + 0.15 + (k + 1) * slot) * 100) / 100, last: i === scenes.length - 1 && k === chunks.length - 1 }));
    });
  }

  const data = {
    W, H, duration, seed, brand,
    logo: logoAsset ? { url: logoAsset.url, transparent: !!(logoAsset.transparent ?? logoAsset.has_alpha), light: logoAsset.light ?? logoAsset.is_light ?? null, ratio: logoAsset.width && logoAsset.height ? Math.round((logoAsset.width / logoAsset.height) * 100) / 100 : null } : null,
    theme: { key, energy: theme.energy, accentStyle: theme.accentStyle, textIn: theme.textIn, textScale: theme.textScale || 1, drift: theme.drift || 0, calm: !!theme.calm, ...defaultLook(theme, c), ...(look || {}), ambient: cleanAmbient((look && look.ambient) || theme.ambient), ...(sound === 'none' ? { sound: 'off' } : {}) },
    music,
    beats: finalBeats.map((b) => { const o = { ...b }; delete o.scene; return o; }),
    captions,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="adflash" content="width=${W},height=${H},duration=${duration},fps=30,engine=motion-v4">
<title>${esc(plan.title || 'Animora video')}</title>
<link href="https://fonts.googleapis.com/css2?family=${theme.fontParam}&display=block" rel="stylesheet">
<style>${css(theme, c, W, H)}
</style>
</head>
<body>
<div id="stage"></div>
<script src="${GSAP_CDN}/gsap.min.js"></script>
<script>
  const DURATION = ${duration};
  const SPEED = 1;               // edit: >1 = faster animations, <1 = slower
  window.ADFLASH_DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};
</script>
<script>
${RUNTIME}
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Offline edits by plain words (works on template-generated code)
// ---------------------------------------------------------------------------
const COLOR_WORDS = {
  red: '#D7263D', green: '#1F8A4C', blue: '#1F6FEB', 'light blue': '#4FB3FF', 'dark blue': '#0B2E6B', navy: '#0B2E6B',
  yellow: '#FFC93C', gold: '#C9A227', orange: '#E8530E', purple: '#7B2CBF', pink: '#E83E8C', black: '#0B0B0B',
  white: '#FFFFFF', teal: '#0FA3A3', brown: '#7A4A21', grey: '#6B7280', gray: '#6B7280', cream: '#FFF6E9', maroon: '#7A1F2B',
};

export function offlineEdit(html, instruction) {
  const say = instruction.toLowerCase();
  const changes = [];
  let out = html;
  const setVar = (name, value) => {
    const re = new RegExp(`(--${name}:\\s*)([^;]+)(;)`);
    if (re.test(out)) { out = out.replace(re, `$1${value}$3`); return true; }
    return false;
  };
  const getVar = (name) => (out.match(new RegExp(`--${name}:\\s*([^;]+);`)) || [])[1];

  const bigger = /(bigger|larger|increase|enlarge)/.test(say), smaller = /(smaller|reduce|decrease|tiny)/.test(say);
  if ((bigger || smaller) && /(text|font|word|writing|title|headline|everything|it\b|size)/.test(say)) {
    const cur = Number(getVar('scale') || 1);
    const next = Math.round(cur * (bigger ? 1.3 : 0.8) * 100) / 100;
    if (setVar('scale', String(next))) changes.push(`text size ${Math.round(next * 100)}%`);
  }

  const words = Object.keys(COLOR_WORDS).sort((a, b) => b.length - a.length);
  const hex = say.match(/#[0-9a-f]{6}\b/i)?.[0];
  const color = hex || COLOR_WORDS[words.find((w) => new RegExp(`\\b${w}\\b`).test(say))];
  if (color) {
    const target = /background|bg/.test(say) ? 'bg' : /(text|font|writing|words?)\b/.test(say) && !/(bigger|smaller)/.test(say) ? 'text'
      : /(button|price|accent|second)/.test(say) ? 'secondary' : 'primary';
    if (setVar(target, color)) changes.push(`${target === 'bg' ? 'background' : target} colour ${color}`);
  }

  const faster = /(faster|quicker|speed up)/.test(say), slower = /(slower|slow down)/.test(say);
  if (faster || slower) {
    const m = out.match(/const SPEED = ([\d.]+);/);
    if (m) {
      const next = Math.round(Number(m[1]) * (faster ? 1.4 : 0.7) * 100) / 100;
      out = out.replace(m[0], `const SPEED = ${next};`);
      changes.push(`animations ${faster ? 'faster' : 'slower'}`);
    }
  }
  return { html: out, changes };
}
