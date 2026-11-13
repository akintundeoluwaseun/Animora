// The length the owner asked for is a constraint: 15/20/30/60 s plans keep their length, content is merged/trimmed by priority,
// hook/brand/CTA always stay, the owner is told what was left out, and a genuinely impossible request is explained (never silent).
process.env.GEMINI_API_KEY = '';
const { cleanBrief, briefToPlanRules, fitScenes } = await import('../server/ai/brief.js');
let failed = 0;
const bad = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } };
const limits = { minSeconds: 15, maxSeconds: 300 };
const rich = cleanBrief({ name: 'Ade Foods', category: 'restaurant', location: 'Lekki', phone: '0800 111', headlines: ['Fresh daily', 'Free delivery', 'Open late', 'Catering for events', 'Family packs'], offer: '20% off Fridays', cta: 'Order today', products: ['Jollof 2500', 'Rice 2800', 'Chops 1500'], features: ['Fast', 'Fresh', 'Fair'] });
for (const d of [15, 20, 30, 60]) {
  const p = briefToPlanRules({ ...rich, duration: d, aspect: '9:16' }, { assets: [], limits });
  bad(p.duration_seconds === d, `${d}s requested but plan is ${p.duration_seconds}s`);
  bad(p.scenes[0].purpose === 'hook' && p.scenes.at(-1).purpose === 'cta', `${d}s plan lost its hook or call to action`);
  bad(p.scenes.length <= Math.max(3, Math.floor(d / 3)), `${d}s plan has ${p.scenes.length} scenes (under 3 s each)`);
  if (d === 15) bad(p.duration_note, '15s plan with lots of content gave no note about what was left out');
}
const sc = (purpose, t) => ({ purpose, on_screen_text: [t], images: [] });
const scenes = [sc('hook', 'A'), sc('detail', 'b'), sc('detail', 'c'), sc('detail', 'd'), sc('brand', 'E'), sc('cta', 'F')];
const r = fitScenes(scenes, 15);
bad(scenes.length <= 5 && scenes[0].purpose === 'hook' && scenes.some((s) => s.purpose === 'brand') && scenes.at(-1).purpose === 'cta', 'fitScenes dropped hook/brand/cta');
bad(fitScenes([sc('hook', 'a'), sc('brand', 'b'), sc('cta', 'c'), sc('cta', 'd'), sc('brand', 'e'), sc('hook', 'f')], 15).impossible > 15, 'impossible content was not reported');
const bd = cleanBrief({ name: 'Tola', relationship: 'sister', milestone: '30', personalMessage: 'You are kind. You are bold. You shine. You inspire. You laugh. You lead.', category: 'birthday' });
const bp = briefToPlanRules({ ...bd, duration: 15, aspect: '9:16' }, { assets: [], limits });
bad(bp.duration_seconds === 15, `birthday 15s became ${bp.duration_seconds}s`);
console.log(failed ? `${failed} FAILED` : 'duration tests passed');
process.exit(failed ? 1 : 0);
