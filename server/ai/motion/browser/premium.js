/* Animora Motion, premium layer: the After Effects "shape layer" craft that makes a frame feel designed.
   ACCENT  bursts, rings, zigzags, dot sprays, plus signs, corner brackets, arcs, squiggles, speed lines
   ENTER   bar reveal, 3D extrude, echo stack, chroma slam, slit reveal, 3D tilt (replace the plain ones)
   + 3 transitions (colour panels, circle stack, glitch) and 4 pieces (shape intro, word stack, glass card, light rise).
   Needs pieces.js, atoms.js, pieces2.js. */
(function () {
  'use strict';
  const P = window.PIECES, X = window.PIECE_UTILS, ENTER = window.ATOM_ENTER;
  const { el, sv, clamp, lerp, ez, esc, rgba, mix, on, drive, show, chars, fit, natural, inkOn, seeded } = X;

  // position of a node inside its scene layer, in stage pixels (works under any outside scaling)
  function boxIn(node, L) { const a = node.getBoundingClientRect(), b = L.getBoundingClientRect(), z = b.width / L.offsetWidth || 1; return { x: (a.left - b.left) / z, y: (a.top - b.top) / z, w: a.width / z, h: a.height / z }; }
  const svgIn = (ctx, L) => sv('svg', { width: ctx.W, height: ctx.H, viewBox: `0 0 ${ctx.W} ${ctx.H}`, style: 'position:absolute;inset:0;overflow:visible;pointer-events:none;' }, L);
  const trim = (ctx, path, t, dur, ease = 'power3.out', back = true) => {   // AE "trim paths": draw on, then draw off from the start
    const len = path.getTotalLength(); path.style.strokeDasharray = `${len} ${len}`; path.style.strokeDashoffset = len;
    ctx.tl.to(path.style, { strokeDashoffset: 0, duration: dur, ease }, t);
    if (back) ctx.tl.to(path.style, { strokeDashoffset: -len, duration: dur * 0.9, ease: 'power2.in' }, t + dur * 0.75);
  };
  const colorOn = (ctx, L) => { const k = L.dataset.kind; return k === 'brand' ? ctx.look.A2 : k === 'light' && X.lum(ctx.look.A) > 0.4 ? mix(ctx.look.A, '#000000', 0.45) : ctx.look.A; };

  // ================================================================== ACCENTS
  const ACCENT = (window.ATOM_ACCENT = {
    burst(ctx, L, b, t) { const s = svgIn(ctx, L), c = colorOn(ctx, L), cx = b.x + b.w + 30 * ctx.U, cy = b.y - 10 * ctx.U; for (let i = 0; i < 9; i++) { const a = (-150 + i * 20) * Math.PI / 180, r0 = 26 * ctx.U, r1 = (70 + (i % 2) * 30) * ctx.U; const p = sv('path', { d: `M${cx + Math.cos(a) * r0} ${cy + Math.sin(a) * r0} L${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1}`, stroke: c, fill: 'none', 'stroke-linecap': 'round' }, s); p.style.strokeWidth = `${7 * ctx.U}px`; trim(ctx, p, t + i * 0.012, 0.35); } },
    rings(ctx, L, b, t) { const s = svgIn(ctx, L), c = colorOn(ctx, L), cx = b.x + b.w / 2, cy = b.y + b.h / 2; [0, 1, 2].forEach((i) => { const r = sv('circle', { cx, cy, r: Math.max(b.w, b.h) * 0.55, fill: 'none', stroke: i === 1 ? ctx.look.A2 : c }, s); r.style.strokeWidth = `${(5 - i) * ctx.U}px`; r.style.transformOrigin = `${cx}px ${cy}px`; r.style.opacity = 0; ctx.tl.fromTo(r, { scale: 0.6, opacity: 1 }, { scale: 1.5 + i * 0.25, opacity: 0, duration: 1.1, ease: 'expo.out', immediateRender: false }, t + i * 0.09); }); },
    zigzag(ctx, L, b, t) { const s = svgIn(ctx, L), c = colorOn(ctx, L), st = 26 * ctx.U, x0 = Math.min(ctx.W - 8.5 * st, b.x + b.w - 4 * st), y0 = b.y + b.h + 50 * ctx.U; let d = `M${x0} ${y0}`; for (let i = 1; i <= 8; i++) d += ` L${x0 + i * st} ${y0 + (i % 2 ? -st * 0.8 : 0)}`; const p = sv('path', { d, stroke: c, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, s); p.style.strokeWidth = `${7 * ctx.U}px`; trim(ctx, p, t, 0.6, 'power2.out', false); ctx.tl.to(p, { opacity: 0, duration: 0.4 }, t + 1.8); },
    dots(ctx, L, b, t) { const c = colorOn(ctx, L), cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = seeded(Math.round(cx + cy)); for (let i = 0; i < 18; i++) { const a = r() * Math.PI * 2, d = (Math.max(b.w, b.h) * 0.5 + 60 * ctx.U + r() * 160 * ctx.U), z = (8 + r() * 14) * ctx.U; const n = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${z}px;height:${z}px;margin:${-z / 2}px;border-radius:50%;background:${i % 3 ? c : ctx.look.A2};pointer-events:none;`, L); ctx.tl.fromTo(n, { x: 0, y: 0, scale: 0 }, { x: Math.cos(a) * d, y: Math.sin(a) * d, scale: 1, duration: 0.8, ease: 'expo.out' }, t).to(n, { scale: 0, duration: 0.5, ease: 'power2.in' }, t + 0.7); } },
    plus(ctx, L, b, t) { const c = colorOn(ctx, L); [[-0.08, -0.35], [1.05, 0.1], [0.85, 1.15]].forEach(([px, py], i) => { const z = (34 + i * 10) * ctx.U; const n = el('div', `position:absolute;left:${b.x + b.w * px}px;top:${b.y + b.h * py}px;width:${z}px;height:${z}px;margin:${-z / 2}px;pointer-events:none;background:linear-gradient(${i === 1 ? ctx.look.A2 : c}, ${i === 1 ? ctx.look.A2 : c}) center/100% 26% no-repeat, linear-gradient(${i === 1 ? ctx.look.A2 : c}, ${i === 1 ? ctx.look.A2 : c}) center/26% 100% no-repeat;`, L); ctx.tl.fromTo(n, { scale: 0, rotation: -180 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2.5)' }, t + i * 0.08).to(n, { rotation: 90, duration: 2.4, ease: 'sine.inOut' }, '>'); }); },
    brackets(ctx, L, b, t) { const c = colorOn(ctx, L), m = 34 * ctx.U, k = 60 * ctx.U, s = svgIn(ctx, L); [[b.x - m, b.y - m, 1, 1], [b.x + b.w + m, b.y - m, -1, 1], [b.x - m, b.y + b.h + m, 1, -1], [b.x + b.w + m, b.y + b.h + m, -1, -1]].forEach(([x, y, sx, sy], i) => { const p = sv('path', { d: `M${x} ${y + sy * k} L${x} ${y} L${x + sx * k} ${y}`, stroke: c, fill: 'none', 'stroke-linecap': 'square' }, s); p.style.strokeWidth = `${6 * ctx.U}px`; ctx.tl.fromTo(p, { x: -sx * 40 * ctx.U, y: -sy * 40 * ctx.U, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' }, t + i * 0.04); }); },
    arc(ctx, L, b, t) { const s = svgIn(ctx, L), c = colorOn(ctx, L), cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.max(b.w, b.h) * 0.62; const p = sv('path', { d: `M${cx - R} ${cy} A ${R} ${R * 0.62} -8 1 1 ${cx + R * 0.9} ${cy - R * 0.25}`, stroke: c, fill: 'none', 'stroke-linecap': 'round' }, s); p.style.strokeWidth = `${5 * ctx.U}px`; trim(ctx, p, t, 0.9, 'power3.inOut'); },
    squiggle(ctx, L, b, t) { const s = svgIn(ctx, L), c = colorOn(ctx, L), y = b.y + b.h + 24 * ctx.U, w = Math.min(b.w, 520 * ctx.U), x0 = b.x + (b.w - w) / 2; let d = `M${x0} ${y}`; for (let i = 1; i <= 8; i++) d += ` Q${x0 + (i - 0.5) * w / 8} ${y + (i % 2 ? -18 : 18) * ctx.U} ${x0 + i * w / 8} ${y}`; const p = sv('path', { d, stroke: c, fill: 'none', 'stroke-linecap': 'round' }, s); p.style.strokeWidth = `${7 * ctx.U}px`; trim(ctx, p, t, 0.7, 'power2.out', false); },
    speed(ctx, L, b, t) { const c = colorOn(ctx, L), r = seeded(Math.round(b.y)); for (let i = 0; i < 6; i++) { const w = (140 + r() * 220) * ctx.U, y = b.y + (i + 0.5) * b.h / 6; const n = el('div', `position:absolute;left:${b.x - w - 40 * ctx.U}px;top:${y}px;width:${w}px;height:${(4 + r() * 4) * ctx.U}px;border-radius:9px;background:linear-gradient(90deg, transparent, ${i % 2 ? ctx.look.A2 : c});transform-origin:100% 50%;pointer-events:none;`, L); ctx.tl.fromTo(n, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.3, ease: 'expo.out' }, t + i * 0.03).to(n, { scaleX: 0, x: 60 * ctx.U, duration: 0.4, ease: 'power2.in' }, t + 0.35 + i * 0.03); } },
  });
  ACCENT.auto = (ctx, L, node, t, n = 2) => { const b = boxIn(node, L); const keys = Object.keys(ACCENT).filter((k) => k !== 'auto' && k !== 'squiggle'); const a = ctx.pick('accent1' + ctx.salt, keys); let c = ctx.pick('accent2' + ctx.salt, keys); if (c === a) c = keys[(keys.indexOf(a) + 3) % keys.length]; ACCENT[a](ctx, L, b, t); if (n > 1) ACCENT[c](ctx, L, b, t + 0.12); };

  // ================================================================== premium entrances
  const rowsOf = (cs) => [...new Set(cs.map((c) => c.closest('.atom-head > div, .atom-head')))];
  Object.assign(ENTER, {
    bars(ctx, cs, ws, t) {   // a colour bar sweeps across each line and leaves the words behind it
      const head = cs[0].closest('.atom-head'), rows = [...head.children].filter((r) => r.querySelector('.pw')); const c = colorOn(ctx, head.closest('[data-kind]'));
      cs.forEach((ch) => { ch.style.opacity = 0; });
      rows.forEach((r, i) => {
        r.style.position = 'relative'; const bar = el('span', `position:absolute;left:0;top:.06em;bottom:.02em;width:${natural(r)}px;background:${i % 2 ? ctx.look.A2 : c};transform:scaleX(0);transform-origin:0 50%;z-index:2;`, r);
        if (getComputedStyle(r).textAlign === 'center' || getComputedStyle(r.parentNode).textAlign === 'center') { bar.style.left = '50%'; bar.style.marginLeft = `${-natural(r) / 2}px`; } else if ((getComputedStyle(r).textAlign || '').includes('right')) { bar.style.left = 'auto'; bar.style.right = '0'; }
        const at = t + i * 0.16;
        ctx.tl.to(bar, { scaleX: 1, duration: 0.42, ease: 'expo.inOut' }, at).set(bar, { transformOrigin: '100% 50%' }, at + 0.42).to(bar, { scaleX: 0, duration: 0.42, ease: 'expo.inOut' }, at + 0.44);
        ctx.tl.set([...r.querySelectorAll('.pw > span')], { opacity: 1 }, at + 0.42);
      });
      ctx.sfx.push({ t, k: 'whoosh', v: 0.5 });
      return t + rows.length * 0.16 + 0.9;
    },
    extrude(ctx, cs, ws, t, fs) {   // 3D extruded letters swing up out of the floor
      const head = cs[0].closest('.atom-head'), deep = mix(colorOn(ctx, head.closest('[data-kind]')), '#000000', 0.45), n = 10, st = fs * 0.012;
      const shadow = (k) => Array.from({ length: n }, (_, i) => `${(i + 1) * st * k}px ${(i + 1) * st * k}px 0 ${deep}`).join(', ');
      ws.forEach((w) => { w.style.perspective = `${fs * 6}px`; });
      cs.forEach((c) => { c.style.transformOrigin = '50% 100%'; });
      ctx.tl.fromTo(cs, { rotationX: -90, opacity: 0, y: fs * 0.2 }, { rotationX: 0, opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.03 }, t);
      drive(ctx, t + 0.2, 0.9 + cs.length * 0.03, (p) => { head.style.textShadow = shadow(ez('expo.out')(p)); });
      return t + 0.7 + cs.length * 0.03;
    },
    echo(ctx, cs, ws, t, fs) {   // outlined copies of the line collapse into it
      const head = cs[0].closest('.atom-head'), host = head.parentNode, c = colorOn(ctx, head.closest('[data-kind]'));
      const ghosts = [1, 2, 3, 4].map((k) => { const g = head.cloneNode(true); g.className = ''; g.style.position = 'absolute'; g.style.left = `${head.offsetLeft}px`; g.style.top = `${head.offsetTop}px`; g.style.width = `${head.offsetWidth}px`; g.style.color = 'transparent'; g.style.webkitTextStroke = `${Math.max(2, fs * 0.012)}px ${c}`; g.style.pointerEvents = 'none'; g.querySelectorAll('span').forEach((s) => { s.style.color = 'transparent'; }); host.appendChild(g); return [g, k]; });
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      ghosts.forEach(([g, k]) => { ctx.tl.fromTo(g, { y: -k * fs * 0.55, opacity: 0.9 - k * 0.15 }, { y: 0, opacity: 0, duration: 0.9, ease: 'expo.inOut' }, t); });
      ctx.tl.fromTo(cs, { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.01 }, t + 0.55);
      ctx.tl.fromTo(head, { y: -fs * 0.4 }, { y: 0, duration: 0.9, ease: 'expo.inOut' }, t);
      return t + 1.0;
    },
    chroma(ctx, cs, ws, t, fs) {   // the words slam in with an RGB split that settles, and the frame shakes once
      const head = cs[0].closest('.atom-head'), L = head.closest('[data-kind]');
      ctx.tl.fromTo(ws, { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.32, ease: 'power4.in', stagger: 0.14 }, t);
      const land = t + 0.32 + (ws.length - 1) * 0.14;
      drive(ctx, t, land - t + 0.7, (p) => { const k = Math.max(0, 1 - Math.abs(p * (land - t + 0.7) - (land - t)) / 0.5); const a = fs * 0.05 * k; head.style.textShadow = k > 0.02 ? `${a}px 0 rgba(255,40,90,.85), ${-a}px 0 rgba(30,220,255,.85)` : 'none'; });
      ctx.tl.fromTo(L, { x: 0 }, { keyframes: [{ x: -12 * ctx.U, y: 6 * ctx.U, duration: 0.04 }, { x: 10 * ctx.U, y: -4 * ctx.U, duration: 0.04 }, { x: -5 * ctx.U, y: 0, duration: 0.04 }, { x: 0, duration: 0.05 }], immediateRender: false }, land);
      ws.forEach((w, i) => ctx.sfx.push({ t: t + 0.3 + i * 0.14, k: 'pop', v: 0.5 }));
      return land + 0.2;
    },
    slit(ctx, cs, ws, t) { ctx.tl.fromTo(cs, { clipPath: 'inset(48% 0% 48% 0%)', scaleY: 1.6, opacity: 0 }, { clipPath: 'inset(0% 0% 0% 0%)', scaleY: 1, opacity: 1, duration: 0.7, ease: 'expo.out', stagger: { each: 0.025, from: 'center' } }, t); return t + 0.5 + cs.length * 0.0125; },
    mirror(ctx, cs, ws, t, fs) { ws.forEach((w) => { w.style.perspective = `${fs * 5}px`; }); cs.forEach((c) => { c.style.transformOrigin = '50% 100%'; }); ctx.tl.fromTo(cs, { rotationX: 180, opacity: 0 }, { rotationX: 0, opacity: 1, duration: 1.0, ease: 'expo.out', stagger: 0.035 }, t); return t + 0.7 + cs.length * 0.035; },
    magnet(ctx, cs, ws, t, fs) { const head = cs[0].closest('.atom-head'); head.parentNode.style.perspective = `${fs * 7}px`; const r = seeded(cs.length * 3 + 1); ctx.tl.fromTo(cs, { z: () => fs * (4 + r() * 6), x: () => (r() - 0.5) * fs * 3, opacity: 0, filter: 'blur(14px)' }, { z: 0, x: 0, opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out', stagger: { each: 0.03, from: 'random' } }, t); return t + 1.0; },
    ink(ctx, cs, ws, t) { ctx.tl.fromTo(cs, { scale: 0.2, opacity: 0, filter: 'blur(26px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out', stagger: { each: 0.045, from: 'start' } }, t); return t + 0.9 + cs.length * 0.02; },
    domino(ctx, cs, ws, t) { cs.forEach((c) => { c.style.transformOrigin = '100% 100%'; }); ctx.tl.fromTo(cs, { rotation: 90, opacity: 0 }, { rotation: 0, opacity: 1, duration: 0.5, ease: 'bounce.out', stagger: 0.05 }, t); return t + 0.4 + cs.length * 0.05; },
    ribbon(ctx, cs, ws, t, fs) { ctx.tl.fromTo(ws, { x: -fs * 2, y: fs * 1.2, rotation: -14, skewY: 12, opacity: 0 }, { x: 0, y: 0, rotation: 0, skewY: 0, opacity: 1, duration: 1.0, ease: 'expo.out', stagger: 0.11 }, t); return t + 0.8 + ws.length * 0.11; },
    tilt(ctx, cs, ws, t, fs) { const head = cs[0].closest('.atom-head'); head.parentNode.style.perspective = `${fs * 8}px`; ctx.tl.fromTo(head, { rotationY: -75, rotationX: 20, z: -fs * 4, opacity: 0, filter: 'blur(10px)' }, { rotationY: 0, rotationX: 0, z: 0, opacity: 1, filter: 'blur(0px)', duration: 1.3, ease: 'expo.out' }, t); return t + 1.0; },
  });

  // ================================================================== premium transitions
  const T = (name, label, dur, energy, fn) => { P[name] = { family: 'transition', label, tags: { energy }, dur, build(ctx, A, B, t0) { show(ctx, B, t0); fn(ctx, A, B, t0, this.dur); ctx.tl.set(A, { visibility: 'hidden' }, t0 + this.dur); return t0 + this.dur; } }; };
  T('x-panels', 'Colour panels', 0.95, 'high', (ctx, A, B, t0, D) => {
    const cols = [ctx.look.A2, ctx.look.A, mix(ctx.look.A, '#000000', 0.35)], dir = ctx.pick('panels' + ctx.salt, [1, -1]), e = ez('expo.inOut');
    const ps = cols.map((c) => { const p = el('div', `position:absolute;inset:0;z-index:40;background:${c};pointer-events:none;`, ctx.stage); show(ctx, p, t0); return p; });
    ctx.tl.set(B, { visibility: 'hidden' }, t0); ctx.tl.set(B, { visibility: 'visible' }, t0 + D * 0.55);
    drive(ctx, t0, D, (p) => ps.forEach((n, i) => { const a = e(clamp((p - i * 0.08) / 0.5)), b = e(clamp((p - 0.45 - i * 0.08) / 0.5)); const x0 = dir > 0 ? lerp(100, 0, a) : 0, x1 = dir > 0 ? 0 : lerp(100, 0, a); n.style.clipPath = b > 0 ? (dir > 0 ? `inset(0 0 0 ${b * 100}%)` : `inset(0 ${b * 100}% 0 0)`) : `inset(0 ${x1}% 0 ${x0}%)`; }));
    ctx.tl.fromTo(B, { scale: 1.08 }, { scale: 1, duration: 0.8, ease: 'expo.out', immediateRender: false }, t0 + D * 0.55);
    ctx.tl.set(ps, { display: 'none' }, t0 + D); ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.6 });
  });
  T('x-circles', 'Circle stack', 1.0, 'medium', (ctx, A, B, t0, D) => {
    const { W, H } = ctx, cx = ctx.pick('circ:x' + ctx.salt, [0.5, 0.15, 0.85]) * W, cy = ctx.pick('circ:y' + ctx.salt, [0.5, 0.85, 0.2]) * H, R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 1.05, e = ez('expo.inOut');
    const ps = [ctx.look.A2, ctx.look.A].map((c) => { const p = el('div', `position:absolute;inset:0;z-index:40;background:${c};pointer-events:none;`, ctx.stage); show(ctx, p, t0); return p; });
    drive(ctx, t0, D, (p) => { ps.forEach((n, i) => { const a = e(clamp((p - i * 0.12) / 0.6)), b = e(clamp((p - 0.3 - i * 0.12) / 0.6)); n.style.clipPath = `path('${ring(cx, cy, a * R, b * R)}')`; }); B.style.clipPath = `circle(${e(clamp((p - 0.42) / 0.58)) * R}px at ${cx}px ${cy}px)`; });
    ctx.tl.set(B, { clipPath: 'none' }, t0 + D); ctx.tl.set(ps, { display: 'none' }, t0 + D); ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.5 });
  });
  function ring(cx, cy, ro, ri) { const c = (r, sw) => `M${cx - r} ${cy} a${r} ${r} 0 1 ${sw} ${r * 2} 0 a${r} ${r} 0 1 ${sw} ${-r * 2} 0`; return ro <= 0.5 ? 'M0 0' : c(ro, 1) + (ri > 0.5 ? ' ' + c(ri, 0) : ''); }
  T('x-glitch', 'Glitch cut', 0.5, 'high', (ctx, A, B, t0, D) => {
    const { H } = ctx, N = 7;
    ctx.tl.set(B, { visibility: 'hidden' }, t0); ctx.tl.set(B, { visibility: 'visible' }, t0 + D * 0.5);
    drive(ctx, t0, D, (p) => { const r = seeded(Math.floor(p * 18) + 3), S = p < 0.5 ? A : B, k = Math.sin(Math.PI * p); const parts = []; for (let i = 0; i < N; i++) { const y0 = (i / N) * H, y1 = ((i + 1) / N) * H, dx = (r() - 0.5) * 140 * ctx.U * k; parts.push(`M${dx} ${y0} L${ctx.W + dx} ${y0} L${ctx.W + dx} ${y1} L${dx} ${y1} Z`); } S.style.clipPath = k > 0.05 ? `path('${parts.join(' ')}')` : 'none'; S.style.filter = k > 0.05 ? `drop-shadow(${8 * k * ctx.U}px 0 rgba(255,40,90,.8)) drop-shadow(${-8 * k * ctx.U}px 0 rgba(30,220,255,.8))` : 'none'; });
    ctx.tl.set(B, { clipPath: 'none', filter: 'none' }, t0 + D); ctx.sfx.push({ t: t0, k: 'tick', v: 0.5 }, { t: t0 + 0.15, k: 'tick', v: 0.4 });
  });
  const TR = X.TRANSITIONS; TR.high.push('x-panels', 'x-glitch'); TR.medium.push('x-circles', 'x-panels'); TR.calm.push('x-circles');

  // ================================================================== premium pieces
  // 25. Shape intro: lines shoot out and draw a frame, shapes pop, then the name lands with an accent burst.
  P['open-shapes'] = {
    family: 'opener', label: 'Shape intro', tags: { energy: 'high' }, dur: 3.8,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind), c = colorOn(ctx, L), s = svgIn(ctx, L), cx = W / 2, cy = H * 0.46;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, p = sv('path', { d: `M${cx + Math.cos(a) * 60 * U} ${cy + Math.sin(a) * 60 * U} L${cx + Math.cos(a) * 520 * U} ${cy + Math.sin(a) * 520 * U}`, stroke: i % 3 ? c : look.A2, fill: 'none', 'stroke-linecap': 'round' }, s); p.style.strokeWidth = `${(i % 2 ? 6 : 12) * U}px`; trim(ctx, p, t0 + 0.05 + (i % 4) * 0.03, 0.55, 'expo.out'); }
      const fw = W - 180 * U, fh = 640 * U, fr = sv('rect', { x: cx - fw / 2, y: cy - fh / 2, width: fw, height: fh, rx: 30 * U, fill: 'none', stroke: c }, s); fr.style.strokeWidth = `${4 * U}px`; trim(ctx, fr, t0 + 0.5, 1.0, 'power2.inOut', false);
      [[0.18, 0.2, 'circle'], [0.82, 0.24, 'square'], [0.16, 0.76, 'tri'], [0.84, 0.72, 'circle']].forEach(([x, y, sh], i) => { const z = (70 + i * 14) * U; const n = el('div', `position:absolute;left:${W * x}px;top:${H * y}px;width:${z}px;height:${z}px;margin:${-z / 2}px;background:${i % 2 ? look.A2 : c};${sh === 'circle' ? 'border-radius:50%;' : sh === 'tri' ? 'clip-path:polygon(50% 0, 100% 100%, 0 100%);' : `border-radius:${14 * U}px;`}`, L); ctx.tl.fromTo(n, { scale: 0, rotation: -120 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2.4)' }, t0 + 0.4 + i * 0.07).to(n, { rotation: 45 * (i % 2 ? -1 : 1), y: -30 * U, duration: 2.6, ease: 'sine.inOut' }, '>'); });
      const name = el('div', `position:absolute;left:0;right:0;top:${cy}px;transform:translateY(-50%);text-align:center;font-family:${look.display};font-weight:${look.dw};font-size:${170 * U}px;line-height:.95;letter-spacing:-.04em;color:${ink};${look.upper ? 'text-transform:uppercase;' : ''}`, L);
      const inner = el('div', 'display:inline-block;white-space:nowrap;', name); const cs = chars(inner, d.headline || ''); fit(inner, fw - 100 * U, 170 * U, 50 * U);
      ctx.tl.fromTo(cs, { yPercent: 120, opacity: 0, rotation: 12 }, { yPercent: 0, opacity: 1, rotation: 0, duration: 0.8, ease: 'expo.out', stagger: 0.03 }, t0 + 0.9);
      if (d.sub) { const sub = el('div', `position:absolute;left:0;right:0;top:${cy + fh / 2 - 90 * U}px;text-align:center;font-family:${look.ui};font-weight:700;font-size:${34 * U}px;letter-spacing:.32em;text-transform:uppercase;color:${c};`, L, esc(d.sub)); ctx.tl.fromTo(sub, { opacity: 0, y: 20 * U }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, t0 + 1.5); }
      ACCENT.auto(ctx, L, inner, t0 + 1.3, 1);
      ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.6 }, { t: t0 + 1.0, k: 'pop', v: 0.6 });
      return t0 + this.dur;
    },
  };

  // 26. Word stack: the key word repeats in a tall stack that scrolls and locks, the centre one filled in colour.
  P['text-stack'] = {
    family: 'text', label: 'Word stack', tags: { energy: 'high' }, dur: 3.6,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind), c = colorOn(ctx, L), word = String(d.word || 'FRESH').toUpperCase();
      const fs0 = 220 * U, probe = el('div', `position:absolute;visibility:hidden;white-space:nowrap;font-family:${look.display};font-weight:${look.dw};font-size:${fs0}px;letter-spacing:-.04em;`, L, esc(word)); const fs = fit(probe, W - 120 * U, fs0, 60 * U); probe.remove();
      const lh = fs * 0.92, n = 11, mid = 5, col = el('div', `position:absolute;left:0;right:0;top:${H / 2 - lh / 2 - mid * lh}px;text-align:center;font-family:${look.display};font-weight:${look.dw};font-size:${fs}px;line-height:${lh}px;letter-spacing:-.04em;`, L);
      const rows = Array.from({ length: n }, (_, i) => el('div', `white-space:nowrap;${i === mid ? `color:${c};` : `color:transparent;-webkit-text-stroke:${Math.max(2, 3 * U)}px ${rgba(ink, Math.max(0.12, 0.5 - Math.abs(i - mid) * 0.09))};`}`, col, esc(word)));
      void rows;
      ctx.tl.fromTo(col, { y: -lh * 4 }, { y: 0, duration: 1.3, ease: 'expo.inOut' }, t0);
      ctx.tl.fromTo(col, { scale: 1.2 }, { scale: 1, duration: 1.3, ease: 'expo.out' }, t0 + 0.3);
      const tag = el('div', `position:absolute;left:50%;top:${H / 2 + lh * 0.75}px;transform:translateX(-50%);padding:${16 * U}px ${34 * U}px;border-radius:999px;background:${ink};color:${L.dataset.kind === 'light' ? '#fff' : '#111'};font-family:${look.ui};font-weight:800;font-size:${36 * U}px;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;`, L, esc(d.tag || ''));
      ctx.tl.fromTo(tag, { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(2.5)' }, t0 + 1.3);
      ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.6 }, { t: t0 + 1.25, k: 'pop', v: 0.6 });
      return t0 + this.dur;
    },
  };

  // 27. Glass card: soft colour blobs drift behind a frosted card; a shine sweeps across; the CTA pulses.
  P['end-glass'] = {
    family: 'ending', label: 'Glass card', tags: { energy: 'calm' }, dur: 4.0,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx;
      [[0.25, 0.32, look.A, 700], [0.75, 0.55, look.A2, 760], [0.4, 0.72, mix(look.A, look.A2, 0.5), 600]].forEach(([x, y, c, z], i) => { const b = el('div', `position:absolute;left:${W * x}px;top:${H * y}px;width:${z * U}px;height:${z * U}px;margin:${-z * U / 2}px;border-radius:50%;background:${c};filter:blur(${40 * U}px);opacity:.85;`, L); ctx.tl.fromTo(b, { x: 0, y: 0, scale: 0.8 }, { x: (i % 2 ? -1 : 1) * 120 * U, y: (i - 1) * 80 * U, scale: 1.1, duration: 4, ease: 'sine.inOut' }, t0); });
      const cw = W - 160 * U, card = el('div', `position:absolute;left:${80 * U}px;top:50%;width:${cw}px;padding:${80 * U}px ${60 * U}px;border-radius:${56 * U}px;background:rgba(255,255,255,.14);backdrop-filter:blur(${36 * U}px) saturate(1.4);-webkit-backdrop-filter:blur(${36 * U}px) saturate(1.4);border:${2 * U}px solid rgba(255,255,255,.35);box-shadow:0 ${40 * U}px ${100 * U}px ${-30 * U}px rgba(0,0,0,.45);text-align:center;color:#fff;font-family:${look.ui};overflow:hidden;`, L);
      el('div', `font-family:${look.display};font-weight:${look.dw};font-size:${110 * U}px;line-height:1;letter-spacing:-.03em;`, card, esc(d.name || ''));
      el('div', `margin-top:${18 * U}px;font-size:${38 * U}px;opacity:.85;`, card, esc(d.line || ''));
      const btn = el('div', `display:inline-block;margin-top:${50 * U}px;padding:${30 * U}px ${56 * U}px;border-radius:999px;background:#fff;color:${mix(look.A, '#000000', 0.2)};font-weight:800;font-size:${46 * U}px;`, card, esc(d.cta || ''));
      el('div', `margin-top:${34 * U}px;font-weight:700;font-size:${48 * U}px;letter-spacing:.02em;`, card, esc(d.phone || ''));
      const shine = el('div', `position:absolute;top:-20%;bottom:-20%;width:${200 * U}px;left:0;background:linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent);transform:skewX(-20deg);`, card);
      card.style.marginTop = `${-card.offsetHeight / 2}px`;
      ctx.tl.fromTo(card, { y: 140 * U, opacity: 0, rotationX: 25, scale: 0.92 }, { y: 0, opacity: 1, rotationX: 0, scale: 1, duration: 1.0, ease: 'expo.out' }, t0 + 0.1);
      ctx.tl.fromTo(shine, { x: -300 * U }, { x: cw + 300 * U, duration: 1.1, ease: 'power2.inOut' }, t0 + 1.1);
      ctx.tl.to(btn, { scale: 1.06, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 3 }, t0 + 1.6);
      ctx.sfx.push({ t: t0 + 0.1, k: 'whoosh', v: 0.4 }, { t: t0 + 1.2, k: 'chime', v: 0.5 });
      return t0 + this.dur;
    },
  };

  // 28. Light rise: an anamorphic light rises like a sunrise, the name forms in its glow.
  P['open-light'] = {
    family: 'opener', label: 'Light rise', tags: { energy: 'calm' }, dur: 3.8,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, cy = H * 0.5;
      const orbE = el('div', `position:absolute;left:50%;top:${cy}px;width:${700 * U}px;height:${700 * U}px;margin:${-350 * U}px;border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,.95) 0%, ${rgba(look.A, 0.8)} 18%, ${rgba(look.A, 0.25)} 45%, transparent 70%);mix-blend-mode:screen;`, L);
      const streak = el('div', `position:absolute;left:-20%;right:-20%;top:${cy}px;height:${10 * U}px;margin-top:${-5 * U}px;background:linear-gradient(90deg, transparent, ${rgba(look.A2, 0.6)} 30%, #fff 50%, ${rgba(look.A2, 0.6)} 70%, transparent);filter:blur(${2 * U}px);mix-blend-mode:screen;`, L);
      const glow = el('div', `position:absolute;left:-10%;right:-10%;top:${cy - 260 * U}px;height:${520 * U}px;background:radial-gradient(50% 50% at 50% 50%, ${rgba(look.A, 0.4)}, transparent 70%);`, L);
      ctx.tl.fromTo(orbE, { y: H * 0.35, scale: 0.4, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 1.6, ease: 'power3.out' }, t0);
      ctx.tl.fromTo(streak, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 1.2, ease: 'expo.out' }, t0 + 1.0);
      ctx.tl.fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 1.4 }, t0 + 0.8);
      ctx.tl.to(orbE, { scale: 2.6, opacity: 0.35, duration: 1.2, ease: 'power2.inOut' }, t0 + 1.7);
      const name = el('div', `position:absolute;left:0;right:0;top:${cy}px;transform:translateY(-50%);text-align:center;font-family:${look.display};font-weight:${look.dw};font-size:${180 * U}px;letter-spacing:-.03em;color:#fff;white-space:nowrap;text-shadow:0 0 ${30 * U}px ${rgba(look.A, 0.9)};${look.upper ? 'text-transform:uppercase;' : ''}`, L);
      const inner = el('span', 'display:inline-block', name); const cs = chars(inner, d.headline || ''); fit(name, W - 140 * U, 180 * U, 50 * U);
      ctx.tl.fromTo(cs, { opacity: 0, filter: 'blur(20px)', scale: 1.4 }, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 1.0, ease: 'expo.out', stagger: { each: 0.04, from: 'center' } }, t0 + 1.6);
      if (d.sub) { const s = el('div', `position:absolute;left:0;right:0;top:${cy + 140 * U}px;text-align:center;font-family:${look.ui};font-weight:600;font-size:${34 * U}px;letter-spacing:.36em;text-transform:uppercase;color:${rgba('#FFFFFF', 0.8)};`, L, esc(d.sub)); ctx.tl.fromTo(s, { opacity: 0, letterSpacing: `${30 * U}px` }, { opacity: 1, letterSpacing: `${12 * U}px`, duration: 1.2, ease: 'expo.out' }, t0 + 2.2); }
      ctx.sfx.push({ t: t0 + 0.2, k: 'whoosh', v: 0.35 }, { t: t0 + 1.7, k: 'chime', v: 0.6 });
      return t0 + this.dur;
    },
  };

  // every title gets AE-style shape accents when its key word lands
  const title = P.title, build0 = title.build;
  title.build = function (ctx, L, t0, d) { const end = build0.call(this, ctx, L, t0, d); const head = L.querySelector('.atom-head'); if (head && d.accent !== false) ACCENT.auto(ctx, L, head, t0 + 1.25, ctx.pick('accN' + ctx.salt, [1, 2, 2])); return end; };
})();
