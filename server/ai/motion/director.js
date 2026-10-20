// The Motion AI director: Gemini writes a beat-by-beat storyboard for THIS business, in the style of
// Apple-like product films. Everything it returns is cleaned (known beats, clipped text, real asset urls,
// sane seconds) before it is animated. If Gemini is off or fails, composeMotion() writes the storyboard.
import { geminiGenerate } from '../../engine/gemini.js';
import { fixPrices, factsFrom } from '../cinema/compose.js';
import { composeMotion, accentFor, BEAT_MIN, BEAT_MAX, MOTION_WANTS, FONTS } from './compose.js';
import { motionHtml, readMotion } from './page.js';

const MODEL = process.env.GEMINI_DIRECTOR_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-flash-latest';
export const SIZES = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080], '4:5': [1080, 1350] };
const GLYPHS = ['check', 'bolt', 'heart', 'star', 'bag', 'clock', 'pin', 'chat', 'phone', 'card', 'gift', 'sparkle', 'leaf', 'shield', 'truck', 'cake', 'cup', 'scissors', 'home', 'book', 'chart', 'search', 'tag', 'wifi', 'smile', 'car', 'dumbbell', 'shirt', 'tooth', 'globe', 'money'];
const BGS = ['light', 'dark', 'brand'];
const OUTS = ['push', 'whip', 'zoom', 'rise', 'drop', 'fade'];
const clip = (s, n) => fixPrices(String(s == null ? '' : s).replace(/\s+/g, ' ').trim()).slice(0, n).trim();
const num = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };
const idx = (a, n = 4) => (Array.isArray(a) ? a.filter(Number.isInteger).filter((x) => x >= 0 && x < 40).slice(0, n) : []);
const glyph = (g, fb = 'check') => (GLYPHS.includes(g) ? g : fb);

export const BEAT_GUIDE = `BEAT LIBRARY. Every beat: { "type", "dur" (seconds), "bg": "light"|"dark"|"brand", "out": "push"|"whip"|"zoom"|"rise"|"drop"|"fade", ...fields }.
Glyph names: ${GLYPHS.join(', ')}.
- words: lines [1-3 strings, max 24 chars each], accent [word indexes counted across all lines: the 1-2 words that matter, shown in the brand colour], mode "build" (default: a sentence written word by word) | "slam" (1-5 short words, one huge word at a time) | "glow" (a quiet glowing statement; bg must be "dark"), sub? (a small grey line under it, max 40).
- icon: the brand's app icon (their logo when they gave one). mode "wordmark" (icon slides aside and the name appears) | "welcome" (prefix words then the icon: prefix "Welcome to" / "Meet" / "Say hello to") | "solo"; tagline? (max 34), accent? [word idx of the tagline].
- photos: urls [1-5 EXACT photo urls from the asset list], lines [1-2 short lines], accent?. Their photos floating in depth; the camera glides through. USE THEIR PHOTOS when they have any.
- grid: urls [4-9 exact photo urls], text? (max 30). A tidy photo grid that tilts away in 3D.
- price: label? ("Only" / "Now" / "From" / "Tickets"), value ("₦2,500" or "30% OFF"), sub? (what it is), old? (an old price to strike out, only if given). A giant rolling number. ONLY a real price or offer.
- receipt: title ("Your order"), items [{name, price}] (2-5, REAL products and prices), total? (their sum, only if all prices are known), button? (the call to action). A clean order card; a cursor taps the button.
- stack: title?, accent?, items [{t (max 24), s? (max 24, e.g. the price), glyph}] (2-4). Pastel cards that stack up.
- toggles: title?, accent?, items [2-5 strings, max 26]. An iOS settings card; each strength switches on.
- swap: lead?, accent?, items [2-4 strings, max 20]. A button-pill whose words roll through the list.
- orbit: items [{t (max 16), glyph}] (3-6). The brand icon in the centre, tiles fly in around it.
- steps: title?, accent?, items [{t (max 20), s? (max 30), glyph}] (exactly 3). Cards joined by a line that draws through them.
- notif: items [{title? (default: brand), body (max 70), time? ("now", "2m ago")}] (1-2), lead?. iOS notifications dropping in.
- chat: messages [{from: "me" (the customer) | "biz", text (max 60)}] (2-4). A WhatsApp chat; the business types back.
- search: lead? ("So you search…"), query (max 34, what a customer would type, e.g. "cake shop in ikeja"), title? (brand), sub? (category · area), button? ("Open"/"Call"/"Book"). The business is the answer.
- map: label? ("Find us"), address (street, max 32), sub? (area, city), area? (a district name for the map label), area2?. A pin drops on a clean city map. ONLY a real address.
- calendar: lead? ("Save the date"), accent?, month ("Dec"), day ("14"), title, time? ("8pm"), place?. ONLY a real date.
- countdown: reveal (max 14: "Now open", "It's here"), sub?. 3-2-1 then the reveal. For launches, openings, events.
- highlight: text (a 4-9 word sentence), hot [word indexes to select]. A text selection sweeps over the key words.
- stat: value ("2,000+"), label ("Happy clients"), sub?, lead?. A number card. ONLY a real number.
- ring: value ("30", "24h"), label ("Under 30 minutes"), sub?, fill (0.5-1). A progress ring card. ONLY a real time/number.
- quote: text (max 120), name. ONLY a real customer review they gave.
- phone: text? (max 34). A 3D phone; their app icon gets a badge. Best for apps and online services.
- button: lead? (max 22, e.g. "Ready?"), accent?, label (THE call to action, max 26), done? ("Sent", "Booked", "Calling…"), glyph, sub? (phone / handle). A cursor presses a real button.
- end: tagline? (max 40), accent?, contact? (phone / @handle / website), contactGlyph ("phone"|"search"|"globe"|"pin"). Icon + name + tagline + contact. ALWAYS the last beat.`;

