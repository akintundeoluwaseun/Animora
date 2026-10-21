// Flyers v2: nine distinct compositions instead of one skeleton, each wearing the chosen style's look
// (display font + type treatment + background world, the same looks as the Motion videos).
//   poster   type-led magazine cover          price    the offer in a giant burst
//   event    date block + ticket stub          menu     a menu board with dotted leaders
//   photo    full-bleed photo, glass card      diagonal photo / colour split on a diagonal
//   collage  polaroids with tape               services icon tiles
//   hiring   "We're hiring" with roles
// The page is one still frame with an empty paused GSAP timeline (like the v1 flyers), so previews,
// thumbnails and downloads keep working unchanged.
import { fontsUrl } from './motion/looks.js';

export const FLYER2_LAYOUTS = ['poster', 'price', 'event', 'menu', 'photo', 'diagonal', 'collage', 'services', 'hiring'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const hex = (h) => { const n = parseInt(String(h || '#000000').replace('#', ''), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = (h) => { const c = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const rgba = (h, a) => { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483646 + 1; };

const G = {
  check: 'M5 12.5l4.2 4.2L19 7', bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  pin: 'M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', chat: 'M4 5h16v11H9l-5 4z',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2', globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  at: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1', sparkle: 'M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z',
  bag: 'M6 8h12l-1 12H7zM9 8a3 3 0 0 1 6 0', gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13', shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z',
  truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
  leaf: 'M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7', cup: 'M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17', home: 'M3 11l9-7 9 7v9H3zM9 20v-6h6v6',
  book: 'M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 21V5', scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.5 7.5L20 19M8.5 16.5L20 5', arrow: 'M5 12h14M13 6l6 6-6 6',
  briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
};
const ic = (k, size, color, sw = 2.2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color || 'currentColor'}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${G[k] || G.check}"/></svg>`;
const GLYPH_WORDS = [[/deliver|ship|dispatch|logistic/i, 'truck'], [/fast|quick|instant|same.?day|express/i, 'bolt'], [/love|care|gentle|family|kid|baby/i, 'heart'], [/best|quality|premium|top|award|star/i, 'star'], [/hour|time|open|24|daily|day/i, 'clock'],
  [/where|address|location|visit|near/i, 'pin'], [/chat|whatsapp|message|support/i, 'chat'], [/secure|safe|trust|warrant|guarant/i, 'shield'], [/gift|free|bonus|offer/i, 'gift'], [/fresh|organic|natural|farm|plant/i, 'leaf'], [/drink|coffee|tea|juice|cafe/i, 'cup'],
  [/home|house|room|estate|rent/i, 'home'], [/class|learn|school|course|train|tutor/i, 'book'], [/hair|cut|barb|salon|tailor|sew/i, 'scissors'], [/job|work|career|hire|role/i, 'briefcase'], [/shop|buy|order|store|sale/i, 'bag']];
const glyphFor = (t, i) => (GLYPH_WORDS.find(([re]) => re.test(t)) || [0, ['sparkle', 'star', 'check', 'heart', 'bolt', 'gift'][i % 6]])[1];

function contactLines(contact) {
  return String(contact || '').split(/\s*(?:·|\||;|\n|,\s(?=\d|www|http|@|\+))\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 3).map((s) => ({
    text: s,
    icon: /^\+?\d[\d\s-]{6,}$/.test(s.replace(/whatsapp|call|tel:?/gi, '').trim()) ? (/whatsapp/i.test(s) ? 'chat' : 'phone') : /www|http|\.com|\.ng|\.app|\.co\b/i.test(s) ? 'globe' : /^@|instagram|ig:/i.test(s) ? 'at' : 'pin',
  }));
}

/** Pick a composition from what the flyer is for, what the owner prefers, and what they gave us. */
export function chooseFlyerLayout({ kinds = [], pref = '', photos = 0, items = 0, priced = 0, offer = '', when = null, features = 0, avoid = null, seed = 1 }) {
  const k = new Set([].concat(kinds).map((x) => String(x).toLowerCase()));
  const has = (re) => [...k].some((x) => re.test(x));
  const cands = [];
  const add = (l, w) => { if (l !== avoid) cands.push([l, w]); };
  if (has(/hiring|job|vacan/)) add('hiring', 9);
  if (has(/event|party|show|concert|wedding/) || when) add('event', when ? 9 : 5);
  if (has(/menu|price list/) && items >= 3) add('menu', 9);
  if (has(/sale|discount|offer|promo/) || offer || pref === 'price') add('price', offer || priced ? 8 : 3);
  if (has(/service/) && (features + items) >= 3) add('services', 8);
  if (has(/launch|new|opening/)) { add('poster', 6); if (photos) add('photo', 6); }
  if (pref === 'photo' && photos) { add('photo', 9); add('diagonal', 7); if (photos >= 2) add('collage', 7); }
  if (pref === 'type') add('poster', 9);
  if (photos >= 3) add('collage', 4);
  if (photos >= 1) { add('photo', 4); add('diagonal', 4); }
  if (items >= 3 && priced >= 2) add('menu', 4);
  if (features + items >= 4) add('services', 3);
  add('poster', 3);
  if (offer || priced) add('price', 2);
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const total = cands.reduce((a, [, w]) => a + w * w, 0);
  let r = rnd() * total;
  for (const [l, w] of cands) { r -= w * w; if (r <= 0) return l; }
  return cands[0]?.[0] || 'poster';
}

// ---------------------------------------------------------------------------
// background worlds (still versions of the Motion decos)
function decoHtml(deco, { W, H, A, A2, dark, brand, display, n, seed }) {
  let s = seed || 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const L = (css, inner = '') => `<div class="dc" style="${css}">${inner}</div>`;
  const ink = dark ? '255,255,255' : '17,17,20';
  switch (deco) {
    case 'sunburst': case 'halftone': return L(`left:50%;top:42%;width:${Math.max(W, H) * 2.4}px;height:${Math.max(W, H) * 2.4}px;margin:-${Math.max(W, H) * 1.2}px 0 0 -${Math.max(W, H) * 1.2}px;background:repeating-conic-gradient(from 6deg, ${rgba(dark ? A2 : A, 0.14)} 0deg 7deg, transparent 7deg 18deg);-webkit-mask-image:radial-gradient(circle,#000 0%,transparent 40%);mask-image:radial-gradient(circle,#000 0%,transparent 40%)`)
      + (deco === 'halftone' ? L(`right:-12%;bottom:-8%;width:${W * 0.9}px;height:${W * 0.9}px;background-image:radial-gradient(${dark ? rgba(A2, 0.4) : 'rgba(17,17,17,.3)'} ${n(7)},transparent ${n(8)});background-size:${n(26)} ${n(26)};-webkit-mask-image:radial-gradient(circle at 70% 70%,#000,transparent 65%);mask-image:radial-gradient(circle at 70% 70%,#000,transparent 65%)`) : '');
    case 'golddust': return Array.from({ length: 34 }, () => { const z = n(rnd() * 7 + 3); return L(`left:${rnd() * 100}%;top:${rnd() * 100}%;width:${z};height:${z};border-radius:50%;background:${A};box-shadow:0 0 ${n(12)} ${rgba(A, 0.9)};opacity:${(rnd() * 0.6 + 0.35).toFixed(2)}`); }).join('')
      + L(`inset:${n(28)};border:${n(2)} solid ${rgba(A, 0.4)};border-radius:${n(6)}`);
    case 'dotgrid': return L(`inset:0;background-image:radial-gradient(rgba(${ink},.12) ${n(2.4)},transparent ${n(3)});background-size:${n(46)} ${n(46)};-webkit-mask-image:radial-gradient(ellipse 75% 65% at 50% 45%,#000,transparent);mask-image:radial-gradient(ellipse 75% 65% at 50% 45%,#000,transparent)`);
    case 'neongrid': return L(`left:-50%;right:-50%;bottom:-2%;height:42%;transform:perspective(${n(700)}) rotateX(66deg);transform-origin:50% 100%;background-image:linear-gradient(${rgba(A, 0.55)} ${n(3)},transparent ${n(3)}),linear-gradient(90deg,${rgba(A, 0.55)} ${n(3)},transparent ${n(3)});background-size:${n(110)} ${n(110)};-webkit-mask-image:linear-gradient(to top,#000 25%,transparent 92%);mask-image:linear-gradient(to top,#000 25%,transparent 92%)`)
      + L(`left:0;right:0;top:58%;height:${n(4)};background:linear-gradient(90deg,transparent,${A},transparent);box-shadow:0 0 ${n(30)} ${n(6)} ${rgba(A, 0.45)}`)
      + L(`inset:0;background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 ${n(2)},transparent ${n(2)} ${n(6)})`);
    case 'tape': { const w = (String(brand || 'NEW').toUpperCase() + '  ✦  ').repeat(12); return [[8, -7], [92, 6]].map(([y, r]) => L(`left:-30%;width:160%;top:${y}%;height:${n(84)};margin-top:-${n(42)};background:${A};color:${lum(A) > 0.45 ? '#0A0A0A' : '#fff'};font-family:${display};font-size:${n(46)};line-height:${n(84)};white-space:nowrap;overflow:hidden;transform:rotate(${r}deg);box-shadow:0 ${n(14)} ${n(30)} rgba(0,0,0,.35)`, esc(w))).join(''); }
    case 'confetti': return Array.from({ length: 46 }, (_, i) => L(`left:${rnd() * 100}%;top:${rnd() * 100}%;width:${n(rnd() * 8 + 10)};height:${n(rnd() * 16 + 18)};background:${[A, A2, '#FFFFFF', '#FFD447'][i % 4]};border-radius:${n(3)};transform:rotate(${Math.round(rnd() * 360)}deg);opacity:.85`)).join('');
    case 'bubbles': return Array.from({ length: 14 }, (_, i) => { const z = rnd() * 150 + 40; return L(`left:${rnd() * 100}%;top:${rnd() * 100}%;width:${n(z)};height:${n(z)};margin:-${n(z / 2)} 0 0 -${n(z / 2)};border-radius:50%;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.85) 0 12%,${rgba(i % 2 ? A2 : A, 0.3)} 13% 62%,${rgba(A, 0.08)} 100%)`); }).join('');
    case 'orbits': return [[1.3, 0.45, 12], [0.95, 0.32, -18], [1.6, 0.6, 6]].map(([a, b, r]) => L(`left:50%;top:46%;width:${W * a}px;height:${W * a * b}px;margin:-${W * a * b / 2}px 0 0 -${W * a / 2}px;border:${n(2)} solid ${rgba(A, 0.3)};border-radius:50%;transform:rotate(${r}deg)`)).join('')
      + L(`inset:-10%;background:radial-gradient(40% 35% at 25% 30%,${rgba(A, 0.22)},transparent 70%),radial-gradient(35% 35% at 80% 70%,${rgba(A2, 0.18)},transparent 70%)`);
    case 'beams': return Array.from({ length: 6 }, (_, k) => L(`left:50%;top:-10%;width:${n(170)};height:${H * 1.3}px;margin-left:-${n(85)};background:linear-gradient(180deg,${dark ? 'rgba(255,240,200,.14)' : rgba(A, 0.14)},transparent 85%);transform-origin:50% 0;transform:rotate(${-46 + k * 18}deg);filter:blur(${n(6)})`)).join('');
    case 'petals': return Array.from({ length: 16 }, (_, i) => { const z = rnd() * 60 + 34; return L(`left:${rnd() * 100}%;top:${rnd() * 100}%;width:${n(z)};height:${n(z * 0.7)};border-radius:70% 0 70% 0;background:linear-gradient(135deg,${rgba(i % 3 ? A2 : A, 0.45)},${rgba(A, 0.08)});transform:rotate(${Math.round(rnd() * 180)}deg)`); }).join('');
    case 'speed': return Array.from({ length: 16 }, (_, k) => L(`left:${rnd() * 60}%;top:${22 + rnd() * 46}%;width:${n(rnd() * 400 + 200)};height:${n(rnd() * 3 + 2)};background:linear-gradient(90deg,transparent,${k % 4 ? (dark ? 'rgba(255,255,255,.35)' : 'rgba(17,17,17,.25)') : A})`)).join('')
      + [[1.5, -4], [98.5, -4]].map(([y, r]) => L(`left:-10%;width:120%;top:${y}%;height:${n(34)};background:${A};transform:skewY(${r}deg);opacity:.9`)).join('');
    case 'blueprint': return L(`inset:0;background-image:linear-gradient(${rgba(A2, 0.12)} 1px,transparent 1px),linear-gradient(90deg,${rgba(A2, 0.12)} 1px,transparent 1px),linear-gradient(${rgba(A2, 0.12)} 2px,transparent 2px),linear-gradient(90deg,${rgba(A2, 0.12)} 2px,transparent 2px);background-size:${n(40)} ${n(40)},${n(40)} ${n(40)},${n(200)} ${n(200)},${n(200)} ${n(200)}`)
      + L(`left:50%;top:44%;width:${n(760)};height:${n(760)};margin:-${n(380)} 0 0 -${n(380)};border:${n(2)} solid ${rgba(A, 0.35)};transform:rotate(45deg)`);
    case 'paper': return L(`inset:0;opacity:.5;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3'/><feColorMatrix values='0 0 0 0 0.4 0 0 0 0 0.35 0 0 0 0 0.3 0 0 0 .18 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`);
    case 'kente': return [0, 1].map((b) => L(`left:0;right:0;${b ? 'bottom' : 'top'}:0;height:${n(70)};background-image:repeating-linear-gradient(90deg,${A} 0 ${n(60)},${A2} ${n(60)} ${n(84)},#111 ${n(84)} ${n(100)},#1F8A3B ${n(100)} ${n(150)},#111 ${n(150)} ${n(166)}),repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 ${n(6)},transparent ${n(6)} ${n(18)});background-blend-mode:multiply`)).join('');
    case 'waves': return `<svg class="dc" style="left:0;bottom:0;width:${W}px;height:${Math.round(H * 0.2)}px" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 60 Q 125 0 250 60 T 500 60 T 750 60 T 1000 60 V200 H0Z" fill="${rgba(A, 0.22)}"/><path d="M0 100 Q 125 50 250 100 T 500 100 T 750 100 T 1000 100 V200 H0Z" fill="${rgba(A2, 0.3)}"/><path d="M0 140 Q 125 100 250 140 T 500 140 T 750 140 T 1000 140 V200 H0Z" fill="${rgba(A, 0.35)}"/></svg>`;
    case 'glow': return [[20, 22, 900, A], [85, 70, 1000, A2], [50, 100, 800, A]].map(([x, y, z, c]) => L(`left:${x}%;top:${y}%;width:${n(z)};height:${n(z)};margin:-${n(z / 2)} 0 0 -${n(z / 2)};border-radius:50%;background:radial-gradient(circle,${rgba(c, dark ? 0.28 : 0.18)},transparent 65%)`)).join('');
    case 'ribbon': return `<svg class="dc" style="left:0;top:0;width:${W}px;height:${H}px" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="rb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${A}"/><stop offset="1" stop-color="${A2}"/></linearGradient></defs><path d="M ${-W * 0.2} ${H * 0.86} C ${W * 0.25} ${H * 0.55}, ${W * 0.55} ${H * 1.04}, ${W * 1.2} ${H * 0.66}" fill="none" stroke="url(#rb)" stroke-width="${Math.round(W * 0.1)}" stroke-linecap="round" opacity="${dark ? 0.75 : 0.9}"/></svg>`;
    case 'pulse': return [0.5, 0.9, 1.3].map((k) => L(`left:50%;top:46%;width:${W * k}px;height:${W * k}px;margin:-${W * k / 2}px 0 0 -${W * k / 2}px;border-radius:50%;border:${n(3)} solid ${rgba(A, 0.22)}`)).join('');
    case 'spot': return L(`left:50%;top:38%;width:${W * 1.3}px;height:${W * 1.3}px;margin:-${W * 0.65}px 0 0 -${W * 0.65}px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,${dark ? 0.09 : 0.5}),transparent 62%)`);
    default: return '';
  }
}

// ---------------------------------------------------------------------------
export function flyerHtml2(data) {
  const { W, H, brand, logo } = data;
  const look = data.look || { theme: 'dark', display: 'Inter', dw: 800, ui: 'Inter', text: 'plain', deco: 'none' };
  const c = data.colors || {};
  const A = /^#[0-9a-f]{6}$/i.test(c.primary || '') ? c.primary : '#3D5AFE';
  const A2 = /^#[0-9a-f]{6}$/i.test(look.accent2 || c.secondary || '') ? (look.accent2 || c.secondary) : mix(A, '#FFFFFF', 0.4);
  const dark = look.theme === 'dark';
  const BG = /^#[0-9a-f]{6}$/i.test(look.bg || c.background || '') ? (look.bg || c.background) : dark ? '#0E0E12' : '#F4F4F6';
  const bg1 = dark ? mix(BG, '#000000', lum(BG) > 0.2 ? 0.75 : 0.15) : lum(BG) > 0.55 ? BG : '#F6F6F8';
  const ink = dark ? '#F7F7F9' : '#111114', mute = dark ? 'rgba(255,255,255,.66)' : 'rgba(17,17,20,.6)';
  let AL = A; for (let i = 0; i < 12 && lum(AL) > 0.3; i++) AL = mix(AL, '#000000', 0.12);
  let AD = A; for (let i = 0; i < 12 && lum(AD) < 0.2; i++) AD = mix(AD, '#FFFFFF', 0.14);
  const ACC = dark ? AD : AL;
  const onA = lum(A) > 0.45 ? '#111111' : '#FFFFFF', onA2 = lum(A2) > 0.45 ? '#111111' : '#FFFFFF';
  const U = Math.min(W, H) / 1080, tall = H / W > 1.45, wide = W > H * 1.05;
  const n = (v) => `${Math.round(v * U)}px`;
  const display = `'${look.display || 'Inter'}', '${look.ui || 'Inter'}', 'Inter', system-ui, sans-serif`;
  const uiF = `'${look.ui || 'Inter'}', 'Inter', system-ui, sans-serif`;
  const url = (name) => (data.images || {})[name] || null;
  const photos = [url(data.heroImg), ...Object.values(data.images || {})].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const hero = photos[0] || null;
  const items = (data.items || []).map((it) => ({ ...it, src: url(it.img) }));
  const contacts = contactLines(data.contact);
  const T = look.text;

  // headline with the style's treatment on the highlight word
  const hlKey = String(data.highlight || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const words = String(data.headline || brand || '').split(/\s+/).filter(Boolean);
  let hot = words.findIndex((w) => hlKey && w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === hlKey);
  if (hot < 0 && words.length > 1) hot = words.length - 1;
  const headline = words.map((w, i) => (i === hot ? `<em>${esc(w)}</em>` : esc(w))).join(' ');
  const h1 = (cls = '') => `<h1 class="fit ${cls}">${headline}</h1>`;

  const initials = String(brand || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).filter((x) => !/^(the|and|of)$/i.test(x)).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';
  const mark = (size = 104, onBrand = false) => logo
    ? `<span class="mk ${logo.transparent ? 'clear' : 'boxed'}" style="height:${n(size)};${logo.transparent ? '' : `width:${n(size)};`}"><img src="${esc(logo.url)}" crossorigin="anonymous" alt=""></span>`
    : `<span class="mk mono ${onBrand ? 'on' : ''}" style="width:${n(size)};height:${n(size)};font-size:${n(size * (initials.length > 1 ? 0.4 : 0.52))}">${esc(initials)}</span>`;
  const brandRow = (onBrand = false) => `<header class="brandrow">${mark(96, onBrand)}<span class="bn">${esc(brand)}</span></header>`;
  const cta = (cls = '') => `<div class="cta ${cls}"><span>${esc(data.cta || 'Order now')}</span>${ic('arrow', n(40).replace('px', ''), 'currentColor', 2.6)}</div>`;
  const contactList = (cls = '') => (contacts.length ? `<div class="contacts ${cls}">${contacts.map((x) => `<span>${ic(x.icon, Math.round(34 * U), 'currentColor')}${esc(x.text)}</span>`).join('')}</div>` : '');
  const feats = (max = 4, cls = '') => ((data.features || []).length ? `<ul class="feats ${cls}">${data.features.slice(0, max).map((f, i) => `<li><i>${ic(glyphFor(f, i), Math.round(30 * U), 'currentColor', 2.4)}</i><span>${esc(f)}</span></li>`).join('')}</ul>` : '');
  const sub = data.subhead ? `<p class="sub">${esc(data.subhead)}</p>` : '';
  const offer = String(data.offer || '').trim() || items.find((x) => x.price)?.price || '';
  const offerItem = data.offer ? '' : items.find((x) => x.price)?.title || '';
  const when = data.when || null;

  let body = '';
  const L = FLYER2_LAYOUTS.includes(data.layout) ? data.layout : 'poster';
  if (L === 'poster') {
    const num = String(hash(brand) % 90 + 10);
    body = `<div class="pf">
      <div class="topline">${brandRow()}<span class="tag">${esc(data.badge || (data.kinds || [])[0] || 'New')}</span></div>
      <div class="rule"></div>
      <section class="hero-type">${h1('giant')}${sub}</section>
      ${hero ? `<div class="cut"><img src="${esc(hero)}" crossorigin="anonymous" alt=""></div>` : `<div class="ghost">${num}</div>`}
      <div class="rule thin"></div>
      <section class="cols">${(data.features || []).slice(0, 4).map((f, i) => `<div class="col"><b>${String(i + 1).padStart(2, '0')}</b><span>${esc(f)}</span></div>`).join('') || `<div class="col wide">${sub || esc(brand)}</div>`}</section>
      <footer class="foot">${cta()}${contactList()}</footer></div>`;
  } else if (L === 'price') {
    const old = data.oldPrice ? `<s>${esc(data.oldPrice)}</s>` : '';
    body = `<div class="pf price">
      ${brandRow(true)}
      <section class="pr-head">${h1('onbrand')}</section>
      <div class="burst"><div class="burst-in"><span class="lbl">${esc(/%|off/i.test(offer) ? 'Save' : 'Only')}</span><b class="fit-one">${esc(offer || 'Offer')}</b>${old}</div></div>
      ${offerItem ? `<p class="pr-item">${esc(offerItem)}</p>` : sub}
      <div class="band"><span>${esc(((data.badge || 'Limited offer') + '  ✦  ').repeat(8))}</span></div>
      <footer class="foot strip">${cta('dark')}${contactList()}</footer></div>`;
  } else if (L === 'event') {
    const day = when?.day || '', mon = String(when?.month || '').toUpperCase().slice(0, 3);
    body = `<div class="pf event ${hero ? '' : 'nophoto'}">
      ${brandRow()}
      <section class="ev">${day ? `<div class="date"><b>${esc(day)}</b><span>${esc(mon)}</span>${when?.weekday ? `<i>${esc(when.weekday)}</i>` : ''}</div>` : ''}<div class="ev-t">${h1()}${sub}</div></section>
      ${hero ? `<div class="ev-photo"><img src="${esc(hero)}" crossorigin="anonymous" alt=""></div>` : ''}
      <ul class="ev-info">${when?.time ? `<li>${ic('clock', Math.round(40 * U), ACC)}<span>${esc(when.time)}</span></li>` : ''}${when?.place ? `<li>${ic('pin', Math.round(40 * U), ACC)}<span>${esc(when.place)}</span></li>` : ''}${(data.features || []).slice(0, 3).map((f, i) => `<li>${ic(glyphFor(f, i), Math.round(40 * U), ACC)}<span>${esc(f)}</span></li>`).join('')}</ul>
      <footer class="ticket"><div class="t-l"><span class="lbl">${esc(offer ? (/%|off|save|sale|discount/i.test(offer) ? 'Special' : (/\d/.test(offer) ? 'From' : 'Offer')) : 'Entry')}</span><b>${esc(offer || 'Free')}</b></div><div class="t-r">${cta()}${contactList('small')}</div></footer></div>`;
  } else if (L === 'menu') {
    const list = items.slice(0, tall ? 8 : 6);
    body = `<div class="pf menu">
      ${brandRow()}
      <section class="mn-head"><span class="orn"></span>${h1('center')}<span class="orn"></span>${sub}</section>
      <div class="mn-body ${hero ? 'with-ph' : ''}"><ul class="mn">${list.map((it) => `<li><b>${esc(it.title)}</b><i></i><em>${esc(it.price || '')}</em></li>`).join('')}</ul>${hero ? `<div class="mn-ph"><img src="${esc(hero)}" crossorigin="anonymous" alt=""></div>` : ''}</div>
      <footer class="foot center">${cta()}${contactList()}</footer></div>`;
  } else if (L === 'photo') {
    body = `<div class="pf photo"><div class="bleed">${hero ? `<img src="${esc(hero)}" crossorigin="anonymous" alt="">` : ''}</div><div class="scrim"></div>
      <div class="ph-top">${brandRow(true)}${data.badge ? `<span class="tag glass">${esc(data.badge)}</span>` : ''}</div>
      <section class="ph-copy">${h1('onphoto')}${sub}${feats(3, 'glass')}</section>
      <footer class="foot onphoto">${cta()}${contactList()}</footer></div>`;
  } else if (L === 'diagonal') {
    body = `<div class="pf diag"><div class="dg-top">${hero ? `<img src="${esc(hero)}" crossorigin="anonymous" alt="">` : `<div class="dg-art">${mark(240, true)}</div>`}</div>
      <div class="dg-top-row">${brandRow(true)}</div>
      ${data.badge || offer ? `<div class="seal"><span>${esc(data.badge || offer)}</span></div>` : ''}
      <section class="dg-copy">${h1()}${sub}${feats(4)}</section>
      <footer class="foot">${cta()}${contactList()}</footer></div>`;
  } else if (L === 'collage') {
    const pics = photos.slice(0, 4);
    body = `<div class="pf collage">${brandRow()}
      <section class="cl-head">${h1()}${sub}</section>
      <div class="pola n${pics.length}">${pics.map((p, i) => `<figure style="--r:${[-6, 5, -3, 7][i]}deg"><i class="tape"></i><img src="${esc(p)}" crossorigin="anonymous" alt=""><figcaption>${esc(items[i]?.title || '')}</figcaption></figure>`).join('')}</div>
      <footer class="foot">${cta()}${contactList()}</footer></div>`;
  } else if (L === 'services') {
    const tiles = [...(data.features || []).map((t) => ({ title: t })), ...items].slice(0, 6);
    body = `<div class="pf services">${brandRow()}
      <section class="sv-head">${h1()}${sub}</section>
      <div class="tiles n${tiles.length}">${tiles.map((t, i) => `<div class="tile"><i>${ic(glyphFor(t.title, i), Math.round(54 * U), '#fff', 2.2)}</i><b>${esc(t.title)}</b>${t.price ? `<em>${esc(t.price)}</em>` : ''}</div>`).join('')}</div>
      <footer class="foot">${cta()}${contactList()}</footer></div>`;
  } else if (L === 'hiring') {
    const roles = [...items.map((x) => x.title), ...(data.features || [])].slice(0, 6);
    body = `<div class="pf hiring">${brandRow()}
      <section class="hr-head"><span class="kicker">${esc(data.badge || 'Join our team')}</span><h1 class="fit giant">We're <em>hiring</em></h1>${sub || `<p class="sub">${esc(data.headline || '')}</p>`}</section>
      <ul class="roles">${roles.map((r) => `<li>${ic('briefcase', Math.round(38 * U), ACC)}<span>${esc(r)}</span></li>`).join('')}</ul>
      <footer class="foot">${cta()}${contactList()}</footer></div>`;
  }

  // treatment CSS for the display type
  const treat = {
    marker: `em { background:${A}; color:${onA}; padding:0 .14em; border-radius:.1em; font-style:normal; -webkit-box-decoration-break:clone; box-decoration-break:clone; }`,
    sticker: `em { display:inline-block; background:${A2}; color:${onA2}; padding:.02em .26em; border-radius:.32em; transform:rotate(-3deg); font-style:normal; box-shadow:0 ${n(12)} ${n(26)} ${rgba(A2, 0.35)}; }`,
    neon: `h1 { text-shadow:0 0 ${n(6)} rgba(255,255,255,.6), 0 0 ${n(24)} ${rgba(ACC, 0.85)}, 0 0 ${n(60)} ${rgba(ACC, 0.5)}; } em { color:${ACC}; font-style:normal; }`,
    outline: `h1 { -webkit-text-stroke:${n(5)} #111; paint-order:stroke fill; text-shadow:${n(7)} ${n(8)} 0 #111; color:#fff; } em { color:${A}; font-style:normal; }`,
    sport: `h1 { font-style:italic; } em { color:${ACC}; font-style:italic; }`,
    spaced: `h1 { letter-spacing:.08em; } em { color:${ACC}; font-style:normal; }`,
    gradient: `em { background:linear-gradient(90deg, ${AD}, ${A2}); -webkit-background-clip:text; background-clip:text; color:transparent; font-style:normal; }`,
    serif: `em { font-style:italic; color:${ACC}; }`,
    condensed: `h1 { line-height:.92; letter-spacing:0; } em { color:${ACC}; font-style:normal; }`,
    glow: `h1 { text-shadow:0 0 ${n(24)} ${rgba(AD, 0.55)}; } em { color:${ACC}; font-style:normal; }`,
    plain: `em { color:${ACC}; font-style:normal; }`,
  }[T] || `em { color:${ACC}; font-style:normal; }`;
  const shadow = dark ? `0 ${n(30)} ${n(80)} ${n(-20)} rgba(0,0,0,.7)` : `0 ${n(24)} ${n(60)} ${n(-18)} rgba(20,20,60,.28)`;
  const surface = dark ? 'rgba(255,255,255,.07)' : '#FFFFFF', line = dark ? 'rgba(255,255,255,.14)' : 'rgba(15,15,40,.1)';
  const css = `
* { box-sizing:border-box; margin:0; padding:0; }
html, body { width:${W}px; height:${H}px; overflow:hidden; background:${bg1}; }
#flyer { position:relative; width:${W}px; height:${H}px; overflow:hidden; color:${ink}; font-family:${uiF}; -webkit-font-smoothing:antialiased;
  background: radial-gradient(120% 80% at 50% 42%, ${dark ? mix(bg1, '#FFFFFF', 0.08) : '#FFFFFF'} 0%, ${bg1} 55%, ${dark ? mix(bg1, '#000000', 0.6) : mix(bg1, '#000000', 0.07)} 100%); }
.dc { position:absolute; pointer-events:none; }
.deco { position:absolute; inset:0; overflow:hidden; z-index:0; }
img { display:block; width:100%; height:100%; object-fit:cover; }
.pf { position:relative; z-index:1; width:100%; height:100%; display:flex; flex-direction:column; padding:${n(70)} ${n(68)} ${n(64)}; gap:${n(28)}; }
h1 { font-family:${display}; font-weight:${look.dw || 800}; line-height:1; letter-spacing:-0.025em; font-size:${n(tall ? 168 : wide ? 130 : 140)}; ${look.upper ? 'text-transform:uppercase;' : ''} overflow:hidden; }
${treat}
.sub { font-size:${n(40)}; line-height:1.3; color:${mute}; font-weight:500; max-width:24em; }
.brandrow { display:flex; align-items:center; gap:${n(22)}; position:relative; z-index:3; }
.bn { font-family:${display}; font-weight:${look.dw || 800}; font-size:${n(40)}; letter-spacing:-0.01em; ${look.upper ? 'text-transform:uppercase;' : ''} }
.mk { display:grid; place-items:center; border-radius:23%; overflow:hidden; flex:none; position:relative; }
.mk.boxed { background:#fff; box-shadow:${shadow}; } .mk.clear img { object-fit:contain; width:auto; max-width:${n(300)}; } .mk.boxed img { object-fit:contain; width:78%; height:78%; }
.mk.mono { background:linear-gradient(155deg, ${mix(A, '#FFFFFF', 0.18)}, ${A} 52%, ${mix(A, '#000000', 0.25)}); color:${onA}; font-family:${display}; font-weight:800; box-shadow:${shadow}; }
.mk.mono.on { background:#fff; color:${AL}; }
.mk.mono::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0) 48%); }
.tag { margin-left:auto; font-family:${uiF}; font-weight:800; font-size:${n(26)}; letter-spacing:.14em; text-transform:uppercase; padding:${n(12)} ${n(22)}; border-radius:999px; border:${n(2)} solid ${line}; }
.tag.glass { color:#fff; border-color:rgba(255,255,255,.4); background:rgba(255,255,255,.12); backdrop-filter:blur(10px); }
.cta { display:inline-flex; align-items:center; gap:${n(16)}; background:${A}; color:${onA}; font-weight:800; font-size:${n(42)}; padding:${n(26)} ${n(44)}; border-radius:999px; white-space:nowrap; box-shadow:0 ${n(20)} ${n(50)} ${n(-14)} ${rgba(A, 0.7)}; }
.cta.dark { background:#111; color:#fff; box-shadow:none; }
.contacts { display:flex; flex-direction:column; gap:${n(8)}; font-weight:700; font-size:${n(34)}; min-width:0; }
.contacts span { display:flex; align-items:center; gap:${n(12)}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .contacts svg { color:${ACC}; flex:none; }
.contacts.small { font-size:${n(28)}; }
.foot { margin-top:auto; display:flex; align-items:center; gap:${n(30)}; flex-wrap:wrap; position:relative; z-index:3; }
.foot.center { justify-content:center; text-align:left; }
.feats { list-style:none; display:flex; flex-wrap:wrap; gap:${n(14)}; }
.feats li { display:flex; align-items:center; gap:${n(12)}; font-weight:700; font-size:${n(32)}; padding:${n(12)} ${n(24)} ${n(12)} ${n(12)}; border-radius:999px; background:${surface}; border:${n(2)} solid ${line}; }
.feats li i { display:grid; place-items:center; width:${n(48)}; height:${n(48)}; border-radius:50%; background:${A}; color:${onA}; }
.feats.glass li { background:rgba(255,255,255,.14); border-color:rgba(255,255,255,.28); color:#fff; backdrop-filter:blur(10px); }
/* poster */
.topline { display:flex; align-items:center; }
.rule { height:${n(6)}; background:${ink}; } .rule.thin { height:${n(2)}; opacity:.5; }
.hero-type { display:flex; flex-direction:column; gap:${n(24)}; position:relative; z-index:2; } .hero-type h1.giant { font-size:${n(tall ? 230 : wide ? 170 : 190)}; max-height:${tall ? Math.round(H * 0.42) : Math.round(H * 0.4)}px; }
.cut { position:absolute; right:${n(-90)}; bottom:${n(tall ? 300 : 170)}; width:${n(tall ? 560 : wide ? 380 : 440)}; height:${n(tall ? 560 : wide ? 380 : 440)}; border-radius:50%; overflow:hidden; border:${n(14)} solid ${surface}; box-shadow:${shadow}; z-index:1; }
.ghost { position:absolute; right:${n(40)}; top:${tall ? '44%' : '40%'}; font-family:${display}; font-weight:800; font-size:${n(tall ? 520 : 420)}; line-height:1; color:${dark ? 'rgba(255,255,255,.05)' : 'rgba(17,17,20,.05)'}; z-index:0; }
.cols { display:grid; grid-template-columns:1fr 1fr; gap:${n(22)} ${n(40)}; position:relative; z-index:2; max-width:${hero ? '60%' : tall ? '100%' : '66%'}; }
.col { display:flex; flex-direction:column; gap:${n(6)}; font-size:${n(32)}; font-weight:600; } .col b { font-family:${display}; font-size:${n(30)}; color:${ACC}; } .col.wide { grid-column:span 2; color:${mute}; }
/* price */
.pf.price { color:${onA}; }
.price-bg { position:absolute; inset:0; background:radial-gradient(120% 90% at 50% 40%, ${mix(A, '#FFFFFF', 0.22)} 0%, ${A} 50%, ${mix(A, '#000000', 0.3)} 100%); }
.price .bn { color:${onA}; } .pr-head { text-align:center; } .pr-head h1 { font-size:${n(tall ? 130 : 110)}; max-height:${n(tall ? 300 : 240)}; color:${onA}; }
.price h1 em { color:${onA2 === '#111111' ? '#111' : A2}; ${T === 'marker' || T === 'sticker' ? `background:${onA}; color:${A};` : ''} }
.burst { position:relative; align-self:center; width:${n(tall ? 660 : wide ? 400 : 480)}; aspect-ratio:1; flex:none; display:grid; place-items:center; margin:${n(tall ? 20 : 0)} 0; }
.burst::before { content:''; position:absolute; inset:0; background:${A2}; clip-path:polygon(${Array.from({ length: 32 }, (_, i) => { const a = (i / 32) * Math.PI * 2, r = i % 2 ? 41 : 50; return `${(50 + r * Math.cos(a)).toFixed(1)}% ${(50 + r * Math.sin(a)).toFixed(1)}%`; }).join(',')}); box-shadow:${shadow}; transform:rotate(-8deg); }
.burst-in { position:relative; display:flex; flex-direction:column; align-items:center; color:${onA2}; transform:rotate(-8deg); text-align:center; width:76%; }
.burst-in .lbl { font-weight:800; font-size:${n(40)}; letter-spacing:.14em; text-transform:uppercase; opacity:.8; }
.burst-in b { font-family:${display}; font-weight:${Math.max(look.dw || 800, 400)}; font-size:${n(tall ? 170 : 130)}; line-height:1; letter-spacing:-0.03em; white-space:nowrap; }
.burst-in s { font-weight:700; font-size:${n(48)}; opacity:.7; text-decoration-thickness:${n(6)}; text-decoration-color:#E5383B; }
.pr-item { text-align:center; font-weight:800; font-size:${n(52)}; color:${onA}; } .price .sub { text-align:center; color:${onA}; opacity:.85; align-self:center; }
.band { position:relative; flex:none; margin:auto ${n(-120)} 0; transform:rotate(-4deg); background:#111; color:#fff; font-family:${display}; font-weight:${look.dw || 800}; font-size:${n(44)}; padding:${n(16)} 0; white-space:nowrap; overflow:hidden; ${look.upper ? '' : 'text-transform:uppercase;'} letter-spacing:.04em; }
.foot.strip { position:absolute; left:0; right:0; bottom:0; margin:0; background:#fff; color:#111; padding:${n(30)} ${n(68)} ${n(36)}; flex-wrap:nowrap; }
.pf.price { padding-bottom:${n(220)}; gap:${n(tall ? 34 : 18)}; }
.price h1 { line-height:1.14; } .price h1 em { display:inline-block; margin-top:${n(10)}; padding:${n(2)} ${n(22)} ${n(8)}; line-height:1.05; }
.pf.price::before { content:''; position:absolute; inset:0; pointer-events:none; background:radial-gradient(circle at 12% 88%, rgba(255,255,255,.16) 0 ${n(180)}, transparent ${n(182)}), radial-gradient(circle at 92% 30%, rgba(0,0,0,.10) 0 ${n(240)}, transparent ${n(242)}), radial-gradient(circle at 80% 92%, rgba(255,255,255,.12) 0 ${n(110)}, transparent ${n(112)}); }
.price > * { position:relative; }
.foot.strip .contacts svg { color:${AL}; }
/* event */
.ev { display:flex; gap:${n(40)}; align-items:flex-start; position:relative; z-index:2; }
.date { flex:none; display:flex; flex-direction:column; align-items:center; justify-content:center; width:${n(250)}; padding:${n(26)} 0; border-radius:${n(34)}; background:${A}; color:${onA}; box-shadow:${shadow}; }
.date b { font-family:${display}; font-weight:800; font-size:${n(150)}; line-height:.9; } .date span { font-weight:800; font-size:${n(52)}; letter-spacing:.12em; } .date i { font-style:normal; font-weight:700; font-size:${n(28)}; opacity:.8; margin-top:${n(4)}; text-transform:uppercase; letter-spacing:.1em; }
.ev-t { display:flex; flex-direction:column; gap:${n(18)}; min-width:0; flex:1; } .ev-t h1 { font-size:${n(tall ? 140 : 112)}; max-height:${n(tall ? 460 : 340)}; }
.ev-photo { flex:1; min-height:${n(200)}; border-radius:${n(40)}; overflow:hidden; box-shadow:${shadow}; position:relative; z-index:2; }
.event.nophoto .ev { margin:auto 0; } .event.nophoto .ev-t h1 { font-size:${n(tall ? 170 : 132)}; max-height:${n(tall ? 620 : 420)}; } .event.nophoto .ev-info li { font-size:${n(46)}; } .event.nophoto .ev-info { margin-bottom:auto; }
.ev-info { list-style:none; display:flex; flex-direction:column; gap:${n(16)}; position:relative; z-index:2; }
.ev-info li { display:flex; align-items:center; gap:${n(18)}; font-size:${n(40)}; font-weight:700; } .ev-info li span { min-width:0; }
.ticket { margin-top:auto; position:relative; z-index:3; display:flex; align-items:stretch; background:${dark ? '#FFFFFF' : '#111114'}; color:${dark ? '#111' : '#fff'}; border-radius:${n(30)}; overflow:hidden; box-shadow:${shadow}; }
.t-l { flex:0 1 auto; max-width:44%; display:flex; flex-direction:column; justify-content:center; padding:${n(26)} ${n(40)}; border-right:${n(4)} dashed ${dark ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.25)'}; position:relative; }
.t-l .lbl { font-weight:800; font-size:${n(24)}; letter-spacing:.16em; text-transform:uppercase; opacity:.6; } .t-l b { font-family:${display}; font-weight:800; font-size:${n(56)}; line-height:1.05; color:${dark ? AL : AD}; }
.t-r { flex:1; display:flex; flex-direction:column; justify-content:center; gap:${n(14)}; padding:${n(26)} ${n(36)}; min-width:0; } .t-r .cta { align-self:flex-start; max-width:100%; font-size:${n(34)}; padding:${n(20)} ${n(32)}; } .t-r .cta span { overflow:hidden; text-overflow:ellipsis; }
/* menu */
.mn-head { display:flex; flex-direction:column; align-items:center; gap:${n(18)}; text-align:center; } .mn-head h1 { font-size:${n(tall ? 150 : 124)}; max-height:${n(tall ? 330 : 260)}; text-align:center; } .mn-head .sub { text-align:center; }
.orn { width:${n(220)}; height:${n(4)}; background:linear-gradient(90deg, transparent, ${ACC}, transparent); }
.mn-body { flex:1; min-height:0; display:flex; gap:${n(40)}; align-items:center; } .mn-body.with-ph .mn { flex:1.4; }
.mn { list-style:none; display:flex; flex-direction:column; gap:${n(tall ? 30 : 22)}; flex:1; min-width:0; }
.mn li { display:flex; align-items:baseline; gap:${n(16)}; font-size:${n(tall ? 46 : 40)}; }
.mn b { font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:70%; } .mn i { flex:1; border-bottom:${n(4)} dotted ${dark ? 'rgba(255,255,255,.35)' : 'rgba(17,17,20,.3)'}; transform:translateY(-${n(8)}); }
.mn em { font-style:normal; font-family:${display}; font-weight:${look.dw || 800}; color:${ACC}; white-space:nowrap; }
.tall .mn-body.with-ph { flex-direction:column; justify-content:center; } .tall .mn-body.with-ph .mn { flex:none; width:100%; } .tall .mn-ph { flex:none; width:${n(460)}; }
.mn-ph { flex:1; aspect-ratio:1; border-radius:50%; overflow:hidden; border:${n(12)} solid ${surface}; box-shadow:${shadow}; }
/* photo */
.pf.photo { color:#fff; } .bleed { position:absolute; inset:0; background:${mix(A, '#000', 0.4)}; } .scrim { position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 40%, rgba(0,0,0,.82) 78%, rgba(0,0,0,.92) 100%); }
.ph-top { display:flex; align-items:center; position:relative; z-index:2; } .photo .bn { color:#fff; text-shadow:0 ${n(2)} ${n(12)} rgba(0,0,0,.4); }
.ph-copy { margin-top:auto; display:flex; flex-direction:column; gap:${n(22)}; position:relative; z-index:2; } .ph-copy h1 { color:#fff; font-size:${n(tall ? 160 : 128)}; max-height:${n(tall ? 520 : 360)}; } .photo .sub { color:rgba(255,255,255,.85); }
.foot.onphoto { margin-top:${n(10)}; } .onphoto .contacts svg { color:#fff; }
/* diagonal */
.dg-top { position:absolute; left:0; right:0; top:0; height:${tall ? 54 : 50}%; clip-path:polygon(0 0, 100% 0, 100% 78%, 0 100%); background:${A}; }
.dg-art { width:100%; height:100%; display:grid; place-items:center; background:radial-gradient(circle at 50% 45%, ${mix(A, '#fff', 0.25)}, ${A} 55%, ${mix(A, '#000', 0.3)}); }
.dg-top-row { position:relative; z-index:2; } .diag .dg-top-row .bn { color:#fff; text-shadow:0 ${n(2)} ${n(12)} rgba(0,0,0,.35); }
.seal { position:absolute; z-index:4; right:${n(70)}; top:calc(${tall ? 54 : 50}% - ${n(190)}); width:${n(230)}; height:${n(230)}; border-radius:50%; background:${A2}; color:${onA2}; display:grid; place-items:center; text-align:center; transform:rotate(-12deg); box-shadow:${shadow}; font-family:${display}; font-weight:800; font-size:${n(48)}; line-height:1; padding:${n(24)}; }
.seal::before { content:''; position:absolute; inset:${n(12)}; border-radius:50%; border:${n(3)} dashed ${onA2 === '#FFFFFF' ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.3)'}; }
.dg-copy { margin-top:${tall ? Math.round(H * 0.4) : Math.round(H * 0.36)}px; display:flex; flex-direction:column; gap:${n(22)}; position:relative; z-index:2; min-height:0; overflow:hidden; } .dg-copy h1 { font-size:${n(tall ? 140 : 112)}; max-height:${n(tall ? 330 : 240)}; }
/* collage */
.cl-head { display:flex; flex-direction:column; gap:${n(16)}; } .cl-head h1 { font-size:${n(tall ? 140 : 112)}; max-height:${n(tall ? 330 : 230)}; }
.pola { flex:1; min-height:0; display:grid; gap:${n(26)}; grid-template-columns:1fr 1fr; align-content:center; }
.pola.n1 { grid-template-columns:1fr; } .pola.n3 figure:first-child { grid-column:span 2; } .pola.n3, .pola.n4 { grid-template-rows:repeat(2, minmax(0, 1fr)); align-content:stretch; } .pola.n2 { grid-template-rows:minmax(0, 1fr); }
.pola figure { background:#fff; padding:${n(18)} ${n(18)} ${n(56)}; box-shadow:${shadow}; transform:rotate(var(--r)); position:relative; min-height:0; display:flex; flex-direction:column; }
.pola figure img { flex:1; min-height:0; height:auto; }
.pola figcaption { position:absolute; left:0; right:0; bottom:${n(10)}; text-align:center; color:#222; font-weight:700; font-size:${n(28)}; }
.tape { position:absolute; left:50%; top:${n(-18)}; width:${n(150)}; height:${n(44)}; margin-left:${n(-75)}; background:${rgba(A2, 0.75)}; transform:rotate(-4deg); }
/* services */
.sv-head { display:flex; flex-direction:column; gap:${n(16)}; } .sv-head h1 { font-size:${n(tall ? 140 : 112)}; max-height:${n(tall ? 330 : 230)}; }
.tiles { flex:1; min-height:0; display:grid; gap:${n(22)}; grid-template-columns:1fr 1fr; align-content:center; } .tiles.n3 .tile:first-child, .tiles.n5 .tile:first-child { grid-column:span 2; }
.tile { display:flex; flex-direction:column; gap:${n(14)}; padding:${n(30)}; border-radius:${n(36)}; background:${surface}; border:${n(2)} solid ${line}; box-shadow:${shadow}; }
.tile i { display:grid; place-items:center; width:${n(96)}; height:${n(96)}; border-radius:28%; background:linear-gradient(155deg, ${mix(A, '#fff', 0.15)}, ${A}); box-shadow:0 ${n(12)} ${n(26)} ${rgba(A, 0.35)}; }
.tile b { font-size:${n(38)}; font-weight:800; line-height:1.15; } .tile em { font-style:normal; font-family:${display}; font-weight:${look.dw || 800}; color:${ACC}; font-size:${n(40)}; }
/* wide (16:9) */
.wide .mn-body.with-ph .mn-ph { flex:none; width:auto; height:min(100%, ${n(560)}); }
.wide .mn-body { justify-content:center; } .wide .mn { max-width:${n(900)}; }
.wide .event .ev-photo { position:absolute; right:${n(68)}; top:${n(70)}; bottom:${n(64)}; width:36%; flex:none; min-height:0; }
.wide .event:not(.nophoto) > :not(.ev-photo) { max-width:58%; }
.wide .event .ev-info { gap:${n(8)}; } .wide .event .ev-info li { font-size:${n(32)}; } .wide .event .ev-t h1 { font-size:${n(100)}; } .wide .event { gap:${n(20)}; }
.wide .tiles { grid-template-columns:none; grid-auto-flow:column; grid-auto-columns:1fr; } .wide .tiles .tile:first-child { grid-column:auto; }
.wide .pola { grid-template-columns:none; grid-template-rows:minmax(0,1fr); grid-auto-flow:column; grid-auto-columns:1fr; } .wide .pola figure:first-child { grid-column:auto; }
.wide .roles { display:grid; grid-template-columns:1fr 1fr; }
/* hiring */
.hr-head { display:flex; flex-direction:column; gap:${n(20)}; } .kicker { font-weight:800; letter-spacing:.16em; text-transform:uppercase; font-size:${n(30)}; color:${ACC}; }
.hr-head h1.giant { font-size:${n(tall ? 250 : 190)}; max-height:${n(tall ? 560 : 420)}; }
.roles { list-style:none; display:flex; flex-direction:column; gap:${n(18)}; } .roles li { display:flex; align-items:center; gap:${n(20)}; font-size:${n(44)}; font-weight:700; padding:${n(20)} ${n(30)}; border-radius:${n(26)}; background:${surface}; border:${n(2)} solid ${line}; }
`;

  const script = `<script>
(function(){
  function fitOne(){ document.querySelectorAll('.fit-one').forEach(function(el){ var p=el.parentElement, s=parseFloat(getComputedStyle(el).fontSize), i=0; while(i++<60 && el.scrollWidth>p.clientWidth && s>20){ s*=0.94; el.style.fontSize=s+'px'; } }); }
  function longest(el){ var m=0; var probe=document.createElement('span'); probe.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;font:inherit;letter-spacing:inherit;text-transform:inherit'; el.appendChild(probe);
    el.textContent.split(/\\s+/).forEach(function(w){ probe.textContent=w; m=Math.max(m, probe.getBoundingClientRect().width); }); probe.remove(); return m; }
  function fit(){ document.querySelectorAll('h1.fit').forEach(function(el){ var cs=getComputedStyle(el), s=parseFloat(cs.fontSize), max=parseFloat(cs.maxHeight)||1e9, i=0; el.style.maxHeight='none'; el.style.overflow='visible';
    function over(){ return el.scrollWidth>el.clientWidth+4 || el.getBoundingClientRect().height>max+s*0.1 || longest(el)>el.clientWidth+2; }
    while(i++<60 && over() && s>18){ s*=0.94; el.style.fontSize=s+'px'; } }); }
  function guard(){ var foot=document.querySelector('.foot,.ticket'), pf=document.querySelector('.pf'), H=${H}, j=0;
    var boxes=[].slice.call(document.querySelectorAll('.dg-copy, .mn-body, .tiles, .roles, .ev-info, .cols'));
    function over(){ return (foot && foot.getBoundingClientRect().bottom>H+1) || (pf && pf.scrollHeight>H+2) || boxes.some(function(b){ return b.isConnected && b.clientHeight>0 && b.scrollHeight>b.clientHeight+16; }); }
    var drop=['.feats li:last-child','.cols .col:last-child','.ev-info li:last-child','.mn li:last-child','.tiles .tile:last-child','.roles li:last-child','.contacts span:last-child','.sub'], i=0;
    var h=document.querySelector('h1');
    while(over() && i++<30){ var gone=false; for(var k=0;k<drop.length;k++){ var el=document.querySelector(drop[k]); if(el){ el.remove(); gone=true; break; } } if(!gone) break; }
    while(h && over() && j++<30){ h.style.fontSize=(parseFloat(getComputedStyle(h).fontSize)*0.94)+'px'; } }
  function ready(){ fitOne(); fit(); guard(); window.__timeline = gsap.timeline({ paused:true }); window.__timeline.set({}, {}, 0.1); window.__flyer = true; }
  var imgs=[].slice.call(document.images).map(function(im){ return im.complete ? null : new Promise(function(r){ im.onload=im.onerror=r; }); }).filter(Boolean);
  var fonts = document.fonts && document.fonts.load ? Promise.all(['${look.dw || 800} 80px "${look.display || 'Inter'}"','700 40px "${look.ui || 'Inter'}"','500 40px "${look.ui || 'Inter'}"'].map(function(f){ return document.fonts.load(f,'Aa1₦').catch(function(){}); })) : null;
  Promise.race([Promise.all([fonts, document.fonts ? document.fonts.ready : null].concat(imgs)), new Promise(function(r){ setTimeout(r, 6000); })]).then(ready);
})();
</script>`;

  const decoLayer = L === 'price' ? `<div class="deco"><div class="price-bg"></div>${['confetti', 'sunburst', 'halftone', 'bubbles', 'petals', 'speed', 'golddust'].includes(look.deco) ? decoHtml(look.deco, { W, H, A: '#FFFFFF', A2, dark: true, brand, display, n, seed: hash(brand) }) : decoHtml('sunburst', { W, H, A: '#FFFFFF', A2: '#FFFFFF', dark: true, brand, display, n, seed: 3 })}</div>`
    : L === 'photo' ? '' : `<div class="deco">${decoHtml(look.deco, { W, H, A: dark ? AD : A, A2, dark, brand, display, n, seed: hash(brand) })}</div>`;
  const fontLink = fontsUrl([look.display, look.ui].filter(Boolean));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="adflash" content="width=${W},height=${H},duration=0.1,fps=30,engine=flyer-v2">
<title>${esc(brand)} flyer</title>
${fontLink ? `<link href="${fontLink.replace(/&/g, '&amp;')}" rel="stylesheet">` : ''}
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"></script>
<style>${css}</style>
</head>
<body>
<div id="flyer" class="layout-${L} ${tall ? 'tall' : wide ? 'wide' : 'sq'}">${decoLayer}${body}</div>
<script>window.FLYER_DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};</script>
${script}
</body>
</html>`;
}
