// The guided question flow ("brief") -> a video plan.
// The plan page asks one question at a time (business name, what you do, goal, message, products,
// strengths, call to action, contact, format, length, pictures, style, narration, special instructions).
// Each answer is stored once, so no question is ever asked twice. This file turns the finished brief
// into the plan the rest of AdFlash uses: Gemini writes it when available, our own rules otherwise.

import { config } from '../config.js';
import { geminiGenerate } from '../engine/gemini.js';
import { birthdayPhotoAssets, isPersonalBirthdayBrief } from './personal.js';
import { videoGroup, closingLine, fitCtas, MEMORIAL } from './closing.js';

// Reading someone's idea and writing the video plan are the steps where a small model sounds dumb and repeats itself,
// so they use the full Flash model (the lighter one stays for quick chat). Override with GEMINI_BRIEF_MODEL.
const BRIEF_MODEL = () => process.env.GEMINI_BRIEF_MODEL || 'gemini-flash-latest';
import { validatePlan } from '../engine/validate.js';
import { WANT_IDS } from './cinema/compose.js';
import { MOTION_WANTS } from './motion/compose.js';
import { TEMPLATE_IDS } from './pieces/index.js';
import { CREATIVE_STANDARD } from './standard.js';

// fundraisers, donations and appeals
export const CAUSE_RE = /donat|fundrais|charity|appeal\b|\bngo\b|foundation|relief fund|crowdfund|help us (raise|build|support)|sponsor (a|our)|\bgive (to|today)|support (our|the) (cause|community|school|clinic|orphan)/i;
const BANKS = 'access|gtb(?:ank)?|guaranty trust|zenith|uba|united bank|first ?bank|fidelity|fcmb|sterling|stanbic|wema|union|polaris|keystone|ecobank|opay|palm ?pay|kuda|moniepoint|providus|jaiz|taj|titan|globus|lotus|carbon|paga';
/** "GTBank 0123456789 Community Health Initiative" from free text: bank + 10-digit account number + account name. */
export function findPayment(text) {
  const t = String(text || '');
  const m = t.match(new RegExp(`(?:acc(?:ount)?(?:\\s*(?:no|num|number))?\\.?\\s*[:\\-]?\\s*)(\\d{10})\\b`, 'i')) || t.match(/\b(\d{10})\b(?=[^\n]{0,40}\b(?:bank|acct|account)\b)/i) || t.match(new RegExp(`\\b(?:${BANKS})\\b[^\\n\\d]{0,20}(\\d{10})\\b`, 'i'));
  if (!m) return '';
  const num = m[1];
  const bank = (t.match(new RegExp(`\\b(${BANKS})(?:\\s*bank)?\\b`, 'i')) || [])[0] || '';
  const nm = (t.match(/(?:account\s*name|acct\s*name|name)\s*[:\-]\s*([^\n,;.]{3,50})/i) || [])[1] || '';
  return [bank.replace(/\s+/g, ' ').trim(), num, nm.trim()].filter(Boolean).join(' · ');
}
const PHONE_RE = /(\+?234[\s-]?|0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}/;
const URL_RE = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|ng|com\.ng|space|app|io|co|org|net|store|shop)(?:\/\S*)?)\b/i;
// cut at a whole word, never in the middle of one ("This flyer was mad", "fix your devi")
const str = (v, max = 200) => { const t = v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); if (t.length <= max) return t; const c = t.slice(0, max), sp = c.lastIndexOf(' '); return (sp > max * 0.5 ? c.slice(0, sp) : c).replace(/[\s,;:&–—-]+$/, ''); };
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(/\n|;/)).map((x) => str(x, 80)).filter(Boolean);
// "anything", "whatever", "just make a demo"...: the owner wants us to choose. Never print these words in a video.
const VAGUE = /^(?:(?:just\s+)?(?:do|make|use|put|write|create|show)?\s*(?:me\s+)?(?:any\s*thing|anything|something|whatever|any|random(?:\s+stuff)?|a\s+demo(?:\s+video)?|demo(?:\s+video)?|test(?:ing)?|sample|example)(?:\s+(?:at\s+all|you\s+like|you\s+want|is\s+fine|works|video|ad))?|you\s+(?:choose|decide|pick)|your\s+choice|surprise\s+me|suggest(?:\s+(?:one|something|anything))?|idk|i\s+don'?t\s+know|no\s+idea|not\s+sure|nothing|none|n\/?a|na|nil|\.+|-+|\?+)[\s.!?]*$/i;
export const isVague = (s) => VAGUE.test(String(s || '').trim());
const keep = (arr) => arr.filter((x) => !isVague(x));

/** Keep only known fields, trimmed. */

// A name that is really an instruction ("Design a high-quality, professional Christian fellowship flyer") becomes a short title ("Christian Fellowship").
const ASK_WORDS = /^(please\s+)?(can you |could you |i want (you )?to |i need (you )?to |i want |i need )?(design|make|create|generate|build|produce|write|prepare|do)\b/i;
const FILLER = /\b(a|an|the|me|my|our|some|high[- ]?quality|professional|beautiful|nice|good|great|amazing|stunning|modern|simple|best|cool|awesome|attractive|catchy|premium|classy|elegant|flyer|flier|poster|video|ad|advert|advertisement|for|about|of|please)\b/gi;

// The title of a video from a pasted prompt: a quoted title, "the late <name>", or the first proper name. Never the instruction.
const NOT_NAMES = /^(?:generate|create|make|design|write|build|produce|please|can|could|i|we|our|my|the|a|an|this|that|it|its|call|whatsapp|dm|visit|order|book|keep|use|add|include|show|let|also|and|but|then|for|with|on|at|in|to|from|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|today|tomorrow|tonight|video|ad|advert|flyer|status|whatsapp|instagram|tiktok|youtube|facebook|reels?|nigeria|lagos|ibadan|abuja|ado|ekiti|ikeja|lekki|yaba|ogun|oyo|god|lord|jesus|christ|hello|hi|dear|thanks|thank|make|emotional|fun|funny|professional|colourful|colorful|vertical|landscape|square|portrait|seconds?|secs?|minutes?)$/i;
export function subjectFromPrompt(text) {
  const t = String(text || '');
  const late = t.match(/\b(?:the\s+)?late\s+((?:(?:Chief|Mr|Mrs|Miss|Dr|Pastor|Elder|Prof|Alhaji|Alhaja|Engr|Mama|Papa|Pa|Ma|Sir|Lady|Evangelist|Deaconess|Deacon|Rev|Hon|Barr)\.?\s+)?[A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){0,3})/u);
  if (late) return `Late ${late[1].trim()}`;
  const quoted = [...t.matchAll(/["“‘]([^"”’\n]{3,50})["”’]/g)].map((m) => m[1].trim()).find((q) => !/\d{7,}/.test(q) && q.split(/\s+/).length <= 7 && /^[A-Z0-9]/.test(q));
  if (quoted) return quoted;
  const re = /(?<![\p{L}\d'’])([A-Z][\p{L}&'’.-]*(?:\s+(?:of|and|&|the|for)\s+[A-Z][\p{L}&'’.-]*|\s+[A-Z][\p{L}&'’.-]*){0,4})/gu;
  for (const m of t.matchAll(re)) {
    const words = m[1].trim().split(/\s+/);
    while (words.length && NOT_NAMES.test(words[0].replace(/[.,]$/, ''))) words.shift();
    while (words.length && NOT_NAMES.test(words[words.length - 1].replace(/[.,]$/, ''))) words.pop();
    if (words.length && !NOT_NAMES.test(words.join(' ')) && words.join(' ').length >= 3) return words.join(' ').replace(/[.,]$/, '');
  }
  return '';
}
export function titleFromName(raw) {
  const t = str(raw, 120);
  if (!t) return '';
  if (!ASK_WORDS.test(t) && t.length <= 60) return str(t, 60);
  if (!ASK_WORDS.test(t)) return str(t, 60);
  const core = t.replace(ASK_WORDS, ' ').replace(FILLER, ' ').replace(/[,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  return str(core.replace(/\b\p{L}/gu, (c) => c.toUpperCase()), 60);
}
export function cleanBrief(b = {}) {
  const out = {
    name: titleFromName(b.name), category: str(b.category, 60),
    relationship: str(b.relationship, 50), milestone: str(b.milestone, 60),
    personalMessage: str(b.personalMessage, 1200), memories: list(b.memories).slice(0, 8),
    // what the video is for: a business ad, an event, a personal moment, an announcement
    kind: ['business', 'event', 'personal', 'announcement', 'cause', 'other'].includes(b.kind) ? b.kind : (CAUSE_RE.test(`${b.category || ''} ${b.name || ''}`) ? 'cause' : undefined),
    // fundraising: where gifts go (bank, account number, account name). Shown exactly as written, never treated as a phone number.
    payment: str(b.payment, 120),
    // goal: one or more; `goal` is them joined (used in prompts and titles), `goals` the list
    goals: list(Array.isArray(b.goals) ? b.goals : Array.isArray(b.goal) ? b.goal : b.goal ? [b.goal] : []).slice(0, 6),
    // main message: one or more (up to 8); `headline` is the first, `headlines` all of them
    headlines: list(Array.isArray(b.headlines) ? b.headlines : Array.isArray(b.headline) ? b.headline : b.headline ? [b.headline] : []).slice(0, 8),
    products: list(b.products).slice(0, 8), features: list(b.features).slice(0, 8),
    // what to do after watching: one or more; `cta` is the first, `ctas` all of them
    ctas: list(Array.isArray(b.ctas) ? b.ctas : Array.isArray(b.cta) ? b.cta : b.cta ? [b.cta] : []).slice(0, 5),
    contact: str(b.contact, 120), aspect: ['9:16', '16:9', '1:1', '4:5', 'A4'].includes(b.aspect) ? b.aspect : undefined,
    duration: Number(b.duration) || undefined, styleId: b.styleId ? String(b.styleId) : undefined, styleAuto: !!b.styleAuto,
    videoEngine: ['motion', 'pieces'].includes(b.videoEngine) ? b.videoEngine : undefined,
    colors: b.colors && typeof b.colors === 'object' ? Object.fromEntries(Object.entries(b.colors).filter(([k, v]) => ['primary', 'secondary', 'background', 'text'].includes(k) && /^#[0-9a-f]{6}$/i.test(v))) : undefined,
    voiceover: b.voiceover === undefined || b.voiceover === null ? undefined : [true, 'yes', 'female', 'male'].includes(b.voiceover),
    voiceGender: b.voiceover === 'male' || b.voiceGender === 'male' ? 'male' : b.voiceover === 'female' || b.voiceGender === 'female' ? 'female' : undefined,
    sound: ['all', 'sfx', 'none', 'own'].includes(b.sound) ? b.sound : b.sfx === true || b.sfx === 'yes' ? 'all' : b.sfx === false || b.sfx === 'no' ? 'none' : undefined,
    // which scene styles the owner asked for (ids from the form's scene picker); sceneAuto = let the AI decide
    scenes: (Array.isArray(b.scenes) ? b.scenes : []).map(String).filter((x) => WANT_IDS.includes(x) || x in MOTION_WANTS).slice(0, 8), sceneAuto: b.sceneAuto === undefined ? undefined : !!b.sceneAuto,
    // flyer-only answers
    flyerType: (Array.isArray(b.flyerType) ? list(b.flyerType) : b.flyerType ? [str(b.flyerType, 60)] : []).map((x) => str(x, 60)).filter(Boolean).slice(0, 3), offer: str(b.offer, 60), when: str(b.when, 120), layout: ['photo', 'type', 'price', 'auto'].includes(b.layout) ? b.layout : undefined,
    // exact on-screen wording the owner gave (shown as written, in order, as picture captions first); slideshow = show every picture one after another
    phrases: (Array.isArray(b.phrases) ? b.phrases : String(b.phrases || '').split(/\n/)).map((x) => str(x, 90)).filter(Boolean).slice(0, 12), slideshow: b.slideshow === true || b.slideshow === 'yes' ? true : undefined,
    personalPhotoIds: (Array.isArray(b.personalPhotoIds) ? b.personalPhotoIds : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 10),
    steps: list(b.steps).slice(0, 8), lookAuto: ['auto', 'own'].includes(b.lookAuto) ? b.lookAuto : undefined,
    extra: str(b.extra, 3000), done: !!b.done, mode: ['steps', 'paste'].includes(b.mode) ? b.mode : undefined, pasted: b.pasted ? true : undefined, pasteText: str(b.pasteText, 6000),
    colorMode: ['style', 'logo', 'own'].includes(b.colorMode) ? b.colorMode : undefined, picturesDone: b.picturesDone ? true : undefined,
    // signature templates (After Effects-style recipes); 'auto' or empty means the library mixes its own film
    template: b.template === 'auto' || TEMPLATE_IDS.includes(b.template) ? b.template : undefined,
    intensity: ['auto', 'elegant', 'aggressive', 'mechanical', 'fluid'].includes(b.intensity) ? b.intensity : undefined,
    soundStyle: ['beat', 'cinematic', 'ambient', 'none'].includes(b.soundStyle) ? b.soundStyle : undefined,
    quality: ['preview', 'premium', 'max'].includes(b.quality) ? b.quality : undefined,
  };
  // optional questions the user skipped (so they are not asked again)
  for (const k of ['steps', 'lookAuto', 'features', 'products', 'contact', 'pictures', 'extra', 'scenes', 'category', 'goal', 'headline', 'cta', 'aspect', 'duration', 'colors', 'style', 'template', 'intensity', 'voiceover', 'sound', 'flyerType', 'layout', 'offer', 'when', 'payment', 'relationship', 'milestone', 'personalMessage', 'memories']) if (b[`${k}Skipped`] !== undefined) out[`${k}Skipped`] = !!b[`${k}Skipped`];
  if (out.headlines.length) out.headline = out.headlines[0]; else delete out.headlines;
  { const fit = fitCtas(out); out.ctas = out.ctas.filter((x) => fit.includes(x)); }   // no shop lines on a wedding, tribute or event
  if (out.ctas.length) out.cta = str(out.ctas[0], 60); else { delete out.ctas; if (out.cta) delete out.cta; }
  if (out.goals.length) out.goal = str(out.goals.join(' + '), 200); else delete out.goals;
  if (Array.isArray(out.flyerType) && !out.flyerType.length) delete out.flyerType;
  // vague answers ("anything", "just make a demo") are dropped; demo = invent sample content for this kind of business
  let vague = false;
  // "none", "n/a", "skip" typed into a box are answers meaning nothing: never print them on a video or flyer
  { const NONE = /^(none|n\/?a|nil|nothing|no|skip|skipped|-+|\.+|null|undefined)\.?$/i;
    for (const [k, v] of Object.entries(out)) {
      if (typeof v === 'string' && NONE.test(v.trim()) && !['mode', 'kind', 'aspect', 'voiceover', 'sound'].includes(k)) delete out[k];
      else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) out[k] = v.filter((x) => !NONE.test(x.trim()));
    } }
  for (const k of ['name', 'category', 'contact', 'extra', 'pasteText', 'offer', 'when', 'goal', 'headline', 'cta', 'relationship', 'milestone', 'personalMessage']) if (typeof out[k] === 'string' && isVague(out[k])) { out[k] = ''; vague = true; }
  for (const k of ['goals', 'headlines', 'products', 'features', 'ctas', 'steps', 'memories']) if (Array.isArray(out[k])) { const n = out[k].length; out[k] = keep(out[k]); if (out[k].length < n) vague = true; if (!out[k].length) delete out[k]; }
  if (out.headline === '' && out.headlines?.length) out.headline = out.headlines[0];
  if (out.cta === '' && out.ctas?.length) out.cta = str(out.ctas[0], 60);
  if (vague || b.demo) out.demo = true;
  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === '') delete out[k];
  return out;
}

// Sample content when the owner said "anything" / "make a demo": a believable business of the kind they chose
// (the AI writes it; built-in samples without a key). Only fills what is missing: real answers always win.
const SAMPLES = {
  food: { name: 'Mama Tee Kitchen', category: 'Food & drinks', headlines: ['Hot meals, delivered fast', 'Taste the difference'], features: ['Fresh every day', 'Fast delivery', 'Fair prices'], products: ['Jollof rice ₦2,500', 'Fried rice ₦2,800', 'Small chops ₦1,500'], cta: 'Order on WhatsApp' },
  tech: { name: 'Taskly', category: 'Tech & software', headlines: ['Your day, organised', 'Plan less, do more'], features: ['Smart reminders', 'Works offline', 'Team sharing'], products: [], cta: 'Download the app' },
  fashion: { name: 'Adire House', category: 'Fashion & clothing', headlines: ['Wear your story', 'New collection is here'], features: ['Handmade prints', 'Custom fits', 'Nationwide delivery'], products: ['Adire shirt ₦12,000', 'Two-piece set ₦25,000'], cta: 'DM us on Instagram' },
  beauty: { name: 'Glow Lounge', category: 'Beauty & salon', headlines: ['Look good, feel better', 'Your glow-up starts here'], features: ['Expert stylists', 'Clean studio', 'Easy booking'], products: ['Braids from ₦8,000', 'Facials from ₦10,000'], cta: 'Book now' },
  generic: { name: 'Nova Studio', category: 'Services', headlines: ['Made for people who want more', 'Quality you can see'], features: ['Fast service', 'Trusted by customers', 'Fair prices'], products: [], cta: 'Call now' },
};
const sampleFor = (cat = '') => (/food|drink|restaurant|kitchen|cake/i.test(cat) ? SAMPLES.food : /tech|software|app/i.test(cat) ? SAMPLES.tech : /fashion|cloth/i.test(cat) ? SAMPLES.fashion : /beauty|salon|hair|spa/i.test(cat) ? SAMPLES.beauty : SAMPLES.generic);
export async function fillDemoBrief(brief, { flyer = false } = {}) {
  if (!brief?.demo) return brief;
  let s = sampleFor(brief.category);
  if (config.useGemini) {
    try {
      const { text } = await geminiGenerate({
        system: `You invent believable sample content for a ${flyer ? 'flyer' : 'video ad'} demo for a Nigerian small business. Plain words, no marketing jargon, no fake numbers, reviews or awards. Return JSON only.`,
        messages: [{ role: 'user', text: `Known: ${JSON.stringify({ name: brief.name, category: brief.category, products: brief.products, extra: brief.extra })}
Invent what is missing. Return { "name": "", "category": "", "headlines": ["2-3 short messages, under 7 words"], "features": ["3 selling points, 2-4 words"], "products": ["0-3 'Item ₦price' lines, only if the business sells items"], "cta": "" }` }],
        json: true, temperature: 0.9, timeoutMs: 25000, maxOutputTokens: 2048, thinking: 'low',
      });
      const g = JSON.parse(text);
      if (g && g.name) s = { name: str(g.name, 60), category: str(g.category, 60) || s.category, headlines: list(g.headlines).slice(0, 3), features: list(g.features).slice(0, 4), products: list(g.products).slice(0, 3), cta: str(g.cta, 40) || s.cta };
    } catch { /* built-in sample */ }
  }
  const out = { ...brief };
  if (!out.name) out.name = s.name;
  if (!out.category) out.category = s.category;
  if (!out.headlines?.length) { out.headlines = s.headlines; out.headline = s.headlines[0]; }
  if (!out.features?.length) out.features = s.features;
  if (!out.products?.length && s.products?.length) out.products = s.products;
  if (!out.ctas?.length) { out.ctas = [s.cta]; out.cta = s.cta; }
  return out;
}

// Own/logo colours: keep text readable on the chosen background.
function lum(hex) { const n = parseInt(String(hex).slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function readable(colors, chosen) {
  if (!chosen?.background || chosen.text || !/^#[0-9a-f]{6}$/i.test(colors.background || '')) return colors;
  return { ...colors, text: lum(colors.background) > 0.4 ? '#111318' : '#F7F7FA' };
}

function birthdayAge(value) {
  const n = Number(String(value || '').match(/\d{1,2}/)?.[0]);
  if (!n) return str(value, 30);
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${suffix}`;
}

function shortPersonalLines(value, limit = 8) {
  const words = String(value || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  for (let i = 0; i < words.length; i += 8) lines.push(words.slice(i, i + 8).join(' '));
  return lines.map((x) => str(x, 90)).filter(Boolean).slice(0, limit);
}

function birthdayPlan(b, { assets, limits, palette }) {
  const min = limits.minSeconds || 15, max = limits.maxSeconds || 300;
  const photos = birthdayPhotoAssets(assets, b);
  const name = b.name || 'Someone special';
  const relationship = str(b.relationship, 40).replace(/^(my|our)\s+/i, '').toLowerCase();
  const age = birthdayAge(b.milestone);
  const greeting = `Happy${age ? ` ${age}` : ''} Birthday${name ? `, ${name}` : ''}!`;
  const memories = (b.memories || []).flatMap((x) => shortPersonalLines(x, 2)).slice(0, 4);
  const message = b.personalMessage
    ? shortPersonalLines(b.personalMessage, 8)
    : ['May your new age be filled with blessings.', 'Wishing you joy, good health and beautiful opportunities.', "I'm so happy to celebrate you."];
  const closing = `Blessed new age, ${name}!`;
  const lines = [
    { purpose: 'hook', text: [greeting], weight: 1.25, photo: photos[0] },
    { purpose: 'brand', text: [name, relationship ? `From your ${relationship}` : 'A day all about you'], weight: 1.05 },
    ...memories.map((x, i) => ({ purpose: 'detail', text: [x], weight: 1, photo: photos[i + 1] })),
    ...message.map((x) => ({ purpose: 'detail', text: [x], weight: 1 })),
    { purpose: 'cta', text: [closing], weight: 1.2 },
  ];
  const needed = Math.ceil((lines.length * 3.5) / 5) * 5;
  const D = Math.max(min, Math.min(max, Math.max(b.duration || 20, needed)));
  const total = lines.reduce((sum, s) => sum + s.weight, 0);
  let t = 0;
  const scenes = lines.map((s, i) => {
    const end = i === lines.length - 1 ? D : Math.round((t + (D * s.weight) / total) * 10) / 10;
    const text = s.text.filter(Boolean);
    const scene = { id: i + 1, start: t, end, purpose: s.purpose, on_screen_text: text, images: s.photo ? [{ asset: s.photo.name, placement: i === 0 ? 'background' : 'center' }] : [] };
    if (b.voiceover) scene.voiceover = (i === 0 ? greeting : text.join('. ')).slice(0, 180);
    t = end;
    return scene;
  });
  return {
    title: `${name}'s ${age ? `${age} ` : ''}Birthday`.slice(0, 110),
    business: { name, category: 'Birthday celebration', location: '', phone: '', handle: '' },
    aspect_ratio: b.aspect || '9:16', duration_seconds: D,
    style: { colors: readable({ ...(palette || {}), ...(b.colors || {}) }, b.colors) },
    assets: photos.map((a) => ({ name: a.name, url: a.url, use: 'personal photo' })),
    scenes,
    voiceover: b.voiceover ? { enabled: true, source: 'ai', voice_style: 'warm, sincere and celebratory', captions: true } : { enabled: false },
    cta: closing, goal: 'Celebrate someone special',
    special_instructions: [
      'This is a personal birthday greeting, not a business advert. Do not add prices, sales language, contact details, or a call to action.',
      `Recipient: ${name}${relationship ? `; the sender is their ${relationship}` : ''}${age ? `; celebrating ${age}` : ''}.`,
      b.personalMessage ? `Use the sender's own message and preserve its meaning: ${b.personalMessage}` : 'Use the warm birthday wishes in the scene plan. Do not invent personal history or personality traits.',
      memories.length ? `Use only these personal details: ${memories.join(' · ')}` : '', b.extra,
    ].filter(Boolean).join('\n\n'),
    sound: b.sound || 'all', sfx: b.sound !== 'none',
    music_url: b.sound === 'own' ? (assets.find((a) => a.kind === 'audio' && a.role === 'music') || {}).url || '' : '',
  };
}

// ---------------------------------------------------------------------------
// Rule-based plan (always works)
// ---------------------------------------------------------------------------
export function briefToPlanRules(brief, { assets = [], limits = { minSeconds: 15, maxSeconds: 300 }, palette = null } = {}) {
  // cleanBrief drops empty lists (a skipped question), so every list is read with a safe default here
  const b = { ...cleanBrief(brief) }; for (const k of ['features', 'products', 'headlines', 'ctas', 'goals', 'steps']) if (!Array.isArray(b[k])) b[k] = [];
  let D = Math.max(limits.minSeconds || 15, Math.min(limits.maxSeconds || 300, b.duration || 20));
  const images = assets.filter((a) => a.kind === 'image');
  if (isPersonalBirthdayBrief(b)) return birthdayPlan(b, { assets, limits, palette });
  const logo = images.find((a) => a.role === 'logo');
  const photos = images.filter((a) => a.role !== 'logo');
  const pay = b.payment || '';
  const phone = pay || (b.contact || '').match(PHONE_RE)?.[0] || '';
  const site = pay ? '' : (b.contact || '').match(URL_RE)?.[0] || '';
  const place = pay ? '' : str((b.contact || '').replace(phone, '').replace(site, '').replace(/^[\s,·|-]+|[\s,·|-]+$/g, ''), 60);
  const action = b.cta || (pay || b.kind === 'cause' ? 'Donate today' : videoGroup(b) === 'social' ? closingLine(b) : phone ? 'Call or WhatsApp us' : site ? 'Visit our website' : 'Contact us today');
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

  // Never show the same line twice: a thin brief used to repeat the name in every scene ("Visit here" x5).
  {
    const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const last = scenes[scenes.length - 1];
    const ctaKeys = new Set(last.on_screen_text.map(norm));
    const seen = new Set();
    for (const s of scenes.slice(0, -1)) {
      s.on_screen_text = s.on_screen_text.filter((x) => { const k = norm(x); if (!k || seen.has(k)) return false; seen.add(k); return true; });
    }
    for (let i = scenes.length - 2; i >= 1; i--) if (!scenes[i].on_screen_text.length) scenes.splice(i, 1);   // keep the opening scene
    if (!scenes[0].on_screen_text.length) scenes[0].on_screen_text = [action];
    last.on_screen_text = last.on_screen_text.filter((x) => { const k = norm(x); return k && !(seen.has(k) && ctaKeys.size > 1); });
    if (!last.on_screen_text.length) last.on_screen_text = [action];
    // a closing line that is word-for-word the opening one is dropped from the opening scene instead
    if (scenes.length > 1 && scenes[0].on_screen_text.length === 1 && norm(scenes[0].on_screen_text[0]) === norm(last.on_screen_text[0]) && (b.category || place)) scenes[0].on_screen_text = [b.category || place];
  }

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
    special_instructions: [b.kind === 'cause' ? 'This is a fundraising video for a cause, not a business advert. Never invent statistics, quotes, ratings, stars, reviews or testimonials, and never present the organiser\'s own words as a customer review. Show the account details exactly as given, as an account to give to (never as a phone number to call). Speak about the cause and the people it helps.' : b.kind && b.kind !== 'business' ? `This is a ${b.kind} video, not a business advert. Do not add selling language, prices, "order now" or contact calls unless the person asked for them.` : '', b.extra, b.pasteText && `The business owner's full description (follow it): ${b.pasteText}`].filter(Boolean).join('\n\n'),
    sound: b.sound || 'all',
    sfx: b.sound !== 'none',
    music_url: b.sound === 'own' ? (assets.find((a) => a.kind === 'audio' && a.role === 'music') || {}).url || '' : '',
  };
}

// ---------------------------------------------------------------------------
// Gemini plan (better copy, follows the special instructions)
// ---------------------------------------------------------------------------
const PLAN_SYSTEM = `${CREATIVE_STANDARD}
You turn a small business's answers into a motion-graphics video ad plan. Do not ask questions.
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
      system: PLAN_SYSTEM, model: BRIEF_MODEL(), json: true, temperature: 0.7, timeoutMs: 30000, thinking: 'low', maxOutputTokens: 4096,
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
// Several good looks per kind of business, chosen by the name, so two flyers or videos never come out the same.
const LOOK_POOLS = {
  food: ['naija-bold', 'fresh-market', 'retro-pop'], fashion: ['street-hype', 'afro-vibes', 'mono-editorial'], beauty: ['beauty-bloom', 'gold-luxe', 'studio-white'],
  tech: ['midnight-glow', 'tech-pulse', 'neon-nights'], finance: ['fintech-blue', 'clean-pro', 'graphite-pro'], health: ['health-pulse', 'fresh-market', 'ocean-breeze'],
  realestate: ['prime-estate', 'graphite-pro', 'gold-luxe'], events: ['owambe-party', 'glory-light', 'gold-luxe', 'afro-vibes'], education: ['clean-pro', 'kiddies-fun', 'ocean-breeze'],
  memorial: ['mono-editorial', 'graphite-pro', 'prime-estate'], faith: ['glory-light', 'gold-luxe', 'prime-estate', 'ocean-breeze'], party: ['owambe-party', 'neon-nights', 'retro-pop', 'afro-vibes'], kids: ['kiddies-fun', 'retro-pop', 'ocean-breeze'], sports: ['sports-blitz', 'street-hype', 'neon-nights'],
  default: ['studio-white', 'clean-pro', 'mono-editorial', 'ocean-breeze', 'midnight-glow', 'afro-vibes'],
};
export function autoStyleSlug(brief) {
  const b = cleanBrief(brief);
  const t = `${b.category || ''} ${b.name || ''}`;
  const key = MEMORIAL.test(t) ? 'memorial' : /church|ministry|fellowship|worship|christian|mosque|islam|prayer|gospel|crusade|revival|assembly/i.test(t) ? 'faith'
    : /birthday|party|celebrat|wedding|anniversary|owambe/i.test(t) ? 'party' : /kid|children|nursery|toddler|baby/i.test(t) ? 'kids' : /sport|football|gym|fitness|training/i.test(t) ? 'sports' : catKey(b.category);
  let pool = LOOK_POOLS[key] || LOOK_POOLS.default;
  // the kente ribbon along the top and bottom is only for videos that ask for an African or cultural look
  if (!/afric|ankara|aso.?oke|kente|afro|adire|naija|cultur|traditional|owambe/i.test(`${t} ${b.styleNote || ''} ${b.extra || ''}`)) pool = pool.filter((x) => x !== 'afro-vibes');
  let h = 7; for (const ch of `${b.name || ''}|${b.category || ''}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
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
  { const q = [...t.matchAll(/["“]([^"”\n]{3,90})["”]/g)].map((m) => m[1].trim()).filter((x) => x && !PHONE_RE.test(x)); if (q.length) out.phrases = q.slice(0, 12); }
  if (/\b(slide ?show|slides? of (my )?(photos|pictures)|all (my |the )?(photos|pictures|images))\b/i.test(t)) out.slideshow = true;
  const sec = t.match(/(\d{1,3})\s*(?:s\b|secs?\b|seconds?\b)/i)?.[1] || (t.match(/(\d)\s*(?:min|minutes?)\b/i)?.[1] * 60);
  if (sec) out.duration = Number(sec);
  const name = t.match(/(?:business(?:\s+name)?\s*(?:is|:|-)|(?:company|brand|shop|store)\s+(?:name\s+)?(?:is|:)|(?:called|named))\s*["'“‘]?([A-Z0-9][\w&'’. -]{1,40}?)["'”’]?(?=[,.\n”"]|\s+(?:and|we|i|in|at|is)\b|$)/i)?.[1];
  if (name) out.name = name.trim();
  const priced = t.split(/\n|;|\.\s+(?=[A-Z])/).map((l) => l.trim()).filter((l) => /(₦|N\s?\d|naira|\d+k\b)/i.test(l) && l.length < 70);
  if (priced.length) out.products = priced.slice(0, 8);
  // what is sold or offered, and where / when, straight from the sentence ("We sell cupcakes and wedding cakes in Lekki")
  {
    const offers = t.match(/\b(?:we|i)\s+(?:sell|offer|make|provide|bake|cook|deliver|do|specialis[ez]e in|specialize in)\s+([^.\n;]{3,120})/i)?.[1] || t.match(/\bspeciali[sz]e[sd]?\s+in\s+([^.\n;]{3,120})/i)?.[1];
    if (offers) {
      const head = offers.split(/\s+(?:in|at|around|across|within|near)\s+(?=[A-Z])/)[0];
      const items = head.split(/\s*(?:,|&|\band\b)\s*/i).map((x) => x.trim().replace(/^(?:all|many|different|various|some|the)\s+/i, '')).filter((x) => x.length >= 3 && x.length <= 34 && !/^(?:more|others?|etc)$/i.test(x));
      if (items.length) out.features = items.slice(0, 5).map((x) => x.charAt(0).toUpperCase() + x.slice(1));
      const place = offers.match(/\b(?:in|at|around|across|within|near)\s+([A-Z][\p{L}' -]{2,30})/u)?.[1];
      if (place && !/\d/.test(place)) out.contact = [out.contact, place.trim()].filter(Boolean).join(', ');
    }
    const when = t.match(/\b((?:(?:this|next|on)\s+)?(?:mon|tues|wednes|thurs|fri|satur|sun)day\b[^.\n]{0,70}|tomorrow[^.\n]{0,50}|tonight[^.\n]{0,50}|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+\d{4})?[^.\n]{0,60})/i)?.[1];
    if (when && !/birthday|b-?day/i.test(t)) out.when = when.trim().replace(/[,;:\s]+$/, '').replace(/^on\s+/i, '');
  }
  if (/no (music|sound|audio)|without (music|sound)|silent/i.test(t)) out.sound = 'none';
  else if (/only (sound )?effects|no music/i.test(t)) out.sound = 'sfx';
  if (/voice[- ]?over|narrat/i.test(t)) out.voiceover = !/no (voice|narrat)/i.test(t);
  // a few words are enough: work out a title and the kind of video even without the AI
  const KINDS = [[CAUSE_RE, 'Fundraiser', 'cause'], [MEMORIAL, 'Burial or memorial', 'personal'], [/birthday|b-?day|anniversary/i, 'Birthday', 'personal'], [/church|ministry|sunday service|revival|crusade|mosque/i, 'Church event', 'event'],
    [/\bwe (?:sell|offer|make|provide|do|bake|cook|deliver)\b|\bour (?:shop|store|business|products?|services?|menu|brand)\b|\bpromo\b|\bpromotional\b|\badverts?\b|\bad for\b|\bdiscount|\bbakery|\brestaurant|\bsalon\b|\bboutique/i, 'Business', 'business'], [/wedding|engagement|bridal/i, 'Wedding', 'event'],
    [/graduat|convocation|school event|prize giving/i, 'Graduation', 'event'], [/announc|resum|notice|programme|program|invitation|invite|save the date/i, 'Announcement', 'announcement']];
  for (const [re, cat, kind] of KINDS) if (re.test(t)) { out.category = out.category || cat; out.kind = out.kind || kind; break; }
  if (out.kind === 'announcement') {
    const said = t.match(/\bannounc\w*\s+(?:that\s+|about\s+|the\s+)?([^.\n]{8,110})/i)?.[1];
    if (said) { const h = said.trim().replace(/\s+(?:keep|make|and make|please)\b.*$/i, '').replace(/[,;:\s]+$/, ''); out.headline = h.charAt(0).toUpperCase() + h.slice(1); }
  }
  const birthday = /birthday|b-?day/i.test(`${out.category || ''} ${t}`);
  if (birthday) {
    const relation = t.match(/\b(?:my|our)\s+(brother|sister|mum|mom|mother|dad|father|friend|partner|husband|wife|son|daughter|cousin|uncle|aunt|grandma|grandmother|grandpa|grandfather)\b/i)
      || t.match(/\bfor\s+(brother|sister|mum|mom|mother|dad|father|friend|partner|husband|wife|son|daughter|cousin|uncle|aunt|grandma|grandmother|grandpa|grandfather)\b/i);
    if (relation) out.relationship = relation[1].toLowerCase();
    const possessiveName = t.match(/\b([A-Z][\p{L}'’.-]*(?:\s+[A-Z][\p{L}'’.-]*){0,1})['’]s\s+(?:\d{1,2}(?:st|nd|rd|th)?\s+)?birthday\b/u);
    const nameAfterRole = t.match(/\b(?:for|to)\s+(?:(?:my|our)\s+)?(?:(?:brother|sister|mum|mom|mother|dad|father|friend|partner|husband|wife|son|daughter|cousin|uncle|aunt|grandma|grandmother|grandpa|grandfather)\s*,?\s+)?(?!my\b|our\b|turning\b|turns\b|age\b|celebrating\b|brother\b|sister\b|mum\b|mom\b|mother\b|dad\b|father\b|friend\b|partner\b|husband\b|wife\b|son\b|daughter\b|cousin\b|uncle\b|aunt\b|grandma\b|grandmother\b|grandpa\b|grandfather\b)([A-Z][\p{L}'’.-]*(?:\s+[A-Z][\p{L}'’.-]*){0,1})(?=\s+(?:turning|turns|celebrating|who|is|will)\b|[,!?;.]|$)/iu);
    if (possessiveName) out.name = possessiveName[1].trim();
    else if (nameAfterRole) out.name = nameAfterRole[1].trim();
    const age = t.match(/\b(?:turning|turns|turn|celebrating|celebrates|age|the big)\s+(?:the\s+)?(\d{1,2}(?:st|nd|rd|th)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty)\b/i)
      || t.match(/\b(\d{1,2}(?:st|nd|rd|th))\s+birthday\b/i);
    if (age) {
      const raw = age[1].toLowerCase().replace(/(?:st|nd|rd|th)$/i, '');
      const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 };
      out.milestone = String(words[raw] || raw);
    }
    const message = t.match(/\b(?:message(?:\s+for\s+(?:him|her|them))?|say|write|include(?:\s+the\s+words)?|tell\s+(?:him|her|them))\s*(?:is|:|-|,)?\s*["“]?([^"”\n]{8,1200})/i);
    if (message) out.personalMessage = message[1].trim().replace(/["”]+$/, '');
  }
  if (!out.name && !birthday) { const subj = subjectFromPrompt(t); if (subj) out.name = str(subj, 60); }
  if (!out.name && !birthday) {
    const first = t.split(/[\n.,;!?]/)[0].replace(/^\s*(?:please\s+)?(?:i\s+(?:want|need|would like)\s+(?:to\s+make\s+)?)?(?:make\s+(?:me\s+)?)?(?:an?\s+)?(?:(?:birthday|wedding|promo|promotional|short|nice|cool|donation|donations|fundraising|fundraiser|charity|appeal)\s+)?(?:video|ad|advert|advertisement|flyer|clip)?\s*(?:for|about|of|on)?\s*(?:my\s+|our\s+|the\s+)?/i, '').trim();
    if (first.length >= 3) out.name = first.charAt(0).toUpperCase() + str(first, 40).slice(1);
  }
  if (!out.aspect) out.aspect = '9:16';
  if (!out.duration) out.duration = 20;
  const pay = findPayment(t); if (pay) { out.payment = pay; out.kind = out.kind || 'cause'; out.category = out.category || 'Fundraiser'; }
  out.pasteText = str(t, 6000);   // the whole text also goes to the AI director (kept apart from the last question's answer)
  return out;
}

/** Convert an older wrongly-classified birthday project into a safe, personal brief before regeneration. */
export function repairLegacyBirthdayBrief(brief = {}, plan = {}) {
  if (!isPersonalBirthdayBrief(brief, plan)) return null;
  const sceneText = (plan.scenes || []).flatMap((scene) => [].concat(scene?.on_screen_text || [], scene?.voiceover || []));
  const raw = [brief.pasteText, brief.headline, ...[].concat(brief.headlines || []), brief.extra, plan.title, ...sceneText].filter(Boolean).join('\n');
  const found = parseBriefRules(raw);
  const savedCategoryIsBirthday = /^(?:personal\s+)?birthday(?:\s+(?:greeting|video|film))?$/i.test(String(brief.category || '').trim());
  const invalidName = /^(?:(?:my|our|the)\s+)?(?:brother|sister|mum|mom|mother|dad|father|friend|partner|husband|wife|son|daughter|cousin|uncle|aunt|grandma|grandmother|grandpa|grandfather|birthday|video|business|brand|product|service)$/i;
  const savedName = String(brief.name || '').trim();
  const name = found.name || ((brief.kind === 'personal' || savedCategoryIsBirthday) && savedName && !invalidName.test(savedName) ? savedName : '');
  return cleanBrief({
    ...brief,
    kind: 'personal', category: 'Birthday', name,
    relationship: brief.relationship || found.relationship || '',
    milestone: brief.milestone || found.milestone || '',
    personalMessage: found.personalMessage || brief.personalMessage || '',
    memories: Array.isArray(brief.memories) ? brief.memories : [],
    personalPhotoIds: brief.personalPhotoIds || [],
    headlines: [], headline: '', goals: [], goal: '', features: [], products: [],
    ctas: [], cta: '', contact: '', payment: '', offer: '', when: '', extra: '',
  });
}

export async function parseBrief(text, current = {}) {
  const rules = parseBriefRules(text);
  if (!config.useGemini) return cleanBrief({ ...rules, mode: 'paste' });
  try {
    // never keep a person waiting: all Gemini attempts together get ~20 s, then the rules reader takes over
    const { text: out } = await Promise.race([geminiGenerate({
      model: BRIEF_MODEL(),
      system: `${CREATIVE_STANDARD}
You are a smart video director. A person describes ANY video they want: a business advert, a birthday, a wedding, a church or school event, an announcement, a tribute, a personal story, a promo, a music or lyric video. Read it and fill in a form. Return JSON only.
Never invent facts (names, dates, places, ages, relationships, memories, prices, phone numbers, awards, or personal messages). For birthdays, set name only when the recipient's real name is clear; leave it empty when the prompt says only "my brother", "my friend" or similar so the form can ask. Extract personal wording only when the user explicitly wrote it. You MAY make sensible visual choices, but don't pretend generic filler is a personal message.
Keys:
{ "kind": "business" | "event" | "personal" | "announcement" | "cause" | "other"  (cause = a donation, fundraiser, charity or community appeal),
  "name": the real recipient's name for a personal birthday (empty if not stated); otherwise a title or subject in a few words,
  "category": what it is (2-4 words, e.g. "Birthday", "Wedding", "Church event", "Laptop repairs"),
  "relationship": the user's relationship to the birthday person, only if stated, "milestone": age or milestone, only if stated,
  "personalMessage": exact wording the user explicitly supplied for the birthday person, otherwise empty, "memories": ["..."], only details explicitly supplied,
  "goals": ["..."] (why they want it), "headlines": ["2-3 short on-screen messages, under 7 words each, written from their idea"],
  "features": ["..."] (business highlights only; don't use for birthdays), "products": ["Item ₦price"] (only if they gave prices),
  "ctas": ["..."] (the closing line or what viewers should do; for personal videos use something fitting like "Happy birthday!" or "Join us"; a cause gets "Donate today" or "Give what you can"; only business adverts get a sales call to action),
  "contact": phone / website / address only if given (never an account number), "payment": for a cause, the bank, account number and account name exactly as given ("GTBank · 0123456789 · Name"), "when": date, time and place if given,
  "aspect": "9:16" | "16:9" | "1:1" (9:16 unless they say otherwise), "duration": seconds (about 20 unless they say otherwise),
  "voiceover": true/false, "sound": "all" | "sfx" | "none",
  "phrases": ["only if they gave specific wording for the screen: each line EXACTLY as they wrote it, in the order they gave it; never reword, never add"], "slideshow": true if they want their pictures shown one after another,
  "extra": any instructions about look, mood, scenes or pictures, in their words }`,
      messages: [{ role: 'user', text: `Already known: ${JSON.stringify({ name: current.name, category: current.category })}\n\nTHEIR TEXT:\n${String(text).slice(0, 6000)}` }],
      json: true, temperature: 0.2, timeoutMs: 18000, maxOutputTokens: 4096, thinking: 'low',
    }), new Promise((_, rej) => setTimeout(() => rej(new Error('Gemini took too long to read the idea')), 20000))]);
    const g = JSON.parse(out);
    // the AI wins where it found something; rules fill gaps (phone numbers, aspect words); keep the full text for the director
    const merged = { ...rules, ...Object.fromEntries(Object.entries(g).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length))) };
    if (!merged.aspect) merged.aspect = '9:16';
    if (!merged.duration) merged.duration = 20;
    delete merged.extra;   // the last question asks for anything extra; the full text goes to the director as pasteText
    return cleanBrief({ ...merged, mode: 'paste' });
  } catch (e) {
    console.warn('[brief] Gemini paste reading failed, using rules:', e.message);
    return { ...cleanBrief({ ...rules, mode: 'paste' }), aiError: String(e.message).slice(0, 160) };
  }
}