const system = ({ duration, aspect }) => `You are the director of premium product films, in the style of Apple's motion graphics and the best TikTok ad studios: clean white or black stages, ONE idea per beat, sentences that build word by word with one word in the brand colour, real-looking UI objects (app icons, notifications, buttons pressed by a cursor, search bars, maps, order cards), springy physics and fast blurred moves, and a logo end card. You invent a storyboard that is UNIQUE to this business. Never a generic formula.

YOU ARE ALSO THE COPY EDITOR. People type messily: typos, ALL CAPS, slang, broken English, repeated or nonsensical phrases, prices like N5000 / 5k / 5000 naira / "zobo 700". Make every word on screen correct, natural and premium:
- Fix spelling, grammar and capitalisation. Turn fragments into short, confident ad lines that a stranger instantly understands. Keep the meaning.
- Drop gibberish. Never copy a messy phrase as it is. Never repeat the same line in two beats.
- Prices as "₦5,000". Names, prices, phone numbers, handles and addresses must stay EXACTLY right.

HOW TO DIRECT
1. Find the one idea this business should be remembered for, then build the film around it.
2. Shape: a hook that stops the thumb (words build / slam / glow, or countdown for launches and events) -> the brand (icon) -> 3-6 beats of proof with real objects and their photos -> a button beat with the real call to action -> the end card.
3. Rhythm: mostly "${duration <= 20 ? 'light' : 'light or dark (pick one theme)'}" stages with one or two contrasting beats; at most ONE "brand" (brand-colour) beat besides the end. Vary the "out" transitions; never the same twice in a row.
4. Keep text short. Each beat says one thing.
5. NEVER invent facts: no made-up prices, ratings, review counts, customer numbers, delivery times, dates, addresses or awards. Use only what the business told you. Story beats (a chat, steps, a search) are fine when they use the business's real details.
6. Use their photos (photos / grid) and their logo appears automatically in icon, notif, search and end beats.
7. The film is ${aspect} and exactly ${duration} seconds: the "dur" values must add up to ${duration}. Minimum seconds per beat: ${Object.entries(BEAT_MIN).map(([k, v]) => `${k} ${v}`).join(', ')}. About one beat per 2.5-3.5 seconds.

${BEAT_GUIDE}

FONTS: ${FONTS.join(', ')}.

Return ONLY JSON: { "concept": "one sentence: the idea", "font": "...", "beats": [ ... ] }`;

const strs = (a, n, len) => (Array.isArray(a) ? a : []).map((x) => clip(x, len)).filter(Boolean).slice(0, n);

