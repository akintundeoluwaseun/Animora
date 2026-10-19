// Flyers: one still, print-ready design from the same answers as a video.
// Gemini writes the copy and picks a layout and the pictures; this file lays it out as a single HTML page
// (same themes, colours and fonts as the videos). The page exposes an empty, paused GSAP timeline so the
// preview, thumbnails and downloads treat it like a one-frame video.
import { THEMES } from './themes.js';
import { CANVAS } from '../engine/renderer.js';
import { geminiGenerate } from '../engine/gemini.js';

export const FLYER_LAYOUTS = ['hero', 'grid', 'split', 'type'];
const PHONE_RE = /(\+?234[\s-]?|0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}/;
const str = (v, max = 120) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, max));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
function luminance(hex) {
  const n = parseInt(String(hex || '#000000').slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const photosOf = (assets) => (assets || []).filter((a) => (a.kind || 'image') === 'image' && a.role !== 'logo');
const logoOf = (assets) => (assets || []).find((a) => (a.kind || 'image') === 'image' && a.role === 'logo') || null;

// ---------------------------------------------------------------------------
// The words (Gemini, or straight from the answers)
// ---------------------------------------------------------------------------
function rulesCopy(brief, assets, avoid) {
  const photos = photosOf(assets);
  const products = (brief.products || []).map((p) => { const m = String(p).match(/^(.*?)[\s:–-]*((?:₦|N|NGN|\$)\s?[\d,.]+k?)\s*$/i); return m ? { title: str(m[1], 40), price: m[2] } : { title: str(p, 40) }; });
  const items = (products.length ? products : (brief.features || []).map((f) => ({ title: str(f, 40) }))).slice(0, 4)
    .map((it, i) => ({ ...it, img: photos[i]?.name }));
  const layout = FLYER_LAYOUTS.filter((l) => l !== avoid).find((l) => (l === 'grid' ? photos.length >= 3 : l === 'hero' ? photos.length >= 1 : l === 'split' ? photos.length >= 2 : true)) || 'type';
  return {
    layout, headline: str(brief.headline || brief.name, 60), highlight: '', subhead: str(brief.headlines?.[1] || '', 90),
    badge: /sale|offer|discount|%|off/i.test(brief.goal || '') ? 'Special offer' : '',
    items, features: (brief.features || []).slice(0, 4).map((f) => str(f, 34)), cta: str(brief.cta || 'Order now', 30),
    contact: str(brief.contact, 120), heroImg: photos[0]?.name || null,
  };
}

export async function flyerCopy({ brief = {}, assets = [], style = null, avoid = null, useAI = true }) {
  const base = rulesCopy(brief, assets, avoid);
  if (!useAI) return base;
  const photos = photosOf(assets);
  const user = `BUSINESS: ${brief.name || ''} (${brief.category || ''})
GOAL: ${brief.goal || ''}
MESSAGES: ${JSON.stringify(brief.headlines || [brief.headline].filter(Boolean))}
STRENGTHS: ${JSON.stringify(brief.features || [])}
PRODUCTS / PRICES: ${JSON.stringify(brief.products || [])}
WHAT PEOPLE SHOULD DO: ${JSON.stringify(brief.ctas || [brief.cta].filter(Boolean))}
CONTACT: ${brief.contact || ''}
STYLE: ${style?.name || ''}
PICTURES (use the NAME exactly; a picture's words must match what it SHOWS):
${photos.length ? photos.map((a) => `- "${a.name}"${a.description ? ` SHOWS: ${a.description}` : ''}`).join('\n') : '- none'}
${brief.extra || brief.pasteText ? `SPECIAL INSTRUCTIONS (follow them): ${str([brief.extra, brief.pasteText].filter(Boolean).join(' | '), 3000)}\n` : ''}${avoid ? `The last version used the "${avoid}" layout. Use a different one.\n` : ''}
Write the flyer now.`;
  try {
    const { text } = await geminiGenerate({
      system: `You are a senior graphic designer writing a one-page promotional flyer for a Nigerian business.
Return JSON only:
{ "layout": "hero" | "grid" | "split" | "type",   // hero = one big photo; grid = 3-4 product photos with names/prices; split = text panel + 2-3 photos; type = big typography, few or no photos
  "headline": "max 6 words, punchy",  "highlight": "one word from the headline to colour",
  "subhead": "max 14 words",  "badge": "optional 1-3 word sticker like '20% OFF' or 'NEW' (empty if none)",
  "items": [ { "title": "max 4 words", "price": "optional, exactly as given", "img": "optional picture NAME" } ],   // 0-4 products or services
  "features": [ "max 4 words each" ],   // 0-4 short selling points
  "heroImg": "picture NAME for the main photo, or null",
  "cta": "max 4 words", "contact": "phone / WhatsApp / website / address, exactly as given" }
Rules: never invent prices, phone numbers or addresses. Only use picture NAMES from the list, and only where the words match what the picture shows.
Short words beat long sentences. Pick the layout that suits the pictures you have.`,
      messages: [{ role: 'user', text: user }],
      temperature: 0.85, maxOutputTokens: 4096, json: true, timeoutMs: 60000, thinking: 'low',
    });
    const o = JSON.parse(String(text).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''));
    const names = new Set(photos.map((a) => a.name));
    const pick = (n) => (n && names.has(n) ? n : null);
    return {
      layout: FLYER_LAYOUTS.includes(o.layout) && o.layout !== avoid ? o.layout : base.layout,
      headline: str(o.headline, 60) || base.headline, highlight: str(o.highlight, 30), subhead: str(o.subhead, 110), badge: str(o.badge, 18),
      items: (Array.isArray(o.items) ? o.items : []).slice(0, 4).map((it) => ({ title: str(it?.title, 40), price: str(it?.price, 20), img: pick(it?.img) })).filter((it) => it.title),
      features: (Array.isArray(o.features) ? o.features : []).slice(0, 4).map((f) => str(f, 34)).filter(Boolean),
      heroImg: pick(o.heroImg) || base.heroImg, cta: str(o.cta, 30) || base.cta, contact: str(o.contact, 120) || base.contact,
    };
  } catch (e) {
    console.warn('[flyer] AI copy failed:', e.message);
    return base;
  }
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------
const ICON = {
  phone: '<path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/>',
  chat: '<path d="M4 5h16v10H9l-5 4Z"/>',
  pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  check: '<path d="M5 12.5 10 17 19 7"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1"/>',
};
const svg = (k, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ICON.check}</svg>`;

function contactLines(contact) {
  return String(contact || '').split(/\s*(?:·|\||;|\n|,\s(?=\d|www|http|@))\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 3).map((s) => ({
    text: s,
    icon: PHONE_RE.test(s) || /^\+?\d[\d\s-]{6,}$/.test(s) ? (/whatsapp/i.test(s) ? 'chat' : 'phone') : /www|http|\.com|\.ng|\.app/i.test(s) ? 'globe' : /^@|instagram|ig:/i.test(s) ? 'at' : 'pin',
  }));
}

function headlineHtml(text, highlight) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const key = String(highlight || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  let done = false;
  return words.map((w) => {
    const bare = w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (!done && key && bare === key) { done = true; return `<em>${esc(w)}</em>`; }
    return esc(w);
  }).join(' ');
}

export function flyerHtml(data) {
  const { W, H, theme: themeKey, colors: c, brand, logo, layout } = data;
  const theme = THEMES[themeKey] || THEMES.bold;
  const U = Math.min(W, H) / 1080;
  const n = (v) => `${Math.round(v * U)}px`;
  const lightBg = luminance(c.background) > 0.45;
  const onP = luminance(c.primary) > 0.5 ? '#111111' : '#FFFFFF';
  const onS = luminance(c.secondary) > 0.5 ? '#111111' : '#FFFFFF';
  const subStack = theme.subStack || theme.stack;
  const url = (name) => (data.images || {})[name] || null;
  const hero = url(data.heroImg) || Object.values(data.images || {})[0] || null;
  const items = (data.items || []).map((it) => ({ ...it, src: url(it.img) }));
  const contacts = contactLines(data.contact);
  const tall = H / W > 1.15;

  const logoHtml = logo
    ? `<div class="logo ${logo.transparent ? 'clear' : 'boxed'}" style="aspect-ratio:${logo.transparent ? 'auto' : Math.max(1, Math.min(2, logo.ratio || 1))}"><img src="${esc(logo.url)}" crossorigin="anonymous" alt=""></div>`
    : `<div class="wordmark">${esc(brand)}</div>`;
  const head = `<header class="top">${logoHtml}${logo ? `<span class="brand">${esc(brand)}</span>` : ''}</header>`;
  const h1 = `<h1 class="fit">${headlineHtml(data.headline, data.highlight)}</h1>`;
  const sub = data.subhead ? `<p class="sub">${esc(data.subhead)}</p>` : '';
  const badge = data.badge ? `<div class="badge"><span>${esc(data.badge)}</span></div>` : '';
  const feats = (data.features || []).length ? `<ul class="feats">${data.features.map((f) => `<li>${svg('check')}<span>${esc(f)}</span></li>`).join('')}</ul>` : '';
  const foot = `<footer class="foot"><div class="cta">${esc(data.cta || 'Order now')}</div><div class="contacts">${contacts.map((x) => `<span>${svg(x.icon)}${esc(x.text)}</span>`).join('')}</div></footer>`;
  const card = (it) => `<figure class="card">${it.src ? `<div class="ph"><img src="${esc(it.src)}" crossorigin="anonymous" alt=""></div>` : `<div class="ph none">${svg('check', 'ic big')}</div>`}<figcaption><b>${esc(it.title)}</b>${it.price ? `<i>${esc(it.price)}</i>` : ''}</figcaption></figure>`;
  const priceTags = items.filter((it) => it.price && !it.src).length ? `<div class="tags">${items.filter((it) => it.price).slice(0, 3).map((it) => `<span><b>${esc(it.title)}</b>${esc(it.price)}</span>`).join('')}</div>` : '';

  let body;
  if (layout === 'grid') {
    const g = items.length ? items : [{ title: brand, src: hero }];
    body = `${head}<section class="intro">${h1}${sub}</section>${badge}<section class="grid n${Math.min(4, g.length)}">${g.slice(0, 4).map(card).join('')}</section>${foot}`;
  } else if (layout === 'split') {
    const pics = [hero, ...items.map((i) => i.src)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
    body = `<section class="panel">${head}${h1}${sub}${feats}${priceTags}</section><section class="strip n${pics.length || 1}">${pics.map((p) => `<div class="ph"><img src="${esc(p)}" crossorigin="anonymous" alt=""></div>`).join('') || '<div class="ph none"></div>'}</section>${badge}${foot}`;
  } else if (layout === 'type') {
    body = `${head}<section class="giant">${h1}${sub}</section>${hero ? `<div class="orb"><img src="${esc(hero)}" crossorigin="anonymous" alt=""></div>` : ''}${badge}<section class="mid">${feats}${priceTags}</section>${foot}`;
  } else {   // hero
    body = `<section class="photo">${hero ? `<img src="${esc(hero)}" crossorigin="anonymous" alt="">` : ''}<div class="shade"></div>${head}</section>${badge}<section class="copy">${h1}${sub}${feats}${priceTags}</section>${foot}`;
  }

  const css = `
:root { --primary:${c.primary}; --secondary:${c.secondary}; --bg:${c.background}; --text:${c.text}; --on-p:${onP}; --on-s:${onS};
  --muted: color-mix(in srgb, var(--text) 64%, var(--bg)); --surface:${lightBg ? '#FFFFFF' : 'rgba(255,255,255,.07)'}; --line:${lightBg ? 'rgba(15,15,40,.1)' : 'rgba(255,255,255,.14)'};
  --shadow:${lightBg ? `0 ${n(24)} ${n(60)} ${n(-18)} rgba(20,20,60,.28)` : `0 ${n(30)} ${n(80)} ${n(-20)} rgba(0,0,0,.7)`}; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width:${W}px; height:${H}px; overflow:hidden; background:var(--bg); }
#flyer { position:relative; width:${W}px; height:${H}px; overflow:hidden; color:var(--text); font-family:${theme.stack}; display:flex; flex-direction:column;
  padding:${n(64)}; gap:${n(30)};
  background: radial-gradient(${n(900)} ${n(700)} at 88% 8%, color-mix(in srgb, var(--primary) 30%, transparent), transparent 70%),
    radial-gradient(${n(800)} ${n(800)} at 0% 100%, color-mix(in srgb, var(--secondary) 24%, transparent), transparent 70%), var(--bg); }
img { display:block; width:100%; height:100%; object-fit:cover; }
.ic { width:1em; height:1em; flex:none; } .ic.big { width:${n(90)}; height:${n(90)}; opacity:.5; }
.top { display:flex; align-items:center; gap:${n(22)}; position:relative; z-index:3; }
.logo { height:${n(110)}; border-radius:${n(26)}; overflow:hidden; flex:none; }
.logo.boxed { background:#fff; box-shadow:var(--shadow); } .logo.clear img { object-fit:contain; width:auto; max-width:${n(320)}; }
.logo.boxed img { object-fit:cover; }
.brand, .wordmark { font-family:${subStack}; font-weight:700; font-size:${n(40)}; letter-spacing:-0.01em; }
.wordmark { font-family:${theme.stack}; font-weight:${theme.headWeight}; font-size:${n(56)}; color:var(--primary); }
h1 { font-weight:${theme.headWeight}; line-height:1; letter-spacing:${theme.tracking ? `${theme.tracking * 0.6}px` : '-0.02em'}; font-size:${n(tall ? 150 : 120)}; ${theme.upper ? 'text-transform:uppercase;' : ''} ${theme.italic ? 'font-style:italic;' : ''} overflow:hidden; }
h1 em { font-style:inherit; color:var(--primary); }
.sub { font-family:${subStack}; font-weight:500; font-size:${n(42)}; line-height:1.25; color:var(--muted); max-width:22em; }
.feats { list-style:none; display:flex; flex-wrap:wrap; gap:${n(14)}; }
.feats li { display:flex; align-items:center; gap:${n(12)}; font-family:${subStack}; font-weight:600; font-size:${n(34)}; padding:${n(14)} ${n(26)}; border-radius:999px; background:var(--surface); border:${n(2)} solid var(--line); }
.feats .ic { color:var(--primary); width:${n(32)}; height:${n(32)}; }
.tags { display:flex; flex-wrap:wrap; gap:${n(16)}; }
.tags span { display:flex; flex-direction:column; font-family:${subStack}; font-size:${n(44)}; font-weight:800; color:var(--primary); padding:${n(16)} ${n(26)}; border-radius:${n(22)}; background:var(--surface); border:${n(2)} solid var(--line); }
.tags b { font-size:${n(26)}; font-weight:600; color:var(--muted); }
.badge { position:absolute; z-index:5; right:${n(54)}; top:${n(tall ? 560 : 420)}; width:${n(230)}; height:${n(230)}; border-radius:50%; background:var(--secondary); color:var(--on-s);
  display:grid; place-items:center; text-align:center; transform:rotate(-12deg); box-shadow:var(--shadow); font-weight:${theme.headWeight}; font-size:${n(44)}; line-height:1; padding:${n(26)}; }
.badge::before { content:''; position:absolute; inset:${n(12)}; border-radius:50%; border:${n(3)} dashed color-mix(in srgb, var(--on-s) 45%, transparent); }
.foot { margin-top:auto; display:flex; align-items:center; gap:${n(26)}; flex-wrap:wrap; position:relative; z-index:3; }
.cta { background:var(--primary); color:var(--on-p); font-weight:800; font-family:${subStack}; font-size:${n(44)}; padding:${n(26)} ${n(48)}; border-radius:999px; box-shadow:0 ${n(20)} ${n(50)} ${n(-14)} color-mix(in srgb, var(--primary) 70%, transparent); white-space:nowrap; }
.contacts { display:flex; flex-direction:column; gap:${n(8)}; font-family:${subStack}; font-weight:700; font-size:${n(36)}; min-width:0; }
.contacts span { display:flex; align-items:center; gap:${n(12)}; } .contacts .ic { color:var(--primary); width:${n(36)}; height:${n(36)}; }
.ph { border-radius:${n(36)}; overflow:hidden; background:var(--surface); box-shadow:var(--shadow); }
.ph.none { display:grid; place-items:center; color:var(--primary); }
/* hero */
.photo { position:relative; margin:${n(-64)} ${n(-64)} 0; height:${tall ? '50%' : '46%'}; flex:none; border-radius:0 0 ${n(70)} ${n(70)}; overflow:hidden; background:color-mix(in srgb, var(--primary) 30%, var(--bg)); }
.photo > img { position:absolute; inset:0; } .photo .shade { position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,.45), transparent 35%); }
.photo .top { position:absolute; left:${n(64)}; top:${n(56)}; color:#fff; }
.copy { display:flex; flex-direction:column; gap:${n(24)}; min-height:0; flex:1; overflow:hidden; }
.copy h1 { max-height:${n(tall ? 330 : 250)}; }
/* grid */
.intro { display:flex; flex-direction:column; gap:${n(18)}; } .intro h1 { max-height:${n(tall ? 330 : 230)}; }
.grid { display:grid; gap:${n(26)}; flex:1; min-height:0; grid-template-columns:1fr 1fr; }
.grid.n1 { grid-template-columns:1fr; } .grid.n3 .card:first-child { grid-row:span 2; }
.card { display:flex; flex-direction:column; min-height:0; background:var(--surface); border:${n(2)} solid var(--line); border-radius:${n(36)}; overflow:hidden; box-shadow:var(--shadow); }
.card .ph { flex:1; min-height:0; border-radius:0; box-shadow:none; }
.card figcaption { display:flex; align-items:baseline; justify-content:space-between; gap:${n(14)}; padding:${n(20)} ${n(26)}; font-family:${subStack}; }
.card b { font-size:${n(34)}; font-weight:700; line-height:1.15; } .card i { font-style:normal; font-weight:800; font-size:${n(38)}; color:var(--primary); white-space:nowrap; }
/* split */
.panel { display:flex; flex-direction:column; gap:${n(26)}; margin:${n(-64)} ${n(-64)} 0; padding:${n(64)}; background:var(--primary); color:var(--on-p); border-radius:0 0 ${n(70)} 0; }
.panel h1 em { color:var(--secondary); } .panel .sub { color:color-mix(in srgb, var(--on-p) 78%, transparent); } .panel h1 { max-height:${n(tall ? 330 : 240)}; }
.panel .feats li { background:color-mix(in srgb, var(--on-p) 12%, transparent); border-color:color-mix(in srgb, var(--on-p) 22%, transparent); } .panel .feats .ic { color:var(--on-p); }
.panel .brand, .panel .wordmark { color:var(--on-p); }
.panel .tags span { background:color-mix(in srgb, var(--on-p) 12%, transparent); border-color:transparent; color:var(--on-p); } .panel .tags b { color:color-mix(in srgb, var(--on-p) 70%, transparent); }
.strip { flex:1; min-height:0; display:grid; gap:${n(22)}; grid-template-columns:repeat(var(--k), 1fr); }
.strip.n1 { --k:1; } .strip.n2 { --k:2; } .strip.n3 { --k:3; } .strip.n3 .ph:nth-child(2) { transform:translateY(${n(-40)}); }
/* type */
.giant { display:flex; flex-direction:column; gap:${n(26)}; } .giant .sub { max-width:62%; } .giant h1 { font-size:${n(tall ? 210 : 170)}; max-height:${n(tall ? 720 : 470)}; }
.orb { position:absolute; right:${n(-120)}; top:${n(tall ? 700 : 300)}; width:${n(560)}; height:${n(560)}; border-radius:50%; overflow:hidden; box-shadow:var(--shadow); border:${n(12)} solid var(--surface); z-index:1; }
.mid { display:flex; flex-direction:column; gap:${n(22)}; max-width:${Math.round(W * 0.62)}px; position:relative; z-index:2; }
.giant + .orb + .badge { top:auto; bottom:${n(tall ? 520 : 300)}; }
.layout-hero .badge { top:calc(${tall ? "50%" : "46%"} - ${n(64 + 225)}); right:${n(60)}; }
.layout-grid .badge { top:${n(40)}; right:${n(40)}; width:${n(200)}; height:${n(200)}; font-size:${n(38)}; }
${theme.css ? '' : ''}`;

  const script = `<script>
(function(){
  // shrink the headline until it fits its box (height limit from CSS max-height; width = its column)
  function fit(){ document.querySelectorAll('.fit').forEach(function(el){ var cs=getComputedStyle(el), s=parseFloat(cs.fontSize), max=parseFloat(cs.maxHeight)||1e9, i=0;
    el.style.maxHeight='none'; el.style.overflow='visible';
    function over(){ var r=el.scrollWidth>el.clientWidth+4; var words=el.querySelectorAll('em'); return r || el.getBoundingClientRect().height>max+s*0.1 || longestWord(el)>el.clientWidth+2; }
    while(i++<60 && over() && s>20){ s*=0.94; el.style.fontSize=s+'px'; } }); }
  function longestWord(el){ var m=0, r=document.createRange(); var t=el.textContent.split(/\s+/); var probe=document.createElement('span'); probe.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;font:inherit;letter-spacing:inherit;text-transform:inherit'; el.appendChild(probe);
    t.forEach(function(w){ probe.textContent=w; m=Math.max(m, probe.getBoundingClientRect().width); }); probe.remove(); return m; }
  // too much to fit? drop the least important bits first (last selling points, extra prices, the subline), then shrink the headline
  function guard(){
    var boxes=[].slice.call(document.querySelectorAll('.copy,.intro,.panel,.mid,.giant'));
    var foot=document.querySelector('.foot'), H=${H}, pad=${Math.round(64 * U)};
    function over(){ return boxes.some(function(b){ return b.scrollHeight>b.clientHeight+4; }) || (foot && foot.getBoundingClientRect().bottom>H-pad*0.5); }
    var h=document.querySelector('h1'), s0=h?parseFloat(getComputedStyle(h).fontSize):0, j=0;
    function shrink(min){ while(h && over() && j++<40 && parseFloat(h.style.fontSize||s0)>min){ h.style.fontSize=(parseFloat(getComputedStyle(h).fontSize)*0.94)+'px'; } }
    shrink(s0*0.72);
    var drop=['.feats li:last-child','.tags span:last-child','.sub'], i=0;
    while(over() && i++<20){ var gone=false; for(var k=0;k<drop.length;k++){ var el=document.querySelector(drop[k]); if(el){ el.remove(); gone=true; break; } } if(!gone) break; }
    shrink(12);
  }
  function ready(){ fit(); guard(); window.__timeline = gsap.timeline({ paused:true }); window.__timeline.set({}, {}, 0.1); window.__flyer = true; }
  var imgs=[].slice.call(document.images).map(function(im){ return im.complete ? null : new Promise(function(r){ im.onload=im.onerror=r; }); }).filter(Boolean);
  Promise.race([Promise.all([document.fonts ? document.fonts.ready : null].concat(imgs)), new Promise(function(r){ setTimeout(r, 6000); })]).then(ready);
})();
</script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="adflash" content="width=${W},height=${H},duration=0.1,fps=30,engine=flyer-v1">
<title>${esc(brand)} flyer</title>
<link href="https://fonts.googleapis.com/css2?family=${theme.fontParam}&display=block" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"></script>
<style>${css}</style>
</head>
<body>
<div id="flyer" class="layout-${layout}">${body}</div>
<script>window.FLYER_DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};</script>
${script}
</body>
</html>`;
}

/** Answers + pictures -> flyer HTML. */
export async function makeFlyer({ brief, plan, style, assets, previous = null, useAI = true }) {
  const themeKey = style?.palette?.theme || 'bold';
  const theme = THEMES[themeKey] || THEMES.bold;
  const { width: W, height: H } = CANVAS[plan?.aspect_ratio] || CANVAS['4:5'];
  const colors = { ...theme.colors, ...(plan?.style?.colors || {}) };
  const avoid = previous ? readFlyer(previous)?.layout : null;
  const copy = await flyerCopy({ brief, assets, style, avoid, useAI });
  const logo = logoOf(assets);
  const data = {
    W, H, theme: themeKey, colors, brand: brief?.name || plan?.business?.name || 'Your business', ...copy,
    logo: logo ? { url: logo.url, transparent: !!(logo.has_alpha ?? logo.transparent), light: logo.is_light ?? logo.light ?? null, ratio: logo.width && logo.height ? logo.width / logo.height : null } : null,
    images: Object.fromEntries(photosOf(assets).map((a) => [a.name, a.url])),
  };
  return flyerHtml(data);
}

export const readFlyer = (html) => {
  const m = String(html || '').match(/window\.FLYER_DATA = (.*);<\/script>/);
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
};
export const isFlyer = (html) => /engine=flyer-/.test(String(html || ''));

/** Plain-words change to a flyer: Gemini rewrites the flyer's fields. */
export async function editFlyer({ html, instruction, assets = [] }) {
  const data = readFlyer(html);
  if (!data) throw new Error('Not a flyer');
  const photos = photosOf(assets);
  const { images, logo, W, H, theme, brand, ...fields } = data;
  const { text } = await geminiGenerate({
    system: `You edit a one-page flyer. You get its fields as JSON and the owner's change request.
