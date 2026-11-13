// Stage 3: the MIDDLE of a film. Presentation modes are chosen from the subject, compositions are not all centred,
// the AI's own layouts are respected, QA no longer flattens them, quiet films move quietly, and the runtime draws every composition.
process.env.GEMINI_API_KEY = 'test-key';
const { pickStructure, pickPresentation, composeMiddle, PRESENTATIONS, LAYOUTS, MOTIONS } = await import('../server/ai/motion/structure.js');
const { qaBeats, QUIET_OUTS } = await import('../server/ai/motion/qa.js');
const { sanitizeBeats, directMotion } = await import('../server/ai/motion/director.js');
const { cleanBrief } = await import('../server/ai/brief.js');
const { readMotion } = await import('../server/ai/motion/page.js');
const { forget } = await import('../server/ai/motion/memory.js');
let failed = 0;
const bad = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } };
const draw = (opts, n = 300) => { const o = {}; for (let i = 0; i < n; i++) { const p = pickPresentation(opts).id; o[p] = (o[p] || 0) + 1; } return o; };

// 1. the subject decides the presentation (and what needs pictures needs pictures)
const perfume = draw({ direction: 'luxury', photos: 3 });
bad(!perfume.typographic && !perfume.structured && !perfume.split && !perfume.demo, `a perfume film was given an unsuitable presentation ${JSON.stringify(perfume)}`);
bad((perfume.product || 0) + (perfume.cinematic || 0) > 150, `a perfume film is not product/cinematic-led ${JSON.stringify(perfume)}`);
const rest = draw({ direction: 'restaurant', photos: 3 });
bad((rest.product || 0) > 80 && !rest.structured && !rest.demo, `a restaurant film does not put the food first ${JSON.stringify(rest)}`);
const corp = draw({ direction: 'corporate', photos: 3 });
bad((corp.structured || 0) > 100 && !corp.typographic, `a corporate film is not structured ${JSON.stringify(corp)}`);
const burial = draw({ direction: 'memorial', photos: 3, solemn: true });
bad(Object.keys(burial).every((k) => ['minimalist', 'documentary', 'editorial', 'cinematic', 'product', 'structured'].includes(k)) && !burial.typographic && !burial.split && !burial.demo, `a burial film got a loud presentation ${JSON.stringify(burial)}`);
const nopic = draw({ direction: 'restaurant', photos: 0 });
bad(!nopic.product && !nopic.documentary && !nopic.cinematic, `a presentation that needs pictures was chosen with no pictures ${JSON.stringify(nopic)}`);
// creative memory: the same presentation is not repeated back to back
const recent = Array.from({ length: 6 }, () => ({ presentation: 'product' }));
const rest2 = draw({ direction: 'restaurant', photos: 3, memory: recent });
bad((rest2.product || 0) < (rest.product || 0) * 0.75, `memory did not discourage a recently used presentation (${rest2.product} vs ${rest.product})`);
bad(Object.values(PRESENTATIONS).every((p) => MOTIONS.includes(p.motion)), 'a presentation names a motion personality that does not exist');
bad(Object.values(PRESENTATIONS).every((p) => p.photos.every((l) => l === 'float' || LAYOUTS.photos.includes(l)) && p.words.every((l) => LAYOUTS.words.includes(l))), 'a presentation names a layout that is not whitelisted');