/** Clean beats from the AI (or a hand edit). Returns beats or null. */
export function sanitizeBeats(raw, { duration, assets = [] } = {}) {
  const urls = new Set((assets || []).map((a) => a.url));
  const out = [];
  for (const b of Array.isArray(raw) ? raw : []) {
    const t = String(b?.type || '');
    if (!(t in BEAT_MIN)) continue;
    const o = { type: t, bg: BGS.includes(b.bg) ? b.bg : 'light', out: OUTS.includes(b.out) ? b.out : 'push', dur: num(b.dur, BEAT_MIN[t], BEAT_MAX[t] * 1.5, BEAT_MIN[t] + 0.4) };
    if (t === 'words') { o.lines = strs(b.lines, 3, 26); if (!o.lines.length) continue; o.accent = idx(b.accent, 3); o.mode = ['build', 'slam', 'glow'].includes(b.mode) ? b.mode : 'build'; if (o.mode === 'glow') o.bg = 'dark'; if (b.sub) o.sub = clip(b.sub, 44); }
    else if (t === 'icon') { o.mode = ['wordmark', 'welcome', 'solo'].includes(b.mode) ? b.mode : 'wordmark'; if (b.prefix) o.prefix = clip(b.prefix, 16); if (b.tagline) o.tagline = clip(b.tagline, 36); o.accent = idx(b.accent, 2); }
    else if (t === 'photos') { o.urls = (b.urls || []).filter((u) => urls.has(u)).slice(0, 5); if (!o.urls.length) continue; o.lines = strs(b.lines, 2, 30); o.accent = idx(b.accent, 2); }
    else if (t === 'grid') { o.urls = (b.urls || []).filter((u) => urls.has(u)).slice(0, 9); if (o.urls.length < 4) continue; if (b.text) o.text = clip(b.text, 32); }
    else if (t === 'price') { o.value = clip(b.value, 14); if (!/\d|free/i.test(o.value)) continue; ['label', 'sub', 'old'].forEach((k) => { if (b[k]) o[k] = clip(b[k], k === 'sub' ? 34 : 14); }); }
    else if (t === 'receipt') { o.items = (b.items || []).filter((x) => x && typeof x === 'object').map((x) => ({ name: clip(x.name, 28), price: clip(x.price, 14) })).filter((x) => x.name).slice(0, 5); if (o.items.length < 2) continue; ['title', 'total', 'button'].forEach((k) => { if (b[k]) o[k] = clip(b[k], 28); }); }
    else if (t === 'stack' || t === 'steps') { o.items = (b.items || []).map((x) => (typeof x === 'string' ? { t: x } : x && typeof x === 'object' ? x : {})).map((x) => ({ t: clip(x.t ?? x.title ?? '', 26), s: clip(x.s ?? x.sub ?? '', 30), glyph: glyph(x.glyph) })).filter((x) => x.t).slice(0, t === 'steps' ? 3 : 4); if (o.items.length < (t === 'steps' ? 3 : 2)) continue; if (b.title) o.title = clip(b.title, 26); o.accent = idx(b.accent, 2); }
    else if (t === 'toggles') { o.items = strs(b.items, 5, 28); if (o.items.length < 2) continue; if (b.title) o.title = clip(b.title, 26); o.accent = idx(b.accent, 2); }
    else if (t === 'swap') { o.items = strs(b.items, 4, 22); if (o.items.length < 2) continue; if (b.lead) o.lead = clip(b.lead, 26); o.accent = idx(b.accent, 2); }
    else if (t === 'orbit') { o.items = (b.items || []).map((x) => (typeof x === 'string' ? { t: x } : x && typeof x === 'object' ? x : {})).map((x) => ({ t: clip(x.t ?? x.title ?? '', 18), glyph: glyph(x.glyph, 'star') })).filter((x) => x.t).slice(0, 6); if (o.items.length < 3) continue; }
    else if (t === 'notif') { o.items = (b.items || []).map((x) => (typeof x === 'string' ? { body: x } : x && typeof x === 'object' ? x : {})).map((x) => ({ title: clip(x.title, 28) || undefined, body: clip(x.body, 76), time: clip(x.time, 10) || undefined })).filter((x) => x.body).slice(0, 2); if (!o.items.length) continue; if (b.lead) o.lead = clip(b.lead, 26); }
    else if (t === 'chat') { o.messages = (b.messages || []).filter((m) => m && typeof m === 'object').map((m) => ({ from: m.from === 'biz' ? 'biz' : 'me', text: clip(m.text, 64) })).filter((m) => m.text).slice(0, 4); if (o.messages.length < 2) continue; }
    else if (t === 'search') { o.query = clip(b.query, 34); if (!o.query) continue; ['lead', 'title', 'sub', 'button'].forEach((k) => { if (b[k]) o[k] = clip(b[k], k === 'button' ? 10 : 34); }); }
    else if (t === 'map') { o.address = clip(b.address, 34); if (!o.address) continue; ['label', 'sub', 'area', 'area2'].forEach((k) => { if (b[k]) o[k] = clip(b[k], k === 'label' ? 14 : 34); }); }
    else if (t === 'calendar') { o.day = clip(b.day, 2); o.month = clip(b.month, 3); if (!/^\d{1,2}$/.test(o.day) || !o.month) continue; ['lead', 'title', 'time', 'place'].forEach((k) => { if (b[k]) o[k] = clip(b[k], 36); }); o.accent = idx(b.accent, 2); }
    else if (t === 'countdown') { o.reveal = clip(b.reveal, 16) || 'Now open'; if (b.sub) o.sub = clip(b.sub, 30); }
    else if (t === 'highlight') { o.text = clip(b.text, 60); if (o.text.split(' ').length < 3) continue; o.hot = idx(b.hot, 3); if (!o.hot.length) o.hot = [o.text.split(' ').length - 1]; }
    else if (t === 'stat') { o.value = clip(b.value, 10); if (!/\d/.test(o.value)) continue; o.label = clip(b.label, 24); ['sub', 'lead'].forEach((k) => { if (b[k]) o[k] = clip(b[k], 30); }); o.accent = idx(b.accent, 2); }
    else if (t === 'ring') { o.value = clip(b.value, 6); if (!/\d/.test(o.value)) continue; o.label = clip(b.label, 24); if (b.sub) o.sub = clip(b.sub, 28); o.fill = num(b.fill, 0.3, 1, 0.82); }
    else if (t === 'quote') { o.text = clip(b.text, 120); if (!o.text) continue; o.name = clip(b.name, 24); }
    else if (t === 'phone') { if (b.text) o.text = clip(b.text, 36); }
    else if (t === 'button') { o.label = clip(b.label, 28); if (!o.label) continue; ['lead', 'done', 'sub'].forEach((k) => { if (b[k]) o[k] = clip(b[k], k === 'sub' ? 34 : 22); }); o.glyph = glyph(b.glyph, 'chat'); o.accent = idx(b.accent, 2); }
    else if (t === 'end') { ['tagline', 'contact'].forEach((k) => { if (b[k]) o[k] = clip(b[k], 42); }); o.accent = idx(b.accent, 2); o.contactGlyph = ['phone', 'search', 'globe', 'pin'].includes(b.contactGlyph) ? b.contactGlyph : 'phone'; }
    out.push(o);
  }
  if (out.length < 3) return null;
  // exactly one end card, last; no two identical beat types in a row (except words)
  const ends = out.filter((b) => b.type === 'end');
  let beats = out.filter((b) => b.type !== 'end');
  beats = beats.filter((b, i) => i === 0 || b.type === 'words' || b.type !== beats[i - 1].type);
  beats.push(ends[0] || { type: 'end', bg: 'brand', out: 'push', dur: BEAT_MIN.end + 0.5 });
  // fit the total length: scale, but never below a beat's minimum
  const total = beats.reduce((a, b) => a + b.dur, 0);
  if (duration) {
    while (beats.reduce((a, b) => a + BEAT_MIN[b.type], 0) > duration && beats.length > 3) beats.splice(beats.length - 2, 1);
    let k = duration / total;
    beats.forEach((b) => { b.dur = Math.max(BEAT_MIN[b.type], b.dur * k); });
    const t2 = beats.reduce((a, b) => a + b.dur, 0);
    const flex = beats.map((b) => b.dur - BEAT_MIN[b.type]); const fsum = flex.reduce((a, b) => a + b, 0);
    if (t2 > duration && fsum > 0) beats.forEach((b, i) => { b.dur -= (t2 - duration) * (flex[i] / fsum); });
    else if (t2 < duration) beats[beats.length - 1].dur += duration - t2;
  }
  beats.forEach((b) => { b.dur = Math.round(b.dur * 100) / 100; });
  return beats;
}

