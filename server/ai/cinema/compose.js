// Rule-based Cinema storyboard (used when there is no Gemini key, or the AI director fails).
// It never repeats one pattern: the story archetype, the "world" (look of the whole film), the type personality,
// scene order and transitions are all chosen from the business itself (category, products, strengths, photos)
// and a seed made from its name. It also cleans the user's wording first (typos in caps, prices, nonsense).

const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483646 + 1; };
const hex = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const lum = (h) => { const [r, g, b] = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const OK = /^#[0-9a-f]{6}$/i;

export const WORLDS_DARK = ['studio', 'aurora', 'grid', 'spot', 'dots', 'stripes'];
export const WORLDS_LIGHT = ['studio', 'aurora', 'paper', 'blocks', 'dots', 'stripes'];
export const FONT_FOR_WORLD = { studio: 'Inter', aurora: 'Poppins', grid: 'Montserrat', spot: 'Playfair Display', paper: 'DM Sans', blocks: 'Poppins', dots: 'DM Sans', stripes: 'Montserrat' };

/** A full lighting palette from the brand colours: dark studio when the background is dark, soft daylight when light. */
export function paletteFor(colors = {}) {
  const a1 = OK.test(colors.primary) ? colors.primary : '#5546FF';
  const a2 = OK.test(colors.secondary) ? colors.secondary : mix(a1, '#FF8A4C', 0.6);
  const bg = OK.test(colors.background) ? colors.background : '#0B0E1A';
  const dark = lum(bg) < 0.32;
  const a1d = mix(a1, '#000000', 0.22);
  if (dark) {
    const b1 = mix(bg, '#000000', 0.45), b2 = mix(bg, a1, 0.2);
    return { dark: true, bg1: b1, bg2: b2, ink: '#F6F7FF', mute: mix('#F6F7FF', bg, 0.45), a1, a2, a1d, card: rgba(mix(bg, '#FFFFFF', 0.12), 0.68), notif: rgba(mix(bg, '#FFFFFF', 0.16), 0.86), cardLine: 'rgba(255,255,255,.16)', hi: 'rgba(255,255,255,.16)', shadow: 'rgba(0,0,0,.7)', shadow2: 'rgba(0,0,0,.5)', bokeh: rgba(a1, 0.38), vig: 'rgba(0,0,10,.6)', grain: 0.09, sweep: rgba(mix(a1, '#FFFFFF', 0.5), 0.55),
      lamps: [{ x: 0.18, y: 0.14, size: 1600, c: rgba(a1, 0.5), dx: 160 }, { x: 0.88, y: 0.82, size: 1500, c: rgba(a2, 0.3), dx: 140 }] };
  }
  const b1 = mix(bg, '#FFFFFF', 0.55), b2 = mix(bg, a1, 0.22);
  const ink = OK.test(colors.text) && lum(colors.text) < 0.3 ? colors.text : '#1B1620';
  return { dark: false, bg1: b1, bg2: b2, ink, mute: mix(ink, '#FFFFFF', 0.45), a1, a2, a1d, card: 'rgba(255,255,255,.82)', notif: 'rgba(255,255,255,.88)', cardLine: rgba(ink, 0.1), hi: 'rgba(255,255,255,.95)', shadow: rgba(mix(a1, '#000000', 0.6), 0.36), shadow2: rgba(mix(a1, '#000000', 0.6), 0.24), bokeh: 'rgba(255,255,255,.75)', vig: rgba(mix(a1, '#000000', 0.6), 0.22), grain: 0.1, sweep: 'rgba(255,255,255,.8)',
    lamps: [{ x: 0.12, y: 0.1, size: 1500, c: 'rgba(255,255,255,.95)', dx: 160 }, { x: 0.92, y: 0.88, size: 1400, c: rgba(a1, 0.34), dx: 140 }, { x: 0.85, y: 0.18, size: 1000, c: rgba(a2, 0.42), dx: 120 }] };
}

// min seconds each scene type needs to read well
export const MIN_DUR = { hook: 3, kinetic: 3.2, ticker: 3.2, carousel: 4, chat: 4.4, burst: 3.4, steps: 4.6, orbit: 3.6, split: 3.8, grid: 4, goo: 3.2, photo: 3, logo: 3, cta: 4.4, search: 4.2, receipt: 4.5, map: 4.2, notifs: 3.3, bignum: 3.6, card3d: 4.4, phone: 4.2, shield: 3.4, roll: 3.6,
  checklist: 4.2, menu: 4.2, coupon: 4.2, stats: 4, location: 4.2, compare: 4.6, quote: 4, poster: 3.4, reel: 4, deck: 4.6, highlight: 3.6, countdown: 3.6 };

// What the form's "which scenes do you want?" answers mean (id -> scene types)
export const WANT_TYPES = { typing: ['search'], chat: ['chat'], ring3d: ['carousel'], prices: ['menu'], countdown: ['countdown'], beforeafter: ['split'], numbers: ['stats', 'bignum'], reel: ['reel', 'photo'], location: ['location'], offer: ['burst', 'coupon'], steps: ['steps'], checklist: ['checklist'], bigtype: ['kinetic', 'poster'], liquid: ['goo'], orbit: ['orbit'], cards: ['deck'], notifs: ['notifs'], compare: ['compare'], map: ['map'], highlight: ['highlight'] };
export const WANT_IDS = Object.keys(WANT_TYPES);

// ---------------------------------------------------------------- cleaning the user's words
const NONSENSE = /^(.)\1{3,}$|^[^aeiouy\s\d]{6,}$|(asdf|qwer|zxcv|lorem|ipsum|test test)/i;
/** Fix what people type: stray spaces, SHOUTING, lower-case starts, doubled punctuation. Returns '' for gibberish. */
export function cleanText(s, max = 80, { keepCase = false } = {}) {
  let t = String(s == null ? '' : s).replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').replace(/([!?.,])\1{1,}/g, '$1').replace(/\s+([!?.,:;])/g, '$1').trim();
  if (!t || NONSENSE.test(t)) return '';
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (!keepCase && letters.length > 5 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) t = t.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/\bi\b/g, 'I');
  if (!keepCase) t = t.charAt(0).toUpperCase() + t.slice(1);
  return polish(t).slice(0, max).trim();
}
const PROPER = { whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', lagos: 'Lagos', abuja: 'Abuja', ikeja: 'Ikeja', lekki: 'Lekki', ibadan: 'Ibadan', kano: 'Kano', nigeria: 'Nigeria', naija: 'Naija', yaba: 'Yaba', surulere: 'Surulere', ajah: 'Ajah', 'port harcourt': 'Port Harcourt', enugu: 'Enugu', kaduna: 'Kaduna', benin: 'Benin', ogun: 'Ogun', ikoyi: 'Ikoyi', 'victoria island': 'Victoria Island', gbagada: 'Gbagada', maryland: 'Maryland', ikorodu: 'Ikorodu' };
const SLANG = { ur: 'your', u: 'you', pls: 'please', plz: 'please', abt: 'about', cheap: 'affordable' };
function polish(t) {
  t = t.replace(/\b(whatsapp|instagram|facebook|tiktok|youtube|port harcourt|victoria island|[a-z]+)\b/gi, (m) => PROPER[m.toLowerCase()] || (SLANG[m.toLowerCase()] && m.toLowerCase() !== 'cheap' ? SLANG[m.toLowerCase()] : m));
  return t;
}
export const titleCase = (s) => String(s).toLowerCase().replace(/(^|[\s&-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
const fmt = (n) => Math.round(n).toLocaleString('en-US');
/** "N5000", "5000 naira", "₦5k", "NGN 12,500" -> "₦5,000" ... */
export function fixPrices(s) {
  return String(s).replace(/(?:₦|\bNGN\b|\bN(?=\s?\d))\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:\s?(k)\b)?/gi, (_, n, k) => `₦${fmt(Number(n.replace(/,/g, '')) * (k ? 1000 : 1))}`)
    .replace(/\b(\d{1,3}(?:,\d{3})+|\d+)(?:\s?(k))?\s?naira\b/gi, (_, n, k) => `₦${fmt(Number(n.replace(/,/g, '')) * (k ? 1000 : 1))}`);
}
const clip = (s, n, o) => cleanText(fixPrices(s), n, o);

const FOOD = /(food|cake|bak|restaurant|kitchen|chop|eat|cafe|coffee|pizza|grill|suya|catering|drink|juice|snack|meal|pastr|shawarma|burger)/i;
const MONEY = /(bank|fintech|finance|pay|money|loan|invest|crypto|wallet|savings|insurance|transfer)/i;
const TECH = /(app|software|tech|saas|\bai\b|platform|digital|web|online|startup|data|cloud)/i;
const BEAUTY = /(beauty|salon|hair|makeup|spa|nail|skin|barber|fashion|cloth|wear|style|tailor|boutique|jewel|luxur)/i;
const LOCAL = /(shop|store|market|clinic|school|gym|church|hotel|studio|repair|laundry|garage|salon|pharmacy)/i;
const GLYPH_FOR = [[/cake|bak|pastr/i, 'cake'], [/pay|bank|money|card/i, 'card'], [/deliver|ride|logistic|dispatch|truck/i, 'scooter'], [/phone|mobile|app/i, 'phone'], [/secure|safe|trust|insur/i, 'shield'], [/love|beauty|care|health|hair|spa/i, 'heart'], [/gift|event|party/i, 'gift'], [/home|house|estate|property/i, 'home'], [/fast|quick|speed|instant|power/i, 'bolt'], [/star|best|top|quality|premium/i, 'star'], [/shop|store|buy|bag|fashion|cloth/i, 'bag'], [/chat|whatsapp|message|talk|support/i, 'chat'], [/time|hour|open|24/i, 'clock'], [/pin|location|visit|near|address/i, 'pin']];
export const glyphFor = (t, fb) => (GLYPH_FOR.find(([re]) => re.test(t)) || [0, fb || 'star'])[1];

/** Pull the plain, cleaned facts out of a plan (+ the brief when there is one). */
export function factsFrom(plan, brief = {}, assets = []) {
  const biz = plan.business || {};
  let brand = clip(brief.name || biz.name || String(plan.title || '').split(/[-–|]/)[0] || 'Your brand', 28);
  if (brand === brand.toLowerCase() || brand === brand.toUpperCase() || /^[A-Z][a-z]+( [a-z]+)+$/.test(brand)) brand = titleCase(brand);
  const list = (v) => [...new Set((Array.isArray(v) ? v : []).map((x) => clip(x, 46)).filter(Boolean))];
  const sceneTexts = list((plan.scenes || []).flatMap((s) => [].concat(s.on_screen_text || [])));
  const images = (assets || []).filter((a) => (a.kind || 'image') === 'image');
  const logo = images.find((a) => a.role === 'logo' || /logo/i.test(a.name || ''));
  const photos = images.filter((a) => a !== logo);
  const headlines = list(brief.headlines).length ? list(brief.headlines) : sceneTexts.filter((t) => !/^\+?\d[\d\s-]{6,}$/.test(t) && t.toLowerCase() !== brand.toLowerCase()).slice(0, 4);
  const cat = clip(brief.category || biz.category || '', 50);
  return { brand, cat, headlines, products: list(brief.products), features: list(brief.features), ctas: list(brief.ctas), phone: clip(brief.contact || biz.phone || '', 40, { keepCase: true }), address: clip(biz.location || brief.address || '', 70), logo, photos,
    goal: clip(brief.goal || '', 80), cta: clip(brief.cta || plan.cta || list(brief.ctas)[0] || 'Order now', 30), text: `${cat} ${brand} ${plan.title || ''} ${brief.goal || ''} ${brief.extra || ''} ${(brief.products || []).join(' ')}` };
}

const price = (s) => (String(s).match(/₦\s?[\d,]+/) || [''])[0].replace(/\s/g, '');
const nameOnly = (s) => cleanText(String(s).replace(/[-–:|(]?\s*₦\s?[\d,]+\)?/i, '').replace(/[-–:|]\s*$/, ''), 24);
const split2 = (t, max = 14) => { const w = String(t || '').trim().split(' '); if (w.length < 2) return [w.join(' ')]; const mid = Math.ceil(w.length / 2); const a = w.slice(0, mid).join(' '), b = w.slice(mid).join(' '); return a.length <= max * 1.6 && b.length <= max * 1.6 ? [a, b] : [String(t).slice(0, 30)]; };
const nonEmpty = (a) => a.filter(Boolean);

/** Give every scene its own way in and out (never the same twice in a row) */
export function finish(scenes, seed) {
  const ins = ['push', 'rise', 'slide']; let s = seed || 1; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let last = '';
  return scenes.map((sc, i) => { if (i === 0) return sc; let k; do { k = ins[Math.floor(r() * ins.length)]; } while (k === last); last = k; return { ...sc, in: k, out: ins[(ins.indexOf(k) + 1) % 3] }; });
}

/** Pick the world (look of the whole film) so videos do not look alike. */
export function pickWorld(palette, f, rnd) {
  const pool = palette.dark ? WORLDS_DARK : WORLDS_LIGHT;
  const beauty = BEAUTY.test(f.text), tech = MONEY.test(f.text) || TECH.test(f.text);
  const pref = palette.dark ? (beauty ? ['spot', 'aurora'] : tech ? ['grid', 'aurora', 'dots'] : ['aurora', 'stripes', 'studio']) : (beauty ? ['paper', 'aurora'] : tech ? ['dots', 'blocks', 'studio'] : ['paper', 'blocks', 'aurora', 'stripes']);
  const list = pref.filter((w) => pool.includes(w));
  return list[Math.floor(rnd() * list.length)] || pool[0];
}

/** The storyboard. Returns { scenes, world, font } with scene durations that add up to the plan's seconds. */
export function composeCinema(plan, { brief = {}, assets = [], salt = '', palette = null } = {}) {
  const f = factsFrom(plan, brief, assets);
  const seed = hash(`${f.brand}|${f.cat}|${salt}`);
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const food = FOOD.test(f.text), money = MONEY.test(f.text), tech = TECH.test(f.text), beauty = BEAUTY.test(f.text), local = LOCAL.test(f.text);
  const duration = Math.max(15, Number(plan.duration_seconds) || 24);
  const H0 = f.headlines[0] || f.goal || `Meet ${f.brand}`;
  const H1 = f.headlines[1] || f.goal || '';
  const hl = (t, n) => String(t).split(' ').slice(0, n);
  const priced = f.products.filter((p) => price(p));

  // ---- building blocks (each returns a scene, an array of scenes, or null) ----
  const lineOf = (t, size, acc) => ({ text: String(t).slice(0, 28), size, accent: acc });
  const hook = () => { const [a, b] = split2(H0, 10); return { type: 'hook', eyebrow: f.cat || f.brand, lines: b ? [lineOf(a, 300), lineOf(b, 300, [b.split(' ').length - 1])] : [lineOf(a, 300, [a.split(' ').length - 1])] }; };
  const kinetic = () => { const ws = hl(H0, 3).map((w, i, arr) => ({ text: w.replace(/[^\p{L}\p{N}₦%'&-]/gu, '').slice(0, 11).toUpperCase(), size: 300 + (i % 2) * 40, accent: i === arr.length - 1 })).filter((w) => w.text); return ws.length ? { type: 'kinetic', words: ws } : null; };
  const poster = () => { const ls = hl(H0.replace(/[^\p{L}\p{N}\s]/gu, ''), 4).map((w) => w.slice(0, 11).toUpperCase()).filter(Boolean); return ls.length >= 2 ? { type: 'poster', lines: ls, hot: ls.length - 1 } : null; };
  const ticker = () => { const rows = (f.products.length >= 3 ? f.products.map(nameOnly) : [f.brand, f.cat, ...f.features.slice(0, 2)]).map((x) => String(x).slice(0, 14).toUpperCase()).filter(Boolean).slice(0, 4); if (rows.length < 3) return null; const [a, b] = split2(H1 || `${f.brand}, done right`, 12); return { type: 'ticker', rows, rowSize: 240, lines: nonEmpty([lineOf(a, 110), b ? lineOf(b, 110, [b.split(' ').length - 1]) : null]) }; };
  const carousel = () => f.products.length >= 3 ? { type: 'carousel', title: food ? "Today's menu" : 'What we offer', accent: [1], items: f.products.slice(0, 6).map((p, i) => ({ glyph: glyphFor(p, ['star', 'heart', 'bolt', 'gift', 'bag', 'check'][i % 6]), title: nameOnly(p), sub: '', price: price(p), tag: i === 0 ? 'POPULAR' : '' })).filter((i) => i.title) } : null;
  const deck = () => { const src = f.features.length >= 3 ? f.features : f.products.length >= 3 ? f.products : null; return src ? { type: 'deck', title: f.features.length >= 3 ? 'Why choose us' : 'What we offer', accent: [1], items: src.slice(0, 4).map((p, i) => ({ glyph: glyphFor(p, ['bolt', 'star', 'heart', 'shield'][i % 4]), title: nameOnly(p), sub: price(p) })) } : null; };
  const grid = () => { const src = f.features.length >= 3 ? f.features : null; return src ? { type: 'grid', title: 'Why people love us', accent: [3], hot: 0, tiles: src.slice(0, 4).map((p, i) => { const m = p.match(/^(\d[\d,.]*\+?%?)\s+(.*)$/); return { glyph: glyphFor(p, ['bolt', 'star', 'heart', 'shield'][i % 4]), big: m ? m[1] : '', title: m ? m[2].slice(0, 22) : p.slice(0, 24), sub: '', wide: i === 0 || (src.length === 3 && i === 2) }; }) } : null; };
  const checklist = () => f.features.length >= 3 ? { type: 'checklist', title: 'What you get', accent: [2], items: f.features.slice(0, 5).map((x) => x.slice(0, 30)) } : null;
  const menu = () => priced.length >= 2 ? { type: 'menu', title: food ? "Today's menu" : 'Our prices', accent: [1], rows: priced.slice(0, 5).map((p) => ({ name: nameOnly(p), price: price(p) })).filter((r) => r.name) } : null;
  const stats = () => {
    const found = f.features.concat(f.headlines).map((t) => { const m = t.match(/(\d[\d,]*)(\+|%|k\b)?\s*([A-Za-z][\w\s]{2,22})/); return m ? { value: m[1].replace(/,/g, ''), suffix: m[2] || '', label: cleanText(m[3], 24) } : null; }).filter((x) => x && x.value.length <= 5);
    return found.length ? { type: 'stats', title: '', items: found.slice(0, 3) } : null;
  };
  const location = () => f.address ? { type: 'location', title: 'Find us', address: f.address, sub: f.phone || '' } : null;
  const steps = () => ({ type: 'steps', title: 'How it works', accent: [2], steps: [{ title: food ? 'Pick your order' : 'Get in touch', sub: food ? 'Browse the menu' : 'Message us' }, { title: food ? 'Chat to order' : 'We get to work', sub: food ? 'On WhatsApp' : 'Fast and careful' }, { title: food ? 'Enjoy it fresh' : 'Enjoy the result', sub: food ? 'At your door' : 'Happy every time' }] });
  const chat = () => ({ type: 'chat', name: f.brand, messages: [{ from: 'them', text: food ? 'Hi! Can I place an order?' : `Hi ${f.brand}, are you available?` }, { from: 'me', text: 'Of course! How can we help? 😊' }, { from: 'them', text: food ? 'Delivery to Lekki please 🙏' : 'I need this done this week' }, { from: 'me', text: 'Sorted. You’ll love it ✨' }] });
  const offerNum = () => (f.headlines.concat(f.features, f.products, [f.goal]).join(' ').match(/(\d{1,3})\s?%/) || [])[1];
  const burst = () => { const m = offerNum(), p = priced.length ? price(priced[0]) : ''; if (m) return { type: 'burst', eyebrow: 'Special offer', big: `${m}%`, size: 560, lines: [{ text: 'OFF', size: 100, accent: [0] }] }; if (p) return { type: 'burst', eyebrow: 'From only', big: p, size: 250, lines: [{ text: 'Get yours today', size: 90, accent: [2] }] }; return null; };
  const coupon = () => { const m = offerNum(); return m ? { type: 'coupon', label: 'Special offer', big: `${m}% OFF`, size: 230, sub: f.brand, note: f.cta } : null; };
  const orbit = () => ({ type: 'orbit', logo: true, items: [food ? 'bag' : 'star', food ? 'scooter' : 'bolt', 'heart', 'gift', 'check'].map((g) => ({ glyph: g })), lines: [{ text: 'Everything you need,', size: 92 }, { text: 'in one place.', size: 92, accent: [2] }] });
  const split = () => ({ type: 'split', before: { label: 'Without us', lines: food ? ['Hungry.', 'Tired.'] : ['Stuck.', 'Slow.'], size: 190 }, after: { label: `With ${f.brand}`, lines: food ? ['Fed.', 'Happy.'] : ['Done.', 'Easy.'], size: 190, glyph: 'heart' } });
  const goo = () => ({ type: 'goo', lines: [{ text: hl(H0, 2).join(' ').slice(0, 14), size: 190 }, { text: hl(H1 || f.brand, 2).join(' ').slice(0, 14), size: 190 }] });
  const highlight = () => { const t = H1.length > 12 ? H1 : H0.length > 12 ? H0 : ''; if (!t) return null; const w = t.split(' '); return w.length >= 3 ? { type: 'highlight', text: t, hot: [w.length - 1, ...(w.length > 4 ? [w.length - 2] : [])], size: 124 } : null; };
  const logo = () => (f.logo ? { type: 'logo', url: f.logo.url, lines: [{ text: f.brand, size: 80 }] } : null);
  const photos = () => f.photos.slice(0, 3).map((p, i) => ({ type: 'photo', url: p.url, eyebrow: i === 0 ? f.cat : '', lines: i === 0 ? split2(H0, 12).map((t, k, a) => lineOf(t, 150, k === a.length - 1 ? [0] : undefined)) : [lineOf(f.products[i - 1] ? nameOnly(f.products[i - 1]) : f.features[i - 1] || f.brand, 130)], pos: 'center' }));
  const reel = () => f.photos.length >= 2 ? { type: 'reel', urls: f.photos.slice(0, 5).map((p) => p.url), lines: split2(H0, 12).map((t, k, a) => lineOf(t, 140, k === a.length - 1 ? [0] : undefined)) } : null;
  const delivery = () => food && /deliver|order|whatsapp/i.test(f.text) ? [{ type: 'search', label: 'So you search…', query: `${f.cat || 'food'} near me`.toLowerCase().slice(0, 26), rating: false, meta: f.cat || 'Open now', cta: 'Order' }, { type: 'map', label: 'On the way', status: 'On the way', eta1: '12 min', eta2: '3 min' }, { type: 'notifs', label: 'Right to your door', items: [{ glyph: 'bag', title: 'Order confirmed', body: 'We’re getting it ready' }, { glyph: 'scooter', title: 'Rider on the way', body: 'Arriving soon' }, { glyph: 'check', title: 'Delivered', body: 'Enjoy! 🎉' }] }] : null;
  // builders used only when the owner asks for that kind of scene in the form
  const typing = () => ({ type: 'search', label: 'So you search…', query: `${f.cat || f.brand} near me`.toLowerCase().slice(0, 26), rating: false, meta: f.cat || 'Open now', cta: f.cta.split(' ')[0].slice(0, 10) || 'Open' });
  const notifsGeneric = () => ({ type: 'notifs', label: `${f.brand} for you`, items: [{ glyph: 'check', title: 'Confirmed', body: `${f.brand} got your message` }, { glyph: food ? 'scooter' : 'bolt', title: 'On it', body: 'We’re working on it' }, { glyph: 'star', title: 'Done', body: 'Enjoy! 🎉' }] });
  const countdown = () => ({ type: 'countdown', from: 3, lines: [{ text: f.brand.slice(0, 14), size: 190, accent: [0] }] });
  const compare = () => f.features.length >= 2 ? { type: 'compare', title: 'Not all are equal', accent: [2], left: { name: 'Others', points: ['Long waits', 'Unclear prices', 'Average quality'] }, right: { name: f.brand.slice(0, 22), points: f.features.slice(0, 3).map((x) => x.slice(0, 28)) } } : null;
  const bignum = () => { const m = stats(); const it = m?.items?.[0]; return it ? { type: 'bignum', eyebrow: it.label, prefix: '', value: it.value, suffix: it.suffix || '', size: 420, lines: [{ text: it.label, size: 90, accent: [0] }] } : null; };
  const mapScene = () => ({ type: 'map', label: f.address ? 'Find us' : 'On the way', status: 'On the way', eta1: '12 min', eta2: '3 min' });
  const BUILD = { search: typing, chat, carousel, menu, countdown, split, stats, bignum, reel: reel, photo: photos, location, burst, coupon, steps, checklist, kinetic, poster, goo, orbit, deck, notifs: notifsGeneric, compare, map: mapScene, highlight };
  const cta = () => ({ type: 'cta', tagline: (H1 || f.goal || 'Made with care.').slice(0, 42), button: f.cta.slice(0, 26), glyph: /whatsapp|chat|message/i.test(f.cta) ? 'chat' : /call|phone/i.test(f.cta) ? 'phone' : 'arrow', contact: (f.phone || f.ctas[1] || f.brand).slice(0, 34), name: f.brand, logo: f.logo ? f.logo.url : undefined });

  // ---- archetypes: ordered wish-lists; what the facts can't support is skipped ----
  const ARCH = {
    punch: [kinetic, photos, reel, carousel, coupon, burst, checklist, steps],
    story: [hook, delivery, chat, menu, checklist, deck],
    showcase: [ticker, orbit, deck, stats, photos, split, grid],
    liquid: [goo, highlight, photos, carousel, grid, burst, stats],
    editorial: [poster, highlight, checklist, menu, location, photos, chat],
    proof: [hook, stats, deck, chat, checklist, orbit],
    local: [kinetic, reel, menu, location, chat, checklist, photos],
  };
  const affinity = { punch: 1, story: food ? 3 : 0.5, showcase: 1.2, liquid: beauty ? 2.5 : 0.8, editorial: beauty || local ? 2.2 : 1, proof: money || tech ? 3 : 0.6, local: local ? 2.5 : 0.7 };
  const score = (k) => ARCH[k].reduce((a, fn) => a + (fn() ? 1 : 0), 0) * affinity[k] * (0.7 + rnd() * 0.6);
  const arche = Object.keys(ARCH).map((k) => [k, score(k)]).sort((a, b) => b[1] - a[1])[0][0];
  const wish = [];
  const add = (x) => [].concat(x || []).filter(Boolean).forEach((sc) => wish.push(sc));
  ARCH[arche].forEach((fn) => add(fn()));
  [orbit, split, steps, chat, goo, ticker].forEach((fn) => add(fn()));   // fillers when the facts are thin
  // scenes the owner asked for in the form: right after the opener, and always before the fillers
  const wanted = [];
  for (const id of [].concat(brief?.scenes || [])) for (const t of WANT_TYPES[id] || []) { const sc = BUILD[t]?.(); if (sc) { [].concat(sc).forEach((x) => wanted.push(x)); break; } }
  const opener = wish.findIndex((x) => ['hook', 'kinetic', 'ticker', 'goo', 'photo', 'poster', 'reel'].includes(x.type));
  if (wanted.length) wish.splice(opener === 0 ? 1 : 0, 0, ...wanted);
  add(logo());
  if (!['hook', 'kinetic', 'ticker', 'goo', 'photo', 'poster', 'reel'].includes(wish[0]?.type)) wish.unshift(kinetic() || hook());
  const end = cta();

  // ---- fit to the time ----
  const body = []; let used = MIN_DUR.cta; const seen = new Set();
  for (const sc of wish) {
    const need = MIN_DUR[sc.type] || 3.4;
    if (used + need > duration + 0.01) continue;
    if (sc.type !== 'photo' && seen.has(sc.type)) continue;
    seen.add(sc.type); body.push(sc); used += need;
  }
  if (!body.length) body.push(hook());
  const all = [...body, end];
  const spare = duration - all.reduce((a, x) => a + (MIN_DUR[x.type] || 3.4), 0);
  const w = all.map((x) => (['chat', 'steps', 'carousel', 'deck', 'checklist'].includes(x.type) ? 1.5 : x.type === 'cta' ? 1.2 : 1));
  const wsum = w.reduce((a, b) => a + b, 0);
  all.forEach((x, i) => { x.dur = Math.round(((MIN_DUR[x.type] || 3.4) + spare * (w[i] / wsum)) * 20) / 20; });
  const drift = Math.round((duration - all.reduce((a, x) => a + x.dur, 0)) * 20) / 20;
  all[all.length - 1].dur = Math.round((all[all.length - 1].dur + drift) * 20) / 20;
  const pal = palette || paletteFor({});
  const world = pickWorld(pal, f, rnd);
  return { scenes: finish(all, seed), world, font: beauty && pal.dark ? 'Playfair Display' : FONT_FOR_WORLD[world] || 'Inter', archetype: arche };
}
