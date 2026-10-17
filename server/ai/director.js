// AI director: Gemini directs the video SHOT BY SHOT using the Animora motion engine's shot vocabulary.
//
// Instead of asking Gemini to write a whole HTML/GSAP file (slow, fragile, often rejected by the validator,
// which used to drop users onto the rule-based template), Gemini returns a short JSON list of beats:
//   [{ shot: "logo", seconds: 2.4, text: "TechDesk", cut: "dive" }, { shot: "chat", ... }, ...]
// We check every beat, fix what we can, and the in-house runtime animates it. This is fast (one small
// response), always renders, and follows the user's own instructions ("zoom into the logo", "show prices big").
// Edits work the same way: Gemini gets the current beats and the instruction, and returns the new beats.

import { geminiGenerate } from '../engine/gemini.js';
import { THEMES } from './themes.js';
import { SHOT_VALID, ICON_NAMES, iconFor, priceOf, templateFromPlan } from './templates.js';

const DIRECTOR_MODEL = process.env.GEMINI_DIRECTOR_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-flash-latest';

// What each shot looks like and which fields it uses. Shown to Gemini, and used to clean its answer.
export const SHOTS = {
  logo: { f: 'text?, sub?', d: 'the business LOGO big in the centre, rings pulse out, name rises below. Needs an uploaded logo. Follow it with cut "dive" to zoom the camera INTO the logo.' },
  sentence: { f: 'text, sub?', d: 'premium: a short sentence builds word by word, the last word in the accent colour (letters drop in).' },
  flip: { f: 'text (2-6 words)', d: 'words replace each other one at a time in the centre ("Introducing" / "TechDesk" / "AI").' },
  scatter: { f: 'text (2-6 words), sub?', d: 'words start scattered round the frame then fly together into one line.' },
  words: { f: 'text, sub?', d: 'a bold headline rising word by word.' },
  kinetic: { f: 'text (2-7 words)', d: 'big/small lines sliding in from alternating sides with motion blur. Loud.' },
  zoomword: { f: 'text (1-3 words, max 16 letters), sub?', d: 'one giant punch word zooming at the camera with outline echoes. Loud.' },
  type: { f: 'text (max 42 chars), sub?', d: 'text typed letter by letter inside a selection box with a cursor.' },
  brand: { f: 'text (brand name), subs? (2-3 short chips)', d: 'brand mark pops then slides up as the name rises; chips below.' },
  iconmorph: { f: 'text, sub?, icon', d: 'an app icon opens into a widget card with a progress bar, then folds back.' },
  notify: { f: 'text, subs (1-2 more messages)', d: 'the logo morphs into a phone notification with the message; more notifications drop in.' },
  isocard: { f: 'number? or price?, text', d: 'a glowing card floats over a 3D platform, then flips flat into a stat tile showing the number/price.' },
  stat: { f: 'number (e.g. "24/7", "10K+", "98%"), text', d: 'a 3D slab with a big number and a label.' },
  counter: { f: 'price (number), text?', d: 'the price rolls like an odometer inside a ring that draws itself.' },
  card: { f: 'text, price?, subs?, icon, button?', d: 'a dot grows into a pill then a rounded UI card with icon, title, price.' },
  hero: { f: 'img (asset name), text, price?, full? (true = full-screen photo background)', d: 'a product photo flies in with a 3D turn; text and optional price chip.' },
  collage: { f: 'text, imgs? (3-8 asset names), items?', d: 'a ring of photos / icon tiles drifting round a short line of text.' },
  split: { f: 'text, sub?, icon', d: 'a colour panel slides over half the frame with a big icon in a white circle; text on the other half.' },
  orbit: { f: 'text, items (3-8)', d: 'chips with icons orbiting round the title.' },
  pills: { f: 'items (2-5, with price?), title?', d: 'tilted menu pills sliding in with blur.' },
  stack: { f: 'items (2-4), title?', d: 'premium: buttons stacking upward, each rising from behind the last.' },
  wheel: { f: 'items (2+)', d: 'a scroll-wheel list ticking through items, active row highlighted.' },
  ticker: { f: 'items (3-6)', d: 'premium: brand mark + caret + a list that ticks upward, active line glowing.' },
  widgets: { f: 'items (2-3, with price? and icon), title?', d: 'premium: watch-style tiles split apart with filling rings.' },
  flow: { f: 'items (2-3), title?', d: 'steps as cards joined by glowing light lines with a pulse.' },
  grid: { f: 'items (3-6, with icon), title?', d: 'icon tiles popping into a grid.' },
  phone: { f: 'items (2-5, with price?), button?, title?', d: 'a phone mockup rises in 3D; its screen fills with the rows and an order button.' },
  chat: { f: 'text (customer message), sub? (business reply)', d: 'a chat: the message is typed, sent, and the business replies.' },
  lockup: { f: 'text (brand name), subs (1-2 details: address, website), button (the action with phone/link)', d: 'final call to action: logo, divider, name, details; a cursor clicks the button.' },
};
export const CUTS = {
  whip: 'fast sideways motion-blur whip', rise: 'vertical motion-blur push', zoom: 'zoom-through', morph: 'collapse into a dot and burst out',
  line: 'a glowing line draws across', wipe: 'two-colour panel wipe', flash: 'white flash with camera punch',
  swoosh: 'a thick curved ribbon swoops across', dive: 'camera dives INTO the key word or the logo', focus: 'soft blur-focus dissolve',
};
const CUT_D = { wipe: 0.34, dive: 0.42, swoosh: 0.36 };

