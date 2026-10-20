// The Cinema AI director: Gemini invents a storyboard for THIS business from the scene library below.
// Everything it returns is cleaned (known scene types, clipped text, sane seconds) before it is animated,
// and if Gemini is unavailable or fails, composeCinema() gives a rule-based storyboard.
import { geminiGenerate } from '../../engine/gemini.js';
import { composeCinema, factsFrom, paletteFor, MIN_DUR, finish, pickWorld, cleanText, fixPrices, WORLDS_DARK, WORLDS_LIGHT, FONT_FOR_WORLD, WANT_TYPES } from './compose.js';
import { cinemaHtml, readCinema } from './index.js';

const MODEL = process.env.GEMINI_DIRECTOR_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-flash-latest';
const clip = (s, n) => fixPrices(String(s == null ? '' : s).replace(/\s+/g, ' ').trim()).slice(0, n);
const GLYPHS = ['cake', 'bag', 'scooter', 'pin', 'check', 'shield', 'card', 'send', 'bolt', 'star', 'phone', 'chat', 'wallet', 'arrow', 'search', 'heart', 'clock', 'gift', 'home'];
const glyph = (g, fb = 'star') => (GLYPHS.includes(g) ? g : fb);

export const SCENE_GUIDE = `SCENE LIBRARY (each scene is one object: {"type":..., "dur": seconds, ...fields}). Glyph names: ${GLYPHS.join(', ')}.
- hook: eyebrow? (small caps line), lines [{text (max 12 letters per line), size? 200-340, accent? [word index]}] (1-3 lines). Giant confident type opener.
- kinetic: words [{text (ONE word, max 11 letters, uppercase), size? 260-360, accent? true}] (2-4 words). Words slam in one by one with echoes. Best opener for energy.
- ticker: rows [3-4 short uppercase words/phrases, max 14 letters] sliding as giant marquee rows, lines [{text, size, accent?}] (2 lines) crisp message in the middle.
- carousel: title (max 24 chars), accent? [word idx], items [{glyph, title (max 22), sub? (max 28), price? (e.g. "₦3,500"), tag? (e.g. "HOT")}] (3-6 items, REAL products/services only). A 3D ring of cards rotating.
- grid: title, accent?, hot? (index of the highlighted tile), tiles [{glyph, big? (a number like "25" or "4.9"), title (max 22), sub? (max 26), wide? bool}] (3-4 tiles). Bento board. ONLY real strengths of the business.
- steps: title, accent?, steps [{title (max 22), sub? (max 26)}] (exactly 3). A glowing line draws through numbered steps.
- chat: name?, messages [{from: "them"|"me", text (max 40)}] (3-5). A real chat; "them" is the customer, "me" the business.
- burst: eyebrow?, big (the offer: "30%", "₦5,000", "FREE"), size? 320-560, lines [{text, size, accent?}]. Rays and confetti: use ONLY for a real offer or price.
- split: before {label, lines [2 short], size?}, after {label, lines [2 short], glyph?, size?}. Before/after wipe.
- orbit: logo? true (brand tile in centre) or glyph, items [{glyph}] (4-6), lines [{text,size,accent?}]. Icons orbiting a hero.
- goo: lines [{text (max 14 letters), size 170-220}] (2). Liquid blobs behind white type. Moody, fashionable.
- photo: url (EXACT asset url from the list), eyebrow?, lines [{text, size 120-170, accent?}], align? "left"|"center". The user's own picture revealed with a mask. USE THEIR PHOTOS.
- logo: url (their logo's exact url) , lines [{text,size}]. Light flare logo reveal.
- search: label, query, meta (e.g. "Open now · Lekki"), rating: false, cta. A search bar types the query, the business appears.
- receipt: order, rows [[name, "18,000"]...] (2-4, REAL products), total ("20,000"), currency "₦". A printed receipt with a PAID stamp.
- map: label, status, eta1, eta2. Delivery on a map (only if they deliver).
- notifs: label, items [{glyph, title (max 22), body (max 34)}] (3). Phone-style notifications.
- bignum: eyebrow?, prefix?, value (digits only, e.g. "24"), suffix? ("%", "+", "h"), size 380-520, lines [{text,size,sub?,accent?}]. Odometer counting up. ONLY for a real number.
- roll: lead, leadSize?, words [3-5 single words], size. Word slot-machine ("We do | Cakes | Cookies | Pies").
- card3d: lines, card {brand, last4, name}. Glowing 3D payment card (finance only).
- phone: date, time, widget? {label,value}, items [{glyph,title,body}], w1, w2. A tilted phone with notifications.
- shield: glyph, lines. A ring draws around an icon (trust / security / done).
- checklist: title, accent?, items [3-5 short strings (max 30)] ticking off one by one. Real strengths/inclusions only.
- menu: title, accent?, rows [{name, price ("₦3,500")}] (2-5). A price board with dotted leaders. ONLY real prices.
- coupon: label, big ("30% OFF"), size? 200-250, sub?, code? (only if they gave one), note?. A ticket that tears. ONLY a real offer.
- stats: title?, items [{value (digits), suffix? ("+","%","min","k"), label (max 24)}] (1-3). Giant counters. ONLY real numbers.
- location: title?, address (real), sub? (hours/phone). A map pin drops.
- compare: title, accent?, left {name, points [3 short]}, right {name (the brand), points [3 short]}. Others vs us. Keep the left side fair and generic, never name competitors.
- quote: text (max 80), who. ONLY a real customer quote they provided.
- poster: lines [2-4 uppercase words, max 11 letters each], hot? (index to highlight). A wall of type filling the frame.
- reel: urls [2-5 exact photo urls], lines [{text,size,accent?}]. Their photos scrolling on a tilted film strip.
- deck: title, accent?, items [{glyph, title (max 22), sub? (max 26)}] (3-4). A stack of cards swiped away one by one.
- highlight: text (a sentence of 4-8 words), hot [word indexes to mark with a marker bar], size? 100-130. 
- countdown: from (3), lines [{text,size,accent?}]. 3-2-1 then a reveal, for launches/openings/new things.
- cta: tagline (max 42), button (max 26), glyph, contact (phone / handle), name?, logo? (url). ALWAYS the last scene.`;

