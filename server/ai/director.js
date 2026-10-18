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
import { SHOT_VALID, ICON_NAMES, iconFor, priceOf, templateFromPlan, LEGACY_SHOTS } from './templates.js';

const DIRECTOR_MODEL = process.env.GEMINI_DIRECTOR_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-flash-latest';

// What each shot looks like and which fields it uses. Shown to Gemini, and used to clean its answer.
export const SHOTS = {
  slam: { f: 'text (1-3 words, max 18 letters), sub?', d: 'PREMIUM KINETIC: one giant word slams into the screen letter by letter with an impact; outline copies stack above and below. The strongest hook.' },
  poster: { f: 'lines (2-5 short lines, each max 12 letters, e.g. ["FRESH","BREAD","DAILY"])', d: 'PREMIUM KINETIC: a full-frame type poster, every line sized to fill the width, solid / outline / highlighted last line.' },
  reveal: { f: 'text (max 34 chars), sub?', d: 'PREMIUM: a colour bar sweeps across and leaves the words behind it (After Effects box reveal). Clean and classy.' },
  tunnel: { f: 'text (the line it lands on), imgs (2-6 asset names) or items (2-6 short words)', d: 'PREMIUM 3D: the camera flies through a 3D corridor of photos or words and lands on the line. Great opener or product showcase.' },
  parallax: { f: 'img (asset name), text, sub? or price?', d: 'PREMIUM 3D: the photo as a glossy card turning in 3D over a blurred copy of itself, shapes floating at other depths. Best way to show a product photo.' },
  marquee3d: { f: 'text, sub?, word? (word repeated on the wall; default the brand)', d: 'PREMIUM 3D: a tilted 3D wall of the brand name scrolls behind the main line.' },
  flare: { f: 'text (max 34 chars), sub?', d: 'PREMIUM GLOW: a horizontal light flare streaks out from the centre and reveals the line, then settles under it as a glowing rule.' },
  glowproduct: { f: 'img (asset name, best a product photo), text?, sub? or price?', d: 'PREMIUM GLOW: the product floats in a soft glowing halo with slow light rays; text beside it.' },
  chipfield: { f: 'text (the chosen option, max 24 chars), items (4-10 other options), icon?', d: 'PREMIUM UI: a field of option chips; the camera pushes in on the chosen one, which lights up.' },
  rule: { f: 'text ("left words | right words")', d: 'APPLE: two words pushed to the two ends of a thin line that draws outward ("tells a ———— story").' },
  fan: { f: 'imgs (2-5 asset names), text?', d: 'APPLE: photos as phone-shaped cards fanning out in 3D from one stack.' },
  ring3d: { f: 'text (row 2), items? (row 1 words) or word?', d: 'STUDIO 3D: words wrapped round a rotating 3D cylinder, two rows turning opposite ways.' },
  colorslide: { f: 'text (max 40), sub?, img?', d: 'STUDIO: the whole screen floods with a bold colour; big uppercase headline, italic line under it, an image card tilting in.' },
  dotsphere: { f: 'text, sub?', d: 'STUDIO 3D: a rotating sphere of glowing dots beside the line (AI / tech / future topics).' },
  stepstack: { f: 'lines (2-5 short lines)', d: 'lines stack up one by one; the newest is bright and the earlier ones dim ("Free." / "No ads." / "No subscriptions.").' },
  bigcount: { f: 'number (e.g. "900", "24/7" not allowed: digits only with optional prefix/suffix like "+", "%", "\u20a6") or price, text (label), sub?', d: 'a huge number counts up in a card, its label beside it. Only numbers from the brief.' },
  toggle: { f: 'text (max 30)', d: 'APPLE-PLAYFUL: a switch flips on with a squash and fills with colour; the word rises under it ("Now open.").' },
  assemble: { f: 'text (1-2 words, max 14 letters, often the brand), sub?', d: 'PLAYFUL: letters fly in from all over the frame as round blobs and assemble the word. Great logo-name reveal.' },
  avatars: { f: 'text (title), imgs (2-6) or items (2-6 with icons)', d: 'a row of overlapping round bubbles (photos or icons) pops in with a spring under the title.' },
  cardstack: { f: 'imgs (1-6) or items (2-6), text?', d: '3D: a long diagonal wall of cards slides past the camera, the line over it.' },
  numbered: { f: 'number ("#1", "#2" ...), text (label, max 28), icon', d: 'a numbered title card: big gradient number, icon tile, label pill. Use for "top 3" lists, one beat per item.' },
  bracket: { f: 'text (max 36)', d: 'the line opens inside curly brackets that slide apart ("{ Ever find an }"). Techy, creator style.' },
  status: { f: 'items (2-4 stages, e.g. "Order received", "Cooking", "On the way"), title? (small line under)', d: 'APPLE UI: a status card steps through the stages with a filling bar and a final tick (Uber style).' },
  stars: { f: 'number (rating like "4.8", ONLY if the brief gives a rating), text?', d: 'stars fill one by one in a pill, then the score.' },
  prompt: { f: 'text (what gets typed, max 60), sub? (placeholder, default "Ask anything"), title?', d: 'APPLE UI: a prompt / search bar; the text types in and the send button is pressed (ChatGPT style).' },
  wordswap: { f: 'items (2-5 single words, e.g. Write, Create, Solve), title?', d: 'APPLE UI: one pill whose word changes letter by letter through the list.' },
  rollword: { f: 'text (the fixed start, max 20, e.g. "No"), lines (2-4 endings, e.g. ["cooking.","waiting.","hangry days."])', d: 'APPLE: a fixed start and a rolling accent word that cycles; the last one stays.' },
  endcard: { f: 'text (short tagline, max 40), sub (phone / website)', d: 'APPLE: minimal ending: the logo, then the tagline words arrive one by one beside it, contact under it. Can replace the lockup as the final beat.' },
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
  iris: 'the next shot opens in an expanding circle with a colour ring', cover: 'two liquid colour circles flood the frame and drain away',
  cube: '3D cube turn', glitch: 'digital glitch with colour split', shutter: 'colour bars drop like a shutter and lift away',
};
const CUT_D = { wipe: 0.34, dive: 0.42, swoosh: 0.36, cover: 0.42, cube: 0.36, shutter: 0.36, glitch: 0.2, iris: 0.3 };

