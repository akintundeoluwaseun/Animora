/* Animora Motion atoms: the small parts every text scene is spelled from.
   ENTER  how the letters arrive (24)        LAYOUT where the words sit (10)
   EMPH   how the key word is marked (11)     BG     the world behind the scene (10 more, 16 in all)
   plus 8 more transitions (15 in all) and the 'title' piece that combines them.
   Needs pieces.js first (window.PIECES / window.PIECE_UTILS). */
(function () {
  'use strict';
  const P = window.PIECES, X = window.PIECE_UTILS;
  const { el, sv, clamp, lerp, ez, esc, rgba, mix, on, drive, show, orb, chars, natural, inkOn, seeded } = X;
  const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@*+=?';

  // ================================================================== ENTER: (ctx, cs, ws, t, fs) -> time the line has landed
  const ENTER = (window.ATOM_ENTER = {
    rise(ctx, cs, ws, t) { ws.forEach((w) => { w.style.overflow = 'hidden'; w.style.paddingBottom = '.1em'; w.style.marginBottom = '-.1em'; w.style.verticalAlign = 'top'; }); ctx.tl.fromTo(cs, { yPercent: 115 }, { yPercent: 0, duration: 0.85, ease: 'expo.out', stagger: 0.02 }, t); return t + 0.6 + cs.length * 0.02; },
    flip(ctx, cs, ws, t, fs) { cs.forEach((c) => { c.style.transformOrigin = '50% 100%'; }); ws.forEach((w) => { w.style.perspective = `${fs * 5}px`; }); ctx.tl.fromTo(cs, { rotationX: -100, y: fs * 0.3, opacity: 0 }, { rotationX: 0, y: 0, opacity: 1, duration: 0.75, ease: 'back.out(1.7)', stagger: 0.028 }, t); return t + 0.55 + cs.length * 0.028; },
    drop(ctx, cs, ws, t, fs) { ctx.tl.fromTo(cs, { y: -fs * 1.3, opacity: 0, scaleY: 1.4 }, { y: 0, opacity: 1, scaleY: 1, duration: 0.8, ease: 'bounce.out', stagger: 0.03 }, t); return t + 0.6 + cs.length * 0.03; },
    zoom(ctx, cs, ws, t) { ctx.tl.fromTo(cs, { scale: 3, opacity: 0, filter: 'blur(14px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out', stagger: { each: 0.03, from: 'random' } }, t); return t + 0.5 + cs.length * 0.03; },
    pop(ctx, cs, ws, t) { ctx.tl.fromTo(cs, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(3)', stagger: 0.025 }, t); return t + 0.4 + cs.length * 0.025; },
    slideL(ctx, cs, ws, t, fs) { ctx.tl.fromTo(cs, { x: fs * 1.2, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'power4.out', stagger: 0.022 }, t); return t + 0.5 + cs.length * 0.022; },
    slideR(ctx, cs, ws, t, fs) { ctx.tl.fromTo(cs, { x: -fs * 1.2, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'power4.out', stagger: { each: 0.022, from: 'end' } }, t); return t + 0.5 + cs.length * 0.022; },
    skew(ctx, cs, ws, t, fs) { ctx.tl.fromTo(ws, { skewX: -40, x: -fs * 0.8, opacity: 0 }, { skewX: 0, x: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.09 }, t); return t + 0.6 + ws.length * 0.09; },
    rotate(ctx, cs, ws, t) { cs.forEach((c) => { c.style.transformOrigin = '0% 100%'; }); ctx.tl.fromTo(cs, { rotation: -80, opacity: 0 }, { rotation: 0, opacity: 1, duration: 0.7, ease: 'back.out(2)', stagger: 0.025 }, t); return t + 0.5 + cs.length * 0.025; },
    type(ctx, cs, ws, t, fs) {
      const head = cs[0]?.closest('.atom-head'); const caret = el('span', `position:absolute;width:${Math.max(3, fs * 0.06)}px;height:${fs * 0.9}px;background:currentColor;`, head);
      const step = 0.045; cs.forEach((c) => { c.style.opacity = 0; });
      drive(ctx, t, cs.length * step + 0.01, (p) => {
        const n = Math.round(p * cs.length); cs.forEach((c, i) => { c.style.opacity = i < n ? 1 : 0; });
        const last = cs[Math.max(0, n - 1)], hr = head.getBoundingClientRect(), r = last.getBoundingClientRect(), z = hr.width / head.offsetWidth || 1;
        caret.style.left = `${((n ? r.right : r.left) - hr.left) / z + fs * 0.04}px`; caret.style.top = `${(r.top - hr.top) / z + fs * 0.08}px`;
      });
      ctx.tl.to(caret, { opacity: 0, duration: 0.01, repeat: 5, yoyo: true, repeatDelay: 0.25 }, t + cs.length * step + 0.1);
      cs.forEach((c, i) => { if (i % 3 === 0) ctx.sfx.push({ t: t + i * step, k: 'tick', v: 0.4 }); });
      return t + cs.length * step;
    },
    scramble(ctx, cs, ws, t) {
      const real = cs.map((c) => c.textContent), r = seeded(17);
      drive(ctx, t, 1.1, (p) => {
        const k = Math.floor(p * 40); const rr = seeded(k * 31 + 5); void r;
        cs.forEach((c, i) => { const at = i / cs.length * 0.7; if (p >= at + 0.25 || !real[i].trim()) c.textContent = real[i]; else c.textContent = p < at ? '' : GLYPHS[Math.floor(rr() * GLYPHS.length)]; c.style.opacity = p < at ? 0 : 1; });
      });
      return t + 1.1;
    },
    wave(ctx, cs, ws, t, fs) {
      drive(ctx, t, 2.6, (p) => { cs.forEach((c, i) => { const q = clamp(p * 3 - i * 0.04); const settle = 1 - clamp((p - 0.35) / 0.65); c.style.opacity = clamp(q * 3); c.style.transform = `translateY(${(1 - ez('back.out(2)')(q)) * fs * 0.8 + Math.sin(p * 14 - i * 0.6) * fs * 0.08 * settle}px)`; }); });
      return t + 1.0;
    },
    elastic(ctx, cs, ws, t) { ctx.tl.fromTo(ws, { scaleX: 0.2, scaleY: 1.8, opacity: 0 }, { scaleX: 1, scaleY: 1, opacity: 1, duration: 1.1, ease: 'elastic.out(1, .45)', stagger: 0.1 }, t); return t + 0.7 + ws.length * 0.1; },
    focus(ctx, cs, ws, t, fs) { const head = cs[0].closest('.atom-head'); ctx.tl.fromTo(head, { letterSpacing: `${fs * 0.4}px`, filter: 'blur(18px)', opacity: 0 }, { letterSpacing: `${-fs * 0.03}px`, filter: 'blur(0px)', opacity: 1, duration: 1.3, ease: 'expo.out' }, t); return t + 0.9; },
    center(ctx, cs, ws, t, fs) { ctx.tl.fromTo(cs, { opacity: 0, y: fs * 0.4, scale: 0.6 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out', stagger: { each: 0.03, from: 'center' } }, t); return t + 0.5 + cs.length * 0.015; },
    stretch(ctx, cs, ws, t) { cs.forEach((c) => { c.style.transformOrigin = '50% 100%'; }); ctx.tl.fromTo(cs, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.6, ease: 'back.out(2.5)', stagger: 0.025 }, t); return t + 0.45 + cs.length * 0.025; },
    spin(ctx, cs, ws, t, fs) { ws.forEach((w) => { w.style.perspective = `${fs * 4}px`; }); ctx.tl.fromTo(cs, { rotationY: -90, opacity: 0 }, { rotationY: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.03 }, t); return t + 0.6 + cs.length * 0.03; },
    scatter(ctx, cs, ws, t, fs) { const r = seeded(cs.length * 7 + 3); ctx.tl.fromTo(cs, { x: () => (r() - 0.5) * fs * 6, y: () => (r() - 0.5) * fs * 5, rotation: () => (r() - 0.5) * 240, opacity: 0, scale: 0.4 }, { x: 0, y: 0, rotation: 0, opacity: 1, scale: 1, duration: 1.1, ease: 'expo.out', stagger: 0.015 }, t); return t + 1.0; },
    glitch(ctx, cs, ws, t, fs) {
      const head = cs[0].closest('.atom-head'), A = ctx.look.A, B = ctx.look.A2;
      drive(ctx, t, 0.9, (p) => {
        const rr = seeded(Math.floor(p * 30) + 9), amp = (1 - p) * fs * 0.12;
        cs.forEach((c, i) => { const on_ = p > (i / cs.length) * 0.5; c.style.opacity = on_ ? (rr() < 0.15 * (1 - p) ? 0.2 : 1) : 0; c.style.transform = `translateX(${(rr() - 0.5) * amp * 2}px)`; });
        head.style.textShadow = p < 0.98 ? `${amp * 0.6}px 0 ${rgba(A, 0.9)}, ${-amp * 0.6}px 0 ${rgba(B, 0.9)}` : 'none';
      });
      ctx.sfx.push({ t, k: 'tick', v: 0.5 }, { t: t + 0.2, k: 'tick', v: 0.4 });
      return t + 0.9;
    },
    curtain(ctx, cs, ws, t) { ws.forEach((w) => { w.style.overflow = 'hidden'; w.style.verticalAlign = 'top'; w.style.paddingBottom = '.1em'; w.style.marginBottom = '-.1em'; }); ctx.tl.fromTo(cs, { yPercent: -115 }, { yPercent: 0, duration: 0.8, ease: 'expo.out', stagger: { each: 0.02, from: 'end' } }, t); return t + 0.6 + cs.length * 0.02; },
    swing(ctx, cs, ws, t, fs) { ws.forEach((w) => { w.style.transformOrigin = '50% 0%'; w.style.perspective = `${fs * 5}px`; }); ctx.tl.fromTo(ws, { rotationX: 95, opacity: 0 }, { rotationX: 0, opacity: 1, duration: 1.2, ease: 'elastic.out(1, .55)', stagger: 0.08 }, t); return t + 0.8 + ws.length * 0.08; },
    track(ctx, cs, ws, t, fs) { const head = cs[0].closest('.atom-head'); ctx.tl.fromTo(head, { letterSpacing: `${fs * 0.9}px`, opacity: 0 }, { letterSpacing: `${-fs * 0.03}px`, opacity: 1, duration: 1.4, ease: 'expo.inOut' }, t); return t + 1.2; },
    sweep(ctx, cs, ws, t) {
      const head = cs[0].closest('.atom-head');
      drive(ctx, t, 1.0, (p) => { const m = lerp(-30, 130, ez('power2.inOut')(p)); const g = `linear-gradient(90deg, #000 ${m - 30}%, transparent ${m}%)`; head.style.webkitMaskImage = g; head.style.maskImage = g; head.style.filter = `blur(${(1 - p) * 4}px)`; });
      ctx.tl.set(head, { webkitMaskImage: 'none', maskImage: 'none', filter: 'none' }, t + 1.01);
      return t + 0.9;
    },
    punch(ctx, cs, ws, t) { ctx.tl.fromTo(ws, { scale: 1.9, opacity: 0, filter: 'blur(8px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.45, ease: 'power4.out', stagger: 0.16 }, t); ws.forEach((w, i) => ctx.sfx.push({ t: t + i * 0.16, k: 'pop', v: 0.5 })); return t + 0.35 + ws.length * 0.16; },
    split(ctx, cs, ws, t, fs) { cs.forEach((c, i) => { c.dataset.side = i % 2; }); ctx.tl.fromTo(cs, { y: (i) => (i % 2 ? fs : -fs), opacity: 0 }, { y: 0, opacity: 1, duration: 0.75, ease: 'expo.out', stagger: 0.02 }, t); return t + 0.6 + cs.length * 0.02; },
  });

  // ================================================================== LAYOUT: where kicker / headline / sub sit
  const LAYOUT = (window.ATOM_LAYOUT = {
    center: { css: 'justify-content:center;align-items:center;text-align:center;' },
    left: { css: 'justify-content:center;align-items:flex-start;text-align:left;' },
    lower: { css: 'justify-content:flex-end;align-items:flex-start;text-align:left;', pad: [0, 0, 300, 0] },
    top: { css: 'justify-content:flex-start;align-items:flex-start;text-align:left;', pad: [300, 0, 0, 0] },
    right: { css: 'justify-content:center;align-items:flex-end;text-align:right;' },
    panel: { css: 'justify-content:center;align-items:center;text-align:center;', panel: true },
    band: { css: 'justify-content:flex-end;align-items:flex-start;text-align:left;', pad: [0, 0, 340, 0], band: true },
    giant: { css: 'justify-content:center;align-items:center;text-align:center;', giant: true },
    stagger: { css: 'justify-content:center;align-items:stretch;text-align:left;', stagger: true },
    ruled: { css: 'justify-content:center;align-items:center;text-align:center;', ruled: true },
  });

  // ================================================================== EMPH: how the key word is marked (kw = word span)
  const EMPH = (window.ATOM_EMPH = {
    marker(ctx, kw, t) { const m = el('span', `position:absolute;left:-.1em;right:-.1em;top:.02em;bottom:-.04em;background:${acc(ctx, kw)};border-radius:.08em;transform-origin:0 50%;transform:scaleX(0);z-index:-1;`, kw); kw.style.isolation = 'isolate'; ctx.tl.to(m, { scaleX: 1, duration: 0.5, ease: 'expo.inOut' }, t); ctx.tl.to(letters(kw), { color: on(acc(ctx, kw)), duration: 0.2 }, t + 0.2); },
    underline(ctx, kw, t) { const b = el('span', `position:absolute;left:0;right:0;bottom:-.06em;height:.11em;border-radius:.06em;background:${acc(ctx, kw)};transform-origin:0 50%;transform:scaleX(0);`, kw); ctx.tl.to(b, { scaleX: 1, duration: 0.6, ease: 'expo.inOut' }, t); ctx.tl.to(letters(kw), { color: acc(ctx, kw), duration: 0.3 }, t); },
    circle(ctx, kw, t) {
      const w = kw.offsetWidth, h = kw.offsetHeight; const s = sv('svg', { width: w * 1.3, height: h * 1.5, viewBox: '0 0 100 100', preserveAspectRatio: 'none', style: `position:absolute;left:${-w * 0.15}px;top:${-h * 0.25}px;overflow:visible;` }, kw);
      const e = sv('path', { d: 'M8 55 C 6 20, 92 12, 95 48 C 97 85, 12 92, 6 58 C 4 40, 30 22, 60 20', fill: 'none', stroke: acc(ctx, kw), 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round' }, s);
      e.style.strokeWidth = `${7 * ctx.U}px`; const len = e.getTotalLength(); e.style.strokeDasharray = len; e.style.strokeDashoffset = len; ctx.tl.to(e.style, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, t);
    },
    color(ctx, kw, t) { ctx.tl.to(letters(kw), { color: acc(ctx, kw), duration: 0.25, stagger: 0.035 }, t); },
    outline(ctx, kw, t) { const ls = letters(kw); ls.forEach((c) => { c.style.webkitTextStroke = `${Math.max(2, 3 * ctx.U)}px ${acc(ctx, kw)}`; }); ctx.tl.fromTo(ls, { color: 'rgba(0,0,0,0)' }, { color: acc(ctx, kw), duration: 0.5, stagger: 0.04, immediateRender: false }, t + 0.1); ctx.tl.set(ls, { color: 'rgba(0,0,0,0)' }, Math.max(0, t - 0.4)); },
    gradient(ctx, kw, t) {   // each letter carries its slice of one gradient that slides across the word
      const ls = letters(kw), w = kw.offsetWidth || 1, A = acc(ctx, kw), B = ctx.look.A2;
      ls.forEach((c) => { c.style.backgroundImage = `linear-gradient(90deg, ${A}, ${B}, ${A}, ${B})`; c.style.backgroundSize = `${w * 3}px 100%`; c.style.webkitBackgroundClip = 'text'; c.style.backgroundClip = 'text'; });
      ctx.tl.to(ls, { color: 'rgba(0,0,0,0)', duration: 0.3 }, t);
      drive(ctx, t, 2.4, (p) => { const sh = -p * w * 1.5; ls.forEach((c) => { c.style.backgroundPosition = `${sh - c.offsetLeft}px 0`; }); }, 'sine.inOut');
    },
    glow(ctx, kw, t) { const A = acc(ctx, kw); ctx.tl.to(letters(kw), { color: mix(A, '#FFFFFF', 0.25), textShadow: `0 0 ${12 * ctx.U}px ${rgba(A, 0.9)}, 0 0 ${40 * ctx.U}px ${rgba(A, 0.6)}`, duration: 0.5 }, t); ctx.tl.to(kw, { opacity: 0.75, duration: 0.08, repeat: 3, yoyo: true }, t + 0.1); },
    sticker(ctx, kw, t) { const b = el('span', `position:absolute;left:-.16em;right:-.16em;top:-.02em;bottom:-.08em;background:${ctx.look.A2};border-radius:.18em;z-index:-1;box-shadow:0 .08em .2em rgba(0,0,0,.25);`, kw); kw.style.isolation = 'isolate'; ctx.tl.fromTo(b, { scale: 0, rotation: -12 }, { scale: 1, rotation: -3, duration: 0.6, ease: 'back.out(2.6)' }, t); ctx.tl.to(letters(kw), { color: on(ctx.look.A2), duration: 0.2 }, t + 0.1); ctx.tl.to(kw, { rotation: -3, duration: 0.6, ease: 'back.out(2.6)' }, t); },
    box(ctx, kw, t) {
      const w = kw.offsetWidth + 0.3 * parseFloat(getComputedStyle(kw).fontSize), h = kw.offsetHeight; const s = sv('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, style: `position:absolute;left:${-(w - kw.offsetWidth) / 2}px;top:0;overflow:visible;` }, kw);
      const r = sv('rect', { x: 0, y: 0, width: w, height: h, fill: 'none', stroke: acc(ctx, kw), rx: h * 0.08 }, s); r.style.strokeWidth = `${5 * ctx.U}px`; const per = 2 * (w + h); r.style.strokeDasharray = per; r.style.strokeDashoffset = per; ctx.tl.to(r.style, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut' }, t);
    },
    sparkle(ctx, kw, t) {
      const fs = parseFloat(getComputedStyle(kw).fontSize);
      [[-0.15, -0.25, 0.35], [1.05, -0.1, 0.25], [0.9, 0.85, 0.2]].forEach(([x, y, z], i) => {
        const s = el('span', `position:absolute;left:${x * 100}%;top:${y * 100}%;width:${fs * z}px;height:${fs * z}px;background:${i === 1 ? ctx.look.A2 : acc(ctx, kw)};clip-path:polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);`, kw);
        ctx.tl.fromTo(s, { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(3)' }, t + i * 0.08).to(s, { rotation: 45, duration: 2, ease: 'sine.inOut' }, '>');
      });
      ctx.tl.to(letters(kw), { color: acc(ctx, kw), duration: 0.3 }, t);
    },
    strike(ctx, kw, t) { const b = el('span', `position:absolute;left:-.05em;right:-.05em;top:48%;height:.09em;background:${acc(ctx, kw)};transform-origin:0 50%;transform:scaleX(0) rotate(-4deg);`, kw); ctx.tl.to(b, { scaleX: 1, duration: 0.4, ease: 'power3.in' }, t); ctx.tl.to(letters(kw), { opacity: 0.45, duration: 0.3 }, t + 0.3); },
  });
  // the highlight colour must show on its own background: on a brand-coloured frame use the second colour, on a light frame keep it dark enough
  function acc(ctx, node) { const k = node.closest('[data-kind]')?.dataset.kind, A = ctx.look.A; if (k === 'brand') return ctx.look.A2; if (k === 'light' && X.lum(A) > 0.4) return mix(A, '#000000', 0.45); return A; }
  const letters = (kw) => [...kw.querySelectorAll(':scope > span')].filter((s) => !s.style.position);

  // ================================================================== more backgrounds
  const BG = (window.PIECE_BG = {
    stripes(ctx, l, kind, t0, t1) { const ink = kind === 'light' ? '#111114' : '#FFFFFF'; const g = el('div', `position:absolute;inset:-50%;background:repeating-linear-gradient(-35deg, ${rgba(ink, kind === 'brand' ? 0.08 : 0.05)} 0 ${40 * ctx.U}px, transparent ${40 * ctx.U}px ${100 * ctx.U}px);`, l); ctx.tl.fromTo(g, { x: 0 }, { x: 200 * ctx.U, duration: Math.max(0.5, t1 - t0), ease: 'none' }, Math.max(0, t0)); },
    waves(ctx, l, kind, t0, t1) {
      const { W, H, look } = ctx; const s = sv('svg', { width: W, height: H * 0.4, viewBox: `0 0 ${W} 400`, preserveAspectRatio: 'none', style: `position:absolute;left:0;bottom:0;` }, l);
      const ps = [0, 1, 2].map((i) => sv('path', { fill: rgba(i === 1 ? look.A2 : look.A, kind === 'light' ? 0.12 + i * 0.05 : 0.18 + i * 0.06) }, s));
      drive(ctx, t0, Math.max(0.5, t1 - t0), (p) => ps.forEach((path, i) => { let d = `M0 400 L0 ${120 + i * 80}`; for (let x = 0; x <= W; x += W / 20) d += ` L${x} ${(120 + i * 80 + 30 * Math.sin((x / W) * Math.PI * 2 + p * 6 + i * 1.7)).toFixed(1)}`; path.setAttribute('d', d + ` L${W} 400 Z`); }));
    },
    rings(ctx, l, kind, t0, t1) { const { W, H, look } = ctx; for (let i = 0; i < 6; i++) { const z = W * (0.4 + i * 0.32); const r = el('div', `position:absolute;left:50%;top:46%;width:${z}px;height:${z}px;margin:${-z / 2}px 0 0 ${-z / 2}px;border-radius:50%;border:${2 * ctx.U}px solid ${rgba(kind === 'light' ? look.A : '#FFFFFF', 0.12 - i * 0.012)};`, l); ctx.tl.fromTo(r, { scale: 0.9 }, { scale: 1.08, duration: Math.max(0.5, t1 - t0), ease: 'sine.inOut' }, Math.max(0, t0)); } void H; },
    bokeh(ctx, l, kind, t0, t1) { const { W, H, look, U } = ctx; const r = seeded(77); for (let i = 0; i < 16; i++) { const z = (60 + r() * 220) * U; const b = el('div', `position:absolute;left:${r() * W}px;top:${r() * H}px;width:${z}px;height:${z}px;margin:${-z / 2}px;border-radius:50%;background:radial-gradient(circle, ${rgba(i % 3 ? look.A : look.A2, kind === 'light' ? 0.18 : 0.3)}, transparent 70%);filter:blur(${r() * 8}px);`, l); ctx.tl.fromTo(b, { y: 0, x: 0 }, { y: -(40 + r() * 140) * U, x: (r() - 0.5) * 100 * U, duration: Math.max(0.5, t1 - t0), ease: 'sine.inOut' }, Math.max(0, t0)); } },
    shapes(ctx, l, kind, t0, t1) { const { W, H, look, U } = ctx; const r = seeded(41); const rad = ['50%', '0', '30%']; for (let i = 0; i < 8; i++) { const z = (80 + r() * 160) * U; const b = el('div', `position:absolute;left:${r() * W}px;top:${(i < 4 ? r() * 0.22 : 0.78 + r() * 0.2) * H}px;width:${z}px;height:${z}px;margin:${-z / 2}px;border-radius:${rad[i % 3]};border:${4 * U}px solid ${rgba(i % 2 ? look.A2 : look.A, kind === 'light' ? 0.35 : 0.4)};`, l); ctx.tl.fromTo(b, { rotation: r() * 90, y: 0 }, { rotation: '+=' + (40 + r() * 80), y: (r() - 0.5) * 120 * U, duration: Math.max(0.5, t1 - t0), ease: 'sine.inOut' }, Math.max(0, t0)); } },
    scan(ctx, l, kind, t0, t1) { const ink = kind === 'light' ? '#111114' : '#FFFFFF'; el('div', `position:absolute;inset:0;background:repeating-linear-gradient(0deg, ${rgba(ink, 0.05)} 0 ${2 * ctx.U}px, transparent ${2 * ctx.U}px ${7 * ctx.U}px);`, l); const bar = el('div', `position:absolute;left:0;right:0;height:${300 * ctx.U}px;background:linear-gradient(180deg, transparent, ${rgba(ctx.look.A, 0.14)}, transparent);`, l); ctx.tl.fromTo(bar, { y: -300 * ctx.U }, { y: ctx.H, duration: Math.max(0.5, t1 - t0), ease: 'none' }, Math.max(0, t0)); },
    halftone(ctx, l, kind) { const { W, look, U } = ctx; el('div', `position:absolute;right:${-W * 0.2}px;bottom:${-W * 0.15}px;width:${W * 1.1}px;height:${W * 1.1}px;background-image:radial-gradient(${rgba(kind === 'light' ? '#111114' : look.A, 0.35)} ${8 * U}px, transparent ${9 * U}px);background-size:${30 * U}px ${30 * U}px;-webkit-mask-image:radial-gradient(circle at 70% 70%, #000, transparent 65%);mask-image:radial-gradient(circle at 70% 70%, #000, transparent 65%);`, l); el('div', `position:absolute;left:${-W * 0.25}px;top:${-W * 0.2}px;width:${W * 0.9}px;height:${W * 0.9}px;background-image:radial-gradient(${rgba(look.A2, 0.3)} ${6 * U}px, transparent ${7 * U}px);background-size:${26 * U}px ${26 * U}px;-webkit-mask-image:radial-gradient(circle at 30% 30%, #000, transparent 65%);mask-image:radial-gradient(circle at 30% 30%, #000, transparent 65%);`, l); },
    sweep(ctx, l, kind, t0, t1) { const g = el('div', `position:absolute;inset:-40%;background:conic-gradient(from 0deg at 50% 50%, ${rgba(ctx.look.A, kind === 'light' ? 0.12 : 0.22)}, transparent 25%, ${rgba(ctx.look.A2, kind === 'light' ? 0.1 : 0.18)} 50%, transparent 75%, ${rgba(ctx.look.A, kind === 'light' ? 0.12 : 0.22)});filter:blur(${60 * ctx.U}px);`, l); ctx.tl.fromTo(g, { rotation: 0 }, { rotation: 60, duration: Math.max(0.5, t1 - t0), ease: 'none' }, Math.max(0, t0)); },
    aurora(ctx, l, kind, t0, t1) { const { W, H, look, U } = ctx; [[look.A, 0.2, -10], [look.A2, 0.45, 8], [mix(look.A, look.A2, 0.5), 0.7, -6]].forEach(([c, y, r], i) => { const b = el('div', `position:absolute;left:-30%;width:160%;top:${y * H}px;height:${260 * U}px;margin-top:${-130 * U}px;background:linear-gradient(90deg, transparent, ${rgba(c, kind === 'light' ? 0.25 : 0.4)}, transparent);filter:blur(${70 * U}px);transform:rotate(${r}deg);`, l); ctx.tl.fromTo(b, { x: -W * 0.1 * (i % 2 ? -1 : 1) }, { x: W * 0.1 * (i % 2 ? -1 : 1), duration: Math.max(0.5, t1 - t0), ease: 'sine.inOut' }, Math.max(0, t0)); }); },
    topo(ctx, l, kind, t0, t1) { const { W, H, look } = ctx; const s = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;' }, l); const c = kind === 'light' ? rgba('#111114', 0.08) : rgba(look.A, 0.18); for (let i = 0; i < 9; i++) { const rx = W * (0.25 + i * 0.13), ry = rx * 0.7; sv('ellipse', { cx: W * 0.7, cy: H * 0.3, rx, ry, fill: 'none', stroke: c, 'stroke-width': 2, transform: `rotate(${-20 + i * 3} ${W * 0.7} ${H * 0.3})` }, s); } ctx.tl.fromTo(s, { rotation: -3, transformOrigin: '70% 30%' }, { rotation: 3, duration: Math.max(0.5, t1 - t0), ease: 'sine.inOut' }, Math.max(0, t0)); },
  });
  window.PIECE_BG_LIST = Object.keys(BG);

  // ================================================================== the title scene: kicker + headline + sub, spelled from atoms
  P.title = {
    family: 'text', label: 'Title', tags: { energy: 'medium' }, dur: 3.6,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind), salt = ctx.salt || '';
      const o = d.opts || {};
      const enter = o.enter || ctx.pick('title:enter' + salt, Object.keys(ENTER));
      const lay = LAYOUT[o.layout] ? o.layout : ctx.pick('title:layout' + salt, Object.keys(LAYOUT));
      const emph = o.emph || ctx.pick('title:emph' + salt, Object.keys(EMPH));
      const Lo = LAYOUT[lay], pad = (Lo.pad || [0, 0, 0, 0]).map((v) => v * U);
      const wrap = el('div', `position:absolute;inset:0;display:flex;flex-direction:column;gap:${28 * U}px;padding:${160 * U + pad[0]}px ${86 * U}px ${160 * U + pad[2]}px;${Lo.css}`, L);
      let kick = null, panel = null;
      if (d.kicker) kick = el('div', `font-family:${look.ui};font-weight:700;font-size:${32 * U}px;letter-spacing:.3em;text-transform:uppercase;color:${L.dataset.kind === 'brand' ? ink : look.A};display:flex;align-items:center;gap:${16 * U}px;`, wrap, `<i style="display:inline-block;width:${46 * U}px;height:${3 * U}px;background:currentColor"></i><span>${esc(d.kicker)}</span>`);
      let holder = wrap;
      if (Lo.panel) { panel = el('div', `position:relative;padding:${70 * U}px ${60 * U}px;border-radius:${48 * U}px;background:${L.dataset.kind === 'light' ? '#FFFFFF' : rgba('#FFFFFF', 0.08)};border:${2 * U}px solid ${rgba(ink, 0.1)};box-shadow:0 ${40 * U}px ${90 * U}px ${-30 * U}px rgba(0,0,0,.45);backdrop-filter:blur(${20 * U}px);max-width:100%;`, wrap); holder = panel; }
      if (Lo.band) { const band = el('div', `position:absolute;left:0;right:0;bottom:${250 * U}px;height:${560 * U}px;background:${look.A};transform-origin:0 50%;`, L); L.insertBefore(band, wrap); ctx.tl.fromTo(band, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'expo.inOut' }, t0); }
      const headInk = Lo.band ? on(look.A) : ink;
      const head = el('div', `position:relative;font-family:${look.display};font-weight:${look.dw};line-height:1;letter-spacing:-.03em;color:${headInk};${look.upper ? 'text-transform:uppercase;' : ''}`, holder);
      head.className = 'atom-head';
      if (Lo.ruled) { const r1 = el('div', `width:${360 * U}px;height:${3 * U}px;background:${look.A};transform-origin:50% 50%;`, wrap); wrap.insertBefore(r1, head); const r2 = el('div', `width:${360 * U}px;height:${3 * U}px;background:${look.A};`, wrap); ctx.tl.fromTo([r1, r2], { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'expo.inOut' }, t0 + 0.1); }
      // lines: the 'giant' layout puts the key word on its own huge line
      let lines = String(d.headline || '').split('|').map((x) => x.trim()).filter(Boolean);
      const keyN = String(d.key || '').toLowerCase();
      if (Lo.giant) { const all = lines.join(' ').split(/\s+/); const k = all.findIndex((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === keyN); const kw = k >= 0 ? all.splice(k, 1)[0] : all.pop(); lines = [all.join(' '), kw].filter(Boolean); }
      const rows = lines.map((ln, i) => { const r = el('div', `white-space:nowrap;${Lo.stagger ? `text-align:${i % 2 ? 'right' : 'left'};` : ''}`, head); chars(r, ln); return r; });
      const maxW = (panel ? W - 172 * U - 120 * U : W - 172 * U);
      let fs = (lines.length > 2 ? 150 : 176) * U;
      head.style.fontSize = fs + 'px';
      const rowFit = (r, start) => { let s = start; r.style.fontSize = s + 'px'; let k = 0; while (natural(r) > maxW && s > 30 * U && k++ < 80) { s *= 0.95; r.style.fontSize = s + 'px'; } return s; };
      if (Lo.giant) { rows[0] && (rows[0].style.fontSize = `${Math.min(fs * 0.5, rowFit(rows[0], fs * 0.5))}px`); const gs = rowFit(rows[rows.length - 1], 420 * U); rows[rows.length - 1].style.color = L.dataset.kind === 'brand' ? look.A2 : look.A; rows[rows.length - 1].style.lineHeight = '.9'; fs = gs; }
      else { const sizes = rows.map((r) => rowFit(r, fs)); const m = Math.min(...sizes); rows.forEach((r) => { r.style.fontSize = m + 'px'; }); fs = m; }
      const cs = [...head.querySelectorAll('.pw > span')], ws = [...head.querySelectorAll('.pw')];
      let sub = null;
      if (d.sub) { sub = el('div', `font-family:${look.ui};font-weight:500;font-size:${42 * U}px;line-height:1.35;max-width:${W * 0.78}px;color:${Lo.band ? rgba(on(look.A), 0.85) : rgba(ink, 0.72)};overflow:hidden;`, panel || wrap); el('div', '', sub, esc(d.sub)); }
      if (Lo.band) { wrap.style.color = on(look.A); }
      // entrance
      const t1 = (ENTER[enter] || ENTER.rise)(ctx, cs, ws, t0 + 0.25, fs);
      if (panel) ctx.tl.fromTo(panel, { y: 80 * U, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out' }, t0);
      if (kick) ctx.tl.fromTo(kick.children, { opacity: 0, x: -30 * U }, { opacity: 1, x: 0, duration: 0.7, ease: 'expo.out', stagger: 0.08 }, t0 + 0.05);
      if (sub) ctx.tl.fromTo(sub.firstChild, { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: 'expo.out' }, Math.min(t1, t0 + 1.6));
      // the key word
      const kw = ws.find((w) => w.textContent.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === keyN) || (Lo.giant ? null : ws[ws.length - 1]);
      if (kw && !Lo.giant) { kw.style.position = 'relative'; kw.style.display = 'inline-block'; (EMPH[emph] || EMPH.color)(ctx, kw, Math.min(t1 + 0.05, t0 + 2.4)); ctx.sfx.push({ t: Math.min(t1 + 0.05, t0 + 2.4), k: 'pop', v: 0.6 }); }
      ctx.sfx.push({ t: t0 + 0.2, k: 'whoosh', v: 0.6 });
      ctx.tl.fromTo(head, { scale: 1 }, { scale: 1.025, duration: this.dur, ease: 'sine.inOut' }, t0);
      L.dataset.atoms = `${enter} · ${lay} · ${emph}`;
      void H;
      return t0 + this.dur;
    },
  };

  // ================================================================== 8 more transitions
  const T = (name, label, dur, energy, fn) => { P[name] = { family: 'transition', label, tags: { energy }, dur, build(ctx, A, B, t0) { show(ctx, B, t0); const end = fn(ctx, A, B, t0, this.dur); ctx.tl.set(A, { visibility: 'hidden' }, t0 + this.dur); return end || t0 + this.dur; } }; };
  T('x-push', 'Push', 0.7, 'medium', (ctx, A, B, t0, D) => { const sg = ctx.pick('push' + ctx.salt, [-1, 1]), e = ez('expo.inOut'); drive(ctx, t0, D, (p) => { A.style.transform = `translateX(${sg * e(p) * ctx.W}px)`; B.style.transform = `translateX(${-sg * (1 - e(p)) * ctx.W}px)`; }); ctx.tl.set([A, B], { transform: 'none' }, t0 + D); ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.6 }); });
  T('x-cover', 'Cover slide', 0.75, 'medium', (ctx, A, B, t0, D) => { const v = ctx.pick('cover' + ctx.salt, ['up', 'left']), e = ez('expo.inOut'); const sh = el('div', 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;', A); drive(ctx, t0, D, (p) => { const q = e(p); B.style.transform = v === 'up' ? `translateY(${(1 - q) * ctx.H}px)` : `translateX(${(1 - q) * ctx.W}px)`; A.style.transform = `scale(${1 - q * 0.08})`; sh.style.opacity = q * 0.6; B.style.boxShadow = `0 0 ${80 * ctx.U}px rgba(0,0,0,.6)`; }); ctx.tl.set(B, { transform: 'none', boxShadow: 'none' }, t0 + D); ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.5 }); });
  T('x-doors', 'Doors', 0.9, 'high', (ctx, A, B, t0, D) => {
    const { W, look } = ctx, e = ez('expo.inOut');
    const l = el('div', `position:absolute;top:0;bottom:0;left:0;width:50.5%;z-index:40;background:${look.A};pointer-events:none;`, ctx.stage), r = el('div', `position:absolute;top:0;bottom:0;right:0;width:50.5%;z-index:40;background:${mix(look.A, '#000000', 0.12)};pointer-events:none;`, ctx.stage);
    show(ctx, l, t0); show(ctx, r, t0); ctx.tl.set(B, { visibility: 'hidden' }, t0); ctx.tl.set(B, { visibility: 'visible' }, t0 + D * 0.5);
    drive(ctx, t0, D, (p) => { const q = p < 0.5 ? 1 - e(p * 2) : e((p - 0.5) * 2); l.style.transform = `translateX(${-q * W * 0.51}px)`; r.style.transform = `translateX(${q * W * 0.51}px)`; B.style.transform = `scale(${p < 0.5 ? 1.1 : lerp(1.1, 1, e((p - 0.5) * 2))})`; });
    ctx.tl.set([l, r], { display: 'none' }, t0 + D); ctx.tl.set(B, { transform: 'none' }, t0 + D); ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.5 }, { t: t0 + D * 0.5, k: 'click', v: 0.5 });
  });
  T('x-diagonal', 'Diagonal wipe', 0.7, 'high', (ctx, A, B, t0, D) => { const { W, H } = ctx; const e = ez('power4.inOut'); const band = el('div', `position:absolute;inset:0;z-index:40;background:${ctx.look.A};pointer-events:none;`, ctx.stage); show(ctx, band, t0); const poly = (x) => `polygon(${x - W * 0.6}px 0, ${x}px 0, ${x - W * 0.6 + W * 0.6 - H * 0.35}px ${H}px, ${x - W * 0.6 - H * 0.35}px ${H}px)`; drive(ctx, t0, D, (p) => { const x = lerp(-W * 0.2, W * 2.2, e(p)); band.style.clipPath = `polygon(${x - 220 * ctx.U}px 0, ${x}px 0, ${x - H * 0.4}px ${H}px, ${x - H * 0.4 - 220 * ctx.U}px ${H}px)`; B.style.clipPath = `polygon(0 0, ${x - 220 * ctx.U}px 0, ${x - H * 0.4 - 220 * ctx.U}px ${H}px, 0 ${H}px)`; }); void poly; ctx.tl.set(B, { clipPath: 'none' }, t0 + D); ctx.tl.set(band, { display: 'none' }, t0 + D); ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.6 }); });
  T('x-blinds', 'Blinds', 0.8, 'medium', (ctx, A, B, t0, D) => { const { W, H } = ctx; const N = 8, e = ez('power3.inOut'); drive(ctx, t0, D, (p) => { const h = H / N; const pts = []; for (let i = 0; i < N; i++) { const q = e(clamp(p * 1.4 - i * 0.05)); const y0 = i * h, y1 = y0 + h * q; pts.push(`M0 ${y0} L${W} ${y0} L${W} ${y1} L0 ${y1} Z`); } B.style.clipPath = `path('${pts.join(' ')}')`; }); ctx.tl.set(B, { clipPath: 'none' }, t0 + D); ctx.sfx.push({ t: t0, k: 'tick', v: 0.5 }); });
  T('x-flash', 'Flash cut', 0.45, 'high', (ctx, A, B, t0, D) => { const f = el('div', 'position:absolute;inset:0;z-index:40;background:#fff;opacity:0;pointer-events:none;', ctx.stage); show(ctx, f, t0); ctx.tl.set(B, { visibility: 'hidden' }, t0); ctx.tl.set(B, { visibility: 'visible' }, t0 + D * 0.45); ctx.tl.fromTo(f, { opacity: 0 }, { opacity: 1, duration: D * 0.45, ease: 'power2.in' }, t0).to(f, { opacity: 0, duration: D * 0.55, ease: 'power2.out' }, t0 + D * 0.45); ctx.tl.fromTo(B, { scale: 1.12 }, { scale: 1, duration: 0.6, ease: 'expo.out', immediateRender: false }, t0 + D * 0.45); ctx.tl.set(f, { display: 'none' }, t0 + D); ctx.sfx.push({ t: t0 + D * 0.4, k: 'chime', v: 0.3 }); });
  T('x-stretch', 'Stretch', 0.6, 'high', (ctx, A, B, t0, D) => { const e = ez('power3.in'), o = ez('expo.out'); drive(ctx, t0, D, (p) => { const a = e(clamp(p / 0.5)), b = o(clamp((p - 0.45) / 0.55)); A.style.transformOrigin = '0% 50%'; A.style.transform = `scaleX(${1 - a}) scaleY(${1 + a * 0.2})`; B.style.transformOrigin = '100% 50%'; B.style.transform = `scaleX(${b}) scaleY(${1 + (1 - b) * 0.2})`; }); ctx.tl.set(B, { transform: 'none' }, t0 + D); ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.6 }); });
  T('x-swing', 'Swing', 0.85, 'medium', (ctx, A, B, t0, D) => { const e = ez('power3.inOut'); A.style.transformOrigin = '0% 100%'; B.style.transformOrigin = '100% 0%'; drive(ctx, t0, D, (p) => { const q = e(p); A.style.transform = `rotate(${q * 90}deg)`; B.style.transform = `rotate(${(1 - q) * 90}deg)`; }); ctx.tl.set(B, { transform: 'none' }, t0 + D); ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.6 }); });
  const TR = X.TRANSITIONS; TR.high.push('x-doors', 'x-diagonal', 'x-flash', 'x-stretch'); TR.medium.push('x-push', 'x-cover', 'x-blinds', 'x-swing'); TR.calm.push('x-cover', 'x-push', 'x-blinds');
})();
