// Animora Motion: the rule-based director. Turns a business's (cleaned) details into a storyboard of beats.
// Story shape, like the best product ads: a hook, the brand, the proof (photos, products, prices, strengths),
// where to find it, a real call to action, and a logo end card. What the owner never said is never invented:
// no ratings, no customer counts, no delivery times unless they gave them.
import { factsFrom, cleanText, fixPrices, glyphFor } from '../cinema/compose.js';

const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483646 + 1; };
const OK = /^#[0-9a-f]{6}$/i;
const hex = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lum = (h) => { const c = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const sat = (h) => { const c = hex(h); return (Math.max(...c) - Math.min(...c)) / 255; };

export const MOTION_TYPES = ['words', 'icon', 'notif', 'stack', 'toggles', 'swap', 'search', 'map', 'receipt', 'price', 'photos', 'ring', 'highlight', 'phone', 'button', 'end', 'steps', 'grid', 'stat', 'quote', 'orbit', 'countdown', 'calendar', 'chat'];
// seconds a beat needs to read well (the composer and the AI sanitiser both use these)
export const BEAT_MIN = { words: 1.8, icon: 2.4, notif: 2.4, stack: 2.8, toggles: 2.8, swap: 2.6, search: 3.4, map: 3.2, receipt: 3.4, price: 2.4, photos: 2.8, ring: 2.6, highlight: 2.6, phone: 3.0, button: 2.8, end: 3.0, steps: 3.4, grid: 2.8, stat: 2.6, quote: 3.0, orbit: 2.8, countdown: 2.8, calendar: 2.8, chat: 4.0 };
export const BEAT_MAX = { words: 3.4, icon: 3.4, notif: 4, stack: 4.4, toggles: 4.4, swap: 4.2, search: 4.6, map: 4.4, receipt: 5, price: 3.6, photos: 4.4, ring: 3.6, highlight: 3.6, phone: 4.2, button: 3.8, end: 4.2, steps: 5, grid: 4, stat: 3.6, quote: 4.2, orbit: 4, countdown: 3.6, calendar: 4, chat: 6 };

// what the owner can ask for in the form -> beat types (old Cinema ids still work)
export const MOTION_WANTS = {
  typing: ['search'], chat: ['chat'], notifs: ['notif'], phone: ['phone'], prices: ['receipt', 'stack'], menu: ['stack'], offer: ['price'], price: ['price'],
  countdown: ['countdown'], event: ['calendar'], numbers: ['stat'], timer: ['ring'], reel: ['photos'], photos: ['photos'], grid: ['grid'], location: ['map'], map: ['map'],
  steps: ['steps'], checklist: ['toggles'], swap: ['swap'], orbit: ['orbit'], highlight: ['highlight'], bigtype: ['words'], glow: ['words'], button: ['button'],
  ring3d: ['grid', 'orbit'], beforeafter: ['highlight'], liquid: ['words'], cards: ['stack'], compare: ['toggles'],
};

export const FONTS = ['Inter', 'Plus Jakarta Sans', 'Manrope', 'DM Sans', 'Outfit', 'Sora'];
const FOOD = /\b(food|cakes?|bak\w*|restaurants?|kitchen|chops?|eatery|eats?|cafe|coffee|pizza|grill\w*|suya|catering|drinks?|juice|snacks?|meals?|pastr\w*|shawarma|burgers?|jollof|rice|soup|chicken|bread|smoothie|parfait)\b/i;
const TECH = /\b(apps?|software|tech\w*|saas|ai|platform|digital|website|web|online|startup|data|cloud|bank\w*|fintech|pay|payments?|wallet|loans?|invest\w*|crypto|insur\w*|transfers?|laptops?|phones?|gadgets?|computers?)\b/i;
const BEAUTY = /\b(beauty|salon|hair\w*|makeup|spa|nails?|skin\w*|barber\w*|lash\w*|brows?|braids?|wigs?|glow)\b/i;
const FASHION = /\b(fashion|cloth\w*|wears?|tailor\w*|boutique|jewel\w*|luxur\w*|shoes?|bags?|perfumes?|fabrics?|ankara|aso.?ebi|sneakers?)\b/i;
const SERVICE = /\b(dealers?|dealership|autos?|cars?|sales|store|shop|boutique|supermarket|mart|repairs?|clinic|school|gym|laundry|garage|pharmacy|hospital|dental|lawyers?|consult\w*|agency|cleaning|logistics?|delivery|printing|photograph\w*|studio|hotel|church|training|class(es)?|tutor\w*|mechanic|plumb\w*|salon)\b/i;
const EVENT = /\b(events?|party|concert|show|launch\w*|grand opening|opening|wedding|conference|festival|summit|hangout|announce an event|launch something new)\b/i;
// the form's generic category chips: a more specific description (from the plan) reads better on screen
const GENERIC_CATS = /^(food & drinks|fashion & clothing|beauty & salon|tech & software|finance & payments|health & fitness|real estate|events & parties|school & training|shop|other)/i;

// "N12.5m" -> "₦12,500,000", "5k" -> "₦5,000" (before the usual price clean-up, which knows k but not m or decimals)
const money = (s) => String(s || '').replace(/(₦|\bNGN\s?|\bN(?=\s?\d))?\s?(\d+(?:\.\d+)?)\s?(m|mil|million|k)\b/gi, (all, cur, n, u) => {
  const v = Number(n) * (/^k/i.test(u) ? 1e3 : 1e6);
  return !cur && /^k/i.test(u) && !/\./.test(n) ? all : `₦${Math.round(v).toLocaleString('en-US')}`;
});
// wEiRd cAsE and Shouting -> normal sentence case (brand names are handled separately)
const normCase = (t) => {
  const s0 = String(t || '');
  const ws = s0.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  const weird = ws.filter((w) => /[a-z][A-Z]/.test(w) && !/^(i[A-Z]|Mc|Mac)/.test(w)).length;
  const letters = s0.replace(/[^A-Za-z]/g, ''); const caps = letters.replace(/[^A-Z]/g, '').length / Math.max(1, letters.length);
  if (weird >= 1 && (weird >= 2 || ws.length <= 3) || caps > 0.6) return s0.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase());
  return s0;
};
// cut at a word boundary, never mid-word
const smartClip = (t, n) => { const s0 = String(t || '').trim(); if (s0.length <= n) return s0; const cut = s0.slice(0, n + 1).replace(/\s+\S*$/, ''); return (cut.length >= n * 0.5 ? cut : s0.slice(0, n)).replace(/[\s,;:–-]+$/, ''); };
const sentence = (s, n = 60) => smartClip(cleanText(fixPrices(money(normCase(s))), 400), n).replace(/!{2,}/g, '!');
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
const priceOf = (s) => (String(s).match(/₦\s?[\d,]+(?:\.\d+)?|\$\s?[\d,]+(?:\.\d+)?|£\s?[\d,]+|€\s?[\d,]+/) || [''])[0].replace(/\s/g, '');
const nameOf = (s) => cleanText(String(s).replace(/\b\d+(?:\.\d+)?\s?(m|mil|million)\b/gi, '').replace(/[-–:|(@]?\s*(?:₦|\$|£|€)\s?[\d,]+(?:\.\d+)?\)?/g, '').replace(/\b(only|at|for)\s*$/i, '').replace(/[-–:|,]\s*$/, ''), 30);
// accent the word that matters: the last meaningful word of the line
const shortLabel = (t) => (String(t).length <= 18 ? t : '');
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'with', 'at', 'is', 'are', 'your', 'our', 'you', 'we', 'it', 'by', 'from', 'us']);
const accentOf = (line, offset = 0) => { const w = words(line); for (let i = w.length - 1; i >= 0; i--) if (!STOP.has(w[i].toLowerCase().replace(/[^a-z]/g, ''))) return [offset + i]; return [offset + w.length - 1]; };
// split a line into two balanced lines when it is long
const balance = (t, max) => { const w = words(t); if (t.length <= max || w.length < 4) return [t]; let best = 1, diff = 1e9; for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (d < diff) { diff = d; best = i; } } return [w.slice(0, best).join(' '), w.slice(best).join(' ')]; };