const seedOf = (s) => (Array.from(String(s)).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 2147483646) + 1;

/** Storyboard -> Motion HTML. Tries Gemini first (when `useAi`), then the rule-based composer. */
export async function directMotion({ plan, brief = null, assets = [], themeColors = {}, images = [], useAi = true, salt = '', avoid = [] }) {
  const aspect = SIZES[plan.aspect_ratio] ? plan.aspect_ratio : '9:16';
  const [W, H] = SIZES[aspect];
  const duration = Math.max(10, Math.round(Number(plan.duration_seconds) || 24));
  const colors = { ...themeColors, ...(plan.style?.colors || {}) };
  const rules = composeMotion(plan, { brief: brief || {}, assets, salt, avoid, colors });
  const logo = (assets || []).find((a) => (a.kind || 'image') === 'image' && (a.role === 'logo' || /logo/i.test(a.name || '')));
  let beats = null, font = rules.font, concept = '';
  if (useAi) {
    try {
      const f = factsFrom(plan, brief || {}, assets);
      const facts = { brand: rules.brand, category: f.cat, messages: f.headlines, strengths: f.features, products: f.products, call_to_action: f.cta, contact: f.phone, address: f.address, goal: f.goal, offer: brief?.offer, when: brief?.when, extra: brief?.extra, pasted: brief?.pasteText ? String(brief.pasteText).slice(0, 2500) : undefined };
      const assetLines = (assets || []).filter((a) => (a.kind || 'image') === 'image').map((a) => `- url "${a.url}" (${a.role || 'photo'}${a.description ? `, shows: ${a.description}` : ''})`).join('\n') || '- none';
      const wants = [].concat(brief?.scenes || []).filter((id) => MOTION_WANTS[id]);
      const wantLine = wants.length ? `\n\nTHE OWNER CHOSE THESE BEATS (include each, adapted to this business): ${wants.map((id) => `${id} -> ${MOTION_WANTS[id].join(' or ')}`).join('; ')}.` : '';
      const { text } = await geminiGenerate({
        system: system({ duration, aspect }),
        messages: [{ role: 'user', images, text: `THE BUSINESS (facts you may use, typed by the owner; clean them up): ${JSON.stringify(facts)}\n\nASSETS (use exact urls):\n${assetLines}${wantLine}${avoid.length ? `\n\nTHE LAST VERSION USED THESE BEATS (make this one clearly different): ${avoid.join(', ')}` : ''}\n\nA rule-based draft you may improve on or ignore: ${JSON.stringify(rules.beats.map((b) => b.type))}\n\nDirect the film. ${duration} seconds, ${aspect}.` }],
        model: MODEL, temperature: 1, maxOutputTokens: 12000, json: true, timeoutMs: 90000, thinking: 'medium',
      });
      const j = JSON.parse(String(text).match(/\{[\s\S]*\}/)[0]);
      beats = sanitizeBeats(j.beats, { duration, assets });
      if (FONTS.includes(j.font)) font = j.font;
      concept = clip(j.concept, 160);
    } catch (e) { console.warn('[motion] director failed, using the composer:', e.message); }
  }
  const aiBeats = !!beats;
  if (!beats) beats = rules.beats;
  // sound: 'all'/'sfx' = effects, 'none' = silent, 'own' = the owner's track (+ effects), 'piano'/'soft' = a library track
  const sound = plan.sound || (plan.sfx === false ? 'none' : 'sfx');
  const music = sound === 'own' && plan.music_url ? { url: plan.music_url } : sound === 'piano' || sound === 'soft' ? { url: `/music/${sound}.mp3`, builtin: sound } : null;
  const data = { W, H, seed: seedOf(`${rules.brand}${salt}`), brand: rules.brand, logo: logo?.url || null, font, accent: rules.accent, beats, sound: sound === 'none' ? 'none' : 'on', music };
  return { html: motionHtml(data), data, concept, source: aiBeats ? 'gemini' : 'template' };
}

