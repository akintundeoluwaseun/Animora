/* Animora Motion pieces: the "alphabet". Each piece is one polished move that owns the full frame
   (openers, text moves, photo shots, info, endings) or bridges two frames (transitions).
   Every frame is a pure function of the timeline time, so the preview, the scrubber and the MP4 match.
     piece = { family, tags:{ energy, weight }, dur, build(ctx, layer, t0, data) }            -> scene pieces
     piece = { family:'transition', dur, build(ctx, from, to, t0) }                             -> transitions
   ctx = { stage, tl, W, H, U, px(n), look:{ display, dw, ui, A, A2, dark, ink, mute, bg }, rand } */
(function () {
  'use strict';
  const P = (window.PIECES = {});

  // ------------------------------------------------------------------ helpers
  const el = (tag, css, parent, html) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  const BG1 = d => (d.fit === 'contain' ? `url("${d.img}") center/contain no-repeat, linear-gradient(rgba(8,8,12,.64), rgba(8,8,12,.64)), url("${d.img}") center/cover` : `url("${d.img}") center/cover`);
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (p, a, b) => clamp((p - a) / (b - a));           // progress of p inside [a,b]
  const ez = (name) => gsap.parseEase(name);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hex = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const lum = (h) => { const c = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const on = (h) => (lum(h) > 0.45 ? '#0E0E12' : '#FFFFFF');
  const hashStr = (t) => { let h = 2166136261; for (const c of String(t)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  // ctx.pick(key, options): the same seed + key always gives the same choice; a new seed (another business,
  // or Regenerate) gives a different mix. This is what keeps two people's videos from looking alike.
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const picker = (seed) => (key, arr) => arr[Math.floor(mulberry((Math.imul(seed | 0, 2654435761) ^ hashStr(key)) >>> 0)() * arr.length)];
  function seeded(seed) { let s = seed % 2147483647 || 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
  // drive(): run fn(p) for p 0..1 across [at, at+dur] on the timeline (fn draws the whole frame from p)
  function drive(ctx, at, dur, fn, ease = 'none') { const o = { v: 0 }; fn(0); ctx.tl.to(o, { v: 1, duration: dur, ease, onUpdate: () => fn(o.v) }, Math.max(0, at)); }
  const show = (ctx, node, at) => { node.style.visibility = 'hidden'; ctx.tl.set(node, { visibility: 'visible' }, Math.max(0, at)); };
  const hide = (ctx, node, at) => ctx.tl.set(node, { visibility: 'hidden' }, Math.max(0, at));

  // a full-frame layer with the look's background (dark / light / brand)
  function layer(ctx, kind = ctx.look.dark ? 'dark' : 'light', t0 = 0, t1 = 6) {
    const L = ctx.look, l = el('div', 'position:absolute;inset:0;overflow:hidden;', ctx.stage);
    const bg = kind === 'brand'
      ? `radial-gradient(120% 90% at 50% 38%, ${mix(L.A, '#FFFFFF', 0.18)} 0%, ${L.A} 48%, ${mix(L.A, '#000000', 0.35)} 100%)`
      : kind === 'dark'
        ? `radial-gradient(110% 80% at 50% 40%, ${mix(L.bg || '#121216', '#FFFFFF', 0.07)} 0%, ${L.bg || '#0D0D10'} 52%, ${mix(L.bg || '#0D0D10', '#000000', 0.7)} 100%)`
        : `radial-gradient(120% 85% at 50% 42%, #FFFFFF 0%, ${L.bgLight || '#F3F2F7'} 55%, ${mix(L.bgLight || '#F3F2F7', '#000000', 0.08)} 100%)`;
    l.style.background = bg; l.dataset.kind = kind;
    const salt = ctx.salt || '';
    const extra = window.PIECE_BG_LIST || [];
    backdrop(ctx, l, kind, ctx.forceBg || ctx.pick('bg' + salt, kind === 'brand' ? ['rays', 'mesh', 'dots', 'plain', ...extra] : ['mesh', 'grid', 'spot', 'dots', 'mesh', 'plain', ...extra]), t0, t1);
    const cam = el('div', 'position:absolute;inset:0;', l); cam.dataset.kind = kind; l.inner = cam;
    // the "camera": every scene keeps moving a little, never a dead still frame
    const move = ctx.forceCam || ctx.pick('cam' + salt, ['push', 'drift', 'tilt', 'pull', 'push']), d = Math.max(0.5, t1 - t0), U = ctx.U;
    const from = { push: { scale: 1 }, pull: { scale: 1.07 }, drift: { x: -26 * U, scale: 1.02 }, tilt: { rotation: -1.2, scale: 1.03 } }[move];
    const to = { push: { scale: 1.06 }, pull: { scale: 1 }, drift: { x: 26 * U, scale: 1.02 }, tilt: { rotation: 1.2, scale: 1.05 } }[move];
    ctx.tl.fromTo(cam, from, { ...to, duration: d, ease: 'sine.inOut' }, Math.max(0, t0));
    return l;
  }
  // background worlds behind a scene (each drifts slowly with the timeline)
  function backdrop(ctx, l, kind, type, t0, t1) {
    const { W, H, U, look } = ctx, dark = kind !== 'light', d = Math.max(0.5, t1 - t0), ink = kind === 'light' ? '#111114' : '#FFFFFF';
    if (type === 'mesh') {
      const a = kind === 'brand' ? [['#FFFFFF', 0.16], [look.A2, 0.32], [mix(look.A, '#000000', 0.4), 0.5]] : [[look.A, dark ? 0.34 : 0.2], [look.A2, dark ? 0.26 : 0.18], [mix(look.A, look.A2, 0.5), dark ? 0.2 : 0.12]];
      [[0.15, 0.2, 1300, 160, 90], [0.9, 0.55, 1200, -140, -60], [0.35, 0.95, 1400, 120, -120]].forEach(([x, y, z, dx, dy], i) => orb(ctx, l, W * x, H * y, z * U, a[i][0], a[i][1], t0, t1, dx * U, dy * U));
    } else if (type === 'grid') {
      const g = el('div', `position:absolute;left:-60%;right:-60%;bottom:-6%;height:52%;transform:perspective(${700 * U}px) rotateX(68deg);transform-origin:50% 100%;background-image:linear-gradient(${rgba(ink, 0.13)} ${2 * U}px, transparent ${2 * U}px), linear-gradient(90deg, ${rgba(ink, 0.13)} ${2 * U}px, transparent ${2 * U}px);background-size:${120 * U}px ${120 * U}px;-webkit-mask-image:linear-gradient(to top, #000 10%, transparent 85%);mask-image:linear-gradient(to top, #000 10%, transparent 85%);`, l);
      ctx.tl.fromTo(g, { backgroundPosition: '0px 0px' }, { backgroundPosition: `0px ${240 * U}px`, duration: d, ease: 'none' }, Math.max(0, t0));
      el('div', `position:absolute;left:0;right:0;top:48%;height:${300 * U}px;margin-top:${-150 * U}px;background:radial-gradient(50% 50% at 50% 50%, ${rgba(look.A, dark ? 0.35 : 0.2)}, transparent 70%);`, l);
    } else if (type === 'spot') {
      const c = el('div', `position:absolute;left:50%;top:-8%;width:${W * 1.6}px;height:${H * 1.0}px;margin-left:${-W * 0.8}px;background:conic-gradient(from 180deg at 50% 0%, transparent 0deg, transparent 158deg, ${rgba(dark ? '#FFFFFF' : look.A, dark ? 0.13 : 0.1)} 170deg, ${rgba(dark ? '#FFFFFF' : look.A, dark ? 0.16 : 0.12)} 180deg, ${rgba(dark ? '#FFFFFF' : look.A, dark ? 0.13 : 0.1)} 190deg, transparent 202deg, transparent 360deg);-webkit-mask-image:linear-gradient(180deg, #000 10%, transparent 90%);mask-image:linear-gradient(180deg, #000 10%, transparent 90%);transform-origin:50% 0;`, l);
      ctx.tl.fromTo(c, { rotation: -4 }, { rotation: 4, duration: d, ease: 'sine.inOut' }, Math.max(0, t0));
      el('div', `position:absolute;left:50%;top:78%;width:${W * 1.1}px;height:${260 * U}px;margin:${-130 * U}px 0 0 ${-W * 0.55}px;border-radius:50%;background:radial-gradient(closest-side, ${rgba(dark ? '#FFFFFF' : look.A, 0.12)}, transparent);`, l);
    } else if (type === 'dots') {
      const g = el('div', `position:absolute;inset:-10%;background-image:radial-gradient(${rgba(ink, kind === 'brand' ? 0.22 : 0.14)} ${3 * U}px, transparent ${3.6 * U}px);background-size:${48 * U}px ${48 * U}px;-webkit-mask-image:radial-gradient(ellipse 70% 55% at 50% 45%, #000, transparent);mask-image:radial-gradient(ellipse 70% 55% at 50% 45%, #000, transparent);`, l);
      ctx.tl.fromTo(g, { scale: 1, rotation: 0 }, { scale: 1.12, rotation: 4, duration: d, ease: 'sine.inOut' }, Math.max(0, t0));
    } else if (window.PIECE_BG && window.PIECE_BG[type]) { window.PIECE_BG[type](ctx, l, kind, t0, t1);
    } else if (type === 'rays') {
      const g = el('div', `position:absolute;left:50%;top:44%;width:${H * 1.8}px;height:${H * 1.8}px;margin:${-H * 0.9}px 0 0 ${-H * 0.9}px;background:repeating-conic-gradient(from 0deg, rgba(255,255,255,.09) 0deg 8deg, transparent 8deg 20deg);`, l);
      ctx.tl.fromTo(g, { rotation: 0 }, { rotation: 30, duration: d, ease: 'none' }, Math.max(0, t0));
    }
  }
  function mix(a, b, t) { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  const inkOn = (ctx, kind) => (kind === 'light' ? '#111114' : kind === 'brand' ? on(ctx.look.A) : '#F6F5F8');
  // a soft glow orb drifting slowly (gives every background life)
  function orb(ctx, parent, x, y, size, color, alpha, t0, t1, dx = 0, dy = 0) {
    const o = el('div', `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;background:radial-gradient(circle, ${rgba(color, alpha)} 0%, ${rgba(color, 0)} 68%);pointer-events:none;`, parent);
    ctx.tl.fromTo(o, { x: 0, y: 0 }, { x: dx, y: dy, duration: Math.max(0.1, t1 - t0), ease: 'sine.inOut' }, Math.max(0, t0));
    return o;
  }
  // split text into word and char spans
  function chars(parent, text, cls = '') {
    const words = String(text).split(/\s+/).filter(Boolean), out = [];
    words.forEach((w, wi) => {
      const ws = el('span', 'display:inline-block;white-space:nowrap;', parent); ws.className = 'pw ' + cls;
      [...w].forEach((ch) => { const c = el('span', 'display:inline-block;will-change:transform,opacity,filter;', ws, esc(ch)); out.push(c); c.dataset.w = wi; });
      if (wi < words.length - 1) el('span', 'display:inline-block;width:.26em;', parent);
    });
    return out;
  }
  // fit a block's font-size so it fits a width (measured, fonts are loaded before build)
  // content width of a node as if it could grow freely (blocks are measured at max-content)
  function natural(node) { const w0 = node.style.width, cs = getComputedStyle(node); node.style.width = 'max-content'; const w = node.offsetWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); node.style.width = w0; return w; }
  function fit(node, maxW, start, min = 20) { let s = start; node.style.fontSize = s + 'px'; let i = 0; while (natural(node) > maxW && s > min && i++ < 80) { s *= 0.95; node.style.fontSize = s + 'px'; } return s; }
  // shared SVG defs (motion-blur filters)
  function defs(ctx) {
    if (ctx._defs) return ctx._defs;
    const s = sv('svg', { width: 0, height: 0, style: 'position:absolute' }, ctx.stage);
    ctx._defs = sv('defs', {}, s); return ctx._defs;
  }
  let fid = 0;
  function blurFilter(ctx) {   // returns { id, set(x, y) }: a directional (motion) blur
    const id = 'mb' + (++fid), f = sv('filter', { id, x: '-30%', y: '-30%', width: '160%', height: '160%', 'color-interpolation-filters': 'sRGB' }, defs(ctx));
    const g = sv('feGaussianBlur', { stdDeviation: '0 0' }, f);
    return { id, set: (x, y) => g.setAttribute('stdDeviation', `${Math.max(0, x).toFixed(2)} ${Math.max(0, y).toFixed(2)}`) };
  }

  // ------------------------------------------------------------------ finish (grain + vignette + light leak), over everything
  P.__finish = function (ctx, total, { leak = true } = {}) {
    const { W, H, tl } = ctx;
    const vig = el('div', `position:absolute;inset:0;pointer-events:none;z-index:50;background:radial-gradient(125% 90% at 50% 46%, transparent 58%, rgba(0,0,0,.28) 100%);`, ctx.stage);
    const grain = el('div', `position:absolute;inset:-60px;pointer-events:none;z-index:51;opacity:.07;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");`, ctx.stage);
    const r = seeded(99); const o = { f: 0 };
    tl.to(o, { f: 1, duration: total, ease: 'none', onUpdate: () => { const k = Math.floor(o.f * total * 24); const rr = seeded(k + 1); grain.style.transform = `translate(${Math.round(rr() * 60 - 30)}px, ${Math.round(rr() * 60 - 30)}px)`; } }, 0);
    void r; void vig;
    if (leak) {
      const lk = el('div', `position:absolute;inset:-20%;pointer-events:none;z-index:49;mix-blend-mode:screen;opacity:0;background:radial-gradient(40% 30% at 15% 20%, rgba(255,170,90,.55), transparent 70%), radial-gradient(35% 28% at 90% 85%, rgba(255,90,140,.35), transparent 70%);`, ctx.stage);
      tl.fromTo(lk, { opacity: 0, x: -W * 0.05 }, { opacity: 0.55, x: W * 0.04, duration: total * 0.45, ease: 'sine.inOut' }, 0.1);
      tl.to(lk, { opacity: 0.15, x: W * 0.08, duration: total * 0.45, ease: 'sine.inOut' }, total * 0.5);
    }
    return { vig, grain };
  };

  // ================================================================== OPENERS
  // 1. Depth fly-through: the camera travels through floating words and light, arriving on the headline.
  P['open-depth'] = {
    family: 'opener', label: 'Fly-through', tags: { energy: 'high', weight: 'premium' }, dur: 3.8,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind);
      const persp = 1100 * U;
      const world = el('div', `position:absolute;inset:0;perspective:${persp}px;perspective-origin:50% 46%;`, L);
      orb(ctx, L, W * 0.2, H * 0.25, 900 * U, look.A, 0.35, t0, t0 + 4, 120 * U, 60 * U);
      orb(ctx, L, W * 0.85, H * 0.75, 1000 * U, look.A2, 0.25, t0, t0 + 4, -100 * U, -80 * U);
      const r = ctx.rand;
      const items = [];
      // bokeh + dust in depth
      for (let i = 0; i < 46; i++) {
        const big = i < 14, s = big ? (60 + r() * 120) * U : (6 + r() * 10) * U;
        const n = el('div', `position:absolute;left:50%;top:46%;width:${s}px;height:${s}px;margin:${-s / 2}px 0 0 ${-s / 2}px;border-radius:50%;background:${big ? `radial-gradient(circle, ${rgba(i % 2 ? look.A : look.A2, 0.5)} 0%, ${rgba(look.A, 0)} 70%)` : rgba(ink, 0.9)};`, world);
        items.push({ n, x: (r() - 0.5) * W * (big ? 2.4 : 1.8), y: (r() - 0.5) * H * (big ? 1.6 : 1.3), z: -r() * 5200 * U, dot: !big });
      }
      // feature words drifting past
      (d.words || []).slice(0, 4).forEach((w, i) => {
        const n = el('div', `position:absolute;left:50%;top:46%;white-space:nowrap;font-family:${look.display};font-weight:${look.dw};font-size:${200 * U}px;letter-spacing:-.03em;color:${rgba(ink, 0.1)};-webkit-text-stroke:${3 * U}px ${rgba(i % 2 ? look.A2 : look.A, 0.9)};transform-origin:0 0;`, world, esc(w));
        const side = i % 2 ? 1 : -1;
        items.push({ n, x: side * (W * 0.2) - n.offsetWidth / 2, y: (i % 2 ? 1 : -1) * 300 * U - n.offsetHeight / 2, z: -(1200 + i * 1050) * U, word: true });
      });
      // the headline, waiting at the end of the trip
      const head = el('div', `position:absolute;left:0;right:0;top:46%;transform-origin:50% 50%;text-align:center;font-family:${look.display};font-weight:${look.dw};color:${ink};line-height:.98;letter-spacing:-.03em;padding:0 ${70 * U}px;`, world);
      const lines = String(d.headline).split('|');
      lines.forEach((ln, i) => { const row = el('div', `white-space:nowrap;${i === lines.length - 1 && look.A ? `color:${look.A};` : ''}`, head, esc(ln)); void row; });
      fit(head, W - 140 * U, 190 * U, 60 * U);
      head.style.marginTop = (-head.offsetHeight / 2) + 'px';
      const zHead = -5600 * U;
      const travel = 5600 * U, T = 3.0;
      const cam = ez('power3.inOut');
      // hyperspace streaks: lines rushing out from the centre, longer the faster the camera moves
      const cv = el('canvas', `position:absolute;inset:0;width:${W}px;height:${H}px;mix-blend-mode:screen;`, L); const DS = 0.5; cv.width = Math.round(W * DS); cv.height = Math.round(H * DS);
      const g2 = cv.getContext('2d'), stars = Array.from({ length: 260 }, () => ({ a: r() * Math.PI * 2, z: r(), w: 0.6 + r() * 1.8, c: r() < 0.3 ? look.A2 : r() < 0.6 ? look.A : '#FFFFFF' }));
      const proj = (z) => (90 * U) / Math.max(0.02, 1.02 - z);
      L.insertBefore(cv, world);
      drive(ctx, t0, T, (p) => {
        const c = cam(p) * travel;
        const sp = (cam(Math.min(1, p + 0.01)) - cam(Math.max(0, p - 0.01))) / 0.02;   // camera speed 0..~1.9
        g2.clearRect(0, 0, cv.width, cv.height); g2.save(); g2.scale(DS, DS); g2.lineCap = 'round';
        for (const st of stars) {
          const z = (st.z + cam(p) * 2.6) % 1, r1 = proj(z), r0 = proj(Math.max(0, z - 0.012 - sp * 0.05));
          if (r1 > Math.max(W, H)) continue;
          g2.globalAlpha = clamp(z * 1.6) * clamp(sp * 0.9 + 0.12); g2.strokeStyle = st.c; g2.lineWidth = st.w * U * (0.6 + z * 2.2);
          g2.beginPath(); g2.moveTo(W / 2 + Math.cos(st.a) * r0, H * 0.46 + Math.sin(st.a) * r0); g2.lineTo(W / 2 + Math.cos(st.a) * r1, H * 0.46 + Math.sin(st.a) * r1); g2.stroke();
        }
        g2.restore();
        for (const it of items) {
          const z = it.z + c;
          if (z > persp * 0.92) { it.n.style.opacity = 0; continue; }
          const near = clamp((z + 3800 * U) / (3800 * U));
          const fadeIn = clamp((z + 5000 * U) / (1200 * U));
          const fadeCam = 1 - clamp((z - persp * 0.55) / (persp * 0.35));
          it.n.style.opacity = (it.word ? 0.9 : it.dot ? 0.85 : 0.9) * fadeIn * fadeCam;
          it.n.style.transform = `translate3d(${it.x}px, ${it.y}px, ${z}px)`;
          const bl = it.dot ? (1 - near) * 2 + clamp((z) / (persp * 0.5)) * 6 : it.word ? Math.abs(z + 600 * U) / (700 * U) : 0;
          it.n.style.filter = bl > 0.3 ? `blur(${bl.toFixed(1)}px)` : 'none';
        }
        const zh = zHead + c;
        head.style.transform = `translate3d(0,0,${Math.min(0, zh)}px)`;
        head.style.filter = `blur(${clamp(-zh / (1800 * U), 0, 1) * 14}px)`;
        head.style.opacity = clamp((zh + 5200 * U) / (1600 * U));
      });
      // arrival: a soft punch + flash
      const flash = el('div', `position:absolute;inset:0;background:radial-gradient(60% 40% at 50% 46%, ${rgba(look.A, 0.55)}, transparent 70%);opacity:0;mix-blend-mode:screen;`, L);
      ctx.tl.fromTo(flash, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power2.out' }, t0 + T - 0.12).to(flash, { opacity: 0, duration: 0.7, ease: 'power2.out' }, t0 + T + 0.06);
      ctx.tl.fromTo(world, { scale: 1 }, { scale: 1.035, duration: 0.9, ease: 'power2.out' }, t0 + T - 0.05);
      const roll = ctx.pick('depth:roll' + (ctx.salt || ''), [0, 1, -1, 1]);   // straight in, or a barrel roll into the headline
      if (roll) ctx.tl.fromTo([world, cv], { rotation: roll * 38 }, { rotation: 0, duration: T, ease: 'power3.inOut', immediateRender: true }, t0);
      ctx.sfx.push({ t: t0 + 0.2, k: 'whoosh', v: 0.8 }, { t: t0 + T - 0.1, k: 'impact', v: 0.9 });
      if (d.sub) {
        const sub = el('div', `position:absolute;left:0;right:0;top:calc(46% + ${head.offsetHeight / 2 + 40 * U}px);text-align:center;font-family:${look.ui};font-weight:600;font-size:${40 * U}px;letter-spacing:.32em;text-transform:uppercase;color:${rgba(ink, 0.75)};`, L, esc(d.sub));
        ctx.tl.fromTo(sub, { opacity: 0, letterSpacing: '.6em', filter: 'blur(8px)' }, { opacity: 1, letterSpacing: '.32em', filter: 'blur(0px)', duration: 0.8, ease: 'power3.out' }, t0 + T - 0.1);
      }
      return t0 + this.dur;
    },
  };

  // 2. Light sweep: a beam of light crosses the dark and leaves the name lit in metal.
  P['open-sweep'] = {
    family: 'opener', label: 'Light sweep', tags: { energy: 'calm', weight: 'luxury' }, dur: 3.6,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx;
      const kindS = L.dataset.kind, inkS = inkOn(ctx, kindS);
      const salt = ctx.salt || '';
      const metal = ctx.pick('sweep:metal' + salt, ['brand', 'brand', 'silver', 'duo']);
      const dir = ctx.pick('sweep:dir' + salt, [1, -1]);
      const frame = ctx.pick('sweep:frame' + salt, ['lines', 'box', 'none']);
      const gold = kindS === 'light' ? ['#111114', mix(look.A, '#000000', 0.35), mix(look.A, '#000000', 0.1), '#2A2A30', '#111114']
        : kindS === 'brand' ? ['#FFFFFF', mix(look.A, '#FFFFFF', 0.75), '#FFFFFF', mix(look.A2, '#FFFFFF', 0.6), '#FFFFFF']
        : metal === 'silver' ? ['#6E6E76', '#C9CBD2', '#FFFFFF', '#B9BBC4', '#5E5E66']
        : metal === 'duo' ? [mix(look.A, '#000000', 0.3), look.A, mix(look.A2, '#FFFFFF', 0.5), look.A2, mix(look.A, '#000000', 0.2)]
          : [mix(look.A, '#000000', 0.35), look.A, mix(look.A, '#FFFFFF', 0.7), look.A, mix(look.A, '#000000', 0.25)];
      const wrap = el('div', `position:absolute;left:0;right:0;top:44%;text-align:center;padding:0 ${60 * U}px;`, L);
      const ghost = el('div', `font-family:${look.display};font-weight:${look.dw};line-height:1;letter-spacing:-.01em;white-space:nowrap;color:${rgba(inkS, 0.07)};`, wrap, esc(d.headline));
      const size = fit(ghost, W - 120 * U, 210 * U, 60 * U);
      wrap.style.marginTop = (-ghost.offsetHeight / 2) + 'px';
      const lit = el('div', `position:absolute;left:0;right:0;top:0;padding:0 ${60 * U}px;font-family:${look.display};font-weight:${look.dw};line-height:1;letter-spacing:-.01em;white-space:nowrap;font-size:${size}px;background:linear-gradient(100deg, ${gold.join(', ')});background-size:100% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;`, wrap, esc(d.headline));
      const glint = el('div', `position:absolute;left:0;right:0;top:0;padding:0 ${60 * U}px;font-family:${look.display};font-weight:${look.dw};line-height:1;letter-spacing:-.01em;white-space:nowrap;font-size:${size}px;background:linear-gradient(100deg, transparent 0%, transparent 42%, rgba(255,255,255,.95) 50%, transparent 58%, transparent 100%);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;`, wrap, esc(d.headline));
      // the beam
      const beam = el('div', `position:absolute;top:-20%;height:140%;width:${520 * U}px;left:0;margin-left:${-260 * U}px;transform:skewX(-18deg);background:linear-gradient(90deg, transparent, rgba(255,240,215,.16) 35%, rgba(255,248,235,.42) 50%, rgba(255,240,215,.16) 65%, transparent);filter:blur(${18 * U}px);mix-blend-mode:screen;`, L);
      const flare = el('div', `position:absolute;top:calc(44% - ${size * 0.7}px);left:0;width:${260 * U}px;height:${260 * U}px;margin:${-130 * U}px 0 0 ${-130 * U}px;border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,226,170,.5) 12%, transparent 60%);mix-blend-mode:screen;`, L);
      const streak = el('div', `position:absolute;top:calc(44% - ${size * 0.7}px);left:0;width:${900 * U}px;height:${4 * U}px;margin:${-2 * U}px 0 0 ${-450 * U}px;background:linear-gradient(90deg, transparent, rgba(255,235,200,.8), transparent);mix-blend-mode:screen;`, L);
      const lineL = el('div', `position:absolute;top:calc(44% + ${size * 0.62}px);right:50%;height:${2 * U}px;width:${300 * U}px;background:linear-gradient(270deg, ${look.A}, transparent);transform-origin:100% 50%;`, L);
      const lineR = el('div', `position:absolute;top:calc(44% + ${size * 0.62}px);left:50%;height:${2 * U}px;width:${300 * U}px;background:linear-gradient(90deg, ${look.A}, transparent);transform-origin:0 50%;`, L);
      const sub = el('div', `position:absolute;left:0;right:0;top:calc(44% + ${size * 0.62 + 34 * U}px);text-align:center;font-family:${look.ui};font-weight:500;font-size:${34 * U}px;letter-spacing:.42em;text-transform:uppercase;color:${rgba(look.A, 0.95)};`, L, esc(d.sub || ''));
      const T = 1.7, sweep = ez('power2.inOut');
      drive(ctx, t0 + 0.15, T, (p) => {
        const e = sweep(p), x = (dir > 0 ? lerp(-0.25, 1.25, e) : lerp(1.25, -0.25, e)) * W;
        beam.style.transform = `translateX(${x}px) skewX(-18deg)`; beam.style.opacity = Math.sin(Math.PI * clamp(p * 1.05));
        flare.style.transform = `translateX(${x + 40 * U}px) scale(${0.7 + 0.5 * Math.sin(Math.PI * p)})`; flare.style.opacity = Math.sin(Math.PI * p) * 0.9;
        streak.style.transform = `translateX(${x}px)`; streak.style.opacity = Math.sin(Math.PI * p) * 0.8;
        const m = (x / W) * 100;
        const mm = dir > 0 ? m : 100 - m;
        const mask = `linear-gradient(${dir > 0 ? 90 : 270}deg, #000 ${mm - 14}%, rgba(0,0,0,.35) ${mm - 2}%, transparent ${mm + 6}%)`;
        lit.style.webkitMaskImage = mask; lit.style.maskImage = mask;
        glint.style.backgroundPosition = `${dir > 0 ? lerp(110, -10, e) : lerp(-10, 110, e)}% 0`;
      });
      ctx.sfx.push({ t: t0 + 0.4, k: 'whoosh', v: 0.5 }, { t: t0 + 1.5, k: 'chime', v: 0.7 });
      ctx.tl.set([lit], { webkitMaskImage: 'none', maskImage: 'none' }, t0 + 0.15 + T + 0.01);
      // a second, quick glint once lit
      drive(ctx, t0 + 2.35, 0.8, (p) => { glint.style.backgroundPosition = `${lerp(110, -10, p)}% 0`; }, 'power2.inOut');
      if (frame === 'lines') ctx.tl.fromTo([lineL, lineR], { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 1.0, ease: 'expo.out' }, t0 + 1.35);
      else { lineL.remove(); lineR.remove(); }
      if (frame === 'box') {
        const bw = Math.min(W - 80 * U, natural(ghost) + 140 * U), bh = size * 1.25 + 120 * U;
        const bx = el('div', `position:absolute;left:50%;top:44%;width:${bw}px;height:${bh}px;margin:${-size * 0.62 - 50 * U}px 0 0 ${-bw / 2}px;`, L);
        const svgB = sv('svg', { width: bw, height: bh, viewBox: `0 0 ${bw} ${bh}`, style: 'position:absolute;inset:0;overflow:visible' }, bx);
        const rect = sv('rect', { x: 1, y: 1, width: bw - 2, height: bh - 2, fill: 'none', stroke: rgba(look.A, 0.7), 'stroke-width': 2 * U }, svgB);
        const per = 2 * (bw + bh); rect.style.strokeDasharray = per; rect.style.strokeDashoffset = per;
        ctx.tl.to(rect.style, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' }, t0 + 1.0);
      }
      ctx.tl.fromTo(sub, { opacity: 0, y: 14 * U, letterSpacing: '.7em' }, { opacity: 1, y: 0, letterSpacing: '.42em', duration: 1.1, ease: 'expo.out' }, t0 + 1.5);
      ctx.tl.fromTo(wrap, { scale: 1.06 }, { scale: 1, duration: 3.4, ease: 'power2.out' }, t0);
      // dust in the beam
      const r = ctx.rand;
      for (let i = 0; i < 26; i++) {
        const s = (3 + r() * 5) * U, dust = el('div', `position:absolute;left:${r() * 100}%;top:${20 + r() * 60}%;width:${s}px;height:${s}px;border-radius:50%;background:rgba(255,236,200,.9);filter:blur(${r() * 2}px);opacity:0;`, L);
        ctx.tl.fromTo(dust, { opacity: 0, y: 0 }, { opacity: 0.2 + r() * 0.6, y: -(30 + r() * 60) * U, duration: 1.6, ease: 'sine.inOut' }, t0 + 0.3 + r() * 1.2).to(dust, { opacity: 0, duration: 0.9 }, '>');
      }
      return t0 + this.dur;
    },
  };

  // ================================================================== TEXT MOVES
  // 3. Letter cascade: every letter flips up into place in 3D; the key word gets a marker sweep.
  P['text-cascade'] = {
    family: 'text', label: 'Letter cascade', tags: { energy: 'medium', weight: 'bold' }, dur: 3.2,
    build(ctx, L, t0, d) {
      const { W, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind);
      orb(ctx, L, W * 0.5, ctx.H * 0.45, 1200 * U, look.A, 0.18, t0, t0 + 3.2, 0, -60 * U);
      const gw = String(d.key || String(d.headline).split(/[\s|]+/).pop());
      const ghostOn = ctx.pick('cascade:ghost' + (ctx.salt || ''), [true, true, false]);
      const ghost = el('div', `position:absolute;left:0;top:${ctx.H * 0.62}px;white-space:nowrap;font-family:${look.display};font-weight:${look.dw};font-size:${560 * U}px;line-height:1;letter-spacing:-.04em;color:transparent;-webkit-text-stroke:${3 * U}px ${rgba(ink, 0.12)};${look.upper === false ? '' : 'text-transform:uppercase;'}`, L, esc(gw + ' ' + gw));
      ctx.tl.fromTo(ghost, { x: 80 * U }, { x: -ghost.offsetWidth * 0.32, duration: 3.2, ease: 'none' }, t0);
      ctx.tl.fromTo(ghost, { opacity: 0 }, { opacity: 1, duration: 0.8 }, t0 + 0.2);
      if (!ghostOn) ghost.style.display = 'none';
      const ghost2 = el('div', `position:absolute;left:0;top:${ctx.H * 0.06}px;white-space:nowrap;font-family:${look.display};font-weight:${look.dw};font-size:${300 * U}px;line-height:1;letter-spacing:-.04em;color:${rgba(look.A, 0.08)};text-transform:uppercase;`, L, esc((gw + ' • ').repeat(3)));
      ctx.tl.fromTo(ghost2, { x: -ghost2.offsetWidth * 0.3 }, { x: 0, duration: 3.2, ease: 'none' }, t0);
      if (!ghostOn) ghost2.style.display = 'none';
      const center = ctx.pick('cascade:align' + (ctx.salt || ''), [false, true]);
      const box = el('div', `position:absolute;left:${70 * U}px;right:${70 * U}px;top:40%;${center ? 'text-align:center;' : ''}font-family:${look.display};font-weight:${look.dw};color:${ink};line-height:1.02;letter-spacing:-.035em;perspective:${900 * U}px;`, L);
      const lines = String(d.headline).split('|');
      const rows = lines.map((ln) => el('div', 'white-space:nowrap;', box));
      let all = [];
      rows.forEach((row, i) => { all = all.concat(chars(row, lines[i]).map((c) => ({ c, row: i }))); });
      let s = 200 * U; box.style.fontSize = s + 'px'; let k = 0;
      while (rows.some((r) => natural(r) > W - 140 * U) && k++ < 60) { s *= 0.95; box.style.fontSize = s + 'px'; }
      box.style.marginTop = (-box.offsetHeight / 2) + 'px';
      all.forEach(({ c }) => { c.style.transformOrigin = '50% 100%'; });
      const salt = ctx.salt || '';
      const entry = ctx.pick('cascade:entry' + salt, ['flip', 'drop', 'zoom', 'rise']);
      const cs = all.map((a) => a.c);
      if (entry === 'flip') ctx.tl.fromTo(cs, { rotationX: -100, y: s * 0.35, opacity: 0, filter: 'blur(6px)' }, { rotationX: 0, y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.75, ease: 'back.out(1.7)', stagger: { each: 0.028 } }, t0 + 0.1);
      else if (entry === 'drop') ctx.tl.fromTo(cs, { y: -s * 1.1, opacity: 0, filter: 'blur(10px)', scaleY: 1.5 }, { y: 0, opacity: 1, filter: 'blur(0px)', scaleY: 1, duration: 0.7, ease: 'bounce.out', stagger: { each: 0.03 } }, t0 + 0.1);
      else if (entry === 'zoom') ctx.tl.fromTo(cs, { scale: 3.2, opacity: 0, filter: 'blur(14px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out', stagger: { each: 0.03, from: 'random' } }, t0 + 0.1);
      else { rows.forEach((r) => { r.style.overflow = 'hidden'; r.style.paddingBottom = '.08em'; }); ctx.tl.fromTo(cs, { yPercent: 115, rotation: 8 }, { yPercent: 0, rotation: 0, duration: 0.8, ease: 'expo.out', stagger: { each: 0.022 } }, t0 + 0.1); }
      ctx.sfx.push({ t: t0 + 0.15, k: 'whoosh', v: 0.5 });
      // the key word: a marker sweeps behind it and the word turns to the brand colour
      const key = String(d.key || '').toLowerCase();
      const words = [...box.querySelectorAll('.pw')];
      const kw = words.find((w) => w.textContent.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === key) || words[words.length - 1];
      if (kw) {
        kw.style.position = 'relative';
        const style = ctx.pick('cascade:mark' + (ctx.salt || ''), ['block', 'under', 'circle', 'color']);
        const at = t0 + 0.1 + all.length * 0.028 + 0.35;
        const letters = [...kw.children];
        if (style === 'block') {
          const mark = el('span', `position:absolute;left:-.1em;right:-.1em;top:-.02em;bottom:-.06em;background:${look.A};border-radius:.08em;transform-origin:0 50%;transform:scaleX(0);z-index:-1;`, kw);
          kw.style.zIndex = 0; kw.style.isolation = 'isolate';
          ctx.tl.to(mark, { scaleX: 1, duration: 0.5, ease: 'expo.inOut' }, at);
          ctx.tl.to(letters, { color: on(look.A), duration: 0.2 }, at + 0.22);
        } else if (style === 'under') {
          const bar = el('span', `position:absolute;left:0;right:0;bottom:-.08em;height:.12em;background:${look.A};border-radius:.06em;transform-origin:0 50%;transform:scaleX(0);`, kw);
          ctx.tl.to(bar, { scaleX: 1, duration: 0.55, ease: 'expo.inOut' }, at);
          ctx.tl.to(letters, { color: look.A, duration: 0.3 }, at + 0.1);
        } else if (style === 'circle') {
          const w = kw.offsetWidth, h = kw.offsetHeight;
          const svgC = sv('svg', { width: w * 1.3, height: h * 1.5, viewBox: '0 0 100 100', preserveAspectRatio: 'none', style: `position:absolute;left:${-w * 0.15}px;top:${-h * 0.25}px;overflow:visible;` }, kw);
          const e = sv('path', { d: 'M8 55 C 6 20, 92 12, 95 48 C 97 85, 12 92, 6 58 C 4 40, 30 22, 60 20', fill: 'none', stroke: look.A, 'stroke-width': 4, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round' }, svgC);
          e.style.strokeWidth = `${7 * U}px`; const len = e.getTotalLength(); e.style.strokeDasharray = len; e.style.strokeDashoffset = len;
          ctx.tl.to(e.style, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, at);
        } else ctx.tl.to(letters, { color: look.A, duration: 0.25, stagger: 0.03 }, at);
        ctx.sfx.push({ t: at + 0.1, k: 'pop', v: 0.6 });
      }
      ctx.tl.fromTo(box, { scale: 1 }, { scale: 1.035, duration: 3.1, ease: 'sine.inOut' }, t0);
      if (d.sub) {
        const sub = el('div', `position:absolute;left:${74 * U}px;right:${74 * U}px;top:calc(40% + ${box.offsetHeight / 2 + 36 * U}px);font-family:${look.ui};font-weight:500;font-size:${42 * U}px;line-height:1.3;color:${rgba(ink, 0.72)};overflow:hidden;`, L);
        const inner = el('div', '', sub, esc(d.sub));
        ctx.tl.fromTo(inner, { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: 'expo.out' }, t0 + 0.1 + all.length * 0.028 + 0.2);
      }
      return t0 + this.dur;
    },
  };

  // 4. Slot roll: the last word spins like a slot machine and lands, again and again.
  P['text-slot'] = {
    family: 'text', label: 'Slot roll', tags: { energy: 'high', weight: 'playful' }, dur: 4.2,
    build(ctx, L, t0, d) {
      const { W, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind);
      const fs = 190 * U, lh = fs * 1.12;
      const box = el('div', `position:absolute;left:0;right:0;top:42%;text-align:center;font-family:${look.display};font-weight:${look.dw};font-size:${fs}px;line-height:${lh}px;color:${ink};letter-spacing:-.03em;`, L);
      const lead = el('div', 'white-space:nowrap;', box, esc(d.lead || 'We deliver'));
      const winW = W - 120 * U;
      const step = lh * 1.45, winH = lh * 1.14;   // rows are spaced wider than the window, so the next word never peeks in
      const win = el('div', `position:relative;margin:${10 * U}px auto 0;height:${winH}px;width:${winW}px;overflow:hidden;border-radius:${winH / 2}px;`, box);
      const pill = el('div', `position:absolute;left:50%;top:50%;height:${winH}px;width:${winW}px;margin:${-winH / 2}px 0 0 ${-winW / 2}px;border-radius:${winH / 2}px;background:${look.A};transform-origin:50% 50%;`, win);
      const shape = ctx.pick('slot:shape' + (ctx.salt || ''), ['pill', 'box', 'tilt']);
      if (shape === 'box') pill.style.borderRadius = `${18 * U}px`;
      if (shape === 'tilt') { pill.style.borderRadius = `${14 * U}px`; pill.style.transform = 'rotate(-3deg)'; }
      const reel = el('div', `position:absolute;left:0;right:0;top:${(winH - step) / 2}px;color:${on(look.A)};`, win);
      const words = d.words || ['fresh', 'fast', 'daily'];
      const filler = ['hot', 'safe', 'today', 'right', 'quick', 'warm'];
      const seq = [];
      words.forEach((w, i) => { if (i) for (let k = 0; k < 6; k++) seq.push(filler[(k + i * 2) % filler.length]); seq.push(w); });
      seq.forEach((w) => el('div', `height:${step}px;line-height:${step}px;white-space:nowrap;`, reel, esc(w)));
      const stops = []; let idx = 0; words.forEach((w, i) => { stops.push(idx); idx += i < words.length - 1 ? 7 : 0; });
      fit(lead, W - 120 * U, fs, 50 * U);
      box.style.marginTop = (-box.offsetHeight / 2) + 'px';
      ctx.tl.fromTo(lead, { y: 60 * U, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' }, t0);
      ctx.tl.fromTo(pill, { scaleX: 0.1, scaleY: 0.4, opacity: 0 }, { scaleX: 1, scaleY: 1, opacity: 1, duration: 0.6, ease: 'expo.out' }, t0 + 0.15);
      const mb = blurFilter(ctx); reel.style.filter = `url(#${mb.id})`;
      ctx.tl.fromTo(reel, { y: step, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: 'back.out(1.6)' }, t0 + 0.3);
      // playful shapes drifting around the frame
      const rr = ctx.rand, shapes = ['50%', '28%', '0'];
      for (let i = 0; i < 9; i++) {
        const z = (90 + rr() * 170) * U, c = [look.A, look.A2, mix(look.A2, '#FFFFFF', 0.4)][i % 3];
        const sh = el('div', `position:absolute;left:${(i % 3) * 33 + rr() * 25}%;top:${i < 3 ? 6 + rr() * 14 : i < 6 ? 68 + rr() * 22 : 28 + rr() * 8}%;width:${z}px;height:${z}px;border-radius:${shapes[i % 3]};background:${c};opacity:.9;`, L);
        L.insertBefore(sh, box);
        ctx.tl.fromTo(sh, { scale: 0, rotation: rr() * 90 }, { scale: 1, rotation: '+=' + (60 + rr() * 90), duration: 0.9, ease: 'back.out(2)' }, t0 + 0.1 + i * 0.05);
        ctx.tl.to(sh, { y: (rr() - 0.5) * 120 * U, x: (rr() - 0.5) * 80 * U, rotation: '+=' + (rr() * 60), duration: 3.6, ease: 'sine.inOut' }, t0 + 1);
      }
      // spins between stops: velocity drives a vertical motion blur
      const spin = ez('power4.inOut');
      words.forEach((w, i) => {
        if (!i) return;
        const at = t0 + 0.9 + (i - 1) * 1.35, dur = 0.9, a = stops[i - 1], b = stops[i];
        drive(ctx, at, dur, (p) => {
          const e = spin(p), y = -lerp(a, b, e) * step;
          const v = Math.abs(spin(Math.min(1, p + 0.02)) - spin(Math.max(0, p - 0.02))) / 0.04;   // de/dp
          reel.style.transform = `translateY(${y}px)`; mb.set(0, v * (b - a) * step * 0.012);
        });
        ctx.tl.fromTo(pill, { scale: 1 }, { keyframes: [{ scale: 1.08, duration: 0.09, ease: 'power2.out' }, { scale: 1, duration: 0.4, ease: 'elastic.out(1, .5)' }], immediateRender: false }, at + dur - 0.02);
        ctx.tl.to(pill, { backgroundColor: i % 2 ? look.A2 : look.A, duration: 0.25 }, at + dur * 0.6);
        ctx.sfx.push({ t: at, k: 'tick', v: 0.6 }, { t: at + dur - 0.02, k: 'pop', v: 0.8 });
        ctx.tl.to(reel, { color: i % 2 ? on(look.A2) : on(look.A), duration: 0.25 }, at + dur * 0.6);
      });
      return t0 + this.dur;
    },
  };

  // ================================================================== TRANSITIONS (from -> to)
  // 5. Whip pan: both frames rush sideways with real directional motion blur and speed streaks.
  P['x-whip'] = {
    family: 'transition', label: 'Whip pan', tags: { energy: 'high' }, dur: 0.62,
    build(ctx, A, B, t0) {
      const { W, H, U } = ctx;
      const way = ctx.pick('whip:dir' + (ctx.salt || ''), ['left', 'left', 'right', 'up', 'down']);
      const hor = way === 'left' || way === 'right', sg = way === 'left' || way === 'up' ? -1 : 1, span = (hor ? W : H) * 1.15;
      const fa = blurFilter(ctx), fb = blurFilter(ctx);
      A.style.filter = `url(#${fa.id})`; B.style.filter = `url(#${fb.id})`;
      show(ctx, B, t0);
      const streaks = el('div', 'position:absolute;inset:0;z-index:40;pointer-events:none;', ctx.stage);
      const r = ctx.rand;
      const ls = Array.from({ length: 22 }, () => el('div', hor
        ? `position:absolute;left:0;top:${r() * 100}%;height:${(2 + r() * 5) * U}px;width:${(300 + r() * 700) * U}px;background:linear-gradient(90deg, transparent, rgba(255,255,255,${0.25 + r() * 0.5}), transparent);opacity:0;`
        : `position:absolute;top:0;left:${r() * 100}%;width:${(2 + r() * 5) * U}px;height:${(400 + r() * 900) * U}px;background:linear-gradient(180deg, transparent, rgba(255,255,255,${0.25 + r() * 0.5}), transparent);opacity:0;`, streaks));
      const offs = ls.map(() => r()); show(ctx, streaks, t0);
      const inE = ez('power4.in'), outE = ez('power4.out'), D = this.dur;
      const xa = (p) => sg * (p < 0.5 ? inE(p * 2) : 1) * span;
      const xb = (p) => -sg * (p < 0.42 ? 1 : 1 - outE((p - 0.42) / 0.58)) * span;
      const tr = (v) => (hor ? `translateX(${v}px)` : `translateY(${v}px)`);
      drive(ctx, t0, D, (p) => {
        const dp = 0.012;
        const va = Math.abs(xa(Math.min(1, p + dp)) - xa(Math.max(0, p - dp))) / (2 * dp * D);   // px per second
        const vb = Math.abs(xb(Math.min(1, p + dp)) - xb(Math.max(0, p - dp))) / (2 * dp * D);
        A.style.transform = `${tr(xa(p))} scale(${1 + 0.06 * Math.sin(Math.PI * Math.min(1, p * 2))})`;
        B.style.transform = `${tr(xb(p))} scale(${1 + 0.06 * (1 - outE(clamp((p - 0.42) / 0.58)))})`;
        const ba = Math.min(90, va * 0.012), bb = Math.min(90, vb * 0.012);
        if (hor) { fa.set(ba, 0); fb.set(bb, 0); } else { fa.set(0, ba); fb.set(0, bb); }
        const k = Math.sin(Math.PI * p);
        ls.forEach((l, i) => { l.style.opacity = k * 0.9; const v = lerp(-sg * (hor ? W : H) * 1.2, sg * (hor ? W : H) * 0.9, clamp(p * 1.3 - offs[i] * 0.3)); l.style.transform = tr(v); });
      });
      ctx.sfx.push({ t: t0 + 0.05, k: 'whoosh', v: 1 });
      ctx.tl.set(A, { visibility: 'hidden' }, t0 + D);
      ctx.tl.set(B, { filter: 'none', transform: 'none' }, t0 + D);
      ctx.tl.set(streaks, { display: 'none' }, t0 + D);
      return t0 + D;
    },
  };

  // 6. Liquid wipe: two waves of colour rise and pour the next frame in behind them.
  P['x-liquid'] = {
    family: 'transition', label: 'Liquid wipe', tags: { energy: 'medium' }, dur: 1.15,
    build(ctx, A, B, t0) {
      const { W, H, look } = ctx;
      const svg = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;z-index:40;pointer-events:none;' }, ctx.stage);
      const p1 = sv('path', { fill: look.A2 }, svg), p2 = sv('path', { fill: look.A }, svg); show(ctx, svg, t0);
      show(ctx, B, t0);
      const dn = ctx.pick('liquid:dir' + (ctx.salt || ''), [false, false, true]);   // waves rise, or pour down from the top
      const fy = (y) => (dn ? H - y : y);
      const pts = (y, amp, ph, k) => { const o = []; for (let x = 0; x <= W + 0.1; x += W / 24) o.push([x, fy(y + amp * Math.sin((x / W) * Math.PI * k + ph) + amp * 0.4 * Math.sin((x / W) * Math.PI * k * 2.3 - ph * 1.7))]); return o; };
      const band = (a, b) => 'M' + a.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') + ' L' + b.slice().reverse().map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') + ' Z';
      const wave = (y, amp, ph, k) => { const q = pts(y, amp, ph, k), e0 = dn ? 0 : H; return `M0 ${e0} L` + q.map(([x, yy]) => `${x.toFixed(1)} ${yy.toFixed(1)}`).join(' L') + ` L${W} ${e0} Z`; };
      const e = ez('power3.inOut'), D = this.dur;
      drive(ctx, t0, D, (p) => {
        const y1 = lerp(H * 1.15, -H * 0.25, e(clamp(p / 0.78)));
        const y2 = lerp(H * 1.15, -H * 0.25, e(clamp((p - 0.1) / 0.78)));
        const y3 = lerp(H * 1.15, -H * 0.25, e(clamp((p - 0.22) / 0.78)));
        const amp = H * 0.045 * Math.sin(Math.PI * clamp(p * 1.1));
        const w1 = pts(y1, amp, p * 9, 2.2), w2 = pts(y2, amp * 0.9, p * 9 + 1.3, 2.0), w3 = pts(y3, amp * 0.8, p * 9 + 2.4, 1.8);
        p1.setAttribute('d', band(w1, w2));
        p2.setAttribute('d', band(w2, w3));
        const ty = (1 - e(clamp((p - 0.22) / 0.78))) * H * 0.1;   // the new frame rises a little as it pours in
        const tyy = dn ? -ty : ty;
        B.style.transform = `translateY(${tyy}px)`;
        B.style.clipPath = `path('${wave(y3 - ty, amp * 0.8, p * 9 + 2.4, 1.8)}')`;
      });
      ctx.sfx.push({ t: t0 + 0.1, k: 'whoosh', v: 0.7 });
      ctx.tl.set(B, { clipPath: 'none', transform: 'none' }, t0 + D);
      ctx.tl.set(A, { visibility: 'hidden' }, t0 + D);
      ctx.tl.set(svg, { display: 'none' }, t0 + D);
      return t0 + D;
    },
  };

  // Zoom-through: the camera punches through the old frame into the new one.
  P['x-zoom'] = {
    family: 'transition', label: 'Zoom through', tags: { energy: 'high' }, dur: 0.7,
    build(ctx, A, B, t0) {
      const { W, H, look } = ctx, D = this.dur, inE = ez('power3.in'), outE = ez('expo.out');
      show(ctx, B, t0 + D * 0.38);
      const flash = el('div', `position:absolute;inset:0;z-index:40;pointer-events:none;background:radial-gradient(45% 35% at 50% 46%, rgba(255,255,255,.95), ${rgba(look.A, 0.5)} 45%, transparent 75%);opacity:0;`, ctx.stage); show(ctx, flash, t0);
      drive(ctx, t0, D, (p) => {
        const a = inE(clamp(p / 0.55)), b = outE(clamp((p - 0.38) / 0.62));
        A.style.transform = `scale(${1 + a * 2.2})`; A.style.filter = `blur(${a * 22}px)`; A.style.opacity = 1 - clamp((p - 0.3) / 0.25);
        B.style.transform = `scale(${lerp(0.55, 1, b)})`; B.style.filter = `blur(${(1 - b) * 18}px)`;
        flash.style.opacity = Math.max(0, Math.sin(Math.PI * clamp((p - 0.25) / 0.35))) * 0.9;
      });
      ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.9 }, { t: t0 + D * 0.4, k: 'impact', v: 0.6 });
      ctx.tl.set(A, { visibility: 'hidden' }, t0 + D);
      ctx.tl.set(B, { filter: 'none', transform: 'none' }, t0 + D);
      ctx.tl.set(flash, { display: 'none' }, t0 + D);
      void W; void H;
      return t0 + D;
    },
  };

  // Iris: the next frame opens as a growing circle, with a ring of colour riding its edge.
  P['x-iris'] = {
    family: 'transition', label: 'Iris', tags: { energy: 'medium' }, dur: 0.85,
    build(ctx, A, B, t0) {
      const { W, H, U, look } = ctx, D = this.dur, e = ez('expo.inOut');
      const cx = ctx.pick('iris:x' + (ctx.salt || ''), [0.5, 0.25, 0.75]) * W, cy = ctx.pick('iris:y' + (ctx.salt || ''), [0.5, 0.3, 0.7]) * H;
      const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 1.05;
      show(ctx, B, t0);
      const ring = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:2px;height:2px;z-index:40;border-radius:50%;border:${26 * U}px solid ${look.A2};pointer-events:none;`, ctx.stage); show(ctx, ring, t0);
      drive(ctx, t0, D, (p) => {
        const r = e(p) * maxR;
        B.style.clipPath = `circle(${r.toFixed(1)}px at ${cx}px ${cy}px)`;
        const rr = r + 26 * U; ring.style.width = ring.style.height = `${rr * 2}px`; ring.style.margin = `${-rr}px 0 0 ${-rr}px`;
        ring.style.opacity = p < 0.95 ? 1 : 0; ring.style.borderWidth = `${26 * U * (1 - p * 0.6)}px`;
        A.style.transform = `scale(${1 + e(p) * 0.12})`;
      });
      ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.7 });
      ctx.tl.set(A, { visibility: 'hidden' }, t0 + D);
      ctx.tl.set(B, { clipPath: 'none' }, t0 + D);
      ctx.tl.set(ring, { display: 'none' }, t0 + D);
      return t0 + D;
    },
  };

  // Shutter slices: the new frame slides in as a stack of staggered bands, led by a stripe of colour.
  P['x-slice'] = {
    family: 'transition', label: 'Shutter slices', tags: { energy: 'high' }, dur: 0.75,
    build(ctx, A, B, t0) {
      const { W, H, U, look } = ctx, D = this.dur, e = ez('power4.inOut'), N = ctx.pick('slice:n' + (ctx.salt || ''), [5, 7, 9]);
      const rev = ctx.pick('slice:dir' + (ctx.salt || ''), [false, true]);
      show(ctx, B, t0);
      const lead = el('div', `position:absolute;inset:0;z-index:40;pointer-events:none;background:${look.A2};`, ctx.stage); show(ctx, lead, t0);
      const edge = (p, lag) => Array.from({ length: N }, (_, i) => { const q = e(clamp((p - lag - i * 0.04) / (1 - N * 0.04))); return (rev ? 1 - q : q) * W * 1.04 + (rev ? 0 : 0); });
      const poly = (xa, xb) => { const h = H / N, pts = []; xa.forEach((x, i) => { pts.push(`${x}px ${i * h}px`, `${x}px ${(i + 1) * h}px`); }); xb.slice().reverse().forEach((x, j) => { const i = N - 1 - j; pts.push(`${x}px ${(i + 1) * h}px`, `${x}px ${i * h}px`); }); return `polygon(${pts.join(',')})`; };
      drive(ctx, t0, D, (p) => {
        const front = edge(p, 0), back = edge(p, 0.12), side = Array(N).fill(rev ? W * 1.04 : 0);
        lead.style.clipPath = poly(front, back);
        B.style.clipPath = poly(back, side);
        A.style.transform = `translateX(${(rev ? 1 : -1) * e(p) * 80 * U}px)`;
      });
      ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.8 });
      ctx.tl.set(A, { visibility: 'hidden' }, t0 + D);
      ctx.tl.set(B, { clipPath: 'none' }, t0 + D);
      ctx.tl.set(lead, { display: 'none' }, t0 + D);
      return t0 + D;
    },
  };

  // Cube turn: both frames are faces of a cube that turns in 3D.
  P['x-cube'] = {
    family: 'transition', label: 'Cube turn', tags: { energy: 'medium' }, dur: 0.85,
    build(ctx, A, B, t0) {
      const { W, D: _ } = { ...ctx, D: 0 }, D = this.dur, e = ez('power3.inOut');
      const sg = ctx.pick('cube:dir' + (ctx.salt || ''), [1, -1]);
      show(ctx, B, t0);
      const shadeA = el('div', 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:30;', A), shadeB = el('div', 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:30;', B);
      const persp = `perspective(${W * 2.2}px)`;
      A.style.transformOrigin = sg > 0 ? '100% 50%' : '0% 50%'; B.style.transformOrigin = sg > 0 ? '0% 50%' : '100% 50%';
      drive(ctx, t0, D, (p) => {
        const q = e(p);
        A.style.transform = `${persp} translateX(${-sg * q * W}px) rotateY(${-sg * q * 90}deg)`;
        B.style.transform = `${persp} translateX(${sg * (1 - q) * W}px) rotateY(${sg * (1 - q) * 90}deg)`;
        shadeA.style.opacity = q * 0.6; shadeB.style.opacity = (1 - q) * 0.6;
      });
      void _;
      ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.7 });
      ctx.tl.set(A, { visibility: 'hidden' }, t0 + D);
      ctx.tl.set(B, { transform: 'none' }, t0 + D);
      ctx.tl.set([shadeA, shadeB], { display: 'none' }, t0 + D);
      return t0 + D;
    },
  };

  // ================================================================== PHOTO SHOTS
  // 7. Depth card: the photo floats as a 3D card over its own blurred light, with glare and bokeh in front.
  P['photo-depth'] = {
    family: 'photo', label: 'Depth card', tags: { energy: 'calm', weight: 'premium' }, dur: 3.8,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx;
      const amb = el('div', `position:absolute;inset:-10%;background:url("${d.img}") center/cover;filter:blur(${60 * U}px) saturate(1.3) brightness(.55);transform:scale(1.2);`, L);
      ctx.tl.fromTo(amb, { scale: 1.3, opacity: 0 }, { scale: 1.15, opacity: 1, duration: 3.8, ease: 'power1.out' }, t0);
      el('div', `position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,0) 40%, rgba(0,0,0,.65) 100%);`, L);
      const stage3 = el('div', `position:absolute;inset:0;perspective:${1400 * U}px;perspective-origin:50% 40%;`, L);
      const shape = ctx.pick('depth:shape' + (ctx.salt || ''), ['rect', 'arch', 'tall', 'rect']), sgn = ctx.pick('depth:side' + (ctx.salt || ''), [1, -1]);
      const cw = W * (shape === 'tall' ? 0.7 : 0.8), ch = cw * (shape === 'tall' ? 1.32 : shape === 'arch' ? 1.2 : 1.12);
      const card = el('div', `position:absolute;left:50%;top:38%;width:${cw}px;height:${ch}px;margin:${-ch / 2}px 0 0 ${-cw / 2}px;border-radius:${44 * U}px;overflow:hidden;box-shadow:0 ${60 * U}px ${120 * U}px ${-30 * U}px rgba(0,0,0,.75), 0 0 0 ${2 * U}px rgba(255,255,255,.14);transform-style:preserve-3d;`, stage3);
      if (shape === 'arch') card.style.borderRadius = `${cw / 2}px ${cw / 2}px ${44 * U}px ${44 * U}px`;
      const img = el('div', `position:absolute;inset:-6%;background:${BG1(d)};`, card);
      const glare = el('div', `position:absolute;inset:-50%;background:linear-gradient(115deg, transparent 38%, rgba(255,255,255,.28) 48%, transparent 58%);mix-blend-mode:screen;`, card);
      const tilt = ez('power2.out'), drift = ez('sine.inOut');
      drive(ctx, t0, 3.8, (p) => {
        const a = tilt(seg(p, 0, 0.35)), b = drift(seg(p, 0.2, 1));
        card.style.transform = `translateY(${(1 - a) * 420 * U}px) rotateX(${lerp(48, 6, a) - 8 * b}deg) rotateY(${sgn * (lerp(-14, 10, a) - 18 * b)}deg) rotateZ(${sgn * lerp(-6, 0, a)}deg) scale(${lerp(0.82, 1, a)})`;
        card.style.filter = `blur(${(1 - a) * 12}px)`;
        card.style.opacity = clamp(p * 6);
        img.style.transform = `translate(${-b * 3}%, ${b * 2}%) scale(${1 + b * 0.08})`;
        glare.style.transform = `translateX(${lerp(-35, 35, b)}%)`;
      });
      // bokeh in front (moves faster: parallax)
      const r = ctx.rand;
      for (let i = 0; i < 12; i++) {
        const s = (40 + r() * 140) * U, b = el('div', `position:absolute;left:${r() * 100}%;top:${r() * 100}%;width:${s}px;height:${s}px;margin:${-s / 2}px;border-radius:50%;background:radial-gradient(circle, ${rgba(i % 3 ? '#FFE3B0' : look.A, 0.4)}, transparent 70%);filter:blur(${2 + r() * 6}px);`, L);
        ctx.tl.fromTo(b, { x: (r() - 0.5) * 200 * U, y: 160 * U, opacity: 0 }, { x: (r() - 0.5) * 200 * U, y: -220 * U, opacity: 0.4 + r() * 0.5, duration: 3.8, ease: 'sine.inOut' }, t0);
      }
      // caption
      const capTop = H * 0.38 + ch / 2 + 70 * U;
      const tag = el('div', `position:absolute;left:${80 * U}px;top:${capTop}px;display:flex;align-items:center;gap:${14 * U}px;font-family:${look.ui};font-weight:700;font-size:${30 * U}px;letter-spacing:.2em;text-transform:uppercase;color:${look.A};`, L, `<span style="width:${40 * U}px;height:${3 * U}px;background:${look.A};display:inline-block"></span>${esc(d.tag || '')}`);
      const cap = el('div', `position:absolute;left:${80 * U}px;right:${80 * U}px;top:${capTop + 56 * U}px;font-family:${look.display};font-weight:${look.dw};font-size:${118 * U}px;line-height:1.02;letter-spacing:-.02em;color:#fff;overflow:hidden;`, L);
      const capIn = el('div', '', cap, esc(d.headline));
      { let fs = 118 * U, k = 0; while (capIn.offsetHeight > fs * 1.02 * 3.2 && fs > 40 * U && k++ < 40) { fs *= 0.93; cap.style.fontSize = fs + 'px'; } }
      ctx.tl.fromTo(tag, { opacity: 0, x: -30 * U }, { opacity: 1, x: 0, duration: 0.7, ease: 'expo.out' }, t0 + 1.0);
      ctx.sfx.push({ t: t0 + 0.1, k: 'whoosh', v: 0.6 });
      ctx.tl.fromTo(capIn, { yPercent: 105 }, { yPercent: 0, duration: 0.9, ease: 'expo.out' }, t0 + 1.1);
      return t0 + this.dur;
    },
  };

  // 8. Product pop: the product bursts out of a ring of colour; callout lines draw to what matters.
  P['photo-pop'] = {
    family: 'photo', label: 'Product pop + callouts', tags: { energy: 'high', weight: 'bold' }, dur: 4.0,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind);
      const cx = W / 2, cy = H * 0.46, R = W * 0.25;
      const rays = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${H * 1.6}px;height:${H * 1.6}px;margin:${-H * 0.8}px 0 0 ${-H * 0.8}px;background:repeating-conic-gradient(from 0deg, ${rgba(look.A, 0.12)} 0deg 6deg, transparent 6deg 15deg);-webkit-mask-image:radial-gradient(circle, #000 0%, transparent 55%);mask-image:radial-gradient(circle, #000 0%, transparent 55%);`, L);
      const burstKind = ctx.pick('pop:burst' + (ctx.salt || ''), ['rays', 'dots', 'rings']);
      if (burstKind === 'dots') rays.style.background = `radial-gradient(${rgba(look.A, 0.22)} ${7 * U}px, transparent ${8 * U}px) 0 0/${52 * U}px ${52 * U}px`;
      if (burstKind === 'rings') rays.style.background = `repeating-radial-gradient(circle, ${rgba(look.A, 0.14)} 0 ${4 * U}px, transparent ${4 * U}px ${46 * U}px)`;
      ctx.sfx.push({ t: t0 + 0.2, k: 'impact', v: 0.7 }, { t: t0 + 1.0, k: 'pop', v: 0.5 }, { t: t0 + 1.4, k: 'pop', v: 0.5 }, { t: t0 + 1.8, k: 'pop', v: 0.5 });
      ctx.tl.fromTo(rays, { rotation: -10, opacity: 0, scale: 0.6 }, { rotation: 25, opacity: 1, scale: 1, duration: 4, ease: 'power2.out' }, t0);
      const disc = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${R * 2.3}px;height:${R * 2.3}px;margin:${-R * 1.15}px 0 0 ${-R * 1.15}px;border-radius:${ctx.pick('pop:mask' + (ctx.salt || ''), ['50%', '42% 58% 63% 37% / 41% 44% 56% 59%', '30%'])};background:radial-gradient(circle at 35% 30%, ${mix(look.A, '#FFFFFF', 0.25)}, ${look.A} 60%, ${mix(look.A, '#000000', 0.25)});`, L);
      const shock = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${R * 2.3}px;height:${R * 2.3}px;margin:${-R * 1.15}px 0 0 ${-R * 1.15}px;border-radius:50%;border:${6 * U}px solid ${look.A};`, L);
      const ringA = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${R * 2.75}px;height:${R * 2.75}px;margin:${-R * 1.375}px 0 0 ${-R * 1.375}px;border-radius:50%;border:${3 * U}px dashed ${rgba(ink, 0.35)};`, L);
      const shadow = el('div', `position:absolute;left:${cx}px;top:${cy + R * 0.95}px;width:${R * 1.7}px;height:${R * 0.32}px;margin:${-R * 0.16}px 0 0 ${-R * 0.85}px;border-radius:50%;background:radial-gradient(ellipse, rgba(0,0,0,.45), transparent 70%);filter:blur(${10 * U}px);`, L);
      const mask = ctx.pick('pop:mask' + (ctx.salt || ''), ['50%', '42% 58% 63% 37% / 41% 44% 56% 59%', '30%']);
      const prod = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${R * 2}px;height:${R * 2}px;margin:${-R}px 0 0 ${-R}px;border-radius:${d.fit === 'contain' ? 36 * U + 'px' : mask};overflow:hidden;background:${d.fit === 'contain' ? BG1(d) : `url("${d.img}") ${d.focus || '50% 50%'}/cover`};box-shadow:0 ${30 * U}px ${70 * U}px ${-10 * U}px rgba(0,0,0,.55), inset 0 0 0 ${8 * U}px rgba(255,255,255,.9);`, L);
      ctx.tl.fromTo(disc, { scale: 0 }, { scale: 1, duration: 0.6, ease: 'expo.out' }, t0 + 0.05);
      ctx.tl.fromTo(shock, { scale: 0.9, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 0.9, ease: 'power3.out' }, t0 + 0.25);
      ctx.tl.fromTo(prod, { scale: 0.3, rotation: -25, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.8)' }, t0 + 0.2);
      ctx.tl.fromTo(shadow, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.8)' }, t0 + 0.2);
      ctx.tl.fromTo(ringA, { scale: 0.7, rotation: 0, opacity: 0 }, { scale: 1, rotation: 90, opacity: 1, duration: 3.6, ease: 'power2.out' }, t0 + 0.35);
      ctx.tl.fromTo(prod, { y: 0 }, { y: -18 * U, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: 1 }, t0 + 1.0);
      // callouts: a dot on the product, a line that draws out, and a label card that pops at its end
      const svg = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;overflow:visible;' }, L);
      const slots = [[225, 0.27, cy - R * 1.95], [315, 0.73, cy - R * 1.95], [100, 0.5, cy + R * 1.95]];   // rim angle, label x (0..1), label y
      (d.callouts || []).slice(0, 3).forEach((txt, i) => {
        const [ang, lx, ly] = slots[i], a = (ang * Math.PI) / 180;
        const px = cx + Math.cos(a) * R * 0.92, py = cy + Math.sin(a) * R * 0.92, ex = lx * W, ey = ly + (ly < cy ? 44 * U : -44 * U);
        const path = sv('path', { d: `M${px} ${py} Q${lerp(px, ex, 0.15)} ${lerp(py, ey, 0.85)} ${ex} ${ey}`, fill: 'none', stroke: ink, 'stroke-width': 3.5 * U, 'stroke-linecap': 'round' }, svg);
        const len = path.getTotalLength(); path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
        const dot = sv('circle', { cx: px, cy: py, r: 12 * U, fill: '#fff', stroke: ink, 'stroke-width': 4 * U }, svg);
        const lab = el('div', `position:absolute;left:${ex}px;top:${ly}px;transform:translate(-50%,-50%);padding:${18 * U}px ${30 * U}px;border-radius:${999}px;background:${i === 2 ? look.A : '#FFFFFF'};color:${i === 2 ? on(look.A) : '#16130F'};font-family:${look.ui};font-weight:800;font-size:${44 * U}px;white-space:nowrap;box-shadow:0 ${16 * U}px ${36 * U}px ${-10 * U}px rgba(0,0,0,.35);`, L, esc(txt));
        const at = t0 + 1.0 + i * 0.4;
        ctx.tl.fromTo(dot, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.35, ease: 'back.out(3)', immediateRender: false }, at);
        ctx.tl.set(dot, { scale: 0, transformOrigin: '50% 50%' }, 0);
        ctx.tl.to(path.style, { strokeDashoffset: 0, duration: 0.5, ease: 'power3.inOut' }, at + 0.1);
        ctx.tl.fromTo(lab, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.2)' }, at + 0.45);
      });
      return t0 + this.dur;
    },
  };

  // ================================================================== INFO
  // 9. Price burst: a starburst punches in, the old price is struck out and the new one rolls in, confetti.
  P['info-price'] = {
    family: 'info', label: 'Price burst', tags: { energy: 'high', weight: 'bold' }, dur: 3.6,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx;
      const cx = W / 2, cy = H * 0.46, R = W * 0.43;
      const sun = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${H * 1.8}px;height:${H * 1.8}px;margin:${-H * 0.9}px 0 0 ${-H * 0.9}px;background:repeating-conic-gradient(from 0deg, rgba(255,255,255,.10) 0deg 8deg, transparent 8deg 20deg);`, L);
      ctx.tl.fromTo(sun, { rotation: 0 }, { rotation: 40, duration: 3.6, ease: 'none' }, t0);
      const shape = ctx.pick('price:shape' + (ctx.salt || ''), ['star', 'star', 'scallop', 'tag']);
      const pts = shape === 'tag' ? '8% 30%, 30% 8%, 92% 8%, 92% 92%, 30% 92%, 8% 70%'
        : Array.from({ length: shape === 'scallop' ? 72 : 36 }, (_, i) => { const a = (i / (shape === 'scallop' ? 72 : 36)) * Math.PI * 2, r = shape === 'scallop' ? 46 + 4 * Math.cos(i * Math.PI / 3) : i % 2 ? 40 : 50; return `${(50 + r * Math.cos(a)).toFixed(1)}% ${(50 + r * Math.sin(a)).toFixed(1)}%`; }).join(',');
      const burstShadow = el('div', `position:absolute;left:${cx}px;top:${cy + 30 * U}px;width:${R * 2}px;height:${R * 2}px;margin:${-R}px 0 0 ${-R}px;background:rgba(0,0,0,.22);clip-path:polygon(${pts});filter:blur(${18 * U}px);`, L);
      const burst = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${R * 2}px;height:${R * 2}px;margin:${-R}px 0 0 ${-R}px;background:radial-gradient(circle at 40% 35%, ${mix(look.A2, '#FFFFFF', 0.35)}, ${look.A2} 60%);clip-path:polygon(${pts});`, L);
      ctx.tl.fromTo([burst, burstShadow], { scale: 0, rotation: -120 }, { scale: 1, rotation: -8, duration: 0.75, ease: 'back.out(1.6)' }, t0 + 0.1);
      ctx.tl.to([burst, burstShadow], { rotation: 4, duration: 2.6, ease: 'sine.inOut' }, t0 + 0.85);
      const inner = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${R * 1.5}px;margin-left:${-R * 0.75}px;text-align:center;color:${on(look.A2)};font-family:${look.display};`, L);
      const lbl = el('div', `font-family:${look.ui};font-weight:800;font-size:${54 * U}px;letter-spacing:.2em;text-transform:uppercase;opacity:.75;`, inner, esc(d.label || 'Now only'));
      const old = el('div', `position:relative;display:inline-block;font-weight:${look.dw};font-size:${84 * U}px;opacity:.6;margin-top:${6 * U}px;`, inner, esc(d.old || ''));
      const strike = el('div', `position:absolute;left:-6%;right:-6%;top:52%;height:${8 * U}px;background:#E5383B;border-radius:${4 * U}px;transform-origin:0 50%;transform:rotate(-6deg) scaleX(0);`, old);
      // odometer: each digit rolls in its own column
      const priceRow = el('div', `display:flex;justify-content:center;align-items:baseline;font-weight:${look.dw};font-size:${200 * U}px;line-height:1;letter-spacing:-.04em;margin-top:${4 * U}px;`, inner);
      const price = String(d.price || '₦5,000');
      const cols = [];
      [...price].forEach((ch, i) => {
        if (!/\d/.test(ch)) { el('span', '', priceRow, esc(ch)); return; }
        const box = el('span', `display:inline-block;height:1em;overflow:hidden;position:relative;`, priceRow);
        const col = el('span', 'display:flex;flex-direction:column;', box);
        const spins = 2 + (i % 3);
        for (let k = 0; k < spins * 10 + +ch + 1; k++) el('span', 'height:1em;display:block;', col, String(k % 10));
        cols.push({ col, n: spins * 10 + +ch });
      });
      const mb = blurFilter(ctx); priceRow.style.filter = `url(#${mb.id})`;
      fit(priceRow, R * 1.45, 200 * U, 60 * U);
      const roll = ez('expo.out');
      drive(ctx, t0 + 0.45, 1.5, (p) => {
        let vmax = 0;
        cols.forEach((c, i) => { const q = clamp((p - i * 0.06) / (1 - i * 0.06)); const e = roll(q); c.col.style.transform = `translateY(${-e * c.n}em)`; const v = (roll(Math.min(1, q + 0.02)) - roll(Math.max(0, q - 0.02))) / 0.04 * c.n; vmax = Math.max(vmax, v); });
        mb.set(0, Math.min(14, vmax * 0.18));
      });
      gsap.set(inner, { yPercent: -50, rotation: -8 });
      ctx.tl.fromTo(inner, { scale: 0 }, { scale: 1, duration: 0.75, ease: 'back.out(1.6)' }, t0 + 0.12);
      ctx.sfx.push({ t: t0 + 0.15, k: 'impact', v: 1 }, { t: t0 + 0.5, k: 'tick', v: 0.7 }, { t: t0 + 1.0, k: 'whoosh', v: 0.4 }, { t: t0 + 1.9, k: 'chime', v: 0.9 });
      ctx.tl.to(strike, { scaleX: 1, duration: 0.35, ease: 'power3.in' }, t0 + 1.0);
      ctx.tl.fromTo(lbl, { opacity: 0, y: -20 * U }, { opacity: 0.75, y: 0, duration: 0.5, ease: 'expo.out' }, t0 + 0.4);
      ctx.tl.fromTo(old, { opacity: 0 }, { opacity: 0.6, duration: 0.3 }, t0 + 0.55);
      ctx.tl.fromTo(inner, { scale: 1 }, { keyframes: [{ scale: 1.12, duration: 0.1, ease: 'power2.out' }, { scale: 1, duration: 0.5, ease: 'elastic.out(1,.45)' }], immediateRender: false }, t0 + 1.9);
      // confetti from the burst (simple deterministic physics)
      const cv = el('canvas', `position:absolute;inset:0;width:${W}px;height:${H}px;pointer-events:none;`, L); cv.width = Math.round(W / 2); cv.height = Math.round(H / 2);
      const g = cv.getContext('2d'), r = ctx.rand, cols2 = [look.A, '#FFFFFF', look.A2, '#FFD447', '#2EC4B6'];
      const bits = Array.from({ length: 140 }, () => ({ a: r() * Math.PI * 2, v: (500 + r() * 1300) * U, w: (10 + r() * 14) * U, h: (16 + r() * 22) * U, s: (r() - 0.5) * 18, c: cols2[Math.floor(r() * cols2.length)], ph: r() * 6 }));
      drive(ctx, t0 + 1.9, 1.7, (p) => {
        const t = p * 1.7; g.clearRect(0, 0, cv.width, cv.height); g.save(); g.scale(0.5, 0.5);
        for (const b of bits) {
          const x = cx + Math.cos(b.a) * b.v * t * Math.exp(-t * 0.9), y = cy + Math.sin(b.a) * b.v * t * Math.exp(-t * 0.9) + 900 * U * t * t;
          g.save(); g.translate(x, y); g.rotate(b.s * t + b.ph); g.scale(1, Math.cos(t * 9 + b.ph)); g.globalAlpha = clamp(1.4 - t * 0.8); g.fillStyle = b.c; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); g.restore();
        }
        g.restore();
      });
      if (d.note) {
        const note = el('div', `position:absolute;left:0;right:0;top:${cy + R + 60 * U}px;text-align:center;font-family:${look.ui};font-weight:700;font-size:${46 * U}px;color:${on(look.A)};`, L, esc(d.note));
        ctx.tl.fromTo(note, { opacity: 0, y: 30 * U }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' }, t0 + 1.6);
      }
      return t0 + this.dur;
    },
  };

  // 10. Checklist stack: a 3D stack of cards; each line ticks with a drawn check.
  P['info-checks'] = {
    family: 'info', label: 'Checklist stack', tags: { energy: 'medium', weight: 'clean' }, dur: 3.8,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, dark = L.dataset.kind === 'dark';
      orb(ctx, L, W * 0.8, H * 0.2, 1000 * U, look.A, 0.22, t0, t0 + 3.8, -80 * U, 60 * U);
      orb(ctx, L, W * 0.1, H * 0.85, 900 * U, look.A2, 0.18, t0, t0 + 3.8, 60 * U, -60 * U);
      const head = el('div', `position:absolute;left:${80 * U}px;right:${80 * U}px;top:0;font-family:${look.display};font-weight:${look.dw};font-size:${136 * U}px;line-height:1;letter-spacing:-.035em;color:${dark ? '#fff' : '#111114'};`, L, esc(d.headline || ''));
      ctx.tl.fromTo(head, { opacity: 0, y: 40 * U, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out' }, t0);
      const items = (d.items || []).slice(0, 5);
      const cw = W - 140 * U, rowH = 190 * U, chH = items.length * rowH + 60 * U;
      const block = head.offsetHeight + 90 * U + chH, top0 = (H - block) / 2 - 40 * U;
      head.style.top = top0 + 'px';
      const top = top0 + head.offsetHeight + 90 * U;
      const scene = el('div', `position:absolute;left:${70 * U}px;top:${top}px;width:${cw}px;height:${chH}px;perspective:${1600 * U}px;`, L);
      const surface = dark ? '#1B1B21' : '#FFFFFF';
      [2, 1].forEach((k) => {
        const g = el('div', `position:absolute;inset:0;border-radius:${40 * U}px;background:${surface};opacity:${0.5 - k * 0.15};box-shadow:0 ${20 * U}px ${50 * U}px rgba(0,0,0,.18);`, scene);
        ctx.tl.fromTo(g, { y: 60 * U, rotationX: 50, opacity: 0 }, { y: k * 34 * U, scale: 1 - k * 0.05, rotationX: 0, opacity: 0.5 - k * 0.15, duration: 0.9, ease: 'expo.out' }, t0 + 0.15 + k * 0.06);
      });
      const card = el('div', `position:absolute;inset:0;border-radius:${40 * U}px;background:${surface};box-shadow:0 ${40 * U}px ${90 * U}px ${-20 * U}px rgba(0,0,0,${dark ? 0.7 : 0.3}), 0 0 0 ${1.5 * U}px ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'};padding:${30 * U}px ${36 * U}px;transform-origin:50% 100%;`, scene);
      ctx.tl.fromTo(card, { y: 120 * U, rotationX: 55, opacity: 0 }, { y: 0, rotationX: 0, opacity: 1, duration: 1.0, ease: 'expo.out' }, t0 + 0.1);
      items.forEach((txt, i) => {
        const row = el('div', `position:relative;display:flex;align-items:center;gap:${30 * U}px;height:${rowH}px;${i ? `border-top:${1.5 * U}px solid ${dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)'};` : ''}`, card);
        const flash = el('div', `position:absolute;inset:${8 * U}px ${-16 * U}px;border-radius:${24 * U}px;background:${rgba(look.A, 0.12)};opacity:0;`, row);
        const box = sv('svg', { width: 92 * U, height: 92 * U, viewBox: '0 0 76 76', style: 'flex:none;position:relative' }, row);
        const ring = sv('circle', { cx: 38, cy: 38, r: 33, fill: 'none', stroke: rgba(look.A, 0.3), 'stroke-width': 4 }, box);
        const fillC = sv('circle', { cx: 38, cy: 38, r: 34, fill: look.A }, box);
        const tick = sv('path', { d: 'M23 39 L34 50 L54 28', fill: 'none', stroke: on(look.A), 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, box);
        tick.style.strokeDasharray = 46; tick.style.strokeDashoffset = 46;
        const label = el('div', `position:relative;font-family:${look.ui};font-weight:700;font-size:${56 * U}px;color:${dark ? '#fff' : '#16161A'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`, row, esc(txt));
        const at = t0 + 0.75 + i * 0.42;
        void ring;
        ctx.tl.fromTo(label, { opacity: 0, x: 40 * U }, { opacity: 1, x: 0, duration: 0.55, ease: 'expo.out' }, at);
        ctx.tl.fromTo(fillC, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.4, ease: 'back.out(2.4)' }, at + 0.15);
        ctx.tl.to(tick.style, { strokeDashoffset: 0, duration: 0.3, ease: 'power2.out' }, at + 0.3);
        ctx.sfx.push({ t: at + 0.2, k: 'pop', v: 0.6 });
        ctx.tl.fromTo(flash, { opacity: 0 }, { opacity: 1, duration: 0.15 }, at + 0.15).to(flash, { opacity: 0, duration: 0.6 }, at + 0.35);
      });
      ctx.tl.to(scene, { rotationX: 4, rotationY: -4, duration: 2.5, ease: 'sine.inOut' }, t0 + 1.2);
      return t0 + this.dur;
    },
  };

  // ================================================================== ENDINGS
  // 11. Particle logo: thousands of particles swirl in and settle into the logo, then the name resolves.
  P['end-particles'] = {
    family: 'ending', label: 'Particle logo', tags: { energy: 'medium', weight: 'premium' }, dur: 4.2,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind);
      const cx = W / 2, cy = H * 0.42, size = W * 0.5;
      // the mark to form: the logo image if given, else the monogram in the display font
      const off = document.createElement('canvas'); const S = 260; off.width = S; off.height = S;
      const og = off.getContext('2d');
      const mono = String(d.mono || 'A').slice(0, 2);
      og.fillStyle = '#000'; og.textAlign = 'center'; og.textBaseline = 'middle';
      og.font = `${look.dw >= 700 ? 800 : look.dw} ${mono.length > 1 ? 150 : 200}px ${look.display}`;
      og.beginPath(); og.lineWidth = 16; og.strokeStyle = '#000'; og.arc(S / 2, S / 2, S / 2 - 10, 0, Math.PI * 2); og.stroke();
      og.fillText(mono, S / 2, S / 2 + 8);
      const px = og.getImageData(0, 0, S, S).data, targets = [];
      for (let y = 0; y < S; y += 3) for (let x = 0; x < S; x += 3) if (px[(y * S + x) * 4 + 3] > 128) targets.push([cx + (x / S - 0.5) * size, cy + (y / S - 0.5) * size]);
      const cv = el('canvas', `position:absolute;inset:0;width:${W}px;height:${H}px;`, L); const DPR = 0.6; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      const g = cv.getContext('2d'), r = ctx.rand;
      const N = Math.min(2200, targets.length);
      const form = ctx.pick('particles:form' + (ctx.salt || ''), ['swirl', 'swirl', 'rain', 'side']);
      ctx.sfx.push({ t: t0 + 0.1, k: 'whoosh', v: 0.5 }, { t: t0 + 2.35, k: 'chime', v: 1 });
      const parts = Array.from({ length: N }, (_, i) => {
        const t = targets[Math.floor((i / N) * targets.length)];
        const a = r() * Math.PI * 2, rad = (0.25 + r() * 0.75) * Math.max(W, H) * 0.5;
        const sx = form === 'rain' ? r() * W : form === 'side' ? -W * 0.1 - r() * W * 0.5 : cx + Math.cos(a) * rad;
        const sy = form === 'rain' ? -H * 0.05 - r() * H * 0.6 : form === 'side' ? r() * H : cy + Math.sin(a) * rad;
        return { tx: t[0], ty: t[1], sx, sy, sw: form === 'swirl' ? (r() - 0.5) * 5 : (r() - 0.5) * 0.6, dl: r() * 0.35, z: 0.6 + r() * 1.4, c: r() < 0.22 ? look.A2 : r() < 0.6 ? look.A : ink };
      });
      const settle = ez('power3.inOut');
      drive(ctx, t0, 2.6, (p) => {
        g.clearRect(0, 0, cv.width, cv.height); g.save(); g.scale(DPR, DPR); g.globalCompositeOperation = 'lighter';
        for (const q of parts) {
          const k = settle(clamp((p - q.dl) / (1 - q.dl)));
          const ang = (1 - k) * q.sw;   // swirl: rotate around the centre while travelling in
          const bx = lerp(q.sx, q.tx, k) - cx, by = lerp(q.sy, q.ty, k) - cy;
          const x = cx + bx * Math.cos(ang) - by * Math.sin(ang), y = cy + bx * Math.sin(ang) + by * Math.cos(ang);
          const s = q.z * U * (3 + (1 - k) * 4);
          g.globalAlpha = clamp(p * 4) * (0.35 + 0.65 * k);
          g.fillStyle = q.c; g.beginPath(); g.arc(x, y, s, 0, 6.283); g.fill();
        }
        g.restore();
      });
      ctx.tl.to(cv, { opacity: 0, duration: 0.6, ease: 'power2.out' }, t0 + 2.55);
      // the crisp mark takes over
      const mark = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;border:${size * 16 / 260}px solid ${ink};display:grid;place-items:center;font-family:${look.display};font-weight:${look.dw >= 700 ? 800 : look.dw};font-size:${size * (mono.length > 1 ? 150 : 200) / 260}px;line-height:1;color:${ink};padding-top:${size * 0.03}px;`, L, d.logo ? `<img src="${d.logo}" style="width:70%;height:70%;object-fit:contain">` : esc(mono));
      const glow = el('div', `position:absolute;left:${cx}px;top:${cy}px;width:${size * 2.2}px;height:${size * 2.2}px;margin:${-size * 1.1}px 0 0 ${-size * 1.1}px;border-radius:50%;background:radial-gradient(circle, ${rgba(look.A, 0.55)}, transparent 62%);mix-blend-mode:screen;`, L);
      ctx.tl.fromTo(mark, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' }, t0 + 2.35);
      ctx.tl.fromTo(glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' }, t0 + 2.4).to(glow, { opacity: 0.25, duration: 1.2, ease: 'power2.out' }, '>');
      const name = el('div', `position:absolute;left:0;right:0;top:${cy + size / 2 + 70 * U}px;text-align:center;font-family:${look.display};font-weight:${look.dw};font-size:${92 * U}px;letter-spacing:-.01em;color:${ink};white-space:nowrap;`, L, esc(d.name || ''));
      fit(name, W - 140 * U, 92 * U, 40 * U);
      const tag = el('div', `position:absolute;left:0;right:0;top:${cy + size / 2 + 70 * U + name.offsetHeight + 18 * U}px;text-align:center;font-family:${look.ui};font-weight:600;font-size:${34 * U}px;letter-spacing:.3em;text-transform:uppercase;color:${look.A};`, L, esc(d.tagline || ''));
      const nfs = parseFloat(name.style.fontSize);
      ctx.tl.fromTo(name, { opacity: 0, letterSpacing: `${nfs * 0.35}px`, filter: 'blur(10px)' }, { opacity: 1, letterSpacing: `${-nfs * 0.01}px`, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out' }, t0 + 2.55);
      ctx.tl.fromTo(tag, { opacity: 0, y: 20 * U }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, t0 + 2.95);
      return t0 + this.dur;
    },
  };

  // 12. Button press: a pointer glides to the call-to-action, presses it, and it opens into the contact card.
  P['end-press'] = {
    family: 'ending', label: 'Button press', tags: { energy: 'medium', weight: 'clean' }, dur: 4.2,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, dark = L.dataset.kind === 'dark';
      orb(ctx, L, W * 0.5, H * 0.5, 1300 * U, look.A, dark ? 0.3 : 0.18, t0, t0 + 4.2, 0, -50 * U);
      const bw = W * 0.78, bh = 170 * U, cx = W / 2, cy = H * 0.5;
      const btn = el('div', `position:absolute;left:${cx - bw / 2}px;top:${cy - bh / 2}px;width:${bw}px;height:${bh}px;border-radius:${bh / 2}px;background:linear-gradient(180deg, ${mix(look.A, '#FFFFFF', 0.12)}, ${look.A});color:${on(look.A)};box-shadow:0 ${30 * U}px ${70 * U}px ${-20 * U}px ${rgba(look.A, 0.8)}, inset 0 ${2 * U}px 0 rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;gap:${22 * U}px;font-family:${look.ui};font-weight:800;font-size:${58 * U}px;overflow:hidden;`, L);
      const label = el('div', 'display:flex;align-items:center;gap:.4em;white-space:nowrap;', btn, `<svg width="${60 * U}" height="${60 * U}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg><span>${esc(d.cta || 'Order on WhatsApp')}</span>`);
      fit(label, bw - 80 * U, 58 * U, 26 * U);
      const ripple = el('div', `position:absolute;left:50%;top:50%;width:${bw * 1.2}px;height:${bw * 1.2}px;margin:${-bw * 0.6}px 0 0 ${-bw * 0.6}px;border-radius:50%;background:rgba(255,255,255,.35);transform:scale(0);`, btn);
      const halo = el('div', `position:absolute;left:${cx - bw / 2}px;top:${cy - bh / 2}px;width:${bw}px;height:${bh}px;border-radius:${bh / 2}px;border:${4 * U}px solid ${look.A};opacity:0;`, L);
      if (d.headline) {
        const hd = el('div', `position:absolute;left:${80 * U}px;right:${80 * U}px;top:${H * 0.2}px;text-align:center;font-family:${look.display};font-weight:${look.dw};font-size:${130 * U}px;line-height:1;letter-spacing:-.035em;color:${dark ? '#fff' : '#111'};`, L);
        const ws = chars(hd, d.headline);
        ctx.tl.fromTo(ws, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'expo.out', stagger: 0.02 }, t0);
        ctx.tl.to(hd, { y: -60 * U, opacity: 0.35, duration: 0.8, ease: 'power2.inOut' }, t0 + 2.3);
      }
      ctx.tl.fromTo(btn, { scale: 0.6, opacity: 0, y: 80 * U }, { scale: 1, opacity: 1, y: 0, duration: 0.8, ease: 'back.out(1.6)' }, t0 + 0.05);
      // the pointer
      const hand = el('div', `position:absolute;left:0;top:0;width:${110 * U}px;height:${110 * U}px;filter:drop-shadow(0 ${10 * U}px ${14 * U}px rgba(0,0,0,.35));`, L, `<svg viewBox="0 0 32 32" width="100%" height="100%"><path d="M11 3.5c1.2 0 2.2 1 2.2 2.2v8.1l1-.2c1-.2 2 .4 2.3 1.4l.1.4.6-.2c1.1-.3 2.3.4 2.6 1.5l.1.3.4-.1c1.2-.2 2.3.6 2.5 1.8l.6 4.1c.4 3-1.3 5.9-4.1 7l-1.1.4c-2.6 1-5.6.1-7.2-2.2L6 21.3c-.7-1-.4-2.4.6-3.1.9-.6 2.1-.5 2.9.3l.4.4V5.7c0-1.2 1-2.2 2.1-2.2z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`);
      const p0 = [W * 1.05, H * 0.86], p1 = [W * 0.72, H * 0.66], p2 = [cx + bw * 0.12, cy - 10 * U];
      const glide = ez('power3.inOut');
      drive(ctx, t0 + 0.7, 1.0, (p) => {
        const e = glide(p), x = (1 - e) * (1 - e) * p0[0] + 2 * (1 - e) * e * p1[0] + e * e * p2[0], y = (1 - e) * (1 - e) * p0[1] + 2 * (1 - e) * e * p1[1] + e * e * p2[1];
        hand.style.transform = `translate(${x - 38 * U}px, ${y - 8 * U}px) rotate(${lerp(-18, -4, e)}deg)`; hand.style.opacity = clamp(p * 5);
      });
      const tp = t0 + 1.75;
      ctx.tl.to(hand, { scale: 0.86, duration: 0.1, ease: 'power2.in', transformOrigin: '35% 10%' }, tp).to(hand, { scale: 1, duration: 0.25, ease: 'power2.out' }, tp + 0.12);
      ctx.tl.to(btn, { scale: 0.94, duration: 0.1, ease: 'power2.in' }, tp).to(btn, { scale: 1, duration: 0.35, ease: 'back.out(3)' }, tp + 0.12);
      ctx.sfx.push({ t: tp, k: 'click', v: 1 }, { t: tp + 0.55, k: 'whoosh', v: 0.5 }, { t: tp + 1.1, k: 'chime', v: 0.8 });
      ctx.tl.fromTo(ripple, { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.7, ease: 'power2.out' }, tp + 0.05);
      ctx.tl.fromTo(halo, { opacity: 0.9, scale: 1 }, { opacity: 0, scale: 1.25, duration: 0.8, ease: 'power2.out', immediateRender: false }, tp + 0.05);
      ctx.tl.to(hand, { x: '+=' + 160 * U, y: '+=' + 260 * U, opacity: 0, duration: 0.6, ease: 'power2.in' }, tp + 0.45);
      // the button opens into the contact card
      const ch = 560 * U, cw = W * 0.84;
      ctx.tl.to(btn, { left: cx - cw / 2, top: cy - ch / 2, width: cw, height: ch, borderRadius: 56 * U, duration: 0.7, ease: 'expo.inOut' }, tp + 0.55);
      ctx.tl.to(label, { opacity: 0, y: -30 * U, duration: 0.25, ease: 'power2.in' }, tp + 0.5);
      const card = el('div', `position:absolute;left:${cx - cw / 2}px;top:${cy - ch / 2}px;width:${cw}px;height:${ch}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${18 * U}px;color:${on(look.A)};font-family:${look.ui};text-align:center;`, L);
      const ok = el('div', `width:${120 * U}px;height:${120 * U}px;border-radius:50%;background:rgba(255,255,255,.18);display:grid;place-items:center;`, card, `<svg width="${64 * U}" height="${64 * U}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" style="stroke-dasharray:24;stroke-dashoffset:24" class="okp"/></svg>`);
      const num = el('div', `font-weight:800;font-size:${86 * U}px;letter-spacing:-.02em;white-space:nowrap;`, card);
      const where = el('div', `font-weight:600;font-size:${40 * U}px;opacity:.85;`, card, esc(d.where || ''));
      const digits = chars(num, d.phone || '0803 555 1234');
      fit(num, cw - 80 * U, 86 * U, 30 * U);
      const ca = tp + 1.05;
      ctx.tl.fromTo(ok, { scale: 0 }, { scale: 1, duration: 0.45, ease: 'back.out(2.2)' }, ca);
      ctx.tl.to(ok.querySelector('.okp'), { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' }, ca + 0.2);
      ctx.tl.fromTo(digits, { opacity: 0, y: 30 * U }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', stagger: 0.03 }, ca + 0.25);
      ctx.tl.fromTo(where, { opacity: 0, y: 20 * U }, { opacity: 0.85, y: 0, duration: 0.6, ease: 'expo.out' }, ca + 0.7);
      return t0 + this.dur;
    },
  };

  // ------------------------------------------------------------------ building a whole video from pieces
  const TRANSITIONS = { high: ['x-whip', 'x-zoom', 'x-slice', 'x-whip', 'x-cube'], medium: ['x-liquid', 'x-iris', 'x-cube', 'x-slice', 'x-zoom'], calm: ['x-liquid', 'x-iris', 'x-cube'] };
  function makeCtx(cfg, stage) {
    const { W, H } = cfg; const U = Math.min(W, H) / 1080;
    stage = stage || document.getElementById('stage'); stage.style.cssText = `position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#000;`;
    const look = Object.assign({ display: "'Inter', sans-serif", dw: 800, ui: "'Inter', sans-serif", A: '#5B4BFF', A2: '#19D3A2', dark: true, bg: '#0D0D10' }, cfg.look);
    const tl = gsap.timeline({ paused: true });
    return Object.assign({ stage, tl, W, H, U, look, seed: cfg.seed || 11, rand: seeded(cfg.seed || 11), pick: picker(cfg.seed || 11), sfx: [], salt: '', forceBg: cfg.bg || null, forceCam: cfg.cam || null, intensity: cfg.intensity || 'medium', quality: cfg.quality || 'premium' }, cfg._ctxExtra || {});
  }
  // sound: only the app's own library, kept soft (no heavy hits)
  const SOFT = { whoosh: 0.35, pop: 0.5, tick: 0.45, chime: 0.55, click: 0.5, impact: 0 };
  function finishUp(ctx, end, cfg) {
    P.__finish(ctx, end, { leak: cfg.leak !== false });
    ctx.tl.set({}, {}, end);
    const sfx = ctx.sfx.filter((x) => x.t < end - 0.05 && (SOFT[x.k] ?? 0.4) > 0).map((x) => ({ ...x, v: +(Math.min(1, x.v ?? 1) * (SOFT[x.k] ?? 0.4)).toFixed(2) }))
      .sort((a, b) => a.t - b.t).filter((x, i, arr) => !arr.slice(Math.max(0, i - 3), i).some((y) => y.k === x.k && x.t - y.t < 0.12));
    if (!cfg.noGlobal) { window.__sfx = sfx; window.__timeline = ctx.tl; }
    return { tl: ctx.tl, sfx, duration: end };
  }
  // scenes: [{ piece, kind?, data, trans? }]; the transitions between them are picked from the seed unless given
  window.PIECE_SEQUENCE = function (cfg, stageEl) {
    const ctx = makeCtx(cfg, stageEl);
    const energy = cfg.energy || 'medium';
    let t = 0, prev = null, prevPiece = null, lastTrans = null;
    cfg.scenes.forEach((sc, i) => {
      ctx.salt = ':' + i;
      ctx.forceBg = sc.bg || cfg.bg || null; ctx.forceCam = sc.cam || cfg.cam || null;
      const piece = P[sc.piece];
      const pdur = (sc.data && sc.data.dur) || piece.dur;
      const kind = sc.kind || (ctx.look.dark ? 'dark' : 'light');
      if (!prev) {
        const Lr = layer(ctx, kind, 0, pdur + 1.2);
        t = piece.build(ctx, Lr.inner, 0.15, sc.data || {});
        prev = Lr; prevPiece = piece; return;
      }
      const pool = TRANSITIONS[energy].filter((x) => x !== lastTrans);
      const trName = sc.trans || ctx.pick('trans' + i, pool);
      const tr = P[trName];
      // a film that would run past the length asked for loses a middle scene (the closing scene always stays)
      if (cfg.target && i < cfg.scenes.length - 1) {
        const ls = cfg.scenes[cfg.scenes.length - 1], endD = (ls.data && ls.data.dur) || P[ls.piece].dur;
        if ((t - 0.12) + tr.dur * 0.45 + pdur + endD + 0.55 + 0.3 > cfg.target + 0.2) return;
      }
      lastTrans = trName;
      const ts = t - 0.12;                                    // overlap the end of the last scene a little
      const Lr = layer(ctx, kind, ts, ts + tr.dur + pdur + 1.2);
      Lr.style.visibility = 'hidden';
      tr.build(ctx, prev, Lr, ts);
      t = piece.build(ctx, Lr.inner, ts + tr.dur * 0.45, sc.data || {});
      prev = Lr; prevPiece = piece;
    });
    void prevPiece;
    // land on the exact length asked for: a small gap is a calm hold on the closing card (never a stretched scene)
    const endAt = t + 0.3, gap = cfg.target ? cfg.target - endAt : 0;
    return finishUp(ctx, gap > 0.05 && gap <= 4 ? cfg.target : endAt, cfg);
  };
  // demo of one piece (with a plain frame either side for a transition)
  window.PIECE_DEMO = function (cfg, stageEl) {
    const ctx = makeCtx(cfg, stageEl); const { W, H, U, look, tl } = ctx;
    const piece = P[cfg.piece];
    let end;
    if (piece.family === 'transition') {
      const A = layer(ctx, cfg.from?.kind || 'dark', 0, 2.5), B = layer(ctx, cfg.to?.kind || 'brand', 0.9, 3);
      const card = (Lr, t, sub) => {
        const ink = inkOn(ctx, Lr.dataset.kind);
        const b = el('div', `position:absolute;left:${80 * U}px;right:${80 * U}px;top:44%;transform:translateY(-50%);font-family:${look.display};font-weight:${look.dw};font-size:${150 * U}px;line-height:1;letter-spacing:-.035em;color:${ink};`, Lr.inner, esc(t));
        if (sub) el('div', `margin-top:${30 * U}px;font-family:${look.ui};font-weight:600;font-size:${40 * U}px;letter-spacing:.2em;text-transform:uppercase;color:${Lr.dataset.kind === 'brand' ? ink : look.A};`, b, esc(sub));
        return b;
      };
      const ca = card(A, cfg.from?.text || 'Scene one', cfg.from?.sub); const cb = card(B, cfg.to?.text || 'Scene two', cfg.to?.sub);
      tl.fromTo(ca, { x: 0 }, { x: -40 * U, duration: 1.3, ease: 'none' }, 0);
      tl.fromTo(cb, { x: 30 * U }, { x: 0, duration: 1.4, ease: 'none' }, 1.3);
      B.style.visibility = 'hidden';
      end = piece.build(ctx, A, B, 0.9) + 0.9;
    } else {
      const pd = (cfg.data && cfg.data.dur) || piece.dur; ctx.forceBg = cfg.bg || null;
      const Lr = layer(ctx, cfg.kind || (look.dark ? 'dark' : 'light'), 0, pd + 1);
      end = piece.build(ctx, Lr.inner, 0.25, cfg.data || {}) + 0.4;
    }
    void H;
    return finishUp(ctx, end, cfg);
  };
  window.PIECE_UTILS = { layer, el, sv, seeded, fit, natural, inkOn, clamp, lerp, seg, ez, esc, rgba, mix, on, lum, drive, show, hide, orb, chars, blurFilter, picker, TRANSITIONS };
})();