// Creative concepts: each video gets a different one, so two ads never share the same structure.
export const CONCEPTS = [
  'Product demo: the business shown as a sleek app/UI story (notifications, cards, chat, widgets, phone)',
  'Kinetic typography: the message carried by bold moving words, flips and scatters, minimal props',
  'Cinematic photo-led: the uploaded photos are the heroes, big and dramatic, with short punchy lines',
  'Countdown / numbers: stats, prices and counters drive the story with rolling digits and stat tiles',
  'Customer story: a customer question in a chat, the problem, then the business as the answer',
  'Editorial minimal: calm, lots of space, one strong word at a time, elegant dissolves and dives',
  'Pop energy: loud colours, punch words zooming, whips, flashes, fast rhythm',
  'Brand reveal: the logo and name are built up piece by piece, then the offer, then the call to action',
];
const AMBIENT = ['glow', 'grid', 'dots', 'streaks', 'beams', 'rays', 'halftone', 'waves', 'particles', 'confetti', 'sparkles', 'bubbles', 'frame', 'marquee'];

/** The per-video look chosen by the director (background layers, text entrance, accent, energy, camera drift). */
export function sanitizeLook(look) {
  if (!look || typeof look !== 'object') return null;
  const out = {};
  const amb = (Array.isArray(look.ambient) ? look.ambient : []).filter((x) => AMBIENT.includes(x)).slice(0, 3);
  if (amb.length) out.ambient = amb;
  if (['rise', 'blur', 'slide', 'focus'].includes(look.textIn)) out.textIn = look.textIn;
  if (['marker', 'color'].includes(look.accentStyle)) out.accentStyle = look.accentStyle;
  const e = Number(look.energy); if (e >= 1 && e <= 3) out.energy = Math.round(e);
  const d = Number(look.drift); if (d >= 0 && d <= 1.5) out.drift = d;
  if (look.sound === 'off') out.sound = 'off';
  if (['calm', 'pulse', 'warm', 'cinematic', 'bright'].includes(look.music)) out.music = look.music;
  return Object.keys(out).length ? out : null;
}

const str = (v, max = 90) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, max));
const num = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const p = priceOf(String(v ?? ''));
  if (p) return p.value;
  const n = Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

function findAsset(ref, images) {
  const key = String(ref || '').toLowerCase().trim();
  if (!key) return null;
  return images.find((a) => a.url === ref || String(a.name).toLowerCase() === key)
    || images.find((a) => String(a.name).toLowerCase().includes(key) || key.includes(String(a.name).toLowerCase()))
    || (key === 'logo' ? images.find((a) => a.role === 'logo') : null);
}