const system = ({ duration }) => `You are the director of premium motion-graphic video ads, in the style of top After Effects studios and Apple-style product films. You invent a storyboard that is UNIQUE to ONE business: its own world, device and rhythm. Never use a generic formula.

YOU ARE ALSO THE COPY EDITOR. People type messily: typos, ALL CAPS, slang, broken English, half-sentences, repeated or nonsensical phrases, wrong price formats (N5000, 5k, 5000 naira). Make every word on screen correct and good:
- Fix spelling, grammar and capitalisation. Turn fragments into proper punchy ad lines. Rewrite clumsy or confusing wording so it makes sense and sounds premium, keeping the meaning.
- Drop gibberish or anything that cannot be turned into sense (do not show it). Never copy a messy phrase as it is.
- Prices as "₦5,000". Keep names, prices, phone numbers and addresses EXACTLY right; fix only obvious typos in names of ordinary words.
- Everything must read naturally to a stranger. Re-read every line you write as the viewer would.

HOW TO THINK
1. Find ONE strong idea for this business (a signature device: a search that finds them, a chat that becomes an order, a giant number, a menu ring, a before/after, a how-it-works path, loud typographic energy...). Choose scenes that serve that idea, not a checklist.
2. Open with a hook that stops the thumb (hook / kinetic / ticker / goo / photo). Then 3-6 scenes that PROVE it with real objects (cards, chats, receipts, phones, numbers, photos), then ALWAYS end on a cta.
3. Vary scale and rhythm: alternate huge type with rich objects. Do not use the same scene type twice (photo may repeat).
4. Use the user's own photos with "photo" scenes and their logo in "logo"/"cta" whenever assets exist.
5. NEVER invent facts: no made-up prices, ratings, review counts, awards, years, phone numbers or claims. Use only what the business told you. If it gave no price, do not use a price. Generic story beats (a chat, steps, a before/after) are fine.
6. Copy: short, punchy, human. Max 12 letters per hook line. Nigerian business context is welcome when it fits (₦, WhatsApp) but follow the facts.
7. Total seconds of all "dur" must equal ${duration} (each scene at least its minimum: ${Object.entries(MIN_DUR).map(([k, v]) => `${k} ${v}`).join(', ')}). 5-8 scenes for 24-30s; fewer for shorter.

${SCENE_GUIDE}

WORLDS (the look of the whole film; pick ONE that fits this business and differs from the usual): studio (soft lamps, default), aurora (flowing colour light), grid (retro-future neon floor, dark only), spot (a moving stage spotlight, dark only), paper (editorial paper with shapes, light only), blocks (bold colour bars, light only), dots (halftone dots), stripes (moving diagonal stripes). Dark palettes allow: ${WORLDS_DARK.join(', ')}. Light palettes allow: ${WORLDS_LIGHT.join(', ')}.
FONTS: Inter (clean), Poppins (friendly bold), DM Sans (modern), Montserrat (strong), Playfair Display (elegant serif; beauty, luxury, fashion, food-premium).

Return ONLY JSON: { "concept": "one sentence: the idea", "world": "...", "font": "Inter"|"Poppins"|"DM Sans"|"Montserrat"|"Playfair Display", "scenes": [ ... ] }`;

