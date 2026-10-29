/* Animora sound engine (runs inside the film's page, on the same timeline the renderer records).
 *
 * 1. events(tl)        reads the template's real GSAP timeline and turns it into visual events, all in integer ms:
 *                      move, appear (text / headline / card / image / logo / ui), slam, zoom, reveal (mask), typing,
 *                      word runs (staggered words), plus scene changes added by the film.
 * 2. choose(events)    asks the sound registry for the best-fitting sound for each event (weighted score over role,
 *                      length, intensity, attack and tone, minus repetition), deterministically from a seed, with
 *                      cooldowns and density limits so it never clicks on every letter.
 * 3. apply overrides   (muted events, swapped sounds, effects volume) by stable event id, so edits to the animation
 *                      move their sounds with them and nothing is duplicated when the timeline is rebuilt.
 *
 * Output: window.__sfx = [{ t (s), k, v, len?, fo?, id, kind, label, alts }]  and  window.__soundEvents (the visual events).
 * Exposes AnimoraSound = { events, choose, plan } for the film page.
 */
(function () {
  'use strict';
  var FPS = 30, FRAME = 1000 / FPS;
  var ms = function (s) { return Math.round(s * 1000); };
  var num = function (x) { return typeof x === 'number' ? x : (typeof x === 'string' && /^-?[\d.]+(px)?$/.test(x) ? parseFloat(x) : null); };
  function rng(seed) { var a = seed >>> 0 || 1; return function () { a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

  // ---------- 1. visual events from the real timeline ----------
  function abs(c, tl) { var st = c.startTime(), p = c.parent; while (p && p !== tl) { st += p.startTime(); p = p.parent; } return st; }
  function keyOf(el) {
    if (!el || !el.getAttribute) return 'obj';
    if (el.id) return '#' + el.id;
    var cls = (el.getAttribute('class') || '').trim().split(/\s+/)[0];
    var sib = el.parentElement ? [].indexOf.call(el.parentElement.children, el) : 0;
    return (el.tagName || 'x').toLowerCase() + (cls ? '.' + cls : '') + ':' + sib;
  }
  // positions are measured against the film's own frame, so they are right whatever size the page is shown at
  function frameOf(el) { var d = el && el.ownerDocument; var f = d && (d.querySelector('[data-composition-id]') || d.getElementById('stage') || d.body); return f && f.getBoundingClientRect ? f.getBoundingClientRect() : null; }
  function describe(el) {
    var F = frameOf(el), W = F && F.width ? F.width : (innerWidth || 1920), H = F && F.height ? F.height : (innerHeight || 1080), L = F ? F.left : 0, T = F ? F.top : 0;
    var r0 = el && el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0, left: 0, top: 0 };
    var r = { width: r0.width, height: r0.height, left: r0.left - L, top: r0.top - T };
    var view = el && el.ownerDocument && el.ownerDocument.defaultView, cs = el && el.nodeType === 1 && view ? view.getComputedStyle(el) : null;
    var txt = el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    var hasImg = !!(el && el.querySelector && (el.tagName === 'IMG' || el.tagName === 'svg' || el.tagName === 'SVG' || el.querySelector('img,svg,canvas,video') || (cs && cs.backgroundImage && cs.backgroundImage !== 'none')));
    var fs = cs ? parseFloat(cs.fontSize) || 0 : 0;
    var boxy = !!(cs && ((cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || parseFloat(cs.borderRadius) > 6 || (cs.boxShadow && cs.boxShadow !== 'none')));
    return { area: (r.width * r.height) / (W * H), cx: (r.left + r.width / 2) / W, cy: (r.top + r.height / 2) / H, text: txt.slice(0, 40), words: txt ? txt.split(' ').length : 0, img: hasImg, fs: fs, boxy: boxy };
  }
  function events(tl, opts) {
    opts = opts || {};
    var D = ms(tl.duration()), out = [], sets = [], seen = {};
    tl.getChildren(true, true, false).forEach(function (c) {
      if (c.getChildren) return;
      var v = c.vars || {}, s = v.startAt || {}, d0 = ms(c.duration()), t0 = ms(abs(c, tl));
      if (t0 > D) return;
      // a staggered tween moves several things one after another: each target is its own event at its own time
      var tg = (c.targets && c.targets()) || [null], each = 0, stg = v.stagger;
      if (tg.length > 1 && stg != null) { each = typeof stg === 'number' ? stg : (stg.each != null ? +stg.each : stg.amount != null ? +stg.amount / Math.max(1, tg.length - 1) : 0); }
      var per = tg.length > 1 && each > 0 ? tg : [tg[0]];
      per.forEach(function (el, ti) { one(c, v, s, el, t0 + ms(each * ti), each > 0 ? Math.max(0, d0 - ms(each * (tg.length - 1))) : d0); });
    });
    function one(c, v, s, el, t, d) {
      var info = describe(el), key = keyOf(el);
      var ease = String(v.ease || ''), back = /back|elastic|bounce/.test(ease);
      if (!(d > 0)) {
        if (t > 200) sets.push({ t: t, move: v.x != null || v.y != null || v.xPercent != null || v.yPercent != null, cut: v.autoAlpha != null || v.opacity != null || v.visibility != null || v.display != null, show: (v.autoAlpha != null && +v.autoAlpha > 0.5) || (v.opacity != null && +v.opacity > 0.5) || v.visibility === 'visible' || (v.display != null && v.display !== 'none'), key: key, info: info });
        return;
      }
      // how far it travels
      var mv = 0;
      ['x', 'y'].forEach(function (k) { var a = num(v[k]), b = num(s[k]); if (a != null || b != null) mv = Math.max(mv, Math.abs((a || 0) - (b || 0))); });
      ['xPercent', 'yPercent'].forEach(function (k) { var a = num(v[k]), b = num(s[k]); if (a != null || b != null) mv = Math.max(mv, Math.abs((a || 0) - (b || 0)) / 100 * (k === 'xPercent' ? (el && el.offsetWidth) || 200 : (el && el.offsetHeight) || 100)); });
      var A = v.autoAlpha != null ? v.autoAlpha : v.opacity, F = s.autoAlpha != null ? s.autoAlpha : s.opacity;
      var enter = v.runBackwards ? (A != null && +A < 0.5) : (A != null && +A >= 0.5 && (F == null || +F < 0.5));
      var leave = !v.runBackwards && A != null && +A < 0.5 && (F == null || +F >= 0.5);
      var sc = num(v.scale), sf = num(s.scale);
      var from = v.runBackwards ? sc : sf, to = v.runBackwards ? 1 : (sc == null ? 1 : sc);
      var grow = from != null && from < 0.8 && to >= 0.95, slam = from != null && from > 1.15 && to <= 1.02 && info.area > 0.02;
      var zoom = (from != null && Math.abs(to - from) > 0.25 && info.area > 0.35 && d >= 350);
      var mask = ['clipPath', 'clip-path', 'webkitClipPath', 'maskSize', 'width'].some(function (k) { return v[k] != null && (k !== 'width' || /^0/.test(String(s.width || ''))); });
      var base = { t: t, dur: d, key: key, parent: el && el.parentElement ? keyOf(el.parentElement) : '', info: info, ease: ease };
      if (mv >= 140 && d >= 180 && d <= 1800) out.push(Object.assign({ kind: 'move', speed: mv / d }, base));
      if (slam) out.push(Object.assign({ kind: 'slam' }, base));
      else if (zoom) out.push(Object.assign({ kind: 'zoom' }, base));
      if (mask && !enter) out.push(Object.assign({ kind: 'reveal' }, base));
      if ((enter || grow) && t > 150) {
        var bareImg = info.img && info.words <= 3;
        var what = info.img && info.area > 0.25 && info.words <= 6 ? 'image' : bareImg ? (info.cx > 0.3 && info.cx < 0.7 ? 'logo' : 'card') : info.img ? 'card'
          : info.fs >= 56 || (info.words && info.area > 0.06) ? 'headline' : info.boxy || back ? 'card' : info.words ? 'text' : 'ui';
        out.push(Object.assign({ kind: 'appear', what: what, spring: back }, base));
      }
      if (leave && info.area > 0.3 && d >= 250) out.push(Object.assign({ kind: 'exit' }, base));
    }
    // instant changes: runs of text changes are typing; runs of position steps are one move; picture swaps are cuts
    sets.sort(function (a, b) { return a.t - b.t; });
    var run = function (list, gap) { var groups = [], g = null; list.forEach(function (x) { if (g && x.t - g[g.length - 1].t < gap) g.push(x); else { g = [x]; groups.push(g); } }); return groups; };
    run(sets.filter(function (x) { return !x.move && !x.cut; }), 220).forEach(function (g) { if (g.length >= 5 && g[g.length - 1].t - g[0].t >= 350) out.push({ kind: 'typing', t: g[0].t, dur: g[g.length - 1].t - g[0].t + 150, key: g[0].key, info: {} }); });
    run(sets.filter(function (x) { return x.move; }), 120).forEach(function (g) { if (g.length >= 2) out.push({ kind: 'move', t: g[0].t, dur: g[g.length - 1].t - g[0].t, key: g[0].key, speed: 1, info: { area: 0.2 }, stepped: true }); });
    // things switched on in quick runs are text being typed or revealed (one typing sound for the run);
    // a picture swapped on its own gets a soft tick; a word or bubble switched on alone is a text appearance
    run(sets.filter(function (x) { return x.cut && x.show; }), 300).forEach(function (g) {
      var texty = g.filter(function (x) { return x.info.words && !x.info.img; }).length >= g.length / 2;
      if (g.length >= 5) { if (texty) out.push({ kind: 'typing', t: g[0].t, dur: g[g.length - 1].t - g[0].t + 150, key: g[0].key, info: g[0].info }); else { var lc = -1e9; g.forEach(function (x) { if (x.t - lc >= 350) { out.push({ kind: 'cut', t: x.t, dur: 0, key: x.key, info: x.info }); lc = x.t; } }); } return; }
      g.forEach(function (x) { if (x.info.img && !x.info.words) out.push({ kind: 'cut', t: x.t, dur: 0, key: x.key, info: x.info }); else if (x.info.words) out.push({ kind: 'appear', what: x.info.boxy ? 'card' : 'text', t: x.t, dur: 0, key: x.key, info: x.info }); });
    });
    // staggered words or letters: several small text appears close together are one word run
    out.sort(function (a, b) { return a.t - b.t; });
    var words = out.filter(function (e) { return e.kind === 'appear' && (e.what === 'text' || e.what === 'headline') && e.info.words <= 2; });
    run(words, 260).forEach(function (g) { if (g.length >= 3) { g.forEach(function (e, i) { e.kind = 'word'; e.index = i; e.of = g.length; }); } });
    // several siblings appearing one after another (list rows, cards, chips) are items of one list
    var byParent = {};
    out.forEach(function (e) { if (e.kind === 'appear' && e.parent && (e.what === 'text' || e.what === 'headline' || e.what === 'card')) (byParent[e.parent] = byParent[e.parent] || []).push(e); });
    Object.keys(byParent).forEach(function (k) { run(byParent[k], 450).forEach(function (g) { if (g.length >= 3) g.forEach(function (e, i) { e.kind = 'item'; e.index = i; e.of = g.length; }); }); });
    // the last prominent appearance is the closing reveal (logo or end title)
    var big = out.filter(function (e) { return (e.kind === 'appear' && (e.what === 'logo' || e.what === 'headline' || e.info.area > 0.15)) || e.kind === 'slam'; });
    var fin = big[big.length - 1]; if (fin && fin.t > D * 0.55) fin.final = true;
    // stable ids: kind + element + its count, so the same visual event keeps the same id after edits
    out.forEach(function (e) { var b = e.kind + '@' + e.key; seen[b] = (seen[b] || 0) + 1; e.id = b + '#' + seen[b]; });
    return out.sort(function (a, b) { return a.t - b.t || a.id.localeCompare(b.id); });
  }

  // ---------- 2. what each event should sound like ----------
  // role wanted, alternatives, preferred length (ms), intensity 0-1, attack ('sharp'|'medium'|'soft'), tone, gain (dB), offset (ms), label
  function request(e, P) {
    var a = e.info.area || 0, prom = Math.min(1, 0.25 + a * 3);
    switch (e.kind) {
      case 'move': return { role: 'whoosh', alt: ['transition'], len: Math.max(180, Math.min(1500, e.dur)), intensity: Math.min(1, 0.35 + (e.speed || 0.5) * 0.4 + a), attack: 'medium', gain: e.stepped ? -4 : a < 0.05 ? -6 : -2, align: 'peak', label: (e.info.text ? '“' + e.info.text.slice(0, 18) + '” ' : 'Element ') + 'moves' };
      case 'slam': return { role: 'impact', alt: [], len: 500, intensity: 0.85, attack: 'sharp', tone: 'dark', gain: 0, label: 'Big title lands' };
      case 'zoom': return { role: 'zoom', alt: ['whoosh', 'riser'], len: e.dur, intensity: 0.6, attack: 'soft', gain: -4, label: 'Camera zoom' };
      case 'reveal': return { role: 'whoosh', alt: ['shimmer', 'transition'], len: e.dur, intensity: 0.4, attack: 'soft', gain: -6, label: 'Mask reveal' };
      case 'typing': return { role: 'typing', alt: [], len: e.dur, intensity: 0.4, attack: 'soft', gain: -8, loop: true, label: 'Typing' };
      case 'cut': return { role: 'tick', alt: ['click', 'blip'], len: 80, intensity: 0.3, attack: 'sharp', tone: 'bright', gain: -9, label: 'Picture changes' };
      case 'exit': return null;   // restraint: things leaving are silent unless they travel (then they are a move)
      case 'item': return e.what === 'card' || P.appear === 'ding' ? { role: P.appear === 'ding' ? 'ding' : 'pop', alt: ['pop', 'click'], len: 160, intensity: 0.4, attack: 'sharp', gain: -7, label: 'List item ' + (e.index + 1) + ' appears' } : { role: 'tick', alt: ['click', 'blip'], len: 80, intensity: 0.3, attack: 'sharp', tone: 'bright', gain: -9, label: 'List item ' + (e.index + 1) + ' appears' };
      case 'word': return { role: 'tick', alt: ['blip', 'click'], len: 60, intensity: 0.25, attack: 'sharp', tone: 'bright', gain: -12, label: 'Word ' + (e.index + 1) + ' appears' };
      case 'scene': return { role: 'transition', alt: ['whoosh'], len: 450, intensity: 0.6, attack: 'medium', gain: -3, align: 'peak', label: 'Scene change' };
      case 'appear':
        if (e.final) return { role: e.what === 'logo' ? 'impact' : 'impact', alt: ['sting', 'shimmer'], len: 600, intensity: 0.8, attack: 'medium', tone: 'dark', gain: -1, riser: true, label: e.what === 'logo' ? 'Logo reveal' : 'Final title' };
        if (P.appear === 'ding' && (e.what === 'card' || e.what === 'text')) return { role: 'ding', alt: ['pop'], len: 300, intensity: 0.5, attack: 'sharp', tone: 'bright', gain: -5, label: 'Notification arrives' };
        if (e.what === 'headline') return { role: 'pop', alt: ['whoosh', 'shimmer'], len: 250, intensity: 0.5 * prom + 0.3, attack: 'medium', gain: -4, label: 'Headline appears' };
        if (e.what === 'card') return { role: 'pop', alt: ['click'], len: 180, intensity: 0.45, attack: e.spring ? 'sharp' : 'medium', gain: -5, label: 'Card pops in' };
        if (e.what === 'image') return { role: 'shimmer', alt: ['riser', 'transition'], len: Math.max(400, e.dur), intensity: 0.3, attack: 'soft', gain: -12, label: 'Picture fades in' };
        if (e.what === 'logo') return { role: 'pop', alt: ['ding'], len: 250, intensity: 0.5, attack: 'medium', gain: -5, label: 'Logo appears' };
        if (e.what === 'ui') return { role: 'click', alt: ['tick'], len: 90, intensity: 0.35, attack: 'sharp', gain: -8, label: 'Button appears' };
        return { role: 'tick', alt: ['blip', 'pop'], len: 90, intensity: 0.25, attack: 'sharp', tone: 'bright', gain: -10, label: 'Text appears' };
    }
    return null;
  }

  function score(s, q, recent, r, pack) {
    // interface packs (uisfx): a film uses one family; the others (and all of them when no pack is set) stay out
    if (s.key.indexOf('ui-') === 0 && (!pack || s.key.indexOf('ui-' + pack + '-') !== 0)) return -99;
    var sc = s.role === q.role ? 6 : q.alt.indexOf(s.role) >= 0 ? 3 - q.alt.indexOf(s.role) * 0.5 : -99;
    if (sc < 0) return sc;
    if (pack && s.key.indexOf('ui-' + pack + '-') === 0) sc += 2.8;              // the film's own pack leads the small moments
    var len = s.useful * 1000;
    sc -= Math.min(3, Math.abs(Math.log((len + 40) / (q.len + 40))) * 1.6);   // length fits the motion
    sc -= Math.abs((s.intensity || 0.5) - q.intensity) * 2.2;                  // as strong as the moment
    if (q.attack && s.transient) sc += s.transient === q.attack ? 1 : (q.attack === 'sharp' && s.transient === 'soft') || (q.attack === 'soft' && s.transient === 'sharp') ? -1.2 : 0;
    if (q.tone && s.tone) sc += s.tone === q.tone ? 0.8 : -0.4;
    if (s.key.indexOf('mg-') === 0) sc += 0.4;                                 // the hand-picked motion kit first
    var last = recent[s.key]; if (last != null) sc -= 2.5;                     // don't repeat the same take back to back
    return sc + r() * 0.6;                                                     // seeded variety between equal fits
  }

  // density: minimum gap (ms) between two sounds of the same role, and an overall budget per second
  var PRI = { impact: 6, sting: 5, transition: 4, whoosh: 3, zoom: 3, ding: 3, typing: 2, pop: 2, shimmer: 2, click: 1, tick: 1, blip: 1, riser: 0 };
  var COOL = { whoosh: 260, transition: 300, pop: 140, tick: 110, click: 110, blip: 110, ding: 380, impact: 900, riser: 1800, typing: 500, shimmer: 1200, zoom: 800, sting: 2000 };

  function choose(evs, REG, P, opts) {
    // nothing else speaks over the closing hit
    var finals = evs.filter(function (e) { return e.final; }).map(function (e) { return e.t; });
    evs = evs.filter(function (e) { return e.final || !finals.some(function (f) { return Math.abs(e.t - f) < 160; }); });
    P = P || {}; opts = opts || {};
    var r = rng(hash((opts.seed || 'animora') + '|' + evs.length)), recent = {}, lastByRole = {}, out = [], ov = opts.overrides || {};
    var mute = {}; (ov.mute || []).forEach(function (id) { mute[id] = 1; });
    var gainAll = typeof ov.sfxGain === 'number' ? ov.sfxGain : 0;            // dB
    var density = ov.density || 'normal', wordEvery = density === 'low' ? 3 : density === 'high' ? 1 : 2;
    var byKey = {}; REG.forEach(function (s) { byKey[s.key] = s; });
    evs.forEach(function (e) {
      var q = request(e, e.P || P); if (!q) return;
      if (e.kind === 'word' && e.index % wordEvery !== 0 && e.index !== e.of - 1) return;   // restraint on word runs
      if (density === 'low' && (e.kind === 'cut' || (e.kind === 'appear' && e.what === 'text'))) return;
      // two events on the same frame (a card and the icon inside it): only the more important one sounds
      var prev = out.length ? out[out.length - 1] : null;
      if (prev && !prev.muted && Math.abs(prev.at * 1000 - e.t) < 60 && prev.kind !== 'build-up') { if ((PRI[q.role] || 0) <= (PRI[prev.role] || 0)) return; out.pop(); }
      var cool = COOL[q.role] || 150;
      if (lastByRole[q.role] != null && e.t - lastByRole[q.role] < cool && !e.final) return;
      var ranked = REG.map(function (s) { return [score(s, q, recent, r, ov.pack), s]; }).filter(function (x) { return x[0] > -50; }).sort(function (a, b) { return b[0] - a[0]; });
      if (!ranked.length) return;
      var pick = ranked[0][1];
      if (ov.swap && ov.swap[e.id] && byKey[ov.swap[e.id]]) pick = byKey[ov.swap[e.id]];
      // line the sound's loudest moment up with the motion: whooshes peak as the move is fastest, hits land on the frame
      var off = q.align === 'peak' ? -Math.min(160, Math.max(0, pick.attack * 1000 - FRAME)) - FRAME * 2 : 0;
      var ev = { t: Math.max(0, e.t + off) / 1000, k: pick.key, role: q.role, v: +Math.pow(10, (q.gain + gainAll) / 20).toFixed(3), id: e.id, kind: e.kind + (e.what ? ':' + e.what : ''), label: q.label, at: e.t / 1000, alts: ranked.slice(0, 6).map(function (x) { return x[1].key; }) };
      if (q.loop) ev.len = +(e.dur / 1000).toFixed(3);
      if (pick.useful * 1000 > e.dur * 1.6 && q.role !== 'impact' && q.role !== 'riser' && e.dur > 0) ev.fo = Math.max(80, Math.round(e.dur * 1.2));   // long tail on a short move fades out
      if (mute[e.id]) { ev.muted = true; ev.v = 0; }
      out.push(ev);
      recent[pick.key] = e.t; lastByRole[q.role] = e.t;
      if (q.riser && e.t > 2400) {
        var rs = REG.filter(function (s) { return s.role === 'riser' && s.useful > 1.2 && s.useful < 3 && s.transient !== 'sharp'; }).sort(function (a, b) { return Math.abs(a.useful - 2) - Math.abs(b.useful - 2); })[0];
        // the riser ENDS on the hit
        if (rs) { var rid = 'riser@' + e.id; var rv = { t: Math.max(0, e.t - rs.useful * 1000) / 1000, k: (ov.swap && ov.swap[rid]) || rs.key, v: +Math.pow(10, (-9 + gainAll) / 20).toFixed(3), id: rid, kind: 'build-up', label: 'Build-up into the ending', at: e.t / 1000, alts: [rs.key] };
          if (mute[rid]) { rv.muted = true; rv.v = 0; } out.push(rv); }
      }
    });
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  // events measured on a template's own clock, moved onto the film's clock (g: seconds -> seconds) with an id prefix
  function remapEvents(list, g, offsetMs, prefix) {
    return list.map(function (e) { var t0 = Math.round(g(e.t / 1000) * 1000), t1 = Math.round(g((e.t + (e.dur || 0)) / 1000) * 1000);
      return Object.assign({}, e, { t: t0 + (offsetMs || 0), dur: Math.max(0, t1 - t0), id: (prefix || '') + e.id }); });
  }
  window.AnimoraSound = { events: events, choose: choose, request: request, remapEvents: remapEvents };
})();
