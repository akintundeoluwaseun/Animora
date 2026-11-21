// Creative QA: sales language never lands on personal videos; invented contact details are caught; real business ads are untouched.
import assert from 'node:assert/strict';
import { creativeQA, qaHtml, qaPlan } from '../server/ai/standard.js';
import { cleanBrief } from '../server/ai/brief.js';

const bday = cleanBrief({ kind: 'personal', name: 'Tony', category: 'Birthday' });
assert.equal(creativeQA(bday, ['Happy birthday Tony']).pass, true);
for (const bad of ['Visit our website', 'Call us now', 'Order now', 'www.shop.com', '0803 123 4567']) assert.equal(creativeQA(bday, [bad]).pass, false, bad);
const biz = cleanBrief({ kind: 'business', name: 'Kemi Cakes', category: 'Bakery', contact: '0803 123 4567 · kemicakes.com' });
assert.equal(creativeQA(biz, ['Call us now', '0803 123 4567', 'kemicakes.com']).pass, true, 'a business keeps its own details and sales lines');
assert.equal(creativeQA(biz, ['0701 999 8888']).pass, false, 'an invented phone number is caught even for a business');
const html = qaHtml(bday, '<h1>Happy birthday</h1><p>Visit our website</p><script>go("Call us now")</script>').html;
assert.ok(!/visit our|call us/i.test(html));
const plan = qaPlan(bday, { scenes: [{ purpose: 'hook', on_screen_text: ['Happy birthday Tony'] }, { purpose: 'cta', on_screen_text: ['Call us now'] }] });
assert.ok(!/call us/i.test(JSON.stringify(plan)) && plan.qa.fixed === 1);
console.log('All creative QA checks passed');

// ---- generality: burial / memorial / announcement / events never get shop lines
{
  const { cleanBrief, autoStyleSlug } = await import('../server/ai/brief.js');
  const { videoGroup, closingLine } = await import('../server/ai/closing.js');
  const assertOk = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  for (const cat of ['Burial', 'Funeral service', 'Obituary', 'Celebration of life', 'Condolence', 'Tribute']) {
    const b = cleanBrief({ category: cat, name: 'Adeyemi family', ctas: ['Visit our website', 'Order now'] });
    assertOk(videoGroup(b) === 'social', cat + ' is social');
    assertOk(closingLine(b) === 'Forever in our hearts', cat + ' closing line');
    assertOk(!(b.ctas || []).length, cat + ' keeps no shop CTA');
    assertOk(['mono-editorial', 'graphite-pro', 'prime-estate'].includes(autoStyleSlug(b)), cat + ' calm look');
  }
  for (const cat of ['Announcement', 'Church programme', 'School event', 'Conference', 'Music concert']) {
    const b = cleanBrief({ category: cat, name: 'Greenfield', ctas: ['Visit our store'] });
    assertOk(videoGroup(b) === 'social', cat + ' is social');
    assertOk(!/order now/i.test(closingLine(b)), cat + ' closing line');
    assertOk(!(b.ctas || []).length, cat + ' keeps no shop CTA');
  }
  assertOk(videoGroup(cleanBrief({ category: 'Funeral home', kind: 'business', name: 'Peace Funeral Home' })) === 'business', 'a funeral home is a business');
  console.log('generality checks passed');
}

