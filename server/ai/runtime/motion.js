/* AdFlash motion runtime v3 (inlined into every built-in video).
 *
 * Reads window.ADFLASH_DATA (beats, theme, canvas) and builds the whole video as DOM + ONE paused GSAP
 * timeline. Motion-design language taken from pro After Effects ads:
 *   - one short idea per beat (~1-2s), many beats, nothing static
 *   - elements morph into each other (dot -> pill -> card, icon -> notification), lines lead the eye
 *   - fast moves carry directional motion blur (SVG feGaussianBlur per beat), giant words fly at camera
 *   - UI pieces as graphics: glass cards, pills, rolling counters, rings, flows, grids, phones, cursor clicks
 * Rules: deterministic (seeded rnd), every tween on `tl`, nothing ends after DURATION, one beat on screen
 * at a time (the outgoing beat finishes leaving before the incoming one arrives).
 */
(function () {
  const DATA = window.ADFLASH_DATA;
  const W = DATA.W, H = DATA.H, DURATION = DATA.duration, WIDE = W > H, SQUARE = W === H, U = Math.min(W, H) / 1080 * (WIDE ? 1.18 : 1);   // landscape: bigger pieces so the width is used
  const TH = DATA.theme;
  const SP = (typeof SPEED === 'number' && SPEED > 0) ? SPEED : 1;
  const ENERGY = TH.energy || 2;
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  // Sound effects: every movement that deserves a sound records a cue { t, k (sound name), v (volume) }.
  // The preview plays them live; the renderer mixes them into the MP4. look.sound: 'off' | 'soft' | 'punchy'.
  const SFX = [];
  const SND = TH.sound === 'off' ? 'off' : 'soft';   // sounds are always soft; 'off' adds none at all
  const sfx = (t, k, v) => {
    if (SND === 'off' || !(t >= 0) || t > DURATION - 0.08) return;
    const vol = (v == null ? 1 : v) * 0.8;
    SFX.push({ t: Math.round(t * 1000) / 1000, k, v: Math.round(vol * 100) / 100 });
  };
  let __s = DATA.seed || 12345; const rnd = () => ((__s = (__s * 16807) % 2147483647) / 2147483647);
  const R = (a, b) => a + rnd() * (b - a);
  const N = (n) => n * U;                                                       // design px (1080 base) -> canvas px
  const FS = (n) => 'calc(var(--scale) * ' + (n * U).toFixed(1) + 'px)';           // font size that "bigger/smaller" edits can scale
  const FT = (t) => Math.max(0, Math.min(DURATION, t));
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function el(tag, cls, parent, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const ICONS = {
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/>',
    pin: '<path d="M12 22s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cart: '<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
    star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4 6.4 20.3l1.1-6.2L3 9.7l6.2-.9z"/>',
    heart: '<path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8c-2-4-6-4-6-1.5S9 8 12 8zm0 0c2-4 6-4 6-1.5S15 8 12 8z"/>',
    truck: '<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19c3-4 6-6 10-8"/>',
    cup: '<path d="M5 8h12v6a6 6 0 0 1-12 0z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2M8 3v2M11 3v2M14 3v2"/>',
    food: '<path d="M7 2v8M5 2v5a2 2 0 0 0 4 0V2M7 10v12M17 2c-2 1-3 4-3 7h3v13"/>',
    cake: '<path d="M4 21h16v-8H4zM4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1.5 4 0M12 13V9"/><path d="M12 3c1 1.2 1 2.4 0 3-1-.6-1-1.8 0-3z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
    home: '<path d="M3 11l9-7 9 7v10h-6v-6H9v6H3z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 8L20 19M8.5 16L20 5"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v14h-7"/>',
    dumbbell: '<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20M6 15h4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14a5 5 0 0 1 5.5 5"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8M9 18h6"/>',
    camera: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.5" r="3.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    bed: '<path d="M3 18V7M3 13h18v5M21 18v-3a3 3 0 0 0-3-3h-7v1"/><circle cx="7" cy="10.5" r="1.8"/>',
    car: '<path d="M3 16v-3l2-5h14l2 5v3zM3 16v2h3v-2M18 16v2h3v-2"/><circle cx="7.5" cy="13" r="1"/><circle cx="16.5" cy="13" r="1"/>',
    school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    fire: '<path d="M12 22a7 7 0 0 0 7-7c0-5-5-7-5-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-2 5-2 8a7 7 0 0 0 7 7z"/>',
    shirt: '<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c-1 1.5-2.2 2-4 2s-3-.5-4-2z"/>',
    drop: '<path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z"/>',
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  };
  const icon = (name, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || ICONS.sparkle) + '</svg>';

  // ------------------------------------------------------------------ stage
  const stage = $('#stage');
  const bg = el('div', '', stage); bg.id = 'bg';
  const cam = el('div', '', stage); cam.id = 'cam';
  const fx = el('div', '', stage); fx.id = 'fx';
  const svgNS = 'http://www.w3.org/2000/svg';
  const defsSvg = document.createElementNS(svgNS, 'svg');
  defsSvg.setAttribute('width', '0'); defsSvg.setAttribute('height', '0'); defsSvg.style.position = 'absolute';
  const defs = document.createElementNS(svgNS, 'defs'); defsSvg.appendChild(defs); stage.appendChild(defsSvg);
  function blurFilter(id) {
    const f = document.createElementNS(svgNS, 'filter');
    f.setAttribute('id', id); f.setAttribute('x', '-50%'); f.setAttribute('y', '-50%'); f.setAttribute('width', '200%'); f.setAttribute('height', '200%');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    const g = document.createElementNS(svgNS, 'feGaussianBlur'); g.setAttribute('stdDeviation', '0 0');
    f.appendChild(g); defs.appendChild(f);
    return g;
  }

  // ------------------------------------------------------------------ ambient background
  function ambient() {
    const A = TH.ambient || [];
    el('div', 'bg-base', bg);
    if (A.includes('grid')) { const g = el('div', 'bg-grid', bg); tl.fromTo(g, { x: 0, y: 0 }, { x: N(90), y: N(90), duration: DURATION, ease: 'none' }, 0); }
    if (A.includes('dots')) { const g = el('div', 'bg-dots', bg); tl.fromTo(g, { x: 0, y: 0 }, { x: N(60), y: N(120), duration: DURATION, ease: 'none' }, 0); }
    if (A.includes('glow')) {
      const g1 = el('div', 'bg-glow g1', bg), g2 = el('div', 'bg-glow g2', bg);
      tl.fromTo(g1, { x: -W * 0.1, y: -H * 0.05, scale: 1 }, { x: W * 0.25, y: H * 0.15, scale: 1.3, duration: DURATION, ease: 'sine.inOut' }, 0);
      tl.fromTo(g2, { x: W * 0.1, y: H * 0.05, scale: 1.2 }, { x: -W * 0.25, y: -H * 0.12, scale: 0.9, duration: DURATION, ease: 'sine.inOut' }, 0);
    }
    if (A.includes('streaks')) {
      for (let k = 0; k < 3; k++) {
        const s = el('div', 'bg-streak s' + k, bg);
        const d = R(5, 8), off = k * 1.3, n = Math.max(1, Math.floor((DURATION - off) / d));
        tl.fromTo(s, { x: -W * 1.2, y: R(-H * 0.2, H * 0.2), rotation: -28 + k * 8 }, { x: W * 1.3, duration: (DURATION - off) / n, ease: 'none', repeat: n - 1 }, off);
      }
    }
    if (A.includes('beams')) {
      for (let k = 0; k < 3; k++) { const b = el('div', 'bg-beam', bg); tl.fromTo(b, { rotation: -26 + k * 20 }, { rotation: 16 - k * 18, duration: DURATION, ease: 'sine.inOut' }, 0); }
    }
    if (A.includes('rays')) { const r = el('div', 'bg-rays', bg); tl.fromTo(r, { rotation: 0 }, { rotation: DURATION * 5, duration: DURATION, ease: 'none' }, 0); }
    if (A.includes('halftone')) { const h = el('div', 'bg-halftone', bg); tl.fromTo(h, { x: 0, y: 0 }, { x: N(92), y: N(46), duration: DURATION, ease: 'none' }, 0); }
    if (A.includes('kente')) {
      const k1 = el('div', 'bg-kente k1', bg), k2 = el('div', 'bg-kente k2', bg); const n = Math.max(1, Math.floor(DURATION / 2.4));
      tl.fromTo(k1, { x: 0 }, { x: N(576), duration: DURATION / n, ease: 'none', repeat: n - 1 }, 0);
      tl.fromTo(k2, { x: 0 }, { x: -N(576), duration: DURATION / n, ease: 'none', repeat: n - 1 }, 0);
    }
    if (A.includes('waves')) {
      const w1 = el('div', 'bg-wave w1', bg), w2 = el('div', 'bg-wave w2', bg);
      const n1 = Math.max(1, Math.floor(DURATION / 2.2)), n2 = Math.max(1, Math.floor(DURATION / 1.4));
      tl.fromTo(w1, { x: 0 }, { x: -N(280), duration: DURATION / n1, ease: 'none', repeat: n1 - 1 }, 0);
      tl.fromTo(w2, { x: 0 }, { x: -N(280), duration: DURATION / n2, ease: 'none', repeat: n2 - 1 }, 0);
    }
    if (A.includes('marquee')) {
      const word = esc(String(DATA.brand || '').toUpperCase());
      for (let k = 0; k < 2; k++) {
        const m = el('div', 'bg-marq m' + k, bg, '<span>' + (word + ' ✦ ').repeat(8) + '</span>');
        const mw = Math.max(W, N(3000));
        tl.fromTo(m, { x: k ? -mw * 0.5 : 0 }, { x: k ? 0 : -mw * 0.5, duration: DURATION, ease: 'none' }, 0);
      }
    }
    if (A.includes('particles') || A.includes('confetti') || A.includes('sparkles') || A.includes('bubbles')) {
      const kind = A.includes('confetti') ? 'cf' : A.includes('sparkles') ? 'sk' : A.includes('bubbles') ? 'bb' : 'pt';
      const n = kind === 'cf' ? 28 : 16;
      for (let k = 0; k < n; k++) {
        const p = el('i', 'bg-p ' + kind + ' c' + (k % 3), bg);
        const size = kind === 'bb' ? N(R(50, 150)) : kind === 'cf' ? N(R(14, 26)) : N(R(10, 26));
        p.style.width = size + 'px'; p.style.height = (kind === 'cf' ? size * 1.7 : size) + 'px';
        p.style.left = R(0, W) + 'px'; p.style.top = (kind === 'cf' ? -N(80) : R(0, H)) + 'px';
        if (kind === 'cf') {
          const d = R(3, 5), o = R(0, 2.5), rep = Math.floor((DURATION - o) / d);
          if (rep >= 1) tl.fromTo(p, { y: 0, x: 0, rotation: R(-90, 90) }, { y: H + N(160), x: R(-N(160), N(160)), rotation: R(360, 900), duration: d, ease: 'none', repeat: rep - 1 }, o);
        } else if (kind === 'sk') {
          const d = R(0.9, 1.6), o = R(0, 1.5), rep = Math.floor((DURATION - o) / (d * 2));
          if (rep >= 1) tl.fromTo(p, { scale: 0, opacity: 0, rotation: 0 }, { scale: 1, opacity: 0.9, rotation: 90, duration: d, ease: 'sine.inOut', yoyo: true, repeat: rep * 2 - 1 }, o);
        } else {
          tl.fromTo(p, { y: 0, x: 0, rotation: R(-30, 30) }, { y: -H * R(0.15, 0.5), x: R(-N(120), N(120)), rotation: R(-200, 200), duration: DURATION, ease: 'none' }, 0);
        }
      }
    }
    if (A.includes('scan')) el('div', 'bg-scan', bg);
    if (A.includes('frame')) { const f = el('div', 'bg-frame', bg); tl.from(f, { scale: 1.06, opacity: 0, duration: 1.2 }, 0); }
    el('div', 'bg-vignette', bg);
  }

  // ------------------------------------------------------------------ shared pieces
  // Words that rise out of their own mask; the accent word is coloured or gets a marker bar behind it.
  function wordsHtml(text, accentIdx, marker) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const ai = accentIdx == null ? (words.length >= 2 ? words.length - 1 : -1) : accentIdx;
    return words.map((w, k) => {
      const acc = k === ai;
      return '<span class="wd' + (acc ? ' acc' + (marker ? ' mkd' : '') : '') + '">' + (acc && marker ? '<span class="mk"></span>' : '') + '<span class="wi">' + esc(w) + '</span></span>';
    }).join(' ');
  }
  const TS = Math.min(1, (TH.textScale || 1) * (WIDE ? 1.3 : 1));
  function sizeFor(text, base, min, max) { return sizeRaw(text, base, min, max) * TS; }
  function sizeRaw(text, base, min, max) {
    const len = String(text).length;
    const longest = Math.max(1, ...String(text).split(/\s+/).map((w) => w.length));
    let s = Math.min(max, Math.max(min, base / Math.max(8, len)));
    s = Math.min(s, (WIDE ? 1500 : 980) / (longest * 0.6));   // one long word must still fit
    return s;
  }
  function textEnter(root, at, variant) {
    const wis = $$('.wi', root), mks = $$('.mk', root);
    if (!wis.length) return;
    if (variant === 'blur') {
      tl.from(wis, { opacity: 0, scale: 1.6, filter: 'blur(' + N(18) + 'px)', duration: 0.6 / SP, stagger: 0.07 / SP, ease: 'expo.out' }, at);
    } else if (variant === 'focus') {
      tl.from(wis, { opacity: 0, y: N(24), filter: 'blur(' + N(14) + 'px)', duration: 0.7 / SP, stagger: 0.09 / SP, ease: 'power3.out' }, at);
    } else if (variant === 'slide') {
      tl.from(wis, { xPercent: -60, opacity: 0, duration: 0.55 / SP, stagger: 0.06 / SP, ease: 'expo.out' }, at);
    } else {
      tl.from(wis, { yPercent: 115, duration: 0.65 / SP, stagger: 0.075 / SP, ease: 'expo.out' }, at);
    }
    if (mks.length) tl.from(mks, { scaleX: 0, duration: 0.45, ease: 'expo.inOut' }, at + 0.25 + wis.length * 0.05);
  }
  function mark(parent, size) {   // the brand mark: uploaded logo, or a monogram tile
    const m = el('div', 'mark', parent);
    m.style.width = N(size) + 'px'; m.style.height = N(size) + 'px';
    if (DATA.logo) {
      m.classList.add('logo'); if (!DATA.logo.transparent) m.classList.add('card');
      m.innerHTML = '<img src="' + esc(DATA.logo.url) + '" crossorigin="anonymous" alt="">';
    } else {
      m.classList.add('mono'); m.style.fontSize = N(size * 0.52) + 'px';
      m.innerHTML = '<span>' + esc((String(DATA.brand || 'A').trim()[0] || 'A').toUpperCase()) + '</span>';
    }
    return m;
  }
  function idle(bi, b, amt) { tl.fromTo(bi, { scale: 1 }, { scale: 1 + (amt || 0.04), duration: Math.max(0.3, b.t1 - b.t0), ease: 'none', immediateRender: false }, b.t0); }
  function floaty(target, b, ampY, ampR) {
    const L = b.t1 - b.t0, d = 1.3, n = Math.floor((L - 0.9) / d);
    if (n >= 1) tl.to(target, { y: '-=' + N(ampY || 12), rotation: ampR || 0, duration: d / 2, ease: 'sine.inOut', yoyo: true, repeat: n * 2 - 1 }, b.t0 + 0.9);
  }
  function shake(at, amt) {
    if (ENERGY < 2) return;
    const k = [];
    for (let j = 0; j < 6; j++) { const a = N(amt) * (1 - j / 6); k.push({ x: R(-a, a), y: R(-a, a), duration: 0.04 }); }
    k.push({ x: 0, y: 0, duration: 0.05 });
    tl.to(cam, { keyframes: k, ease: 'none', immediateRender: false }, at);
  }
  function burstDots(parent, at, count, radius) {
    for (let k = 0; k < count; k++) {
      const d = el('i', 'burst-dot c' + (k % 3), parent);
      const a = (k / count) * Math.PI * 2 + R(-0.2, 0.2), r = N(radius) * R(0.7, 1.2), s = N(R(10, 24));
      d.style.width = s + 'px'; d.style.height = s + 'px';
      tl.fromTo(d, { x: 0, y: 0, scale: 1, opacity: 1 }, { x: Math.cos(a) * r, y: Math.sin(a) * r, scale: 0, opacity: 0, duration: 0.8, ease: 'expo.out', immediateRender: false }, at);
    }
  }
  function odometer(parent, value, prefix, at, cls) {
    const box = el('div', 'odo ' + (cls || ''), parent);
    const str = fmt(value);
    if (prefix) el('span', 'odo-pre', box, esc(prefix));
    const cols = [];
    for (const ch of str) {
      if (/\d/.test(ch)) {
        const c = el('span', 'odo-d', box); const col = el('span', 'odo-col', c);
        let html = ''; for (let k = 0; k < 20; k++) html += '<span>' + (k % 10) + '</span>';
        col.innerHTML = html; cols.push({ col, d: Number(ch) });
      } else el('span', 'odo-s', box, esc(ch));
    }
    cols.reverse().forEach((c, i) => {
      tl.fromTo(c.col, { yPercent: 0 }, { yPercent: -((10 + c.d) / 20) * 100, duration: (1.1 + i * 0.12) / SP, ease: 'power4.out', immediateRender: false }, at + i * 0.04);
      tl.fromTo(c.col, { filter: 'blur(' + N(10) + 'px)' }, { filter: 'blur(0px)', duration: (0.8 + i * 0.1) / SP, ease: 'power3.in', immediateRender: false }, at + i * 0.04);
    });
    return box;
  }

  // ------------------------------------------------------------------ shots
  const SHOTS = {};

  SHOTS.words = (b, bi) => {
    const box = el('div', 'fitbox col center', bi);
    const t = el('div', 'tx-line', box, wordsHtml(b.text, b.accent, TH.accentStyle === 'marker'));
    t.style.fontSize = FS(sizeFor(b.text, 2700, 70, 170));
    let sub;
    if (b.sub) { sub = el('div', 'tx-sub', box, wordsHtml(b.sub, -1)); sub.style.fontSize = FS(46); }
    const at = b.in;
    textEnter(t, at, b.variant || (TH.textIn || 'rise'));
    if (sub) textEnter(sub, at + 0.35, 'rise');
    idle(bi, b, 0.05);
  };

  SHOTS.kinetic = (b, bi) => {
    const words = String(b.text).split(/\s+/).filter(Boolean);
    const lines = []; let cur = [];
    words.forEach((w) => { cur.push(w); if (cur.join(' ').length >= 7 || cur.length === 2) { lines.push(cur.join(' ')); cur = []; } });
    if (cur.length) lines.push(cur.join(' '));
    const box = el('div', 'fitbox kin', bi);
    lines.forEach((ln, k) => {
      const big = k % 2 === 0 || lines.length <= 2;
      const d = el('div', 'kin-line' + (k === lines.length - 1 ? ' acc' : '') + (big ? ' big' : ' small'), box, '<span>' + esc(ln) + '</span>');
      const size = big ? Math.min(220, (WIDE ? 1500 : 900) / Math.max(4, ln.length * 0.58)) : 84;
      d.style.fontSize = FS(size);
      d.style.marginLeft = N(k % 2 ? 90 : 0) + 'px';
      const fromX = (k % 2 ? 1 : -1) * W * 0.7;
      tl.from(d, { x: fromX, opacity: 0, filter: 'blur(' + N(24) + 'px)', duration: 0.55 / SP, ease: 'expo.out' }, b.in + k * 0.13 / SP);
      tl.to(d, { x: (k % 2 ? -1 : 1) * N(40), duration: Math.max(0.5, b.t1 - b.in - 0.6), ease: 'none' }, b.in + 0.6);
    });
    if (ENERGY >= 3) shake(b.in + 0.2, 18);
  };

  SHOTS.zoomword = (b, bi) => {
    const txt = String(b.text);
    const size = Math.min(WIDE ? 300 : 300, (WIDE ? 1500 : 840) / Math.max(3, txt.length * 0.64));
    const wrap = el('div', 'zw', bi);
    for (let k = 3; k >= 1; k--) { const e = el('div', 'zw-echo', wrap, esc(txt)); e.style.fontSize = FS(size); tl.fromTo(e, { scale: 0.2, opacity: 0 }, { scale: 1 + k * 0.35, opacity: 0.22 / k, duration: 0.9, ease: 'expo.out', immediateRender: true }, b.in + 0.05 * k); }
    const main = el('div', 'zw-main', wrap, esc(txt)); main.style.fontSize = FS(size);
    tl.fromTo(main, { scale: 0.15, opacity: 0, filter: 'blur(' + N(30) + 'px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.6 / SP, ease: 'expo.out', immediateRender: true }, b.in);
    tl.to(main, { scale: 1.1, duration: Math.max(0.4, b.t1 - b.in - 0.6), ease: 'none' }, b.in + 0.6);
    if (b.sub) { const s = el('div', 'tx-sub zw-sub', wrap, wordsHtml(b.sub, -1)); s.style.fontSize = FS(44); textEnter(s, b.in + 0.45, 'rise'); }
    if (ENERGY >= 3) shake(b.in + 0.25, 16);
  };

  SHOTS.type = (b, bi) => {
    const box = el('div', 'fitbox col center', bi);
    const sel = el('div', 'sel', box);
    const t = el('div', 'sel-text', sel);
    t.style.fontSize = FS(sizeFor(b.text, 2500, 64, 150));
    const chars = Array.from(String(b.text));
    t.innerHTML = chars.map((c) => '<span class="ch">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>').join('');
    ['tl', 'tr', 'bl', 'br'].forEach((p) => el('i', 'hd ' + p, sel));
    const cur = el('i', 'cursor', sel);
    const fill = el('div', 'sel-fill', sel);
    const each = Math.min(0.06, (b.t1 - b.in - 0.8) * 0.45 / chars.length) / SP;
    tl.from(sel, { scaleX: 0.2, opacity: 0, duration: 0.35, ease: 'expo.out' }, b.in);
    tl.from($$('.ch', t), { opacity: 0, duration: 0.01, stagger: each, ease: 'none' }, b.in + 0.25);
    const typed = b.in + 0.25 + each * chars.length;
    for (let k = 0; k < chars.length; k += 4) sfx(b.in + 0.25 + each * k, 'tick', 0.3);
    const blinks = Math.max(1, Math.floor((b.t1 - b.in) / 0.5));
    tl.fromTo(cur, { opacity: 1 }, { opacity: 0, duration: 0.01, repeat: blinks, yoyo: true, repeatDelay: 0.24, ease: 'none', immediateRender: false }, b.in + 0.2);
    tl.from(fill, { scaleX: 0, duration: 0.45, ease: 'expo.inOut' }, typed + 0.1);
    tl.to($$('.hd', sel), { scale: 0, duration: 0.25, stagger: 0.04, ease: 'back.in(2)' }, typed + 0.35);
    if (b.sub) { const s = el('div', 'tx-sub', box, wordsHtml(b.sub, -1)); s.style.fontSize = FS(46); textEnter(s, typed + 0.2, 'rise'); }
    idle(bi, b, 0.03);
  };

  SHOTS.brand = (b, bi) => {
    const box = el('div', 'fitbox col center brand', bi);
    const m = mark(box, WIDE ? 240 : 280);
    const name = el('div', 'tx-line brand-name', box, wordsHtml(b.text, null, false));
    name.style.fontSize = FS(sizeFor(b.text, 2300, 76, 150));
    const chips = el('div', 'chips', box);
    (b.subs || []).forEach((s) => el('span', 'chip', chips, esc(s)));
    tl.fromTo(m, { scale: 0, rotation: -120, y: N(160) }, { scale: 1.25, rotation: 0, y: N(160), duration: 0.55 / SP, ease: 'back.out(1.8)', immediateRender: true }, b.in);
    tl.to(m, { scale: 1, y: 0, duration: 0.6 / SP, ease: 'expo.inOut' }, b.in + 0.55);
    textEnter(name, b.in + 0.75, 'rise');
    tl.from($$('.chip', chips), { y: N(40), opacity: 0, scale: 0.7, duration: 0.45, stagger: 0.08, ease: 'back.out(2)' }, b.in + 1.0);
    burstDots(m, b.in + 0.45, 12, 220);
    idle(bi, b, 0.03);
  };

  SHOTS.orbit = (b, bi) => {
    const center = el('div', 'fitbox col center orbit-c', bi);
    const t = el('div', 'tx-line', center, wordsHtml(b.text, null, TH.accentStyle === 'marker'));
    t.style.fontSize = FS(sizeFor(b.text, 2000, 64, 120));
    textEnter(t, b.in + 0.2, 'blur');
    const items = (b.items || []).slice(0, 8);
    const ring = el('div', 'orbit', bi);
    const nodes = items.map((it) => {
      const c = el('div', 'orb' + (it.img ? ' photo' : ''), ring, it.img ? '<img src="' + esc(it.img) + '" crossorigin="anonymous" alt="">' : (it.icon ? icon(it.icon) : '') + '<span>' + esc(it.text) + '</span>');
      return c;
    });
    const rx = WIDE ? W * 0.36 : W * 0.4, ry = WIDE ? H * 0.32 : H * 0.17;
    const p = { a: 0 };
    const place = () => {
      nodes.forEach((n, k) => {
        const a = p.a + (k / nodes.length) * Math.PI * 2;
        const s = Math.sin(a);
        n.style.transform = 'translate(-50%,-50%) translate(' + (Math.cos(a) * rx).toFixed(1) + 'px,' + (s * ry).toFixed(1) + 'px) scale(' + (0.72 + 0.28 * (s + 1) / 2).toFixed(3) + ')';
        n.style.zIndex = String(Math.round(10 + s * 10));
        n.style.opacity = (0.45 + 0.55 * (s + 1) / 2).toFixed(3);
      });
    };
    place();
    tl.fromTo(p, { a: -1.2 }, { a: 1.6, duration: Math.max(0.5, b.t1 - b.t0), ease: 'power1.inOut', onUpdate: place, immediateRender: false }, b.t0);
    tl.from(ring, { scale: 0.3, opacity: 0, duration: 0.7, ease: 'expo.out' }, b.in);
  };

  SHOTS.counter = (b, bi) => {
    const box = el('div', 'fitbox col center', bi);
    if (b.text) { const t = el('div', 'tx-line small', box, wordsHtml(b.text, -1)); t.style.fontSize = FS(sizeFor(b.text, 1700, 48, 76)); textEnter(t, b.in, 'rise'); }
    const ringBox = el('div', 'ringbox', box);
    const size = WIDE ? 560 : 760;
    ringBox.style.width = N(size) + 'px'; ringBox.style.height = N(size) + 'px';
    const r = 46, C = 2 * Math.PI * r;
    ringBox.innerHTML = '<svg viewBox="0 0 100 100"><circle class="rg-bg" cx="50" cy="50" r="' + r + '"/><circle class="rg" cx="50" cy="50" r="' + r + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + C.toFixed(2) + '"/></svg>';
    const odo = odometer(ringBox, b.price, '₦', b.in + 0.2, 'big');
    odo.style.fontSize = FS(Math.min(170, 1050 / Math.max(4, fmt(b.price).length + 1)));
    tl.to($('.rg', ringBox), { attr: { 'stroke-dashoffset': 0 }, duration: 1.1 / SP, ease: 'power3.inOut' }, b.in + 0.1);
    tl.from(ringBox, { scale: 0.6, opacity: 0, duration: 0.6, ease: 'back.out(1.6)' }, b.in);
    const dot = el('i', 'rg-dot', ringBox);
    const p = { a: 0 };
    const rp = N(size) * 0.46;
    tl.fromTo(p, { a: 0 }, { a: Math.PI * 2 * Math.max(1, Math.floor((b.t1 - b.in) / 1.6)), duration: Math.max(0.5, b.t1 - b.in), ease: 'none', immediateRender: false,
      onUpdate: () => { dot.style.transform = 'translate(-50%,-50%) translate(' + (Math.cos(p.a - Math.PI / 2) * rp).toFixed(1) + 'px,' + (Math.sin(p.a - Math.PI / 2) * rp).toFixed(1) + 'px)'; } }, b.in);
    if (b.sub) { const s = el('div', 'tx-sub', box, wordsHtml(b.sub, -1)); s.style.fontSize = FS(44); textEnter(s, b.in + 0.8, 'rise'); }
    if (ENERGY >= 3) shake(b.in + 1.0, 14);
    idle(bi, b, 0.03);
  };

  SHOTS.card = (b, bi) => {
    const holder = el('div', 'card-hold', bi);
    const card = el('div', 'ui-card', holder);
    const cw = WIDE ? Math.min(W * 0.5, N(1100)) : W * 0.84, ch = WIDE ? H * 0.62 : SQUARE ? H * 0.66 : W * 0.74;
    const cc = el('div', 'cc fitbox col', card);
    cc.style.width = (cw - N(110)) + 'px'; cc.style.maxHeight = (ch - N(110)) + 'px';
    el('div', 'cc-ic', cc, icon(b.icon || 'sparkle'));
    const t = el('div', 'cc-title', cc, esc(b.text)); t.style.fontSize = FS(sizeFor(b.text, 2000, 56, 96));
    if (b.price != null) { const o = odometer(cc, b.price, '₦', b.in + 0.55, 'card'); o.style.fontSize = FS(Math.min(200, 1150 / Math.max(4, fmt(b.price).length + 1))); }
    (b.subs || []).slice(0, 2).forEach((s) => { const x = el('div', 'cc-sub', cc, esc(s)); x.style.fontSize = FS(40); });
    if (b.button) el('div', 'cc-btn', cc, icon('arrow') + '<span>' + esc(b.button) + '</span>');
    tl.fromTo(card, { width: N(130), height: N(130), borderRadius: N(65), rotationY: -30, rotationX: 12 },
      { width: N(460), height: N(130), duration: 0.28 / SP, ease: 'power3.inOut', immediateRender: true }, b.in);
    tl.to(card, { width: cw, height: () => Math.min(ch, cc.offsetHeight + N(120)), borderRadius: N(60), duration: 0.5 / SP, ease: 'expo.out' }, b.in + 0.28 / SP);   // height measured lazily (fonts loaded)
    tl.to(card, { rotationY: 0, rotationX: 0, duration: 1.0, ease: 'power3.out' }, b.in + 0.2);
    tl.from(Array.from(cc.children), { y: N(40), opacity: 0, duration: 0.5, stagger: 0.08, ease: 'expo.out' }, b.in + 0.55);
    floaty(card, b, 10, 0);
  };

  SHOTS.pills = (b, bi) => {
    const box = el('div', 'fitbox col center', bi);
    if (b.title) { const t = el('div', 'tx-line small', box, wordsHtml(b.title, null, TH.accentStyle === 'marker')); t.style.fontSize = FS(sizeFor(b.title, 1800, 52, 90)); textEnter(t, b.in, 'rise'); }
    const stack = el('div', 'pills', box);
    (b.items || []).forEach((it, k) => {
      const p = el('div', 'pill', stack, '<span class="pill-n">' + esc(it.name) + '</span>' + (it.price != null ? '<b class="pill-p">₦' + fmt(it.price) + '</b>' : ''));
      p.style.fontSize = FS(WIDE ? 44 : 50);
      tl.from(p, { x: (k % 2 ? 1 : -1) * W * 0.8, opacity: 0, filter: 'blur(' + N(16) + 'px)', duration: 0.6 / SP, ease: 'expo.out' }, b.in + 0.15 + k * 0.12 / SP);
    });
    tl.fromTo(stack, { rotation: -7 }, { rotation: -3, duration: Math.max(0.5, b.t1 - b.t0), ease: 'none', immediateRender: false }, b.t0);
  };

  SHOTS.wheel = (b, bi) => {
    const box = el('div', 'fitbox wheel-wrap' + (WIDE ? ' row' : ''), bi);
    const left = el('div', 'wheel-ic', box);
    if (b.useMark) mark(left, WIDE ? 230 : 250); else left.innerHTML = '<div class="ic-badge">' + icon(b.icon || 'sparkle') + '</div>';
    const win = el('div', 'wheel', box);
    const list = el('div', 'wheel-list', win);
    const items = b.items || [];
    const rowH = N(WIDE ? 120 : 132);
    win.style.height = rowH * 5 + 'px';
    const rows = items.map((it) => {
      const r = el('div', 'wheel-row', list, '<span>' + esc(it.name) + '</span>' + (it.price != null ? '<b>₦' + fmt(it.price) + '</b>' : ''));
      r.style.height = rowH + 'px'; r.style.fontSize = FS(WIDE ? 54 : 62);
      return r;
    });
    const p = { v: -1.5 };
    const apply = () => {
      list.style.transform = 'translateY(' + (rowH * 2 - p.v * rowH).toFixed(1) + 'px)';
      rows.forEach((r, i) => { const d = Math.min(2, Math.abs(i - p.v)); r.style.opacity = (1 - d * 0.36).toFixed(3); r.style.transform = 'scale(' + (1 - d * 0.1).toFixed(3) + ')'; r.classList.toggle('on', d < 0.5); });
    };
    apply();
    tl.from(left, { scale: 0, rotation: -90, duration: 0.6, ease: 'back.out(1.8)' }, b.in);
    tl.from(win, { opacity: 0, x: WIDE ? N(80) : 0, y: WIDE ? 0 : N(80), duration: 0.5, ease: 'expo.out' }, b.in + 0.15);
    const step = Math.max(0.35, (b.t1 - b.in - 0.6) / Math.max(1, items.length));
    tl.to(p, { v: 0, duration: 0.45, ease: 'expo.out', onUpdate: apply }, b.in + 0.2);
    for (let i = 1; i < items.length; i++) tl.to(p, { v: i, duration: Math.min(0.4, step * 0.6), ease: 'back.out(1.6)', onUpdate: apply }, b.in + 0.2 + i * step);
  };

  SHOTS.flow = (b, bi) => {
    const box = el('div', 'fitbox col center', bi);
    if (b.title) { const t = el('div', 'tx-line small', box, wordsHtml(b.title, null, false)); t.style.fontSize = FS(sizeFor(b.title, 1700, 50, 84)); textEnter(t, b.in, 'rise'); }
    const flow = el('div', 'flow' + (WIDE ? ' row' : ''), box);
    const items = (b.items || []).slice(0, 3);
    items.forEach((it, k) => {
      if (k > 0) {
        const c = el('div', 'flow-link', flow, '<i class="flow-pulse"></i>');
        tl.from(c, { [WIDE ? 'scaleX' : 'scaleY']: 0, duration: 0.3, ease: 'power2.inOut' }, b.in + 0.2 + k * 0.32 - 0.12);
        const pulse = $('.flow-pulse', c), n = Math.max(1, Math.floor((b.t1 - b.in - 1) / 0.8));
        tl.fromTo(pulse, WIDE ? { xPercent: -100 } : { yPercent: -100 }, Object.assign(WIDE ? { xPercent: 300 } : { yPercent: 300 }, { duration: 0.8, ease: 'none', repeat: n - 1, immediateRender: false }), b.in + 0.6 + k * 0.1);
      }
      const card = el('div', 'flow-card', flow, '<div class="fc-ic">' + icon(it.icon || 'check') + '</div><span>' + esc(it.text) + '</span>');
      card.style.fontSize = FS(WIDE ? 44 : 54);
      tl.from(card, { scale: 0.6, opacity: 0, filter: 'blur(' + N(12) + 'px)', duration: 0.5, ease: 'back.out(1.7)' }, b.in + 0.2 + k * 0.32);
    });
    idle(bi, b, 0.03);
  };

  SHOTS.grid = (b, bi) => {
    const box = el('div', 'fitbox col center', bi);
    if (b.title) { const t = el('div', 'tx-line small', box, wordsHtml(b.title, null, false)); t.style.fontSize = FS(sizeFor(b.title, 1700, 50, 84)); textEnter(t, b.in, 'rise'); }
    const grid = el('div', 'grid g' + Math.min(3, WIDE ? 3 : 2), box);
    (b.items || []).slice(0, 6).forEach((it, k) => {
      const tile = el('div', 'tile', grid, '<div class="tile-ic">' + icon(it.icon || 'sparkle') + '</div><span>' + esc(it.text) + '</span>' + (it.price != null ? '<b>₦' + fmt(it.price) + '</b>' : ''));
      tile.style.fontSize = FS(WIDE ? 40 : 48);
      tl.from(tile, { scale: 0.4, rotationX: -50, opacity: 0, duration: 0.55, ease: 'back.out(1.6)' }, b.in + 0.15 + k * 0.08);
    });
    idle(bi, b, 0.03);
  };

  SHOTS.split = (b, bi) => {
    const panel = el('div', 'split-panel', bi);
    const circ = el('div', 'split-circle', panel, b.useMark ? '' : icon(b.icon || 'sparkle'));
    if (b.useMark) mark(circ, 230);
    const textHalf = el('div', 'split-text fitbox col', bi);
    const t = el('div', 'tx-line', textHalf, wordsHtml(b.text, null, TH.accentStyle === 'marker'));
    t.style.fontSize = FS(sizeFor(b.text, 1900, 58, 110));
    if (b.sub) { const s = el('div', 'tx-sub', textHalf, wordsHtml(b.sub, -1)); s.style.fontSize = FS(42); textEnter(s, b.in + 0.5, 'rise'); }
    tl.from(panel, WIDE ? { xPercent: 100 } : { yPercent: 100 }, { duration: 0.6 / SP, ease: 'expo.out' }, b.in);
    tl.from(circ, { scale: 0, rotation: -140, duration: 0.6, ease: 'back.out(1.8)' }, b.in + 0.3);
    textEnter(t, b.in + 0.15, 'rise');
    tl.to(circ, { rotation: 8, duration: Math.max(0.5, b.t1 - b.in - 0.9), ease: 'sine.inOut' }, b.in + 0.9);
  };

  SHOTS.hero = (b, bi) => {
    if (b.full) {   // full-bleed photo with text over a dark gradient
      const ph = el('div', 'hero-full', bi, '<img src="' + esc(b.img) + '" crossorigin="anonymous" alt=""><div class="hero-shade"></div>');
      tl.fromTo($('img', ph), { scale: 1.3 }, { scale: 1, duration: Math.max(0.5, b.t1 - b.t0), ease: 'none', immediateRender: false }, b.t0);
      const box = el('div', 'fitbox col center hero-over', bi);
      const t = el('div', 'tx-line', box, wordsHtml(b.text, null, TH.accentStyle === 'marker')); t.style.fontSize = FS(sizeFor(b.text, 2100, 64, 130));
      textEnter(t, b.in + 0.15, 'rise');
      if (b.price != null) { const o = odometer(box, b.price, '₦', b.in + 0.4, 'chip'); o.style.fontSize = FS(90); }
      return;
    }
    const word = String(b.bigword || b.text).split(/\s+/)[0].toUpperCase();
    for (let k = 0; k < (TH.calm ? 0 : 2); k++) {   // premium styles keep the photo on a clean background
      const m = el('div', 'hero-word w' + k, bi, '<span>' + (esc(word) + ' ').repeat(6) + '</span>');
      m.style.fontSize = N(WIDE ? 300 : 340) + 'px';
      tl.fromTo(m, { x: k ? -N(1200) : 0 }, { x: k ? 0 : -N(1200), duration: Math.max(0.5, b.t1 - b.t0), ease: 'none', immediateRender: false }, b.t0);
    }
    const box = el('div', 'fitbox col center', bi);
    const ph = el('div', 'hero-photo', box, '<div class="hp-in"><img src="' + esc(b.img) + '" crossorigin="anonymous" alt=""></div>');
    const ratio = b.imgRatio || 1, pw = N(WIDE ? 520 : 640);
    ph.style.width = pw + 'px'; ph.style.height = Math.round(pw * Math.max(0.65, Math.min(1.3, ratio))) + 'px';
    const t = el('div', 'tx-line', box, wordsHtml(b.text, null, TH.accentStyle === 'marker')); t.style.fontSize = FS(sizeFor(b.text, 1800, 52, 100));
    tl.from(ph, { rotationY: 70, rotationX: 15, scale: 0.5, y: N(220), opacity: 0, duration: 0.9 / SP, ease: 'expo.out' }, b.in);
    tl.fromTo($('img', ph), { scale: 1.25 }, { scale: 1, duration: Math.max(0.5, b.t1 - b.in), ease: 'none', immediateRender: false }, b.in);
    burstDots(ph, b.in + 0.5, 14, 420);
    textEnter(t, b.in + 0.4, 'rise');
    if (b.price != null) {
      const chip = el('div', 'hero-chip', ph);
      const o = odometer(chip, b.price, '₦', b.in + 0.8, 'chip'); o.style.fontSize = FS(76);
      tl.from(chip, { scale: 0, rotation: -40, duration: 0.6, ease: 'back.out(2.2)' }, b.in + 0.7);
      if (ENERGY >= 3) shake(b.in + 0.85, 14);
    }
    floaty(ph, b, 12, 1.5);
  };

  SHOTS.phone = (b, bi) => {
    const box = el('div', 'fitbox phone-wrap' + (WIDE ? ' row' : ''), bi);
    if (b.title) { const t = el('div', 'tx-line small phone-title', box, wordsHtml(b.title, null, TH.accentStyle === 'marker')); t.style.fontSize = FS(sizeFor(b.title, 1700, 50, 86)); textEnter(t, b.in + 0.1, 'rise'); }
    const ph = el('div', 'phone', box);
    const pw = Math.min(N(WIDE ? 420 : 520), H * 0.66 / 2.02); ph.style.width = pw + 'px'; ph.style.height = pw * 2.02 + 'px';
    el('i', 'notch', ph);
    const scr = el('div', 'scr', ph);
    const head = el('div', 'scr-head', scr); mark(head, 86); el('span', 'scr-name', head, esc(DATA.brand || ''));
    const body = el('div', 'scr-body', scr);
    const rows = [];
    (b.items || []).slice(0, 5).forEach((it) => rows.push(el('div', 'scr-row', body, '<span>' + esc(it.name) + '</span>' + (it.price != null ? '<b>₦' + fmt(it.price) + '</b>' : ''))));
    if (b.button) rows.push(el('div', 'scr-btn', body, icon('chat') + '<span>' + esc(b.button) + '</span>'));
    tl.from(ph, { y: H * 0.6, rotationX: 40, rotationZ: -14, scale: 0.8, duration: 1.0 / SP, ease: 'expo.out' }, b.in);
    tl.from(rows, { x: N(80), opacity: 0, duration: 0.45, stagger: 0.1, ease: 'expo.out' }, b.in + 0.55);
    tl.fromTo(ph, { rotationY: -10 }, { rotationY: 8, duration: Math.max(0.5, b.t1 - b.in), ease: 'sine.inOut', immediateRender: false }, b.in);
    if (b.button) {
      const btn = rows[rows.length - 1];
      tl.to(btn, { scale: 0.92, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.inOut' }, b.in + 1.3);
    }
  };

  SHOTS.notify = (b, bi) => {
    const box = el('div', 'fitbox notif-wrap', bi);
    const msgs = [b.text].concat(b.subs || []).slice(0, 3);
    msgs.forEach((msg, k) => {
      const n = el('div', 'notif', box);
      const ic = el('div', 'notif-ic', n); mark(ic, 110);
      const tx = el('div', 'notif-tx', n, '<div class="nt-top"><b>' + esc(DATA.brand || '') + '</b><span>now</span></div><div class="nt-msg">' + esc(msg) + '</div>');
      tx.style.fontSize = FS(WIDE ? 34 : 40); tx.style.width = ((WIDE ? W * 0.5 : W * 0.86) - N(190)) + 'px';
      const at = b.in + k * 0.45;
      if (k === 0) {
        tl.fromTo(n, { width: N(150), scale: 0 }, { width: N(150), scale: 1.3, duration: 0.45, ease: 'back.out(2)', immediateRender: true }, at);
        tl.to(n, { width: WIDE ? W * 0.5 : W * 0.86, scale: 1, duration: 0.55 / SP, ease: 'expo.inOut' }, at + 0.45);
        tl.from(tx, { opacity: 0, x: N(30), duration: 0.4 }, at + 0.75);
      } else {
        n.style.width = (WIDE ? W * 0.5 : W * 0.86) + 'px';
        tl.from(n, { y: -N(200), opacity: 0, scale: 0.9, duration: 0.55, ease: 'expo.out' }, at + 0.6);
      }
    });
    idle(bi, b, 0.03);
  };

  SHOTS.stat = (b, bi) => {
    const box = el('div', 'fitbox col center', bi);
    const slab = el('div', 'slab', box);
    const num = el('div', 'slab-num', slab, esc(b.number)); num.style.fontSize = FS(Math.min(260, 1000 / Math.max(2, String(b.number).length)));
    const lab = el('div', 'tx-line small', box, wordsHtml(b.text, null, false)); lab.style.fontSize = FS(sizeFor(b.text, 1700, 48, 84));
    tl.from(slab, { rotationX: 60, rotationY: -30, scale: 0.4, opacity: 0, duration: 0.9 / SP, ease: 'expo.out' }, b.in);
    tl.from(num, { scale: 2.2, opacity: 0, filter: 'blur(' + N(20) + 'px)', duration: 0.5, ease: 'expo.out' }, b.in + 0.3);
    textEnter(lab, b.in + 0.5, 'rise');
    floaty(slab, b, 10, 0);
    if (ENERGY >= 3) shake(b.in + 0.45, 14);
  };

  SHOTS.lockup = (b, bi) => {
    const box = el('div', 'fitbox col center lockup' + (WIDE ? ' row' : ''), bi);
    const top = el('div', 'lk-top', box);
    const m = mark(top, WIDE ? 220 : 240);
    const div = el('i', 'lk-div', top);
    const txt = el('div', 'lk-text', top);
    const t = el('div', 'tx-line', txt, wordsHtml(b.text, null, TH.accentStyle === 'marker')); t.style.fontSize = FS(sizeFor(b.text, 2000, 66, 124));
    (b.subs || []).forEach((s) => { const x = el('div', 'tx-sub', txt, esc(s)); x.style.fontSize = FS(42); });
    let btn = null;
    if (b.button) btn = el('div', 'cta-btn', box, icon(/whatsapp|chat|order/i.test(b.button + ' ' + (b.text || '')) ? 'chat' : 'phone') + '<span>' + esc(b.button) + '</span>');
    if (btn) btn.style.fontSize = FS(WIDE ? 50 : 58);
    tl.from(m, { scale: 0, rotation: -90, duration: 0.6, ease: 'back.out(1.8)' }, b.in);
    tl.from(div, { [WIDE ? 'scaleY' : 'scaleX']: 0, duration: 0.5, ease: 'expo.inOut' }, b.in + 0.3);
    textEnter(t, b.in + 0.45, 'rise');
    tl.from($$('.tx-sub', txt), { y: N(30), opacity: 0, duration: 0.45, stagger: 0.08 }, b.in + 0.7);
    if (btn) {
      const q = Math.min(1, Math.max(0.45, (b.t1 - b.in - 0.6) / 1.9));   // short final beats play the click faster
      tl.from(btn, { scale: 0, y: N(60), duration: 0.55 * q, ease: 'back.out(2)' }, b.in + 0.6 * q);
      const cur = el('div', 'cursor-arrow', box, '<svg viewBox="0 0 24 24"><path d="M4 2l15 9-7 1.5L8.5 20z"/></svg>');
      const ring = el('i', 'click-ring', btn);
      const tap = b.in + 1.35 * q, room = DURATION - tap;
      tl.fromTo(cur, { x: W * 0.45, y: H * 0.45, opacity: 0 }, { x: N(60), y: N(30), opacity: 1, duration: 0.6 * q, ease: 'expo.inOut', immediateRender: true }, b.in + 0.75 * q);
      tl.to(btn, { scale: 0.9, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.inOut' }, tap);
      sfx(b.in + 0.6 * q, 'pop', 0.6); sfx(tap, 'click', 0.9);
      tl.fromTo(ring, { scale: 0.6, opacity: 0.9 }, { scale: 2.2, opacity: 0, duration: Math.max(0.2, Math.min(0.7, room - 0.05)), ease: 'power2.out', immediateRender: false }, tap);
      if (room > 1.0) tl.to(cur, { opacity: 0, y: '+=' + N(40), duration: 0.4 }, tap + 0.5);
      const n = Math.floor((b.t1 - tap - 0.8) / 0.9);
      if (n >= 1) tl.to(btn, { scale: 1.06, duration: 0.45, yoyo: true, repeat: n * 2 - 1, ease: 'sine.inOut' }, tap + 0.6);
      // place the cursor over the button (layout is final once fonts load)
      const placeCursor = () => { cur.style.left = (btn.offsetLeft + btn.offsetWidth * 0.55) + 'px'; cur.style.top = (btn.offsetTop + btn.offsetHeight * 0.45) + 'px'; };
      placeCursor(); afterFonts.push(placeCursor);
    }
  };



  // The brand logo, big and centred: rings pulse out behind it while it lands. A "dive" cut after this beat
  // flies the camera straight into the logo.
  SHOTS.logo = (b, bi) => {
    const box = el('div', 'fitbox col center lg-wrap', bi);
    const size = Math.min(WIDE ? 520 : 560, (Math.min(W, H) / U) * (WIDE ? 0.5 : 0.52));
    const ringBox = el('div', 'lg-rings', box); ringBox.style.width = N(size) + 'px'; ringBox.style.height = N(size) + 'px';
    for (let k = 0; k < 3; k++) {
      const r = el('i', 'lg-ring', ringBox);
      tl.fromTo(r, { scale: 0.6, opacity: 0.7 }, { scale: 1.9 + k * 0.35, opacity: 0, duration: 1.3, ease: 'power2.out', immediateRender: false }, b.in + 0.25 + k * 0.18);
    }
    const m = mark(ringBox, size * 0.78); m.classList.add('lg-mark');
    tl.fromTo(m, { scale: 0, rotation: -25, filter: 'blur(' + N(20) + 'px)' }, { scale: 1, rotation: 0, filter: 'blur(0px)', duration: 0.8 / SP, ease: 'back.out(1.6)', immediateRender: true }, b.in);
    tl.fromTo(m, { scale: 1 }, { scale: 1.08, duration: Math.max(0.4, b.t1 - b.in - 0.8), ease: 'none', immediateRender: false }, b.in + 0.8);
    if (b.text) {
      const t = el('div', 'tx-line lg-name', box, wordsHtml(b.text, null, TH.accentStyle === 'marker'));
      t.style.fontSize = FS(Math.min(110, sizeFor(b.text, 2000, 60, 120)));
      textEnter(t, b.in + 0.55, TH.textIn === 'focus' ? 'focus' : 'rise');
    }
    if (b.sub) { const sb = el('div', 'tx-sub', box, esc(b.sub)); sb.style.fontSize = FS(40); tl.from(sb, { opacity: 0, y: N(20), duration: 0.5 }, b.in + 0.85); }
    burstDots(ringBox, b.in + 0.5, 14, size * 0.75);
  };

  // ------------------------------------------------------------------ premium (Apple-style) shots
  // Small clean type, lots of space, UI pieces that morph. Sizes here are absolute (not textScale'd).
  const focusFrom = (amt) => ({ opacity: 0, y: N(amt || 26), filter: 'blur(' + N(14) + 'px)' });

  // A sentence that builds word by word; the key word's letters drop into place.
  SHOTS.sentence = (b, bi) => {
    const box = el('div', 'fitbox col center sent', bi);
    const words = String(b.text).split(/\s+/).filter(Boolean);
    const ai = b.accent == null ? (words.length >= 2 ? words.length - 1 : -1) : b.accent;
    const line = el('div', 'sent-line', box);
    line.style.fontSize = FS(sizeRaw(b.text, 2200, 62, 124));
    const avail = Math.max(0.6, b.t1 - b.in);
    const gap = Math.min(0.2, (avail * 0.42) / Math.max(1, words.length)) / SP;
    words.forEach((w, k) => {
      const acc = k === ai;
      const sw = el('span', 'sw' + (acc ? ' acc' : ''), line);
      if (acc) {
        sw.innerHTML = '<span class="wi">' + Array.from(w).map((c) => '<span class="sl">' + esc(c) + '</span>').join('') + '</span>';
        const ls = $$('.sl', sw);
        tl.from(ls, { opacity: 0, y: (i) => (i % 2 ? 1 : -1) * N(R(30, 60)), rotation: () => R(-18, 18), duration: 0.55 / SP, stagger: 0.035 / SP, ease: 'back.out(2.2)' }, b.in + k * gap);
      } else {
        sw.innerHTML = '<span class="wi">' + esc(w) + '</span>';
        tl.from(sw, Object.assign(focusFrom(), { duration: 0.55 / SP, ease: 'power3.out' }), b.in + k * gap);
      }
      if (k < words.length - 1) line.appendChild(document.createTextNode(' '));
    });
    if (b.sub) { const sb = el('div', 'tx-sub', box, esc(b.sub)); sb.style.fontSize = FS(36); tl.from(sb, Object.assign(focusFrom(16), { duration: 0.6 }), b.in + words.length * gap + 0.25); }
    tl.fromTo(line, { rotation: b.tilt || 0 }, { rotation: 0, duration: Math.max(0.5, avail), ease: 'power1.out', immediateRender: false }, b.t0);
    idle(bi, b, 0.06);
  };

  // Words appear one at a time in the centre, each replacing the last ("Introducing" / "iPhone" / "13").
  SHOTS.flip = (b, bi) => {
    const words = String(b.text).split(/\s+/).filter(Boolean);
    const chunks = []; for (let k = 0; k < words.length;) { const take = words.length <= 4 ? 1 : 2; chunks.push(words.slice(k, k + take).join(' ')); k += take; }
    const box = el('div', 'fitbox flip', bi);
    const avail = Math.max(0.6, b.t1 - b.in);
    const step = Math.min(0.6, (avail * 0.62) / chunks.length) / SP;
    chunks.forEach((c, k) => {
      const last = k === chunks.length - 1;
      const e = el('div', 'flip-c' + (last ? ' acc' : ''), box, esc(c));
      e.style.fontSize = FS(sizeRaw(c, 1400, 72, last ? 160 : 130));
      const at = b.in + k * step;
      tl.fromTo(e, Object.assign(focusFrom(30), { scale: 0.92 }), { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: Math.min(0.4, step * 0.8), ease: 'power3.out', immediateRender: true }, at);
      if (!last) tl.to(e, { opacity: 0, y: -N(24), filter: 'blur(' + N(10) + 'px)', duration: Math.min(0.22, step * 0.4), ease: 'power2.in' }, at + step - Math.min(0.22, step * 0.4));
      else tl.to(e, { scale: 1.06, duration: Math.max(0.3, b.t1 - at - 0.4), ease: 'none' }, at + 0.4);
    });
  };

  // Words start scattered round the frame, then fly together into one line.
  SHOTS.scatter = (b, bi) => {
    const words = String(b.text).split(/\s+/).filter(Boolean);
    const box = el('div', 'fitbox col center', bi);
    const line = el('div', 'sent-line', box);
    line.style.fontSize = FS(sizeRaw(b.text, 2200, 62, 124));
    const ws = words.map((w, k) => { const e = el('span', 'sw' + (k === words.length - 1 && words.length > 1 ? ' acc' : ''), line, '<span class="wi">' + esc(w) + '</span>'); if (k < words.length - 1) line.appendChild(document.createTextNode(' ')); return e; });
    const gather = b.in + Math.min(0.9, 0.18 * words.length + 0.35) / SP;
    ws.forEach((e, k) => {
      const side = k < (words.length - 1) / 2 ? 1 : -1;   // left words cross to the right and vice versa, so nothing leaves the frame
      const ox = side * R(W * 0.05, W * 0.18), oy = (k % 3 - 1 || (k % 2 ? 1 : -1)) * R(H * 0.06, H * (WIDE ? 0.24 : 0.16));
      tl.fromTo(e, { x: ox, y: oy, scale: R(0.7, 1.3), opacity: 0, filter: 'blur(' + N(16) + 'px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.35, ease: 'power2.out', immediateRender: true }, b.in + k * 0.12 / SP);
      tl.to(e, { x: 0, y: 0, scale: 1, duration: 0.7 / SP, ease: 'expo.inOut' }, gather + k * 0.03);
    });
    if (b.sub) { const sb = el('div', 'tx-sub', box, esc(b.sub)); sb.style.fontSize = FS(36); tl.from(sb, Object.assign(focusFrom(16), { duration: 0.5 }), gather + 0.6); }
  };

  // Watch-style widget tiles: the middle one pops, the others slide out from behind it, rings fill.
  SHOTS.widgets = (b, bi) => {
    const items = (b.items || []).slice(0, 3);
    const box = el('div', 'fitbox col center', bi);
    if (b.title) { const t = el('div', 'sent-line small', box, esc(b.title)); t.style.fontSize = FS(48); tl.from(t, Object.assign(focusFrom(), { duration: 0.5 }), b.in); }
    const row = el('div', 'wg-row', box);
    const tw = WIDE ? 340 : 300, gap = 30, m = Math.floor(items.length / 2);
    items.forEach((it, k) => {
      const t = el('div', 'wg' + (k === m ? ' hero' : ''), row);
      t.style.width = N(tw) + 'px'; t.style.height = N(tw * 1.12) + 'px';
      el('div', 'wg-top', t, '<i></i><span>' + esc(it.text || it.name || '') + '</span>');
      const C = 2 * Math.PI * 15.5, pct = R(0.62, 0.94);
      const ring = el('div', 'wg-ring', t, '<svg viewBox="0 0 36 36"><circle class="wg-rb" cx="18" cy="18" r="15.5"/><circle class="wg-r" cx="18" cy="18" r="15.5" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + C.toFixed(2) + '"/></svg>' + icon(it.icon || 'sparkle'));
      const val = it.price != null ? '₦' + fmt(it.price) : (it.value || '');
      if (val) el('div', 'wg-val', t, esc(val));
      const at = b.in + 0.15;
      if (k === m) {
        tl.fromTo(t, { scale: 0, opacity: 0 }, { scale: 1.18, opacity: 1, duration: 0.5 / SP, ease: 'back.out(1.8)', immediateRender: true }, at);
        tl.to(t, { scale: 1, duration: 0.5, ease: 'expo.inOut' }, at + 0.55);
      } else {
        tl.fromTo(t, { x: (m - k) * N(tw + gap), scale: 0.6, opacity: 0 }, { x: 0, scale: 1, opacity: 1, duration: 0.6 / SP, ease: 'expo.inOut', immediateRender: true }, at + 0.55);
      }
      tl.to($('.wg-r', ring), { attr: { 'stroke-dashoffset': (C * (1 - pct)).toFixed(2) }, duration: 1.0, ease: 'power3.out' }, at + 0.7 + k * 0.08);
    });
    floaty(row, b, 8, 0);
  };

  // An app icon opens into a widget card (title, detail, progress bar), then folds back into the icon.
  SHOTS.iconmorph = (b, bi) => {
    const box = el('div', 'fitbox im', bi);
    const sq = 250, cw = Math.min(N(880), W * (WIDE ? 0.5 : 0.84));
    const card = el('div', 'im-box', box);
    card.style.height = N(sq) + 'px'; card.style.width = N(sq) + 'px'; card.style.paddingLeft = N((sq - 150) / 2) + 'px';
    const ic = el('div', 'im-ic', card, icon(b.icon || 'sparkle'));
    const tx = el('div', 'im-tx', card);
    tx.style.width = (cw - N(sq)) + 'px';
    const t = el('div', 'im-title', tx, esc(b.text)); t.style.fontSize = FS(Math.min(56, 1400 / Math.max(10, String(b.text).length)));
    if (b.sub) { const sb = el('div', 'im-sub', tx, esc(b.sub)); sb.style.fontSize = FS(38); }
    const bar = el('div', 'im-bar', tx, '<i></i>');
    const L = b.t1 - b.in;
    tl.fromTo(card, { scale: 0, rotation: -12 }, { scale: 1, rotation: 0, duration: 0.5 / SP, ease: 'back.out(2)', immediateRender: true }, b.in);
    tl.to(card, { width: cw, duration: 0.6 / SP, ease: 'expo.inOut' }, b.in + 0.6);
    tl.from(tx.children, { opacity: 0, x: N(30), duration: 0.4, stagger: 0.08 }, b.in + 0.95);
    tl.fromTo($('i', bar), { scaleX: 0 }, { scaleX: R(0.6, 0.85), duration: 0.9, ease: 'power3.out', immediateRender: true }, b.in + 1.15);
    if (L > 2.9) {
      const back = b.t1 - 0.95;
      tl.to(tx, { opacity: 0, duration: 0.2 }, back);
      tl.to(card, { width: N(sq), duration: 0.45, ease: 'expo.inOut' }, back + 0.1);
      tl.to(ic, { scale: 1.3, duration: 0.35, ease: 'back.out(3)' }, back + 0.5);
      tl.to(card, { boxShadow: '0 0 ' + N(90) + 'px ' + N(10) + 'px color-mix(in srgb, var(--primary) 45%, transparent)', duration: 0.35 }, back + 0.5);
    }
  };

  // A glowing card floating over an isometric platform, which flips flat and becomes a stat tile.
  SHOTS.isocard = (b, bi) => {
    const box = el('div', 'fitbox iso', bi);
    const pw = Math.min(N(WIDE ? 640 : 700), W * 0.66);
    const scene = el('div', 'iso-scene', box);
    scene.style.width = pw + 'px'; scene.style.height = pw * 0.72 + 'px';
    const pa = el('div', 'iso-pl a', scene), pb = el('div', 'iso-pl b', scene);
    const card = el('div', 'iso-card', scene);
    const face = el('div', 'iso-face', card); mark(face, 90); el('i', 'iso-dots', face);
    const stat = el('div', 'iso-stat', card);
    const big = b.number || (b.price != null ? '₦' + fmt(b.price) : '');
    if (big) { const nm = el('div', 'iso-num', stat, esc(big)); nm.style.fontSize = FS(Math.min(130, 760 / Math.max(3, String(big).length))); }
    if (b.text) { const lb = el('div', 'iso-lab', stat, esc(b.text)); lb.style.fontSize = FS(Math.min(44, 1100 / Math.max(10, String(b.text).length))); }
    gsap.set(scene, { rotationX: 56, rotationZ: -36 });
    tl.fromTo(scene, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8 / SP, ease: 'expo.out', immediateRender: true }, b.in);
    tl.fromTo(card, { z: N(10) }, { z: N(120), duration: 0.9, ease: 'expo.out', immediateRender: true }, b.in + 0.2);
    tl.from([pa, pb], { scale: 0.7, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'expo.out' }, b.in);
    const flat = b.in + Math.min(1.4, (b.t1 - b.in) * 0.45);
    tl.to(scene, { rotationX: 0, rotationZ: 0, duration: 0.8 / SP, ease: 'expo.inOut' }, flat);
    tl.to(card, { z: 0, duration: 0.8, ease: 'expo.inOut' }, flat);
    tl.to([pa, pb], { opacity: 0, scale: 1.3, duration: 0.5, ease: 'power2.in' }, flat);
    tl.to(face, { opacity: 0, duration: 0.3 }, flat + 0.35);
    tl.fromTo(stat, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)', immediateRender: true }, flat + 0.5);
  };

  // Brand mark + caret + a list that ticks upward, the active line glowing.
  SHOTS.ticker = (b, bi) => {
    const items = (b.items || []).slice(0, 6);
    const box = el('div', 'fitbox tk', bi);
    const rh = 104, ms = 140;
    const m = mark(box, ms); m.style.marginTop = N(rh / 2 - ms / 2) + 'px';
    const caret = el('div', 'tk-caret', box, '<svg viewBox="0 0 10 10"><path d="M2 1l6 4-6 4z"/></svg>'); caret.style.height = N(rh) + 'px';
    const vp = el('div', 'tk-vp', box); vp.style.height = N(rh * Math.min(4, items.length)) + 'px';
    const list = el('div', 'tk-list', vp);
    const rows = items.map((it) => { const r = el('div', 'tk-row', list, '<span class="tk-off">' + esc(it.text || it.name) + '</span><span class="tk-on">' + esc(it.text || it.name) + '</span>'); r.style.height = N(rh) + 'px'; r.style.fontSize = FS(64); return r; });
    tl.from(m, { scale: 0, rotation: -90, duration: 0.55, ease: 'back.out(2)' }, b.in);
    tl.from(caret, { opacity: 0, x: -N(20), duration: 0.35 }, b.in + 0.3);
    tl.from(rows, Object.assign(focusFrom(30), { duration: 0.45, stagger: 0.06 }), b.in + 0.35);
    const start = b.in + 0.8, step = Math.max(0.35, (b.t1 - start - 0.5) / Math.max(1, items.length));
    rows.forEach((r, k) => {
      const at = start + k * step;
      tl.fromTo($('.tk-on', r), { opacity: 0 }, { opacity: 1, duration: 0.25, immediateRender: true }, at);
      if (k > 0) {
        tl.to(list, { y: -N(rh * k), duration: 0.45 / SP, ease: 'expo.inOut' }, at - 0.1);
        tl.to($('.tk-on', rows[k - 1]), { opacity: 0, duration: 0.2 }, at - 0.1);
      }
    });
  };

  // A ring of photos / icon tiles drifting round a short line of text.
  SHOTS.collage = (b, bi) => {
    const center = el('div', 'fitbox col center coll-c', bi);
    const t = el('div', 'sent-line', center, wordsHtml(b.text, null, false)); t.style.fontSize = FS(sizeRaw(b.text, 1500, 50, 90));
    textEnter(t, b.in + 0.45, 'focus');
    const ring = el('div', 'coll', bi);
    const imgs = (b.imgs || []).slice(0, 8);
    const extra = ['sparkle', 'heart', 'star', 'check', 'gift', 'bolt', 'sun', 'trophy'];
    const tiles = imgs.length >= 4 ? imgs.map((u) => ({ img: u })) : [...(b.items || []).map((it) => ({ icon: it.icon })), ...extra.map((x) => ({ icon: x }))].slice(0, 10);
    const n = tiles.length, rx = WIDE ? W * 0.36 : W * 0.38, ry = WIDE ? H * 0.34 : H * 0.24;
    tiles.forEach((it, k) => {
      const a = (k / n) * Math.PI * 2 + R(-0.15, 0.15), sz = N(R(WIDE ? 150 : 170, WIDE ? 220 : 250));
      const e = el('div', 'coll-t c' + (k % 3) + (it.img ? ' photo' : ''), ring, it.img ? '<img src="' + esc(it.img) + '" crossorigin="anonymous" alt="">' : icon(it.icon));
      e.style.width = sz + 'px'; e.style.height = sz + 'px'; e.style.marginLeft = -sz / 2 + 'px'; e.style.marginTop = -sz / 2 + 'px';
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry, rot = R(-14, 14);
      tl.fromTo(e, { x: x * 0.3, y: y * 0.3, scale: 0, rotation: rot - 40, opacity: 0 }, { x, y, scale: 1, rotation: rot, opacity: 1, duration: 0.7 / SP, ease: 'back.out(1.5)', immediateRender: true }, b.in + k * 0.05);
      tl.to(e, { x: x * 1.12, y: y * 1.12, rotation: rot + R(-8, 8), duration: Math.max(0.5, b.t1 - b.in - 0.8), ease: 'none' }, b.in + 0.8 + k * 0.05);
    });
  };

  // Buttons stacking upward, each one rising from behind the last.
  SHOTS.stack = (b, bi) => {
    const items = (b.items || []).slice(0, 4);
    const box = el('div', 'fitbox col center stk-wrap', bi);
    if (b.title) { const t = el('div', 'sent-line small', box, esc(b.title)); t.style.fontSize = FS(48); tl.from(t, Object.assign(focusFrom(), { duration: 0.5 }), b.in); }
    const col = el('div', 'stk', box);
    const els = items.slice().reverse().map((it) => { const e = el('div', 'stk-b', col, '<span>' + esc(it.text || it.name) + '</span>' + (it.price != null ? '<b>₦' + fmt(it.price) + '</b>' : '')); e.style.fontSize = FS(54); return e; }).reverse();
    const step = Math.min(0.45, (b.t1 - b.in - 0.8) / Math.max(1, els.length)) / SP;
    els.forEach((e, k) => {
      const at = b.in + 0.1 + k * step;
      if (k === 0) tl.fromTo(e, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)', immediateRender: true }, at);
      else tl.fromTo(e, { y: N(110), rotationX: -70, scale: 0.85, opacity: 0 }, { y: 0, rotationX: 0, scale: 1, opacity: 1, duration: 0.55 / SP, ease: 'expo.out', immediateRender: true }, at);
    });
    floaty(col, b, 8, 0);
  };

  // A chat: the message is typed into the input bar, sent, and the business replies.
  SHOTS.chat = (b, bi) => {
    const cw = Math.min(N(940), W * (WIDE ? 0.55 : 0.88));
    const box = el('div', 'fitbox chat', bi); box.style.width = cw + 'px';
    const area = el('div', 'chat-area', box);
    const bar = el('div', 'chat-bar', box);
    el('i', 'chat-plus', bar, '+');
    const field = el('div', 'chat-field', bar);
    const chars = Array.from(String(b.text));
    field.innerHTML = chars.map((c) => '<span class="ch">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>').join('') + '<i class="chat-caret"></i>';
    field.style.fontSize = FS(48);
    const send = el('div', 'chat-send', bar, '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>');
    const me = el('div', 'bub me', area, esc(b.text)); me.style.fontSize = FS(50);
    let dots = null, them = null;
    if (b.sub) { dots = el('div', 'bub them dots', area, '<i></i><i></i><i></i>'); them = el('div', 'bub them', area, esc(b.sub)); them.style.fontSize = FS(50); }
    tl.from(bar, { y: N(80), opacity: 0, duration: 0.5, ease: 'expo.out' }, b.in);
    const each = Math.min(0.04, (b.t1 - b.in) * (b.sub ? 0.18 : 0.3) / chars.length) / SP;
    tl.from($$('.ch', field), { opacity: 0, duration: 0.01, stagger: each, ease: 'none' }, b.in + 0.35);
    const sent = b.in + 0.45 + each * chars.length;
    for (let k = 0; k < chars.length; k += 4) sfx(b.in + 0.35 + each * k, 'tick', 0.25);
    sfx(sent, 'send', 0.8); if (b.sub) sfx(sent + 0.85, 'ding', 0.6);
    tl.to(send, { scale: 0.8, duration: 0.1, yoyo: true, repeat: 1 }, sent);
    tl.to(field, { opacity: 0, duration: 0.12 }, sent + 0.1);
    tl.fromTo(me, { y: N(150), scale: 0.6, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.6)', immediateRender: true }, sent + 0.1);
    if (b.sub) {
      tl.fromTo(dots, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(2)', immediateRender: true }, sent + 0.4);
      tl.to($$('i', dots), { y: -N(8), duration: 0.15, stagger: 0.06, yoyo: true, repeat: 1, ease: 'sine.inOut' }, sent + 0.45);
      tl.to(dots, { scale: 0, opacity: 0, height: 0, padding: 0, margin: 0, duration: 0.15 }, sent + 0.8);
      tl.fromTo(them, { scale: 0.6, opacity: 0, x: -N(40) }, { scale: 1, opacity: 1, x: 0, duration: 0.45, ease: 'back.out(1.6)', immediateRender: true }, sent + 0.85);
    }
  };

  // ------------------------------------------------------------------ transitions between beats
  // Every cut: the outgoing beat LEAVES during [T-d, T], the incoming beat ARRIVES during [T, T+d2].
  function exitBeat(bt, type, T, d) {
    const bx = bt.bx, fe = bt.fe, s = T - d;
    switch (type) {
      case 'whip': tl.to(bx, { x: -W * 0.8, duration: d, ease: 'power3.in' }, s); tl.to(fe, { attr: { stdDeviation: N(80) + ' 0' }, duration: d, ease: 'power2.in' }, s); break;
      case 'rise': tl.to(bx, { y: -H * 0.7, duration: d, ease: 'power3.in' }, s); tl.to(fe, { attr: { stdDeviation: '0 ' + N(80) }, duration: d, ease: 'power2.in' }, s); break;
      case 'zoom': tl.to(bx, { scale: 3.4, opacity: 0, duration: d, ease: 'power3.in' }, s); tl.to(fe, { attr: { stdDeviation: N(24) + ' ' + N(24) }, duration: d, ease: 'power2.in' }, s); break;
      case 'morph': tl.to(bx, { scale: 0.06, opacity: 0, duration: d, ease: 'power2.in' }, s); break;
      case 'line': tl.to(bx, { x: -W * 0.5, y: H * 0.15, opacity: 0, duration: d, ease: 'power3.in' }, s); tl.to(fe, { attr: { stdDeviation: N(50) + ' ' + N(10) }, duration: d, ease: 'power2.in' }, s); break;
      case 'wipe': tl.to(bx, { x: -W * 0.3, duration: d, ease: 'power2.in' }, s); break;
      case 'swoosh': tl.to(bx, { x: -W * 0.3, y: -H * 0.06, rotation: -7, opacity: 0, duration: d, ease: 'power3.in' }, s); tl.to(fe, { attr: { stdDeviation: N(40) + ' ' + N(12) }, duration: d, ease: 'power2.in' }, s); break;
      case 'dive':
        tl.to(bx, { scale: 18, duration: d, ease: 'power4.in', transformOrigin: () => diveOrigin(bt) }, s);
        tl.to(bx, { opacity: 0, duration: d * 0.3, ease: 'none' }, T - d * 0.3); break;
      case 'focus': tl.to(bx, { opacity: 0, scale: 1.05, duration: d, ease: 'power2.in' }, s); tl.to(fe, { attr: { stdDeviation: N(30) + ' ' + N(30) }, duration: d, ease: 'power2.in' }, s); break;
      default: tl.to(bx, { scale: 1.3, opacity: 0, duration: d, ease: 'power2.in' }, s); // flash
    }
  }
  function enterBeat(bt, type, T, d) {
    const bx = bt.bx, fe = bt.fe, o = { immediateRender: false };
    switch (type) {
      case 'whip':
        tl.fromTo(bx, { x: W * 0.8 }, Object.assign({ x: 0, duration: d, ease: 'expo.out' }, o), T);
        tl.fromTo(fe, { attr: { stdDeviation: N(80) + ' 0' } }, Object.assign({ attr: { stdDeviation: '0 0' }, duration: d * 0.9, ease: 'power2.out' }, o), T); break;
      case 'rise':
        tl.fromTo(bx, { y: H * 0.7 }, Object.assign({ y: 0, duration: d, ease: 'expo.out' }, o), T);
        tl.fromTo(fe, { attr: { stdDeviation: '0 ' + N(80) } }, Object.assign({ attr: { stdDeviation: '0 0' }, duration: d * 0.9, ease: 'power2.out' }, o), T); break;
      case 'zoom':
        tl.fromTo(bx, { scale: 0.35, opacity: 0 }, Object.assign({ scale: 1, opacity: 1, duration: d, ease: 'expo.out' }, o), T);
        tl.fromTo(fe, { attr: { stdDeviation: N(20) + ' ' + N(20) } }, Object.assign({ attr: { stdDeviation: '0 0' }, duration: d * 0.8, ease: 'power2.out' }, o), T); break;
      case 'morph':
        tl.fromTo(bx, { scale: 0.1, opacity: 0 }, Object.assign({ scale: 1, opacity: 1, duration: d, ease: 'back.out(1.4)' }, o), T + 0.1); break;
      case 'line':
        tl.fromTo(bx, { x: W * 0.5, y: -H * 0.15, opacity: 0 }, Object.assign({ x: 0, y: 0, opacity: 1, duration: d, ease: 'expo.out' }, o), T);
        tl.fromTo(fe, { attr: { stdDeviation: N(50) + ' ' + N(10) } }, Object.assign({ attr: { stdDeviation: '0 0' }, duration: d * 0.8, ease: 'power2.out' }, o), T); break;
      case 'wipe':
        tl.fromTo(bx, { x: W * 0.3 }, Object.assign({ x: 0, duration: d, ease: 'expo.out' }, o), T); break;
      case 'swoosh':
        tl.fromTo(bx, { x: W * 0.3, y: H * 0.06, rotation: 7, opacity: 0 }, Object.assign({ x: 0, y: 0, rotation: 0, opacity: 1, duration: d, ease: 'expo.out' }, o), T);
        tl.fromTo(fe, { attr: { stdDeviation: N(40) + ' ' + N(12) } }, Object.assign({ attr: { stdDeviation: '0 0' }, duration: d * 0.85, ease: 'power2.out' }, o), T); break;
      case 'dive':
        tl.fromTo(bx, { scale: 0.5, opacity: 0 }, Object.assign({ scale: 1, opacity: 1, duration: d, ease: 'expo.out' }, o), T);
        tl.fromTo(fe, { attr: { stdDeviation: N(22) + ' ' + N(22) } }, Object.assign({ attr: { stdDeviation: '0 0' }, duration: d * 0.8, ease: 'power2.out' }, o), T); break;
      case 'focus':
        tl.fromTo(bx, { opacity: 0, scale: 0.96 }, Object.assign({ opacity: 1, scale: 1, duration: d, ease: 'power2.out' }, o), T);
        tl.fromTo(fe, { attr: { stdDeviation: N(30) + ' ' + N(30) } }, Object.assign({ attr: { stdDeviation: '0 0' }, duration: d, ease: 'power2.out' }, o), T); break;
      default:
        tl.fromTo(bx, { scale: 0.85 }, Object.assign({ scale: 1, duration: d, ease: 'expo.out' }, o), T);
    }
  }
  // zoom-into-a-word: the camera dives into the key word of the outgoing beat
  function diveOrigin(bt) {
    const t = bt.bi.querySelector('.lg-mark') || bt.bi.querySelector('.mark.logo') || bt.bi.querySelector('.acc .wi, .acc, .flip-c.acc, .wi, .tx-line, .fitbox');
    if (!t) return '50% 50%';
    const r = t.getBoundingClientRect(), rb = bt.bx.getBoundingClientRect();
    if (!rb.width || !rb.height) return '50% 50%';
    return ((r.left + r.width * 0.5 - rb.left) / rb.width * 100).toFixed(2) + '% ' + ((r.top + r.height * 0.55 - rb.top) / rb.height * 100).toFixed(2) + '%';
  }
  function cutFx(type, T, d, k) {
    if (type === 'swoosh') {
      const s = document.createElementNS(svgNS, 'svg'); s.setAttribute('class', 'fx-swoosh'); s.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      const flip = k % 2 ? -1 : 1, y = (f) => H * (0.5 + (f - 0.5) * flip);
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M ' + (-W * 0.15) + ' ' + y(0.82) + ' C ' + W * 0.25 + ' ' + y(1.02) + ', ' + W * 0.42 + ' ' + y(0.12) + ', ' + W * 0.68 + ' ' + y(0.36) + ' S ' + W * 1.0 + ' ' + y(0.72) + ', ' + W * 1.2 + ' ' + y(0.2));
      s.appendChild(path); fx.appendChild(s);
      const len = Math.hypot(W, H) * 2.4;
      path.setAttribute('stroke-dasharray', len + ' ' + len); path.setAttribute('stroke-dashoffset', String(len));
      tl.set(s, { autoAlpha: 1 }, T - d);
      tl.to(path, { attr: { 'stroke-dashoffset': 0 }, duration: d + 0.15, ease: 'power2.inOut' }, T - d);
      tl.to(path, { attr: { 'stroke-dashoffset': -len }, duration: 0.5, ease: 'power2.in' }, T + 0.1);
      tl.set(s, { autoAlpha: 0 }, FT(T + 0.62));
      return;
    }
    if (type === 'morph') {
      const dot = el('div', 'fx-dot', fx);
      // the outgoing beat collapses INTO the dot, the dot pops, then the incoming beat grows out of it
      tl.fromTo(dot, { scale: 0, autoAlpha: 1 }, { scale: 1, duration: 0.09, ease: 'power2.out', immediateRender: true }, T - 0.07);
      tl.to(dot, { scale: 0, autoAlpha: 0, duration: 0.14, ease: 'power2.in' }, T + 0.03);
    } else if (type === 'line') {
      const s = document.createElementNS(svgNS, 'svg'); s.setAttribute('class', 'fx-line'); s.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      const y0 = H * R(0.3, 0.7), y1 = H * R(0.2, 0.8);
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M ' + (-W * 0.1) + ' ' + y0 + ' C ' + W * 0.3 + ' ' + (y0 - H * 0.25) + ', ' + W * 0.7 + ' ' + (y1 + H * 0.25) + ', ' + W * 1.1 + ' ' + y1);
      s.appendChild(path); fx.appendChild(s);
      const len = W * 1.6;
      path.setAttribute('stroke-dasharray', String(len)); path.setAttribute('stroke-dashoffset', String(len));
      tl.set(s, { autoAlpha: 1 }, T - d);
      tl.to(path, { attr: { 'stroke-dashoffset': 0 }, duration: d + 0.05, ease: 'power3.inOut' }, T - d);
      tl.to(path, { attr: { 'stroke-dashoffset': -len }, duration: 0.4, ease: 'power3.in' }, T + 0.05);
      tl.set(s, { autoAlpha: 0 }, FT(T + 0.46));
    } else if (type === 'wipe') {
      const p1 = el('div', 'fx-wipe a', fx), p2 = el('div', 'fx-wipe b', fx);
      tl.fromTo(p2, { xPercent: 110 }, { xPercent: 0, duration: d, ease: 'power3.in', immediateRender: true }, T - d);
      tl.fromTo(p1, { xPercent: 110 }, { xPercent: 0, duration: d * 0.85, ease: 'power3.in', immediateRender: true }, T - d * 0.85);
      tl.to([p1, p2], { xPercent: -115, duration: 0.42, ease: 'power3.out', stagger: 0.05 }, T);
    } else if (type === 'flash') {
      const f = el('div', 'fx-flash', fx);
      tl.fromTo(f, { opacity: 0 }, { opacity: 0.9, duration: 0.06, ease: 'none', immediateRender: true }, T - 0.06);
      tl.to(f, { opacity: 0, duration: 0.25 }, T);
      tl.fromTo(cam, { scale: 1.12 }, { scale: 1, duration: 0.5, ease: 'expo.out', immediateRender: false }, T);
    } else if (type === 'zoom' && ENERGY >= 2) {
      tl.fromTo(cam, { scale: 1.06 }, { scale: 1, duration: 0.6, ease: 'expo.out', immediateRender: false }, T);
    }
  }


  // Sounds for each kind of shot, at the moment its main movement lands.
  function shotSfx(b) {
    const at = b.in, n = (b.items || []).length;
    const each = (k, from, gap, vol) => { for (let j = 0; j < Math.min(n, 6); j++) sfx(from + j * gap, k, vol); };
    switch (b.shot) {
      case 'logo': sfx(at, 'impact', 0.7); sfx(at + 0.45, 'chime', 0.5); break;
      case 'brand': sfx(at, 'pop', 0.7); sfx(at + 0.7, 'chime', 0.45); break;
      case 'zoomword': sfx(at, 'zoom', 0.5); break;
      case 'kinetic': sfx(at, 'whoosh', 0.45); break;
      case 'flip': { const w = String(b.text || '').split(/\s+/).filter(Boolean); const c = w.length <= 4 ? w.length : Math.ceil(w.length / 2); const step = Math.min(0.6, ((b.t1 - at) * 0.62) / Math.max(1, c)); for (let j = 0; j < c; j++) sfx(at + j * step, 'tick', 0.5); break; }
      case 'sentence': sfx(at, 'swish', 0.35); break;
      case 'scatter': sfx(at + Math.min(0.9, 0.18 * String(b.text || '').split(/\s+/).length + 0.35), 'whoosh', 0.45); break;
      case 'words': sfx(at, 'swish', 0.3); break;
      case 'card': case 'iconmorph': sfx(at, 'pop', 0.65); sfx(at + 0.6, 'swish', 0.4); break;
      case 'notify': sfx(at + 0.45, 'ding', 0.65); for (let j = 1; j < Math.min(3, 1 + (b.subs || []).length); j++) sfx(at + j * 0.45 + 0.6, 'pop', 0.45); break;
      case 'counter': for (let j = 0; j < 4; j++) sfx(at + 0.4 + j * 0.18, 'tick', 0.25); sfx(at + 1.25, 'pop', 0.5); break;
      case 'isocard': sfx(at + 0.1, 'whoosh-low', 0.4); sfx(at + Math.min(1.4, (b.t1 - at) * 0.45) + 0.5, 'pop', 0.6); break;
      case 'stat': sfx(at + 0.3, 'pop', 0.5); break;
      case 'hero': sfx(at, 'whoosh', 0.55); break;
      case 'split': sfx(at, 'whoosh', 0.5); sfx(at + 0.4, 'pop', 0.5); break;
      case 'phone': sfx(at, 'whoosh-low', 0.5); each('tick', at + 0.55, 0.1, 0.3); break;
      case 'orbit': sfx(at, 'swish', 0.5); break;
      case 'collage': for (let j = 0; j < 6; j++) sfx(at + j * 0.05 * 2, 'pop', 0.3); break;
      case 'pills': case 'stack': case 'grid': case 'flow': case 'widgets': case 'wheel': case 'ticker':
        each('pop', at + 0.15, b.shot === 'ticker' ? Math.max(0.35, (b.t1 - at - 1.3) / Math.max(1, n)) : 0.12, 0.42); break;
      default: break;
    }
  }

  // ------------------------------------------------------------------ build
  const afterFonts = [];
  ambient();
  const beats = DATA.beats;
  beats.forEach((b, i) => {
    const bt = el('div', 'bt', cam); bt.id = 'b' + (i + 1);
    const bx = el('div', 'bx', bt); const bi = el('div', 'bi', bx);
    const fe = blurFilter('mb' + (i + 1)); fe._url = 'url(#mb' + (i + 1) + ')';   // the blur filter is switched on only while a cut moves the beat (much faster to render)
    b._el = { bt, bx, bi, fe };
    const cutIn = i > 0 ? beats[i - 1].cut : null;
    b.in = b.t0 + (cutIn ? (cutIn.type === 'morph' ? 0.12 : 0.04) : 0.08);
    (SHOTS[b.shot] || SHOTS.words)(b, bi);
    shotSfx(b);
    tl.set(bt, { autoAlpha: 1 }, b.t0);
    if (i < beats.length - 1) tl.set(bt, { autoAlpha: 0 }, b.t1);
  });
  const BLURRY = ['whip', 'rise', 'zoom', 'line', 'swoosh', 'dive', 'focus'];
  const blurWindow = (bt, from, to) => { tl.set(bt.bx, { filter: bt.fe._url }, Math.max(0, from)); tl.set(bt.bx, { filter: 'none' }, FT(to)); };
  beats.forEach((b, i) => {
    if (i === beats.length - 1 || !b.cut) return;
    const c = b.cut, d = (c.d || 0.3) / SP, nx = beats[i + 1];
    const dOut = Math.min(d, (b.t1 - b.t0) * 0.35), dIn = Math.min(0.55, (nx.t1 - nx.t0) * 0.4);
    exitBeat(b._el, c.type, b.t1, dOut);
    enterBeat(nx._el, c.type, b.t1, dIn);
    if (BLURRY.includes(c.type)) { blurWindow(b._el, b.t1 - dOut - 0.01, b.t1 + 0.01); blurWindow(nx._el, b.t1 - 0.01, b.t1 + dIn + 0.02); }
    cutFx(c.type, b.t1, d, i);
    const CUT_SND = { whip: ['whoosh', 0.6], swoosh: ['whoosh', 0.7], wipe: ['whoosh', 0.55], rise: ['whoosh-low', 0.6], line: ['whoosh-low', 0.5], zoom: ['zoom', 0.6], dive: ['zoom', 0.75], focus: ['swish', 0.7], morph: ['pop', 0.55], flash: ['swish', 0.6] }[c.type];
    if (CUT_SND) sfx(b.t1 - (c.type === 'morph' ? 0.05 : c.type === 'flash' ? 0.03 : dOut * 0.9), CUT_SND[0], CUT_SND[1]);
  });
  // slow camera drift (premium styles): the whole frame breathes and tilts a touch
  if (TH.drift) tl.fromTo(cam, { rotation: -1.4 * TH.drift }, { rotation: 1.4 * TH.drift, duration: DURATION, ease: 'sine.inOut', immediateRender: true }, 0);
  // opening punch
  tl.fromTo(cam, { scale: 1.08 }, { scale: 1, duration: 0.8, ease: 'expo.out', immediateRender: false }, 0);

  // captions (scene voiceover lines), unchanged behaviour
  (DATA.captions || []).forEach((c, k) => {
    const e = el('div', 'cap', stage, '<span>' + esc(c.text) + '</span>');
    tl.fromTo(e, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.18, ease: 'power2.out', immediateRender: false }, c.t0);
    if (!c.last) tl.to(e, { autoAlpha: 0, duration: 0.12 }, c.t1 - 0.12);
  });

  // fit: shrink any layout box that is larger than the safe area (layout sizes only, transforms ignored)
  function fit() {
    const padX = Math.min(W, H) * 0.07, padY = Math.min(W, H) * 0.08 + (DATA.captions && DATA.captions.length ? Math.min(W, H) * 0.12 : 0);
    $$('.fitbox').forEach((f) => {
      f.style.transform = '';
      let maxW = f.dataset.maxw ? Number(f.dataset.maxw) : W - padX * 2, maxH = H - padY * 2;
      if (f.classList.contains('cc')) { maxW = parseFloat(f.style.width) || maxW; maxH = parseFloat(f.style.maxHeight) || maxH; }
      if (f.classList.contains('split-text')) { maxH = WIDE ? H - padY * 2 : H * 0.5 - padY; maxW = WIDE ? W * 0.5 - padX * 1.5 : maxW; }
      let wide = f.offsetWidth;
      $$('.wd, .kin-line span, .pill, .wheel-row, .flow-card, .tile, .chip, .cta-btn, .sel, .odo, .slab, .flip-c, .tk-row, .stk-b, .wg-row, .sw', f).forEach((x) => { wide = Math.max(wide, x.offsetWidth); });
      let k = Math.min(1, maxW / Math.max(1, wide), maxH / Math.max(1, f.offsetHeight));
      // landscape: pieces designed for a phone screen are grown so they fill the wide frame
      if (k >= 1 && WIDE && !f.closest('.split-text')) k = Math.max(1, Math.min(1.5, (maxW * 0.62) / Math.max(1, wide), (maxH * 0.64) / Math.max(1, f.offsetHeight)));
      if (k < 1) f.style.transform = 'scale(' + (k * 0.97).toFixed(4) + ')';
      else if (k > 1.03) f.style.transform = 'scale(' + k.toFixed(4) + ')';
    });
    afterFonts.forEach((fn) => fn());
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  // expose the sound cues (sorted; the same sound twice within 60ms plays once)
  SFX.sort((x, y) => x.t - y.t);
  window.__sfx = SFX.filter((e, i, arr) => !arr.slice(Math.max(0, i - 4), i).some((p) => p.k === e.k && e.t - p.t < 0.06));
  tl.set({}, {}, DURATION);
  window.__timeline = tl;
})();