/**
 * Turn Gemini's beat list into beats the runtime can always draw.
 * Unknown shots, missing fields and bad timings are repaired; returns null if nothing usable is left.
 */
export function sanitizeBeats(raw, { duration, assets = [], plan = {}, calm = false } = {}) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.beats) ? raw.beats : null;
  if (!list?.length) return null;
  const images = assets.filter((a) => (a.kind || 'image') === 'image');
  const logo = images.find((a) => a.role === 'logo') || images.find((a) => /logo/i.test(a.name || ''));
  const maxBeats = Math.max(3, Math.floor(duration / 1.1));
  const brand = str(plan.business?.name, 40);
  const cleanItems = (items) => (Array.isArray(items) ? items : []).slice(0, 8).map((it) => {
    const o = typeof it === 'string' ? { text: it } : (it || {});
    const text = str(o.text || o.name || o.label, 40);
    const price = num(o.price);
    const icon = ICON_NAMES.includes(o.icon) ? o.icon : iconFor(text, 'check');
    return text ? { text, name: text, ...(price != null ? { price } : {}), icon } : null;
  }).filter(Boolean);

  let beats = list.slice(0, maxBeats).map((b) => {
    if (!b || typeof b !== 'object') return null;
    const shot = String(b.shot || '').toLowerCase();
    const o = {
      shot,
      seconds: Math.max(0.9, Math.min(8, Number(b.seconds ?? b.duration) || 2)),
      text: str(b.text), sub: str(b.sub, 120),
      subs: (Array.isArray(b.subs) ? b.subs : b.subs ? [b.subs] : []).map((x) => str(x, 60)).filter(Boolean).slice(0, 3),
      items: cleanItems(b.items),
      button: str(b.button, 44),
      title: str(b.title, 50),
      number: str(b.number, 14),
      cut: CUTS[b.cut] ? b.cut : null,
    };
    const price = num(b.price); if (price != null) o.price = price;
    o.icon = ICON_NAMES.includes(b.icon) ? b.icon : iconFor(`${o.text} ${o.sub}`, 'sparkle');
    if (b.img || shot === 'hero') {
      const a = findAsset(b.img, images.filter((x) => x.role !== 'logo')) || findAsset(b.img, images);
      if (a) { o.img = a.url; o.imgRatio = a.width && a.height ? a.height / a.width : 1; o.full = !!b.full; o.bigword = brand; }
    }
    if (Array.isArray(b.imgs)) o.imgs = b.imgs.map((r) => findAsset(r, images)?.url).filter(Boolean).slice(0, 8);
    if (shot === 'lockup' && !o.text) o.text = brand;
    if (shot === 'brand' && !o.text) o.text = brand;
    o.hasLogo = !!logo;
    for (const k of Object.keys(o)) if (o[k] === '' || (Array.isArray(o[k]) && !o[k].length && k !== 'subs')) delete o[k];
    if (!o.subs) o.subs = [];

    // repair: a shot that can't show this content becomes the nearest shot that can
    if (!SHOTS[shot] || !SHOT_VALID[shot] || !SHOT_VALID[shot](o)) {
      if (shot === 'logo' && !logo) o.shot = 'brand';
      else if (o.items?.length >= 2) o.shot = o.items.length <= 4 ? (calm ? 'stack' : 'pills') : 'grid';
      else if (o.price != null) o.shot = 'counter';
      else if (o.text) o.shot = calm ? 'sentence' : 'words';
      else return null;
      if (!SHOT_VALID[o.shot](o)) o.shot = calm ? 'sentence' : 'words';
      if (!o.text && (o.shot === 'sentence' || o.shot === 'words')) return null;
    }
    return o;
  }).filter(Boolean);
  if (!beats.length) return null;

  // the video must end on the call to action
  const last = beats[beats.length - 1];
  if (last.shot !== 'lockup') {
    const cta = str(plan.cta, 44) || str(plan.business?.phone, 30);
    beats.push({ shot: 'lockup', seconds: 2.6, text: brand || last.text || 'Contact us', subs: [str(plan.business?.location, 50)].filter(Boolean), button: cta || 'Contact us', icon: 'phone', hasLogo: !!logo });
  }
  // timings: scale to exactly the video length, keep the final beat at least 2.4s
  const total = beats.reduce((a, b) => a + b.seconds, 0);
  let t = 0;
  beats = beats.map((b, i) => {
    const t1 = i === beats.length - 1 ? duration : Math.round((t + (b.seconds * duration) / total) * 100) / 100;
    const out = { ...b, t0: Math.round(t * 100) / 100, t1 };
    delete out.seconds; t = t1; return out;
  });
  // cuts: none after the last beat, no immediate repeats, durations from the table
  let prev = '';
  beats.forEach((b, i) => {
    if (i === beats.length - 1) { delete b.cut; return; }
    let type = b.cut || (beats[i].shot === 'logo' ? 'dive' : ['focus', 'whip', 'morph', 'zoom'][i % 4]);
    if (type === prev && type !== 'dive') type = type === 'focus' ? 'morph' : 'focus';
    b.cut = { type, d: CUT_D[type] || 0.28 };
    prev = type;
  });
  return beats;
}