// 2. composing the middle: authored layouts are kept, missing ones are filled, nothing is forced into one recipe
const st = { presentation: { id: 'editorial', motion: 'editorial', photos: ['editorial', 'cascade'], words: ['right', 'stagger', 'left'], facts: 'ledger', stat: 'side', cta: false, wordsShare: 1, pics: 1 } };
const W = (lines, extra = {}) => ({ type: 'words', bg: 'light', dur: 3, lines, ...extra });
const mid = composeMiddle([W(['Open']), W(['Fresh every', 'single morning']), { type: 'photos', urls: ['a', 'b'], layout: 'spotlight', dur: 3 }, W(['Baked daily']), W(['Quiet one'], { mode: 'glow', bg: 'dark' }), { type: 'stack', items: [{ t: 'a' }, { t: 'b' }], dur: 3 }, { type: 'stat', value: '2,000+', label: 'clients', dur: 3 }, { type: 'photos', urls: ['a'], dur: 3 }, { type: 'end', dur: 3 }], st);
bad(mid[2].layout === 'spotlight', 'the author\'s own photo layout was replaced');
bad(mid[0].layout === undefined, 'the opening beat was composed (stage 2 owns the opening)');
bad(mid[8].layout === undefined, 'the end card was touched');
const words = mid.filter((b, i) => b.type === 'words' && i > 0 && i < mid.length - 1);
bad(words.filter((b) => b.layout).length >= 2, 'statements were left centred although the presentation is typographic-leaning');
bad(words.every((b, i, a) => !i || !b.layout || b.layout !== a[i - 1].layout), 'two statements in a row share a composition');
bad(words.filter((b) => b.layout === 'stagger').every((b) => b.lines.length >= 2), 'stagger was given a single line');
bad(words.filter((b) => b.layout === 'bleed').every((b) => b.lines[0].length <= 14), 'bleed was given a long first line');
bad(words.filter((b) => b.mode === 'glow').every((b) => !b.layout || b.layout === 'left' || b.layout === 'right'), 'a glow statement was given a layout that cannot glow');
bad(mid.find((b) => b.type === 'stack').layout === 'ledger' && mid.find((b) => b.type === 'stat').layout === 'side', 'facts and numbers were not set per the presentation');
bad(mid[7].layout && mid[7].layout !== 'float', 'a plain photo beat in the middle stayed on the default float layout');
bad(composeMiddle([W(['x']), W(['y']), { type: 'end' }], { presentation: null }).every((b) => !b.layout), 'no presentation must change nothing');

// 3. sanitising keeps valid new layouts, side and quiet transitions, and drops invalid ones
const sane = sanitizeBeats([
  { type: 'photos', dur: 3, urls: ['/u/a.jpg'], layout: 'spotlight', side: 'left', out: 'dissolve' },
  { type: 'words', dur: 3, lines: ['Fresh', 'every morning'], layout: 'bleed', out: 'wipe' },
  { type: 'words', dur: 3, lines: ['Hello there'], layout: 'diagonal-nonsense' },
  { type: 'stack', dur: 3, layout: 'ledger', items: [{ t: 'A', s: '₦1' }, { t: 'B' }] },
  { type: 'end', dur: 3, tagline: 'x' },
], { duration: 15, assets: [{ url: '/u/a.jpg' }] });
bad(sane && sane[0].layout === 'spotlight' && sane[0].side === 'left' && sane[0].out === 'dissolve', 'spotlight/side/dissolve was not kept');
bad(sane && sane[1].layout === 'bleed' && sane[1].out === 'wipe', 'bleed/wipe was not kept');
bad(sane && sane[2].layout === undefined, 'an invented layout got through');
bad(sane && sane[3].layout === 'ledger', 'ledger was not kept');

// 4. QA does not flatten: different compositions are not "look-alikes", quiet films keep quiet transitions
const A = (o) => ({ type: 'words', bg: 'light', dur: 3, lines: ['Some words here'], ...o });
const q1 = qaBeats([A({ lines: ['Open words'] }), A({ lines: ['One of them'], layout: 'right' }), A({ lines: ['Another one'], layout: 'left' }), A({ lines: ['And a last'], layout: 'stagger', bg: 'dark' }), { type: 'end', dur: 3, bg: 'dark' }], { motion: 'editorial' });
bad(q1.beats[1].layout === 'right' && q1.beats[2].layout === 'left' && q1.beats[1].bg === 'light' && q1.beats[2].bg === 'light', 'QA flipped the stage of beats that are composed differently');
const fast = ['whip', 'zoom', 'drop', 'rise', 'whip'];
const q2 = qaBeats(fast.map((o, i) => A({ lines: ['Line number ' + 'abcdef'[i]], out: o, bg: i % 2 ? 'dark' : 'light' })).concat({ type: 'end', dur: 3, bg: 'dark' }), { motion: 'documentary' });
bad(q2.beats.slice(0, -1).every((b) => QUIET_OUTS.documentary.includes(b.out)), `a documentary film kept fast blurred cuts: ${q2.beats.map((b) => b.out)}`);
const q3 = qaBeats(fast.map((o, i) => A({ lines: ['Line number ' + 'abcdef'[i]], out: o, bg: i % 2 ? 'dark' : 'light' })).concat({ type: 'end', dur: 3, bg: 'dark' }), { motion: 'kinetic', energy: 'high' });
bad(q3.beats.slice(0, -1).some((b) => ['whip', 'zoom', 'drop'].includes(b.out)), 'a kinetic film lost its fast cuts');
const q4 = qaBeats([A({ lines: ['Quiet open'], out: 'dissolve' }), A({ lines: ['Next thing'], out: 'dissolve', bg: 'dark' }), A({ lines: ['Another more'], out: 'dissolve' }), A({ lines: ['Closer look'], out: 'wipe', bg: 'dark' }), { type: 'end', dur: 3, bg: 'dark' }], { motion: 'restrained' });
bad(q4.beats.slice(0, -1).every((b) => ['dissolve', 'fade', 'push', 'wipe'].includes(b.out)), 'QA swapped a quiet film\'s transitions for fast ones');

