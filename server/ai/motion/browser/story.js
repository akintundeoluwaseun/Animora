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
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5s1.3-6.1 3.9-8.5z"/>',
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
    const tallK = Math.max(0, Math.min(1, (H / W - 1.25) / (16 / 9 - 1.25)));   // 0 at 4:5, 1 at 9:16
    const TU = U * (port ? 1.24 + 0.12 * tallK : land ? 1.34 : 1.2) * (cfg.textScale || 1);   // type is set larger than layout so it reads on a phone
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
    // sound: every look has its own palette of recorded, CC0 effects (assets/sfx); transitions rotate so no two cuts sound alike
    const PAL = {
      editorial: { trans: ['swish-1', 'swish-2', 'swish-3'], hook: 'trans-soft-2', reveal: 'swish-4', pop: 'plop', tick: 'tap-wood', price: 'coins', offer: 'sparkle', end: 'chime-soft', click: 'click-soft', swell: 'swell', sting: 'swell', photo: 'swish-1', type: 'tap-wood', pin: 'plop' },
      noir: { trans: ['trans-soft-3', 'trans-air', 'whoosh-deep'], hook: 'whoosh-deep', reveal: 'trans-air', pop: 'pop-soft', tick: 'tap-wood', price: 'coins', offer: 'sparkle', end: 'chime-classic', click: 'click-soft', swell: 'swell', sting: 'swell', photo: 'trans-air', type: 'tap-wood', pin: 'pop-soft' },
      bold: { trans: ['whoosh-fast', 'trans-pass', 'whoosh-large', 'trans-classic'], hook: 'whoosh-large', reveal: 'whoosh-fast', pop: 'pop-hand', tick: 'select', price: 'cash', offer: 'pop-hand', end: 'success', click: 'click-soft', swell: 'swell', sting: 'trans-pass', photo: 'whoosh-fast', type: 'select', pin: 'pop-hand' },
      fresh: { trans: ['trans-soft-1', 'swish-5', 'trans-soft-2', 'swish-6'], hook: 'trans-soft-2', reveal: 'swish-5', pop: 'pop-soft', tick: 'confirm', price: 'coins', offer: 'sparkle', end: 'success', click: 'click-soft', swell: 'swell', sting: 'sparkle-rise', photo: 'shutter', type: 'tap-wood', pin: 'pop-soft' },
      tech: { trans: ['trans-classic', 'whoosh-fast', 'trans-pass'], hook: 'trans-pass', reveal: 'trans-classic', pop: 'select', tick: 'select', price: 'ping', offer: 'ping', end: 'ping', click: 'click-soft', swell: 'swell', sting: 'typing', photo: 'shutter', type: 'typing', pin: 'select' },
      clean: { trans: ['trans-soft-1', 'trans-soft-2', 'swish-3'], hook: 'trans-soft-2', reveal: 'swish-3', pop: 'pop-soft', tick: 'tap-wood', price: 'coins', offer: 'sparkle', end: 'chime-soft', click: 'click-soft', swell: 'swell', sting: 'swell', photo: 'shutter', type: 'tap-wood', pin: 'pop-soft' },
    };
    const VOL = { trans: 0.9, hook: 1, reveal: 0.8, pop: 0.9, tick: 0.6, price: 0.9, offer: 0.8, end: 0.9, click: 0.8, swell: 0.7, sting: 0.8, photo: 0.7, type: 0.45, pin: 0.8 };
    const pal = PAL[L0.id] || PAL.clean, turn = {};
    const sound = (t, role, v) => {
      if (cfg.sound === 'none') return;
      let k = pal[role] || role;
      if (Array.isArray(k)) { const n = (turn[role] = (turn[role] == null ? (cfg.seed || 1) % k.length : turn[role] + 1)); k = k[n % k.length]; }
      sfx.push({ t: Math.max(0, +t.toFixed(3)), k, r: role, v: VOL[role] != null ? VOL[role] * (v == null ? 1 : v) : (v == null ? 0.8 : v) });
    };

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
      if (o.track) { tl.fromTo(lines, { opacity: 0, letterSpacing: '0.28em', filter: `blur(${10 * U}px)` }, { opacity: 1, letterSpacing: box.style.letterSpacing || '-0.02em', filter: 'blur(0px)', duration: 1.3, ease: 'expo.out', stagger: 0.14 }, t); return t + 1.3 + (lines.length - 1) * 0.14; }
      if (fx.calm || o.soft) tl.fromTo(lines, { opacity: 0, y: (o.dy || 40) * U }, { opacity: 1, y: 0, duration: o.dur || 1.1, ease: 'power2.out', stagger: o.stagger || 0.12 }, t);
      else tl.fromTo(lines, { yPercent: 112, rotate: o.tilt ? 2.5 : 0 }, { yPercent: 0, rotate: 0, duration: o.dur || 0.95, ease: EASE, stagger: o.stagger || 0.09 }, t);
      return t + (o.dur || 0.95) + (lines.length - 1) * (o.stagger || 0.09);
    }
    function fadeUp(nodes, t, o = {}) { [].concat(nodes).forEach((n) => { const pl = n && n.dataset && n.dataset.pill ? n.querySelector('.pill') : null; if (pl) tl.fromTo(pl, { clipPath: 'inset(0 100% 0 0 round 999px)' }, { clipPath: 'inset(0 0% 0 0 round 999px)', duration: 0.7, ease: 'expo.out' }, t); }); if (L0.id === 'tech') [].concat(nodes).forEach((n) => { if (n && n.dataset && n.dataset.lab) scramble(n, t, 0.8); }); tl.fromTo(nodes, { opacity: 0, y: (o.dy || 24) * U }, { opacity: o.to || 1, y: 0, duration: o.dur || 0.8, ease: 'power2.out', stagger: o.stagger || 0.08 }, t); }
    // a quiet drift so a held frame never looks frozen
    // centre a block on a line by its measured height (no CSS translate, which a later tween could undo)
    function centreY(node, mid = H / 2) { node.style.transform = ''; node.style.top = `${mid - node.offsetHeight / 2}px`; return node; }
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
      draw(); if (L0.id === 'tech' && dur > 0.7) sound(t, 'type', 0.8);
      tl.fromTo(st, { p: 0 }, { p: 1, duration: dur, ease: 'none', onUpdate: draw }, t);
    }
    // a hand-drawn stroke under the accent word, or a marker block behind it (bold)
    function underline(box, t, color) {
      const a = box.querySelector('.acc'); if (!a) return;
      // measure with the lines at rest (an entrance may have widened their letter spacing)
      const saved = (box._lines || []).map((l) => l.style.letterSpacing); (box._lines || []).forEach((l) => { l.style.letterSpacing = ''; });
      // position inside the block, ignoring the moves on the lines (offsets add up through each layer)
      let x = 0, y = 0, n = a;
      while (n && n !== box) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; if (n && !box.contains(n) && n !== box) { const br = box.getBoundingClientRect(), ar = a.getBoundingClientRect(); x = ar.left - br.left; y = ar.top - br.top; break; } }
      const w = a.offsetWidth, h = a.offsetHeight, fs = parseFloat(box.style.fontSize) || 80;
      (box._lines || []).forEach((l, i) => { l.style.letterSpacing = saved[i]; });
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
      svg.style.opacity = 0; tl.set(svg, { opacity: 1 }, t);
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

    // per-look finish on big type: neon glow and a colour-split entrance (Tech), long shadow (Bold), gradient sweep on the key word (Fresh, Clean)
    function polish(box, t, d, S, onPhoto) {
      if (L0.id === 'tech') {
        const glow = `0 0 ${22 * U}px ${rgba(A, 0.55)}`;
        tl.fromTo(box, { textShadow: `${8 * U}px 0 0 rgba(255,0,80,.85), ${-8 * U}px 0 0 rgba(0,220,255,.85), ${glow}` }, { textShadow: `0px 0 0 rgba(255,0,80,0), 0px 0 0 rgba(0,220,255,0), ${glow}`, duration: 0.6, ease: 'steps(6)' }, t);
      } else if (L0.id === 'bold' && !onPhoto) {
        const c = S.kind === 'accent' ? 'rgba(0,0,0,.28)' : rgba(A, 0.55), n = 14, step = 1.6 * U;
        const at = (k) => Array.from({ length: n }, (_, i) => `${(i + 1) * step * k}px ${(i + 1) * step * k}px 0 ${c}`).join(', ');
        tl.fromTo(box, { textShadow: at(0) }, { textShadow: at(1), duration: 0.8, ease: 'expo.out' }, t + 0.5);
      } else if ((L0.id === 'fresh' || L0.id === 'clean') && !onPhoto) {
        const a = box.querySelector('.acc'); if (!a) return;
        const c1 = S.acc, c2 = S.kind === 'accent' ? S.ink : readable(A2, S.bg);
        a.style.cssText += `;background-image:linear-gradient(100deg, ${c1} 0%, ${c2} 50%, ${c1} 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;`;
        tl.fromTo(a, { backgroundPosition: '0% 50%' }, { backgroundPosition: '100% 50%', duration: Math.max(1, d), ease: 'none' }, t);
      }
    }
    // anamorphic lens flare: a long thin streak of light that crosses the frame (Noir, Tech)
    function flare(parent, t, y, color) {
      const c = color || (L0.id === 'tech' ? A : L0.leak || A);
      const st = el('div', `position:absolute;left:-60%;width:220%;top:${y}px;height:${Math.max(2, 4 * U)}px;margin-top:-${2 * U}px;background:linear-gradient(90deg, transparent 0%, ${rgba(c, 0)} 30%, ${rgba(c, 0.9)} 48%, #ffffff 50%, ${rgba(c, 0.9)} 52%, ${rgba(c, 0)} 70%, transparent 100%);filter:blur(${1.5 * U}px);mix-blend-mode:screen;pointer-events:none;`, parent);
      const core = el('div', `position:absolute;left:0;top:${y}px;width:${120 * U}px;height:${120 * U}px;margin:-${60 * U}px 0 0 -${60 * U}px;border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,.9) 0%, ${rgba(c, 0.45)} 30%, transparent 70%);mix-blend-mode:screen;pointer-events:none;`, parent);
      tl.fromTo(st, { xPercent: -30, opacity: 0 }, { xPercent: 30, opacity: 1, duration: 1.1, ease: 'power2.inOut' }, t);
      tl.to(st, { opacity: 0, duration: 0.5 }, t + 0.9);
      tl.fromTo(core, { x: W * 0.1, opacity: 0, scale: 0.6 }, { x: W * 0.9, opacity: 1, scale: 1, duration: 1.1, ease: 'power2.inOut' }, t);
      tl.to(core, { opacity: 0, duration: 0.4 }, t + 0.95);
    }

    const accOnPhoto = /italic/.test(L0.accentCss || '') ? 'font-style:italic' : `color:${L0.photoLabel || '#FFFFFF'}`;
    const acc = (S) => (L0.accentCss ? (S.kind === 'accent' ? L0.accentCss.replace(/color:[^;]+;?/, '') : L0.accentCss) : `color:${S.acc}`);
    // ---------- small labels
    function label(parent, text, css, color) {
      const n = el('div', `position:absolute;${css};font-family:${ui};font-weight:600;font-size:${Math.round((land ? 24 : 26) * TU)}px;letter-spacing:.22em;text-transform:uppercase;color:${color || A};white-space:nowrap;`, parent, esc(text));
      n.dataset.lab = '1';
      n.above = (y, gap = 24 * U) => { n.style.top = `${y - n.offsetHeight - gap}px`; return n; };
      // auto-sized pill behind the words (Fresh, Clean): it grows with the text
      if ((L0.id === 'fresh' || L0.id === 'clean') && color !== '#FFFFFF' && !/font-size:\$\{22/.test(css)) {
        const right = /text-align:right/.test(css), centre = /text-align:center/.test(css);
        n.innerHTML = `<span class="pill" style="display:inline-block;padding:.6em 1.15em;border-radius:999px;background:${rgba(color || A, 0.13)};${centre ? '' : right ? 'margin-right:-1.15em' : 'margin-left:-1.15em'}">${esc(text)}</span>`;
        n.dataset.pill = '1';
      }
      return n;
    }
    function rule(parent, css, color) { return el('div', `position:absolute;${css};height:${Math.max(2, Math.round(2.5 * U))}px;background:${color || A};transform-origin:left center;`, parent); }

    // ---------- photos: full bleed with a slow camera move, or whole on a soft copy of itself when the picture is small or oddly shaped
    // a picture's own shape (width / height), when the upload told us
    function ratioOf(src) { return Number(((cfg.facts || {}).ratios || {})[src]) || 0; }
    // shrink a box so its shape stays close to the picture's (at most ~20% of the picture cropped), centred where it was
    function shapeBox(b, ri, slack = 1.25) {
      if (!ri) return b; const rb = b.w / b.h;
      if (rb > ri * slack) { const w = b.h * ri * slack; return { ...b, l: b.l + (b.w - w) / 2, w }; }
      if (rb < ri / slack) { const h = (b.w * slack) / ri; return { ...b, t: b.t + (b.h - h) / 2, h }; }
      return b;
    }
    function photo(parent, src, fit, t, d, o = {}) {
      const box = el('div', `position:absolute;${o.css || 'inset:0'};overflow:hidden;${o.radius ? `border-radius:${o.radius}px;` : ''}background:#111;`, parent);
      // a picture that would lose more than half of itself to the crop is shown whole on a soft copy of itself instead
      const ri = ratioOf(src), bw = box.offsetWidth || W, bh = box.offsetHeight || H;
      if (fit !== 'contain' && ri && !o.forceCover && Math.min(ri / (bw / bh), (bw / bh) / ri) < 0.5) fit = 'contain';
      if (fit === 'contain') {
        const back = el('div', `position:absolute;inset:-8%;background:url("${src}") center/cover;filter:blur(${40 * U}px) brightness(.55) saturate(1.15);`, box);
        const front = el('img', `position:absolute;left:8%;top:8%;width:84%;height:84%;object-fit:contain;filter:drop-shadow(0 ${30 * U}px ${50 * U}px rgba(0,0,0,.45));`, box);
        front.src = src;
        // dolly zoom: the backdrop grows while the picture eases back, so the space seems to stretch
        tl.fromTo(back, { scale: 1 }, { scale: 1.22, duration: Math.max(1, d), ease: 'power1.inOut' }, t);
        tl.fromTo(front, { scale: 1.08 }, { scale: 0.97, duration: Math.max(1, d), ease: 'power1.inOut' }, t);
        return box;
      }
      const img = el('img', `position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:${o.pos || '50% 50%'};transform-origin:${o.origin || '50% 50%'};`, box);
      img.src = src;
      const dir = o.dir || (R() < 0.5 ? 1 : -1);
      tl.fromTo(img, { scale: o.zoomFrom || 1.16, xPercent: -2.2 * dir }, { scale: o.zoomTo || 1.04, xPercent: 2.2 * dir, duration: Math.max(1, d), ease: 'none' }, t);
      // focus pull: the lens finds the picture as the scene opens
      const fbase = o.treat === 'duotone' ? 'grayscale(1) contrast(1.15) ' : '';
      if (o.focus !== false) tl.fromTo(img, { filter: `${fbase}blur(${16 * U}px)` }, { filter: `${fbase}blur(0px)`, duration: 0.9, ease: 'power2.out' }, Math.max(0, t + (o.focusAt || 0.5)));
      // handheld: a tiny, slow camera sway (deterministic), so a still feels filmed
      if (o.wiggle) { const steps = Math.max(2, Math.round(d / 0.7)), amp = 7 * U; for (let i = 0; i < steps; i++) { const a0 = hash(i * 31 + (cfg.seed || 1)), b0 = hash(i * 17 + 5); tl.to(box, { x: ((a0 % 200) / 100 - 1) * amp, y: ((b0 % 200) / 100 - 1) * amp, rotate: ((a0 % 100) / 100 - 0.5) * 0.4, duration: d / steps, ease: 'sine.inOut' }, t + (i * d) / steps); } }
      if (o.treat === 'duotone') {
        if (o.focus === false) img.style.filter = 'grayscale(1) contrast(1.15)';
        el('div', `position:absolute;inset:0;background:${A};mix-blend-mode:multiply;opacity:.85;`, box);
        el('div', `position:absolute;inset:0;background:${A2};mix-blend-mode:screen;opacity:.22;`, box);
      } else if (o.treat === 'halftone') {
        el('div', `position:absolute;inset:0;background-image:radial-gradient(circle, rgba(0,0,0,.55) ${1.6 * U}px, transparent ${2.2 * U}px);background-size:${9 * U}px ${9 * U}px;mix-blend-mode:multiply;opacity:.55;`, box);
      }
      if (L0.grade && o.treat !== 'duotone') el('div', `position:absolute;inset:0;background:${L0.grade};mix-blend-mode:${L0.gradeBlend || 'soft-light'};`, box);
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
        const SS = surface(kind);
        const top = rule(Lr, `left:${M}px;right:${M}px;top:${M * 0.9}px`, rgba(SS.ink, 0.8)), bot = rule(Lr, `left:${M}px;right:${M}px;bottom:${M * 0.9}px`, rgba(SS.ink, 0.8));
        tl.fromTo([top, bot], { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: 'power3.inOut', stagger: 0.1 }, t);
        const bl = label(Lr, cfg.brand, `left:${M}px;top:${M * 0.9 + 22 * U}px;font-size:${22 * TU}px`, SS.ink);
        if (cfg.category) { const cl = label(Lr, cfg.category, `right:${M}px;top:${M * 0.9 + 22 * U}px;font-size:${22 * TU}px;text-align:right`, SS.mute); if (bl.offsetWidth + cl.offsetWidth + 40 * U > CW) cl.remove(); }
      } else if (id === 'bold') {
        const col = kind === 'accent' ? onColor(A) : A, word = String(cfg.brand || '').toUpperCase();
        [0.18, 0.5, 0.82].forEach((yy, i) => {
          const row = el('div', `position:absolute;left:0;top:${H * yy}px;white-space:nowrap;font-family:${disp};font-size:${(port ? 300 : 260) * U}px;line-height:1;color:transparent;-webkit-text-stroke:${Math.max(1.5, 2.5 * U)}px ${rgba(col, 0.16)};transform:translateY(-50%);`, Lr, esc((word + ' · ').repeat(4)));
          const dir = i % 2 ? 1 : -1;
          tl.fromTo(row, { x: dir > 0 ? -W * 1.2 : 0 }, { x: dir > 0 ? 0 : -W * 1.2, duration: Math.max(1, d) * 1.8, ease: 'none' }, t - 0.4);
        });
        const ht = el('div', `position:absolute;right:-${W * 0.1}px;bottom:-${H * 0.05}px;width:${W * 0.8}px;height:${H * 0.5}px;background-image:radial-gradient(circle, ${rgba(col, 0.32)} ${3 * U}px, transparent ${3.6 * U}px);background-size:${16 * U}px ${16 * U}px;-webkit-mask-image:linear-gradient(135deg, transparent 30%, #000 100%);mask-image:linear-gradient(135deg, transparent 30%, #000 100%);`, Lr);
        tl.fromTo(ht, { opacity: 0, x: 60 * U }, { opacity: 1, x: 0, duration: 1, ease: 'expo.out' }, t + 0.1);
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
        const dots = el('div', `position:absolute;inset:0;background-image:radial-gradient(circle, ${rgba(A, 0.35)} ${1.4 * U}px, transparent ${1.9 * U}px);background-size:${30 * U}px ${30 * U}px;-webkit-mask-image:radial-gradient(ellipse at 50% 55%, #000 0%, transparent 62%);mask-image:radial-gradient(ellipse at 50% 55%, #000 0%, transparent 62%);`, Lr);
        tl.fromTo(dots, { opacity: 0, scale: 1.15 }, { opacity: 1, scale: 1, duration: Math.max(1, d), ease: 'power1.out' }, t);
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
    // an accent that is too pale (or too dark) for the background is nudged until it reads (3.2:1 or better)
    function readable(c, bg) {
      const cr = (x) => { const a = lum(x), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
      if (cr(c) >= 3.2) return c;
      const to = lum(bg) > 0.4 ? 0 : 255, [r, g, b] = rgb(c);
      for (let k = 0.1; k <= 0.9; k += 0.1) { const m = '#' + [r, g, b].map((v) => Math.round(v + (to - v) * k).toString(16).padStart(2, '0')).join(''); if (cr(m) >= 3.2) return m; }
      return onColor(bg);
    }
    function surface(kind) {
      if (kind === 'accent') return { bg: A, ink: onColor(A), mute: rgba(onColor(A), 0.75), acc: onColor(A) === '#FFFFFF' ? (lum(A2) > 0.4 ? A2 : '#FFFFFF') : '#111111' };
      // the text colour always reads on the background (Bold's second surface is cream, so its white type turns dark there)
      const fit = (bg) => { const ok = (c) => { const a = lum(c), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5; }; const i2 = ok(ink) ? ink : onColor(bg); return { bg, ink: i2, mute: i2 === ink ? mute : rgba(i2, 0.68), acc: readable(A, bg) }; };
      if (kind === 'alt') return fit(L0.bg2);
      return fit(L0.bg);
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
          reveal(hb, t + 0.45); underline(hb, t + 1.3, L0.id === 'bold' ? A : (L0.photoLabel || A)); polish(hb, t + 0.45, d, S, true);
          if (L0.id === 'noir' || L0.id === 'tech') flare(Lr, t + 0.3, H * (port ? 0.42 : 0.4));
          if (data.sub && port) { const sb = textBlock(Lr, data.sub, { w: CW, size: 36 * TU, min: 26 * TU, maxLines: 2, font: ui, weight: 500, lh: 1.3, ls: '0', color: 'rgba(255,255,255,.82)', css: `left:${M}px;bottom:${M}px` }); reveal(sb, t + 1.1, { soft: true }); }
          sound(t + 0.4, 'hook');
          return;
        }
        if (photoV && v === 'split') {
          const pbox = port ? `left:0;top:0;width:${W}px;height:${H * 0.56}px` : `left:${W * 0.5}px;top:0;width:${W * 0.5}px;height:${H}px`;
          const pb = photo(Lr, data.photo, data.fit, t - 0.3, d + 1, { css: pbox, pos: data.pos });
          tl.fromTo(pb, { clipPath: port ? 'inset(100% 0 0 0)' : 'inset(0 0 0 100%)' }, { clipPath: 'inset(0% 0 0 0%)', duration: 1.2, ease: 'expo.inOut' }, t);
          const tx = port ? { left: M, top: H * 0.56 + 70 * U, w: CW, h: H * 0.44 - 70 * U - M } : { left: M, top: M, w: W * 0.5 - M * 1.6, h: H - 2 * M };
          const lab = label(Lr, data.label || cfg.brand, `left:${tx.left}px;top:${tx.top}px`, S.acc);
          const hb = textBlock(Lr, data.headline, { w: tx.w, size: (port ? 112 : 104) * TU, min: 40 * TU, maxLines: port ? 3 : 4, maxH: tx.h - lab.offsetHeight - 60 * U, color: S.ink, accent: L0.accentWord, accentCss: acc(S), upper: L0.upper, css: `left:${tx.left}px;top:${tx.top + lab.offsetHeight + 22 * U}px` });
          fadeUp(lab, t + 0.6); reveal(hb, t + 0.75);
          const sb = data.sub ? textBlock(Lr, data.sub, { w: tx.w, size: 34 * TU, min: 24 * TU, maxLines: 3, font: ui, weight: 500, lh: 1.35, ls: '0', color: S.mute, css: `left:${tx.left}px;top:${tx.top + lab.offsetHeight + 22 * U + hb.offsetHeight + 36 * U}px` }) : null;
          if (sb) reveal(sb, t + 1.3, { soft: true });
          // the words sit in the middle of their half, not stuck to its top edge
          const group = lab.offsetHeight + 22 * U + hb.offsetHeight + (sb ? 36 * U + sb.offsetHeight : 0), off = Math.max(0, (tx.h - group) / 2);
          [lab, hb, sb].forEach((n) => { if (n) n.style.top = `${parseFloat(n.style.top) + off}px`; });
          sound(t + 0.1, 'hook', 0.9);
          return;
        }
        // type only
        decor(Lr, t, d, S.kind);
        const center = L0.center || !port;
        const w = land ? W * 0.72 : CW;
        const hb = textBlock(Lr, data.headline, { w, size: (port ? 150 : land ? 136 : 124) * TU, min: 50 * TU, maxLines: port ? 5 : 3, maxH: H - 2 * M - 220 * U, color: S.ink, accent: L0.accentWord, accentCss: acc(S), upper: L0.upper, align: center ? 'center' : 'left', css: center ? `left:${(W - w) / 2}px;top:50%` : `left:${M}px;top:50%` });
        centreY(hb, L0.id === 'bold' && port ? H * 0.4 : H / 2);
        const midY = L0.id === 'bold' && port ? H * 0.4 : H / 2;
        const lab = label(Lr, data.label || cfg.brand, center ? `left:0;right:0;text-align:center;top:0` : `left:${M}px;top:0`, S.acc); lab.above(midY - hb.offsetHeight / 2);
        fadeUp(lab, t + 0.3);
        reveal(hb, t + 0.4, { tilt: L0.id === 'bold', track: L0.id === 'noir' }); polish(hb, t + 0.4, d, S); if (L0.id === 'noir' || L0.id === 'tech') flare(Lr, t + 0.6, midY); underline(hb, t + 1.25, L0.id === 'bold' ? (S.kind === 'accent' ? onColor(A) : A2) : S.acc);
        if (data.sub && L0.id !== 'bold') { const sw = land ? W * 0.55 : CW; const sb = textBlock(Lr, data.sub, { w: sw, size: 36 * TU, min: 24 * TU, maxLines: 2, font: ui, weight: 500, lh: 1.35, ls: '0', color: S.mute, align: center ? 'center' : 'left', css: center ? `left:${(W - sw) / 2}px;top:${H / 2 + hb.offsetHeight / 2 + 50 * U}px` : `left:${M}px;top:${H / 2 + hb.offsetHeight / 2 + 50 * U}px` }); reveal(sb, t + 1.2, { soft: true }); }
        drift(hb, t + 1.4, d - 1.2, { from: 1, to: 1.025, y: 0 });
        sound(t + 0.35, 'hook');
      },
      // a short brand sting before the story
      sting(Lr, t, d, data, v, S) {
        decor(Lr, t, d, S.kind);
        const name = textBlock(Lr, cfg.brand, { w: CW * 0.9, size: (port ? 110 : 120) * TU, min: 40 * TU, maxLines: 2, color: S.ink, upper: true, ls: '0.06em', align: 'center', css: `left:${(W - CW * 0.9) / 2}px;top:50%` });
        centreY(name);
        if (cfg.logo) { mark(Lr, 150 * U, `left:${W / 2 - 75 * U}px;top:${H / 2 - name.offsetHeight / 2 - 190 * U}px`, t + 0.1); }
        if (L0.id === 'tech') name.querySelectorAll('.w').forEach((w, i) => scramble(w, t + 0.15 + i * 0.12, 1.1));
        else if (L0.id === 'bold') revealChars(name, t + 0.15);
        else tl.fromTo(name._lines, { letterSpacing: '0.5em', opacity: 0 }, { letterSpacing: '0.06em', opacity: 1, duration: 1.4, ease: 'expo.out' }, t + 0.15);
        sound(t + 0.1, 'sting');
      },
      // a picture with a caption
      photo(Lr, t, d, data, v, S) {
        const contain = data.fit === 'contain';
        if (v === 'frame' || contain) {
          if (L0.id !== 'bold') decor(Lr, t, d, S.kind);
          const box = !data.caption ? (land ? { l: W * 0.15, t: M * 1.3, w: W * 0.7, h: H - 2.6 * M } : { l: port ? M * 0.6 : M, t: (H - (port ? H * 0.62 : H - 2.4 * M)) / 2, w: port ? W - M * 1.2 : CW, h: port ? H * 0.62 : H - 2.4 * M }) : port ? { l: M, t: H * 0.13, w: CW, h: H * 0.56 } : land ? { l: W * 0.42, t: M, w: W * 0.58 - M, h: H - 2 * M } : { l: M, t: M, w: CW, h: H * 0.6 };
          if (!contain) { const sb = shapeBox(box, ratioOf(data.photo)); box.l = sb.l; box.t = sb.t; box.w = sb.w; box.h = sb.h; }
          const back = el('div', `position:absolute;left:${box.l + 26 * U}px;top:${box.t + 26 * U}px;width:${box.w}px;height:${box.h}px;background:${S.acc};border-radius:${L0.radius * U}px;`, Lr);
          tl.fromTo(back, { opacity: 0, x: -30 * U, y: -30 * U }, { opacity: 1, x: 0, y: 0, duration: 1, ease: EASE }, t + 0.3);
          const pb = photo(Lr, data.photo, data.fit, t - 0.3, d + 1, { css: `left:${box.l}px;top:${box.t}px;width:${box.w}px;height:${box.h}px`, radius: L0.radius * U, pos: data.pos, zoomFrom: 1.12 });
          tl.fromTo(pb, { clipPath: `inset(0 0 100% 0 round ${L0.radius * U}px)` }, { clipPath: `inset(0 0 0% 0 round ${L0.radius * U}px)`, duration: 1.1, ease: 'expo.inOut' }, t + 0.05);
          pb.style.boxShadow = `0 ${3 * U}px ${6 * U}px rgba(0,0,0,.12), 0 ${18 * U}px ${36 * U}px rgba(0,0,0,.18), 0 ${48 * U}px ${90 * U}px rgba(0,0,0,.18)`;
          tl.fromTo([pb, back], { rotateY: land ? -10 : 8, transformPerspective: 1600 * U }, { rotateY: 0, duration: 1.6, ease: 'expo.out' }, t + 0.05);
          if (data.caption) {
            const tx = port ? { l: M, tp: box.t + box.h + 80 * U, w: CW } : land ? { l: M, tp: H * 0.36, w: W * 0.42 - M * 1.6 } : { l: M, tp: box.t + box.h + 64 * U, w: CW };
            if (data.label) { const lb = label(Lr, data.label, `left:${tx.l}px;top:0`, S.acc).above(tx.tp); fadeUp(lb, t + 0.7); }
            const cb = textBlock(Lr, data.caption, { w: tx.w, size: (land ? 84 : 76) * TU, min: 34 * TU, maxLines: 3, color: S.ink, accent: L0.accentWord, accentCss: acc(S), upper: L0.upper, css: `left:${tx.l}px;top:${tx.tp}px` });
            reveal(cb, t + 0.8);
          }
          sound(t + 0.05, 'photo');
          return;
        }
        photo(Lr, data.photo, data.fit, t - 0.6, d + 1.4, { pos: data.pos, dir: data.dir, wiggle: ['noir', 'editorial', 'bold'].includes(L0.id), treat: data.treat });
        if (data.caption && ['clean', 'fresh', 'tech'].includes(L0.id)) {
          // glass lower third: a frosted panel that sizes itself to the words
          const pad = 40 * U, w = land ? W * 0.5 : CW - pad * 2;
          const cb = textBlock(Lr, data.caption, { w, size: (port ? 80 : 70) * TU, min: 34 * TU, maxLines: 3, color: '#FFFFFF', accent: L0.accentWord, accentCss: accOnPhoto, upper: L0.upper, css: `left:${M + pad}px;bottom:${M + pad}px` });
          const lb = data.label ? label(Lr, data.label, `left:${M + pad}px;bottom:${M + pad + cb.offsetHeight + 22 * U}px`, '#FFFFFF') : null;
          const ph = cb.offsetHeight + pad * 2 + (lb ? 60 * U : 0);
          let mw = 0; (cb._lines || []).forEach((l) => { mw = Math.max(mw, l.scrollWidth); });
          const panel = el('div', `position:absolute;left:${M}px;bottom:${M}px;width:${Math.min(w, mw + 8 * U) + pad * 2}px;height:${ph}px;border-radius:${Math.max(16, L0.radius) * U}px;background:${L0.id === 'tech' ? 'rgba(10,20,40,.35)' : 'rgba(255,255,255,.16)'};border:${Math.max(1, 1.5 * U)}px solid rgba(255,255,255,.35);-webkit-backdrop-filter:blur(${22 * U}px) saturate(1.4);backdrop-filter:blur(${22 * U}px) saturate(1.4);box-shadow:0 ${20 * U}px ${50 * U}px rgba(0,0,0,.25);`, Lr);
          Lr.insertBefore(panel, cb);
          tl.fromTo(panel, { clipPath: `inset(0 100% 0 0 round ${Math.max(16, L0.radius) * U}px)` }, { clipPath: `inset(0 0% 0 0 round ${Math.max(16, L0.radius) * U}px)`, duration: 0.8, ease: 'expo.inOut' }, t + 0.35);
          if (lb) fadeUp(lb, t + 0.7);
          reveal(cb, t + 0.75);
        } else if (data.caption) {
          scrim(Lr, 0.78);
          const cb = textBlock(Lr, data.caption, { w: land ? W * 0.55 : CW, size: (port ? 92 : 80) * TU, min: 36 * TU, maxLines: 3, color: '#FFFFFF', accent: L0.accentWord, accentCss: accOnPhoto, upper: L0.upper, css: `left:${M}px;bottom:${M + 20 * U}px` });
          if (data.label) { const lb = label(Lr, data.label, `left:${M}px;bottom:${M + 20 * U + cb.offsetHeight + 28 * U}px`, L0.photoLabel || A); fadeUp(lb, t + 0.5); }
          reveal(cb, t + 0.6);
        } else {
          scrim(Lr, 0.35);
          const lb = label(Lr, cfg.brand, `left:${M}px;bottom:${M}px`, '#FFFFFF'); fadeUp(lb, t + 0.6, { to: 0.85 });
        }
        sound(t, 'reveal');
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
            const b = textBlock(Lr, it, { w, size: (port ? 120 : 112) * TU, min: 44 * TU, maxLines: 3, maxH: H * 0.42, color: S.ink, upper: L0.upper, align: 'center', css: `left:${(W - w) / 2}px;top:50%` });
            centreY(b);
            reveal(b, ti);
            const c = el('span', 'position:absolute;left:0;right:0;opacity:0', count, `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`);
            tl.set(c, { opacity: 1 }, ti); if (i < n - 1) tl.set(c, { opacity: 0 }, ti + per);
            if (i < n - 1) tl.to(b._lines, { yPercent: -140, opacity: 0, duration: 0.5, ease: 'power3.in', stagger: 0.04 }, ti + per - 0.5);
            sound(ti, 'tick');
            count.style.top = `${Math.max(parseFloat(count.style.top), H / 2 + b.offsetHeight / 2 + 50 * U)}px`;
            { const lim = H / 2 - b.offsetHeight / 2 - 30 * U; if (parseFloat(head.style.top) + head.offsetHeight > lim) head.above(lim, 0); }
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
        const head = label(Lr, data.title || cfg.brand, `left:${left}px;top:0`, S.acc).above(y, 34 * U); fadeUp(head, t + 0.2);
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
          sound(ti, 'tick');
          y += rowH;
        });
      },
      // a deal, in the accent colour
      offer(Lr, t, d, data, v, S) {
        decor(Lr, t, d, S.kind);
        const w = land ? W * 0.7 : CW;
        const lab = label(Lr, data.label || 'Special offer', `left:0;right:0;text-align:center;top:0`, S.acc);
        const ob = textBlock(Lr, data.offer, { w, size: (port ? 130 : 118) * TU, min: 46 * TU, maxLines: port ? 4 : 3, maxH: H - 2 * M - 260 * U, color: S.ink, upper: L0.upper, align: 'center', css: `left:${(W - w) / 2}px;top:50%` });
        centreY(ob);
        lab.above(H / 2 - ob.offsetHeight / 2);
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
        sound(t + 0.9, 'pop'); if (['bold', 'fresh', 'clean'].includes(L0.id)) sound(t + 1.05, 'offer', 0.8);
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
          const ph = pr.offsetHeight, th = tb.offsetHeight, gap = 64 * U, top = (H - (th + gap + ph)) / 2;
          tb.style.top = top + 'px'; pr.style.top = top + th + gap + 'px';
          reveal(tb, t + 0.3, { soft: true });
          const m = String(it.price || '').match(/^(\D*?)([\d,]+(?:\.\d+)?)(\D*)$/);
          if (m && Number(m[2].replace(/,/g, '')) >= 10) {
            const target = Number(m[2].replace(/,/g, '')), dec = (m[2].split('.')[1] || '').length, comma = /,/.test(m[2]) || target >= 10000;
            const fmt = (v) => { const n = v.toFixed(dec); const [a0, b0] = n.split('.'); return (comma ? a0.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : a0) + (b0 ? '.' + b0 : ''); };
            pw.style.fontVariantNumeric = 'tabular-nums'; pw.style.minWidth = pw.offsetWidth + 'px';
            pw.innerHTML = `${esc(m[1])}<span class="num">${esc(fmt(0))}</span>${esc(m[3])}`;
            const num = pw.querySelector('.num'), st = { v: 0 };
            tl.fromTo(pr, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, t + 0.5);
            tl.fromTo(st, { v: 0 }, { v: target, duration: 1.2, ease: 'expo.out', onUpdate: () => { num.textContent = fmt(st.v >= target - 0.5 ? target : Math.floor(st.v)); } }, t + 0.55);
          } else tl.fromTo(pr.querySelectorAll('.c'), { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: EASE, stagger: 0.05 }, t + 0.6);
          drift(pr, t + 1.4, d - 1.2, { from: 1, to: 1.04, y: 0 });
          sound(t + 0.6, 'price');
          return;
        }
        const colW = land ? W * 0.62 : CW, left = (W - colW) / 2, rowH = (port ? 150 : 124) * TU;
        const top0 = (H - items.length * rowH) / 2 + 30 * U;
        const head = label(Lr, data.title || 'Prices', `left:${left}px;top:0`, S.acc).above(top0, 30 * U); fadeUp(head, t + 0.2);
        const rowsEls = [];
        items.forEach((it, i) => {
          const y = top0 + i * rowH, ti = t + 0.4 + i * 0.32;
          const row = el('div', `position:absolute;left:${left}px;width:${colW}px;top:${y}px;display:flex;align-items:baseline;gap:${20 * U}px;font-family:${disp};font-weight:${DW};font-size:${(port ? 70 : 60) * TU}px;line-height:1.1;color:${S.ink};${L0.upper ? 'text-transform:uppercase;' : ''}`, Lr);
          const tt = el('span', 'white-space:nowrap', row, esc(it.title));
          el('span', `flex:1;min-width:${30 * U}px;border-bottom:${Math.max(2, 3 * U)}px dotted ${rgba(S.ink, 0.35)};transform:translateY(-.2em)`, row);
          const pp = it.price ? el('span', `white-space:nowrap;color:${S.acc}`, row, esc(it.price)) : null;
          while (tt.offsetWidth + (pp ? pp.offsetWidth : 0) + 60 * U > colW && parseFloat(row.style.fontSize) > 26 * U) row.style.fontSize = parseFloat(row.style.fontSize) * 0.93 + 'px';
          rowsEls.push(row);
          tl.fromTo(row, { opacity: 0, y: 30 * U }, { opacity: 1, y: 0, duration: 0.7, ease: EASE }, ti);
          sound(ti, 'tick', 0.85);
        });
        const minFs = Math.min(...rowsEls.map((r) => parseFloat(r.style.fontSize))); rowsEls.forEach((r) => { r.style.fontSize = minFs + 'px'; });
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
            sound(ti + 1.15, 'pin');
          }
          const lb = label(Lr, lab, `left:0;right:0;text-align:center;top:${y + 120 * TU}px`, S.acc); fadeUp(lb, ti + 0.2);
          tb.style.top = `${y + 170 * TU}px`; reveal(tb, ti + 0.25);
          drift(tb, ti + 1.3, d - 1.3 - i * 0.45, { from: 1, to: 1.03, y: 0 });
          y += h + 90 * TU;
        });
        sound(t + 0.2, 'reveal', 0.8);
      },
      // a second line from the owner, set big
      statement(Lr, t, d, data, v, S) {
        decor(Lr, t, d, S.kind);
        const w = land ? W * 0.72 : CW;
        const b = textBlock(Lr, data.text, { w, size: (port ? 120 : 110) * TU, min: 44 * TU, maxLines: port ? 5 : 3, maxH: H - 2 * M - 200 * U, color: S.ink, accent: L0.accentWord, accentCss: acc(S), upper: L0.upper, align: L0.center || land ? 'center' : 'left', css: L0.center || land ? `left:${(W - w) / 2}px;top:50%` : `left:${M}px;top:50%` });
        centreY(b);
        if (data.label) { const lb = label(Lr, data.label, L0.center || land ? `left:0;right:0;text-align:center;top:0` : `left:${M}px;top:0`, S.acc).above(H / 2 - b.offsetHeight / 2); fadeUp(lb, t + 0.2); }
        reveal(b, t + 0.35, { stagger: 0.12, track: L0.id === 'noir' || L0.id === 'editorial' }); polish(b, t + 0.35, d, S); underline(b, t + 1.2, L0.id === 'bold' ? (S.kind === 'accent' ? onColor(A) : A2) : S.acc);
        drift(b, t + 1.3, d - 1.1, { from: 1, to: 1.03, y: 0 });
      },
      // headline stacking: each line lands as its own coloured block, one on top of the next
      stack(Lr, t, d, data, v, S) {
        decor(Lr, t, d, S.kind);
        const w = land ? W * 0.74 : CW;
        const hb = textBlock(Lr, data.headline, { w: w * 0.92, size: (port ? 150 : 128) * TU, min: 50 * TU, maxLines: port ? 5 : 3, maxH: H - 2 * M - 200 * U, color: S.ink, upper: true, lh: 1.08, align: 'left', css: `left:${(W - w) / 2}px;top:50%` });
        centreY(hb);
        const cols = [S.kind === 'accent' ? '#111111' : A, readable(A2, S.bg) === A2 ? A2 : (S.kind === 'accent' ? '#FFFFFF' : S.ink), S.kind === 'accent' ? '#FFFFFF' : S.ink];
        (hb._lines || []).forEach((ln, i) => {
          const bgc = cols[i % cols.length];
          ln.style.cssText += `;display:inline-block;white-space:nowrap;background:${bgc};color:${onColor(bgc)};padding:.02em .22em .06em;margin-bottom:${10 * U}px;`;
          ln.querySelectorAll('.acc').forEach((x) => { x.style.color = ''; });
          const fromX = i % 2 ? 1 : -1;
          tl.fromTo(ln, { xPercent: 0, x: fromX * W, rotate: fromX * 4 }, { x: 0, rotate: 0, duration: 0.7, ease: 'back.out(1.5)' }, t + 0.25 + i * 0.16);
          sound(t + 0.25 + i * 0.16, 'pop', 0.75);
        });
        if (hb._lines) hb._lines.forEach((ln) => { ln.parentElement.style.overflow = 'visible'; });
        hb.style.transform = ''; const top0 = (H - hb.offsetHeight) / 2; hb.style.top = top0 + 'px';
        const lab = label(Lr, data.label || cfg.brand, `left:${(W - w) / 2}px;top:0`, S.acc).above(top0); fadeUp(lab, t + 0.2);
        drift(hb, t + 1.2, d - 1, { from: 1, to: 1.03, y: 0 });
      },
      // photo inside the type: a giant word filled with the picture, then the camera flies through it into the full photo
      matte(Lr, t, d, data, v, S) {
        const word = String(data.word || cfg.brand).toUpperCase();
        const bg = photo(Lr, data.photo, data.fit, t + 1.5, d, { pos: data.pos, focus: false, wiggle: L0.id !== 'clean' });
        tl.fromTo(bg, { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 1, ease: 'expo.out' }, t + 1.55);
        const sc = scrim(Lr, 0.8); tl.fromTo(sc, { opacity: 0 }, { opacity: 1, duration: 0.8 }, t + 1.9);
        const wd = el('div', `position:absolute;left:0;right:0;top:0;text-align:center;font-family:${disp};font-weight:${Math.max(700, DW)};line-height:.92;letter-spacing:-.03em;background:url("${data.photo}") 50% 50%/cover;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;`, Lr);
        const parts = word.split(/\s+/).filter(Boolean); wd.innerHTML = parts.map((x) => `<span style="display:inline-block;white-space:nowrap">${esc(x)}</span>`).join('<br>');
        let fs = (port ? 420 : 340) * U; wd.style.fontSize = fs + 'px';
        const widest = () => Math.max(...[...wd.children].filter((c) => c.tagName === 'SPAN').map((c) => c.offsetWidth));
        for (let k = 0; k < 40 && (widest() > CW || wd.offsetHeight > H * (port ? 0.5 : 0.62)); k++) { fs *= 0.94; wd.style.fontSize = fs + 'px'; }
        wd.style.top = (H - wd.offsetHeight) / 2 + 'px';
        const lab = label(Lr, data.label || cfg.category || '', `left:0;right:0;text-align:center;top:0`, S.acc).above(H / 2 - wd.offsetHeight / 2, 16 * U); fadeUp(lab, t + 0.2);
        tl.fromTo(wd, { opacity: 0, scale: 0.85, backgroundPosition: '20% 50%' }, { opacity: 1, scale: 1, backgroundPosition: '60% 50%', duration: 1.3, ease: 'expo.out' }, t + 0.15);
        tl.to(wd, { scale: 9, opacity: 0, duration: 0.9, ease: 'power3.in', transformOrigin: '50% 50%' }, t + 1.45);
        tl.to(lab, { opacity: 0, duration: 0.3 }, t + 1.4);
        const hb = textBlock(Lr, data.headline, { w: land ? W * 0.6 : CW, size: (port ? 118 : 104) * TU, min: 44 * TU, maxLines: port ? 4 : 3, color: '#FFFFFF', accent: L0.accentWord, accentCss: accOnPhoto, upper: L0.upper, css: `left:${M}px;bottom:${M + 40 * U}px` });
        reveal(hb, t + 2.05); underline(hb, t + 2.8, L0.photoLabel || A);
        sound(t + 0.15, 'hook'); sound(t + 1.45, 'trans', 0.8);
      },
      // magazine cover: the business name as a masthead over the photo, the promise and the selling points as cover lines
      cover(Lr, t, d, data, v, S) {
        photo(Lr, data.photo, data.fit, t - 0.4, d + 1, { pos: data.pos, wiggle: true });
        el('div', `position:absolute;inset:0;background:linear-gradient(to bottom, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 50%, rgba(0,0,0,.75) 100%);`, Lr);
        const mast = el('div', `position:absolute;left:${M * 0.6}px;right:${M * 0.6}px;top:${M * 0.55}px;text-align:center;font-family:${disp};font-weight:${DW};line-height:.88;letter-spacing:-.035em;color:#FFFFFF;${L0.upper ? 'text-transform:uppercase;' : ''}`, Lr, `<span style="display:inline-block;white-space:nowrap">${esc(cfg.brand)}</span>`);
        let fs = (port ? 300 : 240) * U; mast.style.fontSize = fs + 'px';
        for (let k = 0; k < 40 && (mast.firstChild.offsetWidth > W - M * 1.2 || mast.offsetHeight > H * 0.2); k++) { fs *= 0.94; mast.style.fontSize = fs + 'px'; }
        tl.fromTo(mast, { yPercent: -40, opacity: 0, letterSpacing: '0.08em' }, { yPercent: 0, opacity: 1, letterSpacing: '-0.035em', duration: 1.3, ease: 'expo.out' }, t + 0.1);
        const rl = rule(Lr, `left:${M}px;right:${M}px;top:${M * 0.55 + mast.offsetHeight + 18 * U}px`, 'rgba(255,255,255,.8)');
        tl.fromTo(rl, { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power3.inOut' }, t + 0.5);
        if (cfg.category) { const cl = label(Lr, cfg.category, `left:${M}px;top:${M * 0.55 + mast.offsetHeight + 36 * U}px`, '#FFFFFF'); fadeUp(cl, t + 0.7); }
        const lines = (data.lines || []).slice(0, port ? 3 : 2);
        lines.forEach((tx, i) => {
          const y = H * (port ? 0.42 : 0.4) + i * 120 * TU;
          const ln = el('div', `position:absolute;left:${M}px;top:${y}px;max-width:${land ? W * 0.32 : CW * 0.5}px;font-family:${ui};font-weight:700;font-size:${34 * TU}px;line-height:1.15;color:#FFFFFF;text-shadow:0 ${2 * U}px ${12 * U}px rgba(0,0,0,.5);`, Lr);
          ln.innerHTML = `<span style="display:block;width:${46 * U}px;height:${Math.max(3, 5 * U)}px;background:${L0.photoLabel || A};margin-bottom:${12 * U}px"></span>${esc(tx)}`;
          fadeUp(ln, t + 0.9 + i * 0.2, { dy: 18 });
        });
        const hb = textBlock(Lr, data.headline, { w: land ? W * 0.6 : CW, size: (port ? 112 : 100) * TU, min: 44 * TU, maxLines: 3, color: '#FFFFFF', accent: L0.accentWord, accentCss: accOnPhoto, upper: L0.upper, css: `left:${M}px;bottom:${M + 10 * U}px` });
        reveal(hb, t + 1.1, { track: L0.id === 'noir' }); underline(hb, t + 2, L0.photoLabel || A);
        sound(t + 0.1, 'hook');
      },
      // picture in picture: one photo softly out of focus behind, the second floats in front as a card that turns towards us
      pip(Lr, t, d, data, v, S) {
        const back = photo(Lr, data.photo, data.fit, t - 0.6, d + 1.4, { pos: data.pos, focus: false, forceCover: true });
        tl.fromTo(back.firstChild, { filter: 'blur(0px) brightness(1)' }, { filter: `blur(${14 * U}px) brightness(.62)`, duration: 1, ease: 'power2.inOut' }, t + 0.1);
        const r2 = Math.max(0.72, Math.min(1.45, ratioOf(data.photo2) || (port ? 0.87 : 1.05)));
        let cw = port ? CW * 0.82 : land ? W * 0.36 : CW * 0.62, ch = cw / r2;
        if (ch > H * (port ? 0.56 : 0.72)) { ch = H * (port ? 0.56 : 0.72); cw = ch * r2; }
        const cx = land ? W - M - cw : (W - cw) / 2, cy = port ? H * 0.2 : (H - ch) / 2 - 20 * U;
        const card = photo(Lr, data.photo2, data.fit2, t, d, { css: `left:${cx}px;top:${cy}px;width:${cw}px;height:${ch}px`, radius: Math.max(12, L0.radius) * U, pos: '50% 50%', zoomFrom: 1.1, focusAt: 0.3 });
        card.style.boxShadow = `0 ${4 * U}px ${8 * U}px rgba(0,0,0,.2), 0 ${24 * U}px ${48 * U}px rgba(0,0,0,.35), 0 ${60 * U}px ${100 * U}px rgba(0,0,0,.3)`;
        card.style.border = `${Math.max(3, 6 * U)}px solid #FFFFFF`;
        tl.fromTo(card, { opacity: 0, y: 140 * U, rotateY: land ? -24 : 18, rotateX: 8, transformPerspective: 1500 * U }, { opacity: 1, y: 0, rotateY: land ? -6 : 4, rotateX: 2, duration: 1.2, ease: 'expo.out' }, t + 0.25);
        tl.to(card, { y: -16 * U, rotateY: land ? -2 : -2, duration: Math.max(1, d - 1.4), ease: 'sine.inOut' }, t + 1.45);
        if (data.caption) {
          scrim(Lr, 0.6);
          const cb = textBlock(Lr, data.caption, { w: land ? W * 0.5 : CW, size: (port ? 84 : 74) * TU, min: 34 * TU, maxLines: 2, color: '#FFFFFF', accent: L0.accentWord, accentCss: accOnPhoto, upper: L0.upper, css: land ? `left:${M}px;top:${H * 0.4}px` : `left:${M}px;bottom:${M + 10 * U}px` });
          reveal(cb, t + 0.9);
        }
        sound(t + 0.25, 'reveal');
      },
      // frame pop-out: a product picture with a see-through background steps out of its frame
      popout(Lr, t, d, data, v, S) {
        decor(Lr, t, d, S.kind);
        const fw = port ? CW * 0.84 : land ? W * 0.34 : CW * 0.64, fh = port ? H * 0.38 : H * 0.5;
        const fx0 = land ? W * 0.55 : (W - fw) / 2, fy = port ? H * 0.3 : H * 0.3;
        const frame = el('div', `position:absolute;left:${fx0}px;top:${fy}px;width:${fw}px;height:${fh}px;border-radius:${Math.max(18, L0.radius * 1.4) * U}px;background:${S.kind === 'accent' ? 'rgba(255,255,255,.18)' : rgba(S.acc, 0.16)};border:${Math.max(3, 6 * U)}px solid ${S.acc};`, Lr);
        const ph = fh * 1.45, pw = fw * 0.95;
        const img = el('img', `position:absolute;left:${fx0 + (fw - pw) / 2}px;top:${fy + fh - ph}px;width:${pw}px;height:${ph}px;object-fit:contain;object-position:50% 100%;filter:drop-shadow(0 ${28 * U}px ${36 * U}px rgba(0,0,0,.35));`, Lr);
        img.src = data.photo;
        tl.fromTo(frame, { scale: 0.6, opacity: 0, rotate: -6 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.8, ease: 'back.out(1.6)' }, t + 0.15);
        const inside = `inset(${((ph - fh) / ph) * 100}% 0 0 0)`;
        tl.fromTo(img, { clipPath: inside, y: fh * 0.5, opacity: 0 }, { y: fh * 0.15, opacity: 1, duration: 0.6, ease: 'power2.out' }, t + 0.45);
        tl.to(img, { clipPath: 'inset(0% 0 0 0)', y: 0, duration: 0.9, ease: 'back.out(1.4)' }, t + 1.0);
        tl.to(img, { y: -14 * U, duration: Math.max(1, d - 2), ease: 'sine.inOut' }, t + 1.9);
        if (data.caption) {
          const tx = land ? { l: M, tp: H * 0.38, w: W * 0.45 } : { l: M, tp: fy + fh + 70 * U, w: CW };
          if (data.label) { const lb = label(Lr, data.label, `left:${tx.l}px;top:0`, S.acc).above(tx.tp); fadeUp(lb, t + 1); }
          const cb = textBlock(Lr, data.caption, { w: tx.w, size: (land ? 84 : 80) * TU, min: 34 * TU, maxLines: 3, color: S.ink, accent: L0.accentWord, accentCss: acc(S), upper: L0.upper, css: `left:${tx.l}px;top:${tx.tp}px` });
          reveal(cb, t + 1.15);
        }
        sound(t + 0.15, 'pop'); sound(t + 1.0, 'reveal', 0.8);
      },
      // phone mock-up: the picture on a phone screen with the brand's own bar and button, turning in 3D
      phone(Lr, t, d, data, v, S) {
        decor(Lr, t, d, S.kind);
        const ph = port ? H * 0.62 : land ? H * 0.8 : H * 0.66, pw = ph * 0.49, px = land ? W * 0.6 - pw / 2 : port ? (W - pw) / 2 : W * 0.72 - pw / 2, py = port ? H * 0.1 : (H - ph) / 2;
        const body = el('div', `position:absolute;left:${px}px;top:${py}px;width:${pw}px;height:${ph}px;border-radius:${pw * 0.14}px;background:#0E0E10;padding:${pw * 0.035}px;box-shadow:0 ${30 * U}px ${80 * U}px rgba(0,0,0,.45), inset 0 0 0 ${2 * U}px #3A3A40;`, Lr);
        const scr = el('div', `position:relative;width:100%;height:100%;border-radius:${pw * 0.11}px;overflow:hidden;background:#000;`, body);
        const ri = ratioOf(data.photo), sw = pw * 0.93;
        if (ri > 0.75) {
          // a wide picture shows as a post in the app's feed, whole, with the brand above it and the post text below
          scr.style.background = '#FFFFFF';
          const top = pw * 0.2, av = pw * 0.1;
          const who = el('div', `position:absolute;left:${pw * 0.05}px;top:${top + pw * 0.03}px;display:flex;align-items:center;gap:${pw * 0.03}px;font-family:${ui};font-weight:700;font-size:${pw * 0.045}px;color:#111;white-space:nowrap;`, scr, `<span style="width:${av}px;height:${av}px;border-radius:50%;background:${A};display:inline-block"></span>${esc(cfg.brand)}`);
          const ih = sw / ri, it = top + av + pw * 0.06;
          const shot = photo(scr, data.photo, data.fit, t, d + 0.5, { css: `left:0;top:${it}px;width:100%;height:${ih}px`, zoomFrom: 1.08, zoomTo: 1, focusAt: 0.6, forceCover: true });
          [0.8, 0.62, 0.7].forEach((k, i) => el('div', `position:absolute;left:${pw * 0.05}px;top:${it + ih + pw * (0.06 + i * 0.07)}px;width:${sw * k - pw * 0.1}px;height:${pw * 0.032}px;border-radius:${pw * 0.016}px;background:${i ? '#E6E6EA' : rgba(A, 0.35)};`, scr));
          tl.fromTo([who, shot], { opacity: 0, y: 30 * U }, { opacity: 1, y: 0, duration: 0.7, ease: EASE, stagger: 0.1 }, t + 0.6);
        } else if (data.real) {
          // a real app screenshot: the whole screen, nothing drawn over it; a soft tap shows where the step happens
          const shot = photo(scr, data.photo, 'cover', t, d + 0.5, { css: 'left:0;top:0;width:100%;height:100%', zoomFrom: 1.04, zoomTo: 1, focusAt: 0.6, forceCover: true });
          void shot;
          const tap = el('div', `position:absolute;left:50%;top:58%;width:${pw * 0.16}px;height:${pw * 0.16}px;margin:-${pw * 0.08}px 0 0 -${pw * 0.08}px;border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 0 0 ${3 * U}px rgba(0,0,0,.18);opacity:0;`, scr);
          tl.fromTo(tap, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'power2.out' }, t + 1.6);
          tl.to(tap, { scale: 1.8, opacity: 0, duration: 0.5, ease: 'power2.out' }, t + 1.85);
        } else {
          const shot = photo(scr, data.photo, data.fit, t, d + 0.5, { css: `left:0;top:${pw * 0.2}px;width:100%;height:${ph * 1.05}px`, zoomFrom: 1, zoomTo: 1, focusAt: 0.6 });
          tl.fromTo(shot, { y: 0 }, { y: -ph * 0.18, duration: Math.max(1, d - 1), ease: 'power1.inOut' }, t + 1);
        }
        if (data.real) {
          el('div', `position:absolute;left:50%;top:${pw * 0.025}px;width:${pw * 0.28}px;height:${pw * 0.065}px;margin-left:-${pw * 0.14}px;border-radius:${pw * 0.04}px;background:#0E0E10;`, scr);
          tl.fromTo(body, { y: H * 0.4, rotateY: -32, rotateX: 12, transformPerspective: 1800 * U, opacity: 0 }, { y: 0, rotateY: land ? -14 : -8, rotateX: 4, opacity: 1, duration: 1.3, ease: 'expo.out' }, t + 0.1);
          tl.to(body, { rotateY: land ? -4 : 6, y: -18 * U, duration: Math.max(1, d - 1.4), ease: 'sine.inOut' }, t + 1.4);
        } else {
        const bar = el('div', `position:absolute;left:0;right:0;top:0;height:${pw * 0.2}px;background:${S.kind === 'accent' ? '#111' : A};display:flex;align-items:flex-end;padding:0 ${pw * 0.07}px ${pw * 0.04}px;font-family:${ui};font-weight:700;font-size:${pw * 0.055}px;color:${onColor(S.kind === 'accent' ? '#111' : A)};white-space:nowrap;overflow:hidden;`, scr, esc(cfg.brand));
        el('div', `position:absolute;left:50%;top:${pw * 0.025}px;width:${pw * 0.28}px;height:${pw * 0.065}px;margin-left:-${pw * 0.14}px;border-radius:${pw * 0.04}px;background:#0E0E10;`, scr);
        const btn = el('div', `position:absolute;left:${pw * 0.08}px;right:${pw * 0.08}px;bottom:${pw * 0.08}px;height:${pw * 0.15}px;border-radius:${pw * 0.075}px;background:${A2};color:${onColor(A2)};display:grid;place-items:center;font-family:${ui};font-weight:700;font-size:${pw * 0.05}px;white-space:nowrap;`, scr, esc(data.cta || cfg.brand));
        void bar;
        tl.fromTo(body, { y: H * 0.4, rotateY: -32, rotateX: 12, transformPerspective: 1800 * U, opacity: 0 }, { y: 0, rotateY: land ? -14 : -8, rotateX: 4, opacity: 1, duration: 1.3, ease: 'expo.out' }, t + 0.1);
        tl.to(body, { rotateY: land ? -4 : 6, y: -18 * U, duration: Math.max(1, d - 1.4), ease: 'sine.inOut' }, t + 1.4);
        tl.fromTo(btn, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)' }, t + 1.2);
        }
        if (data.caption) {
          const tx = land ? { l: M, tp: H * 0.36, w: W * 0.4 } : !port ? { l: M, tp: H * 0.34, w: px - M - 50 * U } : { l: M, tp: py + ph + 60 * U, w: CW };
          const cb = textBlock(Lr, data.caption, { w: tx.w, size: (land ? 80 : 68) * TU, min: 32 * TU, maxLines: !port ? 4 : 2, maxH: !port ? H * 0.5 : H - tx.tp - M, color: S.ink, accent: L0.accentWord, accentCss: acc(S), upper: L0.upper, align: !port ? 'left' : 'center', css: `left:${tx.l}px;top:${tx.tp}px` });
          reveal(cb, t + 0.9);
        }
        sound(t + 0.1, 'reveal'); sound(t + 1.2, 'click', 0.8);
      },
      // chat takeover: the business answering in a chat, one message at a time with a typing indicator
      // App walkthrough: ONE phone stays on screen while a finger taps through the real screenshots, A to Z.
      // Each step: the finger glides and taps (ripple), the camera leans in on the tap, a part of the screen lifts out
      // in 3D (every other step), tall screens scroll, then the next screen pushes in like iOS. Caption + step dots change per step.
      walk(Lr, t, d, data, v, S) {
        decor(Lr, t, d, S.kind);
        const all = (data.shots || []).filter((x) => x && x.photo).slice(0, 6);
        if (!all.length) return;
        const rOf = (x) => Number(x.ratio) || ratioOf(x.photo) || 0.46;
        const deskFirst = rOf(all[0]) > 1.15;
        const shots = all.filter((x) => (rOf(x) > 1.15) === deskFirst), others = all.filter((x) => (rOf(x) > 1.15) !== deskFirst), n = shots.length;
        const together = others.length ? 2.4 : 0;   // desktop + phone side by side before the end
        // wide screenshots = a desktop app / website: a browser window on a laptop and a mouse pointer; tall ones = a phone and a finger
        const r0 = rOf(shots[0]), desk = r0 > 1.15;
        let pw, ph, px, py, pad, sw, sh, barH = 0;
        if (desk) {
          pw = port ? W * 0.9 : land ? W * 0.6 : W * 0.84; barH = pw * 0.045;
          sw = pw - 2 * pw * 0.012; sh = Math.min(sw / r0, (port ? H * 0.38 : H * 0.62)); pad = pw * 0.012;
          ph = sh + barH + 2 * pad; px = port ? (W - pw) / 2 : land ? W * 0.685 - pw / 2 : (W - pw) / 2; py = port ? H * 0.16 : (H - ph) / 2 - H * 0.03;
        } else {
          ph = port ? H * 0.6 : land ? H * 0.82 : H * 0.68; pw = ph * 0.49;
          px = port ? (W - pw) / 2 : land ? W * 0.68 - pw / 2 : W * 0.7 - pw / 2; py = port ? H * 0.08 : (H - ph) / 2;
          pad = pw * 0.035; sw = pw - 2 * pad; sh = ph - 2 * pad;
        }
        // camera rig: everything that zooms (phone + finger) lives in here; captions stay still outside it
        const cam = el('div', `position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:50% 50%;`, Lr);
        const body = el('div', desk
          ? `position:absolute;left:${px}px;top:${py}px;width:${pw}px;height:${ph}px;border-radius:${pw * 0.018}px;background:#1C1C20;padding:${pad}px;padding-top:${pad + barH}px;box-shadow:0 ${40 * U}px ${100 * U}px rgba(0,0,0,.4), inset 0 0 0 ${2 * U}px #34343A;`
          : `position:absolute;left:${px}px;top:${py}px;width:${pw}px;height:${ph}px;border-radius:${pw * 0.14}px;background:#0E0E10;padding:${pad}px;box-shadow:0 ${36 * U}px ${90 * U}px rgba(0,0,0,.42), inset 0 0 0 ${2 * U}px #3A3A40;`, cam);
        if (desk) {
          // window bar: three dots + an address pill with the brand
          const bar = el('div', `position:absolute;left:0;right:0;top:0;height:${barH + pad}px;display:flex;align-items:center;gap:${pw * 0.008}px;padding:0 ${pw * 0.015}px;`, body);
          ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c) => el('i', `display:block;width:${barH * 0.32}px;height:${barH * 0.32}px;border-radius:50%;background:${c};`, bar));
          el('div', `margin-left:auto;margin-right:auto;width:${pw * 0.34}px;height:${barH * 0.56}px;border-radius:${barH * 0.28}px;background:#2C2C32;display:grid;place-items:center;font-family:${ui};font-size:${barH * 0.3}px;color:#9A9AA6;white-space:nowrap;overflow:hidden;`, bar, esc(String(cfg.brand || '').toLowerCase().replace(/[^a-z0-9]+/g, '') + '.app'));
          // laptop base under the window
          const base = el('div', `position:absolute;left:${px - pw * 0.06}px;top:${py + ph}px;width:${pw * 1.12}px;height:${pw * 0.022}px;border-radius:0 0 ${pw * 0.03}px ${pw * 0.03}px;background:linear-gradient(#C9CAD0,#8E9097);box-shadow:0 ${20 * U}px ${40 * U}px rgba(0,0,0,.3);`, cam);
          tl.fromTo(base, { opacity: 0, y: 40 * U }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out' }, t + 0.9);
        }
        const scr = el('div', `position:relative;width:100%;height:100%;border-radius:${desk ? pw * 0.006 : pw * 0.11}px;overflow:hidden;background:#000;`, body);
        const glare = el('div', `position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,0) 35%,rgba(255,255,255,.16) 48%,rgba(255,255,255,0) 60%);z-index:5;`, scr);
        if (!desk) el('div', `position:absolute;left:50%;top:${pw * 0.025}px;width:${pw * 0.28}px;height:${pw * 0.065}px;margin-left:-${pw * 0.14}px;border-radius:${pw * 0.04}px;background:#0E0E10;z-index:6;`, scr);
        // where to tap / what to lift on each screen (% of the screen): given by the director, or common app spots
        const TAPS = [{ x: 0.5, y: 0.86 }, { x: 0.5, y: 0.52 }, { x: 0.8, y: 0.2 }, { x: 0.3, y: 0.66 }, { x: 0.5, y: 0.36 }, { x: 0.72, y: 0.8 }];
        const HOTS = [{ x: 0.06, y: 0.2, w: 0.88, h: 0.2 }, { x: 0.06, y: 0.44, w: 0.88, h: 0.18 }, { x: 0.06, y: 0.3, w: 0.88, h: 0.22 }];
        const intro = data.intro !== false && d > n * 2.4 + 2.6 + together ? (cfg.logo ? 2.2 : 1.5) : 0;
        const seg = Math.max(2.2, (d - 1.5 - intro - together) / n), t0 = t + 1.1 + intro;
        if (intro && cfg.logo) {
          // restrained particles drift; the real logo turns in, a light sweep crosses it, a soft glow; then it rises away
          const dark = !!L0.dark;
          for (let k = 0; k < 14; k++) {
            const pz = 3 + ((k * 37) % 5) * 1.6, p = el('i', `position:absolute;left:${((k * 61) % 100)}%;top:${((k * 43) % 100)}%;width:${pz * U}px;height:${pz * U}px;border-radius:50%;background:${dark ? 'rgba(255,255,255,.7)' : rgba(A, 0.5)};filter:blur(${0.6 * U}px);`, Lr);
            tl.fromTo(p, { opacity: 0, y: 30 * U }, { opacity: 0.25 + (k % 4) * 0.12, y: -60 * U - k * 4 * U, duration: intro + 1.2, ease: 'none' }, t);
            tl.to(p, { opacity: 0, duration: 0.6 }, t + intro + 0.6);
          }
          const ls = Math.min(W, H) * 0.24;
          const lg = el('div', `position:absolute;left:${W / 2 - ls / 2}px;top:${H * 0.42 - ls / 2}px;width:${ls}px;height:${ls}px;`, Lr);
          const glow = el('div', `position:absolute;inset:-35%;border-radius:50%;background:radial-gradient(circle, ${rgba(A, dark ? 0.55 : 0.3)} 0%, transparent 65%);opacity:0;`, lg);
          const img = el('img', 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;', lg); img.src = cfg.logo;
          const sweep = el('div', `position:absolute;inset:0;overflow:hidden;-webkit-mask:url("${String(cfg.logo).replace(/"/g, '%22')}") center/contain no-repeat;mask:url("${String(cfg.logo).replace(/"/g, '%22')}") center/contain no-repeat;`, lg);
          const band = el('div', 'position:absolute;top:-20%;bottom:-20%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.85),transparent);', sweep);
          tl.fromTo(lg, { opacity: 0, rotateY: -55, scale: 0.82, transformPerspective: 1200 * U }, { opacity: 1, rotateY: 0, scale: 1, duration: 1.1, ease: 'expo.out' }, t + 0.1);
          tl.fromTo(band, { left: '-50%' }, { left: '120%', duration: 0.9, ease: 'power2.inOut' }, t + 0.55);
          tl.fromTo(glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, t + 0.7);
          const nm = textBlock(Lr, data.title || cfg.brand || '', { w: CW, size: 96 * TU, min: 48 * TU, maxLines: 2, color: S.ink, accent: false, upper: L0.upper, align: 'center', css: `left:${M}px;top:${H * 0.42 + ls / 2 + 40 * U}px` });
          reveal(nm, t + 0.9, { track: true });
          tl.to([lg, nm], { opacity: 0, y: -70 * U, filter: `blur(${12 * U}px)`, duration: 0.45, ease: 'power2.in' }, t + intro - 0.5);
          sound(t + 0.1, 'reveal'); sound(t + 0.55, 'swell', 0.6);
        } else if (intro) {
          // "Introducing" + the name, big in the middle; it rises away as the device turns around to face us
          const lab = el('div', `position:absolute;left:${M}px;width:${CW}px;top:${H * 0.4}px;text-align:center;font-family:${ui};font-weight:600;font-size:${30 * TU}px;letter-spacing:.24em;text-transform:uppercase;color:${rgba(S.ink, 0.6)};`, Lr, 'Introducing');
          const nm = textBlock(Lr, data.title || cfg.brand || '', { w: CW, size: 130 * TU, min: 60 * TU, maxLines: 2, color: S.ink, accent: false, upper: L0.upper, align: 'center', css: `left:${M}px;top:${H * 0.4 + 54 * TU}px` });
          tl.fromTo(lab, { opacity: 0, letterSpacing: '0.5em' }, { opacity: 1, letterSpacing: '0.24em', duration: 0.8, ease: 'expo.out' }, t + 0.05);
          reveal(nm, t + 0.25, { track: true });
          tl.to([lab, nm], { opacity: 0, y: -60 * U, filter: `blur(${12 * U}px)`, duration: 0.5, ease: 'power2.in' }, t + intro - 0.1);
          sound(t + 0.1, 'reveal');
        }
        // the device arrives once, turning around in 3D to face us
        tl.fromTo(body, { y: H * 0.35, rotateY: desk ? -70 : -150, rotateX: 16, transformPerspective: 2000 * U, opacity: 0 }, { y: 0, rotateY: desk ? (land ? -8 : -4) : (land ? -10 : -6), rotateX: desk ? 6 : 3, opacity: 1, duration: 1.5, ease: 'expo.out' }, t + Math.max(0, intro - 0.1) + 0.05);
        tl.to(body, { rotateY: desk ? (land ? -2 : 2) : (land ? -3 : 4), y: -14 * U, duration: Math.max(1, d - 1.6 - intro), ease: 'sine.inOut' }, t + intro + 1.5);
        tl.fromTo(glare, { xPercent: -60 }, { xPercent: 60, duration: d, ease: 'none' }, t);
        sound(t + Math.max(0, intro - 0.1) + 0.1, 'trans');
        // the finger: a soft white touch dot with a shadow, like a screen recording with touches shown
        const fs = pw * 0.15;
        const cs = 46 * U;   // mouse pointer size (desktop)
        const finger = desk
          ? el('div', `position:absolute;left:0;top:0;width:${cs}px;height:${cs * 1.4}px;z-index:20;opacity:0;transform-origin:0 0;filter:drop-shadow(0 ${6 * U}px ${10 * U}px rgba(0,0,0,.35));`, cam, '<svg viewBox="0 0 20 28" width="100%" height="100%"><path d="M1 1 L1 22 L6.5 16.8 L10.2 25.6 L14 24 L10.4 15.4 L18 15.4 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>')
          : el('div', `position:absolute;left:0;top:0;width:${fs}px;height:${fs}px;margin:-${fs / 2}px 0 0 -${fs / 2}px;border-radius:50%;background:rgba(255,255,255,.82);box-shadow:0 ${10 * U}px ${26 * U}px rgba(0,0,0,.35), inset 0 0 0 ${3 * U}px rgba(0,0,0,.08);z-index:20;opacity:0;`, cam);
        const at = (pt) => ({ x: px + pad + pt.x * sw, y: py + pad + barH + pt.y * sh });
        tl.set(finger, { x: px + pw * 1.3, y: py + ph * 1.05 }, t);
        // steps: dots + "Step 1 of 4" + the caption, beside (wide) or under (tall) the phone
        const capBox = port ? { l: M, tp: py + ph + (desk ? 110 : 46) * U, w: CW } : land ? { l: M, tp: H * 0.3, w: px - M - (desk ? 200 : 80) * U } : { l: M, tp: H * 0.3, w: px - M - 60 * U };
        const dots = el('div', `position:absolute;z-index:30;left:${capBox.l}px;top:${capBox.tp - 40 * U}px;width:${capBox.w}px;display:flex;gap:${10 * U}px;justify-content:${port ? 'center' : 'flex-start'};align-items:center;font-family:${ui};font-weight:700;font-size:${22 * TU}px;letter-spacing:.06em;color:${rgba(S.ink, 0.55)};`, Lr);
        const dotEls = shots.map(() => el('i', `display:block;width:${12 * U}px;height:${12 * U}px;border-radius:${6 * U}px;background:${rgba(S.ink, 0.22)};`, dots));
        const stepTxt = el('span', `margin-${port ? 'left' : 'left'}:${12 * U}px;`, dots, '');
        tl.fromTo(dots, { opacity: 0, y: 20 * U }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, t + 0.8);
        let prevLayer = null, prevPt = null, lastCap = null;
        shots.forEach((shot, i) => {
          const s0 = t0 + i * seg, ri = Number(shot.ratio) || ratioOf(shot.photo) || 0.46;
          const bgH = sw / ri, extra = Math.max(0, bgH - sh);   // how much a tall screenshot can scroll
          const layer = el('div', `position:absolute;inset:0;background:#fff url("${String(shot.photo).replace(/"/g, '%22')}") no-repeat 0 0 / ${sw}px ${bgH}px;`, scr);
          if (i === 0) tl.fromTo(layer, { opacity: 0 }, { opacity: 1, duration: 0.5 }, t + 0.3);
          else {
            // iOS push: the new screen slides in, the old one slides a little and dims
            tl.fromTo(layer, { xPercent: 100 }, { xPercent: 0, duration: 0.6, ease: 'power3.inOut' }, s0 - 0.35);
            if (prevLayer) tl.to(prevLayer, { xPercent: -30, filter: 'brightness(0.6)', duration: 0.6, ease: 'power3.inOut' }, s0 - 0.35);
            sound(s0 - 0.35, 'trans', 0.6);
          }
          // step dots + label
          tl.to(dotEls[i], { width: 34 * U, background: A, duration: 0.4, ease: 'power2.out' }, s0 - 0.2);
          if (i > 0) tl.to(dotEls[i - 1], { width: 12 * U, background: rgba(S.ink, 0.35), duration: 0.4 }, s0 - 0.2);
          tl.call(() => { stepTxt.textContent = `STEP ${i + 1} OF ${n}`; }, null, s0 - 0.2);
          // caption for this step
          if (shot.caption) {
            const cb = textBlock(Lr, shot.caption, { w: capBox.w, size: (land ? 74 : 64) * TU, min: 30 * TU, maxLines: port ? 2 : 3, maxH: port ? H - capBox.tp - M : H * 0.4, color: S.ink, accent: L0.accentWord, accentCss: acc(S), upper: L0.upper, align: port ? 'center' : 'left', css: `left:${capBox.l}px;top:${capBox.tp}px` });
            cb.style.zIndex = '30';
            reveal(cb, s0 + 0.05, { soft: true, dy: 26 }); lastCap = cb;
            if (i < n - 1) tl.to(cb, { opacity: 0, y: -18 * U, duration: 0.3, ease: 'power2.in' }, s0 + seg - 0.45);
          }
          // the finger glides to the tap point and presses
          const DESK_TAPS = [{ x: 0.12, y: 0.1 }, { x: 0.5, y: 0.45 }, { x: 0.86, y: 0.08 }, { x: 0.3, y: 0.62 }, { x: 0.7, y: 0.75 }];
          const tp = shot.tap && shot.tap.x != null ? shot.tap : (desk ? DESK_TAPS : TAPS)[i % (desk ? DESK_TAPS : TAPS).length], P = at(tp);
          const glideAt = s0 + 0.35, tapAt = glideAt + 0.65;
          tl.to(finger, { opacity: 1, duration: 0.25 }, glideAt - 0.1);
          tl.to(finger, { x: P.x, y: P.y, duration: 0.65, ease: prevPt ? 'power2.inOut' : 'power3.out' }, glideAt);
          tl.to(finger, { scale: desk ? 0.86 : 0.78, duration: 0.09, yoyo: true, repeat: 1, ease: 'power2.inOut' }, tapAt);
          const ring = el('div', `position:absolute;left:${P.x}px;top:${P.y}px;width:${fs}px;height:${fs}px;margin:-${fs / 2}px 0 0 -${fs / 2}px;border-radius:50%;border:${3 * U}px solid ${A};z-index:19;opacity:0;`, cam);
          tl.fromTo(ring, { scale: 0.6, opacity: 0.9 }, { scale: 2.4, opacity: 0, duration: 0.6, ease: 'power2.out' }, tapAt);
          sound(tapAt, 'click');
          // camera leans in on the tap, then settles back before the next screen
          const zoom = desk ? (port ? 1.4 : land ? 1.25 : 1.35) : port ? 1.18 : 1.2;
          const oy = port ? Math.max(P.y, py + ph * 0.8) : P.y;   // tall videos: the phone grows upwards, the caption below stays clear
          const ox = port ? P.x : Math.max(P.x, px + pw * (desk ? 0.5 : 0.3));   // wide videos: it grows to the right, the captions on the left stay clear
          tl.to(cam, { scale: zoom, transformOrigin: `${(ox / W) * 100}% ${(oy / H) * 100}%`, duration: 0.7, ease: 'power3.inOut' }, tapAt + 0.12);
          tl.to(cam, { scale: 1, duration: 0.6, ease: 'power3.inOut' }, s0 + seg - 0.75);
          // every other step: a part of the screen lifts out in 3D (same picture, cropped), then settles back
          if (i % 2 === 0) {
            const hot = shot.hot && shot.hot.w ? shot.hot : HOTS[(i / 2) % HOTS.length];
            const card = el('div', `position:absolute;left:${px + pad + hot.x * sw}px;top:${py + pad + barH + hot.y * sh}px;width:${hot.w * sw}px;height:${hot.h * sh}px;border-radius:${14 * U}px;background:#fff url("${String(shot.photo).replace(/"/g, '%22')}") no-repeat ${-hot.x * sw}px ${-hot.y * sh}px / ${sw}px ${bgH}px;box-shadow:0 ${30 * U}px ${70 * U}px rgba(0,0,0,.38);z-index:15;opacity:0;`, cam);
            const liftAt = tapAt + 0.75;
            tl.fromTo(card, { opacity: 0, scale: 1, x: 0 }, { opacity: 1, scale: 1.16, x: port || desk ? 0 : -pw * 0.12, duration: 0.55, ease: 'back.out(1.6)' }, liftAt);
            tl.to(card, { opacity: 0, scale: 1, x: 0, duration: 0.4, ease: 'power2.in' }, s0 + seg - 0.85);
            sound(liftAt, 'pop', 0.7);
          } else if (extra > 8 * U) {
            // a tall screen scrolls, like a thumb flicking down the page
            tl.to(finger, { y: P.y - sh * 0.22, duration: 0.6, ease: 'power2.inOut' }, tapAt + 0.4);
            tl.to(layer, { backgroundPositionY: -Math.min(extra, sh * 0.45), duration: 1.0, ease: 'power3.out' }, tapAt + 0.45);
          }
          prevLayer = layer; prevPt = P;
        });
        tl.to(finger, { opacity: 0, duration: 0.3 }, t0 + n * seg - 0.5);
        if (together) {
          const T = t0 + n * seg - 0.3, o = others[0], ro = rOf(o);
          // second device: a phone beside a laptop, or a laptop behind a phone
          const oph = desk ? (port ? H * 0.34 : H * 0.62) : 0, opw = desk ? oph * 0.49 : (port ? W * 0.86 : W * 0.5);
          const oh = desk ? oph : opw / ro + opw * 0.045;
          const ox = desk ? (port ? W * 0.52 : W * 0.6) : (port ? (W - opw) / 2 : W * 0.3 - opw / 2), oy2 = desk ? (port ? H * 0.3 : H * 0.2) : (port ? H * 0.12 : H * 0.18);
          const dev = el('div', `position:absolute;left:${ox}px;top:${oy2}px;width:${opw}px;height:${oh}px;border-radius:${desk ? opw * 0.14 : opw * 0.018}px;background:${desk ? '#0E0E10' : '#1C1C20'};padding:${desk ? opw * 0.035 : opw * 0.012}px;${desk ? '' : `padding-top:${opw * 0.057}px;`}box-shadow:0 ${36 * U}px ${90 * U}px rgba(0,0,0,.42), inset 0 0 0 ${2 * U}px #3A3A40;z-index:${desk ? 12 : 0};`, Lr);
          const oscr = el('div', `position:relative;width:100%;height:100%;border-radius:${desk ? opw * 0.11 : opw * 0.006}px;overflow:hidden;background:#fff url("${String(o.photo).replace(/"/g, '%22')}") no-repeat 0 0 / 100% auto;`, dev);
          void oscr;
          if (lastCap) tl.to(lastCap, { opacity: 0, y: -18 * U, duration: 0.35, ease: 'power2.in' }, T);
          tl.to(dots, { opacity: 0, duration: 0.35 }, T);
          tl.to(cam, { scale: desk ? 0.78 : 0.72, x: desk ? -W * (port ? 0.12 : 0.12) : W * (port ? 0 : 0.14), y: port ? (desk ? H * 0.02 : H * 0.16) : 0, transformOrigin: '50% 50%', duration: 1.1, ease: 'power3.inOut' }, T);
          tl.fromTo(dev, { opacity: 0, x: desk ? W * 0.3 : -W * 0.3, rotateY: desk ? -40 : 30, transformPerspective: 1800 * U }, { opacity: 1, x: 0, rotateY: desk ? -10 : 8, duration: 1.2, ease: 'expo.out' }, T + 0.25);
          tl.to(dev, { y: -12 * U, duration: 1.4, ease: 'sine.inOut' }, T + 1.4);
          sound(T + 0.25, 'trans', 0.7);
        }
      },
      chat(Lr, t, d, data, v, S) {
        decor(Lr, t, d, S.kind);
        const cw = land ? W * 0.46 : CW, cx = land ? W * 0.5 - cw / 2 + W * 0.12 : M;
        const dark = lum(S.bg) < 0.35, bubBg = dark ? '#1F2C34' : '#FFFFFF', bubInk = dark ? '#E9EDEF' : '#111B21', fsz = (port ? 58 : land ? 44 : 50) * TU;
        const head = el('div', `position:absolute;left:${cx}px;width:${cw}px;top:${port ? H * 0.12 : M}px;display:flex;align-items:center;gap:${18 * U}px;font-family:${ui};font-weight:700;font-size:${fsz}px;color:${S.ink};`, Lr);
        head.innerHTML = cfg.logo ? `<img src="${cfg.logo}" style="width:${fsz * 1.8}px;height:${fsz * 1.8}px;border-radius:50%;object-fit:contain;background:#fff">` : `<span style="width:${fsz * 1.8}px;height:${fsz * 1.8}px;border-radius:50%;background:${A};color:${onColor(A)};display:grid;place-items:center;font-size:${fsz * 0.75}px">${esc(cfg.mono || 'A')}</span>`;
        el('span', 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0', head, esc(cfg.brand));
        fadeUp(head, t + 0.1);
        const msgs = [...(data.items || []).map((x) => ({ text: x })), ...(data.cta ? [{ text: data.cta, cta: true }] : [])];
        const top0 = (port ? H * 0.12 : M) + fsz * 2.6;
        const gap = 26 * U, per = Math.max(0.75, (d - 1.2) / Math.max(1, msgs.length));
        let y = top0;
        const clip = el('div', 'position:absolute;inset:0;', Lr), list = el('div', `position:absolute;left:0;top:0;width:${W}px;height:${H}px;`, clip);
        msgs.forEach((m, i) => {
          const ti = t + 0.5 + i * per;
          const b = el('div', `position:absolute;left:${cx}px;top:${y}px;max-width:${cw * 0.86}px;padding:${0.55 * fsz}px ${0.75 * fsz}px;border-radius:${0.5 * fsz}px ${0.5 * fsz}px ${0.5 * fsz}px ${0.12 * fsz}px;background:${m.cta ? A : bubBg};color:${m.cta ? onColor(A) : bubInk};font-family:${ui};font-weight:${m.cta ? 700 : 500};font-size:${fsz}px;line-height:1.25;box-shadow:0 ${4 * U}px ${14 * U}px rgba(0,0,0,.12);transform-origin:0% 100%;`, list, esc(m.text));
          const dots = el('div', `position:absolute;left:${cx}px;top:${y}px;padding:${0.5 * fsz}px ${0.7 * fsz}px;border-radius:${0.5 * fsz}px;background:${bubBg};display:flex;gap:${0.22 * fsz}px;`, list, '<i></i><i></i><i></i>');
          dots.querySelectorAll('i').forEach((dt, k) => { dt.style.cssText = `display:block;width:${0.28 * fsz}px;height:${0.28 * fsz}px;border-radius:50%;background:${bubInk};opacity:.45`; tl.fromTo(dt, { y: 0 }, { y: -0.18 * fsz, duration: 0.18, ease: 'sine.inOut', yoyo: true, repeat: 1 }, ti - 0.45 + k * 0.08); });
          tl.fromTo(dots, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(2)' }, ti - 0.5);
          tl.to(dots, { opacity: 0, duration: 0.1 }, ti - 0.05);
          tl.fromTo(b, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(2.2)' }, ti);
          sound(ti, m.cta ? 'click' : 'pop', 0.7);
          y += b.offsetHeight + gap;
        });
        // centre the whole conversation; if it is taller than the screen it scrolls up like a real chat
        const total = y - gap - (port ? H * 0.12 : M), shift = Math.max(0, (H - total) / 2 - (port ? H * 0.12 : M));
        if (shift > 0) { head.style.top = parseFloat(head.style.top) + shift + 'px'; list.style.top = shift + 'px'; }
        const over = y + shift - (H - M);
        // messages scroll up under the header, never over it
        if (over > 0) clip.style.clipPath = `inset(${top0 + shift - gap * 0.6}px 0 0 0)`;
        if (over > 0) tl.to(list, { y: -over, duration: per * 0.8, ease: 'power2.inOut' }, t + 0.5 + (msgs.length - 1.4) * per);
      },
      // the close: mark, name, the action, how to reach them. It keeps breathing until the last frame.
      end(Lr, t, d, data, v, S) {
        const glow = el('div', `position:absolute;width:${1.3 * Math.max(W, H)}px;height:${1.3 * Math.max(W, H)}px;left:50%;top:50%;margin:-${0.65 * Math.max(W, H)}px;background:radial-gradient(circle, ${rgba(S.acc, L0.dark || S.kind === 'accent' ? 0.18 : 0.1)} 0%, transparent 55%);`, Lr);
        tl.fromTo(glow, { scale: 0.85, opacity: 0 }, { scale: 1.15, opacity: 1, duration: d, ease: 'none' }, t);
        const leftA = v === 'left' && !land;
        const mk = (port ? 200 : 160) * TU;
        const contacts = [data.phone && [data.whatsapp ? 'chat' : 'phone', data.phone], data.link && ['globe', data.link], data.place && ['pin', data.place]].filter(Boolean);
        // measure the stack first so it sits centred
        const nameW = land ? W * 0.7 : CW;
        const nb = textBlock(Lr, cfg.brand, { w: nameW, size: (port ? 96 : 88) * TU, min: 40 * TU, maxLines: 2, color: S.ink, upper: L0.upper, align: leftA ? 'left' : 'center', css: leftA ? `left:${M}px;top:0` : `left:${(W - nameW) / 2}px;top:0` });
        const btnH = (port ? 112 : 100) * TU, gap = 46 * TU, cH = contacts.length * 64 * TU;
        const rp = L0.id !== 'tech' && L0.id !== 'bold' ? mk * 0.34 : 0;   // room for the turning ring of words
        const stackH = rp * 2 + mk + gap + nb.offsetHeight + gap * 1.2 + btnH + (contacts.length ? gap + cH : 0);
        let y = (H - stackH) / 2 + rp;
        const mkBox = mark(Lr, mk, leftA ? `left:${M}px;top:${y}px` : `left:${(W - mk) / 2}px;top:${y}px`, t + 0.2, S.ink);
        y += mk + gap + rp; nb.style.top = y + 'px'; y += nb.offsetHeight + gap * 1.2;
        reveal(nb, t + 0.55);
        tl.fromTo(mkBox, { rotateY: -140, transformPerspective: 900 * U }, { rotateY: 0, duration: 1.3, ease: 'back.out(1.3)' }, t + 0.15);
        tl.fromTo(mkBox, { scale: 1 }, { scale: 1.04, duration: d, ease: 'none' }, t + 1.4);
        if (L0.id !== 'tech' && L0.id !== 'bold') {
          // the brand and its trade run around the mark on a circle, turning slowly
          const ringTxt = `${cfg.brand}${cfg.category ? ' • ' + cfg.category : ''} • `.toUpperCase();
          const reps = Math.max(1, Math.round(54 / ringTxt.length));
          const rs = mk * 1.62, rx = parseFloat(mkBox.style.left) + mk / 2 - rs / 2, ry = parseFloat(mkBox.style.top) + mk / 2 - rs / 2;
          const id = 'ring' + Math.round(t * 100);
          const ring = el('div', `position:absolute;left:${rx}px;top:${ry}px;width:${rs}px;height:${rs}px;pointer-events:none;`, Lr, `<svg viewBox="0 0 200 200" width="${rs}" height="${rs}" style="overflow:visible"><defs><path id="${id}" d="M100,100 m-86,0 a86,86 0 1,1 172,0 a86,86 0 1,1 -172,0"/></defs><text font-family="${ui.replace(/"/g, "'")}" font-weight="600" font-size="11" letter-spacing="3.2" fill="${S.mute}"><textPath href="#${id}" textLength="536" lengthAdjust="spacing">${esc(ringTxt.repeat(reps))}</textPath></text></svg>`);
          tl.fromTo(ring, { opacity: 0, rotate: -30, scale: 0.9 }, { opacity: 1, rotate: 0, scale: 1, duration: 1.2, ease: 'expo.out' }, t + 0.5);
          tl.to(ring, { rotate: 60, duration: Math.max(1, d - 1.7), ease: 'none' }, t + 1.7);
        }
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
        sound(tb + 1.0, 'click');
        for (let s = tb + 0.7, k = 0; s < t + d - 0.9 && k < 8; s += 2.4, k++) tl.fromTo(shine, { x: -bw * 0.4 }, { x: bw * 1.3, duration: 0.9, ease: 'power2.inOut' }, s);
        y += btnH + gap;
        contacts.forEach(([ic, text], i) => {
          const row = el('div', `position:absolute;${leftA ? `left:${M}px` : 'left:0;right:0;justify-content:center'};top:${y + i * 64 * TU}px;display:flex;align-items:center;gap:${16 * U}px;font-family:${ui};font-weight:600;font-size:${(port ? 38 : 34) * TU}px;color:${S.ink};white-space:nowrap;`, Lr);
          row.innerHTML = icon(ic, 38 * TU, S.acc, 2) + `<span>${esc(text)}</span>`;
          fadeUp(row, tb + 0.4 + i * 0.15);
        });
        if (data.note) {   // a small closing line, e.g. "This video was made with Animora"
          const nt = el('div', `position:absolute;left:${M}px;right:${M}px;bottom:${M * 0.9}px;text-align:center;font-family:${ui};font-weight:600;font-size:${(port ? 30 : 26) * TU}px;letter-spacing:.04em;color:${rgba(S.ink, 0.78)};`, Lr, esc(data.note));
          fadeUp(nt, tb + 1.3);
        }
        sound(t - 0.9, 'swell'); sound(t + 0.5, 'end');
      },
    };

    // ================================================================ transitions between beats
    const TRANS = {
      // crash zoom: the old scene punches in and blurs, the new one lands from slightly too close
      crash(prev, next, t, d) {
        tl.to(prev, { scale: 1.9, filter: `blur(${14 * U}px)`, duration: d * 0.55, ease: 'power4.in' }, t);
        tl.fromTo(next, { opacity: 0, scale: 1.35, filter: `blur(${14 * U}px)` }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: d * 0.75, ease: 'expo.out' }, t + d * 0.45);
        tl.set(next, { clearProps: 'filter' }, t + d * 1.25);
      },
      // whip pan: both scenes smear sideways with motion blur, like a fast camera swing
      whip(prev, next, t, d) {
        const dir = (hash(Math.round(t * 10)) % 2) ? 1 : -1;
        tl.to(prev, { x: -dir * W * 0.9, filter: `blur(${22 * U}px)`, duration: d * 0.5, ease: 'power3.in' }, t);
        tl.fromTo(next, { x: dir * W * 0.9, filter: `blur(${22 * U}px)` }, { x: 0, filter: 'blur(0px)', duration: d * 0.6, ease: 'power3.out' }, t + d * 0.42);
        tl.set(next, { clearProps: 'filter' }, t + d * 1.1);
      },
      // zoom-through: the camera flies through the old scene into the new one
      through(prev, next, t, d) {
        tl.to(prev, { scale: 6, opacity: 0, duration: d * 0.9, ease: 'power3.in', transformOrigin: '50% 50%' }, t);
        tl.fromTo(next, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: d * 0.9, ease: 'expo.out' }, t + d * 0.35);
      },
      // shape portal: the next scene opens through a rounded window that grows from the centre
      portal(prev, next, t, d) {
        const r = L0.radius ? Math.max(24, L0.radius * 2) * U : 40 * U;
        tl.fromTo(next, { clipPath: `inset(46% 40% 46% 40% round ${r}px)` }, { clipPath: `inset(0% 0% 0% 0% round 0px)`, duration: d * 1.1, ease: 'expo.inOut' }, t);
        tl.fromTo(next, { scale: 1.12 }, { scale: 1, duration: d * 1.1, ease: 'expo.inOut' }, t);
        tl.to(prev, { scale: 0.9, duration: d * 1.1, ease: 'expo.inOut' }, t);
      },
      // liquid: the old scene ripples like glass while the new one melts in
      liquid(prev, next, t, d) {
        const id = 'liq' + Math.round(t * 100);
        const svg = el('div', 'position:absolute;width:0;height:0;overflow:hidden;', stage, `<svg width="0" height="0"><filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${(0.008 / U).toFixed(4)}" numOctaves="2" seed="${(cfg.seed || 3) % 97}"/><feDisplacementMap in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`);
        const dm = svg.querySelector('feDisplacementMap');
        tl.set(prev, { filter: `url(#${id})` }, t);
        tl.fromTo(dm, { attr: { scale: 0 } }, { attr: { scale: 140 * U }, duration: d * 0.6, ease: 'power2.in' }, t);
        tl.fromTo(next, { opacity: 0 }, { opacity: 1, duration: d * 0.6, ease: 'power2.inOut' }, t + d * 0.4);
      },
      // glitch: the old scene jumps in bands with split colour channels, then the new one snaps in the same way
      glitch(prev, next, t, d) {
        const rgbOn = `drop-shadow(${9 * U}px 0 0 rgba(255,0,80,.75)) drop-shadow(${-9 * U}px 0 0 rgba(0,220,255,.75))`, rgbOff = 'drop-shadow(0px 0 0 rgba(255,0,80,0)) drop-shadow(0px 0 0 rgba(0,220,255,0))';
        const n = 6, half = d * 0.5;
        for (let i = 0; i < n; i++) {
          const a0 = hash(i * 13 + Math.round(t * 10)), top = (a0 % 70), hgt = 8 + (a0 % 22), off = ((a0 >> 3) % 2 ? 1 : -1) * (30 + (a0 % 90)) * U;
          tl.set(prev, { x: off, filter: rgbOn, clipPath: `inset(${top}% 0 ${Math.max(0, 100 - top - hgt)}% 0)` }, t + (i / n) * half);
        }
        tl.set(prev, { x: 0, clipPath: 'inset(0% 0 0% 0)', filter: rgbOff }, t + half);
        tl.fromTo(next, { opacity: 0 }, { opacity: 1, duration: 0.01 }, t + half);
        for (let i = 0; i < 4; i++) { const a0 = hash(i * 29 + 7 + Math.round(t * 10)); tl.set(next, { x: ((a0 % 2) ? 1 : -1) * (12 + (a0 % 40)) * U, filter: rgbOn }, t + half + i * 0.06); }
        tl.set(next, { x: 0, filter: rgbOff }, t + half + 0.26);
        tl.set(next, { clearProps: 'filter' }, t + half + 0.3);
      },
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
        sound(s + 0.05, 'trans', name === 'dissolve' ? 0.75 : 1);
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
    // a cut already carries a whoosh: the scene's own entry sound is dropped when it would double it
    const cuts = sfx.filter((x) => x.r === 'trans').map((x) => x.t);
    const out = sfx.filter((x) => !(['hook', 'reveal'].includes(x.r) && cuts.some((c) => Math.abs(c - x.t) < 0.45)))
      .map((x) => (x.r === 'photo' && cuts.some((c) => Math.abs(c - x.t) < 0.45) ? { ...x, v: +(x.v * 0.6).toFixed(2) } : x))
      .filter((x) => x.t < end - 0.1).sort((a, b) => a.t - b.t).filter((x, i, arr) => !arr.slice(Math.max(0, i - 3), i).some((y) => y.k === x.k && x.t - y.t < 0.2));
    if (!cfg.noGlobal) { window.__sfx = out; window.__timeline = film; }
    return { tl: film, sfx: out, duration: end };
  };
})();