/** Numbers the owner actually gave, e.g. "2,000+ happy customers", "delivered in 30 minutes", "24/7". */
function numbersIn(texts) {
  const stats = [], times = [];
  for (const t of texts) {
    const s = String(t);
    let m = s.match(/(\d[\d,.]*\s?(?:k|m)?\+?)\s+(happy\s+)?(customers|clients|students|users|orders|members|patients|homes|cars|projects|downloads|reviews|followers|years?)/i);
    if (m) stats.push({ value: m[1].replace(/\s/g, '').toUpperCase().replace(/K$/, 'K').replace(/M$/, 'M'), label: cleanText(((m[2] || '') + m[3]).trim(), 24), src: s });
    m = s.match(/(?:in|under|within)\s+(\d{1,3})\s*(min(?:ute)?s?|hours?|hrs?|days?)/i);
    if (m) { const unit = /^min/i.test(m[2]) ? 'min' : /^h/i.test(m[2]) ? 'h' : 'd'; times.push({ value: m[1] + (unit === 'min' ? '' : unit), unitWord: unit === 'min' ? 'minutes' : unit === 'h' ? 'hours' : 'days', n: +m[1], src: s }); }
    if (/24\s*\/\s*7|24 hours/i.test(s) && !times.length) times.push({ value: '24/7', unitWord: '', n: 24, src: s, always: true });
  }
  return { stats, times };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseWhen(s) {
  const t = String(s || '');
  const m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i) || t.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})/i);
  if (!m) return null;
  const day = /\d/.test(m[1]) ? m[1] : m[2], mon = /\d/.test(m[1]) ? m[2] : m[1];
  const time = (t.match(/\b(\d{1,2}(?::\d{2})?\s?(?:am|pm))\b/i) || [])[1] || '';
  const rest = t.replace(m[0], '').replace(time, '').replace(/^[\s,·|-]+|[\s,·|-]+$/g, '').replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b,?/i, '').trim();
  return { day, month: MONTHS[MONTHS.indexOf(mon.toLowerCase().slice(0, 3))], time: time.replace(/\s/g, '').toLowerCase(), place: cleanText(rest.replace(/^[,\s-]+/, ''), 40) };
}