Return JSON with the FULL updated fields: { "layout": "hero"|"grid"|"split"|"type", "headline", "highlight", "subhead", "badge", "items": [{ "title", "price"?, "img"? }], "features": [], "heroImg", "cta", "contact",
"colors"?: { "primary"?, "secondary"?, "background"?, "text"? } (hex), "summary": "one short sentence of what you changed" }.
Change only what was asked. Picture NAMES must come from the list, and a picture's words must match what it shows. Never invent prices or phone numbers.`,
    messages: [{ role: 'user', text: `FLYER:\n${JSON.stringify(fields)}\n\nPICTURES:\n${photos.map((a) => `- "${a.name}"${a.description ? ` SHOWS: ${a.description}` : ''}`).join('\n') || '- none'}\n\nCHANGE REQUEST: ${instruction}` }],
    temperature: 0.4, maxOutputTokens: 4096, json: true, timeoutMs: 60000, thinking: 'low',
  });
  const o = JSON.parse(String(text).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''));
  const names = new Set(photos.map((a) => a.name));
  const pick = (v) => (v && names.has(v) ? v : null);
  const HEX = /^#[0-9a-f]{6}$/i;
  const colors = { ...fields.colors };
  for (const k of ['primary', 'secondary', 'background', 'text']) if (HEX.test(o.colors?.[k] || '')) colors[k] = o.colors[k];
  const next = {
    ...data, colors,
    layout: FLYER_LAYOUTS.includes(o.layout) ? o.layout : data.layout,
    headline: str(o.headline, 60) || data.headline, highlight: str(o.highlight, 30), subhead: str(o.subhead, 110), badge: str(o.badge, 18),
    items: Array.isArray(o.items) ? o.items.slice(0, 4).map((it) => ({ title: str(it?.title, 40), price: str(it?.price, 20), img: pick(it?.img) })).filter((it) => it.title) : data.items,
    features: Array.isArray(o.features) ? o.features.slice(0, 4).map((f) => str(f, 34)).filter(Boolean) : data.features,
    heroImg: pick(o.heroImg) || data.heroImg, cta: str(o.cta, 30) || data.cta, contact: str(o.contact, 120) || data.contact,
    images: Object.fromEntries(photos.map((a) => [a.name, a.url])),
  };
  return { html: flyerHtml(next), summary: str(o.summary, 200) || 'Done! Check the flyer.' };
}

