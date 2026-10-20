  // ================================================================ WAVE 2: advanced scenes
  const bigWord = (parent, text, size, o) => { const l = line(parent, text, Object.assign({ size, weight: 900 }, o || {})); return l; };

  // 13. KINETIC: words slam in at different scales and angles while the camera punches through them
  SCENES.kinetic = (sc, o, t0, t1) => {
    const words = o.words || [];
    const box = el('div', 'abs', sc, '', { inset: 0 });
    const n = words.length, per = (t1 - t0 - 0.6) / Math.max(1, n);
    words.forEach((w, i) => {
      const at = t0 + 0.1 + i * per * 0.85;
      const holder = el('div', 'abs', box, '', { left: 0, right: 0, top: '50%', display: 'flex', justifyContent: 'center', transform: 'translateY(-50%)' });
      const l = line(holder, w.text, { size: w.size || 300, weight: 900, accent: w.accent ? 0 : null, track: -0.05, maxW: 980 });
      l.style.overflow = 'visible';
      const ws = $$('.tw', l);
      const rot = w.rot == null ? R(-6, 6) : w.rot;
      tl.fromTo(l, { scale: 2.8, opacity: 0, rotation: rot * 3, filter: 'blur(' + N(40) + 'px)' }, { scale: 1, opacity: 1, rotation: rot, filter: 'blur(0px)', duration: 0.34, ease: 'expo.out' }, at);
      tl.fromTo(l, { x: 0 }, { x: N(14) * (i % 2 ? 1 : -1), duration: per * 0.85, ease: 'none' }, at + 0.34);
      tl.to(l, { scale: 0.7, opacity: 0, filter: 'blur(' + N(14) + 'px)', duration: 0.18, ease: 'power3.in' }, at + per * 0.85 - 0.15);
      // ghost echoes behind
      for (let k = 1; k <= 2; k++) {
        const g = l.cloneNode(true); g.style.position = 'absolute'; g.style.left = '50%'; g.style.top = '50%'; g.style.opacity = 0; g.style.margin = 0; g.style.webkitTextFillColor = 'transparent'; g.style.webkitTextStroke = N(2) + 'px ' + P.a1; holder.appendChild(g);
        $$('.acc,.tw', g).forEach((x) => { x.style.webkitTextFillColor = 'transparent'; x.style.background = 'none'; });
        tl.fromTo(g, { xPercent: -50, yPercent: -50, scale: 1, opacity: 0.5 }, { xPercent: -50, yPercent: -50, scale: 1 + k * 0.35, opacity: 0, duration: 0.6, ease: 'power2.out' }, at + 0.28);
      }
      sfx(at, i % 2 ? 'impact' : 'hit', 0.7);
    });
    tl.fromTo(box, { scale: 1 }, { scale: 1.12, duration: t1 - t0, ease: 'none' }, t0);
  };

  // 14. TICKER: giant marquee rows slide in opposite directions around a crisp message
  SCENES.ticker = (sc, o, t0, t1) => {
    const rows = o.rows || ['FRESH', 'FAST', 'FLAVOUR'];
    const wrap = el('div', 'abs', sc, '', { inset: 0, overflow: 'hidden', transform: 'rotate(-8deg) scale(1.3)' });
    const rh = N(o.rowSize || 280);
    rows.forEach((txt, i) => {
      const r = el('div', 'abs', wrap, '', { left: 0, top: (H / 2 - (rows.length * rh) / 2 + i * rh * 1.02) + 'px', whiteSpace: 'nowrap', fontSize: rh + 'px', fontWeight: 900, letterSpacing: '-.05em', lineHeight: 1, display: 'flex', gap: rh * 0.35 + 'px' });
      const unit = (txt + ' • ').repeat(1);
      for (let k = 0; k < 8; k++) el('span', '', r, esc(unit), i % 2 ? { color: 'transparent', webkitTextStroke: N(3) + 'px ' + P.a1 } : { color: P.ink, opacity: 0.92 });
      const dir = i % 2 ? 1 : -1;
      tl.fromTo(r, { x: dir > 0 ? -W * 1.4 : -W * 0.2 }, { x: dir > 0 ? -W * 0.2 : -W * 1.4, duration: t1 - t0 + 0.6, ease: 'none' }, t0 - 0.1);
    });
    tl.fromTo(wrap, { opacity: 0 }, { opacity: 1, duration: 0.5 }, t0);
    const veil = el('div', 'abs', sc, '', { inset: 0, background: 'radial-gradient(ellipse 85% 22% at 50% 50%,var(--bg1) 0%,var(--bg1) 45%,transparent 100%)', opacity: 1 });
    tl.fromTo(wrap, { opacity: 0 }, { opacity: 0.55, duration: 0.5 }, t0 + 0.0);
    const mid = el('div', '', sc, '', { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(10) });
    (o.lines || []).forEach((L, i) => { const l = line(mid, L.text, { size: L.size || 150, accent: L.accent, maxW: 900, weight: 800, cls: L.sub ? 'sub' : '' }); tIn(l, t0 + 0.5 + i * 0.2, { kind: L.kind || 'rise' }); });
    sfx(t0 + 0.2, 'whoosh', 0.6);
  };

  // 15. CAROUSEL: 3D ring of cards rotating in space (products, menu, features)
  SCENES.carousel = (sc, o, t0, t1) => {
    col(sc, { gap: 36, pt: 0 });
    const head = line(sc, o.title || '', { size: o.titleSize || 96, accent: o.accent, maxW: 940 }); head.style.position = 'absolute'; head.style.top = px(210); tIn(head, t0 + 0.2, { kind: 'rise' });
    const items = o.items || []; const n = items.length; const rad = N(o.radius || 820);
    const stagePos = el('div', 'abs', sc, '', { left: '50%', top: '56%', width: 0, height: 0, transformStyle: 'preserve-3d' });
    const ring = el('div', 'abs', stagePos, '', { left: 0, top: 0, transformStyle: 'preserve-3d' });
    const cards = items.map((it, i) => {
      const c = el('div', 'glass', ring, '', { position: 'absolute', width: px(600), height: px(780), left: px(-300), top: px(-390), padding: px(48), display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: px(48) });
      const top = el('div', '', c, '', { display: 'flex', justifyContent: 'space-between' });
      appIcon(top, it.glyph || 'star', 170, it.c1 || P.a1, it.c2 || P.a2);
      if (it.tag) el('div', '', top, esc(it.tag), { alignSelf: 'flex-start', fontSize: px(32), fontWeight: 800, padding: px(10) + ' ' + px(24), borderRadius: px(99), background: P.a1, color: '#fff' });
      const b = el('div', '', c);
      el('div', '', b, esc(it.title), { fontSize: px(76), fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.05 });
      el('div', '', b, esc(it.sub || ''), { fontSize: px(40), color: P.mute, marginTop: px(10), fontWeight: 500 });
      if (it.price) el('div', 'acc', b, esc(it.price), { fontSize: px(84), fontWeight: 800, marginTop: px(22), letterSpacing: '-.03em', display: 'inline-block' });
      const ang = (360 / n) * i; c.style.transform = 'rotateY(' + ang + 'deg) translateZ(' + rad + 'px)';
      return c;
    });
    const spin = o.spin == null ? 270 : o.spin;
    tl.fromTo(ring, { rotationY: -spin * 0.5, rotationX: -8, y: N(200), scale: 0.6, opacity: 0 }, { rotationY: spin * 0.5, rotationX: -8, y: 0, scale: 1, opacity: 1, duration: t1 - t0, ease: 'power1.inOut' }, t0 + 0.05);
    tl.fromTo(ring, { opacity: 0 }, { opacity: 1, duration: 0.7 }, t0 + 0.05);
    sfx(t0 + 0.2, 'whoosh', 0.6); for (let i = 1; i < 4; i++) sfx(t0 + 0.8 + i * 0.7, 'tick', 0.3);
  };

  // 16. ORBIT: a hero object with satellites orbiting it on tilted rings
  SCENES.orbit = (sc, o, t0, t1) => {
    col(sc, { gap: 40 });
    const stagePos = el('div', '', sc, '', { position: 'relative', width: px(1000), height: px(1000), transformStyle: 'preserve-3d' });
    const glow = el('div', 'abs', stagePos, '', { inset: px(120), borderRadius: '50%', background: 'radial-gradient(circle,' + P.a1 + ' 0%,transparent 66%)', opacity: 0.35 });
    tl.fromTo(glow, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 0.45, duration: 1.4, ease: 'expo.out' }, t0 + 0.1);
    [[820, 0], [560, 1]].forEach(([d, k]) => { const r = el('div', 'abs', stagePos, '', { left: '50%', top: '50%', width: px(d), height: px(d), marginLeft: px(-d / 2), marginTop: px(-d / 2), borderRadius: '50%', border: px(2.5) + ' dashed ' + P.cardLine }); tl.fromTo(r, { scale: 0, opacity: 0, rotation: k ? 90 : -90 }, { scale: 1, opacity: 1, rotation: 0, duration: 1.2, ease: 'expo.out' }, t0 + 0.2 + k * 0.15); });
    const hero = o.logo ? monogram(stagePos, 280, { position: 'absolute', left: px(360), top: px(360), borderRadius: '28%' }) : appIcon(stagePos, o.glyph || 'bolt', 280, P.a1, P.a2, { position: 'absolute', left: px(360), top: px(360), borderRadius: '28%' });
    tl.fromTo(hero, { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 1.0, ease: 'back.out(1.8)' }, t0 + 0.15); sfx(t0 + 0.2, 'pop', 0.7);
    const sats = o.items || [];
    sats.forEach((it, i) => {
      const ring = i % 2, rr = ring ? 280 : 410, sz = ring ? 120 : 140;
      const holder = el('div', 'abs', stagePos, '', { left: '50%', top: '50%', width: 0, height: 0 });
      const s = appIcon(holder, it.glyph || 'star', sz, it.c1 || P.a1, it.c2 || P.a2, { position: 'absolute', left: px(-sz / 2), top: px(-sz / 2) });
      const a0 = (360 / Math.ceil(sats.length / 1)) * i, dirn = ring ? -1 : 1;
      const o2 = { a: a0 };
      const apply = () => { const a = o2.a * Math.PI / 180; holder.style.transform = 'translate(' + (Math.cos(a) * N(rr)) + 'px,' + (Math.sin(a) * N(rr)) + 'px)'; };
      apply();
      tl.to(o2, { a: a0 + dirn * 200, duration: t1 - t0, ease: 'none', onUpdate: apply }, t0);
      tl.fromTo(s, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)' }, t0 + 0.6 + i * 0.18); sfx(t0 + 0.6 + i * 0.18, 'tick', 0.4);
    });
    (o.lines || []).forEach((L, i) => { const l = line(sc, L.text, { size: L.size || 96, accent: L.accent, maxW: 940, weight: 800, cls: L.sub ? 'sub' : '' }); tIn(l, t0 + 0.9 + i * 0.18, { kind: 'rise' }); });
  };

  // 17. BURST: a huge offer with rotating light rays and exploding confetti
  SCENES.burst = (sc, o, t0, t1) => {
    const rays = el('div', 'abs', sc, '', { left: '50%', top: '50%', width: px(2600), height: px(2600), marginLeft: px(-1300), marginTop: px(-1300), borderRadius: '50%', background: 'repeating-conic-gradient(from 0deg,' + P.a1 + '55 0deg 8deg,transparent 8deg 24deg)', WebkitMask: 'radial-gradient(circle,#000 0%,transparent 62%)', mask: 'radial-gradient(circle,#000 0%,transparent 62%)' });
    tl.fromTo(rays, { rotation: 0, scale: 0.4, opacity: 0 }, { rotation: 70, scale: 1, opacity: 1, duration: t1 - t0 + 0.5, ease: 'power1.out' }, t0);
    const piece = [];
    const cols = [P.a1, P.a2, '#FFD76A', P.ink];
    for (let i = 0; i < 46; i++) {
      const c = el('div', 'abs', sc, '', { left: '50%', top: '47%', width: px(R(14, 30)), height: px(R(14, 46)), background: cols[i % cols.length], borderRadius: px(R(2, 9)), opacity: 0 });
      const ang = R(0, Math.PI * 2), dist = R(380, 1050), at = t0 + 0.75 + R(0, 0.1);
      tl.fromTo(c, { x: 0, y: 0, rotation: 0, opacity: 1, scale: 0.4 }, { x: Math.cos(ang) * N(dist), y: Math.sin(ang) * N(dist) * 0.8 - N(100), rotation: R(-540, 540), scale: 1, duration: 1.1, ease: 'expo.out' }, at);
      tl.to(c, { y: '+=' + N(R(260, 520)), opacity: 0, duration: 1.2, ease: 'power1.in' }, at + 1.0);
    }
    const mid = el('div', '', sc, '', { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(6) });
    if (o.eyebrow) { const e = el('div', 'eyebrow', mid, esc(o.eyebrow), { marginBottom: px(16) }); tl.fromTo(e, { opacity: 0, y: N(20) }, { opacity: 1, y: 0, duration: 0.7 }, t0 + 0.1); }
    const big = line(mid, o.big || '50%', { size: o.size || 520, weight: 900, accent: 0, track: -0.06, maxW: 960 }); big.style.overflow = 'visible';
    tl.fromTo(big, { scale: 3.2, opacity: 0, rotation: -8 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.7, ease: 'expo.out' }, t0 + 0.55);
    tl.fromTo(big, { scale: 1 }, { scale: 1.05, duration: t1 - t0 - 1.3, ease: 'sine.inOut' }, t0 + 1.3);
    sfx(t0 + 0.7, 'impact', 0.9); sfx(t0 + 0.85, 'shimmer', 0.5);
    (o.lines || []).forEach((L, i) => { const l = line(mid, L.text, { size: L.size || 110, accent: L.accent, maxW: 940, weight: 800, cls: L.sub ? 'sub' : '' }); tIn(l, t0 + 1.0 + i * 0.2, { kind: L.kind || 'rise' }); });
    const sh = el('div', 'abs', sc, '', { inset: 0, background: 'radial-gradient(circle at 50% 47%,#fff,transparent 55%)', opacity: 0, mixBlendMode: 'screen' });
    tl.fromTo(sh, { opacity: 0.8 }, { opacity: 0, duration: 0.5, immediateRender: false }, t0 + 0.55);
  };

  // 18. SPLIT: before / after, a bright divider wipes across the frame
  SCENES.split = (sc, o, t0, t1) => {
    const A = o.before || {}, B = o.after || {};
    const mk = (cfg, after) => {
      const p = el('div', 'abs', sc, '', { inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: px(24), background: after ? 'linear-gradient(160deg,' + P.a1 + ',' + P.a2 + ')' : 'linear-gradient(160deg,#2a2a31,#121217)', color: '#fff' });
      el('div', 'eyebrow', p, esc(cfg.label || (after ? 'After' : 'Before')), { color: 'rgba(255,255,255,.75)' });
      (cfg.lines || []).forEach((L) => { const l = line(p, L, { size: cfg.size || 150, weight: 900, maxW: 900, color: '#fff' }); l.style.opacity = after ? 1 : 0.7; });
      if (cfg.glyph) el('div', '', p, svgI(cfg.glyph, 'width="' + N(240) + '" height="' + N(240) + '" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"'), { opacity: after ? 1 : 0.5 });
      return p;
    };
    const a = mk(A, false), b = mk(B, true);
    b.style.clipPath = 'inset(0 100% 0 0)';
    const bar = el('div', 'abs', sc, '', { top: 0, bottom: 0, width: px(10), background: '#fff', boxShadow: '0 0 ' + px(60) + ' #fff,0 0 ' + px(140) + ' ' + P.a1, left: 0 });
    const at = t0 + 1.5;
    tl.fromTo(a, { scale: 1.08 }, { scale: 1, duration: 1.5, ease: 'power2.out' }, t0);
    tl.fromTo(b, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.0, ease: 'expo.inOut' }, at);
    tl.fromTo(bar, { x: 0, opacity: 1 }, { x: W, duration: 1.0, ease: 'expo.inOut' }, at);
    tl.to(bar, { opacity: 0, duration: 0.1 }, at + 1.0);
    tl.fromTo(b, { scale: 1.1 }, { scale: 1, duration: 1.4, ease: 'power2.out', immediateRender: false }, at);
    sfx(at, 'whoosh', 0.8); sfx(at + 0.8, 'impact', 0.5);
  };

  // 19. STEPS: a glowing line draws itself through numbered nodes
  SCENES.steps = (sc, o, t0, t1) => {
    col(sc, { gap: 0 });
    const head = line(sc, o.title || 'How it works', { size: 110, accent: o.accent, maxW: 940 }); head.style.position = 'absolute'; head.style.top = px(230); tIn(head, t0 + 0.1, { kind: 'rise' });
    const steps = o.steps || []; const n = steps.length;
    const box = el('div', 'abs', sc, '', { left: px(80), right: px(80), top: px(470), bottom: px(240) });
    const bw = W - N(160), bh = H - N(710), x0 = N(90);
    const svg = el('div', 'abs', box, '<svg width="' + bw + '" height="' + bh + '" style="overflow:visible"><defs><linearGradient id="stl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + P.a1 + '"/><stop offset="1" stop-color="' + P.a2 + '"/></linearGradient></defs><path class="trk" d="" fill="none" stroke="' + P.cardLine + '" stroke-width="' + N(12) + '" stroke-linecap="round"/><path class="pth" d="" fill="none" stroke="url(#stl)" stroke-width="' + N(10) + '" stroke-linecap="round"/></svg>', { inset: 0 });
    const gap = bh / n, pts = steps.map((s, i) => [i % 2 ? bw - x0 - N(30) : x0 + N(30), gap * i + gap * 0.5]);
    let d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (let i = 1; i < n; i++) { const [px0, py0] = pts[i - 1], [px1, py1] = pts[i]; d += ' C' + px0 + ' ' + (py0 + gap * 0.55) + ' ' + px1 + ' ' + (py1 - gap * 0.55) + ' ' + px1 + ' ' + py1; }
    const trk = $('.trk', svg), pth = $('.pth', svg); trk.setAttribute('d', d); pth.setAttribute('d', d);
    const len = pth.getTotalLength(); pth.style.strokeDasharray = len; trk.style.strokeDasharray = len;
    tl.fromTo(pth, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: t1 - t0 - 1.2, ease: 'power1.inOut' }, t0 + 0.5);
    tl.fromTo(trk, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.out' }, t0 + 0.3);
    steps.forEach((s, i) => {
      const [x, y] = pts[i], at = t0 + 0.5 + ((t1 - t0 - 1.2) * (i + 0.15)) / n;
      const left = i % 2 === 0;
      const node = el('div', 'abs', box, '', { left: (x - N(85)) + 'px', top: (y - N(85)) + 'px', width: px(170), height: px(170), borderRadius: '50%', background: 'linear-gradient(150deg,' + P.a1 + ',' + P.a2 + ')', display: 'grid', placeItems: 'center', color: '#fff', fontSize: px(86), fontWeight: 900, boxShadow: '0 0 0 ' + px(14) + ' ' + P.a1 + '33,0 30px 50px -16px ' + P.a1 });
      node.textContent = i + 1;
      const card = el('div', 'glass abs', box, '', { left: left ? (x + N(100)) + 'px' : 'auto', right: left ? 'auto' : (bw - x + N(100)) + 'px', top: (y - N(80)) + 'px', width: px(520), padding: px(26) + ' ' + px(32), borderRadius: px(36) });
      el('div', '', card, esc(s.title), { fontSize: px(64), fontWeight: 800, letterSpacing: '-.03em' });
      el('div', '', card, esc(s.sub || ''), { fontSize: px(40), color: P.mute, marginTop: px(6), fontWeight: 500 });
      tl.fromTo(node, { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2)' }, at); sfx(at, 'pop', 0.6);
      tl.fromTo(card, { opacity: 0, x: N(left ? 50 : -50), scale: 0.9 }, { opacity: 1, x: 0, scale: 1, duration: 0.7, ease: 'expo.out' }, at + 0.1);
    });
  };

  // 20. CHAT: a real conversation, typing dots then bubbles
  SCENES.chat = (sc, o, t0, t1) => {
    col(sc, { gap: 0 });
    const hd = el('div', 'glass', sc, '', { position: 'absolute', top: px(230), left: px(60), right: px(60), height: px(160), display: 'flex', alignItems: 'center', gap: px(24), padding: '0 ' + px(34), borderRadius: px(40) });
    monogram(hd, 110); const nm = el('div', '', hd); el('div', '', nm, esc(o.name || D.brand), { fontSize: px(54), fontWeight: 800 }); el('div', '', nm, 'online', { fontSize: px(34), color: '#25c26e', fontWeight: 600 });
    tl.fromTo(hd, { y: -N(80), opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out' }, t0 + 0.1);
    const feed = el('div', '', sc, '', { position: 'absolute', top: px(470), left: px(60), right: px(60), display: 'flex', flexDirection: 'column', gap: px(34) });
    let at = t0 + 0.8;
    (o.messages || []).forEach((m, i) => {
      const me = m.from === 'me';
      const row = el('div', '', feed, '', { display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' });
      const b = el('div', '', row, esc(m.text), { maxWidth: '84%', padding: px(40) + ' ' + px(50), fontSize: px(62), fontWeight: 500, letterSpacing: '-.01em', lineHeight: 1.2, borderRadius: px(46), borderBottomRightRadius: me ? px(12) : px(46), borderBottomLeftRadius: me ? px(46) : px(12), background: me ? 'linear-gradient(160deg,' + P.a1 + ',' + P.a1d + ')' : P.card, color: me ? '#fff' : P.ink, boxShadow: '0 1px 0 var(--hi) inset,0 0 0 1.5px var(--cardLine),0 30px 40px -24px var(--shadow)' });
      const dots = el('div', '', row, '<i></i><i></i><i></i>', { display: 'none', gap: px(10), padding: px(46) + ' ' + px(52), borderRadius: px(56), background: P.card, boxShadow: '0 0 0 1.5px var(--cardLine)' });
      $$('i', dots).forEach((d) => Object.assign(d.style, { width: px(24), height: px(24), borderRadius: '50%', background: P.mute, display: 'block' }));
      const typing = m.type != null ? m.type : (me ? 0.5 : 0.9);
      tl.set(row, { opacity: 0 }, 0);
      tl.set(b, { display: 'none' }, 0);
      tl.set(row, { opacity: 1 }, at); tl.set(dots, { display: 'flex' }, at);
      $$('i', dots).forEach((d, k) => tl.fromTo(d, { y: 0, opacity: 0.4 }, { y: -N(10), opacity: 1, duration: 0.25, yoyo: true, repeat: Math.max(1, Math.round(typing / 0.25)), ease: 'sine.inOut' }, at + k * 0.08));
      tl.set(dots, { display: 'none' }, at + typing); tl.set(b, { display: 'block' }, at + typing);
      tl.fromTo(b, { scale: 0.6, y: N(40), transformOrigin: me ? '100% 100%' : '0% 100%' }, { scale: 1, y: 0, duration: 0.55, ease: 'back.out(2)', immediateRender: false }, at + typing);
      sfx(at + typing, me ? 'click' : 'ding', 0.45);
      at += typing + 0.75 + (m.hold || 0);
    });
  };

  // 21. GRID: a bento board of tiles that fly in with parallax
  SCENES.grid = (sc, o, t0, t1) => {
    col(sc, { gap: 0 });
    const head = line(sc, o.title || '', { size: o.titleSize || 100, accent: o.accent, maxW: 940 }); head.style.position = 'absolute'; head.style.top = px(210); tIn(head, t0 + 0.1, { kind: 'rise' });
    const g = el('div', 'abs', sc, '', { left: px(70), right: px(70), top: px(430), bottom: px(220), display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: '1fr', gap: px(26) });
    (o.tiles || []).forEach((tI, i) => {
      const span = tI.wide ? 'span 2' : 'span 1';
      const hot = i === (o.hot == null ? 0 : o.hot);
      const c = el('div', hot ? '' : 'glass', g, '', { gridColumn: span, borderRadius: px(46), padding: px(36), display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', background: hot ? 'linear-gradient(150deg,' + P.a1 + ',' + P.a2 + ')' : undefined, color: hot ? '#fff' : P.ink, boxShadow: hot ? '0 40px 70px -30px ' + P.a1 : undefined });
      const gl = tI.glyph && el('div', '', c, svgI(tI.glyph, 'width="' + N(110) + '" height="' + N(110) + '" fill="none" stroke="' + (hot ? '#fff' : P.a1) + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'));
      const tx = el('div', '', c);
      if (tI.big) el('div', hot ? '' : 'acc', tx, esc(tI.big), { fontSize: px(190), fontWeight: 900, letterSpacing: '-.05em', lineHeight: 1, display: 'inline-block' });
      el('div', '', tx, esc(tI.title), { fontSize: px(62), fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.05, marginTop: px(8) });
      if (tI.sub) el('div', '', tx, esc(tI.sub), { fontSize: px(38), opacity: hot ? 0.85 : 1, color: hot ? '#fff' : P.mute, fontWeight: 500, marginTop: px(6) });
      const fromX = [-1, 1][i % 2] * W * 0.5, at = t0 + 0.35 + i * 0.16;
      tl.fromTo(c, { x: fromX, y: N(R(-120, 120)), rotation: R(-12, 12), opacity: 0, scale: 0.8 }, { x: 0, y: 0, rotation: 0, opacity: 1, scale: 1, duration: 0.95, ease: 'expo.out' }, at); sfx(at, 'tick', 0.4);
      tl.fromTo(c, { y: 0 }, { y: -N(8 + (i % 3) * 4), duration: 1.6, yoyo: true, repeat: 3, ease: 'sine.inOut', immediateRender: false }, at + 1);
    });
  };

  // 22. PHOTO: the user's own picture, revealed with a mask and a slow cinematic move
  SCENES.photo = (sc, o, t0, t1) => {
    const f = el('div', 'abs', sc, '', { inset: 0, overflow: 'hidden', clipPath: 'inset(100% 0 0 0 round ' + N(0) + 'px)' });
    const im = el('div', 'abs', f, '', { inset: '-8%', backgroundImage: 'url("' + (o.url || '') + '")', backgroundSize: 'cover', backgroundPosition: o.pos || 'center' });
    el('div', 'abs', f, '', { inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.28) 0%,transparent 30%,transparent 48%,rgba(0,0,0,.72) 100%)' });
    tl.fromTo(f, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1.1, ease: 'expo.inOut' }, t0);
    tl.fromTo(im, { scale: 1.28, rotation: 1.2 }, { scale: 1.02, rotation: 0, duration: t1 - t0 + 0.5, ease: 'power1.out' }, t0);
    const txt = el('div', 'abs', sc, '', { left: px(70), right: px(70), bottom: px(260), display: 'flex', flexDirection: 'column', alignItems: o.align === 'center' ? 'center' : 'flex-start', gap: px(8) });
    if (o.eyebrow) { const e = el('div', 'eyebrow', txt, esc(o.eyebrow), { color: 'rgba(255,255,255,.8)', marginBottom: px(14) }); tl.fromTo(e, { opacity: 0, y: N(20) }, { opacity: 1, y: 0, duration: 0.7 }, t0 + 0.9); }
    (o.lines || []).forEach((L, i) => { const l = line(txt, L.text, { size: L.size || 150, accent: L.accent, maxW: 940, weight: 900, color: '#fff' }); l.style.textAlign = o.align === 'center' ? 'center' : 'left'; tIn(l, t0 + 0.9 + i * 0.16, { kind: 'rise' }); });
    sfx(t0 + 0.1, 'whoosh', 0.5);
  };

  // 23. LOGO: the brand's own logo image appears with a light flare
  SCENES.logo = (sc, o, t0, t1) => {
    col(sc, { gap: 30 });
    const flare = el('div', 'abs', sc, '', { left: '50%', top: '47%', width: px(1400), height: px(1400), marginLeft: px(-700), marginTop: px(-700), borderRadius: '50%', background: 'radial-gradient(circle,' + P.a1 + 'aa 0%,transparent 60%)', opacity: 0 });
    tl.fromTo(flare, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 0.6, duration: 1.4, ease: 'expo.out' }, t0 + 0.1);
    const lg = o.url ? el('img', '', sc, '', { width: px(o.w || 640), maxHeight: px(520), objectFit: 'contain', position: 'relative' }) : monogram(sc, 300, { borderRadius: '28%' });
    if (o.url) lg.src = o.url;
    tl.fromTo(lg, { scale: 0.3, opacity: 0, rotationY: -80, filter: 'blur(' + N(30) + 'px)' }, { scale: 1, opacity: 1, rotationY: 0, filter: 'blur(0px)', duration: 1.3, ease: 'expo.out' }, t0 + 0.2); sfx(t0 + 0.25, 'jingle', 0.7);
    tl.fromTo(lg, { y: 0 }, { y: -N(14), duration: 1.6, yoyo: true, repeat: 1, ease: 'sine.inOut', immediateRender: false }, t0 + 1.5);
    (o.lines || []).forEach((L, i) => { const l = line(sc, L.text, { size: L.size || 90, accent: L.accent, maxW: 900, weight: 700, cls: L.sub ? 'sub' : '' }); tIn(l, t0 + 1.0 + i * 0.2, { kind: 'blur' }); });
    const sw = el('div', 'sweep', sc); tl.fromTo(sw, { x: -W * 0.4, opacity: 0 }, { x: W * 1.2, opacity: 1, duration: 0.9, ease: 'power2.inOut' }, t0 + 1.0); tl.to(sw, { opacity: 0, duration: 0.2 }, t0 + 1.7);
  };

  // 24. GOO: liquid metaballs merge behind a message
  SCENES.goo = (sc, o, t0, t1) => {
    const f = el('div', 'abs', sc, '<svg width="0" height="0"><filter id="goo"><feGaussianBlur in="SourceGraphic" stdDeviation="' + N(26) + '" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11"/></filter></svg>', { inset: 0 });
    const lq = el('div', 'abs', sc, '', { inset: 0, filter: 'url(#goo)' });
    for (let i = 0; i < 9; i++) {
      const s = N(R(180, 440)), c = el('div', 'abs', lq, '', { width: s + 'px', height: s + 'px', borderRadius: '50%', left: (W / 2 - s / 2) + 'px', top: (H / 2 - s / 2) + 'px', background: i % 2 ? P.a1 : P.a2, opacity: 0.92 });
      const a = R(0, 6.28), d = R(260, 560);
      tl.fromTo(c, { x: 0, y: 0, scale: 0 }, { x: Math.cos(a) * N(d), y: Math.sin(a) * N(d) * 1.3, scale: 1, duration: 1.2, ease: 'expo.out' }, t0 + 0.1 + i * 0.05);
      tl.to(c, { x: Math.cos(a + 2) * N(d * 0.7), y: Math.sin(a + 2) * N(d) * 0.9, duration: t1 - t0 - 1.8, ease: 'sine.inOut' }, t0 + 1.3);
      tl.to(c, { x: 0, y: 0, scale: 0.55, duration: 0.7, ease: 'power3.in' }, t1 - 0.9);
    }
    const mid = el('div', '', sc, '', { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(10) });
    (o.lines || []).forEach((L, i) => { const l = line(mid, L.text, { size: L.size || 170, accent: L.accent, maxW: 940, weight: 900, color: L.color || '#fff' }); l.querySelectorAll('.acc').forEach((x) => { x.style.background = 'none'; x.style.webkitTextFillColor = '#fff'; }); tIn(l, t0 + 0.9 + i * 0.2, { kind: L.kind || 'pop' }); });
  };