/** Brand colour for the film: their primary if it is a real colour, otherwise a strong one that suits the trade. */
export function accentFor(colors = {}, text = '') {
  const cands = [colors.primary, colors.secondary, colors.text].filter((c) => OK.test(c || ''));
  const good = cands.find((c) => sat(c) > 0.22 && lum(c) > 0.03 && lum(c) < 0.85);
  if (good) return good;
  if (FOOD.test(text)) return '#E8530E';
  if (BEAUTY.test(text)) return '#C2185B';
  if (TECH.test(text)) return '#2F6BFF';
  if (FASHION.test(text)) return '#8B5E34';
  return '#3D5AFE';
}

/**
 * The storyboard. Returns { beats, font, accent, accent2 }.
 * opts: { brief, assets, salt, avoid: [types used last time], duration }
 */
export function composeMotion(plan, { brief = {}, assets = [], salt = '', avoid = [], colors = {}, look = null } = {}) {
  const f = factsFrom(plan, brief || {}, assets);
  f.brand = brandCase(smartClip(cleanText(brief.name || plan.business?.name || f.brand, 80, { keepCase: true }), 48) || f.brand);
  const specific = cleanText(plan.business?.category || '', 40);
  f.cat = f.cat && GENERIC_CATS.test(f.cat) && specific && !GENERIC_CATS.test(specific) ? specific : f.cat;
  const seed = hash(`${f.brand}|${f.cat}|${salt}`);
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const chance = (p) => rnd() < p;
  const text = `${f.text} ${f.features.join(' ')} ${f.headlines.join(' ')}`;
  const food = FOOD.test(text), tech = TECH.test(text), beauty = BEAUTY.test(text), fashion = FASHION.test(text), service = SERVICE.test(text), event = EVENT.test(`${brief.goal || ''} ${brief.flyerType || ''} ${(brief.headlines || []).join(' ')}`);
  const duration = Math.max(10, Math.round(Number(plan.duration_seconds) || 24));
  const avoidSet = new Set(avoid || []);
  const catLabel = f.cat && !GENERIC_CATS.test(f.cat) ? f.cat : '';   // only a real description goes on screen

  // ---- the facts, cleaned ----
  const heads = f.headlines.map((h) => sentence(h, 56)).filter(Boolean);
  const feats = f.features.map((x) => sentence(x, 34)).filter(Boolean);
  const rawProds = [].concat(brief.products || []).length ? [].concat(brief.products).flatMap((p) => String(p).split(/\n/)).map((p) => fixPrices(money(normCase(p)))).filter((p) => p.trim()).slice(0, 8) : f.products.map((p) => fixPrices(money(p)));
  const foreign = rawProds.some((p) => /[$£€]/.test(p));
  const prods = rawProds.map((p) => {
    let price = priceOf(p), name = nameOf(p);
    const bare = !price && !foreign && String(p).match(/^(.*?)[\s,:-]+(\d{2,3}(?:,\d{3})+|\d{2,7})\s*$/);
    if (bare && Number(bare[2].replace(/,/g, '')) >= 50) { price = '₦' + Number(bare[2].replace(/,/g, '')).toLocaleString('en-US'); name = cleanText(bare[1], 30); }
    return { name, price };
  }).filter((p) => p.name);
  const priced = prods.filter((p) => p.price);
  const offer = sentence(brief.offer || '', 24);
  const when = parseWhen(brief.when || '') || parseWhen(heads.join(' '));
  const photos = (f.photos || []).map((a) => a.url).filter(Boolean);
  const contact = cleanText(brief.contact || plan.business?.phone || f.phone || '', 160, { keepCase: true });
  const handle = (contact.match(/@[\w.]{2,30}/) || [])[0] || '';
  const site = (contact.match(/\b[\w-]+\.(?:com|ng|co|io|app|store|shop|net|org)(?:\/\S*)?/i) || [])[0] || '';
  const phone = (contact.match(/\+?\d[\d\s-]{7,}\d/) || [])[0] || '';
  const address = f.address || (contact.replace(phone, '').replace(handle, '').replace(site, '').replace(/^[\s,·|-]+|[\s,·|-]+$/g, '').length > 8 ? cleanText(contact.replace(phone, '').replace(handle, '').replace(site, '').replace(/^[\s,·|-]+|[\s,·|-]+$/g, ''), 60) : '');
  const city = (address.split(/,\s*/).slice(-1)[0] || '').trim();
  const nums = numbersIn([...feats, ...heads, f.goal || '']);
  const cta = sentence((brief.ctas && brief.ctas[0]) || brief.cta || f.cta || '', 60).replace(/\+?\d[\d\s-]{6,}\d/g, '').replace(/@[\w.]+|\b[\w-]+\.(com|ng|co|io|app)\S*/gi, '').replace(/\s+(on|at|via|:)?\s*$/i, '').trim().slice(0, 26) || 'Order now';
  const ctaGlyph = /whatsapp|chat|message|dm/i.test(cta) ? 'chat' : /call|phone/i.test(cta) ? 'phone' : /book|reserve/i.test(cta) ? 'clock' : /visit|store|shop/i.test(cta) ? 'pin' : /download|app/i.test(cta) ? 'phone' : 'bag';
  const doneWord = /book|reserve/i.test(cta) ? 'Booked' : /call/i.test(cta) ? 'Calling…' : /download/i.test(cta) ? 'Installed' : /visit|website/i.test(cta) ? 'Opening…' : /whatsapp|message|dm|chat/i.test(cta) ? 'Sent' : 'Done';
  const H0 = heads[0] || sentence(f.goal, 40) || `Meet ${f.brand}`;
  const tagline = sentence(heads.find((h) => h.length <= 34 && h !== H0) || (f.cat ? `${f.cat}${city ? `, ${city}` : ''}` : ''), 40);

  // ---- the look: mostly light (Apple-clean) or mostly dark (premium night) ----
  const darkPref = tech || beauty ? 0.55 : fashion ? 0.5 : 0.3;
  const theme = look?.theme || (chance(darkPref) ? 'dark' : 'light');   // a chosen style decides the stage
  const base = theme, contrast = theme === 'light' ? 'dark' : 'light';
  const font = look?.ui || pick(tech ? ['Inter', 'Sora', 'Manrope', 'Plus Jakarta Sans'] : beauty || fashion ? ['DM Sans', 'Outfit', 'Plus Jakarta Sans', 'Manrope'] : food ? ['Plus Jakarta Sans', 'Outfit', 'Inter', 'DM Sans'] : FONTS);

  // ---- beats (each builder returns a beat or null when the facts can't support it) ----
  const B = {};
  const used = new Set();   // lines already on screen: never say the same thing twice
  const key = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9₦]/g, '');
  const fresh = (...ts) => ts.filter(Boolean).every((t) => !used.has(key(t)));
  B.hookBuild = () => { const ls = balance(H0, 22); const acc = accentOf(ls[ls.length - 1], ls.length > 1 ? words(ls[0]).length : 0); return { type: 'words', bg: base, lines: ls, accent: acc }; };
  B.hookGlow = () => ({ type: 'words', mode: 'glow', bg: 'dark', lines: balance(H0, 20), accent: [] });
  B.hookSlam = () => (words(H0).length <= 5 ? { type: 'words', mode: 'slam', bg: pick(['dark', base]), lines: [H0.replace(/[.!]+$/, '')], accent: [words(H0).length - 1] } : null);
  B.countdown = () => (event ? { type: 'countdown', bg: 'dark', reveal: /open/i.test(text) ? 'Now open' : /launch|new/i.test(`${brief.goal || ''} ${text}`) ? 'It\'s here' : /party|concert|show|night|festival|event/i.test(text) ? 'It\'s on' : 'Today', sub: f.brand } : null);
  B.brand = () => {
    const mode = f.brand.length > 18 ? 'wordmark' : pick(['welcome', 'wordmark', 'wordmark']);
    return mode === 'welcome' ? { type: 'icon', bg: base, mode: 'welcome', prefix: pick(['Welcome to', 'Meet', 'Say hello to']) } : { type: 'icon', bg: base, mode: 'wordmark', tagline: catLabel ? sentence(catLabel, 30) : '' };
  };
  B.phone = () => (tech || /app|download/i.test(cta) ? { type: 'phone', bg: base, text: heads[1] || H0 } : null);
  B.photos = () => (photos.length ? { type: 'photos', bg: base, urls: photos.slice(0, 5), lines: [prods[0]?.name || heads[1] || H0], accent: accentOf(prods[0]?.name || heads[1] || H0) } : null);
  B.grid = () => (photos.length >= 4 ? { type: 'grid', bg: base, urls: photos.slice(0, 9), text: heads[2] || heads[1] || (f.cat ? sentence(f.cat, 28) : '') } : null);
  B.price = () => {
    const p = offer && /\d/.test(offer) ? offer : priced[0]?.price;
    if (!p) return null;
    const hero = priced[0];   // the owner's first item is the one they lead with
    const amount = Number(String(offer && /\d/.test(offer) ? offer : hero?.price || '').replace(/[^\d.]/g, '')) || 0;
    const label = event ? 'Tickets' : offer && /%|off/i.test(offer) ? 'Now' : amount && amount < 20000 ? 'Only' : '';
    return { type: 'price', bg: 'brand', label, value: (offer && /\d/.test(offer) ? offer : hero.price).replace(/\s/g, ''), sub: event ? '' : offer && /%|off/i.test(offer) ? (hero?.name ? `on ${hero.name.toLowerCase()}` : '') : (hero?.name || '') };
  };
  B.receipt = () => (priced.length >= 2 && (food || fashion || chance(0.5)) ? (() => {
    const items = priced.slice(0, 4).map((p) => ({ name: p.name, price: p.price }));
    const naira = items.every((x) => /^₦/.test(x.price));
    const total = naira ? '₦' + items.reduce((a, x) => a + Number(x.price.replace(/[^\d.]/g, '')), 0).toLocaleString('en-US') : '';
    return { type: 'receipt', bg: 'light', title: food ? 'Your order' : 'Your cart', items, total, button: cta };
  })() : null);
  B.menu = () => (prods.length >= 2 ? { _menu: true, type: 'stack', bg: base, title: food ? pick(['On the menu', 'Today\'s menu', 'Fresh today']) : pick(['What we offer', 'Our picks', 'Take your pick']), items: prods.slice(0, 4).map((p, i) => ({ t: p.name, s: p.price || '', glyph: prodGlyph(p.name, food, i) })) } : null);
  B.features = () => {
    if (feats.length < 2) return null;
    const kind = pick(['toggles', 'stack', 'swap', 'orbit'].filter((k) => !avoidSet.has(k) && !(k === 'swap' && feats.some((x) => x.length > 22)) && !(k === 'orbit' && (feats.length < 3 || feats.some((x) => !shortLabel(x))))));
    const title = pick(['Why people choose us', `Why ${f.brand.split(' ')[0]}`, 'What you get', 'Made for you']);
    if (kind === 'toggles') return { type: 'toggles', bg: base, title, items: feats.slice(0, 4) };
    if (kind === 'swap') return { type: 'swap', bg: base, lead: title, items: feats.slice(0, 4) };
    if (kind === 'orbit') return { type: 'orbit', bg: base, items: feats.slice(0, 6).map((t) => ({ t: shortLabel(t), glyph: glyphFor(t, 'star') })) };
    return { type: 'stack', bg: base, title, items: feats.slice(0, 4).map((t) => ({ t, glyph: glyphFor(t, 'check') })) };
  };
  B.heads = () => heads.slice(1, 3).map((h, i) => {
    if (words(h).length >= 4 && i === 1 && !avoidSet.has('highlight')) { const w = words(h); const a = accentOf(h)[0]; return { type: 'highlight', bg: base, text: h, hot: a > 0 ? [a - 1, a] : [a] }; }
    if (chance(0.35)) return { type: 'words', mode: 'glow', bg: 'dark', lines: balance(h, 20) };
    const ls = balance(h, 22); return { type: 'words', bg: base, lines: ls, accent: accentOf(ls[ls.length - 1], ls.length > 1 ? words(ls[0]).length : 0) };
  });
  B.stat = () => (nums.stats[0] ? { _src: nums.stats[0].src, _num: nums.stats[0].value.replace(/\D/g, ''), type: 'stat', bg: base, value: nums.stats[0].value, label: titleish(nums.stats[0].label), lead: pick(['And counting', 'Trusted by many', '']) || undefined, accent: [1] } : null);
  B.ring = () => (nums.times[0] && !nums.times[0].always ? { _src: nums.times[0].src, _num: String(nums.times[0].n), type: 'ring', bg: base, value: nums.times[0].value, label: `Under ${nums.times[0].n} ${nums.times[0].unitWord}`.replace(/\s+$/, ''), sub: '', fill: 0.82 } : null);
  B.search = () => ((service || food || beauty || fashion) && (catLabel || city) ? { type: 'search', bg: 'light', lead: pick(['So you search…', 'Looking for the best?', 'Next time you search…']), query: `${(catLabel || f.brand).toLowerCase()}${city ? ` in ${city.toLowerCase()}` : ' near me'}`.slice(0, 34), title: f.brand, sub: [catLabel, city].filter(Boolean).join(' · '), button: /call/i.test(cta) ? 'Call' : /book/i.test(cta) ? 'Book' : 'Open' } : null);
  B.notif = () => ((food || service || fashion || tech) && (feats[0] || heads[1]) ? { type: 'notif', bg: base, items: [{ body: sentence(heads[1] || feats[0], 70) }, ...(feats[1] ? [{ body: sentence(feats[1], 70), time: '1m ago' }] : [])].slice(0, 2), lead: chance(0.5) ? sentence(f.cat || '', 24) || undefined : undefined } : null);
  B.map = () => (address ? { type: 'map', bg: 'light', label: pick(['Find us', 'Visit us', 'Come through']), address: cleanText(address.split(/,\s*/)[0], 32), sub: address.split(/,\s*/).slice(1).join(', ') || city, area: address.split(/,\s*/)[0].replace(/^\d+\s*/, '').split(' ').slice(0, 2).join(' '), area2: city } : null);
  B.calendar = () => (when ? { type: 'calendar', bg: base, lead: pick(['Save the date', 'Mark your calendar', 'See you there']), accent: [2], month: when.month, day: when.day, title: heads[0] && heads[0].length < 28 ? heads[0] : f.brand, time: when.time, place: when.place || cleanText(address, 36) } : null);
  B.chat = () => ({ type: 'chat', bg: base, messages: [{ from: 'me', text: prods[0] ? `Hi! Do you have ${prods[0].name.toLowerCase()} today?` : `Hi ${f.brand.split(' ')[0]}, are you open today?` }, { from: 'biz', text: prods[0]?.price ? `Yes! ${prods[0].name} is ${prods[0].price}. Want one?` : 'Yes, we are! How can we help you? 😊' }, { from: 'me', text: 'Perfect, I\'ll take it 🙌' }] });
  B.steps = () => ({ type: 'steps', bg: chance(0.5) ? 'dark' : base, title: 'How it works', items: [{ t: /book/i.test(cta) ? 'Book' : /whatsapp|message|chat/i.test(cta) ? 'Message us' : 'Reach out', s: phone || handle || 'It takes a minute', glyph: ctaGlyph }, { t: food ? 'We cook it fresh' : service ? 'We get to work' : 'We get it ready', s: '', glyph: food ? 'cup' : 'bolt' }, { t: food ? 'Enjoy' : 'You are sorted', s: '', glyph: 'smile' }] });
  B.cta = () => ({ type: 'button', bg: base, lead: pick([heads[3] || '', 'Ready?', 'Don\'t wait.', 'Your turn.']) || 'Ready?', accent: [0], label: cta, done: doneWord, glyph: ctaGlyph, sub: phone || handle || site || '' });
  B.end = () => ({ type: 'end', bg: pick(['brand', 'brand', base === 'light' ? 'dark' : 'light', base]), tagline: tagline || '', accent: tagline ? accentOf(tagline) : [], contact: handle || site || phone || '', contactGlyph: handle ? 'search' : site ? 'globe' : 'phone' });

  // ---- the owner's own scene picks come first (after the hook) ----
  const wanted = [];
  for (const id of [].concat(brief?.scenes || [])) {
    const types = MOTION_WANTS[id] || [];
    let beat = null;
    for (const t of types) {
      beat = t === 'search' ? B.search() || { type: 'search', bg: 'light', lead: 'So you search…', query: `${(f.cat || f.brand).toLowerCase()} near me`.slice(0, 30), title: f.brand, sub: f.cat || '', button: 'Open' }
        : t === 'chat' ? B.chat() : t === 'notif' ? B.notif() || { type: 'notif', bg: base, items: [{ body: H0 }] } : t === 'phone' ? { type: 'phone', bg: base, text: heads[1] || H0 }
        : t === 'receipt' ? B.receipt() : t === 'stack' ? B.menu() || B.features() : t === 'price' ? B.price() : t === 'countdown' ? { type: 'countdown', bg: 'dark', reveal: /open/i.test(text) ? 'Now open' : 'It\'s here', sub: f.brand }
        : t === 'calendar' ? B.calendar() : t === 'stat' ? B.stat() : t === 'ring' ? B.ring() : t === 'photos' ? B.photos() : t === 'grid' ? B.grid() : t === 'map' ? B.map()
        : t === 'steps' ? B.steps() : t === 'toggles' ? (feats.length >= 2 ? { type: 'toggles', bg: base, title: 'What you get', items: feats.slice(0, 4) } : null)
        : t === 'swap' ? (feats.length >= 2 ? { type: 'swap', bg: base, lead: 'What we do', items: feats.slice(0, 4) } : null) : t === 'orbit' ? (feats.length >= 3 ? { type: 'orbit', bg: base, items: feats.slice(0, 6).map((x) => ({ t: words(x).slice(0, 2).join(' '), glyph: glyphFor(x, 'star') })) } : null)
        : t === 'highlight' ? (words(heads[1] || H0).length >= 3 ? { type: 'highlight', bg: base, text: heads[1] || H0, hot: [accentOf(heads[1] || H0)[0]] } : null)
        : t === 'words' ? (id === 'glow' || id === 'liquid' ? { type: 'words', mode: 'glow', bg: 'dark', lines: balance(heads[1] || H0, 20) } : { type: 'words', mode: 'slam', bg: 'dark', lines: [words(heads[1] || H0).slice(0, 4).join(' ')], accent: [Math.min(3, words(heads[1] || H0).length - 1)] })
        : t === 'button' ? null : null;
      if (beat) break;
    }
    if (beat && !wanted.some((w) => w.type === beat.type)) wanted.push({ ...beat, _want: true });
  }

  // ---- order: hook, brand, the owner's picks, then the proof the facts support ----
  const energy = look?.energy || 'medium';
  const slamP = energy === 'high' ? 0.55 : energy === 'calm' ? 0.05 : 0.3, glowP = energy === 'calm' ? 0.5 : 0.3;
  const opener = (event && !avoidSet.has('countdown') && chance(0.5) ? B.countdown() : null) || (chance(slamP) ? B.hookSlam() : null) || (chance(glowP) ? B.hookGlow() : B.hookBuild());
  const brandBeat = (tech && chance(0.5) ? B.phone() : null) || B.brand();
  const pool = [
    B.photos(), B.price(), B.menu(), B.receipt(), B.features(), ...B.heads(), B.stat(), B.ring(), B.calendar(), B.grid(), B.notif(), B.search(), B.map(),
  ].filter(Boolean);
  // a little shuffle so two businesses with the same facts still get different films (proof order matters less than hook/brand/cta)
  for (let i = pool.length - 1; i > 0; i--) { if (chance(0.35)) { const j = Math.max(0, i - 1 - Math.floor(rnd() * 2)); [pool[i], pool[j]] = [pool[j], pool[i]]; } }
  // photos first when there are photos; the map always late
  pool.sort((a, b) => (a.type === 'photos' ? -1 : b.type === 'photos' ? 1 : 0) || (a.type === 'map' ? 1 : b.type === 'map' ? -1 : 0));
  const ctaBeat = B.cta(), endBeat = B.end();
  const est = (b) => BEAT_MIN[b.type] + 0.4;
  let budget = duration - est(opener) - est(ctaBeat) - est(endBeat);
  const body = [];
  const seen = new Set([opener.type === 'words' ? 'words-hook' : opener.type]);
  // beats that show the same list count as one (a menu and a receipt, or two lists of strengths)
  const family = (b) => (b._menu || b.type === 'receipt' ? 'products' : ['toggles', 'swap', 'orbit', 'stack'].includes(b.type) ? 'strengths' : b.type);
  const textsOf = (b) => [].concat(b._src || [], b.lines ? [[].concat(b.lines).join(' ')] : [], b.text || [], (b.items || []).map((x) => (typeof x === 'string' ? x : x.body || '')), b.reveal ? [] : []).filter(Boolean);
  const take = (b) => {
    const k = b.type === 'words' ? `words-${body.length}` : family(b);
    if (seen.has(k) && !b._want) return false;
    if (b.type === 'receipt' && seen.has('products') && !b._want) return false;
    if (!fresh(...textsOf(b)) && !b._want) return false;
    if (b._num && rawUsed.some((t) => new RegExp(`\\b${b._num}\\b`).test(t)) && !b._want) return false;
    if (est(b) > budget + 0.01) return false;
    seen.add(k); if (b.type === 'receipt') seen.add('products');
    textsOf(b).forEach((t) => { used.add(key(t)); rawUsed.push(String(t).toLowerCase()); });
    body.push(b); budget -= est(b); return true;
  };
  const rawUsed = [];
  textsOf(opener).forEach((t) => { used.add(key(t)); rawUsed.push(String(t).toLowerCase()); });
  if (duration >= 14) take(brandBeat);
  wanted.forEach(take);
  // how much time the facts fill; with lots of time and few facts, every strength gets its own beat (one idea per beat)
  const need = pool.reduce((a, b) => a + est(b), 0);
  const spread = feats.length >= 2 && budget - need > 4;
  if (spread) {
    const singles = feats.length - 2 >= 2 ? feats.slice(0, 2) : feats.slice(0, 4);
    const rest = feats.slice(singles.length);
    const fb = singles.map((t, i) => {
      const style = (i + Math.floor(rnd() * 2)) % 3;
      if (style === 0) return { type: 'words', mode: 'glow', bg: 'dark', lines: balance(t, 20) };
      if (style === 1 && words(t).length >= 3) { const a = accentOf(t)[0]; return { type: 'highlight', bg: base, text: t, hot: a > 0 ? [a - 1, a] : [a] }; }
      return { type: 'words', bg: base, lines: balance(t, 22), accent: accentOf(t) };
    });
    // drop the strengths list from the pool and weave the single beats in
    for (let i = pool.length - 1; i >= 0; i--) if (['toggles', 'swap', 'orbit'].includes(pool[i].type) || (pool[i].type === 'stack' && !pool[i]._menu)) pool.splice(i, 1);
    if (rest.length >= 2) pool.push(rest.every((x) => x.length <= 22) && chance(0.5) ? { type: 'swap', bg: base, lead: 'There\'s more', items: rest } : { type: 'toggles', bg: base, title: 'There\'s more', items: rest });
    fb.forEach((b, i) => pool.splice(Math.min(pool.length, 1 + i * 2), 0, b));
  }
  pool.forEach((b) => { if (!body.some((x) => x.type === b.type && !['words', 'highlight'].includes(b.type))) take(b); });
  // still room? repeat the main message in a different form, then the strengths again
  const fillers = [ feats.length >= 2 ? { type: 'toggles', bg: base, title: 'What you get', items: feats.slice(0, 4) } : null, B.search(), B.notif()].filter(Boolean);
  for (const fb of fillers) { if (budget < 2) break; if (!body.some((x) => x.type === fb.type && fb.type !== 'words')) take(fb); }
  let beats = [opener, ...body, ctaBeat, endBeat];

  // ---- backgrounds: keep rhythm (never three of the same in a row unless it is the theme), one brand punch ----
  const punch = beats.find((b) => b.bg === 'brand' && b.type !== 'end');
  beats.forEach((b) => { if (b.bg === 'brand' && b.type !== 'end' && b !== punch) b.bg = base; });
  if (punch && beats[beats.length - 1].bg === 'brand') beats[beats.length - 1].bg = base === 'light' ? 'dark' : 'light';
  // ---- timing: fill the requested length exactly ----
  const mins = beats.map((b) => BEAT_MIN[b.type] + extraFor(b));
  let tot = mins.reduce((a, b) => a + b, 0);
  const durs = mins.slice();
  if (tot < duration) {
    let room = duration - tot;
    for (let pass = 0; pass < 6 && room > 0.01; pass++) {
      const grow = beats.map((b, i) => Math.max(0, BEAT_MAX[b.type] - durs[i]));
      const g = grow.reduce((a, b) => a + b, 0);
      if (!g) break;
      beats.forEach((b, i) => { const add = Math.min(grow[i], (room * grow[i]) / g); durs[i] += add; });
      tot = durs.reduce((a, b) => a + b, 0); room = duration - tot;
    }
    if (room > 0.01) {   // still short: everything breathes a little more (up to 25%), then the end card holds
      const cap = durs.map((d, i) => BEAT_MAX[beats[i].type] * 1.25 - d);
      const c = cap.reduce((a, b) => a + Math.max(0, b), 0);
      if (c > 0) beats.forEach((b, i) => { durs[i] += Math.max(0, cap[i]) * Math.min(1, room / c); });
      room = duration - durs.reduce((a, b) => a + b, 0);
      if (room > 0.01) durs[durs.length - 1] += room;
    }
  } else if (tot > duration) {
    const k = duration / tot; for (let i = 0; i < durs.length; i++) durs[i] *= k;
  }
  // ---- transitions: varied, never the same twice in a row ----
  const outs = energy === 'high' ? ['whip', 'zoom', 'drop', 'whip', 'push', 'rise'] : energy === 'calm' ? ['push', 'fade', 'rise', 'push', 'fade'] : ['push', 'whip', 'zoom', 'rise', 'push', 'drop'];
  let last = '';
  beats = beats.map((b, i) => {
    let out = 'push';
    if (i < beats.length - 1) { let k = 0; do { out = pick(outs); k++; } while ((out === last || (out === 'drop' && beats[i + 1].type === 'map')) && k < 8); }
    last = out;
    const { _want, _src, _num, _menu, ...rest } = b;
    if (Array.isArray(rest.items)) rest.items = uniqueGlyphs(rest.items);
    return { ...rest, dur: Math.round(durs[i] * 100) / 100, out };
  });
  return { beats, font, accent: accentFor(colors, text), theme, brand: f.brand };
}