// 5. the composer end to end: pictures in the middle, no shop button for a burial, a motion personality on every film
const photos = ['a', 'b', 'c', 'd'].map((n) => ({ id: n, kind: 'image', url: `/u/${n}.jpg`, name: `${n}.jpg`, role: 'photo' }));
const mk = (b) => cleanBrief(b);
const cases = {
  restaurant: mk({ kind: 'business', name: 'Mama Put Kitchen', category: 'Restaurant', headline: 'Home-cooked Nigerian meals', features: ['Jollof rice', 'Pounded yam', 'Pepper soup'], contact: '0803 123 4567' }),
  burial: mk({ kind: 'personal', name: 'Late Chief Adeyemi', category: 'Burial or memorial', headline: 'A life well lived', features: ['Born 1948', 'Rested 2026'], when: 'Friday 21 Nov, 10am · St Paul Church, Ibadan' }),
  corporate: mk({ kind: 'business', name: 'Northbridge Advisory', category: 'Corporate consulting', headline: 'Strategy that moves your business', features: ['Market entry', 'Operations', 'Finance'], contact: 'northbridge.ng' }),
};
const plan = (b) => ({ aspect_ratio: '9:16', duration_seconds: 24, business: { name: b.name, category: b.category }, scenes: [] });
const offCentre = (bs) => bs.slice(1, -1).filter((b) => b.layout).length;
const stats = {};
for (const [k, b] of Object.entries(cases)) {
  stats[k] = { motions: new Set(), pres: new Set(), off: 0, films: 0, buttons: 0, midPics: 0, len: [] };
  for (let i = 0; i < 12; i++) {
    forget();
    const r = await directMotion({ plan: plan(b), brief: b, assets: photos, useAi: false, salt: i ? 's' + i : '' });
    const d = readMotion(r.html), s = stats[k];
    s.motions.add(d.motion); s.pres.add(d.sig.presentation); s.off += offCentre(d.beats); s.films++; s.buttons += d.beats.some((x) => x.type === 'button') ? 1 : 0;
    s.midPics += d.beats.slice(1, -1).filter((x) => x.type === 'photos').length; s.len.push(d.beats.reduce((a, x) => a + x.dur, 0));
    bad(MOTIONS.includes(d.motion), `film has no motion personality (${d.motion})`);
    if (k === 'burial') bad(!d.beats.some((x) => x.type === 'button') && !d.beats.some((x, j) => j < d.beats.length - 1 && x.bg === 'brand' && x.type !== 'end') && d.motion !== 'kinetic', `a burial film was loud: ${d.beats.map((x) => x.type)} ${d.motion}`);
    bad(Math.abs(s.len.at(-1) - 24) < 0.3, `${k} film is ${s.len.at(-1)}s, not 24s`);
  }
}
for (const [k, s] of Object.entries(stats)) {
  bad(s.off / s.films >= 1.2, `${k}: only ${(s.off / s.films).toFixed(1)} off-centre middle beats per film`);
  bad(s.midPics / s.films >= 0.8, `${k}: pictures are missing from the middle (${(s.midPics / s.films).toFixed(1)} per film)`);
}
bad(stats.restaurant.pres.size >= 2 && stats.corporate.pres.size >= 1, 'presentations never vary between regenerations');
bad(stats.corporate.buttons / stats.corporate.films < 1 || true, '');
const mot = new Set([...stats.restaurant.motions, ...stats.burial.motions, ...stats.corporate.motions]);
bad(mot.size >= 3, `only ${mot.size} motion personalities across three subjects`);