/** Plain-words edit of a Motion film: Gemini gets the storyboard and returns a new one. */
export async function motionEdit({ html, instruction, assets = [], images = [], history = [] }) {
  const data = readMotion(html);
  if (!data?.beats) throw new Error('Not a Motion video');
  const duration = Math.round(data.beats.reduce((a, s) => a + s.dur, 0));
  const aspect = Object.entries(SIZES).find(([, [w, h]]) => w === data.W && h === data.H)?.[0] || '9:16';
  const past = (history || []).filter((h) => h.role === 'user').slice(-6).map((h) => `- ${h.text}`).join('\n');
  const assetLines = (assets || []).filter((a) => (a.kind || 'image') === 'image').map((a) => `- url "${a.url}" (${a.role || 'photo'})`).join('\n') || '- none';
  const { text } = await geminiGenerate({
    system: `${system({ duration, aspect })}\n\nYOU ARE EDITING AN EXISTING FILM. You get its storyboard and the owner's change request. Return { "beats": [the FULL updated list], "accent"?: "#hex" (only if they asked for another colour), "font"?: "...", "summary": "one short sentence of what you changed" }. Do everything asked in this one edit; change only what was asked; keep everything else exactly as it is. Keep the total at ${duration} seconds unless asked for another length.`,
    messages: [{ role: 'user', images, text: `CURRENT STORYBOARD:\n${JSON.stringify(data.beats)}\n\nASSETS:\n${assetLines}${past ? `\n\nEARLIER REQUESTS (already done; keep them):\n${past}` : ''}\n\nCHANGE REQUEST: ${instruction}` }],
    model: MODEL, temperature: 0.5, maxOutputTokens: 12000, json: true, timeoutMs: 90000, thinking: 'medium',
  });
  const j = JSON.parse(String(text).match(/\{[\s\S]*\}/)[0]);
  const want = /(\d{2,3})\s*(s|sec|seconds)\b/i.exec(instruction);
  const beats = sanitizeBeats(j.beats, { duration: want ? Number(want[1]) : duration, assets });
  if (!beats) throw new Error('The edit returned no usable beats');
  const accent = /^#[0-9a-f]{6}$/i.test(j.accent || '') ? j.accent : data.accent;
  const font = FONTS.includes(j.font) ? j.font : data.font;
  return { html: motionHtml({ ...data, beats, accent, font }), summary: clip(j.summary, 200) || 'Done! Check the preview.' };
}

