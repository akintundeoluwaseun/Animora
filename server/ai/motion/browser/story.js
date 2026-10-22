// Animora Story engine: one art-directed film per business.
// The server (server/ai/story/index.js) decides the story (which beats, in what order, how long, which layout variant,
// which look); this runtime draws it at any size and puts every move on one paused GSAP timeline (window.__timeline).
// Rules: only the owner's own words, nothing invented; soft sounds from the app's library only; the film lands on the exact length.
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, css, parent, html) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  const rgb = (h) => { const n = parseInt(String(h || '#777777').slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const c = rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const lum = (h) => { const c = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const onColor = (h) => { const L = lum(h); return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.0565) ? '#FFFFFF' : '#111111'; };
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------------------------------------------------------------- icons (stroke, drawn on)
  const ICON = {
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/>',
    phone: '<path d="M5 3.5h3.2l1.6 4.2-2 1.4a11 11 0 0 0 7.1 7.1l1.4-2 4.2 1.6V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5z"/>',
    chat: '<path d="M4.5 19.5l1.2-3.7A8 8 0 1 1 8.6 18.6z"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    arrow: '<path d="M5 12h13M13 6l6 6-6 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const icon = (name, size, color, sw = 1.8) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="display:block;overflow:visible">${ICON[name]}</svg>`;

  // ---------------------------------------------------------------- the film
  window.STORY_FILM = function (cfg, stageEl) {
    const gsap = window.gsap;
    const { W, H } = cfg;
    const U = Math.min(W, H) / 1080, port = H / W > 1.2, land = W / H > 1.2;
    const TU = U * (port ? 1.36 : land ? 1.34 : 1.2) * (cfg.textScale || 1);   // type is set larger than layout so it reads on a phone
    const M = Math.round((port ? 0.085 : land ? 0.065 : 0.08) * W);
    const CW = W - 2 * M;
    const L0 = cfg.look;
    const R = rng(cfg.seed || 7);
    // GSAP's shape-morph and motion-path plugins (free since 3.13); every effect falls back gracefully if one did not load
    const hasMorph = !!window.MorphSVGPlugin, hasPath = !!window.MotionPathPlugin;
    try { if (hasMorph) gsap.registerPlugin(window.MorphSVGPlugin); if (hasPath) gsap.registerPlugin(window.MotionPathPlugin); } catch (e) { /* plugins are optional */ }
    const tl = gsap.timeline({ paused: true });
    // nothing may start before the first frame (a child at a negative time would push the whole film later)
    ['to', 'from', 'fromTo', 'set'].forEach((m) => { const f = tl[m].bind(tl), at = m === 'fromTo' ? 3 : 2; tl[m] = (...a) => { if (typeof a[at] === 'number' && a[at] < 0) a[at] = 0; return f(...a); }; });
    const sfx = [];
    const stage = stageEl || document.getElementById('stage');
    stage.style.cssText = `position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${L0.bg};`;
    const fx = { calm: L0.motion === 'calm', snap: L0.motion === 'snap' };
    const EASE = fx.snap ? 'expo.out' : 'power3.out', EASE_IO = fx.snap ? 'expo.inOut' : 'power3.inOut';
    const ink = L0.ink, mute = L0.mute, A = L0.A, A2 = L0.A2 || L0.A;
    const disp = L0.display, ui = L0.ui;
    const DW = L0.dw || 700;
    const sound = (t, k, v) => { if (cfg.sound !== 'none') sfx.push({ t: Math.max(0, +t.toFixed(3)), k, v }); };

    // ---------- text: words measured, fitted, then grouped into masked lines so each line can rise into view
    function textBlock(parent, text, o) {
      const box = el('div', `position:absolute;${o.css || ''};width:${o.w}px;font-family:${o.font || disp};font-weight:${o.weight || DW};line-height:${o.lh || 1.02};letter-spacing:${o.ls == null ? '-0.02em' : o.ls};color:${o.color || ink};text-align:${o.align || 'left'};${o.upper ? 'text-transform:uppercase;' : ''}${o.italic ? 'font-style:italic;' : ''}`, parent);
      const words = String(text || '').split(/\s+/).filter(Boolean);
      const accentAt = o.accent ? pickAccent(words) : -1;
      const html = words.map((w, i) => `<span class="w${i === accentAt ? ' acc' : ''}" style="display:inline-block;white-space:nowrap${i === accentAt ? `;${o.accentCss || `color:${A}`}` : ''}">${esc(w)}</span>`).join(' ');
      box.innerHTML = html;
      let size = o.size;
      for (let k = 0; k < 40; k++) {
        box.style.fontSize = size + 'px';
        const spans = [...box.querySelectorAll('.w')];
        const widest = spans.reduce((m, s) => Math.max(m, s.offsetWidth), 0);
        const lines = new Set(spans.map((s) => s.offsetTop)).size;
        if ((widest <= o.w + 0.5 && lines <= (o.maxLines || 4) && (!o.maxH || box.offsetHeight <= o.maxH)) || size <= (o.min || 20)) break;
        size = Math.max(o.min || 20, size * 0.94);
      }
      // regroup into lines
      const spans = [...box.querySelectorAll('.w')], rows = [];
      spans.forEach((s) => { const top = s.offsetTop; let r = rows.find((x) => Math.abs(x.top - top) < 2); if (!r) rows.push(r = { top, spans: [] }); r.spans.push(s); });
      box.innerHTML = '';
      const inners = [];
      rows.forEach((r) => {
        const ln = el('div', 'overflow:hidden;padding:.1em .04em .14em;margin:-.1em -.04em -.14em;', box);
        const inner = el('div', 'will-change:transform;', ln, r.spans.map((s) => s.outerHTML).join(' '));
        inners.push(inner);
      });
      box._lines = inners; box._size = size;
      return box;
    }
    function pickAccent(words) { let best = -1, len = 3; words.forEach((w, i) => { const n = w.replace(/[^\p{L}\p{N}]/gu, '').length; if (n > len) { len = n; best = i; } }); return best; }
    function reveal(box, t, o = {}) {
      const lines = box._lines || [box];
      if (L0.id === 'bold' && !o.soft && !fx.calm) { revealChars(box, t); return t + 0.9; }
      if (fx.calm || o.soft) tl.fromTo(lines, { opacity: 0, y: (o.dy || 40) * U }, { opacity: 1, y: 0, duration: o.dur || 1.1, ease: 'power2.out', stagger: o.stagger || 0.12 }, t);
      else tl.fromTo(lines, { yPercent: 112, rotate: o.tilt ? 2.5 : 0 }, { yPercent: 0, rotate: 0, duration: o.dur || 0.95, ease: EASE, stagger: o.stagger || 0.09 }, t);
      return t + (o.dur || 0.95) + (lines.length - 1) * (o.stagger || 0.09);
    }
    function fadeUp(nodes, t, o = {}) { if (L0.id === 'tech') [].concat(nodes).forEach((n) => { if (n && n.dataset && n.dataset.lab) scramble(n, t, 0.8); }); tl.fromTo(nodes, { opacity: 0, y: (o.dy || 24) * U }, { opacity: o.to || 1, y: 0, duration: o.dur || 0.8, ease: 'power2.out', stagger: o.stagger || 0.08 }, t); }
    // a quiet drift so a held frame never looks frozen
    function drift(node, t, d, o = {}) { tl.fromTo(node, { scale: o.from || 1, y: 0 }, { scale: o.to || 1.035, y: (o.y || -10) * U, duration: Math.max(0.5, d), ease: 'none' }, t); }

    // ---------- effects
    const SPRING = 'back.out(1.7)';
    const hash = (n) => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0; };
    // letters: each word split into characters that drop into place with a little overshoot
    function charsOf(box) {
      if (box._chars) return box._chars;
      const out = [];
      box.querySelectorAll('.w').forEach((w) => { const txt = w.textContent; w.innerHTML = [...txt].map((c) => `<span class="ch" style="display:inline-block">${esc(c)}</span>`).join(''); out.push(...w.querySelectorAll('.ch')); });
      return (box._chars = out);
    }
    function revealChars(box, t) {
      const cs = charsOf(box);
      tl.fromTo(cs, { yPercent: 125, rotate: 10, opacity: 0 }, { yPercent: 0, rotate: 0, opacity: 1, duration: 0.75, ease: SPRING, stagger: Math.min(0.035, 0.8 / Math.max(1, cs.length)) }, t);
    }
    // a word that resolves out of shuffling characters (deterministic: the same frame always shows the same letters)
    const GLYPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+/<>';
    function scramble(node, t, dur = 0.9) {
      if (!node || node._scr) return; node._scr = 1;
      const text = node.textContent, n = text.length, st = { p: 0 }, salt = hash(n * 977 + (cfg.seed || 1));
      const draw = () => { const done = Math.floor(st.p * (n + 4)) - 4, tick = Math.floor(st.p * 28); let out = ''; for (let i = 0; i < n; i++) { const c = text[i]; out += c === ' ' || i < done ? c : i < done + 7 ? GLYPH[hash(i * 131 + tick * 17 + salt) % GLYPH.length] : '\u2007'; } node.textContent = out; };
      draw();
      tl.fromTo(st, { p: 0 }, { p: 1, duration: dur, ease: 'none', onUpdate: draw }, t);
    }
    // a hand-drawn stroke under the accent word, or a marker block behind it (bold)
    function underline(box, t, color) {
      const a = box.querySelector('.acc'); if (!a) return;
      // position inside the block, ignoring the moves on the lines (offsets add up through each layer)
      let x = 0, y = 0, n = a;
      while (n && n !== box) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; if (n && !box.contains(n) && n !== box) { const br = box.getBoundingClientRect(), ar = a.getBoundingClientRect(); x = ar.left - br.left; y = ar.top - br.top; break; } }
      const w = a.offsetWidth, h = a.offsetHeight, fs = parseFloat(box.style.fontSize) || 80;
      if (L0.id === 'bold') {
        const m = el('div', `position:absolute;left:${x - fs * 0.06}px;top:${y + h * 0.18}px;width:${w + fs * 0.12}px;height:${h * 0.74}px;background:${color};transform-origin:left center;z-index:-1;`, box);
        box.style.zIndex = 1; box.style.isolation = 'isolate';
        tl.fromTo(m, { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: 'expo.inOut' }, t);
        tl.set(a, { color: onColor(color) }, t + 0.25);
        return;
      }
      const sw = Math.max(3, fs * (L0.id === 'tech' ? 0.05 : 0.07));
      const d = L0.id === 'tech' ? 'M0,10 L100,10' : 'M2,13 C22,6 48,4 70,7 C82,8.5 92,10 98,8';
      const svg = el('div', `position:absolute;left:${x}px;top:${y + h * 0.93}px;width:${w}px;height:${fs * 0.28}px;pointer-events:none;`, box, `<svg viewBox="0 0 100 20" preserveAspectRatio="none" width="100%" height="100%" style="overflow:visible;display:block"><path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" vector-effect="non-scaling-stroke" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`);
      tl.to(svg.querySelector('path'), { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut' }, t);
    }
    // smooth organic blob as an SVG path (used for the morphing shapes)
    function blob(cx, cy, r, k, pts = 8) {
      const P = [];
      for (let i = 0; i < pts; i++) { const a = (i / pts) * Math.PI * 2, j = 0.78 + (hash(k * 97 + i * 13 + (cfg.seed || 1)) % 1000) / 1000 * 0.44; P.push([cx + Math.cos(a) * r * j, cy + Math.sin(a) * r * j]); }
      let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
      for (let i = 0; i < pts; i++) { const p0 = P[(i - 1 + pts) % pts], p1 = P[i], p2 = P[(i + 1) % pts], p3 = P[(i + 2) % pts]; d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`; }
      return d + 'Z';
    }
    function star(cx, cy, r, n = 14, inner = 0.8) { let d = ''; for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * inner : r; d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`; } return d + 'Z'; }
    const circlePath = (cx, cy, r) => `M${cx - r},${cy} A${r},${r} 0 1,1 ${cx + r},${cy} A${r},${r} 0 1,1 ${cx - r},${cy}Z`;
    // a shape that slowly turns into other shapes over the beat
    function morphing(parent, shapes, t, d, css, fill) {
      const host = el('div', `position:absolute;${css};pointer-events:none;`, parent, `<svg viewBox="0 0 400 400" width="100%" height="100%" style="overflow:visible;display:block"><path d="${shapes[0]}" fill="${fill}"/></svg>`);
      const path = host.querySelector('path');
      if (hasMorph && shapes.length > 1) { const seg = Math.max(0.6, d / (shapes.length - 1)); shapes.slice(1).forEach((sh, i) => tl.to(path, { morphSVG: sh, duration: seg, ease: 'sine.inOut' }, t + i * seg)); }
      tl.fromTo(host, { rotate: 0 }, { rotate: 24, duration: Math.max(1, d), ease: 'none' }, t);
      return host;
    }

    const accOnPhoto = /italic/.test(L0.accentCss || '') ? 'font-style:italic' : `color:${L0.photoLabel || '#FFFFFF'}`;
    const acc = (S) => (L0.accentCss ? (S.kind === 'accent' ? L0.accentCss.replace(/color:[^;]+;?/, '') : L0.accentCss) : `color:${S.acc}`);
    // ---------- small labels
    function label(parent, text, css, color) {
      const n = el('div', `position:absolute;${css};font-family:${ui};font-weight:600;font-size:${Math.round((land ? 24 : 26) * TU)}px;letter-spacing:.22em;text-transform:uppercase;color:${color || A};white-space:nowrap;`, parent, esc(text));
      n.dataset.lab = '1'; return n;
    }
    function rule(parent, css, color) { return el('div', `position:absolute;${css};height:${Math.max(2, Math.round(2.5 * U))}px;background:${color || A};transform-origin:left center;`, parent); }

    // ---------- photos: full bleed with a slow camera move, or whole on a soft copy of itself when the picture is small or oddly shaped
    function photo(parent, src, fit, t, d, o = {}) {
      const box = el('div', `position:absolute;${o.css || 'inset:0'};overflow:hidden;${o.radius ? `border-radius:${o.radius}px;` : ''}background:#111;`, parent);
      if (fit === 'contain') {
        const back = el('div', `position:absolute;inset:-8%;background:url("${src}") center/cover;filter:blur(${40 * U}px) brightness(.55) saturate(1.15);`, box);
        const front = el('img', `position:absolute;left:8%;top:8%;width:84%;height:84%;object-fit:contain;filter:drop-shadow(0 ${30 * U}px ${50 * U}px rgba(0,0,0,.45));`, box);
        front.src = src;
        drift(back, t, d, { to: 1.06 }); drift(front, t, d, { to: 1.04, y: -6 });
        return box;
      }
      const img = el('img', `position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:${o.pos || '50% 50%'};transform-origin:${o.origin || '50% 50%'};`, box);
      img.src = src;
      const dir = o.dir || (R() < 0.5 ? 1 : -1);
      tl.fromTo(img, { scale: o.zoomFrom || 1.16, xPercent: -2.2 * dir }, { scale: o.zoomTo || 1.04, xPercent: 2.2 * dir, duration: Math.max(1, d), ease: 'none' }, t);
      if (L0.grade) el('div', `position:absolute;inset:0;background:${L0.grade};mix-blend-mode:${L0.gradeBlend || 'soft-light'};`, box);
      return box;
    }
    function scrim(parent, strength = 0.78, from = 'bottom') { return el('div', `position:absolute;inset:0;background:linear-gradient(to ${from === 'bottom' ? 'top' : 'bottom'}, rgba(0,0,0,${strength}) 0%, rgba(0,0,0,${strength * 0.55}) 32%, rgba(0,0,0,0) 62%);`, parent); }

    // ---------- the brand mark: the owner's logo, or a monogram drawn in a ring
    function mark(parent, size, css, t, color) {
      const box = el('div', `position:absolute;${css};width:${size}px;height:${size}px;`, parent);
      if (cfg.logo) {
        const img = el('img', 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;', box); img.src = cfg.logo;
        tl.fromTo(img, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 1.1, ease: EASE }, t);
      } else {
        const c = color || ink, r = 47;
        box.innerHTML = `<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="position:absolute;inset:0;overflow:visible"><circle cx="50" cy="50" r="${r}" fill="none" stroke="${c}" stroke-width="${Math.max(1.2, 2.2 / Math.max(0.6, size / 200))}" stroke-dasharray="${2 * Math.PI * r}" stroke-dashoffset="${2 * Math.PI * r}" transform="rotate(-90 50 50)"/></svg>`;
        const m = el('div', `position:absolute;inset:0;display:grid;place-items:center;font-family:${disp};font-weight:${DW};font-size:${size * (String(cfg.mono || '').length > 1 ? 0.36 : 0.46)}px;letter-spacing:-.02em;color:${c};`, box, esc(cfg.mono || 'A'));
        tl.to(box.querySelector('circle'), { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, t);
        if (hasMorph && ['bold', 'fresh', 'tech', 'clean'].includes(L0.id)) {
          const svg = box.querySelector('svg'), ring = box.querySelector('circle');
          const pth = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          pth.setAttribute('d', L0.id === 'tech' ? 'M50,3 L91,26.5 L91,73.5 L50,97 L9,73.5 L9,26.5Z' : star(50, 50, 47, 12, 0.72)); pth.setAttribute('fill', rgba(A, 0.14)); pth.setAttribute('stroke', 'none');
          svg.insertBefore(pth, ring);
          tl.fromTo(pth, { scale: 0, transformOrigin: '50% 50%', rotate: -90 }, { scale: 1, rotate: 0, duration: 0.8, ease: SPRING }, t);
          tl.to(pth, { morphSVG: circlePath(50, 50, 47), duration: 1.1, ease: 'power2.inOut' }, t + 0.7);
        }
        tl.fromTo(m, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.9, ease: EASE }, t + 0.35);
      }
      return box;
    }

    // ---------- per-look decoration behind type-only beats
    function decor(Lr, t, d, kind) {
      const id = L0.id;
      if (id === 'noir') {
        const f = el('div', `position:absolute;left:${M * 0.45}px;right:${M * 0.45}px;top:${M * 0.45}px;bottom:${M * 0.45}px;border:${Math.max(1, 1.5 * U)}px solid ${rgba(A, 0.55)};`, Lr);
        tl.fromTo(f, { clipPath: 'inset(0 100% 100% 0)' }, { clipPath: 'inset(0 0% 0% 0)', duration: 1.6, ease: 'power2.inOut' }, t);
        const glow = el('div', `position:absolute;width:${1.2 * Math.max(W, H)}px;height:${1.2 * Math.max(W, H)}px;left:50%;top:50%;margin:-${0.6 * Math.max(W, H)}px;background:radial-gradient(circle, ${rgba(A, 0.16)} 0%, transparent 55%);`, Lr);
        drift(glow, t, d, { to: 1.12, y: 20 });
      } else if (id === 'editorial') {
        const top = rule(Lr, `left:${M}px;right:${M}px;top:${M * 0.9}px`, rgba(ink, 0.8)), bot = rule(Lr, `left:${M}px;right:${M}px;bottom:${M * 0.9}px`, rgba(ink, 0.8));
        tl.fromTo([top, bot], { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: 'power3.inOut', stagger: 0.1 }, t);
        const bl = label(Lr, cfg.brand, `left:${M}px;top:${M * 0.9 + 22 * U}px;font-size:${22 * TU}px`, ink);
        if (cfg.category) { const cl = label(Lr, cfg.category, `right:${M}px;top:${M * 0.9 + 22 * U}px;font-size:${22 * TU}px;text-align:right`, mute); if (bl.offsetWidth + cl.offsetWidth + 40 * U > CW) cl.remove(); }
      } else if (id === 'bold') {
        const col = kind === 'accent' ? onColor(A) : A, word = String(cfg.brand || '').toUpperCase();
        [0.18, 0.5, 0.82].forEach((yy, i) => {
          const row = el('div', `position:absolute;left:0;top:${H * yy}px;white-space:nowrap;font-family:${disp};font-size:${(port ? 300 : 260) * U}px;line-height:1;color:transparent;-webkit-text-stroke:${Math.max(1.5, 2.5 * U)}px ${rgba(col, 0.16)};transform:translateY(-50%);`, Lr, esc((word + ' · ').repeat(4)));
          const dir = i % 2 ? 1 : -1;
          tl.fromTo(row, { x: dir > 0 ? -W * 1.2 : 0 }, { x: dir > 0 ? 0 : -W * 1.2, duration: Math.max(1, d) * 1.8, ease: 'none' }, t - 0.4);
        });
        const bar = el('div', `position:absolute;left:${M}px;top:${M}px;width:${90 * U}px;height:${Math.max(6, 12 * U)}px;background:${kind === 'accent' ? onColor(A) : A2};transform-origin:left;`, Lr);
        tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'expo.out' }, t + 0.2);
      } else if (id === 'fresh') {
        const mx = Math.max(W, H), k0 = Math.floor(t * 10);
        const c1 = kind === 'accent' ? rgba(onColor(A), 0.1) : rgba(A, 0.12), c2 = kind === 'accent' ? rgba(onColor(A), 0.07) : rgba(A2, 0.13);
        const b1 = morphing(Lr, [blob(200, 200, 170, k0), blob(200, 200, 175, k0 + 1), blob(200, 200, 165, k0 + 2)], t, d, `width:${0.75 * mx}px;height:${0.75 * mx}px;right:-${0.3 * mx}px;top:-${0.28 * mx}px`, c1);
        const b2 = morphing(Lr, [blob(200, 200, 170, k0 + 5), blob(200, 200, 160, k0 + 6), blob(200, 200, 175, k0 + 7)], t, d, `width:${0.65 * mx}px;height:${0.65 * mx}px;left:-${0.3 * mx}px;bottom:-${0.28 * mx}px`, c2);
        tl.fromTo([b1, b2], { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.1, ease: SPRING, stagger: 0.12 }, t);
      } else if (id === 'tech') {
        const g = el('div', `position:absolute;inset:0;background-image:linear-gradient(${rgba(A, 0.07)} 1px, transparent 1px),linear-gradient(90deg, ${rgba(A, 0.07)} 1px, transparent 1px);background-size:${60 * U}px ${60 * U}px;`, Lr);
        tl.fromTo(g, { opacity: 0, backgroundPosition: '0px 0px' }, { opacity: 1, backgroundPosition: `0px ${120 * U}px`, duration: d, ease: 'none' }, t);
        const s = 46 * U, b = Math.max(2, 2.5 * U);
        [[`left:${M * 0.5}px;top:${M * 0.5}px`, `border-left:${b}px solid ${A};border-top:${b}px solid ${A}`], [`right:${M * 0.5}px;top:${M * 0.5}px`, `border-right:${b}px solid ${A};border-top:${b}px solid ${A}`], [`left:${M * 0.5}px;bottom:${M * 0.5}px`, `border-left:${b}px solid ${A};border-bottom:${b}px solid ${A}`], [`right:${M * 0.5}px;bottom:${M * 0.5}px`, `border-right:${b}px solid ${A};border-bottom:${b}px solid ${A}`]]
          .forEach(([pos, bd], i) => { const c = el('div', `position:absolute;${pos};width:${s}px;height:${s}px;${bd};`, Lr); tl.fromTo(c, { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' }, t + 0.1 + i * 0.06); });
        const glow = el('div', `position:absolute;width:${Math.max(W, H)}px;height:${Math.max(W, H)}px;left:50%;top:50%;margin:-${0.5 * Math.max(W, H)}px;background:radial-gradient(circle, ${rgba(A, 0.14)} 0%, transparent 60%);`, Lr);
        drift(glow, t, d, { to: 1.15 });
        const g6 = 60 * U, yy = Math.round((H * (0.82 + (hash(Math.floor(t * 7)) % 10) / 100)) / g6) * g6, xx = Math.round((W * 0.3) / g6) * g6;
        const tr = `M${M * 0.5},${yy} L${xx},${yy} L${xx + g6 * 2},${yy - g6 * 2} L${W - xx - g6 * 2},${yy - g6 * 2} L${W - xx},${yy} L${W - M * 0.5},${yy}`;
        const sv = el('div', 'position:absolute;inset:0;pointer-events:none;', Lr, `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;inset:0;overflow:visible"><path d="${tr}" fill="none" stroke="${rgba(A, 0.45)}" stroke-width="${Math.max(1.5, 2 * U)}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`);
        const trace = sv.querySelector('path');
        tl.to(trace, { strokeDashoffset: 0, duration: Math.min(1.6, d * 0.5), ease: 'power2.inOut' }, t + 0.2);
        if (hasPath) {
          const dot = el('div', `position:absolute;left:0;top:0;width:${16 * U}px;height:${16 * U}px;border-radius:50%;background:${A};box-shadow:0 0 ${24 * U}px ${8 * U}px ${rgba(A, 0.6)};`, Lr);
          tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.2 }, t + 0.2);
          tl.to(dot, { motionPath: { path: trace, align: trace, alignOrigin: [0.5, 0.5] }, duration: Math.max(1, d - 0.4), ease: 'power1.inOut' }, t + 0.2);
        }
      } else {
        const glow = el('div', `position:absolute;width:${1.4 * Math.max(W, H)}px;height:${1.4 * Math.max(W, H)}px;left:50%;top:50%;margin:-${0.7 * Math.max(W, H)}px;background:radial-gradient(circle, ${rgba(A, L0.dark ? 0.14 : 0.08)} 0%, transparent 55%);`, Lr);
        drift(glow, t, d, { to: 1.1 });
      }
    }
    // surfaces: each look alternates between a few backgrounds so the cut is felt
    function surface(kind) {
      if (kind === 'accent') return { bg: A, ink: onColor(A), mute: rgba(onColor(A), 0.75), acc: onColor(A) === '#FFFFFF' ? (lum(A2) > 0.4 ? A2 : '#FFFFFF') : '#111111' };
      if (kind === 'alt') return { bg: L0.bg2, ink, mute, acc: A };
      return { bg: L0.bg, ink, mute, acc: A };
    }

    // ================================================================ beats
    const BEATS = {
      // the opening: brand + promise
      hook(Lr, t, d, data, v, S) {
        const photoV = data.photo && (v === 'full' || v === 'split');
        if (photoV && v === 'full') {
          photo(Lr, data.photo, data.fit, t - 0.6, d + 1.4, { pos: data.pos });
          scrim(Lr, 0.82);
          el('div', `position:absolute;left:0;right:0;top:0;height:${H * 0.22}px;background:linear-gradient(to bottom, rgba(0,0,0,.45), rgba(0,0,0,0));`, Lr);
          const top = cfg.logo ? mark(Lr, 110 * U, `left:${M}px;top:${M}px`, t + 0.2) : label(Lr, cfg.brand, `left:${M}px;top:${M}px`, '#FFFFFF');
          if (!cfg.logo) fadeUp(top, t + 0.25);
          const hb = textBlock(Lr, data.headline, { w: land ? W * 0.6 : CW, size: (port ? 128 : land ? 112 : 104) * TU, min: 46 * TU, maxLines: port ? 4 : 3, color: '#FFFFFF', accent: L0.accentWord, accentCss: accOnPhoto, upper: L0.upper, css: `left:${M}px;bottom:${M + (port ? 70 : 50) * U}px` });
          const lab = data.label ? label(Lr, data.label, `left:${M}px;bottom:${M + (port ? 70 : 50) * U + hb.offsetHeight + 30 * U}px`, L0.photoLabel || A) : null;
          if (lab) fadeUp(lab, t + 0.35);
          reveal(hb, t + 0.45); underline(hb, t + 1.3, L0.id === 'bold' ? A : (L0.photoLabel || A));
          if (data.sub && port) { const sb = textBlock(Lr, data.sub, { w: CW, size: 36 * TU, min: 26 * TU, maxLines: 2, font: ui, weight: 500, lh: 1.3, ls: '0', color: 'rgba(255,255,255,.82)', css: `left:${M}px;bottom:${M}px` }); reveal(sb, t + 1.1, { soft: true }); }
          sound(t + 0.4, 'whoosh', 0.35);
          return;
        }
        if (photoV && v === 'split') {
          const pbox = port ? `left:0;top:0;width:${W}px;height:${H * 0.56}px` : `left:${W * 0.5}px;top:0;width:${W * 0.5}px;height:${H}px`;
          const pb = photo(Lr, data.photo, data.fit, t - 0.3, d + 1, { css: pbox, pos: data.pos });
          tl.fromTo(pb, { clipPath: port ? 'inset(100% 0 0 0)' : 'inset(0 0 0 100%)' }, { clipPath: 'inset(0% 0 0 0%)', duration: 1.2, ease: 'expo.inOut' }, t);
          const tx = port ? { left: M, top: H * 0.56 + 70 * U, w: CW, h: H * 0.44 - 70 * U - M } : { left: M, top: M, w: W * 0.5 - M * 1.6, h: H - 2 * M };
          const lab = label(Lr, data.label || cfg.brand, `left:${tx.left}px;top:${tx.top}px`, S.acc);
          const hb = textBlock(Lr, data.headline, { w: tx.w, size: (port ? 112 : 104) * TU, min: 40 * TU, maxLines: port ? 3 : 4, maxH: tx.h - 120 * U, color: S.ink, accent: L0.accentWord, accentCss: acc(S), upper: L0.upper, css: `left:${tx.left}px;top:${tx.top + 60 * U}px` });
          fadeUp(lab, t + 0.6); reveal(hb, t + 0.75);
          if (data.sub) { const sb = textBlock(Lr, data.sub, { w: tx.w, size: 34 * TU, min: 24 * TU, maxLines: 3, font: ui, weight: 500, lh: 1.35, ls: '0', color: S.mute, css: `left:${tx.left}px;top:${tx.top + 60 * U + hb.offsetHeight + 36 * U}px` }); reveal(sb, t + 1.3, { soft: true }); }
          sound(t + 0.1, 'swish', 0.3);
          return;
        }
        // type only
        decor(Lr, t, d, S.kind);
        const center = L0.center || !port;
        const w = land ? W * 0.72 : CW;
        const hb = textBlock(Lr, data.headline, { w, size: (port ? 150 : land ? 136 : 124) * TU, min: 50 * TU, maxLines: port ? 5 : 3, color: S.ink, accent: L0.accentWord, accentCss: acc(S), upper: L0.upper, align: center ? 'center' : 'left', css: center ? `left:${(W - w) / 2}px;top:50%` : `left:${M}px;top:50%` });
        hb.style.transform = `translateY(-50%)`;
        if (L0.id === 'bold' && port) { hb.style.top = `${H * 0.4}px`; }
        const midY = L0.id === 'bold' && port ? H * 0.4 : H / 2;
        const lab = label(Lr, data.label || cfg.brand, center ? `left:0;right:0;text-align:center;top:${midY - hb.offsetHeight / 2 - 70 * U}px` : `left:${M}px;top:${midY - hb.offsetHeight / 2 - 70 * U}px`, S.acc);
        fadeUp(lab, t + 0.3);
        reveal(hb, t + 0.4, { tilt: L0.id === 'bold' }); underline(hb, t + 1.25, L0.id === 'bold' ? (S.kind === 'accent' ? onColor(A) : A2) : S.acc);
        if (data.sub && L0.id !== 'bold') { const sw = land ? W * 0.55 : CW; const sb = textBlock(Lr, data.sub, { w: sw, size: 36 * TU, min: 24 * TU, maxLines: 2, font: ui, weight: 500, lh: 1.35, ls: '0', color: S.mute, align: center ? 'center' : 'left', css: center ? `left:${(W - sw) / 2}px;top:${H / 2 + hb.offsetHeight / 2 + 50 * U}px` : `left:${M}px;top:${H / 2 + hb.offsetHeight / 2 + 50 * U}px` }); reveal(sb, t + 1.2, { soft: true }); }
        drift(hb, t + 1.4, d - 1.2, { from: 1, to: 1.025, y: 0 });
        sound(t + 0.35, 'whoosh', 0.3);
      },
      // a short brand sting before the story
      sting(Lr, t, d, data, v, S) {
        decor(Lr, t, d, S.kind);
        const name = textBlock(Lr, cfg.brand, { w: CW * 0.9, size: (port ? 110 : 120) * TU, min: 40 * TU, maxLines: 2, color: S.ink, upper: true, ls: '0.06em', align: 'center', css: `left:${(W - CW * 0.9) / 2}px;top:50%` });
        name.style.transform = 'translateY(-50%)';
        if (cfg.logo) { mark(Lr, 150 * U, `left:${W / 2 - 75 * U}px;top:${H / 2 - name.offsetHeight / 2 - 190 * U}px`, t + 0.1); }
        if (L0.id === 'tech') name.querySelectorAll('.w').forEach((w, i) => scramble(w, t + 0.15 + i * 0.12, 1.1));
        else if (L0.id === 'bold') revealChars(name, t + 0.15);
        else tl.fromTo(name._lines, { letterSpacing: '0.5em', opacity: 0 }, { letterSpacing: '0.06em', opacity: 1, duration: 1.4, ease: 'expo.out' }, t + 0.15);
        sound(t + 0.1, 'shimmer', 0.3);
      },
      // a picture with a caption
      photo(Lr, t, d, data, v, S) {
        const contain = data.fit === 'contain';
        if (v === 'frame' || contain) {
          if (L0.id !== 'bold') decor(Lr, t, d, S.kind);
          const box = !data.caption ? (land ? { l: W * 0.2, t: M * 1.6, w: W * 0.6, h: H - 3.2 * M } : { l: M, t: (H - (port ? H * 0.62 : H - 2.4 * M)) / 2, w: CW, h: port ? H * 0.62 : H - 2.4 * M }) : port ? { l: M, t: H * 0.13, w: CW, h: H * 0.56 } : land ? { l: W * 0.42, t: M, w: W * 0.58 - M, h: H - 2 * M } : { l: M, t: M, w: CW, h: H * 0.6 };
          const back = el('div', `position:absolute;left:${box.l + 26 * U}px;top:${box.t + 26 * U}px;width:${box.w}px;height:${box.h}px;background:${S.acc};border-radius:${L0.radius * U}px;`, Lr);
          tl.fromTo(back, { opacity: 0, x: -30 * U, y: -30 * U }, { opacity: 1, x: 0, y: 0, duration: 1, ease: EASE }, t + 0.3);
          const pb = photo(Lr, data.photo, data.fit, t - 0.3, d + 1, { css: `left:${box.l}px;top:${box.t}px;width:${box.w}px;height:${box.h}px`, radius: L0.radius * U, pos: data.pos, zoomFrom: 1.12 });
          tl.fromTo(pb, { clipPath: `inset(0 0 100% 0 round ${L0.radius * U}px)` }, { clipPath: `inset(0 0 0% 0 round ${L0.radius * U}px)`, duration: 1.1, ease: 'expo.inOut' }, t + 0.05);
          if (data.caption) {
            const tx = port ? { l: M, tp: box.t + box.h + 80 * U, w: CW } : land ? { l: M, tp: H * 0.36, w: W * 0.42 - M * 1.6 } : { l: M, tp: box.t + box.h + 64 * U, w: CW };
            if (data.label) { const lb = label(Lr, data.label, `left:${tx.l}px;top:${tx.tp - 50 * U}px`, S.acc); fadeUp(lb, t + 0.7); }
            const cb = textBlock(Lr, data.caption, { w: tx.w, size: (land ? 84 : 76) * TU, min: 34 * TU, maxLines: 3, color: S.ink, accent: L0.accentWord, accentCss: acc(S), upper: L0.upper, css: `left:${tx.l}px;top:${tx.tp}px` });
            reveal(cb, t + 0.8);
          }
          sound(t + 0.05, 'swish', 0.28);
          return;
        }
        photo(Lr, data.photo, data.fit, t - 0.6, d + 1.4, { pos: data.pos, dir: data.dir });
        if (data.caption) {
          scrim(Lr, 0.78);
          const cb = textBlock(Lr, data.caption, { w: land ? W * 0.55 : CW, size: (port ? 92 : 80) * TU, min: 36 * TU, maxLines: 3, color: '#FFFFFF', accent: L0.accentWord, accentCss: accOnPhoto, upper: L0.upper, css: `left:${M}px;bottom:${M + 20 * U}px` });
          if (data.label) { const lb = label(Lr, data.label, `left:${M}px;bottom:${M + 20 * U + cb.offsetHeight + 28 * U}px`, L0.photoLabel || A); fadeUp(lb, t + 0.5); }
          reveal(cb, t + 0.6);
        } else {
          scrim(Lr, 0.35);
          const lb = label(Lr, cfg.brand, `left:${M}px;bottom:${M}px`, '#FFFFFF'); fadeUp(lb, t + 0.6, { to: 0.85 });
        }
        sound(t, 'whoosh', 0.25);
      },
      // what the business offers: a numbered list, or one at a time
      features(Lr, t, d, data, v, S) {
        const items = data.items || [];
        if (v === 'seq') {
          decor(Lr, t, d, S.kind);
          const n = items.length, per = (d - 0.5) / n;
          const head = label(Lr, data.title || cfg.brand, `left:0;right:0;text-align:center;top:${port ? H * 0.28 : H * 0.2}px`, S.acc); fadeUp(head, t + 0.2);
          const count = el('div', `position:absolute;left:0;right:0;text-align:center;top:${port ? H * 0.68 : H * 0.74}px;font-family:${ui};font-weight:600;font-size:${30 * TU}px;letter-spacing:.15em;color:${S.mute};`, Lr);
          items.forEach((it, i) => {
            const ti = t + 0.3 + i * per;
            const w = land ? W * 0.7 : CW;
            const b = textBlock(Lr, it, { w, size: (port ? 120 : 112) * TU, min: 44 * TU, maxLines: 3, color: S.ink, upper: L0.upper, align: 'center', css: `left:${(W - w) / 2}px;top:50%` });
            b.style.transform = 'translateY(-50%)';
            reveal(b, ti);
            const c = el('span', 'position:absolute;left:0;right:0;opacity:0', count, `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`);
            tl.set(c, { opacity: 1 }, ti); if (i < n - 1) tl.set(c, { opacity: 0 }, ti + per);
            if (i < n - 1) tl.to(b._lines, { yPercent: -140, opacity: 0, duration: 0.5, ease: 'power3.in', stagger: 0.04 }, ti + per - 0.5);
            sound(ti, 'tick', 0.3);
          });
          return;
        }
        // list
        const hasPhoto = land && data.photo;
        if (!hasPhoto) decor(Lr, t, d, S.kind);
        if (hasPhoto) { const pb = photo(Lr, data.photo, data.fit, t - 0.3, d + 1, { css: `left:${W * 0.58}px;top:0;width:${W * 0.42}px;height:${H}px`, pos: data.pos }); tl.fromTo(pb, { clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)', duration: 1.1, ease: 'expo.inOut' }, t); }
        const colW = hasPhoto ? W * 0.58 - 2 * M : land ? W * 0.62 : CW;
        const left = land && !hasPhoto ? (W - colW) / 2 : M;
        // measure every row first, then centre the whole list
        const gapR = (port ? 64 : 44) * TU, ind = 110 * TU;
        const blocks = items.map((it) => textBlock(Lr, it, { w: colW - ind, size: (port ? 92 : land ? 70 : 76) * TU, min: 30 * TU, maxLines: 2, maxH: (H * 0.7) / items.length, color: S.ink, upper: L0.upper, css: `left:${left + ind}px;top:0` }));
        const heights = blocks.map((b) => b.offsetHeight + gapR);
        const total = heights.reduce((n, h) => n + h, 0);
        let y = (H - total) / 2 + (port ? 50 : 36) * U;
        const head = label(Lr, data.title || cfg.brand, `left:${left}px;top:${y - 100 * U}px`, S.acc); fadeUp(head, t + 0.2);
        items.forEach((it, i) => {
          const tb = blocks[i], rowH = heights[i], ti = t + 0.45 + i * Math.min(0.5, (d - 1.6) / Math.max(1, items.length));
          tb.style.top = y + 'px';
          const num = el('div', `position:absolute;left:${left}px;top:${y + tb._size * 0.18}px;font-family:${ui};font-weight:600;font-size:${30 * TU}px;letter-spacing:.08em;color:${S.acc};`, Lr, String(i + 1).padStart(2, '0'));
          if (['fresh', 'clean'].includes(L0.id)) {
            // a tick that draws itself in a soft circle instead of a number
            num.innerHTML = `<div style="width:${64 * TU}px;height:${64 * TU}px;border-radius:50%;background:${rgba(S.acc, 0.14)};display:grid;place-items:center">${icon('check', 38 * TU, S.acc, 2.6)}</div>`;
            num.style.top = `${y + tb._size * 0.04}px`;
            const ck = num.querySelector('path'); ck.setAttribute('pathLength', '1'); ck.style.strokeDasharray = 1; ck.style.strokeDashoffset = 1;
            tl.to(ck, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out' }, ti + 0.25);
            tl.fromTo(num.firstChild, { scale: 0 }, { scale: 1, duration: 0.6, ease: 'back.out(2.4)' }, ti);
          }
          const ln = rule(Lr, `left:${left}px;width:${colW}px;top:${y + rowH - gapR * 0.5}px`, rgba(S.ink, 0.22));
          tl.fromTo(ln, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power3.inOut' }, ti - 0.1);
          fadeUp(num, ti, { dy: 16 }); reveal(tb, ti + 0.05);
          sound(ti, 'tick', 0.25);
          y += rowH;
        });
      },
      // a deal, in the accent colour
      offer(Lr, t, d, data, v, S) {
        decor(Lr, t, d, S.kind);
        const w = land ? W * 0.7 : CW;
        const lab = label(Lr, data.label || 'Special offer', `left:0;right:0;text-align:center;top:0`, S.acc);
        const ob = textBlock(Lr, data.offer, { w, size: (port ? 130 : 118) * TU, min: 46 * TU, maxLines: port ? 4 : 3, color: S.ink, upper: L0.upper, align: 'center', css: `left:${(W - w) / 2}px;top:50%` });
        ob.style.transform = 'translateY(-50%)';
        lab.style.top = `${H / 2 - ob.offsetHeight / 2 - 80 * U}px`;
        // a sweep of light across the words
        const bar = el('div', `position:absolute;left:${(W - w) / 2 - 30 * U}px;width:${w + 60 * U}px;top:${H / 2 + ob.offsetHeight / 2 + 30 * U}px;height:${Math.max(3, 5 * U)}px;background:${S.acc};transform-origin:center;`, Lr);
        fadeUp(lab, t + 0.25);
        reveal(ob, t + 0.4, { tilt: L0.id === 'bold' });
        tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: EASE_IO }, t + 0.9);
        drift(ob, t + 1.4, d - 1.2, { from: 1, to: 1.03, y: 0 });
        if (['bold', 'fresh', 'clean'].includes(L0.id)) {
          const bs = (port ? 230 : 200) * U, bx = Math.min(W - M - bs * 0.7, (W + Math.min(w, ob.querySelector('div') ? w : w)) / 2 - bs * 0.55), by = H / 2 - ob.offsetHeight / 2 - bs * 0.95;
          const col = S.kind === 'accent' ? (L0.id === 'bold' ? '#111111' : onColor(A)) : (L0.id === 'bold' ? A2 : A);
          const host = el('div', `position:absolute;left:${bx}px;top:${by}px;width:${bs}px;height:${bs}px;`, Lr, `<svg viewBox="0 0 100 100" width="100%" height="100%" style="overflow:visible;display:block"><path d="${circlePath(50, 50, 30)}" fill="${col}"/></svg>`);
          const shape = host.querySelector('path');
          el('div', `position:absolute;inset:0;display:grid;place-items:center;`, host, icon('check', bs * 0.36, onColor(col), 2.6));
          tl.fromTo(host, { scale: 0, rotate: -40 }, { scale: 1, rotate: 0, duration: 0.9, ease: 'back.out(2.2)' }, t + 0.75);
          if (hasMorph) tl.to(shape, { morphSVG: L0.id === 'fresh' ? blob(50, 50, 46, 3) : star(50, 50, 48, 14, 0.82), duration: 0.7, ease: 'back.out(2)' }, t + 1.05);
          tl.fromTo(host, { rotate: 0 }, { rotate: 30, duration: Math.max(1, d - 1.6), ease: 'none' }, t + 1.65);
          const ck = host.querySelector('path:not([fill])') || host.querySelectorAll('svg')[1]?.querySelector('path');
          if (ck) { ck.setAttribute('pathLength', '1'); ck.style.strokeDasharray = 1; ck.style.strokeDashoffset = 1; tl.to(ck, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }, t + 1.2); }
        }
        sound(t + 0.9, 'pop', 0.35);
      },
      // prices: one hero price, or a short price list
      products(Lr, t, d, data, v, S) {
        decor(Lr, t, d, S.kind);
        const items = data.items || [];
        if (items.length === 1 || v === 'hero') {
          const it = items[0];
          const w = land ? W * 0.6 : CW;
          const tb = textBlock(Lr, it.title, { w, size: (port ? 64 : 58) * TU, min: 30 * TU, maxLines: 2, color: S.mute, font: ui, weight: 600, ls: '0', align: 'center', css: `left:${(W - w) / 2}px;top:${H / 2 - 190 * U}px` });
          const pr = el('div', `position:absolute;left:0;right:0;top:${H / 2 - 100 * U}px;text-align:center;font-family:${disp};font-weight:${DW};font-size:${(port ? 220 : 200) * TU}px;line-height:1;letter-spacing:-.03em;color:${S.acc};`, Lr);
          const chars = String(it.price || '').split('');
          pr.innerHTML = '<span class="pw" style="display:inline-block;white-space:nowrap">' + chars.map((c) => `<span style="display:inline-block;overflow:hidden;vertical-align:top;padding:0 .01em"><span class="c" style="display:inline-block">${esc(c === ' ' ? '\u00a0' : c)}</span></span>`).join('') + '</span>';
          const pw = pr.querySelector('.pw');
          while (pw.offsetWidth > (land ? W * 0.7 : CW) && parseFloat(pr.style.fontSize) > 60 * U) pr.style.fontSize = parseFloat(pr.style.fontSize) * 0.93 + 'px';
          // the name sits just above the price, the pair centred
          const ph = pr.offsetHeight, th = tb.offsetHeight, gap = 40 * U, top = (H - (th + gap + ph)) / 2;
          tb.style.top = top + 'px'; pr.style.top = top + th + gap + 'px';
          reveal(tb, t + 0.3, { soft: true });
          tl.fromTo(pr.querySelectorAll('.c'), { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: EASE, stagger: 0.05 }, t + 0.6);
          drift(pr, t + 1.4, d - 1.2, { from: 1, to: 1.04, y: 0 });
          sound(t + 0.6, 'tick', 0.3);
          return;
        }
        const colW = land ? W * 0.62 : CW, left = (W - colW) / 2, rowH = (port ? 150 : 124) * TU;
        const top0 = (H - items.length * rowH) / 2 + 30 * U;
        const head = label(Lr, data.title || 'Prices', `left:${left}px;top:${top0 - 80 * U}px`, S.acc); fadeUp(head, t + 0.2);
        items.forEach((it, i) => {
          const y = top0 + i * rowH, ti = t + 0.4 + i * 0.32;
          const row = el('div', `position:absolute;left:${left}px;width:${colW}px;top:${y}px;display:flex;align-items:baseline;gap:${20 * U}px;font-family:${disp};font-weight:${DW};font-size:${(port ? 70 : 60) * TU}px;line-height:1.1;color:${S.ink};${L0.upper ? 'text-transform:uppercase;' : ''}`, Lr);
          const tt = el('span', 'white-space:nowrap', row, esc(it.title));
          el('span', `flex:1;min-width:${30 * U}px;border-bottom:${Math.max(2, 3 * U)}px dotted ${rgba(S.ink, 0.35)};transform:translateY(-.2em)`, row);
          const pp = it.price ? el('span', `white-space:nowrap;color:${S.acc}`, row, esc(it.price)) : null;
          while (tt.offsetWidth + (pp ? pp.offsetWidth : 0) + 60 * U > colW && parseFloat(row.style.fontSize) > 26 * U) row.style.fontSize = parseFloat(row.style.fontSize) * 0.93 + 'px';
          tl.fromTo(row, { opacity: 0, y: 30 * U }, { opacity: 1, y: 0, duration: 0.7, ease: EASE }, ti);
          sound(ti, 'tick', 0.22);
        });
      },
      // where and when
      info(Lr, t, d, data, v, S) {
        decor(Lr, t, d, S.kind);
        const rows = [data.when && ['cal', data.when, data.whenLabel || 'When'], data.place && ['pin', data.place, data.placeLabel || 'Find us']].filter(Boolean);
        const w = land ? W * 0.7 : CW, blocks = [];
        let total = 0;
        rows.forEach(([ic, text, lab]) => { const tb = textBlock(Lr, text, { w, size: (port ? 108 : 96) * TU, min: 40 * TU, maxLines: rows.length > 1 ? 2 : 3, color: S.ink, upper: L0.upper, align: 'center', css: `left:${(W - w) / 2}px;top:0` }); const h = 110 * TU + 60 * TU + tb.offsetHeight; blocks.push([ic, tb, lab, h]); total += h; });
        total += (rows.length - 1) * 90 * TU;
        let y = (H - total) / 2;
        blocks.forEach(([ic, tb, lab, h], i) => {
          const ti = t + 0.1 + i * 0.45;
          const ib = el('div', `position:absolute;left:${(W - 100 * TU) / 2}px;top:${y}px;`, Lr, icon(ic, 100 * TU, S.acc, 1.5));
          const paths = ib.querySelectorAll('path,circle,rect');
          paths.forEach((p) => { const L = p.getTotalLength ? p.getTotalLength() : 80; p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
          tl.to(paths, { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut', stagger: 0.08 }, ti);
          if (ic === 'pin') {
            // a route draws in from the corner and a dot travels it to the pin, which lands with a bounce
            const ex = W / 2 - 66 * TU, ey = y + 46 * TU, sx = M * 0.7, sy = Math.max(M * 0.7, y - H * 0.28);
            const route = `M${sx},${sy} C${W * 0.32},${sy + 40 * U} ${W * 0.08},${ey - 20 * U} ${ex},${ey}`;
            const rv = el('div', 'position:absolute;inset:0;pointer-events:none;', Lr, `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;inset:0;overflow:visible"><path d="${route}" fill="none" stroke="${rgba(S.acc, 0.6)}" stroke-width="${Math.max(2, 3.5 * U)}" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`);
            const rp = rv.querySelector('path');
            tl.to(rp, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, ti + 0.1);
            if (hasPath) {
              const dot = el('div', `position:absolute;left:0;top:0;width:${22 * U}px;height:${22 * U}px;border-radius:50%;background:${S.acc};box-shadow:0 0 0 ${8 * U}px ${rgba(S.acc, 0.2)};`, Lr);
              tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.15 }, ti + 0.1);
              tl.to(dot, { motionPath: { path: rp, align: rp, alignOrigin: [0.5, 0.5] }, duration: 1.1, ease: 'power2.inOut' }, ti + 0.1);
              tl.to(dot, { scale: 0, duration: 0.25, ease: 'power2.in' }, ti + 1.15);
            }
            tl.fromTo(ib, { y: -30 * U, scale: 1 }, { y: 0, scale: 1, duration: 0.6, ease: 'bounce.out' }, ti + 1.1);
            sound(ti + 1.2, 'pop', 0.25);
          }
          const lb = label(Lr, lab, `left:0;right:0;text-align:center;top:${y + 120 * TU}px`, S.acc); fadeUp(lb, ti + 0.2);
          tb.style.top = `${y + 170 * TU}px`; reveal(tb, ti + 0.25);
          drift(tb, ti + 1.3, d - 1.3 - i * 0.45, { from: 1, to: 1.03, y: 0 });
          y += h + 90 * TU;
        });
        sound(t + 0.2, 'swish', 0.25);
      },
      // a second line from the owner, set big
      statement(Lr, t, d, data, v, S) {
        decor(Lr, t, d, S.kind);
        const w = land ? W * 0.72 : CW;
        const b = textBlock(Lr, data.text, { w, size: (port ? 120 : 110) * TU, min: 44 * TU, maxLines: port ? 5 : 3, color: S.ink, accent: L0.accentWord, accentCss: acc(S), upper: L0.upper, align: L0.center || land ? 'center' : 'left', css: L0.center || land ? `left:${(W - w) / 2}px;top:50%` : `left:${M}px;top:50%` });
        b.style.transform = 'translateY(-50%)';
        if (data.label) { const lb = label(Lr, data.label, L0.center || land ? `left:0;right:0;text-align:center;top:${H / 2 - b.offsetHeight / 2 - 80 * U}px` : `left:${M}px;top:${H / 2 - b.offsetHeight / 2 - 80 * U}px`, S.acc); fadeUp(lb, t + 0.2); }
        reveal(b, t + 0.35, { stagger: 0.12 }); underline(b, t + 1.2, L0.id === 'bold' ? (S.kind === 'accent' ? onColor(A) : A2) : S.acc);
        drift(b, t + 1.3, d - 1.1, { from: 1, to: 1.03, y: 0 });
      },
      // the close: mark, name, the action, how to reach them. It keeps breathing until the last frame.
      end(Lr, t, d, data, v, S) {
        const glow = el('div', `position:absolute;width:${1.3 * Math.max(W, H)}px;height:${1.3 * Math.max(W, H)}px;left:50%;top:50%;margin:-${0.65 * Math.max(W, H)}px;background:radial-gradient(circle, ${rgba(S.acc, L0.dark || S.kind === 'accent' ? 0.18 : 0.1)} 0%, transparent 55%);`, Lr);
        tl.fromTo(glow, { scale: 0.85, opacity: 0 }, { scale: 1.15, opacity: 1, duration: d, ease: 'none' }, t);
        const leftA = v === 'left' && !land;
        const mk = (port ? 200 : 160) * TU;
        const contacts = [data.phone && [data.whatsapp ? 'chat' : 'phone', data.phone], data.place && ['pin', data.place]].filter(Boolean);
        // measure the stack first so it sits centred
        const nameW = land ? W * 0.7 : CW;
        const nb = textBlock(Lr, cfg.brand, { w: nameW, size: (port ? 96 : 88) * TU, min: 40 * TU, maxLines: 2, color: S.ink, upper: L0.upper, align: leftA ? 'left' : 'center', css: leftA ? `left:${M}px;top:0` : `left:${(W - nameW) / 2}px;top:0` });
        const btnH = (port ? 112 : 100) * TU, gap = 46 * TU, cH = contacts.length * 64 * TU;
        const stackH = mk + gap + nb.offsetHeight + gap * 1.2 + btnH + (contacts.length ? gap + cH : 0);
        let y = (H - stackH) / 2;
        const mkBox = mark(Lr, mk, leftA ? `left:${M}px;top:${y}px` : `left:${(W - mk) / 2}px;top:${y}px`, t + 0.2, S.ink);
        y += mk + gap; nb.style.top = y + 'px'; y += nb.offsetHeight + gap * 1.2;
        reveal(nb, t + 0.55);
        tl.fromTo(mkBox, { scale: 1 }, { scale: 1.04, duration: d, ease: 'none' }, t + 1.4);
        // the call to action as a real button
        const bw = Math.min(CW, Math.max(420 * TU, String(data.cta || '').length * 30 * TU + 190 * TU));
        const btn = el('div', `position:absolute;${leftA ? `left:${M}px` : `left:${(W - bw) / 2}px`};top:${y}px;width:${bw}px;height:${btnH}px;border-radius:${L0.pill ? btnH / 2 : L0.radius * U}px;background:${S.acc};color:${onColor(S.acc)};display:flex;align-items:center;justify-content:center;gap:${18 * U}px;font-family:${ui};font-weight:700;font-size:${(port ? 46 : 42) * TU}px;letter-spacing:${L0.upper ? '.08em' : '0'};${L0.upper ? 'text-transform:uppercase;' : ''}overflow:hidden;box-shadow:0 ${20 * U}px ${50 * U}px ${rgba(S.acc, 0.35)};`, Lr);
        const btxt = el('span', 'white-space:nowrap', btn, esc(data.cta || 'Get in touch'));
        el('span', 'display:block', btn, icon('arrow', 40 * TU, onColor(S.acc), 2.2));
        while (btxt.offsetWidth > bw - 140 * U && parseFloat(btn.style.fontSize) > 22 * U) btn.style.fontSize = parseFloat(btn.style.fontSize) * 0.92 + 'px';
        const shine = el('div', `position:absolute;top:-20%;bottom:-20%;width:${bw * 0.3}px;left:0;background:linear-gradient(100deg, transparent, rgba(255,255,255,.45), transparent);transform:skewX(-20deg);`, btn);
        const tb = t + 1.05;
        // the button is born as a dot and springs open into its full width
        const finalL = leftA ? M : (W - bw) / 2, finalR = L0.pill ? btnH / 2 : L0.radius * U;
        const inner = [...btn.children].filter((c) => c !== shine);
        tl.fromTo(btn, { opacity: 0, scale: 0, width: btnH, left: leftA ? M : W / 2 - btnH / 2, borderRadius: btnH / 2 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, tb);
        tl.to(btn, { width: bw, left: finalL, borderRadius: finalR, duration: 0.75, ease: 'back.out(1.25)' }, tb + 0.35);
        tl.fromTo(inner, { opacity: 0, x: -14 * U }, { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out', stagger: 0.08 }, tb + 0.7);
        tl.to(btn, { scale: 0.95, duration: 0.12, ease: 'power2.in' }, tb + 1.0).to(btn, { scale: 1, duration: 0.5, ease: 'back.out(2.5)' }, tb + 1.12);
        sound(tb + 1.0, 'click', 0.35);
        for (let s = tb + 0.7, k = 0; s < t + d - 0.9 && k < 8; s += 2.4, k++) tl.fromTo(shine, { x: -bw * 0.4 }, { x: bw * 1.3, duration: 0.9, ease: 'power2.inOut' }, s);
        y += btnH + gap;
        contacts.forEach(([ic, text], i) => {
          const row = el('div', `position:absolute;${leftA ? `left:${M}px` : 'left:0;right:0;justify-content:center'};top:${y + i * 64 * TU}px;display:flex;align-items:center;gap:${16 * U}px;font-family:${ui};font-weight:600;font-size:${(port ? 38 : 34) * TU}px;color:${S.ink};white-space:nowrap;`, Lr);
          row.innerHTML = icon(ic, 38 * TU, S.acc, 2) + `<span>${esc(text)}</span>`;
          fadeUp(row, tb + 0.4 + i * 0.15);
        });
        sound(t + 0.5, 'chime', 0.4);
      },
    };

    // ================================================================ transitions between beats
    const TRANS = {
      wipe(prev, next, t, d) { tl.fromTo(next, { clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)', duration: d, ease: 'expo.inOut' }, t); tl.to(prev, { x: -0.18 * W, duration: d, ease: 'expo.inOut' }, t); },
      rise(prev, next, t, d) { tl.fromTo(next, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: d, ease: 'expo.inOut' }, t); tl.to(prev, { y: -0.16 * H, duration: d, ease: 'expo.inOut' }, t); },
      dissolve(prev, next, t, d) { tl.fromTo(next, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: d * 1.2, ease: 'power2.inOut' }, t); tl.to(prev, { scale: 1.03, duration: d * 1.2, ease: 'power2.inOut' }, t); },
      iris(prev, next, t, d) { tl.fromTo(next, { clipPath: 'circle(0% at 50% 55%)' }, { clipPath: 'circle(75% at 50% 55%)', duration: d * 1.1, ease: 'power3.inOut' }, t); tl.to(prev, { scale: 0.94, duration: d * 1.1, ease: 'power3.inOut' }, t); },
      open(prev, next, t, d) { tl.fromTo(next, { clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0% 0 0%)', duration: d, ease: 'expo.inOut' }, t); tl.to(prev, { scale: 0.92, opacity: 0.4, duration: d, ease: 'expo.inOut' }, t); },
      block(prev, next, t, d) {
        const p = el('div', `position:absolute;inset:0;background:${A};z-index:50;visibility:hidden;`, stage);
        tl.set(p, { visibility: 'visible' }, t);
        tl.fromTo(p, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: d * 0.5, ease: 'expo.in' }, t);
        tl.fromTo(next, { opacity: 0 }, { opacity: 1, duration: 0.01 }, t + d * 0.5);
        tl.to(p, { clipPath: 'inset(0 0 0 100%)', duration: d * 0.55, ease: 'expo.out' }, t + d * 0.5);
        tl.set(p, { visibility: 'hidden' }, t + d * 1.05);
      },
    };

    // ================================================================ build the film
    const T = cfg.overlap || 0.7;
    let s = 0, prev = null;
    cfg.beats.forEach((b, i) => {
      const S = surface(b.surface || 'base'); S.kind = b.surface || 'base';
      const Lr = el('div', `position:absolute;inset:0;overflow:hidden;background:${S.bg};visibility:hidden;`, stage);
      tl.set(Lr, { visibility: 'visible' }, s);
      const start = i === 0 ? 0 : s + T * 0.12;
      try { BEATS[b.type](Lr, start, b.dur - (start - s), b.data || {}, b.v, S); } catch (e) { console.error('[story] beat', b.type, e); }
      if (prev) {
        const name = b.trans && TRANS[b.trans] ? b.trans : 'dissolve';
        TRANS[name](prev, Lr, s, T);
        sound(s, name === 'dissolve' ? 'swish' : 'whoosh', 0.22);
        const p = prev; tl.set(p, { visibility: 'hidden' }, s + T * 1.25);
      } else {
        tl.fromTo(Lr, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power1.out' }, 0);
      }
      prev = Lr;
      s += b.dur - (i < cfg.beats.length - 1 ? T : 0);
    });
    const end = cfg.target || s;

    // ---------- finish: grain, vignette, a slow light across the whole film, and a soft fade out
    const top = el('div', 'position:absolute;inset:0;pointer-events:none;z-index:60;', stage);
    if (L0.vignette) el('div', `position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,${L0.vignette}) 100%);`, top);
    if (L0.leak) {
      const lk = el('div', `position:absolute;width:${Math.max(W, H)}px;height:${Math.max(W, H)}px;left:-${0.5 * Math.max(W, H)}px;top:-${0.3 * Math.max(W, H)}px;border-radius:50%;background:radial-gradient(circle, ${rgba(L0.leak, 0.22)} 0%, transparent 60%);mix-blend-mode:screen;`, top);
      tl.fromTo(lk, { x: 0, y: 0 }, { x: W * 1.1, y: H * 0.5, duration: end, ease: 'none' }, 0);
    }
    if (L0.grain) {
      const c = document.createElement('canvas'); c.width = c.height = 180; const g = c.getContext('2d'), im = g.createImageData(180, 180), rr = rng(99);
      for (let i = 0; i < im.data.length; i += 4) { const v = rr() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      g.putImageData(im, 0, 0);
      const gr = el('div', `position:absolute;inset:0;background:url(${c.toDataURL()});background-size:${Math.round(180 * U)}px;opacity:${L0.grain};mix-blend-mode:overlay;`, top);
      const n = Math.max(1, Math.round(end * 12));
      tl.fromTo(gr, { backgroundPosition: '0px 0px' }, { backgroundPosition: `${137 * n}px ${91 * n}px`, duration: end, ease: `steps(${n})` }, 0);
    }
    const fade = el('div', `position:absolute;inset:0;background:${L0.dark ? '#000' : L0.bg};opacity:0;`, top);
    tl.to(fade, { opacity: 0.0, duration: 0.01 }, 0);
    // exact length: no move may run past the last frame (slow camera moves are cut at the end, never stretched)
    // (moved into a fresh timeline, because a timeline does not shrink when a child is shortened)
    const film = gsap.timeline({ paused: true });
    tl.getChildren(false, true, false).forEach((c) => { const st = c.startTime(); tl.remove(c); if (st >= end - 0.001) return; if (st + c.totalDuration() > end) c.duration(Math.max(0.01, end - st)); film.add(c, st); });
    film.set({}, {}, end);
    tl.kill();
    // keep only soft sounds, never two of a kind too close together
    const out = sfx.filter((x) => x.t < end - 0.1).sort((a, b) => a.t - b.t).filter((x, i, arr) => !arr.slice(Math.max(0, i - 3), i).some((y) => y.k === x.k && x.t - y.t < 0.2));
    if (!cfg.noGlobal) { window.__sfx = out; window.__timeline = film; }
    return { tl: film, sfx: out, duration: end };
  };
})();