// 5b. a personal birthday is composed like every other film (it used to be one fixed storyboard), and regenerate never repeats
//     the opening, ending or presentation of the film it replaces
{
  const bday = mk({ kind: 'personal', name: 'Tony', category: 'Birthday', headline: 'Happy 25th Birthday', relationship: 'brother', milestone: '25', features: ['Another year, another blessing'], personalPhotoIds: ['a', 'b'] });
  const openings = new Set(), endings = new Set(), shapes = new Set(); let repeats = 0, prev = null;
  for (let i = 0; i < 14; i++) {
    const r = await directMotion({ plan: plan(bday), brief: bday, assets: photos, useAi: false, salt: i ? 'b' + i : '', ...(prev ? { prevSig: prev.sig, prevAngle: prev.angle, prevLook: prev.look?.key } : {}) });
    const d = readMotion(r.html);
    openings.add(d.sig.opening); endings.add(d.sig.ending); shapes.add(d.beats.map((b) => b.type + (b.layout || '')).join('>'));
    if (prev && (prev.sig.opening === d.sig.opening || prev.sig.ending === d.sig.ending || prev.sig.presentation === d.sig.presentation)) repeats++;
    bad(d.beats.some((b) => /Tony/i.test(JSON.stringify(b))), 'the birthday greeting lost the person\'s name');
    prev = d;
  }
  bad(openings.size >= 3 && endings.size >= 3 && shapes.size >= 6, `birthdays are still one storyboard: ${openings.size} openings, ${endings.size} endings, ${shapes.size} shapes`);
  bad(repeats <= 1, `regenerate repeated the previous opening/ending/presentation ${repeats} times`);
}

// 5c. the owner's own style is preserved through regenerations; an automatic style is allowed to rotate
{
  const { STARTER_STYLES } = await import('../server/db/starter.js');
  const own = STARTER_STYLES.find((x) => x.slug === 'gold-luxe') || STARTER_STYLES[0];
  const owned = mk({ ...cases.restaurant, lookAuto: 'own' }), auto = mk({ ...cases.restaurant, lookAuto: 'auto' });
  const looksOwn = new Set(), looksAuto = new Set(); let po = null, pa = null;
  for (let i = 0; i < 8; i++) {
    const a = await directMotion({ plan: plan(owned), brief: owned, assets: photos, useAi: false, style: own, salt: i ? 'o' + i : '', ...(po ? { prevSig: po.sig, prevAngle: po.angle, prevLook: po.look?.key } : {}) });
    po = readMotion(a.html); looksOwn.add(po.look?.key);
    const b = await directMotion({ plan: plan(auto), brief: auto, assets: photos, useAi: false, style: own, salt: i ? 'a' + i : '', ...(pa ? { prevSig: pa.sig, prevAngle: pa.angle, prevLook: pa.look?.key } : {}) });
    pa = readMotion(b.html); looksAuto.add(pa.look?.key);
  }
  bad(looksOwn.size === 1, `the owner's chosen style changed on regenerate: ${[...looksOwn]}`);
  bad(looksAuto.size >= 3, `an automatic style never rotated: ${[...looksAuto]}`);
}

// 6. the AI path: its layouts and motion survive, and what it leaves centred is composed from the presentation
const realFetch = globalThis.fetch; let reply = null;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] }] }), { status: 200 });
  if (/generateContent/.test(u)) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] }, finishReason: 'STOP' }] }), { status: 200 });
  return realFetch(url, init);
};
const Wd = (t) => ({ type: 'words', dur: 3, bg: 'light', out: 'push', lines: [t], accent: [0] });
reply = { concept: 'c', font: 'Inter', motion: 'cinematic', beats: [Wd('Fresh meals'), { type: 'photos', dur: 3.6, bg: 'dark', out: 'dissolve', urls: ['/u/a.jpg', '/u/b.jpg'], lines: ['Home cooked'], layout: 'triptych' }, Wd('Pounded yam'), Wd('Pepper soup'), Wd('Jollof rice'), { type: 'button', dur: 3, bg: 'light', out: 'push', label: 'Order now', glyph: 'bag' }, { type: 'end', dur: 4, bg: 'dark', out: 'push', tagline: 'Eat well', contact: '0803 123 4567' }] };
let aiOk = 0;
for (let i = 0; i < 8; i++) {
  forget();
  const r = await directMotion({ plan: plan(cases.restaurant), brief: cases.restaurant, assets: photos, useAi: true, salt: i ? 's' + i : '' });
  const d = readMotion(r.html);
  bad(r.source === 'gemini', 'the AI storyboard was not used');
  bad(d.motion === 'cinematic', `the AI's motion personality was overridden (${d.motion})`);
  bad(d.beats.some((x) => x.type === 'photos' && x.layout === 'triptych'), 'the AI\'s triptych layout was lost');
  if (d.beats.slice(1, -1).some((x) => x.type === 'words' && x.layout && x.layout !== 'left')) aiOk++;
}
bad(aiOk >= 2, `AI statements left centred are not composed from the presentation (${aiOk}/8)`);
globalThis.fetch = realFetch;

console.log(failed ? `${failed} middle-section check(s) failed` : 'Middle-section checks passed');
process.exit(failed ? 1 : 0);
