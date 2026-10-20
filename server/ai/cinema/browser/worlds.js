  // ================================================================ WORLDS: the look of the whole film
  // studio (default: lamps + bokeh), aurora, grid, spot, paper, blocks, dots, stripes
  (function () {
    const w = D.world || 'studio';
    const L = (css) => el('div', 'abs', bg, '', Object.assign({ pointerEvents: 'none' }, css));
    if (w === 'aurora') {
      [[P.a1, 0.1, 0.2, 1500], [P.a2, 0.9, 0.5, 1400], [P.a1d || P.a1, 0.4, 0.95, 1700]].forEach(([c, x, y, s], i) => {
        const b = L({ width: N(s) + 'px', height: N(s) + 'px', left: (x * W - N(s) / 2) + 'px', top: (y * H - N(s) / 2) + 'px', borderRadius: '46% 54% 62% 38%', background: 'radial-gradient(circle,' + c + 'cc 0%,transparent 64%)', filter: 'blur(' + N(40) + 'px)', mixBlendMode: P.dark ? 'screen' : 'multiply', opacity: P.dark ? 0.3 : 0.8 });
        tl.fromTo(b, { x: 0, y: 0, rotation: 0, scale: 1 }, { x: N(i % 2 ? -380 : 380), y: N(i === 1 ? 420 : -380), rotation: i % 2 ? -140 : 140, scale: 1.4, duration: DUR, ease: 'sine.inOut' }, 0);
      });
    } else if (w === 'grid') {
      const g = L({ left: '-50%', right: '-50%', bottom: '-6%', height: '62%', transform: 'perspective(' + N(900) + 'px) rotateX(64deg)', transformOrigin: '50% 100%', backgroundImage: 'linear-gradient(' + P.a1 + '66 2px,transparent 2px),linear-gradient(90deg,' + P.a1 + '66 2px,transparent 2px)', backgroundSize: N(110) + 'px ' + N(110) + 'px', WebkitMask: 'linear-gradient(to top,#000 20%,transparent 95%)', mask: 'linear-gradient(to top,#000 20%,transparent 95%)' });
      tl.fromTo(g, { backgroundPosition: '0px 0px' }, { backgroundPosition: '0px ' + N(110 * Math.round(DUR * 1.2)) + 'px', duration: DUR, ease: 'none' }, 0);
      const sun = L({ left: '50%', top: '30%', width: px(760), height: px(760), marginLeft: px(-380), borderRadius: '50%', background: 'linear-gradient(180deg,' + P.a2 + ',' + P.a1 + ')', opacity: 0.2, filter: 'blur(' + N(6) + 'px)' });
      tl.fromTo(sun, { y: N(60), scale: 0.94 }, { y: -N(60), scale: 1.06, duration: DUR, ease: 'sine.inOut' }, 0);
    } else if (w === 'spot') {
      const cone = L({ left: '50%', top: '-12%', width: px(1700), height: px(2500), marginLeft: px(-850), background: 'conic-gradient(from 180deg at 50% 0%,transparent 160deg,' + (P.dark ? 'rgba(255,255,255,.28)' : P.a1 + '55') + ' 180deg,transparent 200deg)', filter: 'blur(' + N(18) + 'px)', transformOrigin: '50% 0%' });
      tl.fromTo(cone, { rotation: -14 }, { rotation: 14, duration: DUR, ease: 'sine.inOut' }, 0);
      const pool = L({ left: '50%', top: '62%', width: px(1300), height: px(500), marginLeft: px(-650), borderRadius: '50%', background: 'radial-gradient(ellipse,' + (P.dark ? 'rgba(255,255,255,.18)' : P.a1 + '33') + ',transparent 70%)' });
      tl.fromTo(pool, { x: -N(160) }, { x: N(160), duration: DUR, ease: 'sine.inOut' }, 0);
    } else if (w === 'paper') {
      L({ inset: 0, backgroundImage: 'linear-gradient(' + P.cardLine + ' 1px,transparent 1px)', backgroundSize: '100% ' + N(64) + 'px', opacity: 0.6 });
      [[0.85, 0.12, 520, P.a1], [0.1, 0.88, 640, P.a2]].forEach(([x, y, s, c], i) => { const o = L({ width: N(s) + 'px', height: N(s) + 'px', left: (x * W - N(s) / 2) + 'px', top: (y * H - N(s) / 2) + 'px', borderRadius: i ? '50%' : '38%', background: c, opacity: 0.16 }); tl.fromTo(o, { rotation: 0, y: 0 }, { rotation: i ? 90 : -70, y: N(i ? -140 : 160), duration: DUR, ease: 'sine.inOut' }, 0); });
    } else if (w === 'blocks') {
      const cols = [P.a1, P.a2, P.ink];
      [0, 1, 2].forEach((i) => { const b = L({ left: 0, width: '100%', height: '34%', top: (i * 33) + '%', background: cols[i], opacity: i === 2 ? 0.05 : 0.2 }); tl.fromTo(b, { xPercent: i % 2 ? 100 : -100 }, { xPercent: 0, duration: 0.9, ease: 'expo.out' }, 0.05 + i * 0.1); tl.to(b, { xPercent: i % 2 ? -8 : 8, duration: DUR, ease: 'sine.inOut' }, 1); });
    } else if (w === 'dots') {
      const d = L({ inset: '-10%', backgroundImage: 'radial-gradient(' + P.a1 + ' ' + N(5) + 'px,transparent ' + N(6) + 'px)', backgroundSize: N(56) + 'px ' + N(56) + 'px', opacity: 0.35, WebkitMask: 'radial-gradient(ellipse at 50% 40%,#000 0%,transparent 80%)', mask: 'radial-gradient(ellipse at 50% 40%,#000 0%,transparent 80%)' });
      tl.fromTo(d, { backgroundPosition: '0 0', scale: 1 }, { backgroundPosition: N(280) + 'px ' + N(280) + 'px', scale: 1.15, duration: DUR, ease: 'none' }, 0);
    } else if (w === 'stripes') {
      const s = L({ inset: '-30%', backgroundImage: 'repeating-linear-gradient(115deg,' + P.a1 + '22 0 ' + N(46) + 'px,transparent ' + N(46) + 'px ' + N(120) + 'px)' });
      tl.fromTo(s, { backgroundPosition: '0 0' }, { backgroundPosition: N(900) + 'px 0', duration: DUR, ease: 'none' }, 0);
    }
  })();
