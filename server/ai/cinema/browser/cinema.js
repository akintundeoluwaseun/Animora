/* Animora Cinema: a from-scratch motion engine. One paused GSAP timeline (window.__timeline), deterministic.
 * Input: window.CINEMA = { W,H,duration,seed,brand,font,palette,scenes:[{type,dur,...props}] }
 * Every scene is a small film set: real lighting, depth, soft shadows, kinetic type and believable objects. */
(function () {
  const D = window.CINEMA, W = D.W, H = D.H, DUR = D.duration, P = D.palette;
  const U = Math.min(W, H) / 1080, N = (n) => n * U;
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  const SFX = []; const KMAP = { pop: 'click', hit: 'impact', shimmer: 'chime' }; const sfx = (t, k, v) => { if (t >= 0 && t < DUR - 0.1) SFX.push({ t: Math.round(t * 1000) / 1000, k: KMAP[k] || k, v: Math.round((v == null ? 0.7 : v) * 80) / 100 }); };
  let __s = D.seed || 7; const rnd = () => ((__s = (__s * 16807) % 2147483647) / 2147483647); const R = (a, b) => a + rnd() * (b - a);
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (tag, cls, parent, html, css) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (css) Object.assign(e.style, css); if (parent) parent.appendChild(e); return e; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const px = (n) => N(n) + 'px';
  const root = document.documentElement;
  Object.entries({ W: W + 'px', H: H + 'px', font: D.font || 'Inter', bg1: P.bg1, bg2: P.bg2, ink: P.ink, mute: P.mute, a1: P.a1, a2: P.a2, a1d: P.a1d || P.a1, card: P.card, notif: P.notif || P.card, cardLine: P.cardLine, hi: P.hi, shadow: P.shadow, shadow2: P.shadow2 || P.shadow, bokeh: P.bokeh, vig: P.vig, grain: P.grain == null ? 0.08 : P.grain, sweep: P.sweep }).forEach(([k, v]) => root.style.setProperty('--' + k, v));

  const stage = $('#stage');
  const bg = el('div', '', stage); bg.id = 'bg';
  const cam = el('div', '', stage); cam.id = 'cam';
  const fx = el('div', '', stage); fx.id = 'fx';
  const grain = el('div', '', stage); grain.id = 'grain';
  const vig = el('div', '', stage); vig.id = 'vig';

  // ---------------------------------------------------------------- the set: lamps, bokeh, drifting light
  (P.lamps || []).forEach((L, i) => {
    const d = el('div', 'lamp', bg); const s = N(L.size);
    Object.assign(d.style, { width: s + 'px', height: s + 'px', left: (L.x * W - s / 2) + 'px', top: (L.y * H - s / 2) + 'px', background: 'radial-gradient(circle,' + L.c + ' 0%,transparent 66%)', opacity: L.o == null ? 1 : L.o });
    tl.fromTo(d, { x: 0, y: 0, scale: 1 }, { x: N(L.dx || 120) * (i % 2 ? -1 : 1), y: N(L.dy || 90), scale: L.sc || 1.25, duration: DUR, ease: 'sine.inOut' }, 0);
  });
  const bokehs = [];
  for (let i = 0; i < (P.bokehN == null ? 16 : P.bokehN); i++) {
    const s = N(R(40, 220)), d = el('div', 'bokeh', bg);
    Object.assign(d.style, { width: s + 'px', height: s + 'px', left: R(-0.05, 1.0) * W + 'px', top: R(-0.05, 1.0) * H + 'px', opacity: R(0.25, 0.8) });
    tl.fromTo(d, { y: 0, x: 0 }, { y: -N(R(120, 420)), x: N(R(-80, 80)), duration: DUR, ease: 'none' }, 0); bokehs.push(d);
  }
  // camera: never still. a slow push with a hint of roll across the whole film
  tl.fromTo(cam, { scale: 1.0, rotation: -0.35, transformOrigin: '50% 50%' }, { scale: 1.045, rotation: 0.35, duration: DUR, ease: 'sine.inOut' }, 0);

  // ---------------------------------------------------------------- glyphs
  const G = {
    cake: '<path d="M4 20h16v-7H4zM4 16c2 1.6 4 1.6 6 0s4-1.6 6 0 3 1.6 4 0"/><path d="M12 13V9M12 3.6c1 1 1 2.2 0 2.9-1-.7-1-1.9 0-2.9z"/>',
    bag: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
    scooter: '<circle cx="6" cy="17" r="2.6"/><circle cx="18" cy="17" r="2.6"/><path d="M6 17h6l3-8h3M15 9l-1-3h-3"/>',
    pin: '<path d="M12 21s7-6.5 7-11.5a7 7 0 0 0-14 0C5 14.5 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.4 7.8-8 9-4.6-1.2-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5L15.5 10"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
    send: '<path d="M4 12l16-8-6 16-3-6.5z"/>',
    bolt: '<path d="M13 2.5L5 14h6l-1 7.5L19 10h-6z"/>',
    star: '<path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2 6.6 20.1l1-6.1L3.2 9.7l6.1-.9z"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M11 18.5h2"/>',
    chat: '<path d="M4 5.5h16v11H9.5L5 20v-3.5H4z"/>',
    wallet: '<path d="M4 7.5h14a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5A2.5 2.5 0 0 1 5.5 4H17"/><circle cx="16" cy="13.5" r="1.2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    heart: '<path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4.5" rx="1"/><path d="M5 12.5V20h14v-7.5M12 8v12M12 8C9.5 4 6 4.5 6.5 6.7 7 8.5 10.5 8 12 8zm0 0c2.5-4 6-3.5 5.5-1.3C17 8.5 13.5 8 12 8z"/>',
    home: '<path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5"/>',
  };
  const svgI = (k, extra) => '<svg viewBox="0 0 24 24" ' + (extra || '') + '>' + (G[k] || G.star) + '</svg>';

  // ---------------------------------------------------------------- type
  // words rise out of a mask; accent words take the brand gradient. Returns the wrapper with .tw word spans.
  function line(parent, text, o) {
    o = o || {};
    const l = el('div', 'tl tx' + (o.cls ? ' ' + o.cls : ''), parent);
    l.style.fontSize = px(o.size || 120); if (o.weight) l.style.fontWeight = o.weight; if (o.track != null) l.style.letterSpacing = o.track + 'em'; if (o.color) l.style.color = o.color;
    const words = String(text).split(' ');
    words.forEach((w, i) => {
      const acc = o.accent != null && (Array.isArray(o.accent) ? o.accent.includes(i) : o.accent === i);
      el('span', 'tw' + (acc ? ' acc' : ''), l, esc(w));
      if (i < words.length - 1) l.appendChild(document.createTextNode(' '));
    });
    if (o.maxW) fit(l, N(o.maxW));
    return l;
  }
  function fit(l, maxW) { let fs = parseFloat(l.style.fontSize); for (let i = 0; i < 40 && l.scrollWidth > maxW && fs > 12; i++) { fs *= 0.95; l.style.fontSize = fs + 'px'; } }
  const refit = [];
  function tIn(l, at, o) {
    o = o || {}; const ws = $$('.tw', l); const kind = o.kind || 'rise'; const st = o.stagger == null ? 0.07 : o.stagger;
    if (kind === 'rise') tl.fromTo(ws, { yPercent: 118, rotation: o.rot == null ? 5 : o.rot }, { yPercent: 0, rotation: 0, duration: o.dur || 0.9, stagger: st, ease: 'expo.out' }, at);
    else if (kind === 'blur') tl.fromTo(ws, { opacity: 0, y: N(30), scale: 1.06, filter: 'blur(' + N(22) + 'px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: o.dur || 1.0, stagger: st, ease: 'power3.out' }, at);
    else if (kind === 'track') tl.fromTo(l, { opacity: 0, letterSpacing: '0.35em' }, { opacity: 1, letterSpacing: (o.to || '0.02em'), duration: o.dur || 1.3, ease: 'expo.out' }, at);
    else if (kind === 'pop') tl.fromTo(ws, { scale: 0.6, opacity: 0, y: N(40) }, { scale: 1, opacity: 1, y: 0, duration: o.dur || 0.7, stagger: st, ease: 'back.out(1.8)' }, at);
  }
  function tOut(els, at, o) { o = o || {}; tl.to(els, { opacity: 0, y: -N(o.y == null ? 30 : o.y), filter: 'blur(' + N(10) + 'px)', duration: o.dur || 0.4, ease: 'power2.in' }, at); }

  // ---------------------------------------------------------------- objects
  function appIcon(parent, glyph, size, c1, c2, css) {
    const a = el('div', 'appicon', parent, svgI(glyph), Object.assign({ width: px(size), height: px(size), background: 'linear-gradient(150deg,' + (c1 || P.a1) + ',' + (c2 || P.a2) + ')' }, css || {}));
    return a;
  }
  function monogram(parent, size, css) {
    const a = el('div', 'appicon', parent, '', Object.assign({ width: px(size), height: px(size), background: 'linear-gradient(150deg,' + P.a1 + ',' + P.a2 + ')' }, css || {}));
    el('span', '', a, esc((D.brand || 'A').trim()[0].toUpperCase()), { position: 'relative', zIndex: 2, color: '#fff', fontWeight: 800, fontSize: px(size * 0.56), letterSpacing: '-.04em', textShadow: '0 3px 6px rgba(0,0,0,.2)' });
    return a;
  }
  function stars(parent, size, value) {
    const row = el('div', '', parent, '', { display: 'inline-flex', gap: px(size * 0.14) });
    const out = [];
    for (let i = 0; i < 5; i++) {
      const s = el('div', '', row, '<svg viewBox="0 0 24 24" width="' + N(size) + '" height="' + N(size) + '" style="overflow:visible"><defs><linearGradient id="sg' + i + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD76A"/><stop offset="1" stop-color="#FF9F1C"/></linearGradient><clipPath id="sc' + i + '"><rect class="sfill" x="0" y="0" width="24" height="24"/></clipPath></defs><path d="' + G.star.match(/d="([^"]+)"/)[1] + '" fill="rgba(120,120,130,.22)"/><path d="' + G.star.match(/d="([^"]+)"/)[1] + '" fill="url(#sg' + i + ')" clip-path="url(#sc' + i + ')"/></svg>');
      out.push({ s, r: $('.sfill', s), f: Math.max(0, Math.min(1, value - i)) });
    }
    return { row, items: out };
  }
  function starsPlay(st, at) {
    st.items.forEach((it, i) => {
      tl.fromTo(it.r, { attr: { width: 0 } }, { attr: { width: 24 * it.f }, duration: 0.3, ease: 'power2.out' }, at + i * 0.12);
      tl.fromTo(it.s, { scale: 1 }, { scale: 1.35, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out' }, at + i * 0.12);
      sfx(at + i * 0.12, 'tick', 0.3);
    });
  }
  function notification(parent, o) {
    const n = el('div', 'notif', parent, '', { width: px(o.w || 900) });
    appIcon(n, o.glyph || 'bag', 96, o.c1, o.c2);
    const t = el('div', '', n); el('div', 'tt', t, esc(o.title)); el('div', 'bd', t, esc(o.body));
    n.firstChild.style.flex = '0 0 auto'; el('div', 'tm', n, esc(o.time || 'now'));
    n.style.fontSize = px(30);
    return n;
  }
  function payCard(parent, o) {
    const w = o.w || 760, h = w * 0.63;
    const c = el('div', '', parent, '', { width: px(w), height: px(h), borderRadius: px(46), position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg,' + (o.c1 || P.a1) + ' 0%,' + (o.c2 || P.a2) + ' 55%,' + (o.c3 || '#0b1230') + ' 120%)', boxShadow: '0 70px 100px -40px rgba(0,0,0,.65),0 0 0 2px rgba(255,255,255,.14) inset,0 2px 0 rgba(255,255,255,.5) inset' });
    el('div', '', c, '', { position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 0% 0%,rgba(255,255,255,.42),transparent 55%)' });
    el('div', '', c, '', { position: 'absolute', inset: 0, background: 'linear-gradient(115deg,transparent 38%,rgba(255,255,255,.22) 48%,transparent 58%)' });
    el('div', '', c, esc(o.brand || D.brand), { position: 'absolute', left: px(54), top: px(48), color: '#fff', fontWeight: 800, fontSize: px(46), letterSpacing: '-.03em' });
    el('div', '', c, '<svg viewBox="0 0 24 24" width="' + N(54) + '" height="' + N(54) + '" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="1.8" stroke-linecap="round"><path d="M8 7.5a6.5 6.5 0 0 1 0 9M12 5a10.5 10.5 0 0 1 0 14M16 2.5a14.5 14.5 0 0 1 0 19"/></svg>', { position: 'absolute', right: px(52), top: px(46) });
    el('div', '', c, '', { position: 'absolute', left: px(54), top: px(h * 0.36), width: px(96), height: px(74), borderRadius: px(14), background: 'linear-gradient(135deg,#f6e3a1,#c9a24a)', boxShadow: '0 2px 0 rgba(255,255,255,.6) inset,0 -2px 4px rgba(0,0,0,.25) inset' });
    el('div', 'mono', c, '••••  ••••  ••••  ' + esc(o.last4 || '4821'), { position: 'absolute', left: px(54), bottom: px(92), color: 'rgba(255,255,255,.92)', fontSize: px(40), letterSpacing: '.06em' });
    el('div', '', c, esc(o.name || 'VIRTUAL'), { position: 'absolute', left: px(54), bottom: px(44), color: 'rgba(255,255,255,.7)', fontSize: px(28), fontWeight: 600, letterSpacing: '.18em' });
    el('div', '', c, '<svg viewBox="0 0 48 30" width="' + N(88) + '" height="' + N(55) + '"><circle cx="17" cy="15" r="13" fill="rgba(255,90,90,.9)"/><circle cx="31" cy="15" r="13" fill="rgba(255,200,60,.88)" style="mix-blend-mode:screen"/></svg>', { position: 'absolute', right: px(46), bottom: px(36) });
    return c;
  }
  function searchBar(parent, w) {
    const b = el('div', 'pill', parent, '', { width: px(w), height: px(120), padding: '0 ' + px(40), fontSize: px(44) });
    el('div', '', b, svgI('search', 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="' + N(52) + '" height="' + N(52) + '"'), { color: P.mute, flex: '0 0 auto', display: 'grid' });
    const f = el('div', '', b, '', { position: 'relative', flex: 1, whiteSpace: 'nowrap', color: P.ink, fontWeight: 500, letterSpacing: '-.01em', height: px(60), display: 'flex', alignItems: 'center' });
    return { b, f };
  }
  function ring(parent, size, thick, c1, c2, id) {
    const r = (size - thick) / 2, c = 2 * Math.PI * r;
    const s = el('div', '', parent, '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + N(size) + '" height="' + N(size) + '" style="transform:rotate(-90deg);overflow:visible"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="rgba(128,128,150,.2)" stroke-width="' + thick + '"/><circle class="arc" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="url(#' + id + ')" stroke-width="' + thick + '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '"/></svg>');
    return { s, arc: $('.arc', s), c };
  }
  function odometer(parent, value, size, prefix) {
    const box = el('div', '', parent, '', { display: 'inline-flex', alignItems: 'baseline', height: px(size * 1.0), overflow: 'hidden', fontSize: px(size), fontWeight: 800, letterSpacing: '-.05em', lineHeight: 1 });
    if (prefix) el('span', 'acc', box, esc(prefix), { fontSize: '0.46em', alignSelf: 'flex-start', marginTop: '0.16em', marginRight: '0.04em', lineHeight: 1 });
    const cols = [];
    String(value).split('').forEach((ch) => {
      if (/\d/.test(ch)) {
        const cell = el('span', '', box, '', { display: 'inline-block', height: px(size), overflow: 'hidden', width: '0.62em', textAlign: 'center' });
        const col = el('span', 'acc', cell, '', { display: 'block' });
        let h = ''; for (let k = 0; k < 20; k++) h += '<span style="display:block;height:' + N(size) + 'px;line-height:' + N(size) + 'px">' + (k % 10) + '</span>';
        col.innerHTML = h; cols.push({ col, d: +ch });
      } else el('span', 'acc', box, esc(ch));
    });
    return { box, cols, size };
  }
  function odoPlay(o, at) {
    o.cols.slice().reverse().forEach((c, i) => tl.fromTo(c.col, { y: 0 }, { y: -N(o.size) * (10 + c.d), duration: 1.5 + i * 0.12, ease: 'expo.out' }, at + i * 0.05));
  }

  // ---------------------------------------------------------------- scene machinery + transitions
  const SCENES = {}; const roots = [];
  function sweepFx(at, dir) {
    const s = el('div', 'sweep', fx); const d = dir || 1;
    tl.fromTo(s, { x: d > 0 ? -W * 0.6 : W * 1.3, opacity: 0 }, { x: d > 0 ? W * 1.3 : -W * 0.6, opacity: 1, duration: 0.8, ease: 'power2.inOut' }, at);
    tl.to(s, { opacity: 0, duration: 0.2 }, at + 0.62);
  }
  function enter(sc, at, kind) {
    tl.set(sc, { opacity: 1 }, at);
    if (kind === 'push') tl.fromTo(sc, { scale: 0.86, filter: 'blur(' + N(14) + 'px)' }, { scale: 1, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', immediateRender: false }, at);
    else if (kind === 'rise') tl.fromTo(sc, { y: H * 0.18, opacity: 0, filter: 'blur(' + N(12) + 'px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.95, ease: 'expo.out', immediateRender: false }, at);
    else if (kind === 'slide') tl.fromTo(sc, { x: W * 0.28, opacity: 0, filter: 'blur(' + N(18) + 'px)' }, { x: 0, opacity: 1, filter: 'blur(0px)', duration: 0.85, ease: 'expo.out', immediateRender: false }, at);
    else tl.fromTo(sc, { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 0.7, immediateRender: false }, at);
  }
  function leave(sc, at, kind) {
    if (kind === 'push') { tl.to(sc, { scale: 1.22, opacity: 0, filter: 'blur(' + N(18) + 'px)', duration: 0.45, ease: 'power3.in' }, at); }
    else if (kind === 'rise') { tl.to(sc, { y: -H * 0.14, opacity: 0, filter: 'blur(' + N(12) + 'px)', duration: 0.45, ease: 'power3.in' }, at); }
    else if (kind === 'slide') { tl.to(sc, { x: -W * 0.24, opacity: 0, filter: 'blur(' + N(18) + 'px)', duration: 0.45, ease: 'power3.in' }, at); }
    else tl.to(sc, { opacity: 0, scale: 0.97, duration: 0.4 }, at);
    tl.set(sc, { opacity: 0 }, at + 0.46);
  }
  window.__CINEMA = { tl, el, $, $$, N, px, R, rnd, line, tIn, tOut, appIcon, monogram, stars, starsPlay, notification, payCard, searchBar, ring, odometer, odoPlay, svgI, G, esc, sfx, fx, cam, SCENES, enter, leave, sweepFx, W, H, DUR, P, D, fit, refit };

  // ================================================================ SCENES
  const col = (sc, o) => { o = o || {}; sc.style.gap = px(o.gap == null ? 24 : o.gap); if (o.pt) sc.style.paddingTop = px(o.pt); if (o.pb) sc.style.paddingBottom = px(o.pb); return sc; };
  const drift = (e, t0, t1, dx, dy) => tl.fromTo(e, { x: -dx, y: -(dy || 0) }, { x: dx, y: dy || 0, duration: t1 - t0 + 0.6, ease: 'none' }, t0);

  // 1. HOOK: big confident type, each line its own treatment
  SCENES.hook = (sc, o, t0, t1) => {
    col(sc, { gap: o.gap == null ? 8 : o.gap });
    if (o.eyebrow) { const e = el('div', 'eyebrow', sc, esc(o.eyebrow), { marginBottom: px(28) }); tl.fromTo(e, { opacity: 0, y: N(24) }, { opacity: 1, y: 0, duration: 0.9 }, t0 + 0.1); }
    o.lines.forEach((L, i) => {
      const l = line(sc, L.text, { size: L.size || 210, accent: L.accent, weight: L.weight || 800, maxW: L.maxW || 940, track: L.track, color: L.color });
      tIn(l, t0 + 0.15 + i * 0.16, { kind: L.kind || 'rise', stagger: L.stagger });
      drift(l, t0, t1, N(14) * (i % 2 ? -1 : 1), 0);
    });
    if (o.sub) { const s = line(sc, o.sub, { size: o.subSize || 52, weight: 500, cls: 'sub', maxW: 860 }); s.style.marginTop = px(40); tIn(s, t0 + 0.5 + o.lines.length * 0.16, { kind: 'blur', stagger: 0.05 }); }
    sfx(t0 + 0.15, 'whoosh', 0.5);
  };

  // 2. SEARCH: a believable phone moment, the business is the answer
  SCENES.search = (sc, o, t0, t1) => {
    col(sc, { gap: 52 });
    const lab = line(sc, o.label || '', { size: 50, weight: 600, cls: 'sub', maxW: 900 }); tIn(lab, t0 + 0.1, { kind: 'blur' });
    const sb = searchBar(sc, 920);
    tl.fromTo(sb.b, { y: N(60), opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out' }, t0 + 0.2);
    const typed = el('span', '', sb.f, esc(o.query), { display: 'inline-block', overflow: 'hidden', whiteSpace: 'nowrap', width: 0 });
    const caret = el('i', '', sb.f, '', { display: 'inline-block', width: px(5), height: px(58), background: P.a1, marginLeft: px(6), borderRadius: px(3) });
    const full = (() => { typed.style.width = 'auto'; const w = typed.offsetWidth; typed.style.width = '0px'; return w; })();
    const ty = t0 + 1.0, td = Math.min(1.8, 0.075 * o.query.length);
    tl.to(typed, { width: full, duration: td, ease: 'steps(' + o.query.length + ')' }, ty);
    for (let k = 0; k < o.query.length; k += 2) sfx(ty + (td * k) / o.query.length, 'tick', 0.2);
    tl.fromTo(caret, { opacity: 1 }, { opacity: 0, duration: 0.35, yoyo: true, repeat: 7, ease: 'steps(1)' }, t0 + 0.2);
    // the result slides up
    const card = el('div', 'glass', sc, '', { width: px(920), padding: px(40), display: 'flex', gap: px(34), alignItems: 'center' });
    monogram(card, 156);
    const tx = el('div', '', card); el('div', '', tx, esc(D.brand), { fontSize: px(58), fontWeight: 800, letterSpacing: '-.03em' });
    const sr = el('div', '', tx, '', { display: o.rating === false ? 'none' : 'flex', alignItems: 'center', gap: px(14), marginTop: px(10) }); const st = stars(sr, 34, 5); el('span', '', sr, esc(o.rating || '5.0'), { fontSize: px(34), fontWeight: 700 });
    el('div', '', tx, esc(o.meta || ''), { fontSize: px(34), color: P.mute, marginTop: px(8), fontWeight: 500 });
    const go = el('div', 'btn', card, esc(o.cta || 'Order'), { marginLeft: 'auto', padding: px(26) + ' ' + px(40), fontSize: px(36) });
    const rt = ty + td + 0.35;
    tl.fromTo(card, { y: N(160), opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 1.0, ease: 'elastic.out(1,0.8)' }, rt);
    starsPlay(st, rt + 0.45); sfx(rt, 'pop', 0.6);
    tl.fromTo(go, { scale: 1 }, { scale: 0.92, duration: 0.12, yoyo: true, repeat: 1 }, rt + 1.5);
    tl.to(sb.b, { scale: 0.96, opacity: 0.7, y: -N(20), duration: 0.8, ease: 'power2.out' }, rt);
  };

  // 3. RECEIPT: the order, printed
  SCENES.receipt = (sc, o, t0, t1) => {
    const wrap = el('div', '', sc, '', { filter: 'drop-shadow(0 50px 50px rgba(30,18,8,.45)) drop-shadow(0 8px 12px rgba(30,18,8,.25))' });
    const paper = el('div', 'paper', wrap, '', { width: px(800), padding: px(72) + ' ' + px(68) + ' ' + px(120) });
    el('div', '', paper, esc(D.brand), { fontSize: px(60), fontWeight: 800, letterSpacing: '-.04em' });
    el('div', 'mono', paper, esc(o.order || 'ORDER #2041'), { fontSize: px(26), color: '#8a8173', marginTop: px(10), letterSpacing: '.08em' });
    el('div', 'dash', paper, '', { margin: px(36) + ' 0' });
    const rows = o.rows.map((r) => { const rw = el('div', '', paper, '', { display: 'flex', justifyContent: 'space-between', fontSize: px(42), fontWeight: 600, margin: px(22) + ' 0', letterSpacing: '-.01em' }); el('span', '', rw, esc(r[0])); el('span', 'mono', rw, esc(r[1]), { fontWeight: 600, fontSize: px(38) }); return rw; });
    el('div', 'dash', paper, '', { margin: px(36) + ' 0 ' + px(22) });
    const tot = el('div', '', paper, '', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' });
    el('span', '', tot, 'Total', { fontSize: px(46), fontWeight: 700, color: '#6e6558' });
    const od = odometer(tot, o.total, 104, o.currency || '₦'); od.box.style.color = '#1b1713';
    $$('.acc', od.box).forEach((a) => { a.style.background = 'none'; a.style.color = '#1b1713'; a.style.webkitTextFillColor = '#1b1713'; });
    const bc = el('div', '', paper, '', { height: px(90), marginTop: px(48), background: 'repeating-linear-gradient(90deg,#1b1713 0 3px,transparent 3px 7px,#1b1713 7px 8px,transparent 8px 14px,#1b1713 14px 19px,transparent 19px 22px)', opacity: 0.85 });
    const stamp = el('div', '', paper, esc(o.stamp || 'PAID'), { position: 'absolute', right: px(40), top: px(54), border: px(9) + ' solid #1f9d63', color: '#1f9d63', fontSize: px(84), fontWeight: 900, padding: px(4) + ' ' + px(26), borderRadius: px(18), letterSpacing: '.08em', transform: 'rotate(-12deg)', opacity: 0 });
    tl.fromTo(wrap, { y: H * 0.55, rotationX: 28, rotation: 3 }, { y: 0, rotationX: 0, rotation: -1.2, duration: 1.25, ease: 'expo.out' }, t0 + 0.05);
    rows.forEach((r, i) => { tl.fromTo(r, { opacity: 0, x: -N(30) }, { opacity: 1, x: 0, duration: 0.5 }, t0 + 0.85 + i * 0.32); sfx(t0 + 0.85 + i * 0.32, 'click', 0.35); });
    const ta = t0 + 0.85 + rows.length * 0.32 + 0.15; odoPlay(od, ta); sfx(ta, 'shimmer', 0.4);
    const sa = ta + 1.3;
    tl.fromTo(stamp, { opacity: 0, scale: 2.6, rotation: -26 }, { opacity: 1, scale: 1, rotation: -12, duration: 0.22, ease: 'power4.in' }, sa);
    tl.fromTo(wrap, { y: 0 }, { y: N(14), duration: 0.07, yoyo: true, repeat: 3, ease: 'sine.inOut', immediateRender: false }, sa + 0.2); sfx(sa + 0.2, 'impact', 0.8);
    tl.fromTo(wrap, { scale: 1 }, { scale: 1.035, duration: t1 - t0 - 1, ease: 'none', immediateRender: false }, t0 + 1);
  };

  // 4. MAP: delivery on the way
  SCENES.map = (sc, o, t0, t1) => {
    col(sc, { gap: 40 });
    const lab = line(sc, o.label || '', { size: 62, weight: 700, maxW: 900 }); tIn(lab, t0 + 0.1, { kind: 'rise' });
    const MW = 940, MH = 1080;
    const card = el('div', '', sc, '', { width: px(MW), height: px(MH), borderRadius: px(60), overflow: 'hidden', position: 'relative', boxShadow: '0 70px 100px -40px rgba(0,0,0,.55),0 0 0 2px rgba(255,255,255,.35)', background: '#efe9de' });
    const S = (v) => v; // svg is in 940x1080 design units
    const roads = [];
    for (let i = -1; i < 8; i++) { const y = i * 170 + R(-14, 14); roads.push('M-40 ' + y + ' Q 470 ' + (y + R(-40, 40)) + ' 1000 ' + (y + R(-30, 30))); }
    for (let i = -1; i < 7; i++) { const x = i * 190 + R(-14, 14); roads.push('M' + x + ' -40 Q ' + (x + R(-40, 40)) + ' 540 ' + (x + R(-30, 30)) + ' 1120'); }
    const route = o.route || [[150, 960], [150, 700], [420, 700], [420, 440], [740, 440], [740, 250]];
    let rd = 'M' + route[0][0] + ' ' + route[0][1]; for (let i = 1; i < route.length; i++) { const p = route[i - 1], q = route[i]; const r = i < route.length - 1 ? route[i + 1] : null; if (r) { const k = 44; const a = [q[0] - Math.sign(q[0] - p[0]) * k, q[1] - Math.sign(q[1] - p[1]) * k]; const b = [q[0] + Math.sign(r[0] - q[0]) * k, q[1] + Math.sign(r[1] - q[1]) * k]; rd += ' L' + a[0] + ' ' + a[1] + ' Q' + q[0] + ' ' + q[1] + ' ' + b[0] + ' ' + b[1]; } else rd += ' L' + q[0] + ' ' + q[1]; }
    const svg = el('div', '', card, '<svg viewBox="0 0 940 1080" width="' + N(MW) + '" height="' + N(MH) + '" style="position:absolute;inset:0"><defs><pattern id="blk" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(8)"><rect x="4" y="4" width="16" height="12" rx="2" fill="rgba(90,70,40,.045)"/><rect x="26" y="22" width="14" height="16" rx="2" fill="rgba(90,70,40,.04)"/></pattern></defs><rect width="940" height="1080" fill="#eee8dc"/><rect width="940" height="1080" fill="url(#blk)"/><path d="M640 1080 C 700 900 860 880 940 760 L 940 1080 Z" fill="#b9d6e9"/><path d="M-10 90 C 120 40 260 60 330 150 C 380 220 300 300 180 280 C 60 260 -10 220 -10 90Z" fill="#cde4bd"/><circle cx="110" cy="130" r="9" fill="#a9cf95"/><circle cx="210" cy="200" r="11" fill="#a9cf95"/><circle cx="260" cy="120" r="8" fill="#a9cf95"/>' + roads.map((p) => '<path d="' + p + '" stroke="#d9d0c0" stroke-width="30" fill="none"/>').join('') + roads.map((p) => '<path d="' + p + '" stroke="#fffdf8" stroke-width="22" fill="none"/>').join('') + '<path d="' + rd + '" stroke="#fff" stroke-width="34" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path id="rt" d="' + rd + '" stroke="' + P.a1 + '" stroke-width="18" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    const path = $('#rt', svg); const len = path.getTotalLength();
    path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
    const pts = []; const NP = 40; for (let i = 0; i <= NP; i++) { const pt = path.getPointAtLength((len * i) / NP); pts.push({ x: N(pt.x), y: N(pt.y) }); }
    const dd = route[route.length - 1];
    const pin = el('div', '', card, '<svg viewBox="0 0 24 34" width="' + N(84) + '" height="' + N(118) + '" style="overflow:visible;filter:drop-shadow(0 12px 8px rgba(0,0,0,.35))"><path d="M12 33C12 33 22 21 22 12A10 10 0 0 0 2 12c0 9 10 21 10 21z" fill="' + P.a1 + '"/><circle cx="12" cy="12" r="4.2" fill="#fff"/></svg>', { position: 'absolute', left: px(dd[0] - 42), top: px(dd[1] - 118) });
    const rip = el('div', '', card, '', { position: 'absolute', left: px(dd[0] - 70), top: px(dd[1] - 70), width: px(140), height: px(140), borderRadius: '50%', border: px(6) + ' solid ' + P.a1, opacity: 0 });
    const rider = el('div', '', card, '', { position: 'absolute', left: 0, top: 0, width: px(96), height: px(96), marginLeft: px(-48), marginTop: px(-48) });
    const rb = appIcon(rider, o.riderGlyph || 'scooter', 96, P.a1, P.a2, { borderRadius: '50%', boxShadow: '0 0 0 ' + px(8) + ' #fff,0 18px 22px -6px rgba(0,0,0,.4)' });
    const eta = el('div', 'pill', card, '', { position: 'absolute', left: px(48), right: px(48), bottom: px(48), height: px(150), padding: '0 ' + px(44), justifyContent: 'space-between', background: P.cardSolid || 'rgba(255,255,255,.94)', color: '#1b1713' });
    const e1 = el('div', '', eta); el('div', '', e1, esc(o.status || 'On the way'), { fontSize: px(32), color: '#7b7364', fontWeight: 600 }); const eT = el('div', '', e1, '', { position: 'relative', height: px(74), width: px(420), marginTop: px(4), fontSize: px(60), lineHeight: '74px', fontWeight: 800, letterSpacing: '-.03em' });
    const eA = el('span', '', eT, esc(o.eta1 || '12 min'), { position: 'absolute', left: 0 }), eB = el('span', 'acc', eT, esc(o.eta2 || '3 min'), { position: 'absolute', left: 0, opacity: 0 });
    appIcon(eta, 'clock', 92, P.a1, P.a2, { borderRadius: '50%' });
    tl.fromTo(card, { y: N(260), opacity: 0, scale: 0.9, rotationX: 24 }, { y: 0, opacity: 1, scale: 1, rotationX: 0, duration: 1.1, ease: 'expo.out' }, t0 + 0.2);
    const rs = t0 + 1.15, rdur = Math.min(3.0, t1 - rs - 1.4);
    tl.to(path, { strokeDashoffset: 0, duration: rdur, ease: 'power1.inOut' }, rs);
    tl.fromTo(rider, { x: pts[0].x, y: pts[0].y, scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(2)' }, rs - 0.1);
    tl.to(rider, { keyframes: pts.map((p) => ({ x: p.x, y: p.y, duration: rdur / NP, ease: 'none' })), ease: 'none' }, rs);
    tl.fromTo(pin, { y: -N(220), opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'bounce.out' }, rs + 0.2);
    tl.fromTo(rip, { scale: 0.3, opacity: 0.9 }, { scale: 2.2, opacity: 0, duration: 1.1, ease: 'power2.out', repeat: 1, repeatDelay: 0.25 }, rs + 0.85); sfx(rs + 0.85, 'pop', 0.5);
    tl.to(eA, { opacity: 0, y: -N(30), duration: 0.35 }, rs + rdur * 0.55); tl.fromTo(eB, { opacity: 0, y: N(30) }, { opacity: 1, y: 0, duration: 0.45 }, rs + rdur * 0.55 + 0.1);
    tl.fromTo(eta, { y: N(60), opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, t0 + 0.9);
    tl.fromTo(card, { scale: 1 }, { scale: 1.05, duration: t1 - t0 - 1.1, ease: 'none', immediateRender: false }, t0 + 1.1);
  };

  // 5. NOTIFICATIONS: they stack as they arrive
  SCENES.notifs = (sc, o, t0, t1) => {
    col(sc, { gap: 30 });
    if (o.label) { const l = line(sc, o.label, { size: 70, weight: 800, maxW: 900 }); tIn(l, t0 + 0.1, { kind: 'rise' }); l.style.marginBottom = px(30); }
    const list = o.items.map((it, i) => { const n = notification(sc, Object.assign({ w: 930 }, it)); n.style.position = 'relative'; return n; });
    const gap = (t1 - t0 - 1.0) / (list.length + 0.5);
    list.forEach((n, i) => {
      const at = t0 + 0.5 + i * Math.min(0.9, gap);
      tl.fromTo(n, { y: -N(420), opacity: 0, scale: 0.9, filter: 'blur(' + N(10) + 'px)' }, { y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, ease: 'elastic.out(1,0.78)' }, at); sfx(at, 'ding', 0.55);
      if (i > 0) tl.to(list.slice(0, i), { scale: 0.96 - 0.01 * i, opacity: 0.72, duration: 0.5, ease: 'power2.out' }, at + 0.05);
    });
  };

  // 6. RATING
  SCENES.rating = (sc, o, t0, t1) => {
    col(sc, { gap: 18 });
    if (o.eyebrow) { const e = el('div', 'eyebrow', sc, esc(o.eyebrow)); tl.fromTo(e, { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, t0 + 0.1); }
    const big = el('div', '', sc, '', { display: 'flex', justifyContent: 'center' });
    const od = odometer(big, o.value || '5.0', 360); tl.fromTo(od.box, { opacity: 0 }, { opacity: 1, duration: 0.3 }, t0 + 0.2); odoPlay(od, t0 + 0.25);
    const st = stars(sc, 120, parseFloat(o.value) || 5); st.row.style.marginTop = px(10); tl.fromTo(st.row, { opacity: 0, y: N(40) }, { opacity: 1, y: 0, duration: 0.6 }, t0 + 0.8); starsPlay(st, t0 + 1.1);
    const l = line(sc, o.text || '', { size: 64, weight: 700, maxW: 900, accent: o.accent }); l.style.marginTop = px(40); tIn(l, t0 + 1.7, { kind: 'blur', stagger: 0.06 });
    if (o.sub) { const s = line(sc, o.sub, { size: 44, weight: 500, cls: 'sub', maxW: 860 }); tIn(s, t0 + 2.1, { kind: 'blur' }); }
  };

  // 7. CARD3D: a glowing card turning on a light platform
  SCENES.card3d = (sc, o, t0, t1) => {
    col(sc, { gap: 40 });
    const head = el('div', '', sc, '', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(4) });
    o.lines.forEach((L, i) => { const l = line(head, L.text, { size: L.size || 96, accent: L.accent, weight: L.weight || 800, maxW: 940, cls: L.sub ? 'sub' : '' }); tIn(l, t0 + 0.15 + i * 0.16, { kind: L.kind || 'rise' }); });
    const stageEl = el('div', '', sc, '', { position: 'relative', width: px(1000), height: px(900) });
    // platform: concentric light rings under the card
    for (let i = 0; i < 3; i++) { const r = el('div', '', stageEl, '', { position: 'absolute', left: '50%', top: px(640), width: px(940 - i * 170), height: px(280 - i * 52), marginLeft: px(-(470 - i * 85)), borderRadius: '50%', border: px(3 + (2 - i)) + ' solid ' + P.a1, opacity: 0.5 - i * 0.1, boxShadow: '0 0 ' + px(60) + ' ' + P.a1 }); tl.fromTo(r, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 0.5 - i * 0.1, duration: 1.1, ease: 'expo.out' }, t0 + 0.4 + i * 0.12); }
    const glow = el('div', '', stageEl, '', { position: 'absolute', left: '50%', top: px(620), width: px(1000), height: px(330), marginLeft: px(-500), borderRadius: '50%', background: 'radial-gradient(ellipse,' + P.a1 + ' 0%,transparent 65%)', opacity: 0.45 });
    const cw = el('div', '', stageEl, '', { position: 'absolute', left: '50%', top: px(100), marginLeft: px(-430) });
    const card = payCard(cw, Object.assign({ w: 860 }, o.card || {}));
    tl.fromTo(cw, { rotationX: 72, rotationZ: -28, y: N(420), opacity: 0, scale: 0.7 }, { rotationX: 18, rotationY: -16, rotationZ: 0, y: 0, opacity: 1, scale: 1, duration: 1.7, ease: 'expo.out' }, t0 + 0.35); sfx(t0 + 0.4, 'whoosh', 0.7);
    tl.to(cw, { rotationY: 15, rotationX: 12, y: -N(26), duration: t1 - t0 - 2.0, ease: 'sine.inOut' }, t0 + 2.0);
    tl.fromTo(glow, { opacity: 0 }, { opacity: 0.55, duration: 1.4 }, t0 + 0.5);
  };

  // 8. BIG NUMBER
  SCENES.bignum = (sc, o, t0, t1) => {
    col(sc, { gap: 10 });
    if (o.eyebrow) { const e = el('div', 'eyebrow', sc, esc(o.eyebrow)); tl.fromTo(e, { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, t0 + 0.1); }
    const row = el('div', '', sc, '', { display: 'flex', alignItems: 'baseline', gap: px(10) });
    const od = odometer(row, o.value, o.size || 420, o.prefix); odoPlay(od, t0 + 0.25); tl.fromTo(od.box, { opacity: 0 }, { opacity: 1, duration: 0.3 }, t0 + 0.2);
    if (o.suffix) { const sfxEl = el('div', 'acc', row, esc(o.suffix), { fontSize: px((o.size || 420) * 0.5), fontWeight: 800, letterSpacing: '-.04em' }); tl.fromTo(sfxEl, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' }, t0 + 1.2); }
    (o.lines || []).forEach((L, i) => { const l = line(sc, L.text, { size: L.size || 90, accent: L.accent, weight: L.weight || 800, maxW: 940, cls: L.sub ? 'sub' : '' }); tIn(l, t0 + 1.0 + i * 0.2, { kind: L.kind || 'rise' }); });
    sfx(t0 + 0.3, 'riser', 0.5);
  };

  // 9. ROLL PILL: one pill, words rolling
  SCENES.roll = (sc, o, t0, t1) => {
    col(sc, { gap: 44 });
    const l = line(sc, o.lead, { size: o.leadSize || 120, weight: 800, maxW: 940 }); tIn(l, t0 + 0.1, { kind: 'rise' });
    const pill = el('div', 'pill', sc, '', { height: px(250), padding: '0 ' + px(80), overflow: 'hidden', position: 'relative', justifyContent: 'center', background: P.pillBg || P.card });
    const ws = o.words.map((w) => el('div', 'tx acc', pill, esc(w), { position: 'absolute', fontSize: px(o.size || 150), fontWeight: 800, left: 0, right: 0, textAlign: 'center', top: px(250 / 2 - (o.size || 150) * 0.58), lineHeight: 1.1, whiteSpace: 'nowrap' }));
    let mw = 0; ws.forEach((w) => { w.style.position = 'static'; mw = Math.max(mw, w.offsetWidth); w.style.position = 'absolute'; }); pill.style.width = (mw + N(160)) + 'px';
    tl.fromTo(pill, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.8)' }, t0 + 0.35);
    const step = (t1 - t0 - 1.0) / o.words.length;
    ws.forEach((w, i) => { const at = t0 + 0.6 + i * step; tl.fromTo(w, { yPercent: 130, opacity: 0, filter: 'blur(' + N(8) + 'px)' }, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'expo.out' }, at); sfx(at, 'swipe', 0.4); if (i < ws.length - 1) tl.to(w, { yPercent: -130, opacity: 0, duration: 0.35, ease: 'power3.in' }, at + step - 0.3); });
  };

  // 10. PHONE FEED: a phone with life on screen
  SCENES.phone = (sc, o, t0, t1) => {
    col(sc, { gap: 0 });
    const ph = el('div', '', sc, '', { width: px(640), height: px(1280), borderRadius: px(100), padding: px(16), background: 'linear-gradient(145deg,#3a3d46,#0c0d11 40%,#2c2e36)', boxShadow: '0 100px 120px -50px rgba(0,0,0,.7),0 0 0 3px rgba(255,255,255,.14) inset,0 0 0 2px rgba(0,0,0,.6)', position: 'relative' });
    const scr = el('div', '', ph, '', { width: '100%', height: '100%', borderRadius: px(86), overflow: 'hidden', position: 'relative', background: 'linear-gradient(170deg,' + (o.w1 || P.a1) + ' 0%,' + (o.w2 || '#101426') + ' 100%)' });
    el('div', '', scr, '', { position: 'absolute', inset: 0, background: 'radial-gradient(90% 50% at 20% 0%,rgba(255,255,255,.28),transparent 60%)' });
    el('div', '', scr, '', { position: 'absolute', left: '50%', top: px(26), width: px(190), height: px(54), marginLeft: px(-95), borderRadius: px(30), background: '#000', zIndex: 5 });
    el('div', '', scr, esc(o.time || '9:41'), { position: 'absolute', top: px(150), width: '100%', textAlign: 'center', fontSize: px(150), fontWeight: 700, color: '#fff', letterSpacing: '-.04em', opacity: 0.95 });
    el('div', '', scr, esc(o.date || ''), { position: 'absolute', top: px(128), width: '100%', textAlign: 'center', fontSize: px(32), fontWeight: 600, color: 'rgba(255,255,255,.8)' });
    const stack = el('div', '', scr, '', { position: 'absolute', top: px(380), left: px(26), right: px(26), display: 'flex', flexDirection: 'column', gap: px(18) });
    if (o.widget) {
      const wd = el('div', '', scr, '', { position: 'absolute', left: px(26), right: px(26), top: px(860), height: px(250), borderRadius: px(44), background: 'rgba(255,255,255,.14)', boxShadow: '0 0 0 2px rgba(255,255,255,.22) inset', padding: px(30) + ' ' + px(36) });
      el('div', '', wd, esc(o.widget.label), { fontSize: px(26), fontWeight: 600, color: 'rgba(255,255,255,.75)' });
      el('div', '', wd, esc(o.widget.value), { fontSize: px(84), fontWeight: 800, color: '#fff', letterSpacing: '-.04em', marginTop: px(6) });
      el('div', '', wd, '<svg viewBox="0 0 300 60" width="' + N(300) + '" height="' + N(60) + '"><path d="M0 50 C40 48 60 20 100 30 S160 52 200 26 S260 6 300 10" fill="none" stroke="#27E2C2" stroke-width="5" stroke-linecap="round"/></svg>', { position: 'absolute', right: px(30), bottom: px(24) });
      tl.fromTo(wd, { opacity: 0, y: N(60) }, { opacity: 1, y: 0, duration: 0.8 }, t0 + 1.0);
    }
    const dock = el('div', '', scr, '', { position: 'absolute', left: px(26), right: px(26), bottom: px(34), height: px(150), borderRadius: px(50), background: 'rgba(255,255,255,.16)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0 ' + px(20) });
    ['phone', 'chat', 'search', 'card'].forEach((g, i) => appIcon(dock, g, 100, ['#34C759', '#3D7BFF', '#FF9F0A', '#8E6BFF'][i], ['#1f9d44', '#2557D8', '#e07b00', '#5b3fd0'][i]));
    const ns = o.items.map((it) => { const n = notification(stack, Object.assign({ w: 588 }, it)); n.style.padding = px(18) + ' ' + px(22); n.style.borderRadius = px(34); n.style.gap = px(18); n.style.background = 'rgba(255,255,255,.88)'; n.firstChild.style.width = px(78); n.firstChild.style.height = px(78); $('.tt', n).style.fontSize = px(29); $('.bd', n).style.fontSize = px(25); $('.tm', n).style.fontSize = px(20); $('.tt', n).style.color = '#16181f'; $('.bd', n).style.color = '#555a66'; $('.tm', n).style.color = '#555a66'; return n; });
    tl.fromTo(ph, { y: N(700), rotationY: -38, rotationX: 14, scale: 0.8, opacity: 0 }, { y: 0, rotationY: -14, rotationX: 6, scale: 1, opacity: 1, duration: 1.5, ease: 'expo.out' }, t0 + 0.1);
    tl.to(ph, { rotationY: 12, rotationX: 2, y: -N(30), duration: t1 - t0 - 1.5, ease: 'sine.inOut' }, t0 + 1.5);
    ns.forEach((n, i) => { const at = t0 + 1.2 + i * 0.75; tl.fromTo(n, { y: -N(200), opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'elastic.out(1,0.8)' }, at); sfx(at, 'ding', 0.5); });
  };

  // 11. SHIELD / RING
  SCENES.shield = (sc, o, t0, t1) => {
    col(sc, { gap: 50 });
    const wrap = el('div', '', sc, '', { position: 'relative', width: px(560), height: px(560) });
    const rg = ring(wrap, 560, 30, P.a1, P.a2, 'rg' + Math.round(R(0, 9999))); rg.s.style.position = 'absolute'; rg.s.style.inset = 0;
    el('div', '', wrap, '', { position: 'absolute', inset: px(70), borderRadius: '50%', background: 'radial-gradient(circle,' + P.a1 + ' 0%,transparent 70%)', opacity: 0.28 });
    const ic = appIcon(wrap, o.glyph || 'shield', 250, P.a1, P.a2, { position: 'absolute', left: px(155), top: px(155), borderRadius: '30%' });
    tl.fromTo(rg.arc, { strokeDashoffset: rg.c }, { strokeDashoffset: 0, duration: 2.0, ease: 'power2.inOut' }, t0 + 0.35);
    tl.fromTo(ic, { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: 0.9, ease: 'back.out(1.7)' }, t0 + 0.2);
    tl.fromTo(wrap, { scale: 1 }, { scale: 1.06, duration: 0.25, yoyo: true, repeat: 1 }, t0 + 2.4); sfx(t0 + 2.4, 'ding', 0.6);
    o.lines.forEach((L, i) => { const l = line(sc, L.text, { size: L.size || 100, accent: L.accent, weight: L.weight || 800, maxW: 940, cls: L.sub ? 'sub' : '' }); tIn(l, t0 + 0.9 + i * 0.18, { kind: L.kind || 'rise' }); });
  };

  // 12. CTA LOCKUP
  SCENES.cta = (sc, o, t0, t1) => {
    col(sc, { gap: 26 });
    const mk = o.logo ? el('img', '', sc, '', { width: px(o.logoW || 520), maxHeight: px(300), objectFit: 'contain' }) : monogram(sc, 250, { borderRadius: '27%' });
    if (o.logo) mk.src = o.logo;
    const halo = el('div', '', sc, '', { position: 'absolute', left: '50%', top: '50%', width: px(900), height: px(900), marginLeft: px(-450), marginTop: px(-640), borderRadius: '50%', background: 'radial-gradient(circle,' + P.a1 + ' 0%,transparent 62%)', opacity: 0.3 });
    tl.fromTo(halo, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 0.32, duration: 1.6, ease: 'expo.out' }, t0 + 0.1);
    tl.fromTo(mk, { scale: 0, rotation: -30, y: N(60) }, { scale: 1, rotation: 0, y: 0, duration: 1.1, ease: 'back.out(1.6)' }, t0 + 0.15); sfx(t0 + 0.2, 'jingle', 0.7);
    const nm = line(sc, o.name || D.brand, { size: 140, weight: 800, maxW: 940 }); nm.style.marginTop = px(18); tIn(nm, t0 + 0.55, { kind: 'rise' });
    const tg = line(sc, o.tagline, { size: 54, weight: 500, cls: 'sub', maxW: 900 }); tIn(tg, t0 + 0.85, { kind: 'blur', stagger: 0.06 });
    const btn = el('div', 'btn', sc, (o.glyph ? svgI(o.glyph, 'width="' + N(54) + '" height="' + N(54) + '" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"') : '') + '<span>' + esc(o.button) + '</span>', { width: px(860), height: px(148), fontSize: px(50), marginTop: px(54) });
    tl.fromTo(btn, { y: N(70), opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'expo.out' }, t0 + 1.3);
    const ph = line(sc, o.contact, { size: 54, weight: 700, maxW: 900 }); ph.style.marginTop = px(34); tIn(ph, t0 + 1.7, { kind: 'blur' });
    const cur = el('div', '', sc, '<svg viewBox="0 0 24 24" width="' + N(78) + '" height="' + N(78) + '"><path d="M5 3l14 7-6 2-2 6z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>', { position: 'absolute', left: '60%', top: '70%', filter: 'drop-shadow(0 10px 8px rgba(0,0,0,.4))', opacity: 0 });
    const ct = t0 + 2.5;
    tl.fromTo(cur, { x: N(300), y: N(300), opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, ct);
    tl.to(btn, { scale: 0.95, duration: 0.1, yoyo: true, repeat: 1 }, ct + 0.9); sfx(ct + 0.9, 'click', 0.8);
    const rp = el('div', '', sc, '', { position: 'absolute', left: '50%', top: '66%', width: px(150), height: px(150), marginLeft: px(-75), borderRadius: '50%', border: px(7) + ' solid ' + P.a1, opacity: 0 });
    tl.fromTo(rp, { scale: 0.3, opacity: 0.9 }, { scale: 3.2, opacity: 0, duration: 1.0, ease: 'power2.out' }, ct + 0.95);
    sweepFx(ct + 0.9, 1);
  };

  // ================================================================ BUILD
  function build() {
    let t = 0; const L = D.scenes;
    L.forEach((o, i) => {
      const sc = el('div', 'scene', cam); const t0 = t, t1 = t + o.dur;
      (SCENES[o.type] || SCENES.hook)(sc, o, t0, t1);
      enter(sc, Math.max(0, t0 - 0.05), i === 0 ? 'fade' : (o.in || 'push'));
      if (i < L.length - 1) { leave(sc, t1 - 0.32, o.out || 'push'); sweepFx(t1 - 0.5, i % 2 ? -1 : 1); sfx(t1 - 0.3, 'whoosh', 0.45); }
      t = t1;
    });
    tl.to({}, { duration: 0.001 }, DUR - 0.001);
    window.__sfx = SFX; window.__timeline = tl;
  }
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(build);
})();
