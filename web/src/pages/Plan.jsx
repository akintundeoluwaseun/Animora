// Page 1: the guided question flow. One question at a time, like a chat with a director:
// pick an option (or several), or type your own answer. Every answer is saved once, so nothing is asked twice.
// Pictures can be uploaded or pasted (Ctrl+V) anywhere on the page, up to 10. Special instructions come last.
import { announceKind } from '../components/Shell.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { api, ASPECTS, duration, shrinkImage, imageLook } from '../lib.jsx';
import { Alert, Button, PageLoader, Spinner } from '../components/ui.jsx';
import MicButton from '../components/MicButton.jsx';
import { StylePicker } from './Dashboard.jsx';

// Which kinds of scenes the owner can ask for (ids match server/ai/motion/compose.js MOTION_WANTS)
const SCENE_OPTIONS = [
  { id: 'typing', t: 'Search and type', d: 'A search bar types what people look for, and your business pops up', g: 'search' },
  { id: 'chat', t: 'WhatsApp chat', d: 'A customer asks, you reply, the order is made', g: 'chat' },
  { id: 'button', t: 'Button press', d: 'A cursor glides in and taps your "Order now" button', g: 'cursor' },
  { id: 'notifs', t: 'Phone alerts', d: 'Your messages drop in as phone notifications', g: 'bell' },
  { id: 'phone', t: '3D phone', d: 'A floating phone with your app icon on the home screen', g: 'phone' },
  { id: 'prices', t: 'Order card', d: 'Your items and prices add up on a clean order card', g: 'receipt', needs: 'Uses your products and prices' },
  { id: 'offer', t: 'Big price', d: 'Your price or discount rolls in, huge', g: 'tag', needs: 'Needs a price or offer' },
  { id: 'photos', t: 'Floating photos', d: 'Your photos float in 3D while the camera glides past', g: 'film', needs: 'Needs your photos' },
  { id: 'grid', t: 'Photo grid', d: 'Your photos pop into a grid that tilts away in 3D', g: 'grid', needs: 'Needs 4 or more photos' },
  { id: 'menu', t: 'Card stack', d: 'Colourful cards stack up with your products or strengths', g: 'cards' },
  { id: 'checklist', t: 'Switches', d: 'Your strengths switch on one by one, like phone settings', g: 'toggle', needs: 'Uses your selling points' },
  { id: 'swap', t: 'Rolling words', d: 'A button whose words roll through what you offer', g: 'swap', needs: 'Uses your selling points' },
  { id: 'orbit', t: 'Orbiting icons', d: 'Your logo in the middle, your strengths fly in around it', g: 'orbit' },
  { id: 'steps', t: 'How it works', d: 'Three cards joined by a line that draws through them', g: 'steps' },
  { id: 'highlight', t: 'Text highlight', d: 'Your key words get selected like on a screen', g: 'highlight' },
  { id: 'bigtype', t: 'Big words', d: 'One huge word at a time, fast and loud', g: 'type' },
  { id: 'glow', t: 'Glowing words', d: 'A calm glowing line on black, like a film trailer', g: 'glow' },
  { id: 'numbers', t: 'Big number', d: 'A number card that counts up', g: 'num', needs: 'Needs a number, like 2000 customers' },
  { id: 'timer', t: 'Timer ring', d: 'A ring fills up: "Under 30 minutes"', g: 'timer', needs: 'Needs a time, like 30 minutes' },
  { id: 'location', t: 'Map pin', d: 'A pin drops on your address on a clean map', g: 'pin', needs: 'Needs an address' },
  { id: 'event', t: 'Date card', d: 'A calendar card with your date, time and place', g: 'calendar', needs: 'Needs a date' },
  { id: 'countdown', t: 'Countdown', d: '3, 2, 1, then a big reveal. Great for launches', g: 'countdown' },
];

// The questions are grouped so people always know where they are
// signature templates (After Effects-style recipes, see server/ai/motion/browser/signature.js)
const TEMPLATE_OPTS = [
  { v: 'auto', l: 'Mix my own film', d: 'A new mix of scenes made for your business' },
  { v: 'type-reactor', l: 'Kinetic Typography', d: 'Big words slam in to the beat' },
  { v: 'luxury-product', l: 'Luxury Product', d: 'Rim light, slow orbit, gold type' },
  { v: 'hud-tech', l: 'Futuristic HUD', d: 'Wireframes, data panels, glowing emblem' },
  { v: 'liquid-chrome', l: 'Liquid Chrome', d: 'Melting metal shapes and chrome type' },
  { v: 'sports-hype', l: 'Sports Hype', d: 'Fast cuts, impact frames, freeze frame' },
  { v: 'swiss-editorial', l: 'Swiss Editorial', d: 'Clean grid, bold type, masked photos' },
  { v: 'visualizer', l: 'Music Visualizer', d: 'Spectrum ring and bars on a steady beat' },
  { v: 'cinematic-logo', l: 'Cinematic Logo', d: 'Light traces your logo, then a burst' },
];
const INTENSITY_OPTS = [
  { v: 'auto', l: "The template's own feel" }, { v: 'elegant', l: 'Elegant', d: 'Smooth and calm' }, { v: 'aggressive', l: 'Aggressive', d: 'Fast, punchy cuts' },
  { v: 'mechanical', l: 'Mechanical', d: 'Precise, techy moves' }, { v: 'fluid', l: 'Fluid', d: 'Flowing, liquid moves' },
];
const GROUP_OF = { template: 'Look and feel', intensity: 'Look and feel', mode: 'Start', paste: 'Start', flyerType: 'Your business', offer: 'Your message', when: 'Your message', layout: 'Look and feel', name: 'Your business', category: 'Your business', goal: 'Your business', headline: 'Your message', features: 'Your message', products: 'Your message', cta: 'Your message', contact: 'Your message', aspect: 'Format', duration: 'Format', pictures: 'Look and feel', colors: 'Look and feel', style: 'Look and feel', scenes: 'Look and feel', voiceover: 'Finish', sound: 'Finish', extra: 'Finish' };

const MAX_PICS = 10;

const CATEGORIES = ['Food & drinks', 'Fashion & clothing', 'Beauty & salon', 'Tech & software', 'Finance & payments', 'Health & fitness', 'Real estate', 'Events & parties', 'School & training', 'Shop & retail', 'Services'];
const GOALS = ['Promote a sale or offer', 'Launch something new', 'Get more orders or bookings', 'Make people know my brand', 'Announce an event'];
const CTAS = ['Order on WhatsApp', 'Call now', 'Visit our website', 'Visit our store', 'Download the app', 'Book now', 'DM us on Instagram'];
const ASPECT_OPTS = [
  { v: '9:16', l: 'Portrait 9:16', d: 'WhatsApp Status · TikTok · Reels' },
  { v: '16:9', l: 'Landscape 16:9', d: 'YouTube · TV · websites' },
  { v: '1:1', l: 'Square 1:1', d: 'Instagram & Facebook feed' },
];
const FOUND_LABEL = { name: 'business name', category: 'business type', goals: 'goal', headlines: 'message', features: 'selling points', products: 'products', ctas: 'call to action', contact: 'contact', aspect: 'format', duration: 'length', voiceover: 'voice-over choice', sound: 'sound choice' };
const EXTRA_CHIPS = ['Zoom into my logo at the start', 'Make the price really big', 'Keep it calm and premium', 'Make it loud and energetic', 'Show my photos more'];

