/* Animora Motion pieces, batch 2: twelve more scene pieces, each with its own variations.
   stat counter · review · feature tiles · countdown · location pin · before/after · phone mockup ·
   kinetic type wall · logo draw · split slam · cinematic photo · price compare. Needs pieces.js + atoms.js. */
(function () {
  'use strict';
  const P = window.PIECES, X = window.PIECE_UTILS;
  const { el, sv, clamp, lerp, ez, esc, rgba, mix, on, drive, orb, chars, fit, natural, inkOn, seeded } = X;
  const ICON = {
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z', truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2', leaf: 'M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7', gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13',
  };
  const icon = (k, size, color) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[k] || ICON.star}"/></svg>`;
  const salt = (ctx) => ctx.salt || '';

  // 13. Stat counter: a big number counts up, a ring / bar fills to match.
  P['info-stat'] = {
    family: 'info', label: 'Stat counter', tags: { energy: 'medium' }, dur: 3.6,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind);
      const style = ctx.pick('stat:style' + salt(ctx), ['ring', 'bar', 'plain', 'ring']);
      const n = +String(d.value || 98).replace(/[^\d.]/g, '') || 98, suffix = d.suffix ?? '%';
      const cy = H * 0.43, R = W * 0.3;
      if (style === 'ring') {
        const s = sv('svg', { width: R * 2.4, height: R * 2.4, viewBox: '0 0 240 240', style: `position:absolute;left:${W / 2 - R * 1.2}px;top:${cy - R * 1.2}px;transform:rotate(-90deg);` }, L);
        sv('circle', { cx: 120, cy: 120, r: 100, fill: 'none', stroke: rgba(ink, 0.1), 'stroke-width': 14 }, s);
        const arc = sv('circle', { cx: 120, cy: 120, r: 100, fill: 'none', stroke: look.A, 'stroke-width': 14, 'stroke-linecap': 'round' }, s);
        const len = 2 * Math.PI * 100; arc.style.strokeDasharray = len; arc.style.strokeDashoffset = len;
        ctx.tl.to(arc.style, { strokeDashoffset: len * (1 - Math.min(1, n / (suffix === '%' ? 100 : n * 1.1))), duration: 1.8, ease: 'power3.out' }, t0 + 0.3);
      } else if (style === 'bar') {
        const bar = el('div', `position:absolute;left:${90 * U}px;right:${90 * U}px;top:${cy + R * 0.75}px;height:${26 * U}px;border-radius:${13 * U}px;background:${rgba(ink, 0.1)};overflow:hidden;`, L);
        const fill = el('div', `height:100%;width:100%;background:linear-gradient(90deg, ${look.A}, ${look.A2});transform-origin:0 50%;transform:scaleX(0);border-radius:inherit;`, bar);
        ctx.tl.to(fill, { scaleX: Math.min(1, n / (suffix === '%' ? 100 : n * 1.1)), duration: 1.8, ease: 'power3.out' }, t0 + 0.3);
      }
      const num = el('div', `position:absolute;left:0;right:0;top:${cy}px;transform:translateY(-55%);text-align:center;font-family:${look.display};font-weight:${look.dw};font-size:${style === 'plain' ? 330 * U : 230 * U}px;line-height:1;letter-spacing:-.04em;color:${ink};`, L);
      const label = el('div', `position:absolute;left:${90 * U}px;right:${90 * U}px;top:${cy + (style === 'ring' ? R * 1.35 : style === 'bar' ? R * 1.05 : R * 0.75)}px;text-align:center;font-family:${look.ui};font-weight:600;font-size:${48 * U}px;line-height:1.3;color:${rgba(ink, 0.78)};`, L, esc(d.label || ''));
      const dec = String(d.value).includes('.') ? 1 : 0;
      drive(ctx, t0 + 0.3, 1.8, (p) => { num.textContent = (n * p).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix; }, 'power3.out');
      ctx.tl.fromTo(num, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.8)' }, t0 + 0.1);
      ctx.tl.fromTo(num, { scale: 1 }, { keyframes: [{ scale: 1.08, duration: 0.1 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1,.5)' }], immediateRender: false }, t0 + 2.1);
      ctx.tl.fromTo(label, { opacity: 0, y: 30 * U }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, t0 + 0.8);
      ctx.sfx.push({ t: t0 + 0.3, k: 'tick', v: 0.5 }, { t: t0 + 2.1, k: 'chime', v: 0.7 });
      return t0 + this.dur;
    },
  };

  // 14. Review: stars pop in, the quote fades in word by word, the name signs off.
  P['info-quote'] = {
    family: 'info', label: 'Customer review', tags: { energy: 'calm' }, dur: 4.2,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind), dark = L.dataset.kind !== 'light';
      const style = ctx.pick('quote:style' + salt(ctx), ['card', 'bubble', 'marks']);
      const box = el('div', `position:absolute;left:${80 * U}px;right:${80 * U}px;top:50%;padding:${style === 'marks' ? 0 : 70 * U}px ${style === 'marks' ? 0 : 60 * U}px;border-radius:${style === 'bubble' ? 60 * U : 44 * U}px;${style === 'marks' ? '' : `background:${dark ? rgba('#FFFFFF', 0.08) : '#FFFFFF'};box-shadow:0 ${40 * U}px ${90 * U}px ${-30 * U}px rgba(0,0,0,.4);border:${2 * U}px solid ${rgba(ink, 0.08)};`}`, L);
      if (style === 'bubble') el('div', `position:absolute;left:${110 * U}px;bottom:${-40 * U}px;width:${80 * U}px;height:${80 * U}px;background:inherit;transform:rotate(45deg);`, box);
      if (style === 'marks') el('div', `font-family:Georgia, serif;font-size:${380 * U}px;line-height:.7;height:${200 * U}px;color:${look.A};`, box, '&ldquo;');
      const stars = el('div', `display:flex;gap:${10 * U}px;margin-bottom:${30 * U}px;`, box, Array.from({ length: 5 }, () => icon('star', 56 * U, look.A2 === '#FFFFFF' ? look.A : look.A2).replace('fill="none"', `fill="${look.A2 === '#FFFFFF' ? look.A : look.A2}"`)).join(''));
      const q = el('div', `font-family:${look.display};font-weight:${Math.min(700, look.dw)};font-size:${70 * U}px;line-height:1.18;letter-spacing:-.02em;color:${ink};`, box);
      const words = String(d.quote || '').split(/\s+/).map((w) => el('span', 'display:inline-block;margin-right:.24em;', q, esc(w)));
      const who = el('div', `display:flex;align-items:center;gap:${20 * U}px;margin-top:${40 * U}px;font-family:${look.ui};`, box, `<span style="width:${86 * U}px;height:${86 * U}px;border-radius:50%;background:linear-gradient(135deg, ${look.A}, ${look.A2});display:grid;place-items:center;color:${on(look.A)};font-weight:800;font-size:${36 * U}px">${esc(String(d.name || 'A')[0])}</span><span><b style="display:block;font-size:${38 * U}px;color:${ink}">${esc(d.name || '')}</b><span style="font-size:${30 * U}px;color:${rgba(ink, 0.6)}">${esc(d.role || '')}</span></span>`);
      box.style.marginTop = `${-box.offsetHeight / 2}px`;
      ctx.tl.fromTo(box, { y: 100 * U, opacity: 0, rotation: style === 'bubble' ? -3 : 0 }, { y: 0, opacity: 1, rotation: 0, duration: 0.9, ease: 'expo.out' }, t0);
      ctx.tl.fromTo(stars.children, { scale: 0, rotation: -60 }, { scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(3)', stagger: 0.09 }, t0 + 0.35);
      ctx.tl.fromTo(words, { opacity: 0, y: 20 * U, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: 'power2.out', stagger: 0.06 }, t0 + 0.8);
      ctx.tl.fromTo(who, { opacity: 0, x: -30 * U }, { opacity: 1, x: 0, duration: 0.7, ease: 'expo.out' }, t0 + 0.9 + words.length * 0.06);
      for (let i = 0; i < 5; i++) ctx.sfx.push({ t: t0 + 0.35 + i * 0.09, k: 'tick', v: 0.35 });
      void H;
      return t0 + this.dur;
    },
  };

  // 15. Feature tiles: tiles fly in from different directions and settle into a grid / list / orbit.
  P['info-tiles'] = {
    family: 'info', label: 'Feature tiles', tags: { energy: 'medium' }, dur: 3.8,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind), dark = L.dataset.kind !== 'light';
      const style = ctx.pick('tiles:style' + salt(ctx), ['grid', 'list', 'grid', 'stack']);
      const items = (d.items || []).slice(0, 4), icons = ['bolt', 'shield', 'truck', 'heart'];
      const head = el('div', `position:absolute;left:${80 * U}px;right:${80 * U}px;top:${H * 0.14}px;font-family:${look.display};font-weight:${look.dw};font-size:${120 * U}px;line-height:1;letter-spacing:-.035em;color:${ink};`, L, esc(d.headline || ''));
      ctx.tl.fromTo(head, { opacity: 0, y: 40 * U }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, t0);
      const top = H * 0.14 + head.offsetHeight + 80 * U, gw = W - 160 * U;
      items.forEach((txt, i) => {
        const grid = style === 'grid', tw = grid ? (gw - 30 * U) / 2 : gw, th = grid ? 330 * U : 170 * U;
        const x = 80 * U + (grid ? (i % 2) * (tw + 30 * U) : style === 'stack' ? i * 18 * U : 0), y = top + (grid ? Math.floor(i / 2) * (th + 30 * U) : i * (th + (style === 'stack' ? -40 : 24) * U));
        const tile = el('div', `position:absolute;left:${x}px;top:${y}px;width:${tw - (style === 'stack' ? i * 36 * U : 0)}px;height:${th}px;border-radius:${36 * U}px;padding:${34 * U}px;display:flex;${grid ? 'flex-direction:column;justify-content:space-between;' : 'align-items:center;gap:' + 30 * U + 'px;'}background:${i === 0 && grid ? look.A : dark ? rgba('#FFFFFF', 0.08) : '#FFFFFF'};box-shadow:0 ${30 * U}px ${60 * U}px ${-24 * U}px rgba(0,0,0,.35);border:${1.5 * U}px solid ${rgba(ink, 0.08)};`, L);
        const fg = i === 0 && grid ? on(look.A) : ink;
        el('span', `width:${96 * U}px;height:${96 * U}px;border-radius:${28 * U}px;display:grid;place-items:center;flex:none;background:${i === 0 && grid ? rgba(fg, 0.15) : rgba(look.A, 0.14)};`, tile, icon(icons[i], 52 * U, i === 0 && grid ? fg : look.A));
        el('b', `font-family:${look.ui};font-size:${grid ? 46 : 50}px;font-size:${(grid ? 46 : 50) * U}px;line-height:1.15;color:${fg};`, tile, esc(txt));
        const r = seeded(i * 13 + 5), from = [{ x: -W, rotation: -20 }, { x: W, rotation: 20 }, { y: H * 0.6, rotation: 10 }, { y: H * 0.6, rotation: -10 }][(i + Math.floor(r() * 4)) % 4];
        ctx.tl.fromTo(tile, { ...from, opacity: 0 }, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.9, ease: 'expo.out' }, t0 + 0.4 + i * 0.16);
        ctx.sfx.push({ t: t0 + 0.4 + i * 0.16, k: 'whoosh', v: 0.35 });
      });
      return t0 + this.dur;
    },
  };

  // 16. Countdown: flip digits tick down to the event, with the date stamped below.
  P['info-countdown'] = {
    family: 'info', label: 'Countdown', tags: { energy: 'high' }, dur: 4.0,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind), dark = L.dataset.kind !== 'light';
      const style = ctx.pick('count:style' + salt(ctx), ['flip', 'roll', 'flip']);
      const head = el('div', `position:absolute;left:0;right:0;top:${H * 0.24}px;text-align:center;font-family:${look.ui};font-weight:800;font-size:${44 * U}px;letter-spacing:.3em;text-transform:uppercase;color:${look.A};`, L, esc(d.kicker || 'Starts in'));
      const units = [['DAYS', d.days ?? 3], ['HRS', d.hours ?? 12], ['MIN', d.mins ?? 45]];
      const cw = (W - 160 * U - 60 * U) / 3, ch = cw * 1.25, top = H * 0.32;
      units.forEach(([lab, v], i) => {
        const x = 80 * U + i * (cw + 30 * U);
        const card = el('div', `position:absolute;left:${x}px;top:${top}px;width:${cw}px;height:${ch}px;border-radius:${30 * U}px;background:${dark ? '#1A1A20' : '#16161B'};box-shadow:0 ${30 * U}px ${60 * U}px ${-20 * U}px rgba(0,0,0,.5);overflow:hidden;perspective:${800 * U}px;`, L);
        el('div', `position:absolute;left:0;right:0;top:50%;height:${3 * U}px;background:rgba(0,0,0,.6);z-index:3;`, card);
        const num = el('div', `position:absolute;inset:0;display:grid;place-items:center;font-family:${look.display};font-weight:${look.dw};font-size:${cw * 0.62}px;color:#fff;letter-spacing:-.04em;`, card, String(v + 3).padStart(2, '0'));
        el('div', `position:absolute;left:${x}px;top:${top + ch + 24 * U}px;width:${cw}px;text-align:center;font-family:${look.ui};font-weight:700;font-size:${32 * U}px;letter-spacing:.2em;color:${rgba(ink, 0.7)};`, L, lab);
        ctx.tl.fromTo(card, { y: 120 * U, opacity: 0, rotationX: -50 }, { y: 0, opacity: 1, rotationX: 0, duration: 0.8, ease: 'expo.out' }, t0 + i * 0.1);
        for (let k = 3; k >= 0; k--) {
          const at = t0 + 0.9 + (3 - k) * 0.55 + i * 0.05;
          if (style === 'flip') ctx.tl.to(num, { rotationX: -90, duration: 0.14, ease: 'power2.in' }, at).set(num, { textContent: String(v + k).padStart(2, '0') }, at + 0.14).fromTo(num, { rotationX: 90 }, { rotationX: 0, duration: 0.22, ease: 'back.out(2)', immediateRender: false }, at + 0.14);
          else ctx.tl.to(num, { yPercent: -60, opacity: 0, duration: 0.14, ease: 'power2.in' }, at).set(num, { textContent: String(v + k).padStart(2, '0'), yPercent: 60 }, at + 0.14).to(num, { yPercent: 0, opacity: 1, duration: 0.25, ease: 'back.out(2)' }, at + 0.14);
          if (i === 2) ctx.sfx.push({ t: at, k: 'tick', v: 0.5 });
        }
      });
      const date = el('div', `position:absolute;left:0;right:0;top:${top + ch + 130 * U}px;text-align:center;font-family:${look.display};font-weight:${look.dw};font-size:${92 * U}px;letter-spacing:-.02em;color:${ink};`, L, esc(d.date || ''));
      ctx.tl.fromTo(head, { opacity: 0, letterSpacing: `${30 * U}px` }, { opacity: 1, letterSpacing: `${13 * U}px`, duration: 0.9, ease: 'expo.out' }, t0);
      ctx.tl.fromTo(date, { opacity: 0, scale: 1.4 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, t0 + 3.1);
      ctx.sfx.push({ t: t0 + 3.1, k: 'chime', v: 0.7 });
      return t0 + this.dur;
    },
  };

  // 17. Location: a little city map draws itself, the pin drops with a ripple, the address slides up.
  P['info-location'] = {
    family: 'info', label: 'Map pin', tags: { energy: 'medium' }, dur: 3.8,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind), dark = L.dataset.kind !== 'light';
      const r = seeded(31 + (ctx.pick('map:seed' + salt(ctx), [1, 2, 3, 4]))), s = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;' }, L);
      const roads = [];
      for (let i = 0; i < 9; i++) { const y = H * (0.12 + i * 0.09) + (r() - 0.5) * 60 * U; roads.push(sv('path', { d: `M${-50} ${y} C ${W * 0.3} ${y + (r() - 0.5) * 160 * U}, ${W * 0.7} ${y + (r() - 0.5) * 160 * U}, ${W + 50} ${y + (r() - 0.5) * 80 * U}`, fill: 'none', stroke: rgba(ink, i % 3 ? 0.12 : 0.22), 'stroke-width': (i % 3 ? 10 : 22) * U }, s)); }
      for (let i = 0; i < 6; i++) { const x = W * (0.08 + i * 0.18) + (r() - 0.5) * 60 * U; roads.push(sv('path', { d: `M${x} -50 L${x + (r() - 0.5) * 200 * U} ${H + 50}`, fill: 'none', stroke: rgba(ink, 0.1), 'stroke-width': 10 * U }, s)); }
      roads.forEach((p, i) => { const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len; ctx.tl.to(p.style, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' }, t0 + i * 0.04); });
      const route = sv('path', { d: `M${W * 0.1} ${H * 0.8} C ${W * 0.3} ${H * 0.6}, ${W * 0.35} ${H * 0.45}, ${W * 0.5} ${H * 0.42}`, fill: 'none', stroke: look.A, 'stroke-width': 12 * U, 'stroke-linecap': 'round', 'stroke-dasharray': `${1} ${26 * U}` }, s);
      const rl = route.getTotalLength(); const mask = sv('path', { d: route.getAttribute('d'), fill: 'none', stroke: '#000' }, s); void mask; mask.remove();
      ctx.tl.fromTo(route, { opacity: 0 }, { opacity: 1, duration: 0.6 }, t0 + 0.8); void rl;
      const px = W * 0.5, py = H * 0.42;
      const ripple = el('div', `position:absolute;left:${px}px;top:${py}px;width:${300 * U}px;height:${110 * U}px;margin:${-55 * U}px 0 0 ${-150 * U}px;border-radius:50%;border:${5 * U}px solid ${look.A};`, L);
      const pin = el('div', `position:absolute;left:${px}px;top:${py}px;width:${150 * U}px;height:${200 * U}px;margin:${-200 * U}px 0 0 ${-75 * U}px;transform-origin:50% 100%;filter:drop-shadow(0 ${20 * U}px ${20 * U}px rgba(0,0,0,.4));`, L, `<svg viewBox="0 0 24 32" width="100%" height="100%"><path d="M12 31s10-11 10-19A10 10 0 0 0 2 12c0 8 10 19 10 19z" fill="${look.A}"/><circle cx="12" cy="12" r="4.2" fill="${on(look.A)}"/></svg>`);
      ctx.tl.fromTo(pin, { y: -H * 0.5, scaleY: 1.3 }, { y: 0, scaleY: 1, duration: 0.7, ease: 'bounce.out' }, t0 + 1.1);
      ctx.tl.fromTo(ripple, { scale: 0.2, opacity: 1 }, { scale: 2.2, opacity: 0, duration: 1.1, ease: 'power2.out', repeat: 1 }, t0 + 1.55);
      const card = el('div', `position:absolute;left:${80 * U}px;right:${80 * U}px;bottom:${H * 0.12}px;padding:${44 * U}px ${50 * U}px;border-radius:${40 * U}px;background:${dark ? '#FFFFFF' : '#15151A'};color:${dark ? '#111' : '#fff'};font-family:${look.ui};box-shadow:0 ${30 * U}px ${80 * U}px ${-20 * U}px rgba(0,0,0,.5);`, L, `<div style="font-size:${30 * U}px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${look.A}">${esc(d.kicker || 'Find us')}</div><div style="margin-top:${12 * U}px;font-family:${look.display};font-weight:${look.dw};font-size:${68 * U}px;line-height:1.05;letter-spacing:-.02em">${esc(d.place || '')}</div>${d.hours ? `<div style="margin-top:${12 * U}px;font-size:${34 * U}px;opacity:.7">${esc(d.hours)}</div>` : ''}`);
      ctx.tl.fromTo(card, { y: 300 * U, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out' }, t0 + 1.8);
      ctx.sfx.push({ t: t0 + 1.4, k: 'pop', v: 0.7 }, { t: t0 + 1.8, k: 'whoosh', v: 0.4 });
      return t0 + this.dur;
    },
  };

  // 18. Before / after: a divider sweeps across the photo, from dull to finished.
  P['photo-split'] = {
    family: 'photo', label: 'Before / after', tags: { energy: 'medium' }, dur: 4.0,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx;
      const vert = ctx.pick('split:dir' + salt(ctx), [true, false]);
      const frame = el('div', `position:absolute;left:${60 * U}px;right:${60 * U}px;top:${H * 0.14}px;height:${H * 0.62}px;border-radius:${44 * U}px;overflow:hidden;box-shadow:0 ${40 * U}px ${90 * U}px ${-30 * U}px rgba(0,0,0,.6);`, L);
      const before = el('div', `position:absolute;inset:0;background:url("${d.img}") center/cover;filter:grayscale(1) brightness(.75) contrast(.85) blur(${2 * U}px);`, frame);
      const after = el('div', `position:absolute;inset:0;background:url("${d.img}") center/cover;filter:saturate(1.25) contrast(1.05);`, frame);
      const line = el('div', `position:absolute;${vert ? `top:0;bottom:0;width:${6 * U}px;margin-left:${-3 * U}px;` : `left:0;right:0;height:${6 * U}px;margin-top:${-3 * U}px;`}background:#fff;box-shadow:0 0 ${20 * U}px rgba(0,0,0,.4);`, frame);
      const knob = el('div', `position:absolute;width:${90 * U}px;height:${90 * U}px;margin:${-45 * U}px 0 0 ${-45 * U}px;border-radius:50%;background:#fff;display:grid;place-items:center;color:#111;font-weight:900;font-size:${34 * U}px;font-family:system-ui;${vert ? 'top:50%;' : 'left:50%;'}`, frame, vert ? '⟷' : '↕');
      const tagB = el('div', `position:absolute;left:${30 * U}px;top:${30 * U}px;padding:${10 * U}px ${22 * U}px;border-radius:999px;background:rgba(0,0,0,.6);color:#fff;font-family:${look.ui};font-weight:800;font-size:${28 * U}px;letter-spacing:.15em;`, frame, esc(d.before || 'BEFORE'));
      const tagA = el('div', `position:absolute;right:${30 * U}px;bottom:${30 * U}px;padding:${10 * U}px ${22 * U}px;border-radius:999px;background:${look.A};color:${on(look.A)};font-family:${look.ui};font-weight:800;font-size:${28 * U}px;letter-spacing:.15em;`, frame, esc(d.after || 'AFTER'));
      const e = ez('power3.inOut');
      drive(ctx, t0 + 0.6, 2.4, (p) => {
        const q = p < 0.35 ? e(p / 0.35) * 0.3 : p < 0.6 ? 0.3 - e((p - 0.35) / 0.25) * 0.15 : 0.15 + e((p - 0.6) / 0.4) * 0.85;   // a little back-and-forth, then all the way
        const v = (1 - q) * 100;
        after.style.clipPath = vert ? `inset(0 0 0 ${v}%)` : `inset(${v}% 0 0 0)`;
        if (vert) { line.style.left = knob.style.left = `${v}%`; } else { line.style.top = knob.style.top = `${v}%`; }
      });
      ctx.tl.fromTo(frame, { y: 120 * U, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out' }, t0);
      ctx.tl.fromTo([tagB, tagA], { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(2.5)', stagger: 0.2 }, t0 + 0.5);
      const cap = el('div', `position:absolute;left:${80 * U}px;right:${80 * U}px;top:${H * 0.79}px;font-family:${look.display};font-weight:${look.dw};font-size:${90 * U}px;line-height:1.02;letter-spacing:-.03em;color:${inkOn(ctx, L.dataset.kind)};`, L, esc(d.headline || ''));
      fit(cap, W - 160 * U, 90 * U, 40 * U);
      ctx.tl.fromTo(cap, { opacity: 0, y: 40 * U }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, t0 + 2.6);
      ctx.sfx.push({ t: t0 + 0.6, k: 'whoosh', v: 0.4 }, { t: t0 + 2.4, k: 'whoosh', v: 0.5 }, { t: t0 + 3.0, k: 'chime', v: 0.6 });
      void before;
      return t0 + this.dur;
    },
  };

  // 19. Phone mockup: a phone rises in 3D and its screen scrolls through the product.
  P['photo-phone'] = {
    family: 'photo', label: 'Phone mockup', tags: { energy: 'medium' }, dur: 4.2,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind);
      const side = ctx.pick('phone:side' + salt(ctx), [1, -1]);
      const st = el('div', `position:absolute;inset:0;perspective:${1600 * U}px;`, L);
      const pw = W * 0.56, ph = pw * 2.05;
      const phone = el('div', `position:absolute;left:50%;top:${H * 0.47}px;width:${pw}px;height:${ph}px;margin:${-ph / 2}px 0 0 ${-pw / 2}px;border-radius:${pw * 0.14}px;background:#0B0B0E;padding:${pw * 0.035}px;box-shadow:0 ${80 * U}px ${140 * U}px ${-40 * U}px rgba(0,0,0,.8), inset 0 0 0 ${3 * U}px #2A2A30;`, st);
      const screen = el('div', `position:relative;width:100%;height:100%;border-radius:${pw * 0.11}px;overflow:hidden;background:${look.dark ? '#121217' : '#F6F6F8'};`, phone);
      el('div', `position:absolute;left:50%;top:${pw * 0.03}px;width:${pw * 0.3}px;height:${pw * 0.075}px;margin-left:${-pw * 0.15}px;border-radius:999px;background:#000;z-index:3;`, screen);
      const feed = el('div', 'position:absolute;left:0;right:0;top:0;', screen);
      const sw = pw * 0.93, fg = look.dark ? '#fff' : '#111';
      el('div', `height:${sw * 1.05}px;background:url("${d.img}") center/cover;`, feed);
      el('div', `padding:${sw * 0.06}px;font-family:${look.ui};color:${fg};`, feed, `<b style="display:block;font-size:${sw * 0.085}px">${esc(d.title || '')}</b><span style="display:block;margin-top:${sw * 0.02}px;font-size:${sw * 0.055}px;opacity:.6">${esc(d.subtitle || '')}</span><div style="display:flex;justify-content:space-between;align-items:center;margin-top:${sw * 0.05}px"><b style="font-size:${sw * 0.08}px;color:${look.A}">${esc(d.price || '')}</b><span style="padding:${sw * 0.025}px ${sw * 0.05}px;border-radius:999px;background:${look.A};color:${on(look.A)};font-weight:800;font-size:${sw * 0.05}px">${esc(d.cta || 'Add to cart')}</span></div>`);
      for (let i = 0; i < 3; i++) el('div', `margin:${sw * 0.03}px ${sw * 0.06}px;height:${sw * 0.32}px;border-radius:${sw * 0.05}px;background:${look.dark ? rgba('#FFFFFF', 0.06) : '#FFFFFF'};display:flex;gap:${sw * 0.04}px;align-items:center;padding:${sw * 0.03}px;`, feed, `<span style="width:${sw * 0.26}px;height:${sw * 0.26}px;border-radius:${sw * 0.04}px;background:url('${d.img}') ${30 * i}% 50%/300%"></span><span style="flex:1"><i style="display:block;height:${sw * 0.03}px;width:70%;border-radius:9px;background:${rgba(fg, 0.25)}"></i><i style="display:block;margin-top:${sw * 0.025}px;height:${sw * 0.03}px;width:45%;border-radius:9px;background:${rgba(fg, 0.12)}"></i></span>`);
      const tilt = ez('expo.out'), drift = ez('sine.inOut');
      drive(ctx, t0, 4.2, (p) => { const a = tilt(clamp(p / 0.3)), b = drift(clamp((p - 0.2) / 0.8)); phone.style.transform = `translateY(${(1 - a) * H * 0.6}px) rotateX(${lerp(40, 8, a) - 4 * b}deg) rotateY(${side * (lerp(-30, -14, a) + 10 * b)}deg) rotateZ(${side * lerp(-10, -2, a)}deg)`; });
      ctx.tl.fromTo(feed, { y: 0 }, { y: -sw * 0.75, duration: 1.4, ease: 'power3.inOut' }, t0 + 1.6);
      const tag = el('div', `position:absolute;left:${side > 0 ? 70 * U : W * 0.42}px;right:${side > 0 ? W * 0.42 : 70 * U}px;top:${H * 0.1}px;font-family:${look.display};font-weight:${look.dw};font-size:${88 * U}px;line-height:1;letter-spacing:-.03em;color:${ink};text-align:${side > 0 ? 'left' : 'right'};`, L, esc(d.headline || ''));
      ctx.tl.fromTo(tag, { opacity: 0, y: 40 * U }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, t0 + 0.6);
      ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.5 }, { t: t0 + 1.6, k: 'tick', v: 0.4 });
      return t0 + this.dur;
    },
  };

  // 20. Kinetic type wall: rows of words stream across, one row lit in the brand colour.
  P['text-marquee'] = {
    family: 'text', label: 'Type wall', tags: { energy: 'high' }, dur: 3.8,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind);
      const angle = ctx.pick('marquee:angle' + salt(ctx), [0, -10, -6, 8]);
      const wall = el('div', `position:absolute;left:-30%;right:-30%;top:50%;transform:translateY(-50%) rotate(${angle}deg);`, L);
      const words = d.words || ['FRESH', 'FAST', 'LOCAL'];
      const rows = 9, hot = 4;
      for (let i = 0; i < rows; i++) {
        const row = el('div', `white-space:nowrap;font-family:${look.display};font-weight:${look.dw};font-size:${170 * U}px;line-height:1.02;letter-spacing:-.03em;text-transform:uppercase;${i === hot ? `color:${look.A};` : i % 2 ? `color:transparent;-webkit-text-stroke:${2.5 * U}px ${rgba(ink, 0.35)};` : `color:${rgba(ink, 0.9)};`}`, wall, esc((words.join(' · ') + ' · ').repeat(4)));
        const dir = i % 2 ? 1 : -1, w = row.scrollWidth;
        ctx.tl.fromTo(row, { x: dir > 0 ? -w * 0.25 : 0 }, { x: dir > 0 ? 0 : -w * 0.25, duration: 3.8, ease: 'none' }, t0);
        ctx.tl.fromTo(row, { opacity: 0, y: (i - hot) * 30 * U }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }, t0 + Math.abs(i - hot) * 0.06);
      }
      ctx.tl.fromTo(wall, { scale: 1.25 }, { scale: 1, duration: 1.2, ease: 'expo.out' }, t0);
      if (d.brand) { const b = el('div', `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:${30 * U}px ${60 * U}px;background:${look.A};color:${on(look.A)};font-family:${look.display};font-weight:${look.dw};font-size:${110 * U}px;white-space:nowrap;border-radius:${20 * U}px;box-shadow:0 ${30 * U}px ${70 * U}px rgba(0,0,0,.45);`, L, esc(d.brand)); ctx.tl.fromTo(b, { scale: 0, rotation: -8 }, { scale: 1, rotation: angle * 0.5, duration: 0.7, ease: 'back.out(2)' }, t0 + 1.6); ctx.sfx.push({ t: t0 + 1.6, k: 'pop', v: 0.7 }); }
      ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.5 });
      void W; void H;
      return t0 + this.dur;
    },
  };

  // 21. Logo draw: the mark is drawn as a single line, then fills, and the name slides out from behind it.
  P['end-draw'] = {
    family: 'ending', label: 'Logo draw', tags: { energy: 'calm' }, dur: 4.0,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind);
      const shape = ctx.pick('draw:shape' + salt(ctx), ['circle', 'square', 'hex']);
      const S = W * 0.42, cx = W / 2, cy = H * 0.42;
      const s = sv('svg', { width: S, height: S, viewBox: '0 0 200 200', style: `position:absolute;left:${cx - S / 2}px;top:${cy - S / 2}px;overflow:visible;` }, L);
      const outline = shape === 'circle' ? sv('circle', { cx: 100, cy: 100, r: 92 }, s) : shape === 'square' ? sv('rect', { x: 10, y: 10, width: 180, height: 180, rx: 44 }, s) : sv('polygon', { points: '100,6 182,53 182,147 100,194 18,147 18,53' }, s);
      outline.setAttribute('fill', look.A); outline.setAttribute('stroke', look.A); outline.setAttribute('stroke-width', 5); outline.style.fillOpacity = 0;
      const len = outline.getTotalLength ? outline.getTotalLength() : 600; outline.style.strokeDasharray = len; outline.style.strokeDashoffset = len;
      const txt = sv('text', { x: 100, y: 104, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': String(d.mono || 'A').length > 1 ? 86 : 110, 'font-weight': 800, fill: on(look.A), stroke: on(look.A), 'stroke-width': 2, style: `font-family:${look.display}` }, s);
      txt.textContent = d.mono || 'A'; txt.style.fillOpacity = 0; txt.style.strokeDasharray = 400; txt.style.strokeDashoffset = 400;
      ctx.tl.to(outline.style, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' }, t0 + 0.1);
      ctx.tl.to(outline.style, { fillOpacity: 1, duration: 0.5, ease: 'power2.out' }, t0 + 1.2);
      ctx.tl.to(txt.style, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, t0 + 1.0);
      ctx.tl.to(txt.style, { fillOpacity: 1, duration: 0.4 }, t0 + 1.7);
      ctx.tl.fromTo(s, { scale: 1 }, { scale: 0.92, duration: 0.5, ease: 'power2.out' }, t0 + 1.9);
      const name = el('div', `position:absolute;left:0;right:0;top:${cy + S / 2 + 60 * U}px;text-align:center;font-family:${look.display};font-weight:${look.dw};font-size:${100 * U}px;letter-spacing:-.02em;color:${ink};overflow:hidden;white-space:nowrap;`, L);
      const nIn = el('div', '', name, esc(d.name || '')); fit(name, W - 140 * U, 100 * U, 40 * U);
      ctx.tl.fromTo(nIn, { yPercent: -110 }, { yPercent: 0, duration: 0.9, ease: 'expo.out' }, t0 + 2.0);
      if (d.tagline) { const tg = el('div', `position:absolute;left:0;right:0;top:${cy + S / 2 + 60 * U + name.offsetHeight + 16 * U}px;text-align:center;font-family:${look.ui};font-weight:600;font-size:${34 * U}px;letter-spacing:.28em;text-transform:uppercase;color:${rgba(ink, 0.65)};`, L, esc(d.tagline)); ctx.tl.fromTo(tg, { opacity: 0 }, { opacity: 1, duration: 0.8 }, t0 + 2.5); }
      ctx.sfx.push({ t: t0 + 0.1, k: 'whoosh', v: 0.3 }, { t: t0 + 1.7, k: 'chime', v: 0.7 });
      void H;
      return t0 + this.dur;
    },
  };

  // 22. Split slam: the frame splits into two colours that slam together, one word in each half.
  P['open-split'] = {
    family: 'opener', label: 'Split slam', tags: { energy: 'high' }, dur: 3.4,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx;
      const vert = ctx.pick('slam:axis' + salt(ctx), [true, false]);
      const a = el('div', `position:absolute;${vert ? 'left:0;right:0;top:0;height:50%;' : 'top:0;bottom:0;left:0;width:50%;'}background:${look.A};display:flex;align-items:${vert ? 'flex-end' : 'center'};justify-content:center;overflow:hidden;`, L);
      const b = el('div', `position:absolute;${vert ? 'left:0;right:0;bottom:0;height:50%;' : 'top:0;bottom:0;right:0;width:50%;'}background:${mix(look.A2, '#000000', 0.05)};display:flex;align-items:${vert ? 'flex-start' : 'center'};justify-content:center;overflow:hidden;`, L);
      const [w1, w2] = String(d.headline || 'Big|News').split('|');
      const txt = (box, t, c) => { const x = el('div', `font-family:${look.display};font-weight:${look.dw};font-size:${(vert ? 240 : 150) * U}px;line-height:.92;letter-spacing:-.04em;color:${c};white-space:nowrap;${vert ? '' : 'writing-mode:vertical-rl;transform:rotate(180deg);'}${look.upper ? 'text-transform:uppercase;' : ''}`, box, esc(t)); fit(x, vert ? W - 100 * U : H * 0.8, (vert ? 240 : 150) * U, 50 * U); return x; };
      const t1 = txt(a, w1 || '', on(look.A)), t2 = txt(b, w2 || '', on(look.A2));
      ctx.tl.fromTo(a, vert ? { yPercent: -100 } : { xPercent: -100 }, { yPercent: 0, xPercent: 0, duration: 0.55, ease: 'power4.out' }, t0);
      ctx.tl.fromTo(b, vert ? { yPercent: 100 } : { xPercent: 100 }, { yPercent: 0, xPercent: 0, duration: 0.55, ease: 'power4.out' }, t0 + 0.08);
      ctx.tl.fromTo([t1, t2], { scale: 2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'power4.out', stagger: 0.12 }, t0 + 0.4);
      ctx.tl.fromTo(L, { x: 0 }, { keyframes: [{ x: -14 * U, duration: 0.05 }, { x: 12 * U, duration: 0.05 }, { x: -6 * U, duration: 0.05 }, { x: 0, duration: 0.05 }], immediateRender: false }, t0 + 0.55);
      ctx.tl.to(a, vert ? { yPercent: -4 } : { xPercent: -4 }, { duration: 2.6, ease: 'sine.inOut' }, t0 + 0.8);
      ctx.tl.to(b, vert ? { yPercent: 4 } : { xPercent: 4 }, { duration: 2.6, ease: 'sine.inOut' }, t0 + 0.8);
      if (d.sub) { const s = el('div', `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:${16 * U}px ${34 * U}px;border-radius:999px;background:#fff;color:#111;font-family:${look.ui};font-weight:800;font-size:${36 * U}px;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;box-shadow:0 ${20 * U}px ${50 * U}px rgba(0,0,0,.35);`, L, esc(d.sub)); ctx.tl.fromTo(s, { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(2.5)' }, t0 + 1.0); }
      ctx.sfx.push({ t: t0, k: 'whoosh', v: 0.6 }, { t: t0 + 0.55, k: 'pop', v: 0.6 });
      return t0 + this.dur;
    },
  };

  // 23. Cinematic photo: letterbox bars close in, the photo pushes in slowly, the line types in the lower third.
  P['photo-cinema'] = {
    family: 'photo', label: 'Cinematic shot', tags: { energy: 'calm' }, dur: 4.0,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx;
      const move = ctx.pick('cine:move' + salt(ctx), ['in', 'pan', 'out']);
      const ph = el('div', `position:absolute;inset:-8%;background:url("${d.img}") center/cover;filter:saturate(1.15) contrast(1.05);`, L);
      const from = move === 'in' ? { scale: 1, x: 0 } : move === 'out' ? { scale: 1.2, x: 0 } : { scale: 1.12, x: -W * 0.05 }, to = move === 'in' ? { scale: 1.18 } : move === 'out' ? { scale: 1.02 } : { scale: 1.12, x: W * 0.05 };
      ctx.tl.fromTo(ph, from, { ...to, duration: 4.2, ease: 'sine.inOut' }, t0);
      el('div', `position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,.1) 40%, rgba(0,0,0,.85) 100%);`, L);
      const bar = H * 0.1, top = el('div', `position:absolute;left:0;right:0;top:0;height:${bar}px;background:#000;`, L), bot = el('div', `position:absolute;left:0;right:0;bottom:0;height:${bar}px;background:#000;`, L);
      ctx.tl.fromTo(top, { yPercent: -100 }, { yPercent: 0, duration: 0.9, ease: 'expo.out' }, t0);
      ctx.tl.fromTo(bot, { yPercent: 100 }, { yPercent: 0, duration: 0.9, ease: 'expo.out' }, t0);
      const kick = el('div', `position:absolute;left:${80 * U}px;bottom:${bar + 260 * U}px;font-family:${look.ui};font-weight:700;font-size:${30 * U}px;letter-spacing:.32em;text-transform:uppercase;color:${look.A};`, L, esc(d.kicker || ''));
      const line = el('div', `position:absolute;left:${80 * U}px;right:${80 * U}px;bottom:${bar + 80 * U}px;font-family:${look.display};font-weight:${look.dw};font-size:${92 * U}px;line-height:1.02;letter-spacing:-.02em;color:#fff;`, L);
      const cs = chars(line, d.headline || ''); fit(line, W - 160 * U, 92 * U, 40 * U);
      ctx.tl.fromTo(kick, { opacity: 0, x: -20 * U }, { opacity: 1, x: 0, duration: 0.8, ease: 'expo.out' }, t0 + 0.8);
      ctx.tl.fromTo(cs, { opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.4, stagger: 0.03 }, t0 + 1.0);
      ctx.sfx.push({ t: t0 + 0.1, k: 'whoosh', v: 0.3 });
      void H;
      return t0 + this.dur;
    },
  };

  // 24. Price compare: two bars grow; theirs is tall, yours is small, the saving pops out.
  P['info-compare'] = {
    family: 'info', label: 'Price compare', tags: { energy: 'medium' }, dur: 3.8,
    build(ctx, L, t0, d) {
      const { W, H, U, look } = ctx, ink = inkOn(ctx, L.dataset.kind);
      const head = el('div', `position:absolute;left:${80 * U}px;right:${80 * U}px;top:${H * 0.12}px;font-family:${look.display};font-weight:${look.dw};font-size:${110 * U}px;line-height:1;letter-spacing:-.03em;color:${ink};`, L, esc(d.headline || ''));
      ctx.tl.fromTo(head, { opacity: 0, y: 30 * U }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, t0);
      const base = H * 0.8, bw = W * 0.3, maxH = H * 0.42;
      [[d.them || 'Others', d.themPrice || '₦10,000', 1, rgba(ink, 0.18), ink], [d.us || 'Us', d.usPrice || '₦6,000', d.ratio || 0.6, look.A, on(look.A)]].forEach(([lab, price, k, bg, fg], i) => {
        const x = W * (i ? 0.58 : 0.12), h = maxH * k;
        const bar = el('div', `position:absolute;left:${x}px;top:${base - h}px;width:${bw}px;height:${h}px;border-radius:${30 * U}px ${30 * U}px ${10 * U}px ${10 * U}px;background:${bg};transform-origin:50% 100%;display:flex;align-items:flex-start;justify-content:center;padding-top:${30 * U}px;font-family:${look.display};font-weight:${look.dw};font-size:${62 * U}px;color:${fg};`, L, esc(price));
        el('div', `position:absolute;left:${x}px;top:${base + 24 * U}px;width:${bw}px;text-align:center;font-family:${look.ui};font-weight:700;font-size:${40 * U}px;color:${rgba(ink, 0.75)};`, L, esc(lab));
        ctx.tl.fromTo(bar, { scaleY: 0 }, { scaleY: 1, duration: 1.0, ease: 'expo.out' }, t0 + 0.5 + i * 0.3);
      });
      if (d.save) { const b = el('div', `position:absolute;left:${W * 0.5}px;top:${base - maxH * 0.95}px;padding:${18 * U}px ${34 * U}px;border-radius:999px;background:${look.A2};color:${on(look.A2)};font-family:${look.ui};font-weight:900;font-size:${44 * U}px;white-space:nowrap;box-shadow:0 ${20 * U}px ${40 * U}px rgba(0,0,0,.3);`, L, esc(d.save)); ctx.tl.fromTo(b, { scale: 0, rotation: -20 }, { scale: 1, rotation: -6, duration: 0.6, ease: 'back.out(2.5)' }, t0 + 1.6); ctx.sfx.push({ t: t0 + 1.6, k: 'pop', v: 0.7 }); }
      return t0 + this.dur;
    },
  };
})();