function extraFor(b) {
  if (b.type === 'words') { const n = words([].concat(b.lines || []).join(' ')).length; return b.mode === 'slam' ? Math.max(0, n * 0.42 - 1.2) : Math.min(1.2, n * 0.12); }
  if (b.type === 'stack' || b.type === 'toggles') return Math.max(0, (b.items?.length || 0) - 2) * 0.35;
  if (b.type === 'swap') return Math.max(0, (b.items?.length || 0) - 2) * 0.55;
  if (b.type === 'receipt') return Math.max(0, (b.items?.length || 0) - 2) * 0.3;
  if (b.type === 'chat') return Math.max(0, (b.messages?.length || 0) - 3) * 1;
  if (b.type === 'icon' && b.tagline) return 0.4;
  if (b.type === 'end' && b.contact) return 0.4;
  return 0;
}
/** "IYA BASIRA'S KITCHEN" / "iya basira's kitchen" -> "Iya Basira's Kitchen"; keeps deliberate styling like "KudiPay" or "iPhone Plug". */
function brandCase(b) {
  const t = String(b || '').trim();
  if (!t) return t;
  const ws = t.split(/\s+/);
  const styled = ws.some((w) => /[a-z][A-Z]/.test(w));
  if (styled) return t;
  const allLower = t === t.toLowerCase(), allUpper = t === t.toUpperCase();
  const sentenceCase = ws.length > 1 && /^[A-Z]/.test(ws[0]) && ws.slice(1).every((w) => /^[a-z]/.test(w));
  if (!(allLower || allUpper || sentenceCase)) return t;
  const small = new Set(['and', 'of', 'the', 'for', 'in', 'on', 'at', 'by', '&']);
  return ws.map((w, i) => { const l = w.toLowerCase(); if (i && small.has(l)) return l; return l.replace(/^([^a-z]*)([a-z])/, (_, p, c) => p + c.toUpperCase()); }).join(' ');
}
function prodGlyph(name, food, i) {
  const n = String(name).toLowerCase();
  if (/zobo|juice|drink|tea|coffee|smoothie|water|wine|beer|cocktail|chapman/.test(n)) return 'cup';
  if (/cake|pastr|bread|doughnut|cookie|muffin/.test(n)) return 'cake';
  if (/laptop|phone|computer|tablet|ipad|macbook|elitebook/.test(n)) return 'phone';
  if (/shoe|bag|dress|shirt|gown|wear|fabric|ankara/.test(n)) return 'bag';
  if (/hair|braid|nail|lash|makeup|facial/.test(n)) return 'sparkle';
  return food ? ['heart', 'star', 'bag', 'smile'][i % 4] : ['star', 'check', 'bolt', 'heart'][i % 4];
}
// no two tiles in one beat share an icon
function uniqueGlyphs(items) {
  const spare = ['check', 'bolt', 'shield', 'heart', 'sparkle', 'star', 'clock', 'smile', 'leaf', 'gift'];
  const seen = new Set();
  return items.map((it) => { if (!it || typeof it !== 'object' || !it.glyph) return it; let g = it.glyph; if (seen.has(g)) g = spare.find((x) => !seen.has(x)) || g; seen.add(g); return { ...it, glyph: g }; });
}
function titleish(s) { return String(s || '').replace(/^\w/, (c) => c.toUpperCase()); }