const num = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };
const lines = (arr, d = 140, n = 3, len = 28) => (Array.isArray(arr) ? arr : []).slice(0, n).map((l) => (typeof l === 'string' ? { text: clip(l, len), size: d } : { text: clip(l?.text, len), size: num(l?.size, 40, 420, d), ...(Array.isArray(l?.accent) ? { accent: l.accent.filter(Number.isInteger).slice(0, 3) } : {}), ...(l?.sub ? { sub: true } : {}) })).filter((l) => l.text);

/** Clean a storyboard from the AI. Returns scenes or null. */
export function sanitizeScenes(raw, { duration, assets = [] } = {}) {
  const urls = new Set((assets || []).map((a) => a.url));
  const out = [];
  for (const s of Array.isArray(raw) ? raw : []) {
    const t = String(s?.type || '');
    if (!(t in MIN_DUR)) continue;
    let o = { type: t };
    switch (t) {
      case 'hook': o.eyebrow = clip(s.eyebrow, 30); o.lines = lines(s.lines, 280, 3, 14); if (!o.lines.length) continue; break;
      case 'kinetic': o.words = (s.words || []).slice(0, 4).map((w) => ({ text: clip(typeof w === 'string' ? w : w.text, 12).toUpperCase(), size: num(w.size, 200, 380, 300), ...(w.accent ? { accent: true } : {}) })).filter((w) => w.text); if (o.words.length < 1) continue; break;
      case 'ticker': o.rows = (s.rows || []).slice(0, 4).map((r) => clip(r, 14).toUpperCase()).filter(Boolean); o.rowSize = 240; o.lines = lines(s.lines, 110, 2, 20); if (o.rows.length < 2) continue; break;
      case 'carousel': o.title = clip(s.title, 26); o.accent = s.accent; o.items = (s.items || []).slice(0, 6).map((i) => ({ glyph: glyph(i.glyph), title: clip(i.title, 22), sub: clip(i.sub, 30), price: clip(i.price, 12), tag: clip(i.tag, 10) })).filter((i) => i.title); if (o.items.length < 3) continue; break;
      case 'grid': o.title = clip(s.title, 28); o.accent = s.accent; o.hot = num(s.hot, 0, 3, 0); o.tiles = (s.tiles || []).slice(0, 4).map((i) => ({ glyph: glyph(i.glyph), big: clip(i.big, 6), title: clip(i.title, 24), sub: clip(i.sub, 28), wide: !!i.wide })).filter((i) => i.title); if (o.tiles.length < 3) continue; break;
      case 'steps': o.title = clip(s.title, 28); o.accent = s.accent; o.steps = (s.steps || []).slice(0, 3).map((i) => ({ title: clip(i.title, 22), sub: clip(i.sub, 28) })).filter((i) => i.title); if (o.steps.length !== 3) continue; break;
      case 'chat': o.name = clip(s.name, 28); o.messages = (s.messages || []).slice(0, 5).map((m) => ({ from: m.from === 'me' ? 'me' : 'them', text: clip(m.text, 44) })).filter((m) => m.text); if (o.messages.length < 2) continue; break;
      case 'burst': o.eyebrow = clip(s.eyebrow, 24); o.big = clip(s.big, 8); o.size = num(s.size, 260, 580, 480); o.lines = lines(s.lines, 100, 2, 22); if (!o.big) continue; break;
      case 'split': { const side = (x, d) => ({ label: clip(x?.label, 24) || d, lines: (x?.lines || []).slice(0, 2).map((l) => clip(l, 12)).filter(Boolean), size: num(x?.size, 120, 220, 190), ...(x?.glyph ? { glyph: glyph(x.glyph) } : {}) }); o.before = side(s.before, 'Before'); o.after = side(s.after, 'After'); if (!o.before.lines.length || !o.after.lines.length) continue; break; }
      case 'orbit': o.logo = s.logo !== false && !s.glyph; o.glyph = glyph(s.glyph, 'bolt'); o.items = (s.items || []).slice(0, 6).map((i) => ({ glyph: glyph(i.glyph) })); o.lines = lines(s.lines, 92, 2, 28); if (o.items.length < 3) continue; break;
      case 'goo': o.lines = lines(s.lines, 190, 2, 14); if (!o.lines.length) continue; break;
      case 'photo': if (!urls.has(s.url)) continue; o.url = s.url; o.eyebrow = clip(s.eyebrow, 28); o.lines = lines(s.lines, 150, 3, 16); o.align = s.align === 'center' ? 'center' : 'left'; break;
      case 'logo': if (!urls.has(s.url)) continue; o.url = s.url; o.lines = lines(s.lines, 80, 2, 30); break;
      case 'search': o.label = clip(s.label, 30); o.query = clip(s.query, 34); o.meta = clip(s.meta, 40); o.rating = false; o.cta = clip(s.cta, 12) || 'Order'; if (!o.query) continue; break;
      case 'receipt': o.order = clip(s.order, 20); o.rows = (s.rows || []).slice(0, 4).map((r) => [clip(r[0], 24), clip(r[1], 10)]).filter((r) => r[0] && r[1]); o.total = clip(s.total, 10); o.currency = clip(s.currency, 2) || '₦'; if (o.rows.length < 2 || !/^[\d,]+$/.test(o.total)) continue; break;
      case 'map': o.label = clip(s.label, 24); o.status = clip(s.status, 20); o.eta1 = clip(s.eta1, 10); o.eta2 = clip(s.eta2, 10); break;
      case 'notifs': o.label = clip(s.label, 30); o.items = (s.items || []).slice(0, 3).map((i) => ({ glyph: glyph(i.glyph), title: clip(i.title, 22), body: clip(i.body, 34) })).filter((i) => i.title); if (o.items.length < 2) continue; break;
      case 'bignum': o.eyebrow = clip(s.eyebrow, 24); o.prefix = clip(s.prefix, 2); o.value = String(s.value || '').replace(/[^\d.,]/g, '').slice(0, 5); o.suffix = clip(s.suffix, 3); o.size = num(s.size, 260, 520, 420); o.lines = lines(s.lines, 110, 2, 24); if (!o.value) continue; break;
      case 'roll': o.lead = clip(s.lead, 20); o.leadSize = num(s.leadSize, 80, 160, 130); o.words = (s.words || []).slice(0, 5).map((w) => clip(w, 12)).filter(Boolean); o.size = num(s.size, 140, 240, 200); if (o.words.length < 3) continue; break;
      case 'card3d': o.lines = lines(s.lines, 88, 2, 24); o.card = { brand: clip(s.card?.brand, 12), last4: String(s.card?.last4 || '4821').replace(/\D/g, '').slice(0, 4) || '4821', name: clip(s.card?.name, 20).toUpperCase() }; break;
      case 'phone': o.date = clip(s.date, 24); o.time = clip(s.time, 6) || '9:41'; if (s.widget) o.widget = { label: clip(s.widget.label, 22), value: clip(s.widget.value, 14) }; o.w1 = /^#[0-9a-f]{6}$/i.test(s.w1) ? s.w1 : undefined; o.w2 = /^#[0-9a-f]{6}$/i.test(s.w2) ? s.w2 : undefined; o.items = (s.items || []).slice(0, 4).map((i) => ({ glyph: glyph(i.glyph), title: clip(i.title, 22), body: clip(i.body, 34) })).filter((i) => i.title); if (o.items.length < 2) continue; break;
      case 'shield': o.glyph = glyph(s.glyph, 'shield'); o.lines = lines(s.lines, 112, 2, 14); break;
      case 'checklist': o.title = clip(s.title, 28); o.accent = s.accent; o.items = (s.items || []).slice(0, 5).map((x) => clip(x, 32)).filter(Boolean); if (o.items.length < 3) continue; break;
      case 'menu': o.title = clip(s.title, 28); o.accent = s.accent; o.rows = (s.rows || []).slice(0, 5).map((r) => ({ name: clip(r.name, 24), price: clip(r.price, 12) })).filter((r) => r.name && r.price); if (o.rows.length < 2) continue; break;
      case 'coupon': o.label = clip(s.label, 24); o.big = clip(s.big, 10); o.size = num(s.size, 160, 260, 230); o.sub = clip(s.sub, 30); o.code = clip(s.code, 12).toUpperCase(); o.note = clip(s.note, 30); if (!o.big) continue; break;
      case 'stats': o.title = clip(s.title, 28); o.items = (s.items || []).slice(0, 3).map((i) => ({ value: String(i.value || '').replace(/[^\d]/g, '').slice(0, 5), suffix: clip(i.suffix, 4), label: clip(i.label, 26) })).filter((i) => i.value && i.label); if (!o.items.length) continue; break;
      case 'location': o.title = clip(s.title, 20) || 'Find us'; o.address = clip(s.address, 60); o.sub = clip(s.sub, 40); if (!o.address) continue; break;
      case 'compare': { const side = (x) => ({ name: clip(x?.name, 22), points: (x?.points || []).slice(0, 3).map((p) => clip(p, 28)).filter(Boolean) }); o.title = clip(s.title, 34); o.accent = s.accent; o.left = side(s.left); o.right = side(s.right); if (o.left.points.length < 2 || o.right.points.length < 2) continue; break; }
      case 'quote': o.text = clip(s.text, 90); o.who = clip(s.who, 30); if (!o.text) continue; break;
      case 'poster': o.lines = (s.lines || []).slice(0, 4).map((l) => clip(l, 11).toUpperCase()).filter(Boolean); o.hot = num(s.hot, 0, 3, o.lines.length - 1); if (o.lines.length < 2) continue; break;
      case 'reel': o.urls = (s.urls || []).filter((u) => urls.has(u)).slice(0, 5); o.lines = lines(s.lines, 140, 2, 16); if (o.urls.length < 2) continue; break;
      case 'deck': o.title = clip(s.title, 28); o.accent = s.accent; o.items = (s.items || []).slice(0, 4).map((i) => ({ glyph: glyph(i.glyph), title: clip(i.title, 22), sub: clip(i.sub, 28) })).filter((i) => i.title); if (o.items.length < 3) continue; break;
      case 'highlight': o.text = clip(s.text, 70); o.hot = (Array.isArray(s.hot) ? s.hot : []).filter(Number.isInteger).slice(0, 4); o.size = num(s.size, 90, 140, 118); if (o.text.split(' ').length < 3) continue; break;
      case 'countdown': o.from = num(s.from, 2, 5, 3); o.lines = lines(s.lines, 200, 2, 14); if (!o.lines.length) continue; break;
      case 'cta': o.tagline = clip(s.tagline, 44); o.button = clip(s.button, 28) || 'Contact us'; o.glyph = glyph(s.glyph, 'arrow'); o.contact = clip(s.contact, 36); o.name = clip(s.name, 28); if (s.logo && urls.has(s.logo)) o.logo = s.logo; break;
      default: continue;
    }
    o.dur = num(s.dur, MIN_DUR[t], 9, MIN_DUR[t] + 0.5);
    out.push(o);
  }
  if (out.length < 3) return null;
  // one cta, last
  const cta = out.filter((s) => s.type === 'cta').pop();
  const body = out.filter((s) => s.type !== 'cta');
  if (!cta) return null;
  // no repeats (except photos)
  const seen = new Set(); const uniq = body.filter((s) => s.type === 'photo' || !seen.has(s.type) && seen.add(s.type));
  const all = [...uniq, cta];
  // fit the time exactly
  const sum = all.reduce((a, s) => a + s.dur, 0);
  const k = duration / sum;
  all.forEach((s) => { s.dur = Math.max(MIN_DUR[s.type] || 3, Math.round(s.dur * k * 20) / 20); });
  let over = all.reduce((a, s) => a + s.dur, 0) - duration;
  for (let i = all.length - 2; over > 0.04 && i >= 0; i--) { const room = all[i].dur - (MIN_DUR[all[i].type] || 3); const cut = Math.min(room, over); all[i].dur = Math.round((all[i].dur - cut) * 20) / 20; over -= cut; }
  all[all.length - 1].dur = Math.round((all[all.length - 1].dur - over) * 20) / 20;
  return finish(all, duration * 7);
}

