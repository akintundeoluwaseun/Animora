/* Animora signature templates: eight structured animation recipes in the style of professional After Effects work.
   Each template is a list of beats (scene pieces made for it), its own transitions, look and sound profile.
     Type Reactor · Luxury Product · Futuristic HUD · Liquid Chrome · Sports Hype · Swiss Editorial · Visualizer · Cinematic Logo
   Every beat works at 9:16, 16:9 and 1:1, and reads d.dur so a template fills 6, 15 or 30 seconds.
   Controls: intensity (elegant | aggressive | mechanical | fluid), sound (beat | cinematic | ambient | none),
   quality (preview | premium | max). Needs pieces.js, atoms.js, pieces2.js, premium.js. */
(function () {
  'use strict';
  const P = window.PIECES, X = window.PIECE_UTILS, ACCENT = window.ATOM_ACCENT;
  const { el, sv, clamp, lerp, ez, esc, rgba, mix, on, lum, drive, show, chars, fit, natural, seeded, blurFilter } = X;
  const Q = (ctx) => ctx.quality === 'preview' ? 0.4 : ctx.quality === 'max' ? 1.6 : 1;   // how much detail (particles, blur)
  const PORT = (ctx) => ctx.H > ctx.W * 1.2;
  const D = (d, def) => Math.max(1.6, +d.dur || def);

  // ---------------------------------------------------------------- craft helpers
  // move a node from one pose to another with directional motion blur that follows its speed
  function blurMove(ctx, node, at, dur, a, b, ease = 'expo.out') {
    const e = ez(ease), f = Q(ctx) > 0.5 ? blurFilter(ctx) : null; if (f) node.style.filter = `url(#${f.id})`;
    const pose = (p) => { const q = e(p); return { x: lerp(a.x || 0, b.x || 0, q), y: lerp(a.y || 0, b.y || 0, q), s: lerp(a.s ?? 1, b.s ?? 1, q), r: lerp(a.r || 0, b.r || 0, q), o: lerp(a.o ?? 1, b.o ?? 1, Math.min(1, p * 4)) }; };
    node.style.opacity = a.o ?? 1;
    drive(ctx, at, dur, (p) => {
      const c = pose(p), n = pose(Math.min(1, p + 0.02));
      node.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${c.r}deg) scale(${c.s})`; node.style.opacity = c.o;
      if (f) { const vx = Math.abs(n.x - c.x), vy = Math.abs(n.y - c.y); f.set(Math.min(60, vx * 0.35), Math.min(60, vy * 0.35)); }
    });
    if (f) ctx.tl.set(node, { filter: 'none' }, at + dur + 0.01);
  }
  function shake(ctx, node, t, amp = 14) { const a = amp * ctx.U * (ctx.intensity === 'elegant' ? 0.4 : ctx.intensity === 'aggressive' ? 1.3 : 1); ctx.tl.fromTo(node, { x: 0 }, { keyframes: [{ x: -a, y: a * 0.5, duration: 0.035 }, { x: a * 0.8, y: -a * 0.4, duration: 0.035 }, { x: -a * 0.4, y: a * 0.2, duration: 0.035 }, { x: 0, y: 0, duration: 0.05 }], immediateRender: false }, t); }
  function flash(ctx, L, t, color = '#FFFFFF', k = 0.8) { const f = el('div', `position:absolute;inset:0;background:${color};opacity:0;pointer-events:none;z-index:30;mix-blend-mode:screen;`, L); ctx.tl.fromTo(f, { opacity: 0 }, { opacity: k, duration: 0.06, ease: 'none', immediateRender: false }, t).to(f, { opacity: 0, duration: 0.45, ease: 'power2.out' }, t + 0.06); }
  function chroma(ctx, node, t, dur = 0.5, amp = 10) { drive(ctx, t, dur, (p) => { const a = (1 - p) * amp * ctx.U; node.style.textShadow = a > 0.3 ? `${a}px 0 rgba(255,45,95,.85), ${-a}px 0 rgba(40,220,255,.85)` : ''; }); }
  function sparks(ctx, L, x, y, t, n = 40, cols, spread = 1) {
    const cv = el('canvas', `position:absolute;inset:0;width:${ctx.W}px;height:${ctx.H}px;pointer-events:none;z-index:20;`, L); cv.width = Math.round(ctx.W / 2); cv.height = Math.round(ctx.H / 2);
    const g = cv.getContext('2d'), r = seeded(Math.round(x * 7 + y * 3)), N = Math.round(n * Q(ctx));
    const ps = Array.from({ length: N }, () => ({ a: r() * Math.PI * 2, v: (300 + r() * 1100) * ctx.U * spread, s: (2 + r() * 5) * ctx.U, c: cols[Math.floor(r() * cols.length)] }));
    drive(ctx, t, 1.2, (p) => { const tt = p * 1.2; g.clearRect(0, 0, cv.width, cv.height); g.save(); g.scale(0.5, 0.5); g.globalCompositeOperation = 'lighter'; for (const q of ps) { const d = q.v * tt * Math.exp(-tt * 2.2); g.globalAlpha = clamp(1.2 - tt); g.fillStyle = q.c; g.beginPath(); g.arc(x + Math.cos(q.a) * d, y + Math.sin(q.a) * d + 200 * ctx.U * tt * tt, q.s * (1 - tt * 0.5), 0, 6.283); g.fill(); } g.restore(); });
  }
  function dust(ctx, L, t, dur, n = 40, color = '#FFFFFF') {   // floating micro-particles in depth
    const r = seeded(n * 13 + 1), N = Math.round(n * Q(ctx));
    for (let i = 0; i < N; i++) { const z = (2 + r() * 6) * ctx.U, b = el('div', `position:absolute;left:${r() * ctx.W}px;top:${r() * ctx.H}px;width:${z}px;height:${z}px;border-radius:50%;background:${color};filter:blur(${r() * 2.5 * ctx.U}px);opacity:0;pointer-events:none;`, L); ctx.tl.fromTo(b, { opacity: 0, y: 0 }, { opacity: 0.25 + r() * 0.6, y: -(40 + r() * 140) * ctx.U, x: (r() - 0.5) * 60 * ctx.U, duration: dur, ease: 'sine.inOut' }, t); }
  }
  function beams(ctx, L, t, dur, color = '#FFFFFF', alpha = 0.12) { for (let k = 0; k < 5; k++) { const b = el('div', `position:absolute;left:50%;top:-12%;width:${160 * ctx.U}px;height:${ctx.H * 1.3}px;margin-left:${-80 * ctx.U}px;background:linear-gradient(180deg, ${rgba(color, alpha)}, transparent 85%);transform-origin:50% 0;filter:blur(${10 * ctx.U}px);pointer-events:none;`, L); ctx.tl.fromTo(b, { rotation: -40 + k * 20, opacity: 0 }, { rotation: -34 + k * 20, opacity: 1, duration: dur, ease: 'sine.inOut' }, t); } }
  function fogLayer(ctx, L, t, dur, color) { [0.3, 0.75].forEach((y, i) => { const f = el('div', `position:absolute;left:-30%;width:160%;top:${y * ctx.H}px;height:${ctx.H * 0.35}px;margin-top:${-ctx.H * 0.17}px;background:radial-gradient(50% 50% at 50% 50%, ${rgba(color, 0.14)}, transparent 70%);filter:blur(${40 * ctx.U}px);pointer-events:none;`, L); ctx.tl.fromTo(f, { x: (i ? 1 : -1) * ctx.W * 0.1 }, { x: (i ? -1 : 1) * ctx.W * 0.1, duration: dur, ease: 'sine.inOut' }, t); }); }
  // break a headline into short lines so it can be set big (portrait gets shorter lines)
  function rebreak(ctx, text, maxC) {
    const words = String(text || '').replace(/\|/g, ' ').split(/\s+/).filter(Boolean), lim = maxC || (PORT(ctx) ? 11 : ctx.W > ctx.H * 1.3 ? 18 : 13), out = [];
    words.forEach((w) => { const l = out[out.length - 1]; if (l && (l + ' ' + w).length <= lim) out[out.length - 1] = l + ' ' + w; else out.push(w); });
    return out.slice(0, 4);
  }
  function word(L, text, css) { return el('div', `position:absolute;white-space:nowrap;${css}`, L, esc(text)); }
  const center = (node, ctx, y = 0.5) => { node.style.left = '0'; node.style.right = '0'; node.style.textAlign = 'center'; node.style.top = `${ctx.H * y}px`; node.style.transform = 'translateY(-50%)'; };
  const fitTo = (node, w, start, min) => fit(node, w, start, min);
  const metalGrad = (A) => `linear-gradient(175deg, #FFFFFF 0%, #C9CED6 18%, #6B7079 36%, #F4F6F8 48%, ${mix(A, '#3A3F47', 0.6)} 62%, #E9ECEF 78%, #8C929B 100%)`;

  const B = (name, label, dur, fn) => { P[name] = { family: 'signature', label, tags: { energy: 'high' }, dur, build(ctx, L, t0, d) { return fn.call(this, ctx, L, t0, d); } }; };

  // ================================================================== 1. TYPE REACTOR (kinetic typography)
  B('tr-words', 'Word slams', 3.4, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), words = String(d.text || d.headline || '').replace(/\|/g, ' ').split(/\s+/).filter(Boolean).slice(0, Math.max(2, Math.min(7, Math.floor((D(d, this.dur) - 0.6) / 0.32))));
    const step = Math.max(0.32, (dur - 0.6) / Math.max(1, words.length)), dirs = [[-1, 0], [1, 0], [0, 1], [0, -1]];
    words.forEach((w, i) => {
      const at = t0 + 0.15 + i * step, big = i === words.length - 1 || w.length > 6;
      const n = word(L, w, `font-family:${look.display};font-weight:${look.dw};letter-spacing:-.04em;color:${i % 3 === 2 ? look.A : '#FFFFFF'};${look.upper !== false ? 'text-transform:uppercase;' : ''}`);
      fitTo(n, W - 120 * U, Math.min(big ? 330 : 260, ctx.H * 0.5 / U) * U, 60 * U); n.style.left = '0'; n.style.right = '0'; n.style.textAlign = 'center'; n.style.top = `${ctx.H / 2 - n.offsetHeight / 2}px`; n.style.lineHeight = '1';
      const [dx, dy] = dirs[(i + (ctx.seed || 0)) % 4], far = (dx ? W : H) * 0.9;
      show(ctx, n, at);
      const huge = i === Math.floor(words.length / 2);   // one word blows past the frame before snapping in
      blurMove(ctx, n, at, step * 0.55, { x: dx * far, y: dy * far, s: huge ? 3.2 : 1.6, r: dx * 8, o: 1 }, { x: 0, y: 0, s: 1, r: 0, o: 1 }, huge ? 'expo.inOut' : 'expo.out');
      ctx.tl.to(n, { scale: 1.06, duration: step * 0.45, ease: 'sine.out' }, at + step * 0.55);
      if (i < words.length - 1) ctx.tl.set(n, { visibility: 'hidden' }, at + step);
      chroma(ctx, n, at + step * 0.45, 0.4, 12);
      ctx.sfx.push({ t: at + step * 0.4, k: i % 2 ? 'tick' : 'pop', v: 0.5 });
      if (huge) { shake(ctx, L, at + step * 0.55, 12); sparks(ctx, L, W / 2, H / 2, at + step * 0.55, 46, [look.A, '#FFFFFF', look.A2]); }
    });
    return t0 + dur;
  });
  B('tr-split', 'Split typography', 3.0, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), port = PORT(ctx), w = String(d.word || 'NOW').toUpperCase();
    const halves = [0, 1].map((k) => { const h = el('div', `position:absolute;${port ? `left:0;right:0;${k ? 'bottom:0' : 'top:0'};height:50%;` : `top:0;bottom:0;${k ? 'right:0' : 'left:0'};width:50%;`}overflow:hidden;background:${k ? look.A : '#08080A'};`, L); return h; });
    halves.forEach((h, k) => { const t = el('div', `position:absolute;left:0;top:50%;white-space:nowrap;font-family:${look.display};font-weight:${look.dw};font-size:${(port ? 360 : 300) * U}px;line-height:1;letter-spacing:-.05em;color:${k ? on(look.A) : look.A};transform:translateY(-50%);`, h, esc((w + '  ').repeat(4))); ctx.tl.fromTo(t, { x: k ? -t.scrollWidth * 0.3 : 0 }, { x: k ? 0 : -t.scrollWidth * 0.3, duration: dur, ease: 'power1.inOut' }, t0); });
    ctx.tl.fromTo(halves[0], port ? { yPercent: -100 } : { xPercent: -100 }, { yPercent: 0, xPercent: 0, duration: 0.5, ease: 'expo.out' }, t0);
    ctx.tl.fromTo(halves[1], port ? { yPercent: 100 } : { xPercent: 100 }, { yPercent: 0, xPercent: 0, duration: 0.5, ease: 'expo.out' }, t0 + 0.06);
    const tag = word(L, d.tag || '', `left:50%;top:50%;transform:translate(-50%,-50%);padding:${18 * U}px ${40 * U}px;background:#fff;color:#0A0A0C;font-family:${look.ui};font-weight:800;font-size:${40 * U}px;letter-spacing:.2em;text-transform:uppercase;z-index:3;`);
    ctx.tl.fromTo(tag, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'expo.inOut' }, t0 + 0.45);
    ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.6 }, { t: t0 + 0.5, k: 'tick', v: 0.5 });
    void H; return t0 + dur;
  });
  B('tr-final', 'Final lockup', 3.2, function (ctx, L, t0, d) {
    const { W, U, look } = ctx, dur = D(d, this.dur);
    const box = el('div', `position:absolute;left:${70 * U}px;right:${70 * U}px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;font-family:${look.display};font-weight:${look.dw};line-height:.95;letter-spacing:-.04em;color:#FFFFFF;${look.upper !== false ? 'text-transform:uppercase;' : ''}`, L);
    const lines = rebreak(ctx, d.headline);
    const rows = lines.map((ln, i) => { const r = el('div', `white-space:nowrap;${i === lines.length - 1 ? `color:${look.A};` : ''}`, box); chars(r, ln); return r; });
    const sz = rows.map((r) => fitTo(r, W - 140 * U, Math.min(320, ctx.H / U / (lines.length + 1.2)) * U, 50 * U)); const m = Math.min(...sz); rows.forEach((r) => { r.style.fontSize = m + 'px'; });
    const cs = [...box.querySelectorAll('.pw > span')], r = seeded(cs.length + 3);
    ctx.tl.fromTo(cs, { x: () => (r() - 0.5) * W * 1.2, y: () => (r() - 0.5) * W, rotation: () => (r() - 0.5) * 120, opacity: 0, scale: 2.2 }, { x: 0, y: 0, rotation: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'expo.inOut', stagger: { each: 0.012, from: 'random' } }, t0 + 0.1);
    const land = t0 + 1.1;
    shake(ctx, L, land, 10); flash(ctx, L, land, look.A, 0.5); chroma(ctx, box, land, 0.5, 14);
    const sweep = el('div', `position:absolute;top:-20%;bottom:-20%;left:0;width:${W * 0.3}px;background:linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);transform:skewX(-20deg);mix-blend-mode:overlay;pointer-events:none;`, L);
    ctx.tl.fromTo(sweep, { x: -W * 0.5 }, { x: W * 1.3, duration: 0.9, ease: 'power2.inOut' }, land + 0.3);
    ACCENT.auto(ctx, L, box, land + 0.05, 2);
    if (dur > 2.6) ctx.tl.to(L, { opacity: 0, duration: 0.5, ease: 'power2.in' }, t0 + dur - 0.5);
    ctx.sfx.push({ t: land, k: 'pop', v: 0.8 }, { t: land + 0.3, k: 'chime', v: 0.5 });
    return t0 + dur;
  });

  // ================================================================== 2. LUXURY PRODUCT
  function product(ctx, L, d, size) {   // the hero object: the owner's photo, or a metallic emblem when there is none
    const { U, look } = ctx, s = size;
    if (d.img) { const n = el('div', `position:absolute;width:${s}px;height:${s}px;border-radius:${d.round === false ? 36 * U : s / 2}px;background:url("${d.img}") center/cover;`, L); return n; }
    const n = el('div', `position:absolute;width:${s}px;height:${s}px;border-radius:50%;background:${metalGrad(look.A)};display:grid;place-items:center;box-shadow:inset 0 0 ${40 * U}px rgba(0,0,0,.5);`, L);
    el('div', `font-family:${look.display};font-weight:800;font-size:${s * 0.42}px;color:${mix(look.A, '#000000', 0.55)};letter-spacing:-.04em;`, n, esc(d.mono || 'A'));
    return n;
  }
  B('lux-reveal', 'Rim-light reveal', 3.6, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), s = Math.min(W, H) * 0.62;
    fogLayer(ctx, L, t0, dur, look.A2 || '#FFFFFF'); dust(ctx, L, t0, dur, 36, '#FFF4E0');
    const p = product(ctx, L, d, s); p.style.left = `${W / 2 - s / 2}px`; p.style.top = `${H * 0.46 - s / 2}px`;
    // the rim light: a bright band sweeps round the edge while the object stays mostly in shadow
    const shade = el('div', `position:absolute;left:${W / 2 - s / 2}px;top:${H * 0.46 - s / 2}px;width:${s}px;height:${s}px;border-radius:${p.style.borderRadius};pointer-events:none;`, L);
    drive(ctx, t0, dur, (q) => { const a = lerp(-120, 200, ez('sine.inOut')(q)), lit = clamp(q * 1.6); shade.style.background = `conic-gradient(from ${a}deg, rgba(0,0,0,${0.92 - lit * 0.35}) 0deg, rgba(0,0,0,${0.92 - lit * 0.35}) 220deg, rgba(255,240,215,.0) 270deg, rgba(0,0,0,${0.92 - lit * 0.35}) 330deg)`; shade.style.boxShadow = `${Math.cos(a * Math.PI / 180) * 30 * U}px ${Math.sin(a * Math.PI / 180) * 30 * U}px ${60 * U}px ${rgba(look.A, 0.35 * lit)}`; });
    ctx.tl.fromTo([p, shade], { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 1, duration: dur, ease: 'power2.out' }, t0);
    const line = word(L, d.kicker || '', `left:0;right:0;top:${H * 0.46 + s / 2 + 70 * U}px;text-align:center;font-family:${look.ui};font-weight:500;font-size:${32 * U}px;letter-spacing:.5em;text-transform:uppercase;color:${rgba('#FFFFFF', 0.7)};`);
    ctx.tl.fromTo(line, { opacity: 0, letterSpacing: `${30 * U}px` }, { opacity: 1, letterSpacing: `${16 * U}px`, duration: 1.6, ease: 'expo.out' }, t0 + dur * 0.45);
    ctx.sfx.push({ t: t0 + 0.2, k: 'whoosh', v: 0.3 });
    return t0 + dur;
  });
  B('lux-orbit', 'Orbit with 3D type', 4.0, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), s = Math.min(W, H) * 0.56, cy = H * 0.47;
    beams(ctx, L, t0, dur, '#FFF2DC', 0.1); dust(ctx, L, t0, dur, 30);
    const back = word(L, (d.brand || '').toUpperCase(), `top:${cy}px;left:0;font-family:${look.display};font-weight:${look.dw};font-size:${300 * U}px;letter-spacing:-.04em;color:${rgba(look.A, 0.85)};transform:translateY(-50%);`);
    const stage3 = el('div', `position:absolute;inset:0;perspective:${1800 * U}px;`, L);
    const p = product(ctx, stage3, d, s); p.style.left = `${W / 2 - s / 2}px`; p.style.top = `${cy - s / 2}px`; p.style.boxShadow = `0 ${50 * U}px ${100 * U}px ${-20 * U}px rgba(0,0,0,.8)`;
    const refl = product(ctx, L, d, s); refl.style.left = `${W / 2 - s / 2}px`; refl.style.top = `${cy + s / 2 + 12 * U}px`; refl.style.transform = 'scaleY(-1)'; refl.style.opacity = 0.22; refl.style.webkitMaskImage = 'linear-gradient(0deg, #000, transparent 45%)'; refl.style.maskImage = 'linear-gradient(0deg, #000, transparent 45%)';
    const front = word(L, (d.brand || '').toUpperCase(), `top:${cy}px;left:0;font-family:${look.display};font-weight:${look.dw};font-size:${300 * U}px;letter-spacing:-.04em;color:transparent;-webkit-text-stroke:${3 * U}px ${rgba('#FFFFFF', 0.85)};transform:translateY(-50%);clip-path:inset(55% 0 0 0);`);
    const bw = Math.max(back.scrollWidth, 10);
    ctx.tl.fromTo([back, front], { x: W }, { x: -bw, duration: dur, ease: 'none' }, t0);
    const glare = el('div', `position:absolute;inset:0;border-radius:inherit;background:linear-gradient(110deg, transparent 35%, rgba(255,255,255,.4) 50%, transparent 65%);mix-blend-mode:screen;`, p);
    drive(ctx, t0, dur, (q) => { const e = ez('sine.inOut')(q); p.style.transform = `rotateY(${lerp(-28, 28, e)}deg) rotateX(${8 - 6 * e}deg) scale(${lerp(0.92, 1.05, e)})`; glare.style.transform = `translateX(${lerp(-60, 60, e)}%)`; });
    ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.35 });
    return t0 + dur;
  });
  B('lux-macro', 'Macro detail', 3.0, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur);
    const ph = el('div', `position:absolute;inset:-20%;background:${d.img ? `url("${d.img}") center/cover` : metalGrad(look.A)};filter:contrast(1.08) saturate(1.1);`, L);
    ctx.tl.fromTo(ph, { scale: 1.6, x: -W * 0.08, y: H * 0.04 }, { scale: 1.9, x: W * 0.06, y: -H * 0.03, duration: dur, ease: 'sine.inOut' }, t0);
    // shallow depth of field: sharp band in the middle, blurred top and bottom
    [['top:0', 'linear-gradient(180deg, #000, transparent)'], ['bottom:0', 'linear-gradient(0deg, #000, transparent)']].forEach(([pos, m]) => { const b = el('div', `position:absolute;left:0;right:0;${pos};height:34%;backdrop-filter:blur(${14 * U}px);-webkit-backdrop-filter:blur(${14 * U}px);-webkit-mask-image:${m};mask-image:${m};`, L); void b; });
    const sweep = el('div', `position:absolute;top:-20%;bottom:-20%;width:${W * 0.35}px;left:0;background:linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent);transform:skewX(-18deg);mix-blend-mode:screen;`, L);
    ctx.tl.fromTo(sweep, { x: -W * 0.5 }, { x: W * 1.2, duration: dur * 0.7, ease: 'power2.inOut' }, t0 + dur * 0.2);
    const benefit = word(L, d.benefit || '', `left:${80 * U}px;bottom:${H * 0.12}px;font-family:${look.display};font-weight:${look.dw};font-size:${90 * U}px;letter-spacing:-.02em;color:#fff;text-shadow:0 ${4 * U}px ${30 * U}px rgba(0,0,0,.6);`);
    fitTo(benefit, W - 160 * U, 90 * U, 40 * U);
    ctx.tl.fromTo(benefit, { opacity: 0, y: 30 * U, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.0, ease: 'expo.out' }, t0 + 0.5);
    return t0 + dur;
  });
  B('lux-lockup', 'Brand lockup', 3.6, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur);
    beams(ctx, L, t0, dur, look.A, 0.14);
    const name = word(L, d.brand || '', `font-family:${look.display};font-weight:${look.dw};font-size:${240 * U}px;letter-spacing:.02em;background:${metalGrad(look.A)};background-size:100% 220%;-webkit-background-clip:text;background-clip:text;color:transparent;`);
    fitTo(name, W - 160 * U, 240 * U, 50 * U); center(name, ctx, 0.44);
    ctx.tl.fromTo(name, { opacity: 0, scale: 1.12, filter: 'blur(14px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.6, ease: 'expo.out' }, t0 + 0.2);
    ctx.tl.fromTo(name, { backgroundPosition: '0 100%' }, { backgroundPosition: '0 0%', duration: dur, ease: 'sine.inOut' }, t0);
    const line = el('div', `position:absolute;left:50%;top:${H * 0.44 + 140 * U}px;width:${420 * U}px;height:${2 * U}px;margin-left:${-210 * U}px;background:linear-gradient(90deg, transparent, ${look.A}, transparent);`, L);
    ctx.tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'expo.inOut' }, t0 + 0.8);
    const ben = word(L, d.benefit || '', `font-family:${look.ui};font-weight:500;font-size:${38 * U}px;letter-spacing:.24em;text-transform:uppercase;color:${rgba('#FFFFFF', 0.8)};`); center(ben, ctx, 0.44); ben.style.top = `${H * 0.44 + 200 * U}px`;
    ctx.tl.fromTo(ben, { opacity: 0, y: 20 * U }, { opacity: 1, y: 0, duration: 1.0, ease: 'expo.out' }, t0 + 1.1);
    if (d.cta) { const c = word(L, d.cta, `left:50%;top:${H * 0.44 + 300 * U}px;transform:translateX(-50%);padding:${22 * U}px ${48 * U}px;border:${2 * U}px solid ${rgba('#FFFFFF', 0.6)};border-radius:999px;color:#fff;font-family:${look.ui};font-weight:700;font-size:${34 * U}px;letter-spacing:.14em;text-transform:uppercase;`); ctx.tl.fromTo(c, { opacity: 0 }, { opacity: 1, duration: 0.8 }, t0 + 1.6); }
    sparks(ctx, L, W / 2, H * 0.44, t0 + 0.6, 30, [look.A, '#FFF6E0']);
    ctx.sfx.push({ t: t0 + 0.4, k: 'chime', v: 0.6 });
    return t0 + dur;
  });

  // ================================================================== 3. FUTURISTIC HUD
  const CY = '#22E3FF', VI = '#8B5CFF';
  function hudColors(ctx) { return [ctx.look.A || CY, ctx.look.A2 || VI]; }
  B('hud-boot', 'System boot', 3.6, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), [C1, C2] = hudColors(ctx), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.34;
    el('div', `position:absolute;inset:0;background-image:linear-gradient(${rgba(C1, 0.07)} 1px, transparent 1px), linear-gradient(90deg, ${rgba(C1, 0.07)} 1px, transparent 1px);background-size:${60 * U}px ${60 * U}px;`, L);
    const dot = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${14 * U}px;height:${14 * U}px;margin:${-7 * U}px;border-radius:50%;background:#fff;box-shadow:0 0 ${30 * U}px ${10 * U}px ${C1};`, L);
    ctx.tl.fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.4, ease: 'expo.out' }, t0).to(dot, { scale: 0.4, opacity: 0.6, duration: 0.4 }, t0 + 0.6);
    // a rotating wireframe (icosahedron), drawn every frame
    const cv = el('canvas', `position:absolute;inset:0;width:${W}px;height:${H}px;`, L); cv.width = Math.round(W / 2); cv.height = Math.round(H / 2); const g = cv.getContext('2d');
    const phi = (1 + Math.sqrt(5)) / 2, V = [[-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0], [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi], [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]];
    const E = []; for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) { const dd = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]); if (Math.abs(dd - 2) < 0.01) E.push([i, j]); }
    drive(ctx, t0 + 0.4, dur - 0.4, (p) => {
      const grow = ez('expo.out')(clamp(p * 2.5)), a = p * 2.4, b = p * 1.3, sc = R * 0.42 * grow;
      g.clearRect(0, 0, cv.width, cv.height); g.save(); g.scale(0.5, 0.5); g.lineWidth = 2.2 * U; g.strokeStyle = rgba(C1, 0.9); g.shadowColor = C1; g.shadowBlur = 14 * U;
      const pr = V.map(([x, y, z]) => { const x1 = x * Math.cos(a) - z * Math.sin(a), z1 = x * Math.sin(a) + z * Math.cos(a), y1 = y * Math.cos(b) - z1 * Math.sin(b), z2 = y * Math.sin(b) + z1 * Math.cos(b), k = 3.2 / (3.2 + z2 * 0.5); return [cx + x1 * sc * k, cy + y1 * sc * k]; });
      g.beginPath(); E.forEach(([i, j]) => { g.moveTo(pr[i][0], pr[i][1]); g.lineTo(pr[j][0], pr[j][1]); }); g.stroke();
      g.fillStyle = '#fff'; pr.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3 * U, 0, 6.283); g.fill(); }); g.restore();
    });
    // interface rings with ticks, each turning its own way
    const s = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;' }, L);
    [[R * 0.78, C1, 2, '4 10', 1], [R * 0.95, C2, 3, `${60 * U} ${30 * U}`, -1], [R * 1.12, C1, 1.5, '2 6', 1]].forEach(([r, c, w, dash, dir], i) => {
      const ring = sv('circle', { cx, cy, r, fill: 'none', stroke: c, 'stroke-width': w * U, 'stroke-dasharray': dash, opacity: 0.85 }, s); ring.style.transformOrigin = `${cx}px ${cy}px`;
      ctx.tl.fromTo(ring, { scale: 0.3, opacity: 0, rotation: 0 }, { scale: 1, opacity: 0.85, duration: 0.8, ease: 'expo.out' }, t0 + 0.5 + i * 0.12).to(ring, { rotation: dir * 120, duration: dur, ease: 'none' }, t0 + 0.5);
    });
    const arc = sv('circle', { cx, cy, r: R * 1.25, fill: 'none', stroke: C1, 'stroke-width': 6 * U, 'stroke-linecap': 'round', transform: `rotate(-90 ${cx} ${cy})` }, s); const len = 2 * Math.PI * R * 1.25; arc.style.strokeDasharray = len; arc.style.strokeDashoffset = len;
    ctx.tl.to(arc.style, { strokeDashoffset: len * 0.28, duration: dur - 0.8, ease: 'power2.inOut' }, t0 + 0.6);
    // data fragments
    const r = seeded(9); for (let i = 0; i < Math.round(8 * Q(ctx)); i++) { const x = r() < 0.5 ? cx - R * (1.35 + r() * 0.3) : cx + R * (1.2 + r() * 0.2), y = cy + (r() - 0.5) * R * 2.2; const f = el('div', `position:absolute;left:${x}px;top:${y}px;font-family:'Space Grotesk', ui-monospace, monospace;font-size:${22 * U}px;color:${rgba(C1, 0.85)};letter-spacing:.1em;white-space:nowrap;`, L); const n0 = Math.floor(r() * 9000); drive(ctx, t0 + 0.8 + i * 0.1, dur - 1, (p) => { f.textContent = `${(n0 + Math.floor(p * 777)).toString(16).toUpperCase()} · ${(p * 100).toFixed(1)}%`; }); ctx.tl.fromTo(f, { opacity: 0 }, { opacity: 1, duration: 0.2 }, t0 + 0.8 + i * 0.1); }
    ctx.sfx.push({ t: t0, k: 'tick', v: 0.5 }, { t: t0 + 0.5, k: 'whoosh', v: 0.4 });
    void look; return t0 + dur;
  });
  B('hud-panels', 'Interface panels', 3.8, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), [C1, C2] = hudColors(ctx), port = PORT(ctx);
    el('div', `position:absolute;inset:0;background:repeating-linear-gradient(0deg, ${rgba(C1, 0.04)} 0 ${2 * U}px, transparent ${2 * U}px ${6 * U}px);`, L);
    const sq = !port && H > W * 0.8;
    const pw = port ? W * 0.82 : sq ? W * 0.43 : W * 0.34, ph = port ? H * 0.17 : sq ? H * 0.38 : H * 0.42;
    const spots = port ? [[0.09, 0.1], [0.09, 0.53], [0.09, 0.73]] : sq ? [[0.05, 0.08], [0.52, 0.08], [0.52, 0.54]] : [[0.05, 0.12], [0.61, 0.12], [0.61, 0.6]];
    const hts = port ? [H * 0.38, ph, ph] : sq ? [H * 0.84, ph, ph] : [H * 0.76, ph, ph];
    const mk = (i) => { const [x, y] = spots[i]; const p = el('div', `position:absolute;left:${W * x}px;top:${H * y}px;width:${pw}px;height:${hts[i]}px;border:${2 * U}px solid ${rgba(i % 2 ? C2 : C1, 0.7)};background:${rgba('#06121A', 0.6)};clip-path:polygon(0 0, 92% 0, 100% 18%, 100% 100%, 8% 100%, 0 82%);padding:${22 * U}px;overflow:hidden;`, L); return p; };
    const p0 = mk(0), p1 = mk(1), p2 = mk(2);
    // waveform
    const wv = el('canvas', `width:100%;height:100%;`, p1); wv.width = 400; wv.height = 120; const g = wv.getContext('2d');
    drive(ctx, t0, dur, (q) => { g.clearRect(0, 0, 400, 120); g.strokeStyle = C2; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= 400; x += 4) { const y = 60 + Math.sin(x * 0.05 + q * 30) * 28 * Math.sin(x * 0.012 + q * 4) + Math.sin(x * 0.21 + q * 50) * 6; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
    // radial progress + figures
    const s = sv('svg', { width: 120, height: 120, viewBox: '0 0 120 120', style: `width:${Math.min(ph, pw) * 0.7}px;height:${Math.min(ph, pw) * 0.7}px;float:left;` }, p2);
    sv('circle', { cx: 60, cy: 60, r: 48, fill: 'none', stroke: rgba(C1, 0.2), 'stroke-width': 10 }, s); const arc = sv('circle', { cx: 60, cy: 60, r: 48, fill: 'none', stroke: C1, 'stroke-width': 10, 'stroke-linecap': 'round', transform: 'rotate(-90 60 60)' }, s); const len = 2 * Math.PI * 48; arc.style.strokeDasharray = len; arc.style.strokeDashoffset = len; ctx.tl.to(arc.style, { strokeDashoffset: len * 0.14, duration: 1.6, ease: 'power3.out' }, t0 + 0.6);
    const pct = el('div', `font-family:'Space Grotesk', ui-monospace, monospace;font-weight:700;font-size:${Math.min(ph, pw) * 0.32}px;color:#fff;margin-left:${Math.min(ph, pw) * 0.8}px;line-height:1.1;`, p2); drive(ctx, t0 + 0.6, 1.6, (q) => { pct.textContent = `${Math.round(q * 86)}%`; }, 'power3.out');
    el('div', `font-family:'Space Grotesk', ui-monospace, monospace;font-size:${22 * U}px;letter-spacing:.2em;color:${rgba(C1, 0.85)};margin-left:${Math.min(ph, pw) * 0.8}px;`, p2, esc(d.metric || 'SYSTEM READY'));
    // headline, typed in the big panel
    const ht = el('div', `font-family:${look.display};font-weight:${look.dw};font-size:${(port ? 112 : 84) * U}px;line-height:1.05;color:#fff;letter-spacing:-.01em;`, p0);
    const txt = String(d.headline || '').replace(/\|/g, ' '), tagEl = el('div', `margin-top:${12 * U}px;font-family:'Space Grotesk', ui-monospace, monospace;font-size:${22 * U}px;letter-spacing:.3em;color:${C1};`, p0, esc((d.tag || '').toUpperCase()));
    const bars = el('div', `position:absolute;left:${22 * U}px;right:${22 * U}px;bottom:${22 * U}px;display:flex;flex-direction:column;gap:${10 * U}px;`, p0);
    [0.82, 0.64, 0.91, 0.47].forEach((v, i) => { const row = el('div', `height:${10 * U}px;background:${rgba(C1, 0.14)};position:relative;`, bars); const f = el('div', `position:absolute;inset:0;background:linear-gradient(90deg, ${C1}, ${C2});transform-origin:0 50%;`, row); ctx.tl.fromTo(f, { scaleX: 0 }, { scaleX: v, duration: 1.2, ease: 'expo.out' }, t0 + 0.7 + i * 0.1); });
    drive(ctx, t0 + 0.4, Math.min(1.6, txt.length * 0.05), (q) => { ht.textContent = txt.slice(0, Math.round(q * txt.length)) + (q < 1 ? '▌' : ''); });
    [p0, p1, p2].forEach((p, i) => { ctx.tl.fromTo(p, { clipPath: 'polygon(0 0, 0 0, 0 0, 0 100%, 0 100%, 0 82%)', opacity: 0, x: (i % 2 ? 1 : -1) * 60 * U }, { clipPath: 'polygon(0 0, 92% 0, 100% 18%, 100% 100%, 8% 100%, 0 82%)', opacity: 1, x: 0, duration: 0.7, ease: 'expo.out' }, t0 + i * 0.15); ctx.tl.to(p, { y: (i - 1) * -20 * U, duration: dur, ease: 'sine.inOut' }, t0); ctx.sfx.push({ t: t0 + i * 0.15, k: 'tick', v: 0.45 }); });
    void tagEl; return t0 + dur;
  });
  B('hud-emblem', 'Emblem assembly', 3.6, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), [C1, C2] = hudColors(ctx), cx = W / 2, cy = H * 0.45, R = Math.min(W, H) * 0.24;
    const s = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;overflow:visible;' }, L);
    const hex = (r) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`; }).join(' ');
    [R * 1.3, R, R * 0.82].forEach((r, i) => { const h = sv('polygon', { points: hex(r), fill: i === 2 ? rgba(C1, 0.08) : 'none', stroke: i === 1 ? C2 : C1, 'stroke-width': (i === 1 ? 5 : 2) * U }, s); const len = 6 * r; h.style.strokeDasharray = len; h.style.strokeDashoffset = len; ctx.tl.to(h.style, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, t0 + i * 0.15); });
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const ln = sv('line', { x1: cx + Math.cos(a) * R * 1.35, y1: cy + Math.sin(a) * R * 1.35, x2: cx + Math.cos(a) * R * 1.75, y2: cy + Math.sin(a) * R * 1.75, stroke: C1, 'stroke-width': 3 * U }, s); ctx.tl.fromTo(ln, { opacity: 0 }, { opacity: 1, duration: 0.2, repeat: 2, yoyo: true }, t0 + 0.8 + i * 0.05); }
    const mono = el('div', `position:absolute;left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);font-family:${look.display};font-weight:800;font-size:${R * 0.9}px;color:#fff;text-shadow:0 0 ${20 * U}px ${C1}, 0 0 ${50 * U}px ${C1};`, L, d.logo ? `<img src="${d.logo}" style="width:${R * 1.1}px;height:${R * 1.1}px;object-fit:contain">` : esc(d.mono || 'A'));
    ctx.tl.fromTo(mono, { opacity: 0, scale: 1.6, filter: 'blur(16px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out' }, t0 + 0.9);
    const pulse = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${R * 2.4}px;height:${R * 2.4}px;margin:${-R * 1.2}px;border-radius:50%;border:${3 * U}px solid ${C1};`, L);
    ctx.tl.fromTo(pulse, { scale: 0.5, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 1.2, ease: 'expo.out', repeat: 1 }, t0 + 1.2);
    const name = word(L, (d.brand || '').toUpperCase(), `font-family:${look.display};font-weight:${look.dw};font-size:${90 * U}px;letter-spacing:.24em;color:#fff;`); fitTo(name, W - 160 * U, 90 * U, 30 * U); center(name, ctx, cy / H); name.style.top = `${cy + R * 1.95}px`;
    ctx.tl.fromTo(name, { opacity: 0, letterSpacing: `${60 * U}px` }, { opacity: 1, letterSpacing: `${22 * U}px`, duration: 1.2, ease: 'expo.out' }, t0 + 1.3);
    chroma(ctx, name, t0 + 1.3, 0.6, 10);
    ctx.sfx.push({ t: t0 + 0.9, k: 'chime', v: 0.6 });
    return t0 + dur;
  });

  // ================================================================== 4. LIQUID CHROME
  function chromeDefs(ctx, s, id) {
    const df = sv('defs', {}, s);
    const lg = sv('linearGradient', { id: id + 'g', x1: '0', y1: '0', x2: '0.2', y2: '1' }, df);
    [['0', '#FFFFFF'], ['0.18', '#BFC5CE'], ['0.38', '#4D535C'], ['0.5', '#F5F7FA'], ['0.66', mix(ctx.look.A, '#2E3238', 0.65)], ['0.82', '#D9DDE2'], ['1', '#6C727B']].forEach(([o, c]) => sv('stop', { offset: o, 'stop-color': c }, lg));
    const f = sv('filter', { id: id + 'goo', x: '-50%', y: '-50%', width: '200%', height: '200%' }, df);
    sv('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 22 * ctx.U, result: 'b' }, f); sv('feColorMatrix', { in: 'b', mode: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -12', result: 'g' }, f); sv('feComposite', { in: 'SourceGraphic', in2: 'g', operator: 'atop' }, f);
    return lg;
  }
  B('chrome-emerge', 'Chrome emergence', 3.8, function (ctx, L, t0, d) {
    const { W, H, U } = ctx, dur = D(d, this.dur), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.2;
    const s = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;' }, L); chromeDefs(ctx, s, 'ce');
    const gr = sv('g', { filter: 'url(#cegoo)' }, s);
    const blobs = Array.from({ length: 6 }, (_, i) => sv('circle', { cx, cy, r: R * (i ? 0.45 + (i % 3) * 0.12 : 1), fill: 'url(#ceg)' }, gr));
    drive(ctx, t0, dur, (p) => { const e = ez('expo.out')(clamp(p * 1.6)); blobs.forEach((b, i) => { if (!i) { b.setAttribute('r', R * e * (1 + 0.06 * Math.sin(p * 9))); return; } const a = p * (2 + i * 0.4) + i * 1.3, rr = R * (1.1 + 0.4 * Math.sin(p * 3 + i)) * e; b.setAttribute('cx', cx + Math.cos(a) * rr); b.setAttribute('cy', cy + Math.sin(a * 1.3) * rr * 0.8); }); });
    // studio strip lights sliding across the metal
    const strips = el('div', `position:absolute;inset:0;background:repeating-linear-gradient(100deg, transparent 0 ${180 * U}px, rgba(255,255,255,.22) ${200 * U}px, transparent ${240 * U}px);mix-blend-mode:overlay;pointer-events:none;-webkit-mask-image:radial-gradient(circle at 50% 50%, #000 ${R * 1.6}px, transparent ${R * 2.2}px);mask-image:radial-gradient(circle at 50% 50%, #000 ${R * 1.6}px, transparent ${R * 2.2}px);`, L);
    ctx.tl.fromTo(strips, { backgroundPosition: '0 0' }, { backgroundPosition: `${600 * U}px 0`, duration: dur, ease: 'none' }, t0);
    ctx.tl.fromTo(s, { scale: 0.7, opacity: 0, filter: 'brightness(0.2)' }, { scale: 1, opacity: 1, filter: 'brightness(1)', duration: 1.8, ease: 'expo.out' }, t0);
    ctx.sfx.push({ t: t0 + 0.2, k: 'whoosh', v: 0.35 });
    return t0 + dur;
  });
  B('chrome-ribbons', 'Chrome ribbons', 3.6, function (ctx, L, t0, d) {
    const { W, H, U } = ctx, dur = D(d, this.dur);
    const s = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;' }, L); chromeDefs(ctx, s, 'cr');
    const paths = [0, 1, 2].map((i) => { const p = sv('path', { fill: 'none', stroke: 'url(#crg)', 'stroke-linecap': 'round' }, s); p.style.strokeWidth = `${(70 - i * 18) * U}px`; return p; });
    drive(ctx, t0, dur, (q) => paths.forEach((p, i) => { const ph = q * 5 + i * 2, y0 = H * (0.3 + i * 0.2); p.setAttribute('d', `M${-W * 0.2} ${y0 + Math.sin(ph) * 120 * U} C ${W * 0.3} ${y0 - 260 * U * Math.cos(ph * 0.7)}, ${W * 0.6} ${y0 + 260 * U * Math.sin(ph * 0.9)}, ${W * 1.2} ${y0 + Math.cos(ph) * 120 * U}`); }));
    paths.forEach((p, i) => { const len = W * 2.2; p.style.strokeDasharray = len; ctx.tl.fromTo(p.style, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, ease: 'expo.inOut' }, t0 + i * 0.12); });
    const rings = [0, 1].map((i) => { const r = sv('ellipse', { cx: W * (i ? 0.72 : 0.28), cy: H * (i ? 0.72 : 0.26), rx: 120 * U, ry: 46 * U, fill: 'none', stroke: 'url(#crg)' }, s); r.style.strokeWidth = `${22 * U}px`; r.style.transformOrigin = `${W * (i ? 0.72 : 0.28)}px ${H * (i ? 0.72 : 0.26)}px`; ctx.tl.fromTo(r, { scale: 0, rotation: -30 }, { scale: 1, rotation: 25, duration: dur, ease: 'expo.out' }, t0 + 0.4 + i * 0.2); return r; });
    void rings; ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.35 });
    return t0 + dur;
  });
  B('chrome-type', 'Chrome typography', 3.8, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur);
    const t = word(L, d.headline || d.brand || '', `font-family:${look.display};font-weight:${Math.max(700, look.dw)};font-size:${260 * U}px;letter-spacing:-.03em;line-height:1;background:${metalGrad(look.A)};background-size:100% 260%;-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 ${14 * U}px ${24 * U}px rgba(0,0,0,.6));`);
    fitTo(t, W - 140 * U, 260 * U, 50 * U); center(t, ctx, 0.48);
    ctx.tl.fromTo(t, { scaleY: 2.4, scaleX: 0.5, opacity: 0, filter: 'blur(16px)' }, { scaleY: 1, scaleX: 1, opacity: 1, filter: 'blur(0px)', duration: 1.4, ease: 'elastic.out(1, .55)' }, t0 + 0.2);
    ctx.tl.fromTo(t, { backgroundPosition: '0 100%' }, { backgroundPosition: '0 0%', duration: dur, ease: 'sine.inOut' }, t0);
    const glint = el('div', `position:absolute;left:50%;top:${H * 0.44}px;width:${40 * U}px;height:${40 * U}px;margin:${-20 * U}px;background:#fff;clip-path:polygon(50% 0, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0 50%, 42% 42%);filter:drop-shadow(0 0 ${12 * U}px #fff);`, L);
    ctx.tl.fromTo(glint, { scale: 0, rotation: 0, x: -W * 0.25 }, { scale: 1.4, rotation: 90, x: W * 0.18, duration: 0.6, ease: 'power2.out' }, t0 + 1.4).to(glint, { scale: 0, duration: 0.3 }, t0 + 2.0);
    if (d.sub) { const s2 = word(L, d.sub, `font-family:${look.ui};font-weight:500;font-size:${36 * U}px;letter-spacing:.3em;text-transform:uppercase;color:${look.A};`); center(s2, ctx, 0.48); s2.style.top = `${H * 0.48 + 170 * U}px`; ctx.tl.fromTo(s2, { opacity: 0 }, { opacity: 1, duration: 1 }, t0 + 1.4); }
    ctx.sfx.push({ t: t0 + 0.4, k: 'whoosh', v: 0.35 }, { t: t0 + 1.4, k: 'chime', v: 0.5 });
    return t0 + dur;
  });

  // ================================================================== 5. SPORTS HYPE
  B('sport-cuts', 'Detail cuts', 2.8, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), crops = [[0.3, 0.25, 2.4, -6], [0.7, 0.6, 2.8, 5], [0.5, 0.4, 2.0, -3], [0.4, 0.75, 3.0, 4], [0.6, 0.3, 2.2, -5]], n = Math.max(3, Math.min(5, Math.round(dur / 0.55))), step = dur / n;
    for (let i = 0; i < n; i++) {
      const [fx, fy, z, r] = crops[i % crops.length], at = t0 + i * step;
      const ph = el('div', `position:absolute;inset:0;background:${d.img ? `url("${d.img}") ${fx * 100}% ${fy * 100}%/cover` : `linear-gradient(135deg, ${look.A}, #000)`};filter:contrast(1.25) saturate(1.3);`, L); show(ctx, ph, at); if (i < n - 1) ctx.tl.set(ph, { visibility: 'hidden' }, at + step);
      // speed ramp: rushes in, then nearly freezes
      ctx.tl.fromTo(ph, { scale: z * 1.4, rotation: r * 2 }, { scale: z, rotation: r, duration: step * 0.35, ease: 'power4.out' }, at).to(ph, { scale: z * 1.04, duration: step * 0.65, ease: 'none' }, at + step * 0.35);
      const tone = el('div', `position:absolute;inset:0;background-image:radial-gradient(rgba(0,0,0,.35) ${3 * U}px, transparent ${3.5 * U}px);background-size:${12 * U}px ${12 * U}px;mix-blend-mode:multiply;`, L); show(ctx, tone, at); if (i < n - 1) ctx.tl.set(tone, { visibility: 'hidden' }, at + step);
      flash(ctx, L, at, i % 2 ? look.A : '#FFFFFF', 0.35);
      ctx.sfx.push({ t: at, k: 'tick', v: 0.5 });
    }
    const streak = el('div', `position:absolute;left:-20%;right:-20%;top:${H * 0.55}px;height:${26 * U}px;background:linear-gradient(90deg, transparent, ${look.A}, #fff, ${look.A}, transparent);transform:rotate(-14deg);filter:blur(${3 * U}px);mix-blend-mode:screen;`, L);
    ctx.tl.fromTo(streak, { x: -W * 1.2 }, { x: W * 1.2, duration: 0.5, ease: 'power2.in', repeat: Math.max(0, Math.floor(dur / 1.2) - 1), repeatDelay: 0.7 }, t0 + 0.2);
    return t0 + dur;
  });
  B('sport-impact', 'Headline impact', 2.8, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur);
    if (d.img) { const ph = el('div', `position:absolute;inset:0;background:url("${d.img}") center/cover;filter:grayscale(1) contrast(1.4) brightness(.45);`, L); ctx.tl.fromTo(ph, { scale: 1.15 }, { scale: 1.25, duration: dur, ease: 'none' }, t0); }
    for (let i = 0; i < Math.round(14 * Q(ctx)); i++) { const ln = el('div', `position:absolute;left:50%;top:50%;width:${W}px;height:${(4 + (i % 3) * 4) * U}px;background:linear-gradient(90deg, transparent, ${i % 4 ? 'rgba(255,255,255,.6)' : look.A});transform-origin:0 50%;transform:rotate(${i * 360 / 14}deg);`, L); ctx.tl.fromTo(ln, { scaleX: 0, opacity: 1 }, { scaleX: 1, opacity: 0, duration: 0.6, ease: 'expo.out' }, t0 + 0.32); }
    const lines = rebreak(ctx, d.headline);
    const box = el('div', `position:absolute;left:${60 * U}px;right:${60 * U}px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:center;transform:skewX(-8deg);text-align:center;font-family:${look.display};font-weight:${look.dw};font-style:italic;line-height:.88;letter-spacing:-.03em;color:#fff;text-transform:uppercase;`, L);
    const rows = lines.map((ln, i) => el('div', `white-space:nowrap;${i === lines.length - 1 ? `color:${look.A};` : ''}`, box, esc(ln))); const sz = rows.map((r) => fitTo(r, W - 140 * U, Math.min(330, ctx.H / U / (lines.length + 1.5)) * U, 50 * U)); rows.forEach((r) => { r.style.fontSize = Math.min(...sz) + 'px'; });
    rows.forEach((r, i) => { ctx.tl.fromTo(r, { scale: 3, opacity: 0, x: (i % 2 ? 1 : -1) * W * 0.3 }, { scale: 1, opacity: 1, x: 0, duration: 0.3, ease: 'power4.in' }, t0 + i * 0.12); });
    const land = t0 + 0.3 + (rows.length - 1) * 0.12;
    shake(ctx, L, land, 16); chroma(ctx, box, land, 0.5, 16); sparks(ctx, L, W / 2, H / 2, land, 60, [look.A, '#FFFFFF', look.A2]);
    if (d.sub) { const s = el('div', `margin-top:${36 * U}px;white-space:nowrap;font-style:normal;font-family:${look.ui};font-weight:800;font-size:${36 * U}px;letter-spacing:.24em;color:#fff;`, box, esc(d.sub.toUpperCase())); ctx.tl.fromTo(s, { opacity: 0, x: -60 * U }, { opacity: 1, x: 0, duration: 0.25, ease: 'power4.out' }, land + 0.2); }
    ctx.sfx.push({ t: land, k: 'pop', v: 0.8 });
    return t0 + dur;
  });
  B('sport-freeze', 'Freeze frame', 3.0, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), port = PORT(ctx);
    const card = el('div', `position:absolute;left:${W * 0.08}px;top:${H * (port ? 0.1 : 0.08)}px;width:${W * 0.84}px;height:${H * (port ? 0.56 : 0.6)}px;background:${d.img ? `url("${d.img}") center/cover` : look.A};border:${10 * U}px solid #fff;transform:rotate(-3deg);box-shadow:0 ${30 * U}px ${80 * U}px rgba(0,0,0,.6);filter:contrast(1.2) saturate(1.25);`, L);
    ctx.tl.fromTo(card, { scale: 1.3, rotation: 6, filter: 'contrast(1.2) saturate(1.25) blur(10px)' }, { scale: 1, rotation: -3, filter: 'contrast(1.2) saturate(1.25) blur(0px)', duration: 0.25, ease: 'power4.out' }, t0);
    flash(ctx, L, t0 + 0.2, '#FFFFFF', 0.9); shake(ctx, L, t0 + 0.25, 10);
    el('div', `position:absolute;inset:0;background-image:radial-gradient(${rgba(look.A, 0.5)} ${4 * U}px, transparent ${5 * U}px);background-size:${18 * U}px ${18 * U}px;-webkit-mask-image:linear-gradient(0deg, #000, transparent 45%);mask-image:linear-gradient(0deg, #000, transparent 45%);`, L);
    const t = word(L, (d.headline || '').replace(/\|/g, ' ').toUpperCase(), `left:${W * 0.06}px;top:${H * (port ? 0.7 : 0.72)}px;font-family:${look.display};font-weight:${look.dw};font-style:italic;font-size:${150 * U}px;line-height:.9;color:#fff;background:${look.A};padding:${8 * U}px ${26 * U}px;transform:skewX(-8deg);`); fitTo(t, W * 0.86, 150 * U, 40 * U);
    ctx.tl.fromTo(t, { x: -W }, { x: 0, duration: 0.35, ease: 'power4.out' }, t0 + 0.35);
    if (d.sub) { const s = word(L, d.sub.toUpperCase(), `left:${W * 0.08}px;top:${H * (port ? 0.7 : 0.72) + t.offsetHeight + 24 * U}px;font-family:${look.ui};font-weight:800;font-size:${34 * U}px;letter-spacing:.2em;color:#fff;`); ctx.tl.fromTo(s, { opacity: 0, x: -40 * U }, { opacity: 1, x: 0, duration: 0.3, ease: 'power4.out' }, t0 + 0.55); }
    ctx.sfx.push({ t: t0 + 0.2, k: 'click', v: 0.7 }, { t: t0 + 0.35, k: 'whoosh', v: 0.5 });
    return t0 + dur;
  });

  // ================================================================== 6. SWISS EDITORIAL
  const SW_BG = '#EDEAE3', SW_INK = '#121212';
  B('swiss-grid', 'Grid title', 3.6, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), port = PORT(ctx), m = 60 * U, cols = port ? 6 : 12;
    el('div', `position:absolute;inset:0;background:${SW_BG};`, L);
    const s = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;' }, L);
    for (let i = 0; i <= cols; i++) { const x = m + i * (W - 2 * m) / cols; const ln = sv('line', { x1: x, y1: m, x2: x, y2: H - m, stroke: rgba(SW_INK, 0.12), 'stroke-width': 1.5 * U }, s); ln.style.strokeDasharray = H; ln.style.strokeDashoffset = H; ctx.tl.to(ln.style, { strokeDashoffset: 0, duration: 1.0, ease: 'expo.inOut' }, t0 + i * 0.03); }
    const block = el('div', `position:absolute;left:${m}px;top:${H * (port ? 0.18 : 0.14)}px;width:${(W - 2 * m) / cols * (port ? 2 : 3)}px;height:${H * 0.18}px;background:${look.A};transform-origin:0 0;`, L);
    ctx.tl.fromTo(block, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'expo.inOut' }, t0 + 0.5);
    const lines = rebreak(ctx, d.headline, port ? 9 : 14);
    const head = el('div', `position:absolute;left:${m}px;right:${m}px;top:${H * (port ? 0.42 : 0.4)}px;font-family:${look.display};font-weight:${look.dw};line-height:.9;letter-spacing:-.045em;color:${SW_INK};`, L);
    const rows = lines.map((ln, i) => { const r = el('div', `white-space:nowrap;overflow:hidden;${i % 2 ? `padding-left:${(W - 2 * m) / cols}px;` : ''}`, head); el('div', 'display:inline-block;', r, esc(ln)); return r; });
    const sz = rows.map((r) => fitTo(r, W - 2 * m - (W - 2 * m) / cols, Math.min(port ? 260 : 220, ctx.H * 0.45 / U / lines.length) * U, 50 * U)); rows.forEach((r) => { r.style.fontSize = Math.min(...sz) + 'px'; });
    rows.forEach((r, i) => { ctx.tl.fromTo(r, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'expo.inOut' }, t0 + 0.8 + i * 0.18); ctx.tl.fromTo(r.firstChild, { x: -120 * U }, { x: 0, duration: 1.1, ease: 'expo.out' }, t0 + 0.8 + i * 0.18); });
    const meta = [d.kicker || '', d.date || '', d.place || ''].filter(Boolean);
    meta.forEach((t, i) => { const n = el('div', `position:absolute;left:${m + i * (W - 2 * m) / (port ? 2 : 3)}px;top:${H - m - 90 * U}px;font-family:${look.ui};font-weight:600;font-size:${26 * U}px;line-height:1.3;letter-spacing:.04em;color:${SW_INK};text-transform:uppercase;max-width:${(W - 2 * m) / (port ? 2 : 3) - 20 * U}px;`, L, `<span style="opacity:.45">${String(i + 1).padStart(2, '0')}</span><br>${esc(t)}`); ctx.tl.fromTo(n, { opacity: 0, y: 20 * U }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }, t0 + 1.5 + i * 0.1); });
    ctx.sfx.push({ t: t0 + 0.5, k: 'tick', v: 0.4 }, { t: t0 + 0.9, k: 'whoosh', v: 0.3 });
    return t0 + dur;
  });
  B('swiss-photo', 'Masked photo', 3.6, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), port = PORT(ctx), m = 60 * U;
    el('div', `position:absolute;inset:0;background:${SW_BG};`, L);
    const cells = port ? [[0, 0.08, 0.66, 0.38], [0.34, 0.48, 0.66, 0.24], [0, 0.48, 0.32, 0.24]] : [[0, 0.08, 0.48, 0.6], [0.5, 0.08, 0.24, 0.28], [0.76, 0.4, 0.24, 0.28]];
    cells.forEach(([x, y, w, h], i) => { const c = el('div', `position:absolute;left:${m + x * (W - 2 * m)}px;top:${H * y}px;width:${w * (W - 2 * m)}px;height:${H * h}px;overflow:hidden;background:${i === 2 ? look.A : '#000'};`, L); if (i < 2 && d.img) { const im = el('div', `position:absolute;inset:-10%;background:url("${d.img}") ${i ? '70% 30%' : 'center'}/cover;filter:${i ? 'grayscale(1) contrast(1.2)' : 'none'};`, c); ctx.tl.fromTo(im, { scale: 1.3 }, { scale: 1.05, duration: dur, ease: 'power2.out' }, t0); } ctx.tl.fromTo(c, { clipPath: i % 2 ? 'inset(0 0 100% 0)' : 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0% 0)', duration: 0.9, ease: 'expo.inOut' }, t0 + i * 0.2); });
    const big = word(L, (d.word || 'NEW').toUpperCase(), `left:${m}px;top:${H * (port ? 0.76 : 0.72)}px;font-family:${look.display};font-weight:${look.dw};font-size:${300 * U}px;line-height:.82;letter-spacing:-.06em;color:${SW_INK};`); fitTo(big, W - 2 * m, 300 * U, 60 * U);
    ctx.tl.fromTo(big, { x: W * 0.3, opacity: 0 }, { x: 0, opacity: 1, duration: 1.2, ease: 'expo.out' }, t0 + 0.6);
    ctx.tl.to(big, { x: -(W - 2 * m) / 12, duration: 0.6, ease: 'expo.inOut' }, t0 + dur * 0.65);
    ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.3 });
    return t0 + dur;
  });
  B('swiss-poster', 'Poster lockup', 3.8, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), port = PORT(ctx), m = 60 * U;
    el('div', `position:absolute;inset:0;background:${SW_BG};`, L);
    const circle = el('div', `position:absolute;right:${-W * 0.12}px;top:${H * 0.06}px;width:${Math.min(W, H) * 0.7}px;height:${Math.min(W, H) * 0.7}px;border-radius:50%;background:${look.A};`, L);
    ctx.tl.fromTo(circle, { scale: 0 }, { scale: 1, duration: 1.0, ease: 'expo.out' }, t0);
    const name = word(L, (d.brand || '').toUpperCase(), `left:${m}px;top:${H * (port ? 0.5 : 0.42)}px;font-family:${look.display};font-weight:${look.dw};font-size:${260 * U}px;line-height:.85;letter-spacing:-.06em;color:${SW_INK};`); fitTo(name, W - 2 * m, 260 * U, 50 * U);
    ctx.tl.fromTo(name, { clipPath: 'inset(100% 0 0 0)', y: 60 * U }, { clipPath: 'inset(0% 0 0 0)', y: 0, duration: 1.0, ease: 'expo.out' }, t0 + 0.3);
    const rule = el('div', `position:absolute;left:${m}px;right:${m}px;top:${H * (port ? 0.5 : 0.42) + name.offsetHeight + 30 * U}px;height:${4 * U}px;background:${SW_INK};transform-origin:0 50%;`, L); ctx.tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'expo.inOut' }, t0 + 0.7);
    const cols = [d.line || '', d.cta || '', d.contact || ''].filter(Boolean);
    cols.forEach((t, i) => { const n = el('div', `position:absolute;left:${m + i * (W - 2 * m) / cols.length}px;top:${H * (port ? 0.5 : 0.42) + name.offsetHeight + 60 * U}px;width:${(W - 2 * m) / cols.length - 24 * U}px;font-family:${look.ui};font-weight:${i ? 700 : 500};font-size:${30 * U}px;line-height:1.3;color:${SW_INK};`, L, esc(t)); ctx.tl.fromTo(n, { opacity: 0, y: 16 * U }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }, t0 + 1.0 + i * 0.12); });
    ctx.sfx.push({ t: t0 + 0.3, k: 'tick', v: 0.4 }, { t: t0 + 1.0, k: 'chime', v: 0.35 });
    return t0 + dur;
  });

  // ================================================================== 7. VISUALIZER (keyframed to an explicit beat timeline)
  const env = (t, bpm) => { const b = 60 / bpm, ph = (t % b) / b, beatN = Math.floor(t / b); const kick = Math.exp(-ph * 7), off = Math.exp(-(((t + b / 2) % b) / b) * 9) * 0.5; return { bass: kick * (beatN % 4 === 0 ? 1 : 0.75), mid: 0.4 + 0.3 * Math.sin(t * 5.3) * Math.sin(t * 1.7) + off * 0.4, high: off }; };
  B('viz-ring', 'Spectrum ring', 4.0, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), bpm = d.bpm || 100, cx = W / 2, cy = H * 0.46, R = Math.min(W, H) * 0.26;
    const cv = el('canvas', `position:absolute;inset:0;width:${W}px;height:${H}px;`, L); cv.width = Math.round(W / 2); cv.height = Math.round(H / 2); const g = cv.getContext('2d');
    const N = Math.round(96 * Math.max(0.5, Q(ctx)));
    drive(ctx, t0, dur, (p) => {
      const t = p * dur, e = env(t, bpm), grow = ez('expo.out')(clamp(p * 3));
      g.clearRect(0, 0, cv.width, cv.height); g.save(); g.scale(0.5, 0.5); g.lineCap = 'round';
      for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2 - Math.PI / 2, band = i / N, k = band < 0.25 ? e.bass : band < 0.7 ? e.mid * (0.6 + 0.4 * Math.sin(i * 1.7 + t * 6)) : e.high * (0.5 + 0.5 * Math.sin(i * 3.1 + t * 11)); const len = (14 + k * 150) * U * grow; g.strokeStyle = i % 2 ? look.A : look.A2; g.lineWidth = 7 * U; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len)); g.stroke(); }
      g.globalAlpha = 0.25 + e.bass * 0.4; g.fillStyle = look.A; g.beginPath(); g.arc(cx, cy, R * (0.95 + e.bass * 0.06), 0, 6.283); g.fill(); g.restore();
    });
    const disc = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${R * 1.7}px;height:${R * 1.7}px;margin:${-R * 0.85}px;border-radius:50%;background:${d.img ? `url("${d.img}") center/cover` : `radial-gradient(circle at 35% 30%, ${mix(look.A, '#fff', 0.3)}, ${look.A})`};display:grid;place-items:center;font-family:${look.display};font-weight:800;font-size:${R * 0.6}px;color:#fff;box-shadow:0 0 0 ${8 * U}px rgba(255,255,255,.15);`, L, d.img ? '' : esc(d.mono || '♪'));
    drive(ctx, t0, dur, (p) => { const e = env(p * dur, bpm); disc.style.transform = `scale(${1 + e.bass * 0.06}) rotate(${p * 40}deg)`; });
    for (let b = 0; b * 60 / bpm < dur; b++) ctx.sfx.push({ t: t0 + b * 60 / bpm, k: b % 4 ? 'tick' : 'pop', v: b % 4 ? 0.25 : 0.4 });
    return t0 + dur;
  });
  B('viz-bars', 'Bars and wave', 4.0, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), bpm = d.bpm || 100;
    const cv = el('canvas', `position:absolute;inset:0;width:${W}px;height:${H}px;`, L); cv.width = Math.round(W / 2); cv.height = Math.round(H / 2); const g = cv.getContext('2d');
    const N = 40, base = H * 0.7;
    drive(ctx, t0, dur, (p) => {
      const t = p * dur, e = env(t, bpm); g.clearRect(0, 0, cv.width, cv.height); g.save(); g.scale(0.5, 0.5);
      for (let i = 0; i < N; i++) { const band = i / N, k = band < 0.3 ? e.bass * (1 - band) : band < 0.7 ? e.mid * (0.5 + 0.5 * Math.sin(i + t * 7)) : e.high * (0.4 + 0.6 * Math.sin(i * 2 + t * 13)); const bw = W / N, h = (20 + k * H * 0.32) * clamp(p * 4); const gr = g.createLinearGradient(0, base - h, 0, base); gr.addColorStop(0, look.A2); gr.addColorStop(1, look.A); g.fillStyle = gr; g.fillRect(i * bw + bw * 0.18, base - h, bw * 0.64, h); g.globalAlpha = 0.25; g.fillRect(i * bw + bw * 0.18, base + 8 * U, bw * 0.64, h * 0.4); g.globalAlpha = 1; }
      g.strokeStyle = '#fff'; g.lineWidth = 3 * U; g.beginPath(); for (let x = 0; x <= W; x += 8) { const y = H * 0.82 + Math.sin(x * 0.02 + t * 6) * 30 * U * (0.3 + e.mid) + Math.sin(x * 0.07 + t * 14) * 10 * U * e.high; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.restore();
    });
    const artist = word(L, (d.artist || d.brand || '').toUpperCase(), `font-family:${look.display};font-weight:${look.dw};font-size:${170 * U}px;letter-spacing:-.03em;color:#fff;`); fitTo(artist, W - 140 * U, 170 * U, 40 * U); center(artist, ctx, 0.3);
    const track = word(L, d.track || '', `font-family:${look.ui};font-weight:600;font-size:${40 * U}px;letter-spacing:.3em;text-transform:uppercase;color:${look.A2};`); center(track, ctx, 0.3); track.style.top = `${H * 0.3 + 120 * U}px`;
    ctx.tl.fromTo(artist, { opacity: 0, y: 40 * U, letterSpacing: `${30 * U}px` }, { opacity: 1, y: 0, letterSpacing: `${-5 * U}px`, duration: 1.2, ease: 'expo.out' }, t0 + 0.2);
    ctx.tl.fromTo(track, { opacity: 0 }, { opacity: 1, duration: 0.8 }, t0 + 0.8);
    drive(ctx, t0, dur, (p) => { const e = env(p * dur, bpm); artist.style.transform = `translateY(-50%) scale(${1 + e.bass * 0.035})`; });
    for (let b = 0; b * 60 / bpm < dur; b++) ctx.sfx.push({ t: t0 + b * 60 / bpm, k: b % 4 ? 'tick' : 'pop', v: b % 4 ? 0.25 : 0.4 });
    return t0 + dur;
  });

  // ================================================================== 8. CINEMATIC LOGO REVEAL
  B('logo-trace', 'Light trace', 3.6, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), cx = W / 2, cy = H * 0.46, S = Math.min(W, H) * 0.5;
    dust(ctx, L, t0, dur, 50, '#FFF2DC'); fogLayer(ctx, L, t0, dur, look.A);
    const s = sv('svg', { width: S, height: S, viewBox: '0 0 200 200', style: `position:absolute;left:${cx - S / 2}px;top:${cy - S / 2}px;overflow:visible;` }, L);
    const df = sv('defs', {}, s); const f = sv('filter', { id: 'lgl', x: '-50%', y: '-50%', width: '200%', height: '200%' }, df); sv('feGaussianBlur', { stdDeviation: 3, result: 'b' }, f); const mg = sv('feMerge', {}, f); sv('feMergeNode', { in: 'b' }, mg); sv('feMergeNode', { in: 'SourceGraphic' }, mg);
    const mono = String(d.mono || 'A');
    const ghost = sv('text', { x: 100, y: 106, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': mono.length > 1 ? 104 : 140, 'font-weight': 800, fill: 'none', stroke: rgba('#FFFFFF', 0.12), 'stroke-width': 1.2, style: `font-family:${look.display}` }, s); ghost.textContent = mono;
    const ring = sv('circle', { cx: 100, cy: 100, r: 94, fill: 'none', stroke: rgba('#FFFFFF', 0.12), 'stroke-width': 1.2 }, s);
    // the light source runs along the outline: a short bright dash travelling round
    const tr = ring.cloneNode(); tr.setAttribute('stroke', '#FFFFFF'); tr.setAttribute('stroke-width', 3); tr.setAttribute('filter', 'url(#lgl)'); s.appendChild(tr); const rl = 2 * Math.PI * 94; tr.style.strokeDasharray = `${rl * 0.12} ${rl}`;
    const tt = ghost.cloneNode(); tt.textContent = mono; tt.setAttribute('stroke', look.A2 === '#FFFFFF' ? '#FFFFFF' : mix(look.A, '#FFFFFF', 0.5)); tt.setAttribute('stroke-width', 2.2); tt.setAttribute('filter', 'url(#lgl)'); s.appendChild(tt); tt.style.strokeDasharray = '60 600';
    ctx.tl.fromTo(tr.style, { strokeDashoffset: 0 }, { strokeDashoffset: -rl * 1.1, duration: dur * 0.9, ease: 'power1.inOut' }, t0 + 0.2);
    ctx.tl.fromTo(tt.style, { strokeDashoffset: 0 }, { strokeDashoffset: -660, duration: dur * 0.9, ease: 'power1.inOut' }, t0 + 0.4);
    ctx.tl.to([ghost, ring], { attr: { stroke: rgba('#FFFFFF', 0.3) }, duration: dur, ease: 'power1.in' }, t0);
    ctx.tl.fromTo(s, { scale: 0.92 }, { scale: 1, duration: dur, ease: 'sine.inOut' }, t0);
    ctx.sfx.push({ t: t0 + 0.2, k: 'whoosh', v: 0.25 });
    return t0 + dur;
  });
  B('logo-burst', 'Light burst reveal', 3.8, function (ctx, L, t0, d) {
    const { W, H, U, look } = ctx, dur = D(d, this.dur), cx = W / 2, cy = H * 0.46, S = Math.min(W, H) * 0.5;
    beams(ctx, L, t0, dur, mix(look.A, '#FFFFFF', 0.5), 0.12); dust(ctx, L, t0, dur, 40, '#FFF2DC');
    const mark = el('div', `position:absolute;left:${cx - S / 2}px;top:${cy - S / 2}px;width:${S}px;height:${S}px;border-radius:50%;border:${S * 0.03}px solid transparent;background:${metalGrad(look.A)} border-box;-webkit-mask:linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0);display:grid;place-items:center;`, L);
    const inner = el('div', `position:absolute;inset:${S * 0.03}px;border-radius:50%;background:radial-gradient(circle at 40% 30%, ${mix(look.A, '#000', 0.3)}, #050506 70%);display:grid;place-items:center;`, mark);
    el('div', `font-family:${look.display};font-weight:800;font-size:${S * (String(d.mono || 'A').length > 1 ? 0.38 : 0.5)}px;letter-spacing:-.04em;background:${metalGrad(look.A)};-webkit-background-clip:text;background-clip:text;color:transparent;`, inner, d.logo ? `<img src="${d.logo}" style="width:${S * 0.6}px;height:${S * 0.6}px;object-fit:contain">` : esc(d.mono || 'A'));
    const burstAt = t0 + 0.6;
    const glow = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${S * 3}px;height:${S * 3}px;margin:${-S * 1.5}px;border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,.95), ${rgba(look.A, 0.6)} 18%, transparent 60%);mix-blend-mode:screen;`, L);
    ctx.tl.fromTo(glow, { scale: 0.2, opacity: 0 }, { scale: 1.2, opacity: 1, duration: 0.25, ease: 'expo.out' }, burstAt).to(glow, { scale: 1.6, opacity: 0, duration: 1.0, ease: 'power2.out' }, burstAt + 0.25);
    ctx.tl.fromTo(mark, { scale: 1.3, opacity: 0, filter: 'brightness(3) blur(10px)' }, { scale: 1, opacity: 1, filter: 'brightness(1) blur(0px)', duration: 1.2, ease: 'expo.out' }, burstAt);
    ctx.tl.fromTo(L, { scale: 1 }, { scale: 1.05, duration: dur - 0.6, ease: 'power2.out', immediateRender: false }, burstAt);
    shake(ctx, L, burstAt + 0.05, 8); sparks(ctx, L, cx, cy, burstAt, 70, ['#FFFFFF', look.A, '#FFE2A8']);
    const name = word(L, d.brand || '', `font-family:${look.display};font-weight:${look.dw};font-size:${110 * U}px;letter-spacing:.06em;color:#fff;`); fitTo(name, W - 140 * U, 110 * U, 36 * U); center(name, ctx, cy / H); name.style.top = `${cy + S / 2 + 80 * U}px`;
    ctx.tl.fromTo(name, { opacity: 0, y: 30 * U, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.0, ease: 'expo.out' }, burstAt + 0.6);
    if (d.tagline) { const tg = word(L, d.tagline, `font-family:${look.ui};font-weight:500;font-size:${32 * U}px;letter-spacing:.4em;text-transform:uppercase;color:${rgba('#FFFFFF', 0.7)};`); center(tg, ctx, cy / H); tg.style.top = `${cy + S / 2 + 80 * U + name.offsetHeight + 20 * U}px`; ctx.tl.fromTo(tg, { opacity: 0, letterSpacing: `${30 * U}px` }, { opacity: 1, letterSpacing: `${13 * U}px`, duration: 1.4, ease: 'expo.out' }, burstAt + 0.9); }
    ctx.sfx.push({ t: burstAt, k: 'chime', v: 0.7 }, { t: burstAt - 0.3, k: 'whoosh', v: 0.35 });
    return t0 + dur;
  });

  // ================================================================== the recipes
  const T = (window.SIGNATURE_TEMPLATES = {
    'type-reactor': { label: 'Kinetic Typography — Type Reactor', best: 'TikTok edits, music promos, creator branding, quotes', look: { bg: '#050507', dark: true, display: 'Anton', dw: 400, ui: 'Inter', upper: true, A: '#FF3B5C', A2: '#FFD23F' }, intensity: 'aggressive', sound: 'beat',
      beats: { 6: ['tr-words', 'tr-final'], 15: ['tr-words', 'tr-split', 'tr-words', 'tr-final'], 30: ['tr-words', 'tr-split', 'tr-words', 'tr-split', 'tr-words', 'tr-words', 'tr-split', 'tr-final'] }, trans: ['x-flash', 'x-whip', 'x-glitch', 'x-slice'] },
    'luxury-product': { label: 'Luxury 3D Product Commercial', best: 'Perfume, watches, sneakers, cosmetics, phones', look: { bg: '#07060A', dark: true, display: 'Playfair Display', dw: 700, ui: 'DM Sans', A: '#D4A24C', A2: '#F3E6CF' }, intensity: 'elegant', sound: 'cinematic',
      beats: { 6: ['lux-reveal', 'lux-lockup'], 15: ['lux-reveal', 'lux-orbit', 'lux-macro', 'lux-lockup'], 30: ['lux-reveal', 'lux-orbit', 'lux-macro', 'lux-orbit', 'lux-macro', 'lux-reveal', 'lux-orbit', 'lux-lockup'] }, trans: ['x-cover', 'x-iris', 'x-push'] },
    'hud-tech': { label: 'Futuristic HUD & Tech Intro', best: 'Tech brands, gaming, software launches', look: { bg: '#03070C', dark: true, display: 'Orbitron', dw: 800, ui: 'Space Grotesk', A: '#22E3FF', A2: '#8B5CFF' }, intensity: 'mechanical', sound: 'cinematic',
      beats: { 6: ['hud-boot', 'hud-emblem'], 15: ['hud-boot', 'hud-panels', 'hud-panels', 'hud-emblem'], 30: ['hud-boot', 'hud-panels', 'hud-boot', 'hud-panels', 'hud-boot', 'hud-panels', 'hud-panels', 'hud-emblem'] }, trans: ['x-iris', 'x-glitch', 'x-circles', 'x-blinds'] },
    'liquid-chrome': { label: 'Liquid Chrome & Abstract Morphing', best: 'Designer portfolios, fashion, art titles', look: { bg: '#08080A', dark: true, display: 'Syne', dw: 800, ui: 'Inter', A: '#A78BFA', A2: '#E2E8F0' }, intensity: 'fluid', sound: 'ambient',
      beats: { 6: ['chrome-emerge', 'chrome-type'], 15: ['chrome-emerge', 'chrome-ribbons', 'chrome-emerge', 'chrome-type'], 30: ['chrome-emerge', 'chrome-ribbons', 'chrome-type', 'chrome-emerge', 'chrome-ribbons', 'chrome-emerge', 'chrome-ribbons', 'chrome-type'] }, trans: ['x-liquid', 'x-circles', 'x-zoom'] },
    'sports-hype': { label: 'Sports Hype Edit', best: 'Football, basketball, athletes, gaming montages', look: { bg: '#060608', dark: true, display: 'Oswald', dw: 700, ui: 'Inter', upper: true, A: '#E5383B', A2: '#FFD23F' }, intensity: 'aggressive', sound: 'beat',
      beats: { 6: ['sport-cuts', 'sport-impact'], 15: ['sport-cuts', 'sport-impact', 'sport-cuts', 'sport-freeze'], 30: ['sport-cuts', 'sport-impact', 'sport-cuts', 'sport-freeze', 'sport-cuts', 'sport-impact', 'sport-cuts', 'sport-freeze'] }, trans: ['x-flash', 'x-whip', 'x-slice', 'x-zoom'] },
    'swiss-editorial': { label: 'Swiss Editorial Motion', best: 'Fashion, events, editorial promos, portfolios', look: { bg: '#EDEAE3', dark: false, display: 'Archivo Black', dw: 400, ui: 'Inter', A: '#E5383B', A2: '#121212' }, intensity: 'elegant', sound: 'ambient',
      beats: { 6: ['swiss-grid', 'swiss-poster'], 15: ['swiss-grid', 'swiss-photo', 'swiss-poster'], 30: ['swiss-grid', 'swiss-photo', 'swiss-grid', 'swiss-photo', 'swiss-photo', 'swiss-grid', 'swiss-poster'] }, trans: ['x-push', 'x-cover', 'x-blinds'] },
    'visualizer': { label: 'Audio-Reactive Music Visualizer', best: 'Artists, DJs, song promos, podcasts', look: { bg: '#05040A', dark: true, display: 'Unbounded', dw: 700, ui: 'Inter', A: '#FF2E88', A2: '#21E6FF' }, intensity: 'fluid', sound: 'beat',
      beats: { 6: ['viz-ring'], 15: ['viz-ring', 'viz-bars', 'viz-ring'], 30: ['viz-ring', 'viz-bars', 'viz-ring', 'viz-bars', 'viz-ring', 'viz-bars', 'viz-ring'] }, trans: ['x-circles', 'x-zoom', 'x-iris'] },
    'cinematic-logo': { label: 'Cinematic Logo Reveal', best: 'YouTube intros, gaming, agencies, brands', look: { bg: '#040405', dark: true, display: 'Cinzel', dw: 700, ui: 'Inter', A: '#D4A24C', A2: '#FFFFFF' }, intensity: 'elegant', sound: 'cinematic',
      beats: { 6: ['logo-trace', 'logo-burst'], 15: ['logo-trace', 'logo-trace', 'logo-burst'], 30: ['logo-trace', 'logo-trace', 'logo-burst', 'logo-trace', 'logo-burst'] }, trans: ['x-zoom', 'x-iris'] },
  });
  const POOLS = { elegant: ['x-cover', 'x-iris', 'x-push', 'x-liquid'], aggressive: ['x-flash', 'x-whip', 'x-glitch', 'x-slice', 'x-zoom'], mechanical: ['x-blinds', 'x-glitch', 'x-slice', 'x-panels', 'x-iris'], fluid: ['x-liquid', 'x-circles', 'x-iris', 'x-swing'] };

  // words for each beat, from the owner's inputs
  function dataFor(beat, f, i) {
    const head = f.headline || f.brand, lines = String(head).includes('|') ? head : head.split(/\s+/).length > 2 ? head.split(/\s+/).slice(0, Math.ceil(head.split(/\s+/).length / 2)).join(' ') + '|' + head.split(/\s+/).slice(Math.ceil(head.split(/\s+/).length / 2)).join(' ') : head;
    const words = [...(f.words || []), f.brand].filter(Boolean);
    // every line the owner gave us, once each (long films walk through them instead of repeating one)
    const pool = [...(f.points || []), ...String(head).replace('|', ' ').split(/\s+/).filter((w) => w.length >= 4), f.sub, f.cta].map((x) => String(x || '').trim()).filter((x, k, a) => x && a.indexOf(x) === k);
    const nth = (k) => (pool.length ? pool[k % pool.length] : head);
    return ({
      'tr-words': { text: i ? nth(i - 1) : head }, 'tr-split': { word: (nth(i + 1) || f.brand || '').split(/\s+/)[0], tag: f.brand }, 'tr-final': { headline: lines },
      'lux-reveal': { img: f.img, mono: f.mono, kicker: f.brand }, 'lux-orbit': { img: f.img, mono: f.mono, brand: f.brand }, 'lux-macro': { img: f.img, benefit: nth(i) || f.sub }, 'lux-lockup': { brand: f.brand, benefit: f.sub, cta: f.cta },
      'hud-boot': {}, 'hud-panels': { headline: i % 2 ? nth(i) : head, tag: f.brand, metric: (nth(i + 1) || 'SYSTEM READY').toUpperCase() }, 'hud-emblem': { mono: f.mono, logo: f.logo, brand: f.brand },
      'chrome-emerge': {}, 'chrome-ribbons': {}, 'chrome-type': { headline: f.brand, sub: f.sub },
      'sport-cuts': { img: f.img }, 'sport-impact': { img: f.img, headline: lines, sub: f.sub }, 'sport-freeze': { img: f.img, headline: f.brand, sub: f.cta },
      'swiss-grid': { headline: lines, kicker: f.sub, date: f.date, place: f.place }, 'swiss-photo': { img: f.img, word: words[i % words.length] }, 'swiss-poster': { brand: f.brand, line: f.sub, cta: f.cta, contact: f.contact },
      'viz-ring': { img: f.img, mono: f.mono, bpm: f.bpm }, 'viz-bars': { artist: f.brand, track: f.sub || head, bpm: f.bpm },
      'logo-trace': { mono: f.mono }, 'logo-burst': { mono: f.mono, logo: f.logo, brand: f.brand, tagline: f.sub },
    })[beat] || {};
  }

  /** cfg = { template, W, H, seed, duration: 6|15|30, intensity, sound, quality, bpm, colors:{A,A2}, fields:{ brand, headline, sub, cta, points[], img, logo, mono, date, place, contact } } */
  window.TEMPLATE_RECIPE = function (cfg) {
    const tp = T[cfg.template] || T['type-reactor'], dur = Math.max(5, Math.min(120, Number(cfg.duration) || 15));
    const intensity = cfg.intensity || tp.intensity, sound = cfg.sound || tp.sound, f = cfg.fields || {};
    const q = (x) => `'${x}', 'Inter', system-ui, sans-serif`, L0 = tp.look;
    const look = { display: q(cfg.font || L0.display), dw: L0.dw, ui: q(L0.ui), upper: !!L0.upper, A: cfg.colors?.A || L0.A, A2: cfg.colors?.A2 || L0.A2, dark: L0.dark, bg: L0.dark ? L0.bg : '#0B0B0D', bgLight: L0.dark ? '#F3F2F7' : L0.bg };
    // the three tuned recipes (6 / 15 / 30 s) are used as they are; any other length gets a fresh run of the template's own beats
    const beats = tp.beats[dur] || (() => { const b30 = tp.beats[30], first = b30[0], last = b30[b30.length - 1], mid = b30.length > 2 ? b30.slice(1, -1) : [first];
      const n = Math.max(2, Math.min(40, Math.round(dur / 3.8))), out = [first]; for (let k = 0; k < n - 2; k++) out.push(mid[k % mid.length]); out.push(last); return out; })();
    const pool = (tp.trans.concat(POOLS[intensity] || [])).filter((x, i, a) => a.indexOf(x) === i);
    const bpm = cfg.bpm || 100, beat = 60 / bpm;
    // fit the beats into the chosen length; with a beat soundtrack every cut lands on a beat
    const heavy = (b) => b === 'tr-final' || b.endsWith('lockup') || b.endsWith('emblem') || b === 'logo-burst' || b === 'swiss-poster';
    const per = Math.max(1.8, (dur - 0.45 - (beats.length - 1) * 0.3) / beats.reduce((a, b) => a + (heavy(b) ? 1.2 : 1), 0));
    const r = (() => { let a = (cfg.seed || 7) | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    let last = null;
    const scenes = beats.map((b, i) => { let dd = per * (heavy(b) ? 1.2 : 1); if (sound === 'beat') dd = Math.max(2 * beat, Math.round(dd / beat) * beat); const p = pool.filter((x) => x !== last); const tr = p[Math.floor(r() * p.length)]; last = tr; return { piece: b, kind: tp.look.dark ? 'dark' : 'light', bg: 'plain', cam: intensity === 'elegant' ? 'push' : intensity === 'fluid' ? 'drift' : 'push', trans: i ? tr : undefined, data: { ...dataFor(b, { ...f, bpm }, i), dur: +dd.toFixed(2) } }; });
    return { target: dur, W: cfg.W || 1080, H: cfg.H || 1920, seed: cfg.seed || 7, look, scenes, energy: intensity === 'aggressive' ? 'high' : intensity === 'elegant' ? 'calm' : 'medium', intensity, quality: cfg.quality || 'premium', sound, leak: tp.look.dark };
  };
  // build a template film into a stage element; sound profile shapes the cues
  window.TEMPLATE_FILM = function (cfg, stageEl) {
    const rec = window.TEMPLATE_RECIPE(cfg);
    const res = window.PIECE_SEQUENCE(Object.assign({ noGlobal: !!cfg.noGlobal }, rec, { _ctxExtra: { intensity: rec.intensity, quality: rec.quality } }), stageEl);
    let sfx = res.sfx;
    if (rec.sound === 'none') sfx = [];
    else if (rec.sound === 'ambient') sfx = sfx.filter((x) => x.k === 'chime' || x.k === 'whoosh').map((x) => ({ ...x, v: +(x.v * 0.6).toFixed(2) }));
    else if (rec.sound === 'cinematic') sfx = sfx.filter((x) => x.k !== 'tick');
    else if (rec.sound === 'beat') { const b = 60 / (cfg.bpm || 100); for (let t = 0; t < res.duration - 0.2; t += b) sfx.push({ t: +t.toFixed(3), k: 'tick', v: 0.18 }); sfx.sort((a, c) => a.t - c.t); }
    if (!cfg.noGlobal) window.__sfx = sfx;
    return { ...res, sfx, recipe: rec };
  };
})();