function assetLines(assets) {
  const images = assets.filter((a) => (a.kind || 'image') === 'image');
  if (!images.length) return '- none (no logo or photos: do not use logo, hero or collage-with-imgs)';
  return images.map((a) => `- "${a.name}" (${a.role || 'photo'}${a.width ? `, ${a.width}x${a.height}` : ''}${a.has_alpha || a.transparent ? ', transparent' : ''})`).join('\n');
}

function styleLines(style, themeKey) {
  const t = THEMES[themeKey] || THEMES.bold;
  return `Style: "${style?.name || t.label}" (${t.calm ? 'PREMIUM / calm: small clean type, UI morphs; avoid zoomword and kinetic' : `energy ${t.energy} of 3`}).
This style's favourite shots: hook ${t.prefer.hook.join('/')}; text ${t.prefer.text.join('/')}; price ${t.prefer.price.join('/')}; lists ${t.prefer.list.join('/')}; brand ${t.prefer.brand.join('/')}.
Favourite cuts: ${t.transitions.join(', ')}.`;
}

const SHOT_MENU = () => Object.entries(SHOTS).map(([k, v]) => `- ${k}: ${v.d} Fields: ${v.f}.`).join('\n');
const CUT_MENU = () => Object.entries(CUTS).map(([k, v]) => `${k} (${v})`).join(', ');

function directorSystem({ duration, aspect, style, themeKey }) {
  return `You are the Animora motion director: an After Effects-level motion designer who directs short video ads
shot by shot. You do not write code. You return JSON only: { "beats": [ ... ] }.

Each beat is one shot of about 1-3 seconds:
{ "shot": "<shot name>", "seconds": 2.2, ...fields for that shot..., "cut": "<cut into the next beat>" }

SHOTS YOU CAN USE
${SHOT_MENU()}
Item objects: { "text": "Jollof rice", "price": 2500, "icon": "food" }. Icons: ${ICON_NAMES.join(', ')}.
Images are referenced by their asset NAME exactly as listed.

CUTS (between beats): ${CUT_MENU()}

LOOK: also choose the visual look of THIS video in "look": { "ambient": [up to 3 of ${AMBIENT.join(', ')}],
"textIn": "rise|blur|slide|focus", "accentStyle": "marker|color", "energy": 1-3, "drift": 0-1.2 (slow camera tilt),
"music": "calm|pulse|warm|cinematic|bright" (background music mood; the cuts snap to its beat) }.
Return { "concept": "one line describing your idea", "look": {...}, "beats": [...] }.

DIRECTION RULES
- The video is ${duration} seconds, ${aspect}. Use about one beat per ${duration <= 20 ? '1.5-2.2' : '2-3'} seconds; the "seconds" values should add up to about ${duration}.
- Every beat shows ONE idea. Never repeat the same shot twice in a row, and vary the shots across the video; it must not feel like a pattern.
- Open with a strong hook in the first 2 seconds. End with a "lockup" beat (at least 2.5 s) with the phone/website in "button".
- Keep on-screen text SHORT (headlines under 7 words). Use the business's exact names, prices, phone numbers and addresses; never invent them.
- Use the uploaded images where they help: the logo (shot "logo", then cut "dive" to fly into it, or in the lockup), product photos in "hero" or "collage".
- The user's SPECIAL INSTRUCTIONS are the most important part of the brief. Follow every one of them literally.
- Every video must be ORIGINAL: design it around the CREATIVE CONCEPT given in the brief, so this ad does not look like a template
  with the text swapped. Rewrite the copy into sharp ad lines (you may reword the plan's lines; keep facts exact).
${styleLines(style, themeKey)}
Return only the JSON object.`;
}