// One consistent LOOK per video (like a real motion designer's style frame): shots, cuts, type motion and finish.
export const PRESETS = {
  cinematic: { d: 'film look: big photos in 3D, slow camera, soft light leaks and grain', shots: ['parallax', 'tunnel', 'reveal', 'sentence', 'hero', 'logo', 'lockup'], cuts: ['focus', 'iris', 'dive', 'cover'], look: { textIn: 'focus', energy: 1, drift: 0.6, finish: 1.2, leaks: 1, chroma: 0, ambient: ['glow'] } },
  kinetic: { d: 'kinetic typography: giant type fills the frame and slams on the beat', shots: ['slam', 'poster', 'reveal', 'kinetic', 'zoomword', 'marquee3d', 'flip'], cuts: ['whip', 'glitch', 'shutter', 'zoom'], look: { textIn: 'chars', energy: 3, finish: 0.8, chroma: 1, leaks: 0, ambient: ['grid'] } },
  editorial: { d: 'calm and elegant, one strong line at a time, lots of space', shots: ['reveal', 'sentence', 'flip', 'parallax', 'ticker', 'iconmorph'], cuts: ['focus', 'iris', 'line', 'cube'], look: { textIn: 'focus', energy: 1, drift: 0.4, finish: 0.7, leaks: 0.6, chroma: 0, ambient: ['frame'] } },
  hype: { d: 'loud pop energy for promos, sales and launches', shots: ['slam', 'poster', 'marquee3d', 'counter', 'parallax', 'zoomword', 'pills'], cuts: ['cover', 'glitch', 'whip', 'shutter', 'flash'], look: { textIn: 'chars', energy: 3, finish: 0.6, chroma: 1, leaks: 0, ambient: ['rays', 'particles'] } },
  luxury: { d: 'luxury: slow, golden, glossy 3D product shots', shots: ['reveal', 'parallax', 'sentence', 'tunnel', 'logo', 'isocard'], cuts: ['focus', 'cube', 'iris', 'line'], look: { textIn: 'focus', energy: 1, drift: 0.5, finish: 1, leaks: 1, chroma: 0, ambient: ['glow', 'sparkles'] } },
  apple: { d: 'Apple ad style: calm, small clean type that builds word by word with a soft glow on the key word, widgets that open into cards, phones fanning, rule lines (best on light styles)', shots: ['sentence', 'rule', 'rollword', 'iconmorph', 'status', 'prompt', 'wordswap', 'widgets', 'fan', 'flip', 'reveal', 'stack', 'toggle', 'avatars', 'bigcount', 'endcard'], cuts: ['focus', 'morph', 'iris'], look: { textIn: 'focus', energy: 1, halo: 1, drift: 0.3, finish: 0.4, leaks: 0, chroma: 0, ambient: [] } },
  glow: { d: 'dark premium launch: glowing luminous text, light flares, glowing product shots, glass cards joined by light lines (best on dark styles)', shots: ['flare', 'glowproduct', 'ticker', 'flow', 'chipfield', 'sentence', 'reveal', 'logo', 'stepstack', 'cardstack', 'prompt', 'endcard'], cuts: ['focus', 'zoom', 'morph', 'dive'], look: { textIn: 'focus', energy: 1, glow: 1, drift: 0.3, finish: 0.8, leaks: 0, chroma: 0, ambient: ['glow'] } },
  studio: { d: 'bold studio piece: full-screen colour slides, a rotating 3D word ring, a particle sphere, glitch cuts', shots: ['ring3d', 'colorslide', 'dotsphere', 'poster', 'slam', 'marquee3d'], cuts: ['glitch', 'cover', 'shutter', 'whip'], look: { textIn: 'chars', energy: 3, chroma: 0.8, finish: 0.7, leaks: 0, ambient: ['grid'] } },
  creator: { d: 'creator / tech reel: dark, bracket text, numbered cards, 3D card walls, chip fields, glitch cuts', shots: ['bracket', 'cardstack', 'numbered', 'stepstack', 'chipfield', 'bigcount', 'flare'], cuts: ['glitch', 'zoom', 'whip', 'focus'], look: { textIn: 'focus', energy: 2, glow: 0.6, finish: 0.7, chroma: 0.5, leaks: 0, ambient: ['glow'] } },
  playful: { d: 'friendly app launch: letters assembling, bubbles popping, a switch flipping on, big counting numbers (best on light styles)', shots: ['assemble', 'avatars', 'toggle', 'bigcount', 'wordswap', 'status', 'stepstack', 'iconmorph', 'endcard'], cuts: ['morph', 'focus', 'iris', 'cover'], look: { textIn: 'focus', energy: 2, halo: 1, finish: 0.4, chroma: 0, leaks: 0, ambient: [] } },
  tech: { d: 'tech / app: UI pieces, 3D depth, glitch cuts', shots: ['iconmorph', 'widgets', 'tunnel', 'poster', 'notify', 'chat', 'reveal'], cuts: ['glitch', 'cube', 'morph', 'whip'], look: { textIn: 'chars', energy: 2, finish: 0.7, chroma: 0.7, leaks: 0, ambient: ['grid', 'dots'] } },
};

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
const AMBIENT = ['glow', 'grid', 'dots', 'beams', 'particles', 'sparkles', 'frame'];   // calm, premium backgrounds only

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
  if (look.textIn === 'chars') out.textIn = 'chars';
  for (const k of ['finish', 'leaks', 'chroma', 'glow', 'halo']) { const v = Number(look[k]); if (look[k] != null && v >= 0 && v <= 1.5) out[k] = v; }
  const t = Number(look.tempo); if (t >= 80 && t <= 140) out.tempo = Math.round(t);
  const pre = PRESETS[look.preset];
  if (pre) { out.preset = look.preset; for (const [k, v] of Object.entries(pre.look)) if (out[k] == null) out[k] = v; }
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
    return text || ICON_NAMES.includes(o.icon) ? { text, name: text, ...(price != null ? { price } : {}), icon } : null;   // icon-only items (avatar bubbles) are fine
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
      lines: (Array.isArray(b.lines) ? b.lines : []).map((x) => str(x, 16)).filter(Boolean).slice(0, 5),
      word: str(b.word, 20),
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
    if ((shot === 'poster' || shot === 'stepstack') && !o.text && o.lines?.length) o.text = o.lines.join(' ');
    if (o.img) { const a2 = images.find((x) => x.url === o.img); if (a2 && (a2.transparent || a2.has_alpha)) o.cutout = true; }
    if ((shot === 'parallax' || shot === 'glowproduct') && !o.img) { const a = images.find((x) => x.role !== 'logo'); if (a) { o.img = a.url; o.imgRatio = a.width && a.height ? a.height / a.width : 1; } }
    o.hasLogo = !!logo;
    for (const k of Object.keys(o)) if (o[k] === '' || (Array.isArray(o[k]) && !o[k].length && k !== 'subs')) delete o[k];
    if (!o.subs) o.subs = [];

    // repair: a shot that can't show this content becomes the nearest shot that can
    if (!SHOTS[shot] || !SHOT_VALID[shot] || !SHOT_VALID[shot](o)) {
      if (shot === 'logo' && !logo) o.shot = 'brand';
      else if (o.items?.length >= 2) o.shot = o.items.length <= 4 ? (calm ? 'stack' : 'pills') : 'grid';
      else if (o.price != null) o.shot = 'counter';
      else if (o.lines?.length >= 2) { o.shot = 'poster'; if (!o.text) o.text = o.lines.join(' '); }
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
  if (last.shot === 'endcard' && !last.sub) last.sub = str(plan.business?.phone, 30) || str(plan.cta, 44);
  if (last.shot !== 'lockup' && last.shot !== 'endcard') {
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
  return images.map((a) => `- "${a.name}" (${a.role || 'photo'}${a.width ? `, ${a.width}x${a.height}` : ''}${a.has_alpha || a.transparent ? ', transparent' : ''})${a.description ? ` SHOWS: ${a.description}` : ''}`).join('\n');
}

function styleLines(style, themeKey) {
  const t = THEMES[themeKey] || THEMES.bold;
  return `Style: "${style?.name || t.label}" (${t.calm ? 'PREMIUM / calm: small clean type, UI morphs; avoid zoomword and kinetic' : `energy ${t.energy} of 3`}).
This style's favourite shots: hook ${t.prefer.hook.join('/')}; text ${t.prefer.text.join('/')}; price ${t.prefer.price.join('/')}; lists ${t.prefer.list.join('/')}; brand ${t.prefer.brand.join('/')}.
Favourite cuts: ${t.transitions.join(', ')}.`;
}

const SHOT_MENU = () => Object.entries(SHOTS).filter(([k]) => !LEGACY_SHOTS.includes(k)).map(([k, v]) => `- ${k}: ${v.d} Fields: ${v.f}.`).join('\n');
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

LOOK: first pick ONE preset for the whole video, the way a motion designer picks a style frame:
${Object.entries(PRESETS).map(([k, v]) => `- ${k}: ${v.d}. Signature shots: ${v.shots.join(', ')}. Cuts: ${v.cuts.join(', ')}.`).join('\n')}
Then "look": { "preset": "<one of ${Object.keys(PRESETS).join(', ')}>", "ambient"?: [up to 3 of ${AMBIENT.join(', ')}],
"textIn"?: "rise|blur|slide|focus|chars" (chars = every letter animates), "accentStyle"?: "marker|color", "energy"?: 1-3, "tempo"?: 90-130 (beats per minute; cuts land on the beat) }.
Return { "concept": "one line describing your idea", "look": {...}, "beats": [...] }.

DIRECTION RULES
- The video is ${duration} seconds, ${aspect}. Use about one beat per ${duration <= 20 ? '1.5-2.2' : '2-3'} seconds, so return AT LEAST ${Math.ceil(duration / 3)} beats; no beat longer than 3.5 seconds. If the answers run out, write new short lines from the business info (benefits, a question to the viewer, how it works, a promise) instead of repeating. The "seconds" values should add up to about ${duration}.
- Every beat shows ONE idea. Never repeat the same shot twice in a row, and vary the shots across the video; it must not feel like a pattern.
- PREMIUM ONLY: this must look like a top agency ad on TikTok, never like a template. Generous empty space, one idea per shot, short words, smooth camera.
- PREMIUM DIRECTION (this is what separates a top motion designer from a template):
  * At least half of the beats use the chosen preset's signature shots. Use only 2-3 cut types from the preset in the whole video, so it feels like one film.
  * Contrast scale: follow a giant-type beat (slam / poster / zoomword) with a calmer detail beat, then a 3D beat (tunnel / parallax / marquee3d / isocard). Never three similar beats in a row.
  * The first beat is the strongest: slam, poster, tunnel, logo+dive or parallax. Short punchy words on screen (1-4 words for slam / poster).
  * Rhythm: beats of 1.5-2.5 s, a few faster ones (about 1 s) right before the reveal of the offer or the brand.
  * Every uploaded product photo should appear at least once, ideally in parallax, glowproduct, fan or tunnel.
  * Match the preset to the style: light / white styles suit "apple"; dark styles suit "glow", "cinematic" or "luxury"; loud colourful styles suit "studio", "kinetic" or "hype".
- Open with a strong hook in the first 2 seconds. End with a "lockup" beat (phone/website in "button") or an "endcard" beat (tagline + phone/website in "sub"), at least 2.5 s.
- Keep on-screen text SHORT (headlines under 7 words, card and button text under 26 characters). Use the business's exact names, prices, phone numbers and addresses; never invent them.
- TRUTH: never invent people's names, counts, numbers, percentages, reviews, testimonials, awards or claims (no "148 new inquiries", "Hundreds in hours", "from Sarah", "#1 in Lagos", "10,000 happy customers"). Only use numbers and facts that appear in the brief. In chat / notification shots write plain generic messages ("New message", "Can you make my video ad?").
- PLAIN WORDS: write like the business owner talks to customers. No marketing jargon (omnichannel, seamless, leverage, synergy, cutting-edge, revolutionary, next-gen, game-changing, holistic, robust, elevate, unlock).
- LOGO: if the logo's SHOWS line already contains the business name, do not repeat the name as text right under the logo in the "logo" / "brand" shots; use a short tagline or the main message there instead.
- THINK before you answer: read the special instructions twice, plan the story beat by beat, then check every line against the rules above.
- Use the uploaded images where they help: the logo (shot "logo", then cut "dive" to fly into it, or in the lockup), product photos in "hero" or "collage".
- PICTURES AND WORDS MUST MATCH. Each image's "SHOWS:" line says what is really in it. A beat with an img must talk about what that picture shows (rice bags -> rice / foodstuff, never "chicken"). Never put a picture next to words about something else; if no uploaded picture shows a product you want to mention, mention it in a beat without an img.
- The user's SPECIAL INSTRUCTIONS are the most important part of the brief. Follow every one of them literally.
- Every video must be ORIGINAL: design it around the CREATIVE CONCEPT given in the brief, so this ad does not look like a template
  with the text swapped. Rewrite the copy into sharp ad lines (you may reword the plan's lines; keep facts exact).
${styleLines(style, themeKey)}
Return only the JSON object.`;
}

// ---------------------------------------------------------------------------
// Self-check: catch the mistakes people notice (made-up numbers and names, jargon, lines too long to fit,
// the brand name repeated under a logo that already shows it) and have the director fix them once.
// ---------------------------------------------------------------------------
const JARGON = /\b(omnichannel|seamless(?:ly)?|leverag\w*|synerg\w*|cutting[- ]edge|revolutionar\w*|next[- ]gen|game[- ]chang\w*|holistic|robust|elevate[sd]?|unlock(?:s|ed)?)\b/i;
const HYPE = /\b(hundreds|thousands|millions|#\s?1|no\.?\s?1|award[- ]winning|world[- ]class)\b/i;
const beatStrings = (b) => [b.text, b.sub, b.title, b.button, b.number, ...(b.subs || []), ...(b.items || []).flatMap((i) => [i?.text, i?.name])].filter((x) => typeof x === 'string' && x.trim());
export function lintBeats(beats, { brief = {}, plan = {}, assets = [] } = {}) {
  const facts = JSON.stringify({ brief, plan: { business: plan.business, scenes: plan.scenes, cta: plan.cta, special: plan.special_instructions } }).toLowerCase();
  const allowedNums = new Set((facts.match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => n.replace(/,/g, '')));
  const logo = assets.find((a) => a.role === 'logo');
  const brand = String(brief?.name || plan?.business?.name || '').trim().toLowerCase();
  const logoShowsName = !!(logo?.description && brand && logo.description.toLowerCase().includes(brand));
  const issues = [];
  (beats || []).forEach((b, i) => {
    const n = i + 1;
    for (const t of beatStrings(b)) {
      for (const num of t.match(/\d[\d,]*(?:\.\d+)?%?/g) || []) {
        const bare = num.replace(/[,%]/g, '');
        if ((Number(bare) > 10 || num.endsWith('%')) && !allowedNums.has(bare)) issues.push(`beat ${n}: "${t}" uses the number ${num}, which is not in the brief. Remove it or use a fact from the brief.`);
      }
      if (HYPE.test(t) && !HYPE.test(facts)) issues.push(`beat ${n}: "${t}" makes a claim the business never gave. Say it without the made-up claim.`);
      if (JARGON.test(t)) issues.push(`beat ${n}: "${t}" uses jargon (${t.match(JARGON)[0]}). Use plain words.`);
      const name = t.match(/\bfrom ([A-Z][a-z]{2,})\b/);
      if (name && !facts.includes(name[1].toLowerCase())) issues.push(`beat ${n}: "${t}" invents a person (${name[1]}). Use a generic message.`);
    }
    const head = String(b.text || '');
    if (head.length > 60) issues.push(`beat ${n}: "${head}" is too long for one shot (${head.length} characters). Keep it under 50.`);
    if (['iconmorph', 'card', 'widgets', 'notify', 'isocard'].includes(b.shot) && head.length > 30) issues.push(`beat ${n} (${b.shot}): "${head}" is too long for a card; keep it under 26 characters.`);
    if (logoShowsName && ['logo', 'brand'].includes(b.shot) && head.trim().toLowerCase() === brand) issues.push(`beat ${n} (${b.shot}): the logo already shows "${brief?.name || plan?.business?.name}", so don't repeat the name under it. Use a short tagline or message.`);
  });
  return [...new Set(issues)].slice(0, 20);
}