// ---- a pasted prompt: the instruction never becomes the title, and nothing is shown twice
{
  const { cleanBrief, parseBriefRules } = await import('../server/ai/brief.js');
  const { factsOf } = await import('../server/ai/pieces/index.js');
  const { composeStory } = await import('../server/ai/story/index.js');
  const bad = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const cases = [
    ['Create a 20 second promo video for Kemi Cakes. We sell cupcakes and wedding cakes in Lekki. Call 08031234567.', 'Kemi Cakes', 'business'],
    ['Make a video announcing that Greenfield School resumes on Monday 5 January 2027. Keep it professional.', 'Greenfield School', 'announcement'],
    ['Please design a short tribute video for the late Chief Adeyemi, burial on Friday 21 November at St Paul Church, Ibadan.', 'Late Chief Adeyemi', 'personal'],
    ['Write me a video ad for my church programme "Night of Glory" this Sunday 6pm at Grace Chapel.', 'Night of Glory', 'event'],
  ];
  for (const [p, name, kind] of cases) {
    const b = cleanBrief({ ...parseBriefRules(p), pasteText: p });
    bad(b.name === name, `name for "${p.slice(0, 30)}" was "${b.name}"`);
    bad(b.kind === kind, `kind for ${name} was ${b.kind}`);
    const f = factsOf({}, b, [{ id: '1', kind: 'image', url: '/x/1.jpg', name: '1.jpg', width: 1200, height: 1600 }]);
    const beats = composeStory({ facts: f, duration: 30, seed: 5, look: 'editorial', aspect: '9:16' });
    const texts = beats.flatMap((x) => [x.data.headline, x.data.text, x.data.cta].filter(Boolean)).map((x) => x.toLowerCase());
    bad(new Set(texts).size === texts.length, `${name}: text repeated on screen: ${texts.join(' | ')}`);
    bad(!/generate|create a|make a|design a|write me|\bvideo\b/i.test(JSON.stringify(beats)), `${name}: instruction words on screen`);
    bad(!beats.some((x) => /^(business|announcement)$/i.test(x.data.label || '')), `${name}: generic label on screen`);
  }
  console.log('pasted-prompt checks passed');
}

// ---- "Brother turning 20" typed as a name, and no invented monogram logo
{
  const { cleanBrief } = await import('../server/ai/brief.js');
  const { factsOf } = await import('../server/ai/pieces/index.js');
  const fs = await import('node:fs');
  const bad = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const b = cleanBrief({ kind: 'personal', category: 'Birthday', name: 'Brother turning 20' });
  const f = factsOf({}, b, []);
  bad(b.relationship === 'brother' && b.milestone === '20', 'relationship and age split out');
  bad(f.heads[0] === 'Happy 20th Birthday, Brother!', 'greeting: ' + f.heads[0]);
  for (const file of ['server/ai/motion/browser/motion.js', 'server/ai/runtime/motion.js', 'server/ai/motion/browser/story.js']) {
    bad(/monogram !== true|monogram === true/.test(fs.readFileSync(file, 'utf8')), file + ' still draws a monogram without a logo');
  }
  console.log('name and logo checks passed');
}

// ---- non-business films: no phone-UI beats, and a different film every time
{
  const { composeMotion } = await import('../server/ai/motion/compose.js');
  const { cleanBrief } = await import('../server/ai/brief.js');
  const bad = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const ph = [1, 2, 3, 4].map((i) => ({ id: String(i), kind: 'image', url: `/x/${i}.jpg`, name: `${i}.jpg`, role: 'photo', width: 1200, height: 1600 }));
  for (const b of [
    { kind: 'event', name: 'Night of Glory', category: 'Church event', headline: 'A night of worship', features: ['Live worship', 'Prayer', 'Testimonies'], when: 'Sunday 16 Nov, 6pm' },
    { kind: 'personal', name: 'Late Chief Adeyemi', category: 'Burial or memorial', headline: 'A life well lived', features: ['Born 1948', 'Rested 2026'], when: 'Friday 21 Nov, 10am' },
    { kind: 'announcement', name: 'Greenfield School', category: 'Announcement', headline: 'School resumes Monday', features: ['Uniform check', 'Fees on the portal'] },
  ]) {
    const brief = cleanBrief(b), plan = { aspect_ratio: '9:16', duration_seconds: 24, business: { name: b.name, category: b.category }, scenes: [] };
    const seen = new Set();
    for (const salt of ['', 'a', 'b', 'c', 'd', 'e']) {
      const r = composeMotion(plan, { brief, assets: ph, salt, avoid: [], colors: {}, look: { theme: 'light', energy: 'medium' } });
      const types = r.beats.map((x) => x.type).join('>');
      bad(!/search|notif|receipt|chat|button|toggles|swap|phone|price/.test(types), `${b.name}: shop/phone beat in ${types}`);
      bad(!r.beats.some((x) => x.type === 'icon' && x.mode === 'welcome'), `${b.name}: "Welcome to"`);
      seen.add(types);
    }
    bad(seen.size >= 4, `${b.name}: only ${seen.size} different films in 6 tries`);
  }
  console.log('variety checks passed');
}