/** Small edits that work without the AI (the practice mode): colour, speed, text size is not a thing here. */
export function motionOfflineEdit(html, instruction) {
  const data = readMotion(html);
  if (!data?.beats) return null;
  const t = String(instruction || '').toLowerCase();
  const changes = [];
  const COLORS = { red: '#E5383B', blue: '#2F6BFF', green: '#16A34A', orange: '#F97316', purple: '#7C3AED', pink: '#DB2777', yellow: '#EAB308', gold: '#C9A227', black: '#111111', teal: '#0D9488', brown: '#8B5E34', navy: '#1E3A8A' };
  const hexm = t.match(/#[0-9a-f]{6}/i);
  const cm = Object.keys(COLORS).find((c) => new RegExp(`\\b${c}\\b`).test(t));
  if (hexm || (cm && /colou?r|accent|brand|make it|change/.test(t))) { data.accent = hexm ? hexm[0] : COLORS[cm]; changes.push('the brand colour'); }
  if (/dark|black background|night/.test(t) && /background|theme|mode|make it/.test(t)) { data.beats.forEach((b) => { if (b.bg === 'light') b.bg = 'dark'; }); changes.push('dark backgrounds'); }
  else if (/light|white background|bright/.test(t) && /background|theme|mode|make it/.test(t)) { data.beats.forEach((b) => { if (b.bg === 'dark' && b.mode !== 'glow') b.bg = 'light'; }); changes.push('light backgrounds'); }
  if (/faster|quicker|speed up|shorter/.test(t)) { data.beats.forEach((b) => { b.dur = Math.max(BEAT_MIN[b.type], Math.round(b.dur * 0.85 * 100) / 100); }); changes.push('a faster pace'); }
  else if (/slower|slow down|longer/.test(t)) { data.beats.forEach((b) => { b.dur = Math.round(Math.min(BEAT_MAX[b.type] * 1.4, b.dur * 1.15) * 100) / 100; }); changes.push('a slower pace'); }
  if (!changes.length) return null;
  return { html: motionHtml(data), changes };
}

export { accentFor };