async function selfCheck(out, { system, ctx }) {
  const list = Array.isArray(out?.beats) ? out.beats : Array.isArray(out) ? out : null;
  const issues = lintBeats(list, ctx);
  if (!issues.length) return out;
  console.log('[director] fixing', issues.length, 'problem(s)');
  try {
    const { text } = await geminiGenerate({
      system,
      messages: [{ role: 'user', text: `Here is your draft:\n${JSON.stringify(out)}\n\nFix ONLY these problems and keep everything else exactly as it is:\n- ${issues.join('\n- ')}\n\nReturn the full corrected JSON in the same format.` }],
      model: DIRECTOR_MODEL, temperature: 0.3, maxOutputTokens: 24576, json: true, timeoutMs: 90000, thinking: 'low',
    });
    const fixed = parseJson(text);
    const fl = Array.isArray(fixed?.beats) ? fixed.beats : Array.isArray(fixed) ? fixed : null;
    if (fl?.length && lintBeats(fl, ctx).length < issues.length) return Array.isArray(out) ? fl : { ...out, ...fixed, beats: fl };
  } catch (e) { console.warn('[director] self-check failed:', e.message); }
  return out;
}

/** Ask Gemini to direct the whole video. Returns sanitized beats, or throws. */
export async function directVideo({ plan, brief = null, style = null, themeKey, assets = [], images = [], avoid = [] }) {
  const duration = Number(plan.duration_seconds) || 20;
  const calm = !!THEMES[themeKey]?.calm;
  const scenes = (plan.scenes || []).map((s) => `- ${s.start}-${s.end}s ${s.purpose || ''}: ${[].concat(s.on_screen_text || []).filter(Boolean).join(' | ')}${s.images?.length ? ` [images: ${s.images.map((i) => i.asset).join(', ')}]` : ''}`).join('\n');
  const special = str([brief?.extra, brief?.pasteText && `THE OWNER'S FULL DESCRIPTION (follow every point that fits): ${brief.pasteText}`].filter(Boolean).join('\n\n') || plan.special_instructions, 5000);
  const user = `BUSINESS: ${plan.business?.name || ''} (${plan.business?.category || brief?.category || ''})${plan.business?.location ? `, ${plan.business.location}` : ''}
GOAL: ${brief?.goal || plan.goal || ''}
CALL TO ACTION: ${plan.cta || ''}
PLAN (content to cover, in order):
${scenes}
UPLOADED IMAGES:
${assetLines(assets)}
${brief ? `ANSWERS FROM THE BUSINESS: ${JSON.stringify({ messages: brief.headlines || [brief.headline].filter(Boolean), strengths: brief.features, products: brief.products, actions: brief.ctas || [brief.cta].filter(Boolean), contact: brief.contact })}\n` : ''}CREATIVE CONCEPT FOR THIS VIDEO: ${CONCEPTS[Math.floor(Math.random() * CONCEPTS.length)]} (adapt it to the business; the special instructions win if they conflict)
${avoid.length ? `The previous version used these shots in this order: ${avoid.join(', ')}. Make this version clearly different (other shots, other order, other cuts).\n` : ''}${special ? `\nSPECIAL INSTRUCTIONS FROM THE USER (follow exactly):\n${special}\n` : ''}
Direct the ${duration}s video now.`;
  const { text } = await geminiGenerate({
    system: directorSystem({ duration, aspect: plan.aspect_ratio, style, themeKey }),
    messages: [{ role: 'user', text: user, images }],
    model: DIRECTOR_MODEL, temperature: 0.9, maxOutputTokens: 24576, json: true, timeoutMs: 150000, thinking: 'low',
  });
  const system = directorSystem({ duration, aspect: plan.aspect_ratio, style, themeKey });
  const out = await selfCheck(parseJson(text), { system, ctx: { brief: brief || {}, plan, assets } });
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
export async function directorEdit({ html, plan, instruction, assets = [], images = [], brief = null, history = [] }) {
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
Read the request carefully and do ALL of it in this one edit; the user should never have to ask twice.
If the request lists several changes, make every one. Words like "it", "that part", "the ending" refer to the beats
and the earlier requests shown to you. Change only what the user asked for; keep every other beat as it is. If they ask for something no shot can do,
get as close as possible with the shots and cuts available and say so in the summary.`;
  const past = (history || []).filter((h) => h.role === 'user').slice(-6).map((h) => `- ${h.text}`).join('\n');
  const facts = brief ? `\nTHE BUSINESS (facts you may use): ${JSON.stringify({ name: brief.name, category: brief.category, messages: brief.headlines, strengths: brief.features, products: brief.products, actions: brief.ctas, contact: brief.contact })}` : '';
  const { text } = await geminiGenerate({
    system,
    messages: [{ role: 'user', images, text: `CURRENT BEATS:\n${JSON.stringify(current)}\n\nIMAGES AVAILABLE:\n${assetLines(assets)}${facts}${past ? `\n\nEARLIER CHANGE REQUESTS (already done; keep them):\n${past}` : ''}\n\nCHANGE REQUEST: ${instruction}` }],
    model: DIRECTOR_MODEL, temperature: 0.4, maxOutputTokens: 24576, json: true, timeoutMs: 150000, thinking: 'high',
  });
  const out = await selfCheck(parseJson(text), { system, ctx: { brief: brief || {}, plan: plan || {}, assets } });
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