// ---- creative direction, flyer information check, film QA
{
  const { directionOf } = await import('../server/ai/direction.js');
  const { autoStyleSlug, cleanBrief } = await import('../server/ai/brief.js');
  const { makeFlyer, flyerCoverage } = await import('../server/ai/flyer.js');
  const { qaBeats } = await import('../server/ai/motion/qa.js');
  const { STARTER_STYLES } = await import('../server/db/starter.js');
  const bad = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const want = { 'Luxury perfume': 'luxury', 'Church programme': 'faith', 'Corporate event': 'corporate', Restaurant: 'restaurant', Bakery: 'bakery', Birthday: 'birthday', 'Real estate': 'realestate', Wedding: 'wedding', 'Music concert': 'music', School: 'education', Announcement: 'announcement' };
  for (const [cat, id] of Object.entries(want)) bad(directionOf({ category: cat, name: 'X' }).id === id, `${cat} should be ${id}, got ${directionOf({ category: cat, name: 'X' }).id}`);
  bad(autoStyleSlug({ category: 'Luxury perfume', name: 'Maison Oud' }) === 'gold-luxe', 'luxury style');
  bad(autoStyleSlug({ category: 'Corporate event', name: 'Summit' }) !== 'glory-light', 'a corporate event is not a church night');
  // a flyer shows everything the owner gave
  for (const b of [
    { kind: 'event', name: 'Night of Glory', category: 'Church programme', headline: 'A night of worship', when: 'Sunday 16 Nov · 6pm · Grace Chapel, Ado', features: ['Live worship', 'Prayer'] },
    { kind: 'business', name: 'Kemi Cakes', category: 'Bakery', headline: 'Fresh cakes, baked daily', features: ['Wedding cakes', 'Cupcakes'], contact: '0803 123 4567', offer: '20% off this week' },
  ]) {
    const cb = cleanBrief(b);
    for (let i = 0; i < 4; i++) {
      const html = await makeFlyer({ brief: cb, plan: {}, style: STARTER_STYLES.find((s) => s.slug === autoStyleSlug(cb)), assets: [], useAI: false });
      const c = flyerCoverage(cb, html);
      bad(c.score > 0.99, `${b.name}: flyer is missing ${c.missing.join(', ')}`);
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  // film QA fixes repeats
  const q = qaBeats([{ type: 'words', bg: 'light', out: 'push', lines: ['Hello there friend'] }, { type: 'words', bg: 'light', out: 'push', lines: ['Second line here'] }, { type: 'words', bg: 'light', out: 'push', lines: ['Second line here'] }, { type: 'end', bg: 'brand', out: 'push', tagline: 'Thanks' }]);
  bad(q.beats.length === 3 && q.beats[0].out !== q.beats[1].out && q.beats.at(-1).type === 'end', 'film QA did not fix repeats');
  // regenerate: the look moves to another one that fits the content; the angle drives the film's structure
  {
    const { directMotion } = await import('../server/ai/motion/director.js');
    const cb = cleanBrief({ kind: 'business', name: 'Mama Put Kitchen', category: 'Restaurant', headline: 'Home-cooked Nigerian meals', features: ['Jollof rice', 'Pounded yam', 'Pepper soup'], contact: '0803 123 4567' });
    const plan = { aspect_ratio: '9:16', duration_seconds: 24, business: { name: cb.name, category: cb.category }, scenes: [] };
    const photos = [1, 2, 3].map((i) => ({ id: String(i), kind: 'image', url: `/u/${i}.jpg`, name: `${i}.jpg`, role: 'photo' }));
    const first = await directMotion({ plan, brief: cb, assets: photos, useAi: false, style: STARTER_STYLES.find((x) => x.slug === 'mono-editorial') });
    let moved = 0;
    for (let i = 0; i < 6; i++) { const r = await directMotion({ plan, brief: cb, assets: photos, useAi: false, salt: `s${i}`, style: STARTER_STYLES.find((x) => x.slug === 'mono-editorial'), prevLook: 'mono-editorial' }); if (r.data.look.key !== 'mono-editorial') moved++; }
    bad(moved === 6, `regenerate kept the same look ${6 - moved}/6 times`);
    let owner = 0;
    for (let i = 0; i < 4; i++) { const r = await directMotion({ plan, brief: { ...cb, lookAuto: 'own' }, assets: photos, useAi: false, salt: `o${i}`, style: STARTER_STYLES.find((x) => x.slug === 'mono-editorial'), prevLook: 'mono-editorial' }); if (r.data.look.key !== 'mono-editorial') owner++; }
    bad(owner === 0, "a look the owner picked themselves was changed on regenerate");
    const seqs = new Set();
    for (let i = 0; i < 12; i++) { const r = await directMotion({ plan, brief: cb, assets: photos, useAi: false, salt: `v${i}` }); seqs.add(r.data.beats.map((b) => b.type).join('>')); { const o = r.data.sig.intended.opening, b0 = r.data.beats[0]; const want = { photoFirst: 'photos:full', atmospheric: 'photos:full', documentary: 'photos:editorial', brandFirst: 'icon', reveal: 'words', story: 'words:left', typo: 'words' }[o]; bad(`${b0.type}${b0.layout ? ':' + b0.layout : ''}`.startsWith(want), `film planned to open "${o}" but opened on ${b0.type}:${b0.layout || b0.mode}`); const e = r.data.beats.at(-1); bad(e.type === 'end' && (e.layout || 'card') === r.data.sig.intended.ending || (r.data.sig.intended.ending === 'photo' && !e.layout), `ending ${e.layout || 'card'} != planned ${r.data.sig.intended.ending}`); bad(!!e.contact || !cb.contact, 'ending lost the contact'); } if (r.data.angle === 'type') bad(r.data.beats.every((b) => ['words', 'highlight', 'stat', 'calendar', 'price', 'countdown', 'ring', 'end', 'button', 'icon'].includes(b.type)), 'type angle used screens or photos'); }
    bad(seqs.size >= 6, `only ${seqs.size} distinct film structures in 12 regenerations`);
  }
  // creative memory: a combination used recently is discouraged, and an owner's own look is never overridden
  {
    const { pickStructure, signatureOf } = await import('../server/ai/motion/structure.js');
    let seed = 12345; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const share = (mem, n = 400) => { let photo = 0, card = 0; for (let i = 0; i < n; i++) { const st = pickStructure({ direction: 'restaurant', angle: 'photos', photos: 3, memory: mem, rnd }); if (st.opening === 'photoFirst') photo++; if (st.ending === 'card') card++; } return { photo: photo / n, card: card / n }; };
    const fresh = share([]);
    const used = share(Array.from({ length: 5 }, () => ({ opening: 'photos:full', ending: 'end:card', photos: 'full', left: 0, lists: 0 })));
    bad(used.photo < fresh.photo * 0.6, `opening memory did not discourage a repeat (${fresh.photo.toFixed(2)} -> ${used.photo.toFixed(2)})`);
    bad(used.card < fresh.card * 0.6, `ending memory did not discourage a repeat (${fresh.card.toFixed(2)} -> ${used.card.toFixed(2)})`);
    const sig = signatureOf([{ type: 'photos', layout: 'full', out: 'zoom' }, { type: 'words', out: 'push' }, { type: 'end', layout: 'poster' }], { key: 'gold-luxe', deco: 'golddust', display: 'Playfair Display' });
    bad(sig.opening === 'photos:full' && sig.ending === 'end:poster' && sig.look === 'gold-luxe', 'signature does not describe the film');
    // a FIRST film keeps the look that fits its business however busy the platform was (recovery: other films' looks are no reason to restyle it);
    // Regenerate moves on; the owner's own pick always stays
    const { directMotion } = await import('../server/ai/motion/director.js');
    const { forget } = await import('../server/ai/motion/memory.js');
    const cb = cleanBrief({ kind: 'business', name: 'Maison Oud', category: 'Luxury perfume', headline: 'The scent of distinction', features: ['Hand-blended oud'] });
    const pl = { aspect_ratio: '9:16', duration_seconds: 20, business: { name: cb.name, category: cb.category }, scenes: [] };
    const crowd = Array.from({ length: 6 }, () => ({ opening: 'words', ending: 'end:card', photos: 'none', look: 'gold-luxe', angle: 'calm' }));
    forget();
    let moved = 0, kept = 0;
    for (let i = 0; i < 8; i++) {
      const a = await directMotion({ plan: pl, brief: cb, assets: [], useAi: false, style: STARTER_STYLES.find((x) => x.slug === 'gold-luxe'), memory: crowd });
      if (a.data.look.key !== 'gold-luxe') moved++;
      const b = await directMotion({ plan: pl, brief: { ...cb, lookAuto: 'own' }, assets: [], useAi: false, style: STARTER_STYLES.find((x) => x.slug === 'gold-luxe'), memory: crowd });
      if (b.data.look.key === 'gold-luxe') kept++;
    }
    bad(moved === 0, `a first film was restyled because of other films (${moved}/8)`);
    let regenMoved = 0;
    for (let i = 0; i < 8; i++) {
      const r = await directMotion({ plan: pl, brief: cb, assets: [], useAi: false, style: STARTER_STYLES.find((x) => x.slug === 'gold-luxe'), memory: [], salt: 'regen', prevLook: 'gold-luxe' });
      if (r.data.look.key !== 'gold-luxe') regenMoved++;
    }
    bad(regenMoved === 8, `Regenerate repeated the same look ${8 - regenMoved}/8 times`);
    bad(kept === 8, "an owner's explicit look was changed by creative memory");
  }
  // the film is exactly as long as the owner chose, even when QA removes a repeated beat
  {
    const { directMotion } = await import('../server/ai/motion/director.js');
    const q2 = qaBeats([{ type: 'words', dur: 3, out: 'push', lines: ['Hello there'] }, { type: 'words', dur: 3, out: 'rise', lines: ['Second line'] }, { type: 'words', dur: 3, out: 'zoom', lines: ['Second line'] }, { type: 'end', dur: 4, out: 'push', tagline: 'Thanks' }], { caps: { words: 3.4, end: 4.2 } });
    bad(Math.abs(q2.beats.reduce((a, b) => a + b.dur, 0) - 13) < 0.05, `QA shortened the film to ${q2.beats.reduce((a, b) => a + b.dur, 0)}s`);
    for (const dur of [12, 17, 24, 30]) for (const o of [
      { kind: 'business', name: 'Kemi Cakes', category: 'Bakery', headline: 'Fresh cakes', features: ['Wedding cakes', 'Cupcakes'], contact: '0803 123 4567' },
      { kind: 'event', name: 'Night of Glory', category: 'Church programme', headline: 'A night of worship', features: ['Worship', 'Prayer'], when: 'Sunday 6pm · Grace Chapel' },
      { kind: 'personal', name: 'Late Chief Adeyemi', category: 'Burial or memorial', headline: 'A life well lived', features: ['Born 1948', 'Rested 2026'] },
    ]) for (let i = 0; i < 6; i++) {
      const b = cleanBrief(o);
      const r = await directMotion({ plan: { aspect_ratio: '9:16', duration_seconds: dur, business: { name: b.name, category: b.category }, scenes: [] }, brief: b, assets: [], useAi: false, salt: `len${i}`, style: STARTER_STYLES.find((x) => x.slug === autoStyleSlug(b)) });
      const sum = r.data.beats.reduce((a, x) => a + x.dur, 0);
      bad(Math.abs(sum - dur) < 0.15, `${o.name} ${dur}s film came out ${sum.toFixed(1)}s`);
    }
  }
  console.log('direction / flyer / film QA checks passed');
}