/** Ask Gemini to direct the whole video. Returns sanitized beats, or throws. */
export async function directVideo({ plan, brief = null, style = null, themeKey, assets = [], images = [], avoid = [] }) {
  const duration = Number(plan.duration_seconds) || 20;
  const calm = !!THEMES[themeKey]?.calm;
  const scenes = (plan.scenes || []).map((s) => `- ${s.start}-${s.end}s ${s.purpose || ''}: ${[].concat(s.on_screen_text || []).filter(Boolean).join(' | ')}${s.images?.length ? ` [images: ${s.images.map((i) => i.asset).join(', ')}]` : ''}`).join('\n');
  const special = str(brief?.extra || plan.special_instructions, 1500);
  const user = `BUSINESS: ${plan.business?.name || ''} (${plan.business?.category || brief?.category || ''})${plan.business?.location ? `, ${plan.business.location}` : ''}
GOAL: ${brief?.goal || plan.goal || ''}
CALL TO ACTION: ${plan.cta || ''}
PLAN (content to cover, in order):
${scenes}
UPLOADED IMAGES:
${assetLines(assets)}
${brief ? `ANSWERS FROM THE BUSINESS: ${JSON.stringify({ messages: brief.headlines || [brief.headline].filter(Boolean), strengths: brief.features, products: brief.products, action: brief.cta, contact: brief.contact })}\n` : ''}CREATIVE CONCEPT FOR THIS VIDEO: ${CONCEPTS[Math.floor(Math.random() * CONCEPTS.length)]} (adapt it to the business; the special instructions win if they conflict)
${avoid.length ? `The previous version used these shots in this order: ${avoid.join(', ')}. Make this version clearly different (other shots, other order, other cuts).\n` : ''}${special ? `\nSPECIAL INSTRUCTIONS FROM THE USER (follow exactly):\n${special}\n` : ''}
Direct the ${duration}s video now.`;
  const { text } = await geminiGenerate({
    system: directorSystem({ duration, aspect: plan.aspect_ratio, style, themeKey }),
    messages: [{ role: 'user', text: user, images }],
    model: DIRECTOR_MODEL, temperature: 0.9, maxOutputTokens: 8192, json: true, timeoutMs: 90000,
  });
  const out = parseJson(text);
  const beats = sanitizeBeats(out, { duration, assets, plan, calm });
  if (!beats) throw new Error('The director returned no usable beats');
  return { beats, look: sanitizeLook(out.look), concept: str(out.concept, 160) };
}

function parseJson(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { /* fall through */ }
  const m = t.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) throw new Error('No JSON in the director reply');
  return JSON.parse(m[0]);
}

// ---------------------------------------------------------------------------
// Editing a directed video
// ---------------------------------------------------------------------------
export const readData = (html) => {
  const m = String(html || '').match(/window\.ADFLASH_DATA = (.*);\n/);
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
};

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Plain-words edit on a motion-engine video: Gemini gets the current beats and returns the new ones
 * (plus optional colour / text-size / speed changes). Returns { html, summary } or throws.
 */
