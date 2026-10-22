// The guided question flow ("brief") -> a video plan.
// The plan page asks one question at a time (business name, what you do, goal, message, products,
// strengths, call to action, contact, format, length, pictures, style, narration, special instructions).
// Each answer is stored once, so no question is ever asked twice. This file turns the finished brief
// into the plan the rest of AdFlash uses: Gemini writes it when available, our own rules otherwise.

import { config } from '../config.js';
import { geminiGenerate } from '../engine/gemini.js';
import { validatePlan } from '../engine/validate.js';
import { WANT_IDS } from './cinema/compose.js';
import { MOTION_WANTS } from './motion/compose.js';
import { TEMPLATE_IDS } from './pieces/index.js';

const PHONE_RE = /(\+?234[\s-]?|0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}/;
const URL_RE = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|ng|com\.ng|space|app|io|co|org|net|store|shop)(?:\/\S*)?)\b/i;
// cut at a whole word, never in the middle of one ("This flyer was mad", "fix your devi")
const str = (v, max = 200) => { const t = v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); if (t.length <= max) return t; const c = t.slice(0, max), sp = c.lastIndexOf(' '); return (sp > max * 0.5 ? c.slice(0, sp) : c).replace(/[\s,;:&–—-]+$/, ''); };
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(/\n|;/)).map((x) => str(x, 80)).filter(Boolean);