/** Simple flyer changes without the AI (when Gemini is resting): new layout, darker / lighter, a colour, a shorter headline. */
const FLYER_COLORS = { red: '#D7263D', green: '#1F8A4C', blue: '#1F6FEB', yellow: '#FFC93C', gold: '#C9A227', orange: '#E8530E', purple: '#7B2CBF', pink: '#E83E8C', teal: '#0FA3A3', black: '#0B0B0B', white: '#FFFFFF', navy: '#0B2E6B', brown: '#7A4A21' };
const shade = (hex, f) => { const n = parseInt(String(hex || '#777777').slice(1), 16); const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join(''); };
export function offlineFlyerEdit({ html, instruction, assets = [] }) {
  const data = readFlyer(html);
  if (!data) return null;
  const say = String(instruction || '').toLowerCase(), done = [], next = { ...data, colors: { ...data.colors } };
  const photos = photosOf(assets).length || Object.keys(data.images || {}).length;
  if (/layout|design|different|arrange|style|another|new look/.test(say)) {
    const ok = FLYER_LAYOUTS.filter((l) => l !== data.layout && (l === 'grid' ? photos >= 3 : l === 'hero' ? photos >= 1 : l === 'split' ? photos >= 2 : true));
    if (ok.length) { next.layout = ok[0]; done.push(`a new ${ok[0] === 'type' ? 'typography' : ok[0]} layout`); }
    else { const c = next.colors; [c.primary, c.secondary] = [c.secondary || c.primary, c.primary]; done.push('a fresh colour arrangement (add photos for more layouts)'); }
  }
  if (/dark/.test(say)) { next.colors.background = shade(next.colors.background, 0.35); if (/text/.test(say) === false) next.colors.text = '#FFFFFF'; done.push('darker colours'); }
  else if (/light|bright/.test(say)) { next.colors.background = shade(next.colors.background, 1.8); next.colors.text = '#111111'; done.push('lighter colours'); }
  const word = Object.keys(FLYER_COLORS).find((w) => new RegExp(`\\b${w}\\b`).test(say));
  if (word && !/dark|light/.test(say)) { const k = /background|bg/.test(say) ? 'background' : 'primary'; next.colors[k] = FLYER_COLORS[word]; done.push(`${word} ${k === 'background' ? 'background' : 'accent'}`); }
  if (/short|fewer words|less text/.test(say) && /headline|title|text|words/.test(say)) { const w = String(next.headline || '').split(/\s+/); if (w.length > 3) { next.headline = w.slice(0, 3).join(' '); done.push('a shorter headline'); } }
  if (!done.length) return null;
  return { html: flyerHtml(next), summary: `Done: ${done.join(', ')}.` };
}