export async function directorEdit({ html, plan, instruction, assets = [], images = [] }) {
  const data = readData(html);
  if (!data?.beats) throw new Error('Not a motion-engine video');
  const duration = Number(data.duration) || Number(plan?.duration_seconds) || 20;
  const themeKey = data.theme?.key || 'bold';
  const current = data.beats.map(({ t0, t1, hasLogo, cut, img, imgs, imgRatio, bigword, ...b }) => ({
    ...b, seconds: Math.round((t1 - t0) * 10) / 10,
    ...(img ? { img: (assets.find((a) => a.url === img) || {}).name || img } : {}),
    ...(imgs ? { imgs: imgs.map((u) => (assets.find((a) => a.url === u) || {}).name || u) } : {}),
    ...(cut ? { cut: cut.type } : {}),
  }));
  const system = `${directorSystem({ duration, aspect: plan?.aspect_ratio || '9:16', style: null, themeKey })}

YOU ARE EDITING AN EXISTING VIDEO. You get its current beats and the user's change request.
Return { "beats": [...the FULL updated list...], "colors"?: { "primary"?, "secondary"?, "background"?, "text"? } (hex),
"textScale"?: number (1 = current, 1.3 = bigger), "speed"?: number (1 = current, 1.4 = faster), "summary": "one short sentence of what you changed" }.
Change only what the user asked for; keep every other beat as it is. If they ask for something no shot can do,
get as close as possible with the shots and cuts available and say so in the summary.`;
  const { text } = await geminiGenerate({
    system,
    messages: [{ role: 'user', images, text: `CURRENT BEATS:\n${JSON.stringify(current)}\n\nIMAGES AVAILABLE:\n${assetLines(assets)}\n\nCHANGE REQUEST: ${instruction}` }],
    model: DIRECTOR_MODEL, temperature: 0.5, maxOutputTokens: 8192, json: true, timeoutMs: 90000,
  });
  const out = parseJson(text);
  const beats = sanitizeBeats(out.beats || out, { duration, assets, plan: plan || {}, calm: !!THEMES[themeKey]?.calm });
  if (!beats) throw new Error('The edit returned no usable beats');
  let next = html.replace(/window\.ADFLASH_DATA = (.*);\n/, () => `window.ADFLASH_DATA = ${JSON.stringify({ ...data, beats }).replace(/</g, '\\u003c')};\n`);
  const setVar = (name, value) => { next = next.replace(new RegExp(`(--${name}:\\s*)([^;]+)(;)`), `$1${value}$3`); };
  const c = out.colors || {};
  if (HEX.test(c.primary || '')) setVar('primary', c.primary);
  if (HEX.test(c.secondary || '')) setVar('secondary', c.secondary);
  if (HEX.test(c.background || '')) setVar('bg', c.background);
  if (HEX.test(c.text || '')) setVar('text', c.text);
  const ts = Number(out.textScale);
  if (ts > 0.4 && ts < 2.5 && ts !== 1) {
    const cur = Number((next.match(/--scale:\s*([\d.]+);/) || [])[1] || 1);
    setVar('scale', String(Math.round(cur * ts * 100) / 100));
  }
  const sp = Number(out.speed);
  if (sp > 0.4 && sp < 2.5 && sp !== 1) {
    const m = next.match(/const SPEED = ([\d.]+);/);
    if (m) next = next.replace(m[0], `const SPEED = ${Math.round(Number(m[1]) * sp * 100) / 100};`);
  }
  return { html: next, summary: str(out.summary, 200) || 'Done! Check the preview.' };
}

/** Build the motion-engine HTML for a plan, directed by Gemini when possible. */
export async function directedHtml({ plan, brief, style, themeKey, assets, images, previous = null }) {
  const avoid = (readData(previous)?.beats || []).map((b) => b.shot);
  const { beats, look, concept } = await directVideo({ plan, brief, style, themeKey, assets, images, avoid });
  if (concept) console.log(`[director] ${concept}`);
  return templateFromPlan(plan, { themeKey, assets, beats, look });
}
