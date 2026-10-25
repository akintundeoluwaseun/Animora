// Premium template "Organised": a frame-for-frame recreation of the owner's Notion reference
// (dnyxstudios). Fixed design, fixed timing; only the slots change: logo, brand, phone screen, app tiles,
// three cards, the title and the two-word tagline.
//   0.0  phone turns in on a soft studio white
//   3.4  app tiles pop out around it, float, fly back in (7.0)
//  10.3  the phone whips out right (motion blur)
//  11.0  pastel cards slide in one by one and stack, the camera drifts along the stack
//  15.8  the title arrives above the stack (second word lighter)
//  18.6  the stack smears out sideways
//  19.2  logo alone; "Word." then "Word." slide in beside it; slow pull back; hold to the end
import { GSAP_CDN } from '../../engine/prompts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
// pastel card families from the reference: background, title ink, icon tile
const CARD = [
  { bg: '#F8D3D8', ink: '#B4233F', tile: '#C42B47' },
  { bg: '#D3E2FA', ink: '#2D5DB8', tile: '#2F62C9' },
  { bg: '#D4F2D6', ink: '#23863A', tile: '#2E9D44' },
];
const TILE = [['#2B6BDF', '#4C8DF6'], ['#1E8E4B', '#33B169'], ['#5B5FC7', '#7B83EB'], ['#F2994A', '#F7B267'], ['#0EA5A4', '#2DD4BF']];
const GLYPH = {
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 12h6M9.5 15.5h6"/>',
  chart: '<path d="M5 19V9M10 19V5M15 19v-7M20 19v-4"/>',
  chat: '<path d="M4.5 18.5l1.2-3.4A7.5 7.5 0 1 1 8.6 18z"/>',
  cal: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M8 3.5v4M16 3.5v4M4 10.5h16"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  bulb: '<path d="M9 17.5h6M10 20.5h4M12 3.5a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3.5z"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
  star: '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.8 6.9 19.4l1-5.6-4.1-4 5.7-.8z"/>',
};
const glyphFor = (t = '') => (/meet|call|chat|message|support|team|together/i.test(t) ? 'chat' : /plan|schedul|book|date|event|calendar|time/i.test(t) ? 'cal' : /idea|creat|design|content/i.test(t) ? 'bulb' : /report|sale|grow|stat|money|price|analytic/i.test(t) ? 'chart' : /task|todo|check|done|organis|organiz/i.test(t) ? 'check' : /list|menu|order/i.test(t) ? 'list' : /doc|note|write|invoice|file/i.test(t) ? 'doc' : 'star');

/**
 * data: { aspect, brand, logo (url|null), screen (url|null: the phone screen; null = a tidy home screen of tiles),
 *         cards: [{ title, sub }] (3), title: [bold, light] (e.g. ["Work", "together"]), tagline: [w1, w2] (e.g. ["Work.", "Organised."]),
 *         accent (hex, optional), sound ('sfx' | 'none') }
 */
