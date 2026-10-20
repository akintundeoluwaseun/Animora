  // ================================================================ WAVE 3
  const titleAt = (sc, text, accent, top, size) => { const h = line(sc, text || '', { size: size || 100, accent, maxW: 940 }); h.style.position = 'absolute'; h.style.top = px(top || 220); return h; };

  // 25. CHECKLIST: items tick themselves off with a drawn check
  SCENES.checklist = (sc, o, t0, t1) => {
    const h = titleAt(sc, o.title, o.accent, 230, 104); tIn(h, t0 + 0.1, { kind: 'rise' });
    const box = el('div', 'abs', sc, '', { left: px(80), right: px(80), top: px(520), display: 'flex', flexDirection: 'column', gap: px(44) });
    const items = o.items || [];
    const gap = Math.min(1.0, (t1 - t0 - 1.6) / Math.max(1, items.length));
    items.forEach((t, i) => {
      const at = t0 + 0.6 + i * gap;
      const r = el('div', 'glass', box, '', { display: 'flex', alignItems: 'center', gap: px(40), padding: px(52) + ' ' + px(52), borderRadius: px(56) });
      const c = el('div', '', r, '<svg viewBox="0 0 24 24" width="' + N(92) + '" height="' + N(92) + '"><circle cx="12" cy="12" r="10.5" fill="none" stroke="' + P.cardLine + '" stroke-width="2"/><circle class="ci" cx="12" cy="12" r="10.5" fill="' + P.a1 + '" opacity="0"/><path class="ck" d="M7 12.5l3.2 3.2L17 8.6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="14" stroke-dashoffset="14"/></svg>', { flex: '0 0 auto' });
      el('div', '', r, esc(t), { fontSize: px(70), fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.1 });
      tl.fromTo(r, { x: N(-120), opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'expo.out' }, at);
      tl.fromTo($('.ci', c), { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, at + 0.4);
      tl.to($('.ck', c), { strokeDashoffset: 0, duration: 0.3, ease: 'power2.out' }, at + 0.5); sfx(at + 0.45, 'tick', 0.5);
    });
  };

  // 26. MENU: a price board, names and prices joined by dotted leaders
  SCENES.menu = (sc, o, t0, t1) => {
    const h = titleAt(sc, o.title, o.accent, 220, 110); tIn(h, t0 + 0.1, { kind: 'rise' });
    const card = el('div', 'glass abs', sc, '', { left: px(60), right: px(60), top: px(470), padding: px(60) + ' ' + px(60), borderRadius: px(60) });
    tl.fromTo(card, { y: N(200), rotationX: 18, opacity: 0 }, { y: 0, rotationX: 0, opacity: 1, duration: 1.0, ease: 'expo.out' }, t0 + 0.2);
    (o.rows || []).forEach((r, i) => {
      const row = el('div', '', card, '', { display: 'flex', alignItems: 'baseline', gap: px(18), padding: px(40) + ' 0', borderBottom: i < o.rows.length - 1 ? px(2) + ' dashed ' + P.cardLine : 'none' });
      el('div', '', row, esc(r.name), { fontSize: px(68), fontWeight: 700, letterSpacing: '-.02em' });
      el('div', '', row, '', { flex: 1, borderBottom: px(4) + ' dotted ' + P.mute, opacity: 0.5, transform: 'translateY(-' + px(10) + ')' });
      const pr = el('div', 'acc', row, esc(r.price || ''), { fontSize: px(72), fontWeight: 800, letterSpacing: '-.03em' });
      const at = t0 + 0.8 + i * 0.28;
      tl.fromTo(row, { opacity: 0, x: N(-60) }, { opacity: 1, x: 0, duration: 0.6, ease: 'expo.out' }, at);
      tl.fromTo(pr, { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)', transformOrigin: '100% 50%' }, at + 0.3); sfx(at + 0.3, 'tick', 0.4);
    });
  };

  // 27. COUPON: a ticket with notches that tears along its dashed line
  SCENES.coupon = (sc, o, t0, t1) => {
    const wrap = el('div', '', sc, '', { position: 'relative', width: px(900), filter: 'drop-shadow(0 50px 50px ' + P.shadow + ')' });
    const top = el('div', '', wrap, '', { background: 'linear-gradient(150deg,' + P.a1 + ',' + P.a2 + ')', color: '#fff', padding: px(70) + ' ' + px(60) + ' ' + px(50), borderRadius: px(50) + ' ' + px(50) + ' 0 0', textAlign: 'center' });
    el('div', 'eyebrow', top, esc(o.label || 'Special offer'), { color: 'rgba(255,255,255,.85)' });
    const big = el('div', '', top, esc(o.big || ''), { fontSize: px(o.size || 250), fontWeight: 900, letterSpacing: '-.06em', lineHeight: 1, margin: px(20) + ' 0 ' + px(10) });
    el('div', '', top, esc(o.sub || ''), { fontSize: px(54), fontWeight: 700 });
    const tear = el('div', '', wrap, '', { height: px(6), borderTop: px(6) + ' dashed rgba(255,255,255,.7)', background: P.a2, position: 'relative' });
    const bot = el('div', '', wrap, '', { background: P.card, padding: px(46) + ' ' + px(60), borderRadius: '0 0 ' + px(50) + ' ' + px(50), textAlign: 'center', backdropFilter: 'blur(10px)', boxShadow: '0 0 0 2px ' + P.cardLine + ' inset' });
    el('div', '', bot, esc(o.code ? 'Use code' : (o.note || '')), { fontSize: px(36), color: P.mute, fontWeight: 600 });
    if (o.code) el('div', 'mono', bot, esc(o.code), { fontSize: px(90), fontWeight: 800, letterSpacing: '.1em', color: P.ink, marginTop: px(10) });
    [-1, 1].forEach((s) => el('div', '', wrap, '', { position: 'absolute', top: '56%', [s < 0 ? 'left' : 'right']: px(-36), width: px(72), height: px(72), borderRadius: '50%', background: P.bg2, transform: 'translateY(-50%)' }));
    tl.fromTo(wrap, { y: H * 0.6, rotation: -14, scale: 0.7 }, { y: 0, rotation: -3, scale: 1, duration: 1.2, ease: 'expo.out' }, t0 + 0.1);
    tl.fromTo(bot, { y: 0 }, { y: N(46), rotation: 3, duration: 0.5, ease: 'back.out(2)', transformOrigin: '0% 0%' }, t0 + 1.7);
    tl.fromTo(big, { scale: 0.7 }, { scale: 1, duration: 0.6, ease: 'back.out(2.4)' }, t0 + 0.9); sfx(t0 + 0.9, 'impact', 0.6); sfx(t0 + 1.7, 'click', 0.7);
    tl.fromTo(wrap, { rotation: -3 }, { rotation: -1, duration: t1 - t0 - 2, ease: 'sine.inOut' }, t0 + 2);
  };

  // 28. STATS: giant counters, one under the other
  SCENES.stats = (sc, o, t0, t1) => {
    col(sc, { gap: 50 });
    if (o.title) { const h = titleAt(sc, o.title, o.accent, 200, 84); tIn(h, t0 + 0.1, { kind: 'blur' }); }
    const items = o.items || [];
    items.forEach((it, i) => {
      const at = t0 + 0.3 + i * 0.5;
      const r = el('div', '', sc, '', { display: 'flex', alignItems: 'baseline', gap: px(28), justifyContent: 'center' });
      const od = odometer(r, it.value, it.size || (items.length > 2 ? 230 : 300), it.prefix || '');
      if (it.suffix) el('span', 'acc', r, esc(it.suffix), { fontSize: px(120), fontWeight: 800 });
      const lab = line(sc, it.label, { size: 52, weight: 600, cls: 'sub', maxW: 900 });
      tl.fromTo(r, { opacity: 0, y: N(60) }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }, at); odoPlay(od, at + 0.1); tIn(lab, at + 0.5, { kind: 'blur' }); sfx(at + 0.2, 'tick', 0.4);
      lab.style.marginTop = px(-30);
    });
  };

  // 29. LOCATION: a pin drops onto a map card with a ripple
  SCENES.location = (sc, o, t0, t1) => {
    col(sc, { gap: 36 });
    const h = line(sc, o.title || 'Find us', { size: 120, accent: o.accent, maxW: 940 }); tIn(h, t0 + 0.1, { kind: 'rise' });
    const m = el('div', 'glass', sc, '', { width: px(960), height: px(900), position: 'relative', overflow: 'hidden', borderRadius: px(60) });
    el('div', '', m, '', { position: 'absolute', inset: '-20%', backgroundImage: 'linear-gradient(' + P.cardLine + ' 3px,transparent 3px),linear-gradient(90deg,' + P.cardLine + ' 3px,transparent 3px)', backgroundSize: px(110) + ' ' + px(110), transform: 'rotate(-12deg)' });
    el('div', '', m, '', { position: 'absolute', left: '-10%', right: '-10%', top: '46%', height: px(70), background: P.a1 + '33', transform: 'rotate(-12deg)' });
    el('div', '', m, '', { position: 'absolute', left: '40%', top: '-10%', width: px(60), height: '130%', background: P.a2 + '33', transform: 'rotate(-12deg)' });
    const rp = [0, 1].map(() => el('div', '', m, '', { position: 'absolute', left: '50%', top: '58%', width: px(200), height: px(200), marginLeft: px(-100), marginTop: px(-100), borderRadius: '50%', border: px(6) + ' solid ' + P.a1, opacity: 0 }));
    const pin = el('div', '', m, '<svg viewBox="0 0 24 24" width="' + N(190) + '" height="' + N(190) + '"><path d="M12 22s7.5-6.7 7.5-12.2A7.5 7.5 0 0 0 4.5 9.8C4.5 15.300 12 22 12 22z" fill="' + P.a1 + '" stroke="#fff" stroke-width="1.3"/><circle cx="12" cy="9.8" r="3" fill="#fff"/></svg>', { position: 'absolute', left: '50%', top: '58%', marginLeft: px(-95), marginTop: px(-190), transformOrigin: '50% 100%' });
    tl.fromTo(m, { y: N(120), opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'expo.out' }, t0 + 0.3);
    tl.fromTo(pin, { y: -N(700), scaleY: 1.3, opacity: 0 }, { y: 0, scaleY: 1, opacity: 1, duration: 0.6, ease: 'bounce.out' }, t0 + 1.0); sfx(t0 + 1.5, 'thud', 0.7);
    rp.forEach((r, i) => tl.fromTo(r, { scale: 0.3, opacity: 0.9 }, { scale: 3.4, opacity: 0, duration: 1.3, ease: 'power2.out' }, t0 + 1.5 + i * 0.35));
    const ad = line(sc, o.address || '', { size: 74, weight: 700, maxW: 940 }); tIn(ad, t0 + 1.8, { kind: 'blur' });
    if (o.sub) { const s = line(sc, o.sub, { size: 44, weight: 500, cls: 'sub', maxW: 900 }); tIn(s, t0 + 2.1, { kind: 'blur' }); }
  };

  // 30. COMPARE: others vs us, crosses against ticks
  SCENES.compare = (sc, o, t0, t1) => {
    const h = titleAt(sc, o.title, o.accent, 200, 96); tIn(h, t0 + 0.1, { kind: 'rise' });
    const wrap = el('div', 'abs', sc, '', { left: px(60), right: px(60), top: px(400), display: 'flex', gap: px(30) });
    [[o.left || {}, false], [o.right || {}, true]].forEach(([side, us], k) => {
      const c = el('div', us ? '' : 'glass', wrap, '', { flex: 1, padding: px(40) + ' ' + px(32), borderRadius: px(50), background: us ? 'linear-gradient(170deg,' + P.a1 + ',' + P.a2 + ')' : undefined, color: us ? '#fff' : P.ink, boxShadow: us ? '0 40px 70px -30px ' + P.a1 : undefined, minHeight: px(1000) });
      el('div', '', c, esc(side.name || ''), { fontSize: px(66), fontWeight: 900, letterSpacing: '-.03em', marginBottom: px(50), opacity: us ? 1 : 0.8 });
      (side.points || []).forEach((pt, i) => {
        const r = el('div', '', c, '', { display: 'flex', gap: px(18), alignItems: 'flex-start', marginBottom: px(36) });
        el('div', '', r, us ? '<svg viewBox="0 0 24 24" width="' + N(54) + '" height="' + N(54) + '"><circle cx="12" cy="12" r="11" fill="#fff"/><path d="M7 12.5l3.2 3.2L17 8.6" fill="none" stroke="' + P.a1 + '" stroke-width="2.6" stroke-linecap="round"/></svg>' : '<svg viewBox="0 0 24 24" width="' + N(54) + '" height="' + N(54) + '"><circle cx="12" cy="12" r="11" fill="' + P.cardLine + '"/><path d="M8 8l8 8M16 8l-8 8" stroke="' + P.mute + '" stroke-width="2.4" stroke-linecap="round"/></svg>', { flex: '0 0 auto' });
        el('div', '', r, esc(pt), { fontSize: px(52), fontWeight: 600, lineHeight: 1.15, letterSpacing: '-.01em', opacity: us ? 1 : 0.75 });
        const at = t0 + 0.8 + i * 0.5 + (us ? 0.25 : 0);
        tl.fromTo(r, { opacity: 0, x: N(us ? 50 : -50) }, { opacity: 1, x: 0, duration: 0.6, ease: 'expo.out' }, at); sfx(at, us ? 'ding' : 'tick', 0.35);
      });
      tl.fromTo(c, { y: N(260), opacity: 0, rotation: us ? 4 : -4 }, { y: 0, opacity: 1, rotation: 0, duration: 0.9, ease: 'expo.out' }, t0 + 0.3 + k * 0.15);
    });
  };

  // 31. QUOTE: a customer words card (only with a real quote)
  SCENES.quote = (sc, o, t0, t1) => {
    col(sc, { gap: 40 });
    const mark = el('div', 'acc', sc, '“', { fontSize: px(420), fontWeight: 900, lineHeight: 0.6, height: px(200) });
    tl.fromTo(mark, { scale: 0, rotation: -30 }, { scale: 1, rotation: 0, duration: 0.8, ease: 'back.out(2)' }, t0 + 0.1);
    const q = el('div', '', sc, '', { width: px(900), textAlign: 'center', fontSize: px(o.size || 78), fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.1 });
    String(o.text || '').split(' ').forEach((w, i, a) => { const s = el('span', '', q, esc(w) + ' ', { display: 'inline-block', whiteSpace: 'pre' }); tl.fromTo(s, { opacity: 0, y: N(30), filter: 'blur(' + N(10) + 'px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5 }, t0 + 0.5 + i * 0.08); });
    const by = el('div', '', sc, '', { display: 'flex', alignItems: 'center', gap: px(22) });
    const st = stars(by, 40, 5); el('span', '', by, esc(o.who || ''), { fontSize: px(44), fontWeight: 700, color: P.mute });
    const at = t0 + 0.8 + String(o.text || '').split(' ').length * 0.08; tl.fromTo(by, { opacity: 0, y: N(20) }, { opacity: 1, y: 0, duration: 0.6 }, at); starsPlay(st, at + 0.2);
  };

  // 32. POSTER: a wall of type, every line filling the width, bars sliding between
  SCENES.poster = (sc, o, t0, t1) => {
    const ls = o.lines || [];
    const box = el('div', 'abs', sc, '', { left: px(50), right: px(50), top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: px(14) });
    ls.forEach((t, i) => {
      const hot = i === (o.hot == null ? ls.length - 1 : o.hot);
      const wrap = el('div', '', box, '', { position: 'relative', padding: px(10) + ' ' + px(24), alignSelf: 'stretch' });
      const bar = hot ? el('div', '', wrap, '', { position: 'absolute', inset: 0, background: 'linear-gradient(100deg,' + P.a1 + ',' + P.a2 + ')', borderRadius: px(18), transformOrigin: '0% 50%' }) : null;
      const l = line(wrap, t, { size: 100, weight: 900, track: -0.05 });
      l.style.position = 'relative'; l.style.textAlign = 'center'; l.style.width = 'max-content'; l.style.maxWidth = 'none'; const mw = l.offsetWidth; l.style.width = ''; l.style.fontSize = Math.min(N(420), (100 * (N(980) - N(48))) / Math.max(1, mw)) + 'px';
      if (hot) $$('.tw', l).forEach((x) => { x.style.webkitTextFillColor = '#fff'; x.style.background = 'none'; });
      else if (i % 2) { $$('.tw', l).forEach((x) => { x.style.webkitTextFillColor = 'transparent'; x.style.webkitTextStroke = N(4) + 'px ' + P.ink; }); }
      if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'expo.out' }, t0 + 0.2 + i * 0.22);
      tl.fromTo(wrap, { x: N(i % 2 ? 320 : -320), opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'expo.out' }, t0 + 0.1 + i * 0.2); sfx(t0 + 0.1 + i * 0.2, 'hit', 0.5);
      tl.fromTo(wrap, { x: 0 }, { x: N(i % 2 ? -36 : 36), duration: t1 - t0, ease: 'none', immediateRender: false }, t0 + 0.9);
    });
  };

  // 33. REEL: the user's photos on a tilted vertical filmstrip
  SCENES.reel = (sc, o, t0, t1) => {
    const urls = o.urls || [];
    const strip = el('div', 'abs', sc, '', { left: '50%', top: 0, width: px(760), marginLeft: px(-380), transformOrigin: '50% 50%', display: 'flex', flexDirection: 'column', gap: px(34) });
    const reps = urls.concat(urls).concat(urls);
    reps.forEach((u) => el('div', '', strip, '', { height: px(960), borderRadius: px(50), backgroundImage: 'url("' + u + '")', backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 50px 80px -30px ' + P.shadow + ',0 0 0 ' + px(8) + ' rgba(255,255,255,.9)' }));
    const total = urls.length * N(994);
    tl.fromTo(strip, { y: -N(60), rotation: 6, rotationX: 10, scale: 1.05 }, { y: -total + N(200), rotation: -4, rotationX: 4, scale: 1, duration: t1 - t0 + 0.5, ease: 'power1.inOut' }, t0);
    tl.fromTo(strip, { opacity: 0 }, { opacity: 1, duration: 0.6 }, t0);
    el('div', 'abs', sc, '', { inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.55) 0%,transparent 28%,transparent 60%,rgba(0,0,0,.7) 100%)' });
    const txt = el('div', 'abs', sc, '', { left: px(70), right: px(70), bottom: px(230), display: 'flex', flexDirection: 'column', gap: px(6) });
    (o.lines || []).forEach((L, i) => { const l = line(txt, L.text, { size: L.size || 150, accent: L.accent, maxW: 940, weight: 900, color: '#fff' }); l.style.textAlign = 'left'; tIn(l, t0 + 0.6 + i * 0.16, { kind: 'rise' }); });
    sfx(t0 + 0.1, 'whoosh', 0.5);
  };

  // 34. DECK: a stack of cards; the top one is swiped away to reveal the next
  SCENES.deck = (sc, o, t0, t1) => {
    col(sc, { gap: 0 });
    if (o.title) { const h = titleAt(sc, o.title, o.accent, 210, 92); tIn(h, t0 + 0.1, { kind: 'rise' }); }
    const items = o.items || []; const n = items.length;
    const stack = el('div', '', sc, '', { position: 'relative', width: px(800), height: px(900), marginTop: px(120) });
    const per = (t1 - t0 - 1.2) / n;
    items.slice().reverse().forEach((it, ri) => {
      const i = n - 1 - ri;
      const c = el('div', 'glass', stack, '', { background: P.dark ? 'linear-gradient(160deg,#252c58,#171c3b)' : '#fff', position: 'absolute', inset: 0, padding: px(56), display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: px(60), zIndex: n - i });
      const ic = appIcon(c, it.glyph || 'star', 190, it.c1 || P.a1, it.c2 || P.a2);
      const b = el('div', '', c); el('div', '', b, esc(it.title), { fontSize: px(84), fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1 }); el('div', '', b, esc(it.sub || ''), { fontSize: px(44), color: P.mute, fontWeight: 500, marginTop: px(14) });
      el('div', 'eyebrow', c, (i + 1) + ' / ' + n, { position: 'absolute', right: px(50), top: px(54) });
      const rest = { y: N(-26 * i), scale: 1 - i * 0.05, rotation: (i % 2 ? 1 : -1) * i * 1.5 };
      tl.fromTo(c, { y: N(500), opacity: 0, scale: 0.8 }, Object.assign({ opacity: 1, duration: 0.8, ease: 'expo.out' }, rest), t0 + 0.2 + (n - i) * 0.08);
      if (i < n - 1) tl.to(c, { x: W * 1.1, rotation: 24, opacity: 0, duration: 0.55, ease: 'power3.in' }, t0 + 1.0 + (i + 1) * per - 0.3); sfx(t0 + 1.0 + (i + 1) * per - 0.3, 'whoosh', 0.4);
      for (let k = 0; k < i; k++) tl.to(c, { y: N(-26 * (i - k - 1)), scale: 1 - (i - k - 1) * 0.05, duration: 0.5, ease: 'expo.out' }, t0 + 1.0 + (k + 1) * per - 0.15);
    });
  };

  // 35. HIGHLIGHT: a sentence where a marker sweeps over the key words
  SCENES.highlight = (sc, o, t0, t1) => {
    const q = el('div', '', sc, '', { width: px(940), textAlign: 'left', fontSize: px(o.size || 118), fontWeight: 900, letterSpacing: '-.045em', lineHeight: 1.12 });
    const hot = new Set(o.hot || []);
    String(o.text || '').split(' ').forEach((w, i) => {
      const wrap = el('span', '', q, '', { display: 'inline-block', position: 'relative', marginRight: '0.28em', overflow: 'hidden', verticalAlign: 'top' });
      const bar = hot.has(i) ? el('span', '', wrap, '', { position: 'absolute', left: 0, right: 0, top: '10%', bottom: '4%', background: P.a1, transformOrigin: '0% 50%', zIndex: 0 }) : null;
      const s = el('span', '', wrap, esc(w), { position: 'relative', zIndex: 1, display: 'inline-block', color: hot.has(i) ? '#fff' : P.ink });
      tl.fromTo(s, { yPercent: 110 }, { yPercent: 0, duration: 0.7, ease: 'expo.out' }, t0 + 0.2 + i * 0.1);
      if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'expo.inOut' }, t0 + 0.9 + i * 0.1 + 0.3);
    });
    sfx(t0 + 0.3, 'whoosh', 0.4);
  };

  // 36. COUNTDOWN: 3 - 2 - 1, then the reveal
  SCENES.countdown = (sc, o, t0, t1) => {
    const n = o.from || 3;
    const ring = el('div', 'abs', sc, '', { left: '50%', top: '42%', width: px(760), height: px(760), marginLeft: px(-380), marginTop: px(-380), borderRadius: '50%', border: px(14) + ' solid ' + P.a1, opacity: 0.4 });
    for (let k = 0; k < n; k++) {
      const num = el('div', 'acc abs', sc, String(n - k), { left: 0, right: 0, top: '42%', transform: 'translateY(-50%)', textAlign: 'center', fontSize: px(700), fontWeight: 900, letterSpacing: '-.06em', lineHeight: 1, opacity: 0 });
      const at = t0 + 0.2 + k * 0.7;
      tl.fromTo(num, { scale: 2.2, opacity: 0, filter: 'blur(' + N(30) + 'px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.25, ease: 'expo.out' }, at);
      tl.to(num, { scale: 0.6, opacity: 0, duration: 0.25, ease: 'power3.in' }, at + 0.45); sfx(at, 'tick', 0.8);
      tl.fromTo(ring, { scale: 1.1, opacity: 0.8 }, { scale: 0.9, opacity: 0.3, duration: 0.6 }, at);
    }
    const rt = t0 + 0.2 + n * 0.7;
    const col2 = el('div', 'abs', sc, '', { left: 0, right: 0, top: '30%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(10) });
    (o.lines || []).forEach((L, i) => { const l = line(col2, L.text, { size: L.size || 200, accent: L.accent, maxW: 940, weight: 900 }); tIn(l, rt + i * 0.16, { kind: 'pop' }); });
    sfx(rt, 'impact', 0.9);
    const fl = el('div', 'abs', sc, '', { inset: 0, background: '#fff', opacity: 0 }); tl.fromTo(fl, { opacity: 0.8 }, { opacity: 0, duration: 0.4, immediateRender: false }, rt); tl.set(fl, { opacity: 0 }, 0);
  };