const baseData = (f, scenes, themeColors, font, world, salt) => {
  const palette = paletteFor(themeColors);
  const seed = (Array.from(`${f.brand}${salt}`).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 2147483646) + 1;
  const ok = (palette.dark ? WORLDS_DARK : WORLDS_LIGHT).includes(world) ? world : pickWorld(palette, f, () => ((seed % 1000) / 1000));
  return { W: 1080, H: 1920, seed, brand: f.brand, font: ['Inter', 'Poppins', 'DM Sans', 'Montserrat', 'Playfair Display'].includes(font) ? font : FONT_FOR_WORLD[ok] || 'Inter', world: ok, palette, scenes };
};

/** Storyboard -> Cinema HTML. Tries Gemini first (when `useAi`), then the rule-based composer. */
export async function directCinema({ plan, brief = null, assets = [], themeColors = {}, images = [], useAi = true, salt = '', avoid = [] }) {
  const f = factsFrom(plan, brief || {}, assets);
  const duration = Math.max(15, Math.round(Number(plan.duration_seconds) || 24));
  const colors = { ...themeColors, ...(plan.style?.colors || {}) };
  let scenes = null, font = null, world = null, concept = '';
  if (useAi) {
    try {
      const assetLines = (assets || []).filter((a) => (a.kind || 'image') === 'image').map((a) => `- url "${a.url}" (${a.role || 'photo'}${a.description ? `, shows: ${a.description}` : ''})`).join('\n') || '- none';
      const wants = [].concat(brief?.scenes || []).filter((id) => WANT_TYPES[id]);
      const wantLine = wants.length ? `\n\nTHE OWNER CHOSE THESE SCENE STYLES (you MUST include a scene of each, adapted to this business; scene types: ${wants.map((id) => `${id} -> ${WANT_TYPES[id].join(' or ')}`).join('; ')}). You may add other scenes around them.` : '';
      const facts = { name: f.brand, category: f.cat, goal: f.goal, messages: f.headlines, products: f.products, strengths: f.features, actions: f.ctas, contact: f.phone, special: plan.special_instructions || brief?.extra || '' };
      const { text } = await geminiGenerate({
        system: system({ duration }),
        messages: [{ role: 'user', images, text: `THE BUSINESS (facts you may use): ${JSON.stringify(facts)}\n\nASSETS (use exact urls):\n${assetLines}\n\nPALETTE: ${JSON.stringify(colors)}${wantLine}${avoid.length ? `\n\nTHE LAST VERSION USED THESE SCENES (make this one clearly different): ${avoid.join(', ')}` : ''}\n\nDirect the video. ${duration} seconds.` }],
        model: MODEL, temperature: 1, maxOutputTokens: 12000, json: true, timeoutMs: 90000, thinking: 'medium',
      });
      const m = String(text).match(/\{[\s\S]*\}/);
      const j = JSON.parse(m[0]);
      scenes = sanitizeScenes(j.scenes, { duration, assets });
      font = j.font; world = j.world; concept = clip(j.concept, 160);
    } catch (e) { console.warn('[cinema] director failed, using the composer:', e.message); }
  }
  const aiScenes = !!scenes;
  if (!scenes) { const c = composeCinema(plan, { brief: brief || {}, assets, salt, palette: paletteFor(colors) }); scenes = c.scenes; world = c.world; font = c.font; }
  const data = baseData(f, scenes, colors, font, world, salt);
  return { html: cinemaHtml(data), data, concept, source: aiScenes ? 'gemini' : 'template' };
}