// How long the answers need: an opening, one shot per message, about two selling points or products per shot,
// extra actions, and the ending. About 4 seconds a shot (with its move in and out). Too long feels slow and repeats; too short flashes by.
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => String(x).trim()).filter(Boolean);
export function fitSeconds(b = {}) {
  const shots = 2 + Math.max(1, listOf(b.headlines || b.headline).length) + Math.ceil(listOf(b.features).length / 2)
    + Math.ceil(listOf(b.products).length / 2) + Math.max(0, listOf(b.ctas || b.cta).length - 1)
    + (b.pasteText ? Math.min(4, Math.floor(String(b.pasteText).length / 450)) : 0);
  return Math.max(20, Math.min(120, Math.round((shots * 4) / 5) * 5));
}
export function lengthWarning(b, v) {
  const rec = fitSeconds(b), sec = Number(v);
  if (!sec) return null;
  // long videos are never stretched: Animora adds new scenes (new words, new looks) to fill the time, so there is no warning for long lengths
  if (sec <= rec * 0.7 && rec - sec >= 10) return { rec, text: `That's a lot for ${sec} seconds: everything will flash by too fast to read. ${rec} seconds fits your details, or remove some of them.` };
  return null;
}

// The questions, in order. `show` hides a question that doesn't apply; `optional` adds a Skip button.
const QUESTIONS = [
  { id: 'mode', type: 'single', options: [
    { v: 'steps', l: 'Ask me one question at a time' },
    { v: 'paste', l: "I'll paste everything at once", d: "Write or paste all your details. I'll only ask what's missing." },
  ], ask: () => "Hi! I'm your Animora director. Let's make your ad. Should I ask you questions one by one, or will you paste all your details at once?" },
  { id: 'paste', type: 'long', show: (b) => b.mode === 'paste', ask: () => 'Paste or type everything about your business and the ad: name, what you sell, your message, prices, contact, where you\'ll post it, how long, anything special.', placeholder: 'e.g. My business is Oluwaseun Computers in Ado Ekiti. We sell and repair laptops. HP EliteBook ₦250,000, Dell ₦300,000. Call or WhatsApp 0807 691 1614. Landscape for YouTube, about 30 seconds, calm and premium.' },
  { id: 'name', type: 'text', ask: () => "What's your business name?", placeholder: 'e.g. Kemi Cakes' },
  { id: 'category', type: 'single', options: CATEGORIES, typed: true, ask: (b) => `Nice! What does ${b.name} do?`, placeholder: 'Or type it, e.g. "laptop repairs"' },
  { id: 'goal', type: 'multi', max: 6, options: GOALS, typed: true, ask: () => "What's the goal of this ad?", placeholder: 'Or type your own goal' },
  { id: 'headline', type: 'multi', max: 8, suggest: 'headline', typed: true, ask: () => "What's the main message of your ad?", hint: 'Pick as many as you like, or type your own. More messages make a longer video.', placeholder: 'Add your own message' },
  { id: 'features', type: 'multi', max: 8, suggest: 'features', typed: true, optional: true, ask: (b) => `What makes ${b.name} stand out?`, hint: 'Pick as many as you like, or type your own.', placeholder: 'Add your own' },
  { id: 'products', type: 'long', optional: true, ask: () => 'Any products, services or prices to show? One per line.', placeholder: 'Jollof rice ₦2,500\nFried rice ₦2,800\nSmall chops ₦1,500' },
  { id: 'cta', type: 'multi', max: 5, options: CTAS, typed: true, ask: () => 'What should people do after watching?', placeholder: 'Or type your own, e.g. "Send us a DM"' },
  { id: 'contact', type: 'text', optional: true, ask: () => 'Your phone number, website or address for the end of the video?', placeholder: '0803 123 4567 · www.yoursite.com · 12 Allen Ave, Ikeja' },
  { id: 'aspect', type: 'single', options: ASPECT_OPTS, ask: () => 'Where will you post it?' },
  { id: 'duration', type: 'single', options: [15, 20, 25, 30, 40, 45, 60], ask: () => 'How long should it be?', hint: 'Any length works. A longer video gets more scenes, not slower ones.' },
  { id: 'pictures', type: 'upload', optional: true, ask: () => `Add your logo and product photos if you have them (up to ${MAX_PICS}). Both are optional. You can also paste a picture with Ctrl+V.` },
  { id: 'colors', type: 'colors', ask: () => 'Which colours should the video use?' },
  { id: 'style', type: 'style', ask: () => 'Pick a look for your video, or let me choose one that fits.' },
  { id: 'voiceover', type: 'single', options: [{ v: 'yes', l: 'Yes, write me a script', d: 'For ElevenLabs, CapCut and other voice apps' }, { v: 'no', l: 'No, just on-screen text' }], ask: () => 'Do you want a narration script for a voice-over app?' },
  { id: 'sound', type: 'sound', ask: () => 'What sound should the video have?' },
  { id: 'extra', type: 'long', optional: true, chips: EXTRA_CHIPS, ask: () => 'Last one: any other special instructions? Anything goes. You can paste pictures here too.', placeholder: 'e.g. "Start by zooming into the logo of the chatbot, then show the app screen"', done: true },
];
// Flyers: the same questions minus length, narration and sound, with flyer wording and print sizes.
const FLYER_ASPECTS = [
  { v: '4:5', l: 'Post 4:5', d: 'Instagram & Facebook feed' },
  { v: '9:16', l: 'Story 9:16', d: 'WhatsApp Status · Instagram Story' },
  { v: '1:1', l: 'Square 1:1', d: 'Any feed, WhatsApp chats' },
  { v: 'A4', l: 'A4 print', d: 'Printed flyers and posters (PDF)' },
];
const FLYER_TEXT = {
  paste: () => 'Paste or type everything about your business and the flyer: name, what you sell, your message, prices, contact, anything special.',
  goal: () => "What's the goal of this flyer?",
  headline: () => "What's the main message of your flyer?",
  cta: () => 'What should people do after seeing the flyer?',
  contact: () => 'Your phone number, website or address for the flyer?',
  aspect: () => 'Where will you use it?',
  pictures: () => `Add your logo and product photos if you have them (up to ${MAX_PICS}). Photos make flyers look much better.`,
  colors: () => 'Which colours should the flyer use?',
  style: () => 'Pick a look for your flyer, or let me choose one that fits.',
  extra: () => 'Last one: anything special for the flyer? Anything goes.',
};
// Flyers ask different things from videos: what kind of flyer, the one big thing on it, when and where, and how it is laid out.
const FLYER_TYPES = [
  { v: 'sale', l: 'Sale or discount', d: 'A price or percentage is the star' },
  { v: 'event', l: 'Event or party', d: 'Date, time and place matter most' },
  { v: 'launch', l: 'New product or opening', d: 'Introduce something new' },
  { v: 'menu', l: 'Menu or price list', d: 'A tidy list of items and prices' },
  { v: 'service', l: 'Services we offer', d: 'What you do, in a clean grid' },
  { v: 'hiring', l: 'We are hiring', d: 'A job or training announcement' },
  { v: 'brand', l: 'Brand or thank-you poster', d: 'A bold statement poster' },
];
const FLYER_LAYOUTS = [
  { v: 'photo', l: 'Photo first', d: 'Your picture fills the flyer, text sits on top' },
  { v: 'type', l: 'Big type first', d: 'Huge words, minimal and bold' },
  { v: 'price', l: 'Price first', d: 'A giant price or offer in the middle' },
  { v: 'auto', l: 'Let the AI decide', d: 'It picks what suits your business' },
];
const FLYER_QUESTIONS = [
  { id: 'mode', type: 'single', options: QUESTIONS[0].options, ask: QUESTIONS[0].ask },
  { ...QUESTIONS.find((x) => x.id === 'paste'), ask: FLYER_TEXT.paste, placeholder: 'e.g. My business is Oluwaseun Computers in Ado Ekiti. We sell and repair laptops. HP EliteBook ₦250,000, Dell ₦300,000. Call or WhatsApp 0807 691 1614. Square flyer for WhatsApp, clean and premium.' },
  { id: 'name', type: 'text', ask: () => "What's your business name?", placeholder: 'e.g. Kemi Cakes' },
  { id: 'category', type: 'single', options: CATEGORIES, typed: true, ask: (b) => `Nice! What does ${b.name} do?`, placeholder: 'Or type your own' },
  { id: 'flyerType', type: 'multi', max: 3, options: FLYER_TYPES, typed: true, ask: () => 'What kind of flyer is this?', hint: 'Pick one or more. A sale and a new opening can share one flyer.', placeholder: 'Or describe it in your own words' },
  { id: 'headline', type: 'multi', max: 3, suggest: 'headline', typed: true, ask: () => 'What is the big title? The words people read first.', hint: 'Short wins. One to three lines work best on a flyer.' },
  { id: 'offer', type: 'text', optional: true, show: (b) => { const t = [].concat(b.flyerType || []); return !t.length || !t.every((x) => x === 'hiring' || x === 'brand'); }, ask: () => 'Is there one big thing to show huge: a price, a discount or a date?', placeholder: 'e.g. 30% OFF or ₦5,000 or 24 Dec' },
  { id: 'products', type: 'long', optional: true, ask: () => 'Any items, services or prices to list? One per line.', placeholder: 'Jollof rice ₦2,500\nFried rice ₦3,000' },
  { id: 'when', type: 'text', optional: true, show: (b) => !b.flyerType || [].concat(b.flyerType).some((x) => x === 'event' || x === 'launch' || /event|party|show|launch|open/i.test(x)), ask: () => 'When and where? Date, time and venue.', placeholder: 'e.g. Sat 14 Dec, 4pm, Ado Ekiti Town Hall' },
  { id: 'cta', type: 'multi', max: 3, options: CTAS, typed: true, ask: FLYER_TEXT.cta, placeholder: 'Or type your own' },
  { id: 'contact', type: 'text', optional: true, ask: FLYER_TEXT.contact, placeholder: 'e.g. 0803 123 4567 · @yourhandle' },
  { id: 'aspect', type: 'single', options: FLYER_ASPECTS, ask: FLYER_TEXT.aspect },
  { id: 'pictures', type: 'upload', optional: true, ask: FLYER_TEXT.pictures },
  { id: 'layout', type: 'single', options: FLYER_LAYOUTS, ask: () => 'How should the flyer be laid out?' },
  { id: 'colors', type: 'colors', ask: FLYER_TEXT.colors },
  { id: 'style', type: 'style', ask: FLYER_TEXT.style },
  { id: 'extra', type: 'long', optional: true, chips: ['Make the price really big', 'Keep it calm and premium', 'Make it loud and colourful', 'Use my photo as the background'], ask: FLYER_TEXT.extra, placeholder: 'e.g. "Put the prices in big circles" or "Make it look like a Christmas sale"' },
];