export function organisedHtml(data = {}) {
  const [W, H] = SIZES[data.aspect] || SIZES['16:9'];
  const port = H > W * 1.2, u = Math.min(W, H) / 1080;
  const cards = (data.cards || []).slice(0, 3);
  while (cards.length < 3) cards.push({ title: ['Plan your day', 'Share ideas', 'Get it done'][cards.length], sub: '' });
  const D = { W, H, port, u, brand: data.brand || 'Your brand', logo: data.logo || null, screen: data.screen || null,
    cards: cards.map((c, i) => ({ ...c, glyph: glyphFor(c.title), ...CARD[i] })), title: data.title || ['Work', 'together'],
    tagline: data.tagline || ['Work.', 'Organised.'], sound: data.sound || 'sfx' };
  const tiles = [0, 1, 2, 3, 4].map((i) => ({ g: ['doc', 'chart', 'chat', 'cal', 'check'][i], c: TILE[i] }));
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="adflash" content="width=${W},height=${H},duration=27.5,fps=30,engine=premium-organised-v1">
<title>${esc(D.brand)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#ECECEE;font-family:Inter,-apple-system,"SF Pro Display",system-ui,sans-serif;-webkit-font-smoothing:antialiased;color:#111}
#stage{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;background:#ECECEE}
.bg{position:absolute;border-radius:50%;filter:blur(${90 * u}px)}
.abs{position:absolute}
.phone{position:absolute;border-radius:${64 * u}px;background:linear-gradient(145deg,#3a3a3e,#0d0d10 45%,#2a2a2e);padding:${11 * u}px;box-shadow:0 ${50 * u}px ${90 * u}px rgba(0,0,0,.28),0 ${12 * u}px ${24 * u}px rgba(0,0,0,.18),inset 0 0 0 ${2 * u}px #55555b}
.screen{position:relative;width:100%;height:100%;border-radius:${54 * u}px;overflow:hidden;background:#f4f5f8}
.island{position:absolute;left:50%;top:${14 * u}px;width:${96 * u}px;height:${28 * u}px;margin-left:${-48 * u}px;border-radius:${14 * u}px;background:#050506;z-index:3}
.tile{position:absolute;border-radius:24%;display:grid;place-items:center;box-shadow:0 ${18 * u}px ${30 * u}px rgba(0,0,0,.18),inset 0 ${2 * u}px 0 rgba(255,255,255,.35)}
.tile svg{width:56%;height:56%;fill:none;stroke:#fff;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round}
.card{position:absolute;border-radius:${26 * u}px;display:flex;align-items:center;justify-content:space-between;padding:0 ${30 * u}px 0 ${34 * u}px;box-shadow:0 ${20 * u}px ${44 * u}px rgba(0,0,0,.08)}
.card b{display:block;font-weight:500;letter-spacing:-.01em}
.card i{display:block;font-style:normal;font-weight:400;opacity:.55;margin-top:${4 * u}px}
.card .ic{border-radius:${14 * u}px;display:grid;place-items:center;flex:none}
.card .ic svg{width:60%;height:60%;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.ttl{position:absolute;left:0;right:0;text-align:center;font-weight:600;letter-spacing:-.02em;white-space:nowrap}
.ttl span{display:inline-block}
.lock{position:absolute;display:flex;align-items:center;white-space:nowrap}
.lock .lg{flex:none;display:grid;place-items:center}
.lock .lg img{width:100%;height:100%;object-fit:contain}
.lock .w{display:inline-block;font-weight:500;letter-spacing:-.02em}
</style></head>
<body><div id="stage"></div>
<svg width="0" height="0" style="position:absolute"><defs>
<filter id="mbx" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur id="mbxd" stdDeviation="0 0"/></filter>
<filter id="mbc" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur id="mbcd" stdDeviation="0 0"/></filter>
<filter id="mbt" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur id="mbtd" stdDeviation="0 0"/></filter>
</defs></svg>
<script src="${GSAP_CDN}/gsap.min.js"></script>
<script>
window.TPL = ${JSON.stringify({ D, tiles }).replace(/</g, '\\u003c')};
(function () {
  var D = TPL.D, T = TPL.tiles, W = D.W, H = D.H, u = D.u, port = D.port;
  var st = document.getElementById("stage");
  var el = function (cls, css, parent, html) { var e = document.createElement('div'); if (cls) e.className = cls; if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; (parent || st).appendChild(e); return e; };
  var svg = function (g) { return '<svg viewBox="0 0 24 24">' + ({ doc: ${JSON.stringify(GLYPH.doc)}, chart: ${JSON.stringify(GLYPH.chart)}, chat: ${JSON.stringify(GLYPH.chat)}, cal: ${JSON.stringify(GLYPH.cal)}, check: ${JSON.stringify(GLYPH.check)}, bulb: ${JSON.stringify(GLYPH.bulb)}, list: ${JSON.stringify(GLYPH.list)}, star: ${JSON.stringify(GLYPH.star)} })[g] + '</svg>'; };
  var tl = gsap.timeline({ paused: true }); window.__timeline = tl;
  var sfx = window.__sfx = []; var snd = function (t, k, v) { if (D.sound !== 'none') sfx.push({ t: +t.toFixed(3), k: k, v: v == null ? 0.8 : v }); };

  // ---- studio background: soft white light drifting over a pale grey
  var b1 = el('bg', 'width:' + W * 0.9 + 'px;height:' + W * 0.9 + 'px;left:' + (-W * 0.15) + 'px;top:' + (-H * 0.35) + 'px;background:#fff;opacity:.9');
  var b2 = el('bg', 'width:' + W * 0.7 + 'px;height:' + W * 0.7 + 'px;right:' + (-W * 0.2) + 'px;bottom:' + (-H * 0.45) + 'px;background:#fff;opacity:.75');
  tl.fromTo(b1, { x: 0, y: 0 }, { x: W * 0.08, y: H * 0.05, duration: 27.5, ease: 'sine.inOut' }, 0);
  tl.fromTo(b2, { x: 0, y: 0 }, { x: -W * 0.06, y: -H * 0.04, duration: 27.5, ease: 'sine.inOut' }, 0);

  // ================= 1. the phone
  var ph = port ? H * 0.36 : H * 0.62, pw = ph * 0.487;
  var pwrap = el('abs', 'left:' + (W / 2 - pw / 2) + 'px;top:' + (H / 2 - ph / 2) + 'px;width:' + pw + 'px;height:' + ph + 'px;perspective:' + 1600 * u + 'px');
  var phone = el('phone', 'left:0;top:0;width:' + pw + 'px;height:' + ph + 'px;transform-style:preserve-3d', pwrap);
  var scr = el('screen', '', phone); el('island', '', scr);
  if (D.screen) { var im = document.createElement('img'); im.src = D.screen; im.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top'; scr.appendChild(im); }
  else {
    // a tidy home screen: rows of colourful app squares (like the reference)
    var cols = ['#FF5E5B', '#FFB020', '#34C759', '#0A84FF', '#5E5CE6', '#FF375F', '#30B0C7', '#AF52DE', '#FF9F0A', '#64D2FF', '#32D74B', '#FFD60A'];
    scr.style.background = 'radial-gradient(120% 80% at 30% 20%, #3b4f8f 0%, #1d2547 45%, #0b0d1a 100%)';
    var g = el('abs', 'left:8%;right:8%;top:12%;display:grid;grid-template-columns:repeat(4,1fr);gap:' + pw * 0.06 + 'px', scr);
    for (var k = 0; k < 24; k++) el('', 'aspect-ratio:1;border-radius:24%;background:linear-gradient(160deg,' + cols[k % 12] + ',' + cols[(k * 5 + 3) % 12] + ')', g);
    var dock = el('abs', 'left:6%;right:6%;bottom:3%;height:' + pw * 0.24 + 'px;border-radius:' + pw * 0.08 + 'px;background:rgba(255,255,255,.18);display:grid;grid-template-columns:repeat(4,1fr);gap:' + pw * 0.05 + 'px;padding:' + pw * 0.035 + 'px', scr);
    ['#34C759', '#0A84FF', '#FF9F0A', '#FF375F'].forEach(function (c) { el('', 'border-radius:24%;background:' + c, dock); });
  }
  if (D.screen) el('', 'position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,0) 40%,rgba(255,255,255,.18) 50%,rgba(255,255,255,0) 60%);z-index:2', scr);
  // turns in from a three-quarter view, settles, keeps breathing
  tl.fromTo(phone, { rotateY: -48, rotateX: 18, rotateZ: -14, y: H * 0.18, scale: 0.86, opacity: 0 }, { rotateY: -8, rotateX: 6, rotateZ: -6, y: 0, scale: 1, opacity: 1, duration: 2.2, ease: 'expo.out' }, 0.1);
  tl.to(phone, { rotateY: 8, rotateX: 2, rotateZ: 4, duration: 3.4, ease: 'sine.inOut' }, 2.3);
  tl.to(phone, { rotateY: -6, rotateZ: -2, y: -H * 0.01, duration: 3.6, ease: 'sine.inOut' }, 5.7);
  snd(0.15, 'whoosh-low', 0.7);

  // ================= 2. app tiles pop out around the phone, float, then fly back in
  var ts = (port ? W * 0.2 : H * 0.18);
  var spots = port
    ? [[-0.36, -0.2], [-0.4, 0.06], [0.36, -0.24], [0.42, 0.0], [0.3, 0.24]]
    : [[-0.24, -0.3], [-0.27, 0.06], [0.22, -0.3], [0.27, 0.0], [0.2, 0.28]];
  T.forEach(function (t, i) {
    var x = W / 2 + spots[i][0] * (port ? W : H * 1.3) - ts / 2, y = H / 2 + spots[i][1] * (port ? H * 0.55 : H) - ts / 2;
    var tile = el('tile', 'left:' + x + 'px;top:' + y + 'px;width:' + ts + 'px;height:' + ts + 'px;background:linear-gradient(150deg,' + t.c[1] + ',' + t.c[0] + ');filter:url(#mbt)', null, svg(t.g));
    var dx = W / 2 - (x + ts / 2), dy = H / 2 - (y + ts / 2), at = 3.4 + i * 0.12;
    tl.fromTo(tile, { x: dx, y: dy, scale: 0.2, rotate: -20 + i * 9, opacity: 0 }, { x: 0, y: 0, scale: 1, rotate: -8 + i * 4, opacity: 1, duration: 0.9, ease: 'back.out(1.5)' }, at);
    tl.to(tile, { y: -14 * u * (i % 2 ? 1 : -1), rotate: '+=' + (i % 2 ? 4 : -4), duration: 2.4, ease: 'sine.inOut' }, at + 0.9);
    tl.to(tile, { x: dx, y: dy, scale: 0.25, rotate: 0, opacity: 0, duration: 0.6, ease: 'power3.in' }, 6.5 + i * 0.06);
    snd(at, 'pop', 0.55);
  });
  tl.fromTo('#mbtd', { attr: { stdDeviation: '6 6' } }, { attr: { stdDeviation: '0 0' }, duration: 0.5, ease: 'power2.out' }, 3.4);
  tl.to('#mbtd', { attr: { stdDeviation: '5 5' }, duration: 0.5, ease: 'power2.in' }, 6.5);
  snd(6.5, 'swish', 0.6);

  // phone whips out to the right with motion blur
  pwrap.style.filter = 'url(#mbx)';
  tl.to(pwrap, { x: W * 0.75, duration: 0.55, ease: 'power3.in' }, 10.1);
  tl.to('#mbxd', { attr: { stdDeviation: (60 * u) + ' 0' }, duration: 0.5, ease: 'power2.in' }, 10.1);
  snd(10.05, 'whoosh', 0.8);

  // ================= 3. the card stack
  var cw = port ? W * 0.72 : W * 0.3, chh = cw * 0.25, gap = chh * 0.28;
  var stack = el('abs', 'left:' + (W / 2 - cw / 2) + 'px;top:' + (H / 2 - chh / 2) + 'px;width:' + cw + 'px;height:' + (chh * 3 + gap * 2) + 'px;filter:url(#mbc)');
  var cardEls = D.cards.map(function (c, i) {
    var e = el('card', 'left:0;top:' + i * (chh + gap) + 'px;width:' + cw + 'px;height:' + chh + 'px;background:' + c.bg, stack,
      '<div><b style="font-size:' + chh * 0.3 + 'px;color:' + c.ink + '">' + esc(c.title) + '</b>' + (c.sub ? '<i style="font-size:' + chh * 0.15 + 'px;color:' + c.ink + '">' + esc(c.sub) + '</i>' : '') + '</div>' +
      '<div class="ic" style="width:' + chh * 0.56 + 'px;height:' + chh * 0.56 + 'px;background:' + c.tile + '">' + svg(c.glyph) + '</div>');
    return e;
  });
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // the camera follows each new card: the whole stack shifts so the newest card sits in the middle
  tl.set(stack, { y: 0, scale: 1.7 }, 0);
  cardEls.forEach(function (e, i) {
    var at = 11.0 + i * 1.25;
    tl.fromTo(e, { x: i === 0 ? -W * 0.5 : 0, y: i === 0 ? 0 : chh * 0.9, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: i === 0 ? 0.9 : 0.75, ease: 'expo.out' }, at);
    if (i > 0) tl.to(stack, { y: -i * (chh + gap) * 1.7 + (i === 2 ? (chh + gap) * 0.9 : 0) + (i === 1 ? (chh + gap) * 0.45 : 0), duration: 0.9, ease: 'power3.inOut' }, at - 0.05);
    snd(at, i === 0 ? 'whoosh' : 'swish', 0.6);
  });
  tl.fromTo('#mbcd', { attr: { stdDeviation: (40 * u) + ' 0' } }, { attr: { stdDeviation: '0 0' }, duration: 0.7, ease: 'power2.out' }, 11.0);
  // pull back: the whole stack in view, the title above it
  tl.to(stack, { y: -(chh + gap) + chh * 0.55, scale: 1.12, duration: 1.4, ease: 'power3.inOut' }, 14.9);
  var ttl = el('ttl', 'top:' + (H / 2 - (chh + gap) * 1.12 * 1.5 + chh * 0.55 - chh * 0.95) + 'px;font-size:' + chh * 0.5 + 'px', null,
    '<span>' + esc(D.title[0]) + '</span> <span style="font-weight:400;color:#2b2b30">' + esc(D.title[1] || '') + '</span>');
  var tw = ttl.querySelectorAll('span');
  tl.fromTo(tw[0], { opacity: 0, y: 24 * u, filter: 'blur(' + 10 * u + 'px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out' }, 15.8);
  tl.fromTo(tw[1], { opacity: 0, y: 24 * u, x: 20 * u, filter: 'blur(' + 10 * u + 'px)' }, { opacity: 1, y: 0, x: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out' }, 16.1);
  snd(15.8, 'swish', 0.4);
  // everything smears out sideways
  tl.to([stack, ttl], { x: -W * 0.7, duration: 0.6, ease: 'power3.in' }, 18.6);
  tl.to('#mbcd', { attr: { stdDeviation: (80 * u) + ' 0' }, duration: 0.5, ease: 'power2.in' }, 18.6);
  tl.to(ttl, { opacity: 0, duration: 0.4 }, 18.7);
  tl.to(stack, { opacity: 0, duration: 0.25 }, 18.95);
  snd(18.55, 'whoosh', 0.85);

  // ================= 4. the lockup: logo alone, then "Word." and "Word." slide in beside it
  var ls = port ? W * 0.13 : H * 0.12, fz = ls * 0.6;
  var lock = el('lock', 'left:0;top:' + (H / 2 - ls / 2) + 'px;height:' + ls + 'px');
  var lg = el('lg', 'width:' + ls + 'px;height:' + ls + 'px;border-radius:' + ls * 0.22 + 'px;' + (D.logo ? '' : 'background:#111;color:#fff;font-weight:700;font-size:' + ls * 0.5 + 'px'), lock, D.logo ? '<img src="' + D.logo + '">' : esc(String(D.brand).trim().charAt(0).toUpperCase()));
  var w1 = el('w', 'margin-left:' + ls * 0.38 + 'px;font-size:' + fz + 'px', lock, esc(D.tagline[0]));
  var w2 = el('w', 'margin-left:' + fz * 0.3 + 'px;font-size:' + fz + 'px', lock, esc(D.tagline[1] || ''));
  // measure: the final group is centred; the logo starts centred on its own
  var full = lock.offsetWidth, lgCx = ls / 2;
  var left0 = W / 2 - full / 2; lock.style.left = left0 + 'px';
  var shiftAlone = W / 2 - (left0 + lgCx), shiftOne = W / 2 - (left0 + (ls + ls * 0.38 + w1.offsetWidth) / 2);
  tl.fromTo(lg, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out' }, 19.2);
  tl.set(lock, { x: shiftAlone }, 0);
  tl.to(lock, { x: shiftOne, duration: 0.8, ease: 'power3.inOut' }, 21.6);
  tl.fromTo(w1, { opacity: 0, x: 30 * u, filter: 'blur(' + 8 * u + 'px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out' }, 21.8);
  tl.to(lock, { x: 0, duration: 0.8, ease: 'power3.inOut' }, 22.3);
  tl.fromTo(w2, { opacity: 0, x: 60 * u, filter: 'blur(' + 12 * u + 'px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.75, ease: 'power3.out' }, 22.4);
  tl.fromTo(lock, { scale: 1 }, { scale: 0.86, duration: 4.6, ease: 'sine.inOut' }, 22.9);
  snd(19.2, 'chime', 0.55); snd(21.75, 'swish', 0.45); snd(22.35, 'swish', 0.5);
  tl.to({}, { duration: 0.01 }, 27.49);
})();
</script>
</body></html>`;
}