/** Plain-words edit of a Cinema video: Gemini gets the current storyboard and returns a new one. */
export async function cinemaEdit({ html, instruction, assets = [], images = [], history = [] }) {
  const data = readCinema(html);
  if (!data?.scenes) throw new Error('Not a Cinema video');
  const duration = Math.round(data.scenes.reduce((a, s) => a + s.dur, 0));
  const past = (history || []).filter((h) => h.role === 'user').slice(-6).map((h) => `- ${h.text}`).join('\n');
  const assetLines = (assets || []).filter((a) => (a.kind || 'image') === 'image').map((a) => `- url "${a.url}" (${a.role || 'photo'})`).join('\n') || '- none';
  const { text } = await geminiGenerate({
    system: `${system({ duration })}\n\nYOU ARE EDITING AN EXISTING VIDEO. You get its current storyboard and the user's change request. Return { "scenes": [the FULL updated list], "colors"?: { "primary"?, "secondary"?, "background"? } (hex), "summary": "one short sentence of what you changed" }. Do everything asked in this one edit; change only what was asked; keep the rest exactly as it is. Keep the total at ${duration} seconds unless asked for another length.`,
    messages: [{ role: 'user', images, text: `CURRENT STORYBOARD:\n${JSON.stringify(data.scenes)}\n\nASSETS:\n${assetLines}${past ? `\n\nEARLIER REQUESTS (already done; keep them):\n${past}` : ''}\n\nCHANGE REQUEST: ${instruction}` }],
    model: MODEL, temperature: 0.5, maxOutputTokens: 12000, json: true, timeoutMs: 90000, thinking: 'medium',
  });
  const j = JSON.parse(String(text).match(/\{[\s\S]*\}/)[0]);
  const scenes = sanitizeScenes(j.scenes, { duration, assets });
  if (!scenes) throw new Error('The edit returned no usable scenes');
  let palette = data.palette;
  const c = j.colors || {};
  if (c.primary || c.secondary || c.background) palette = paletteFor({ primary: c.primary, secondary: c.secondary, background: c.background });
  const world = (palette.dark ? WORLDS_DARK : WORLDS_LIGHT).includes(j.world) ? j.world : (data.world || 'studio');
  return { html: cinemaHtml({ ...data, scenes, palette, world }), summary: clip(j.summary, 200) || 'Done! Check the preview.' };
}