// Only the business name is needed. Every other question can be skipped, and Animora chooses well for whatever is skipped.
const SKIPPABLE = new Set(['category', 'goal', 'headline', 'cta', 'aspect', 'duration', 'colors', 'style', 'template', 'intensity', 'scenes', 'voiceover', 'sound', 'flyerType', 'layout', 'offer', 'when', 'features', 'products', 'contact', 'pictures', 'extra']);
for (const qq of [...QUESTIONS, ...FLYER_QUESTIONS]) if (SKIPPABLE.has(qq.id)) qq.optional = true;


const label = (q, v, b, styles) => {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return 'Skipped';
  if (q.id === 'mode') return v === 'paste' ? "I'll paste everything at once" : 'One question at a time';
  if (q.id === 'paste') return 'My details (pasted)';
  if (q.id === 'aspect') return ASPECT_OPTS.find((o) => o.v === v)?.l || v;
  if (q.id === 'duration') return `${v} seconds`;
  if (q.id === 'voiceover') return v === true || v === 'yes' ? 'Yes, write me a script' : 'No script';
  if (q.id === 'sound') return { all: 'Sound effects', sfx: 'Sound effects', none: 'No sound', own: 'My own music', piano: 'Soft piano', soft: 'Soft music' }[v] || v;
  if (q.id === 'style') return b.styleAuto ? 'Let Animora choose' : styles?.find((s) => s.id === v)?.name || 'Chosen';
  if (q.id === 'colors') return v === 'style' ? "The style's colours" : v === 'logo' ? 'Matched to my logo' : 'My own colours';
  if (q.id === 'pictures') return `${v} picture${v === 1 ? '' : 's'}`;
  if (q.id === 'flyerType') return [].concat(v).map((x) => FLYER_TYPES.find((o) => o.v === x)?.l || x).join(', ');
  if (q.id === 'template') return TEMPLATE_OPTS.find((o) => o.v === v)?.l || v;
  if (q.id === 'intensity') return INTENSITY_OPTS.find((o) => o.v === v)?.l || v;
  if (q.id === 'layout') return FLYER_LAYOUTS.find((o) => o.v === v)?.l || v;
  if (q.id === 'scenes') return v === 'auto' ? 'Let the AI choose' : (Array.isArray(v) ? v : []).map((id) => SCENE_OPTIONS.find((o) => o.id === id)?.t || id).join(', ');
  return Array.isArray(v) ? v.join(', ') : String(v);
};

// answers live in the brief under the question id (with a few special cases)
function valueOf(q, b, pics) {
  if (q.show && !q.show(b)) return 'hidden';
  if (q.id === 'paste') return b.pasted ? true : undefined;
  if (q.id === 'headline') return b.headlines || (b.headline ? [b.headline] : undefined);
  if (q.id === 'goal') return b.goals || (b.goal ? [b.goal] : undefined);
  if (q.id === 'cta') return b.ctas || (b.cta ? [b.cta] : undefined);
  if (q.id === 'style') return b.styleAuto ? 'auto' : b.styleId;
  if (q.id === 'colors') return b.colorMode;
  if (q.id === 'pictures') return b.picturesDone ? pics : undefined;
  if (q.id === 'voiceover') return b.voiceover === undefined ? undefined : b.voiceover ? 'yes' : 'no';
  if (q.id === 'sound') return b.sound;
  if (q.id === 'scenes') return b.sceneAuto === undefined ? undefined : b.sceneAuto ? 'auto' : b.scenes;
  return b[q.id];
}