/** Keep only known fields, trimmed. */
export function cleanBrief(b = {}) {
  const out = {
    name: str(b.name, 60), category: str(b.category, 60),
    // goal: one or more; `goal` is them joined (used in prompts and titles), `goals` the list
    goals: list(Array.isArray(b.goals) ? b.goals : Array.isArray(b.goal) ? b.goal : b.goal ? [b.goal] : []).slice(0, 6),
    // main message: one or more (up to 8); `headline` is the first, `headlines` all of them
    headlines: list(Array.isArray(b.headlines) ? b.headlines : Array.isArray(b.headline) ? b.headline : b.headline ? [b.headline] : []).slice(0, 8),
    products: list(b.products).slice(0, 8), features: list(b.features).slice(0, 8),
    // what to do after watching: one or more; `cta` is the first, `ctas` all of them
    ctas: list(Array.isArray(b.ctas) ? b.ctas : Array.isArray(b.cta) ? b.cta : b.cta ? [b.cta] : []).slice(0, 5),
    contact: str(b.contact, 120), aspect: ['9:16', '16:9', '1:1', '4:5', 'A4'].includes(b.aspect) ? b.aspect : undefined,
    duration: Number(b.duration) || undefined, styleId: b.styleId ? String(b.styleId) : undefined, styleAuto: !!b.styleAuto,
    colors: b.colors && typeof b.colors === 'object' ? Object.fromEntries(Object.entries(b.colors).filter(([k, v]) => ['primary', 'secondary', 'background', 'text'].includes(k) && /^#[0-9a-f]{6}$/i.test(v))) : undefined,
    voiceover: b.voiceover === undefined || b.voiceover === null ? undefined : b.voiceover === true || b.voiceover === 'yes',
    sound: ['all', 'sfx', 'none', 'own'].includes(b.sound) ? b.sound : b.sfx === true || b.sfx === 'yes' ? 'all' : b.sfx === false || b.sfx === 'no' ? 'none' : undefined,
    // which scene styles the owner asked for (ids from the form's scene picker); sceneAuto = let the AI decide
    scenes: (Array.isArray(b.scenes) ? b.scenes : []).map(String).filter((x) => WANT_IDS.includes(x) || x in MOTION_WANTS).slice(0, 8), sceneAuto: b.sceneAuto === undefined ? undefined : !!b.sceneAuto,
    // flyer-only answers
    flyerType: (Array.isArray(b.flyerType) ? list(b.flyerType) : b.flyerType ? [str(b.flyerType, 60)] : []).map((x) => str(x, 60)).filter(Boolean).slice(0, 3), offer: str(b.offer, 60), when: str(b.when, 120), layout: ['photo', 'type', 'price', 'auto'].includes(b.layout) ? b.layout : undefined,
    extra: str(b.extra, 3000), done: !!b.done, mode: ['steps', 'paste'].includes(b.mode) ? b.mode : undefined, pasted: b.pasted ? true : undefined, pasteText: str(b.pasteText, 6000),
    colorMode: ['style', 'logo', 'own'].includes(b.colorMode) ? b.colorMode : undefined, picturesDone: b.picturesDone ? true : undefined,
    // signature templates (After Effects-style recipes); 'auto' or empty means the library mixes its own film
    template: b.template === 'auto' || TEMPLATE_IDS.includes(b.template) ? b.template : undefined,
    intensity: ['auto', 'elegant', 'aggressive', 'mechanical', 'fluid'].includes(b.intensity) ? b.intensity : undefined,
    soundStyle: ['beat', 'cinematic', 'ambient', 'none'].includes(b.soundStyle) ? b.soundStyle : undefined,
    quality: ['preview', 'premium', 'max'].includes(b.quality) ? b.quality : undefined,
  };
  // optional questions the user skipped (so they are not asked again)
  for (const k of ['features', 'products', 'contact', 'pictures', 'extra', 'scenes', 'category', 'goal', 'headline', 'cta', 'aspect', 'duration', 'colors', 'style', 'template', 'intensity', 'voiceover', 'sound', 'flyerType', 'layout', 'offer', 'when']) if (b[`${k}Skipped`] !== undefined) out[`${k}Skipped`] = !!b[`${k}Skipped`];
  if (out.headlines.length) out.headline = out.headlines[0]; else delete out.headlines;
  if (out.ctas.length) out.cta = str(out.ctas[0], 60); else delete out.ctas;
  if (out.goals.length) out.goal = str(out.goals.join(' + '), 200); else delete out.goals;
  if (Array.isArray(out.flyerType) && !out.flyerType.length) delete out.flyerType;
  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === '') delete out[k];
  return out;
}

// Own/logo colours: keep text readable on the chosen background.
function lum(hex) { const n = parseInt(String(hex).slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function readable(colors, chosen) {
  if (!chosen?.background || chosen.text || !/^#[0-9a-f]{6}$/i.test(colors.background || '')) return colors;
  return { ...colors, text: lum(colors.background) > 0.4 ? '#111318' : '#F7F7FA' };
}

// ---------------------------------------------------------------------------
// Rule-based plan (always works)
// ---------------------------------------------------------------------------
export function briefToPlanRules(brief, { assets = [], limits = { minSeconds: 15, maxSeconds: 300 }, palette = null } = {}) {
  const b = cleanBrief(brief);
  let D = Math.max(limits.minSeconds || 15, Math.min(limits.maxSeconds || 300, b.duration || 20));
  const images = assets.filter((a) => a.kind === 'image');
  const logo = images.find((a) => a.role === 'logo');
  const photos = images.filter((a) => a.role !== 'logo');
  const phone = (b.contact || '').match(PHONE_RE)?.[0] || '';
  const site = (b.contact || '').match(URL_RE)?.[0] || '';
  const place = str((b.contact || '').replace(phone, '').replace(site, '').replace(/^[\s,·|-]+|[\s,·|-]+$/g, ''), 60);
  const action = b.cta || (phone ? 'Call or WhatsApp us' : site ? 'Visit our website' : 'Contact us today');
  const otherActions = (b.ctas || []).slice(1);
  const ctaLine = [[action, ...otherActions].join(' or '), phone || site].filter(Boolean).join(' ');

  const scenes = [];
  const add = (purpose, text, weight, imgs = []) => scenes.push({ purpose, on_screen_text: text.filter(Boolean), weight, images: imgs });
  add('hook', [b.headline || `${b.name}`, b.offer], 1);
  if (b.when) add('detail', [b.when], 1);
  add('brand', [b.name, b.category ? `${b.category}${place ? ` · ${place}` : ''}` : place], 1, logo ? [{ asset: logo.name, placement: 'center', fit: 'contain' }] : []);
  (b.headlines || []).slice(1).forEach((h) => add('detail', [h], 1));   // the other chosen messages
  if (photos[0]) add('product', [b.features[0] || b.headline || b.name, b.category].slice(0, 2), 1, [{ asset: photos[0].name, placement: 'center', fit: 'cover' }]);
  // every chosen strength gets shown: groups of up to 3 per scene
  const rest = photos[0] ? b.features.slice(1) : b.features;
  for (let i = 0; i < rest.length; i += 3) add('detail', rest.slice(i, i + 3), 1);
  if (b.products.length) add('menu', b.products.slice(0, 6), 1.3);
  if (photos[1]) add('offer', [b.products[0] || b.headline || b.name], 1, [{ asset: photos[1].name, placement: 'background', fit: 'cover' }]);
  add('cta', [action, phone || site, otherActions.join(' · '), place].filter(Boolean), 1.2, logo ? [{ asset: logo.name, placement: 'corner', fit: 'contain' }] : []);

  // More answers = a longer video: every scene gets at least ~3.5 s, up to the plan's maximum length.
  const maxD = limits.maxSeconds || 300;
  D = Math.max(D, Math.min(maxD, Math.ceil((scenes.length * 3.5) / 5) * 5));
  // drop middle scenes only if the plan's maximum is still too short for them (keep hook, brand and CTA)
  while (scenes.length > 3 && D / scenes.length < 3) scenes.splice(scenes.length - 2, 1);
  const total = scenes.reduce((a, s) => a + s.weight, 0);
  let t = 0;
  const planScenes = scenes.map((s, i) => {
    const end = i === scenes.length - 1 ? D : Math.round((t + (D * s.weight) / total) * 10) / 10;
    const sc = { id: i + 1, start: t, end, purpose: s.purpose, on_screen_text: s.on_screen_text, images: s.images };
    if (b.voiceover) sc.voiceover = s.on_screen_text.join('. ').slice(0, Math.floor((end - t - 0.8) * 2.3) * 7);
    t = end; return sc;
  });
  if (b.voiceover) planScenes.forEach((sc) => { const w = String(sc.voiceover || '').split(/\s+/); const max = Math.max(3, Math.floor((sc.end - sc.start) * 2.6)); if (w.length > max) sc.voiceover = w.slice(0, max).join(' '); });

  return {
    title: `${b.name || 'My business'}${b.headline || b.goal ? ` - ${b.headline || b.goal}` : ''}`.slice(0, 110),
    business: { name: b.name || '', category: b.category || '', location: place, phone, handle: site },
    aspect_ratio: b.aspect || '9:16',
    duration_seconds: D,
    style: { colors: readable({ ...(palette || {}), ...(b.colors || {}) }, b.colors) },
    assets: images.map((a) => ({ name: a.name, url: a.url, use: a.role === 'logo' ? 'logo' : 'product photo' })),
    scenes: planScenes,
    voiceover: b.voiceover ? { enabled: true, source: 'ai', voice_style: 'warm, friendly and confident', captions: true } : { enabled: false },
    cta: ctaLine,
    goal: b.goal || '',
    special_instructions: [b.extra, b.pasteText && `The business owner's full description (follow it): ${b.pasteText}`].filter(Boolean).join('\n\n'),
    sound: b.sound || 'all',
    sfx: b.sound !== 'none',
    music_url: b.sound === 'own' ? (assets.find((a) => a.kind === 'audio' && a.role === 'music') || {}).url || '' : '',
  };
}

// ---------------------------------------------------------------------------
// Gemini plan (better copy, follows the special instructions)
// ---------------------------------------------------------------------------
const PLAN_SYSTEM = `You turn a small business's answers into a motion-graphics video ad plan. Do not ask questions.
Return JSON only, this shape:
{ "title": "", "business": { "name": "", "category": "", "location": "", "phone": "", "handle": "" },
  "scenes": [ { "purpose": "hook|brand|product|detail|menu|offer|stat|cta", "seconds": 4, "on_screen_text": ["short line", "..."],
                "images": [ { "asset": "<exact image name>", "placement": "center|background|corner" } ], "voiceover": "spoken line (only if narration is on)" } ],
  "cta": "action + phone/website" }
Rules: one idea per scene; headlines under 7 words, lines under 10 words; scene 1 is a strong hook; the last scene is the call to action
with the phone/website and lasts at least 4 seconds; use the business's exact names, prices, numbers and addresses and never invent any;
put prices as ₦12,500; menu scenes list one product per line ("Jollof rice ₦2,500"); a scene listing strengths joins them with " · ".
Use every uploaded image where it helps (logo in the brand scene and the call to action). Follow the user's special instructions exactly.
With narration on, write one natural spoken line per scene (about 2.3 words per second of the scene).`;

export async function briefToPlan(brief, { assets = [], limits, palette, style = null } = {}) {
  const b = cleanBrief(brief);
  const rules = briefToPlanRules(b, { assets, limits, palette });
  if (!config.useGemini) return { plan: rules, source: 'rules' };
  try {
    const images = assets.filter((a) => a.kind === 'image');
    const { text } = await geminiGenerate({
      system: PLAN_SYSTEM, json: true, temperature: 0.7, timeoutMs: 60000,
      messages: [{ role: 'user', text: `ANSWERS:\n${JSON.stringify({ ...b, step: undefined, done: undefined })}\nVIDEO: ${rules.duration_seconds} seconds, ${rules.aspect_ratio}${style ? `, style "${style.name}"` : ''}\nIMAGES: ${images.length ? images.map((a) => `"${a.name}" (${a.role || 'photo'})`).join(', ') : 'none'}\nNarration: ${b.voiceover ? 'on' : 'off'}` }],
    });
    const g = JSON.parse(String(text).replace(/^```(?:json)?|```$/g, '').trim());
    const sc = (g.scenes || []).filter((s) => s && [].concat(s.on_screen_text || []).filter(Boolean).length).slice(0, 10);
    if (sc.length < 2) throw new Error('too few scenes');
    const D = rules.duration_seconds, tot = sc.reduce((a, s) => a + Math.max(2, Number(s.seconds) || 4), 0);
    let t = 0;
    const names = new Set(images.map((a) => a.name));
    const scenes = sc.map((s, i) => {
      const end = i === sc.length - 1 ? D : Math.round((t + (D * Math.max(2, Number(s.seconds) || 4)) / tot) * 10) / 10;
      const o = { id: i + 1, start: t, end, purpose: str(s.purpose, 20) || 'detail', on_screen_text: [].concat(s.on_screen_text).map((x) => str(x, 90)).filter(Boolean).slice(0, 6),
        images: (s.images || []).filter((im) => names.has(im?.asset)).map((im) => ({ asset: im.asset, placement: str(im.placement, 30) || 'center' })) };
      if (b.voiceover && s.voiceover) o.voiceover = str(s.voiceover, 400);
      t = end; return o;
    });
    const plan = { ...rules, title: str(g.title, 110) || rules.title, business: { ...rules.business, ...Object.fromEntries(Object.entries(g.business || {}).map(([k, v]) => [k, str(v, 80)]).filter(([, v]) => v)) },
      scenes, cta: str(g.cta, 80) || rules.cta };
    const problems = validatePlan(plan, limits || {});
    if (problems.length) throw new Error(problems.join('; '));
    return { plan, source: 'gemini' };
  } catch (e) {
    console.warn('[brief] Gemini plan failed, using rules:', e.message);
    return { plan: rules, source: 'rules' };
  }
}

// ---------------------------------------------------------------------------
// Suggested answers (chips) for the open questions
// ---------------------------------------------------------------------------
const FEATURES = {
  food: ['Fresh every day', 'Fast delivery', 'Affordable prices', 'Big portions', 'Order on WhatsApp', 'Clean kitchen', 'Catering for events', 'Open late'],
  fashion: ['New arrivals weekly', 'Quality fabrics', 'Nationwide delivery', 'Custom fittings', 'Affordable luxury', 'Made in Nigeria', 'Easy returns', 'Styled for you'],
  beauty: ['Expert stylists', 'Home service', 'Premium products', 'Walk-ins welcome', 'Affordable packages', 'Clean and relaxing', 'Bridal packages', 'Book on WhatsApp'],
  tech: ['Fast and secure', 'Easy to use', '24/7 support', 'Works offline', 'Free trial', 'Local support', 'Made for Nigeria', 'Pay in naira'],
  finance: ['Instant transfers', 'Zero hidden fees', 'Bank-level security', 'Open an account in minutes', '24/7 support', 'Licensed and regulated', 'Low charges', 'Easy loans'],
  health: ['Qualified doctors', 'Same-day results', 'Affordable care', 'Clean and safe', 'Open every day', 'Modern equipment', 'Caring staff', 'Home visits'],
  realestate: ['Prime locations', 'Flexible payment', 'Verified titles', 'Ready to move in', 'Inspection anytime', 'Good road access', 'Secure estate', 'Instant allocation'],
  events: ['Unforgettable experience', 'Live music', 'Top vendors', 'Free entry', 'Limited tickets', 'Great food and drinks', 'Perfect venue', 'Photo moments'],
  education: ['Qualified teachers', 'Small classes', 'Modern facilities', 'Great results', 'Safe environment', 'Affordable fees', 'Extra lessons', 'Proven track record'],
  default: ['Trusted by customers', 'Fast service', 'Affordable prices', 'Quality you can see', 'Open every day', 'Friendly staff', 'Easy to reach', 'Satisfaction guaranteed'],
};
const catKey = (c = '') => (/food|drink|restaurant|kitchen|bak|cake/i.test(c) ? 'food' : /fashion|cloth|wear|boutique/i.test(c) ? 'fashion' : /beauty|salon|hair|spa|makeup/i.test(c) ? 'beauty'
  : /tech|software|app|gadget|computer|phone/i.test(c) ? 'tech' : /financ|pay|bank|loan|fintech/i.test(c) ? 'finance' : /health|clinic|pharm|fitness|gym/i.test(c) ? 'health'
    : /real|estate|property|home/i.test(c) ? 'realestate' : /event|party|show|concert|wedding/i.test(c) ? 'events' : /school|educat|lesson|academy/i.test(c) ? 'education' : 'default');

function ruleSuggestions(kind, b) {
  const n = b.name || 'us';
  if (kind === 'features') return FEATURES[catKey(b.category)];
  const byGoal = {
    offer: [`Big deals at ${n} this week`, 'Limited offer. Don\'t miss it!', 'Save more when you order today', `${n}: prices you'll love`],
    launch: [`Introducing the new ${n}`, 'Something new just arrived', `Meet the all-new ${n}`, 'The wait is over'],
    orders: [`Order from ${n} today`, 'Book now, it only takes a minute', `Hungry for quality? Try ${n}`, 'Your next favourite is one tap away'],
    brand: [`${n}. Made for you.`, 'Quality you can trust', `Why everyone is talking about ${n}`, 'Different. Better. Yours.'],
    event: ['You\'re invited!', 'Save the date', 'The biggest event of the year', 'Don\'t miss out'],
  };
  const g = /offer|sale|discount|promo/i.test(b.goal || '') ? 'offer' : /launch|new/i.test(b.goal || '') ? 'launch' : /order|book/i.test(b.goal || '') ? 'orders' : /event/i.test(b.goal || '') ? 'event' : 'brand';
  return byGoal[g];
}

export async function suggest(kind, brief) {
  const b = cleanBrief(brief);
  const fallback = ruleSuggestions(kind, b);
  if (!config.useGemini) return fallback;
  try {
    const ask = kind === 'features'
      ? 'Suggest 8 short selling points (2-4 words each) this business could show in its ad.'
      : 'Suggest 5 punchy ad headlines (under 7 words each) for this ad. Different angles: benefit, curiosity, offer, emotion, trust.';
    const { text } = await geminiGenerate({
      system: 'You write copy for short video ads for Nigerian small businesses. Return JSON only: { "options": ["...", "..."] }. Use the business name naturally; never invent prices or numbers.',
      messages: [{ role: 'user', text: `${ask}\nBusiness: ${b.name} (${b.category || 'business'}). Goal: ${b.goal || 'more customers'}.${b.headlines?.length ? ` Messages: ${b.headlines.join(' / ')}.` : ''}` }],
      json: true, temperature: 1, timeoutMs: 30000, maxOutputTokens: 4096, thinking: 'low',
    });
    const opts = (JSON.parse(text).options || []).map((x) => str(x, 70)).filter(Boolean).slice(0, kind === 'features' ? 8 : 5);
    return opts.length >= 2 ? opts : fallback;
  } catch {
    return fallback;
  }
}

/** Pick a starter style that fits the business when the user lets AdFlash choose. */
export function autoStyleSlug(brief) {
  const b = cleanBrief(brief);
  return {
    food: 'naija-bold', fashion: 'street-hype', beauty: 'beauty-bloom', tech: 'midnight-glow', finance: 'fintech-blue', health: 'health-pulse',
    realestate: 'prime-estate', events: 'owambe-party', education: 'clean-pro', default: 'studio-white',
  }[catKey(b.category)];
}

// ---------------------------------------------------------------------------
// "Paste everything at once": read a free-text description into brief fields.
// Only fields the text actually states are returned; the plan page then asks for the rest.
// ---------------------------------------------------------------------------
const ASPECT_WORDS = [[/landscape|16\s*[:x/]\s*9|youtube|horizontal|wide/i, '16:9'], [/square|1\s*[:x/]\s*1|instagram feed|facebook feed/i, '1:1'], [/portrait|vertical|9\s*[:x/]\s*16|tiktok|reels?|status|shorts|stories/i, '9:16']];

export function parseBriefRules(text) {
  const t = String(text || '');
  const out = {};
  const phone = t.match(PHONE_RE)?.[0];
  const site = t.match(URL_RE)?.[0];
  const addr = t.match(/(?:address|located at|we are at|find us at|location)\s*[:-]?\s*([^\n.]{4,80})/i)?.[1];
  const contact = [phone, site, addr].filter(Boolean).join(', ');
  if (contact) out.contact = contact;
  for (const [re, v] of ASPECT_WORDS) if (re.test(t)) { out.aspect = v; break; }
  const sec = t.match(/(\d{1,3})\s*(?:s\b|secs?\b|seconds?\b)/i)?.[1] || (t.match(/(\d)\s*(?:min|minutes?)\b/i)?.[1] * 60);
  if (sec) out.duration = Number(sec);
  const name = t.match(/(?:business(?:\s+name)?\s*(?:is|:|-)|(?:company|brand|shop|store)\s+(?:name\s+)?(?:is|:)|(?:called|named))\s*["'“‘]?([A-Z0-9][\w&'’. -]{1,40}?)["'”’]?(?=[,.\n”"]|\s+(?:and|we|i|in|at|is)\b|$)/i)?.[1];
  if (name) out.name = name.trim();
  const priced = t.split(/\n|;|\.\s+(?=[A-Z])/).map((l) => l.trim()).filter((l) => /(₦|N\s?\d|naira|\d+k\b)/i.test(l) && l.length < 70);
  if (priced.length) out.products = priced.slice(0, 8);
  if (/no (music|sound|audio)|without (music|sound)|silent/i.test(t)) out.sound = 'none';
  else if (/only (sound )?effects|no music/i.test(t)) out.sound = 'sfx';
  if (/voice[- ]?over|narrat/i.test(t)) out.voiceover = !/no (voice|narrat)/i.test(t);
  out.pasteText = str(t, 6000);   // the whole text also goes to the AI director (kept apart from the last question's answer)
  return out;
}

export async function parseBrief(text, current = {}) {
  const rules = parseBriefRules(text);
  if (!config.useGemini) return cleanBrief({ ...rules, mode: 'paste' });
  try {
    const { text: out } = await geminiGenerate({
      system: `You read a business owner's description of the video ad they want and fill in a form. Return JSON only with any of these keys, and ONLY for things the text clearly says (leave everything else out, never invent):
{ "name": business name, "category": what the business does (2-4 words), "goals": ["..."] (why they want the ad),
  "headlines": ["..."] (the main messages / slogans for the video, short), "features": ["..."] (selling points, 2-5 words each),
  "products": ["Product ₦price", ...], "ctas": ["Order on WhatsApp", "Call now", ...] (what viewers should do), "contact": phone / website / address,
  "aspect": "9:16" | "16:9" | "1:1", "duration": seconds, "voiceover": true/false, "sound": "all" | "sfx" | "none",
  "extra": any other instructions about the look, scenes, pictures or style, in their words }`,
      messages: [{ role: 'user', text: `Already known: ${JSON.stringify({ name: current.name, category: current.category })}\n\nTHEIR TEXT:\n${String(text).slice(0, 6000)}` }],
      json: true, temperature: 0.2, timeoutMs: 50000, maxOutputTokens: 8192, thinking: 'low',
    });
    const g = JSON.parse(out);
    // the AI wins where it found something; rules fill gaps (phone numbers, aspect words); keep the full text for the director
    const merged = { ...rules, ...Object.fromEntries(Object.entries(g).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length))) };
    delete merged.extra;   // the last question asks for anything extra; the full text goes to the director as pasteText
    return cleanBrief({ ...merged, mode: 'paste' });
  } catch (e) {
    console.warn('[brief] Gemini paste reading failed, using rules:', e.message);
    return { ...cleanBrief({ ...rules, mode: 'paste' }), aiError: String(e.message).slice(0, 160) };
  }
}