// Pull two strong colours from the logo (most common saturated colours).
async function logoColors(url) {
  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url;
  await img.decode();
  const c = document.createElement('canvas'); const S = 64; c.width = S; c.height = S;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S).data, bins = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const [r, gg, bb, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
    if (a < 200) continue;
    const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
    if (mx - mn < 40 || mx < 50 || mn > 230) continue; // skip greys, black, white
    const k = `${r >> 5},${gg >> 5},${bb >> 5}`;
    const e = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += r; e.g += gg; e.b += bb; bins.set(k, e);
  }
  const top = [...bins.values()].sort((a, b) => b.n - a.n).map((e) => '#' + [e.r, e.g, e.b].map((v) => Math.round(v / e.n).toString(16).padStart(2, '0')).join(''));
  if (!top.length) return null;
  return { primary: top[0], secondary: top.find((x) => x !== top[0]) || top[0] };
}

const Chk = () => <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;

// one option: a card you tap (with a tick for multi-choice)
function Chip({ active, onClick, children, sub, multi }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!active} className="option press">
      {multi && <span className="option-check" aria-hidden="true">{active && <Chk />}</span>}
      <span className="min-w-0">{children}{sub && <span className="mt-0.5 block text-[13px] font-normal leading-snug text-ink-mute">{sub}</span>}</span>
    </button>
  );
}

// Phones: the page is exactly as tall as the part of the screen you can see, so the keyboard never hides the box.
function useVisibleHeight() {
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return undefined;
    const root = document.documentElement;
    const fit = () => { root.style.setProperty('--vvh', `${Math.round(vv.height)}px`); if (window.innerWidth < 640 && vv.height < window.innerHeight - 40) window.scrollTo(0, 0); };
    fit(); vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); root.style.removeProperty('--vvh'); };
  }, []);
}

// little line drawings for the scene picker
const SG = {
  cursor: <path d="M5 3l12 10.5-5.5.6 3.2 6.4-2.3 1.1-3.2-6.5L5 19z" />, phone: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.6" /><path d="M10.5 5h3" /></>, receipt: <><path d="M5.5 3h13v18l-2.2-1.4L14 21l-2-1.4L10 21l-2.3-1.4L5.5 21z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>, toggle: <><rect x="2.5" y="7" width="19" height="10" rx="5" /><circle cx="16.5" cy="12" r="3" /></>,
  swap: <><rect x="3" y="8" width="18" height="8" rx="4" /><path d="M9 4h6M10 20h4" /></>, highlight: <><path d="M4 9h16M4 15h9" /><path d="M14.5 12.5h6v5h-6z" /></>, glow: <><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /><circle cx="12" cy="12" r="3.5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>, countdown: <><circle cx="12" cy="12" r="8.5" /><path d="M10 9.5h3.5l-2 3a2 2 0 1 1-1.5 3.3" /></>,
  search: <><circle cx="10" cy="10" r="5.5" /><path d="M14.5 14.5 20 20" /></>, chat: <path d="M4 5.5h16v11H10L5.5 20v-3.5H4z" />, ring: <><ellipse cx="12" cy="12" rx="9" ry="3.6" /><rect x="8.5" y="7" width="7" height="10" rx="1.6" /></>,
  tag: <><path d="M3.5 12.5V4.5h8l9 9-8 8z" /><circle cx="8" cy="9" r="1.2" /></>, burst: <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M18.7 5.3l-2.8 2.8M8.1 15.9l-2.8 2.8" />, split: <><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><path d="M12 4.5v15" /></>,
  num: <path d="M6 5v14M6 5 4 7M13 8.5a3.2 3.2 0 0 1 6.4 0c0 3-6.4 4.5-6.4 8.5h6.4" />, steps: <><circle cx="5.5" cy="6" r="2" /><circle cx="18.5" cy="12" r="2" /><circle cx="5.5" cy="18" r="2" /><path d="M7.5 6.5c8 0 9 3 9 4.5M16.5 13c0 2-3 4.500-9 4.500" /></>,
  check: <><rect x="3.5" y="4" width="17" height="16" rx="3" /><path d="M8 12.5l2.8 2.8L16.5 9.5" /></>, type: <path d="M5 6.5V5h14v1.5M12 5v14M9 19h6" />, blob: <path d="M5 13c-1.500-4 1.500-8 6-8s8.500 2.500 8 7c-.5 4.500-4 7-8 6.500-3-.4-5-2-6-5.500z" />,
  orbit: <><circle cx="12" cy="12" r="2.6" /><ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(-25 12 12)" /><circle cx="19" cy="8" r="1.1" /></>, cards: <><rect x="6" y="3.5" width="14" height="14" rx="2.4" /><path d="M3.5 7v11.500a2 2 0 0 0 2 2H16" /></>,
  pin: <><path d="M12 21s7-6.200 7-11.500a7 7 0 0 0-14 0C5 14.800 12 21 12 21z" /><circle cx="12" cy="9.500" r="2.400" /></>, film: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 8h16M4 16h16M8 3v5M16 3v5M8 16v5M16 16v5" /></>,
  timer: <><circle cx="12" cy="13" r="7.500" /><path d="M12 9v4.500l3 1.500M9.500 3h5" /></>, bell: <path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15zM10 20.500a2 2 0 0 0 4 0" />, vs: <><path d="M3.500 6.500h7v11h-7zM13.500 6.500h7v11h-7z" /></>,
};
function ScenePicker({ value, onChange, hasPhotos }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : value.length >= 8 ? value : [...value, id]);
  return (
    <div className="scene-grid">
      {SCENE_OPTIONS.map((o) => {
        const on = value.includes(o.id);
        return (
          <button key={o.id} type="button" aria-pressed={on} onClick={() => toggle(o.id)} className="scene-card press">
            <span className="scene-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{SG[o.g]}</svg></span>
            <span className="scene-tick" aria-hidden="true">{on && <Chk />}</span>
            <span className="mt-3 block text-[15px] font-bold leading-tight tracking-[-0.01em]">{o.t}</span>
            <span className="mt-1 block text-[12.5px] leading-snug text-ink-mute">{o.d}</span>
            {o.needs && <span className="mt-2 block text-[11.5px] font-semibold text-ink-soft/80">{(o.id === 'photos' || o.id === 'grid') && hasPhotos ? 'You have photos for this' : o.needs}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function Plan() {
  useVisibleHeight();
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  useEffect(() => { if (project) announceKind(project.kind || 'video', project); }, [project?.kind, project?.title, project?.brief?.name, !!project?.plan, !!project?.code, !!project]); // eslint-disable-line react-hooks/exhaustive-deps
  const [styles, setStyles] = useState([]);
  const [limits, setLimits] = useState({ minSeconds: 15, maxSeconds: 60 });
  const [b, setB] = useState({});
  const [step, setStep] = useState(0);          // index of the question being asked
  const [editing, setEditing] = useState(false); // changing an earlier answer: jump back to the end afterwards
  const [text, setText] = useState('');
  const [multi, setMulti] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [loadingSug, setLoadingSug] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [reading, setReading] = useState(false);   // reading a pasted description
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [backMode, setBackMode] = useState(false);   // walking back through earlier answers
  const [lenWarn, setLenWarn] = useState(null);   // { v, rec, text } while the person decides
  const endRef = useRef(null);
  const logoRef = useRef(null);
  const photoRef = useRef(null);
  const musicRef = useRef(null);

  const pics = (project?.assets || []).filter((a) => a.kind === 'image');
  const logo = pics.find((a) => a.role === 'logo');
  const QS = project?.kind === 'flyer' ? FLYER_QUESTIONS : QUESTIONS;
  const visible = QS;
  const what = project?.kind === 'flyer' ? 'flyer' : 'video';
  const q = visible[step];
  // nothing answered yet: show what is being made, and let them swap video <-> flyer
  const fresh = !!project && !project.plan && !pics.length && !Object.entries(b).some(([k, v]) => !/Skipped$/.test(k) && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length));
  const [switching, setSwitching] = useState(false);
  const switchKind = async () => {
    const other = what === 'flyer' ? 'video' : 'flyer';
    setSwitching(true);
    try {
      const { project: next } = await api('/projects', { method: 'POST', body: { title: other === 'flyer' ? 'New flyer' : 'New video', kind: other } });
      api(`/projects/${id}`, { method: 'DELETE' }).catch(() => {});
      announceKind(other);
      navigate(`/p/${next.id}/plan`, { replace: true });
    } catch (e) { setError(e.message); setSwitching(false); }
  };

  // load project + styles, resume at the first unanswered question
  useEffect(() => {
    (async () => {
      try {
        const r = await api(`/projects/${id}`);
        setProject(r.project); if (r.limits) setLimits(r.limits);
        const brief = r.project.brief || {};
        bRef.current = brief; setB(brief);
        const { styles: st } = await api('/styles'); setStyles(st);
        const imgs = (r.project.assets || []).filter((a) => a.kind === 'image').length;
        const LIST = r.project.kind === 'flyer' ? FLYER_QUESTIONS : QUESTIONS;
        const first = LIST.findIndex((qq) => { const v = valueOf(qq, brief, imgs); return v === undefined && !(qq.optional && brief[`${qq.id}Skipped`]); });
        setStep(brief.done && r.project.plan ? LIST.length : first < 0 ? LIST.length : first);
      } catch (e) { setError(e.message); }
    })();
  }, [id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [step, uploading, suggestions, building]);
  useEffect(() => { setText(''); const cur = q?.id === 'headline' ? (b.headlines || (b.headline ? [b.headline] : [])) : q?.id === 'goal' ? (b.goals || (b.goal ? [b.goal] : [])) : q?.id === 'cta' ? (b.ctas || (b.cta ? [b.cta] : [])) : b[q?.id]; setMulti(Array.isArray(cur) ? cur : []); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // AI suggestions for the open questions
  useEffect(() => {
    if (!q?.suggest || suggestions[q.id]) return;
    setLoadingSug(true);
    api(`/projects/${id}/suggest`, { method: 'POST', body: { kind: q.suggest, brief: b } })
      .then((r) => setSuggestions((s) => ({ ...s, [q.id]: r.options || [] })))
      .catch(() => setSuggestions((s) => ({ ...s, [q.id]: [] })))
      .finally(() => setLoadingSug(false));
  }, [q?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // paste a picture anywhere on the page
  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      upload(files.map((f, i) => new File([f], f.name && f.name !== 'image.png' ? f.name : `pasted picture ${Date.now() % 10000}${i ? `-${i}` : ''}.png`, { type: f.type })), q?.id === 'pictures' ? (!logo ? null : 'photo') : null);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  // Saving is instant on screen; the server copy is updated in the background, one request at a time
  // (so answers never wait on the network, and quick taps can't overwrite each other).
  const bRef = useRef(b);
  const autoMake = useRef(false);
  const saving = useRef(Promise.resolve());
  const save = (patch) => {
    const next = { ...bRef.current, ...patch };
    bRef.current = next; setB(next);
    saving.current = saving.current.then(() => api(`/projects/${id}/brief`, { method: 'PATCH', body: { brief: patch } })
      .then((r) => setProject((p) => ({ ...p, ...r.project, assets: r.project.assets || p.assets })))
      .catch((e) => setError(e.message)));
    return next;
  };
  const saved = () => saving.current;

  const shown = (qq, brief) => !(qq.show && !qq.show(brief));
  const nextShown = (from, brief) => { let i = from + 1; while (i < QS.length && !shown(QS[i], brief)) i++; return i; };
  const prevShown = (from, brief) => { let i = from - 1; while (i >= 0 && !shown(QS[i], brief)) i--; return i; };
  const advance = (next) => {
    if (backMode) {
      const n = nextShown(step, next);
      if (n < QS.length && valueOf(QS[n], next, pics.length) !== undefined) { setStep(n); return; }
      setBackMode(false);
    }
    if (editing) { setEditing(false); const f = QS.findIndex((qq) => valueOf(qq, next, pics.length) === undefined && !(qq.optional && next[`${qq.id}Skipped`])); setStep(f < 0 ? QS.length : f); return; }
    const f = QS.findIndex((qq) => valueOf(qq, next, pics.length) === undefined && !(qq.optional && next[`${qq.id}Skipped`]));
    setStep(f < 0 ? QS.length : f);
  };
  const goBack = () => { const p = prevShown(step, bRef.current); if (p >= 0) { setBackMode(true); setStep(p); } };

  const answer = async (value, extra = {}) => {
    if (!q || reading) return;
    setError('');
    let patch;
    if (q.id === 'paste') {
      setReading(true);
      try {
        await saved();
        const r = await api(`/projects/${id}/brief/parse`, { method: 'POST', body: { text: value } });
        setProject((p) => ({ ...p, ...r.project, assets: r.project.assets || p.assets }));
        bRef.current = { ...(r.project.brief || {}) };
        const next = save({ pasted: true });
        if (r.aiError) setError(`The AI couldn't read all of it (${r.aiError.slice(0, 90)}). I picked up what I could and will ask about the rest.`);
        setToast(r.found?.length ? `Got it. I found your ${r.found.map((k) => FOUND_LABEL[k] || k).join(', ')}.` : "Got it. I'll ask about the rest."); setTimeout(() => setToast(''), 5000);
        if (bRef.current.name) {
          setReading(false);
          // the logo and photos matter, so ask for them once (skippable), then make the video without any other question
          if (!logo) { autoMake.current = true; setStep(Math.max(0, QS.findIndex((qq) => qq.id === 'pictures'))); return; }
          return makeNow();
        }
        advance(next);
      } catch (e) { setError(e.message); } finally { setReading(false); }
      return;
    }
    if (q.id === 'voiceover') patch = { voiceover: value === 'yes' };

    else if (q.id === 'duration') patch = { duration: Number(value) };
    else if (q.id === 'headline') patch = { headlines: value, headline: value[0] };
    else if (q.id === 'goal') patch = { goals: value, goal: value.join(' + ') };
    else if (q.id === 'cta') patch = { ctas: value, cta: value[0] };
    else if (q.id === 'scenes') patch = value === 'auto' ? { sceneAuto: true, scenes: [] } : { sceneAuto: false, scenes: value };
    else patch = { [q.id]: value };
    const next = save({ ...patch, ...extra, [`${q.id}Skipped`]: false });
    if (autoMake.current && q.id === 'pictures') { autoMake.current = false; return makeNow(); }
    advance(next);
  };
  // "Make it now": skip every question that is left and build with what is known
  const makeNow = async () => {
    if (building || reading || !bRef.current.name) return;
    const patch = { done: true, extraSkipped: true, picturesDone: true };
    for (const qq of QS) if (qq.optional && valueOf(qq, bRef.current, pics.length) === undefined) patch[`${qq.id}Skipped`] = true;
    const next = save(patch); setBuilding(true); await saved(); build(next);
  };
  const skip = () => { const next = save({ [`${q.id}Skipped`]: true, ...(q.id === 'pictures' ? { picturesDone: true } : {}) }); if (autoMake.current && q.id === 'pictures') { autoMake.current = false; return makeNow(); } advance(next); };

  const upload = async (files, role) => {
    setError('');
    const room = MAX_PICS - pics.length;
    if (room <= 0) { setError(`You can add up to ${MAX_PICS} pictures. Remove one to add another.`); return; }
    if (files.length > room) setError(`Only ${room} more picture${room === 1 ? '' : 's'} can be added (up to ${MAX_PICS}).`);
    setUploading(true);
    try {
      for (const f of files.slice(0, room)) {
        const form = new FormData();
        const small = await shrinkImage(f);
        form.append('file', small);
        if (role) form.append('role', role);
        const look = await imageLook(small);
        if (look.alpha !== undefined) form.append('alpha', String(look.alpha));
        if (look.light !== undefined && look.light !== null) form.append('light', String(look.light));
        form.append('name', role === 'logo' ? 'logo' : f.name.replace(/\.[^.]+$/, '').slice(0, 40));
        const { asset } = await api(`/projects/${id}/assets`, { method: 'POST', form });
        setProject((p) => ({ ...p, assets: [...(p.assets || []), asset] }));
      }
      setToast(files.length > 1 ? 'Pictures added' : 'Picture added'); setTimeout(() => setToast(''), 2500);
    } catch (e) { setError(e.message); } finally { setUploading(false); [logoRef, photoRef].forEach((r) => { if (r.current) r.current.value = ''; }); }
  };
  const removePic = async (a) => {
    await api(`/projects/${id}/assets/${a.id}`, { method: 'DELETE' }).catch(() => {});
    setProject((p) => ({ ...p, assets: p.assets.filter((x) => x.id !== a.id) }));
  };

  const build = async (brief) => {
    setBuilding(true); setError('');
    try {
      const r = await api(`/projects/${id}/build`, { method: 'POST', body: { brief } });
      setProject((p) => ({ ...p, ...r.project }));
      navigate(`/p/${id}/studio?generate=1`);
    } catch (e) { setError(e.message); setBuilding(false); }
  };

  // finishing the last question builds the video
  const finish = async (value) => { const next = save({ extra: value || '', extraSkipped: !value, done: true }); setBuilding(true); await saved(); build(next); };

  if (!project) return error ? <div className="mx-auto max-w-xl p-8"><Alert>{error}</Alert></div> : <PageLoader />;
  const shownQs = visible.map((qq, i) => ({ qq, i })).filter(({ qq }) => !(qq.show && !qq.show(b)));
  const finished = step >= visible.length;
  const pos = finished ? shownQs.length : Math.max(0, shownQs.findIndex(({ i }) => i === step));
  const opts = q?.suggest ? (suggestions[q.id] || []) : q?.options || [];
  const group = q ? GROUP_OF[q.id] : 'Finish';
  const groups = [...new Set(shownQs.map(({ qq }) => GROUP_OF[qq.id] || 'Start'))];
  const isFirst = shownQs.length ? shownQs[0].i === step : true;
  const typedKind = !finished && q && ['text', 'long', 'single', 'multi'].includes(q.type) && (q.typed || q.type === 'text' || q.type === 'long' || q.type === 'multi');
  const needsContinue = typedKind || q?.type === 'scenes' || q?.type === 'upload';
  const submitText = (e) => {
    e?.preventDefault();
    const v = text.trim();
    if (q.type === 'multi') { const all = [...multi, ...(v && !multi.includes(v) ? [v] : [])]; if (!all.length) return; return answer(all); }
    if (q.done) return finish(v);
    if (!v) return;
    answer(q.type === 'long' ? v.split('\n').map((x) => x.trim()).filter(Boolean).join(q.id === 'products' ? '\n' : ' ') : v);
  };
  const continueDisabled = reading || (q?.type === 'multi' ? !multi.length && !text.trim() : q?.type === 'scenes' ? false : q?.type === 'upload' ? uploading : q?.done ? false : !text.trim());
  const continueLabel = q?.done ? (text.trim() ? `Make my ${what}` : "No, that's all") : q?.type === 'multi' ? (multi.length ? `Continue · ${multi.length + (text.trim() && !multi.includes(text.trim()) ? 1 : 0)}` : 'Continue')
    : q?.type === 'scenes' ? (multi.length ? `Use my ${multi.length} pick${multi.length === 1 ? '' : 's'}` : 'Continue') : q?.type === 'upload' ? (pics.length ? 'Continue' : 'Continue without pictures') : q?.id === 'paste' ? 'Read it and make my video' : 'Continue';
  const onContinue = (e) => {
    if (q.type === 'scenes') { e?.preventDefault(); return multi.length ? answer(multi) : answer('auto'); }
    if (q.type === 'upload') { e?.preventDefault(); return pics.length ? answer(pics.length, { picturesDone: true }) : skip(); }
    return submitText(e);
  };

  return (
    <div className="wiz">

      <div className="wiz-grid">
        {/* left: where you are */}
        <nav className="wiz-rail" aria-label="Progress">
          {groups.map((g) => {
            const items = shownQs.filter(({ qq }) => (GROUP_OF[qq.id] || 'Start') === g);
            const done = items.filter(({ qq }) => { const v = valueOf(qq, b, pics.length); return v !== undefined || (qq.optional && b[`${qq.id}Skipped`]); }).length;
            const now = group === g && !finished;
            return (
              <div key={g} className="wiz-group" data-now={now} data-done={done === items.length}>
                <div className="wiz-group-head"><span className="wiz-dot">{done === items.length ? <Chk /> : null}</span><span>{g}</span><small>{done}/{items.length}</small></div>
                {now && (
                  <ul className="wiz-items">
                    {items.map(({ qq, i }) => { const v = valueOf(qq, b, pics.length); const has = v !== undefined; return (
                      <li key={qq.id}><button type="button" disabled={!has || building} onClick={() => { setBackMode(false); setEditing(true); setStep(i); }} data-cur={i === step} data-has={has}>
                        <span className="truncate">{has ? label(qq, v, b, styles) : qq.id === q.id ? 'Now' : '·'}</span></button></li>
                    ); })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* centre: one question at a time */}
        <section className="wiz-main" aria-label="Question">
          {fresh && (
            <div className={`wiz-kind ${what === 'flyer' ? 'is-flyer' : 'is-video'}`}>
              <span className="wiz-kind-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{what === 'flyer' ? <path d="M5 3h14v18H5zM8 15l3-3 2 2 3-3M9 7.5h.01" /> : <path d="M4 5h16v14H4zM10 9l5 3-5 3z" />}</svg>
              </span>
              <span className="min-w-0 flex-1 leading-tight"><b>{what === 'flyer' ? 'New flyer' : 'New video ad'}</b><small>{what === 'flyer' ? 'A still design to post or print' : 'A motion ad you download as an MP4'}</small></span>
              <button type="button" onClick={switchKind} disabled={switching} className="wiz-kind-switch">{switching ? 'Switching…' : what === 'flyer' ? 'Make a video instead' : 'Make a flyer instead'}</button>
            </div>
          )}
          <div className="wiz-meta">
            <div className="wiz-track" aria-hidden="true"><div style={{ width: `${Math.round((pos / Math.max(1, shownQs.length)) * 100)}%` }} /></div>
            <p>{finished ? 'All done' : `${group} · ${pos + 1} of ${shownQs.length}`}</p>
          </div>

          {/* each question slides in from the side it comes from */}
          <motion.form className="wiz-card" key={finished ? 'end' : q.id} onSubmit={onContinue}
            initial={{ opacity: 0, x: backMode ? -36 : 36 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 340, damping: 32 }}>
            {!finished && q && (
              <>
                <h2 className="wiz-q">{q.ask(b)}</h2>
                {q.type === 'multi' && <p className="wiz-hint">{q.hint || 'Pick one or more, or type your own.'}</p>}
                {q.type === 'scenes' && <p className="wiz-hint">{q.hint}</p>}
                {(q.type === 'text' || q.type === 'long') && q.placeholder && q.type === 'text' && <p className="wiz-hint">Just type it in the box below.</p>}
                {q.type === 'long' && q.optional && <p className="wiz-hint">You can skip this one.</p>}

                {(q.type === 'single' || q.type === 'multi') && (
                  <div className={`options mt-6 ${opts.some((o) => o.d || String(o.l ?? o).length > 26) ? 'options-wide' : ''}`}>
                    {loadingSug && !opts.length && <span className="flex items-center gap-2 text-sm text-ink-mute"><Spinner className="size-4" />Writing some ideas…</span>}
                    {opts.filter((o) => q.id !== 'duration' || (o >= limits.minSeconds && o <= limits.maxSeconds)).map((o) => {
                      const v = o.v ?? o, l = o.l ?? (q.id === 'duration' ? `${o} seconds` : o);
                      const on = q.type === 'multi' ? multi.includes(v) : b[q.id] === v;
                      const best = false;
                      return <Chip key={v} active={on} sub={o.d || (best ? 'Fits your details best' : undefined)} multi={q.type === 'multi'} onClick={() => {
                        if (q.id === 'duration') { const w = lengthWarning(b, v); if (w) { setLenWarn({ v, ...w }); return undefined; } setLenWarn(null); }
                        if (q.type === 'single') return answer(v);
                        setMulti((m) => (m.includes(v) ? m.filter((x) => x !== v) : m.length >= (q.max || 9) ? m : [...m, v]));
                      }}>{l}</Chip>;
                    })}
                    {q.type === 'multi' && multi.filter((v) => !opts.some((o) => (o.v ?? o) === v)).map((v) => <Chip key={v} active multi onClick={() => setMulti((m) => m.filter((x) => x !== v))}>{v}</Chip>)}
                  </div>
                )}
                {q.id === 'duration' && lenWarn && (
                  <div className="mt-4 rounded-[14px] border border-amber-300 bg-amber-50 p-4 text-[14px] leading-relaxed text-ink" role="alert">
                    <p>{lenWarn.text}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" type="button" onClick={() => { const v = lenWarn.rec; setLenWarn(null); answer(v); }}>Use {lenWarn.rec} seconds</Button>
                      <Button size="sm" type="button" variant="outline" onClick={() => { const v = lenWarn.v; setLenWarn(null); answer(v); }}>Keep {lenWarn.v} seconds</Button>
                    </div>
                  </div>
                )}

                {typedKind && (
                  <div className="wiz-field mt-6">
                    <label className="wiz-label" htmlFor="wiz-in">{q.type === 'long' ? 'Your answer' : q.typed ? 'Or write your own' : 'Your answer'}</label>
                    <div className="wiz-box">
                      {q.type === 'long' ? (
                        <textarea id="wiz-in" value={text} onChange={(e) => setText(e.target.value)} rows={q.id === 'paste' ? 8 : 4} placeholder={q.placeholder} className="wiz-input resize-none" />
                      ) : (
                        <input id="wiz-in" value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder={q.placeholder || (q.typed ? 'Type your own answer…' : 'Type your answer…')} className="wiz-input" />
                      )}
                      <MicButton onText={(t) => setText((x) => (x.trim() ? `${x.trim()} ${t}` : t))} onError={setError} className="wiz-mic" />
                    </div>
                    <p className="wiz-foot">{q.type === 'long' ? 'Press Continue when you are done' : 'Press Enter to continue'} · or tap the mic and say it</p>
                  </div>
                )}

                {reading && <div className="mt-5 flex items-center gap-3"><div className="bubble-ai typing px-4 py-3.5"><span /><span /><span /></div><span className="text-sm text-ink-mute">Reading your details…</span></div>}

                {q.type === 'upload' && (
                  <div className="wiz-drop mt-6">
                    <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => upload([...e.target.files], 'logo')} />
                    <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload([...e.target.files], 'photo')} />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" type="button" variant="dark" onClick={() => logoRef.current?.click()} disabled={uploading || !!logo || pics.length >= MAX_PICS}>{logo ? 'Logo added' : 'Add logo'}</Button>
                      <Button size="sm" type="button" variant="outline" onClick={() => photoRef.current?.click()} disabled={uploading || pics.length >= MAX_PICS}>Add photos</Button>
                      <span className="text-sm text-ink-mute">{pics.length}/{MAX_PICS} · or paste with Ctrl+V</span>
                    </div>
                    {pics.length > 0 && (
                      <ul className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
                        {pics.map((a) => (
                          <li key={a.id} className="relative">
                            <img src={a.url} alt={a.name} className={`aspect-square w-full rounded-xl bg-white ring-1 ring-ink/10 ${a.role === 'logo' ? 'object-contain p-1' : 'object-cover'}`} />
                            <span className="mt-1 block truncate text-[11px] text-ink-soft">{a.role === 'logo' ? '⭐ logo' : a.name}</span>
                            <button type="button" onClick={() => removePic(a)} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink/80 text-xs text-white" aria-label={`Remove ${a.name}`}>✕</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {uploading && <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft"><Spinner className="size-4" />Uploading…</p>}
                  </div>
                )}

                {q.type === 'sound' && (
                  <div className="options options-wide mt-6">
                    <input ref={musicRef} type="file" accept="audio/*" hidden onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setUploading(true); setError('');
                      try { const form = new FormData(); form.append('file', f); form.append('role', 'music'); form.append('name', 'my music'); await api(`/projects/${id}/assets`, { method: 'POST', form }); answer('own'); }
                      catch (err) { setError(err.message); } finally { setUploading(false); e.target.value = ''; }
                    }} />
                    <Chip sub="Smooth whooshes, pops and clicks timed to the motion" onClick={() => answer('sfx')}>Sound effects</Chip>
                    <Chip sub="Gentle piano under the effects" onClick={() => answer('piano')}>Soft piano</Chip>
                    <Chip sub="Light, calm background music under the effects" onClick={() => answer('soft')}>Soft music</Chip>
                    <Chip sub="Upload an MP3 or WAV" onClick={() => musicRef.current?.click()}>{uploading ? 'Uploading…' : 'Use my own music'}</Chip>
                    <Chip onClick={() => answer('none')}>No sound</Chip>
                  </div>
                )}

                {q.type === 'colors' && (
                  <div className="options mt-6">
                    <Chip onClick={() => answer('style', { colorMode: 'style', colors: {} })}>The style's colours</Chip>
                    {logo && <Chip onClick={async () => { try { const c = await logoColors(logo.url); answer('logo', { colorMode: 'logo', colors: c || {} }); } catch { answer('style', { colorMode: 'style', colors: {} }); } }}>Match my logo</Chip>}
                    <ColorPick onPick={(c) => answer('own', { colorMode: 'own', colors: c })} />
                  </div>
                )}

                {q.type === 'style' && (
                  <div className="mt-6">
                    <Button size="sm" type="button" className="mb-4" onClick={() => answer('auto', { styleAuto: true, styleId: undefined })}>Let Animora choose for me</Button>
                    <StylePicker value={b.styleId} onPick={(s) => answer(s.id, { styleId: s.id, styleAuto: false })} />
                  </div>
                )}

                {q.type === 'scenes' && (
                  <div className="mt-6">
                    <button type="button" className="auto-pick press" onClick={() => answer('auto')}>
                      <span className="auto-spark" aria-hidden="true">✦</span>
                      <span><b>Let the AI choose for me</b><small>It plans the best scenes for your business. Recommended.</small></span>
                    </button>
                    <p className="wiz-sub">Or pick the scenes you want</p>
                    <ScenePicker value={multi} onChange={setMulti} hasPhotos={pics.filter((p) => p.role !== 'logo').length >= 2} />
                    <p className="wiz-foot mt-3">The AI adds the rest. Pick up to 8.</p>
                  </div>
                )}

                {q.chips && (
                  <div className="options mt-4">
                    {q.chips.map((c) => <Chip key={c} onClick={() => setText((t) => (t ? `${t.trim()}\n${c}` : c))}>{c}</Chip>)}
                  </div>
                )}
              </>
            )}

            {finished && (
              <div className="py-4">
                <h2 className="wiz-q">{building ? (what === 'flyer' ? 'Designing your flyer…' : 'Planning your scenes…') : project.plan ? 'Your answers are saved.' : `Ready when you are.`}</h2>
                <p className="wiz-hint">{building ? 'This takes a few seconds.' : project.plan ? `Change any answer on the left, or open your ${what}.` : `I have everything I need to make your ${what}.`}</p>
                {building && <div className="mt-5 flex"><div className="bubble-ai typing px-4 py-3.5"><span /><span /><span /></div></div>}
                {what === 'video' && !project.code && lengthWarning(b, b.duration) && (
                  <div className="mt-5 rounded-[14px] border border-amber-300 bg-amber-50 p-4 text-[14px] leading-relaxed text-ink" role="alert">
                    <p>{lengthWarning(b, b.duration).text}</p>
                    <Button size="sm" type="button" className="mt-3" onClick={() => save({ duration: lengthWarning(b, b.duration).rec })}>Use {lengthWarning(b, b.duration).rec} seconds</Button>
                  </div>
                )}
              </div>
            )}

            {error && <div className="mt-5"><Alert onClose={() => setError('')}>{error}</Alert></div>}

            <div className="wiz-actions">
              {!finished && <button type="button" onClick={goBack} disabled={isFirst || building} className="wiz-back">← Back</button>}
              <span className="flex-1" />
              {!finished && q?.optional && !q.done && <button type="button" onClick={skip} className="wiz-skip">Skip</button>}
              {!finished && b.name && q && !['mode', 'paste', 'name'].includes(q.id) && !q.done && <button type="button" onClick={makeNow} disabled={building || reading} className="wiz-now">Make it now</button>}
              {false}
              {!finished && needsContinue && <Button type="submit" size="lg" loading={reading} disabled={continueDisabled}>{continueLabel}</Button>}
              {finished && (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                  <Button type="button" size="lg" className="w-full sm:w-auto" loading={building} onClick={() => (project.plan && b.done ? navigate(`/p/${id}/studio${project.code ? '' : '?generate=1'}`) : build(b))}>
                    {project.plan && project.code ? `Open my ${what}` : `Make my ${what}`}
                  </Button>
                  {project.plan && <button type="button" onClick={() => build(b)} disabled={building} className="text-sm font-semibold text-ink-mute hover:text-ink">Plan again from my answers</button>}
                </div>
              )}
            </div>
          </motion.form>
        </section>

        {/* right: your ad so far */}
        <aside className="wiz-side">
          <div className="surface p-5">
            <h2 className="font-bold">Your {what} so far</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              {b.name && <div><dt className="text-ink-mute">Business</dt><dd className="font-semibold">{b.name}{b.category ? ` · ${b.category}` : ''}</dd></div>}
              {b.headline && <div><dt className="text-ink-mute">Message</dt><dd className="font-semibold">{(b.headlines || [b.headline]).join(', ')}</dd></div>}
              {b.aspect && <div><dt className="text-ink-mute">Format</dt><dd className="font-semibold">{ASPECT_OPTS.find((o) => o.v === b.aspect)?.l} {b.duration ? `· ${duration(b.duration)}` : ''}</dd></div>}
              {b.scenes?.length > 0 && <div><dt className="text-ink-mute">Scenes</dt><dd className="font-semibold">{b.scenes.map((id) => SCENE_OPTIONS.find((o) => o.id === id)?.t || id).join(', ')}</dd></div>}
              {b.colors?.primary && <div><dt className="text-ink-mute">Colours</dt><dd className="flex gap-1">{Object.values(b.colors).map((c) => <span key={c} className="size-5 rounded-full ring-1 ring-black/10" style={{ background: c }} />)}</dd></div>}
            </dl>
            {pics.length > 0 && (
              <ul className="mt-3 grid grid-cols-5 gap-1.5">
                {pics.map((a) => <li key={a.id}><img src={a.url} alt={a.name} className={`aspect-square w-full rounded-lg bg-white ${a.role === 'logo' ? 'object-contain p-0.5' : 'object-cover'}`} /></li>)}
              </ul>
            )}
            {!b.name && <p className="mt-2 text-sm text-ink-soft">Answer the questions and I'll make the {what} for you. Paste pictures any time (up to {MAX_PICS}).</p>}
          </div>
          {project.plan && (
            <div className="surface p-5">
              <h2 className="font-bold">Plan</h2>
              <p className="text-sm text-ink-mute">{what === 'flyer' ? `Flyer · ${project.plan.aspect_ratio}` : `${duration(project.plan.duration_seconds)} · ${ASPECTS[project.plan.aspect_ratio]?.label} · ${project.plan.scenes.length} scenes`}</p>
              <ol className="mt-3 max-h-64 space-y-1.5 overflow-auto text-sm">
                {project.plan.scenes.map((s) => <li key={s.id} className="rounded-xl bg-lilac px-3 py-2">{what !== 'flyer' && <span className="tabular-nums text-ink-mute">{s.start}–{s.end}s</span>} {[].concat(s.on_screen_text).filter(Boolean).join(' · ')}</li>)}
              </ol>
            </div>
          )}
        </aside>
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-xl" role="status">{toast}</div>}
    </div>
  );
}

function ColorPick({ onPick }) {
  const [open, setOpen] = useState(false);
  const [c, setC] = useState({ primary: '#1F6FEB', background: '#0B1B33' });
  if (!open) return <Chip onClick={() => setOpen(true)}>Pick my own</Chip>;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-2 ring-1 ring-ink/10">
      <label className="flex items-center gap-2 text-sm">Main <input type="color" value={c.primary} onChange={(e) => setC({ ...c, primary: e.target.value })} className="size-8 rounded" /></label>
      <label className="flex items-center gap-2 text-sm">Background <input type="color" value={c.background} onChange={(e) => setC({ ...c, background: e.target.value })} className="size-8 rounded" /></label>
      <Button size="sm" variant="dark" onClick={() => onPick(c)}>Use these</Button>
    </div>
  );
}
