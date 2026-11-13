// The AI-written film path with the network stubbed (no real Gemini key needed).
// Runs the REAL director: prompt building -> Gemini reply -> sanitising -> structure conformance -> QA -> page.
// Checks what Gemini is told, and that what it decides survives into the film that gets rendered.
process.env.GEMINI_API_KEY = 'test-key';
const { directMotion } = await import('../server/ai/motion/director.js');
const { cleanBrief } = await import('../server/ai/brief.js');
const { readMotion } = await import('../server/ai/motion/page.js');
const { forget } = await import('../server/ai/motion/memory.js');
let failed = 0;
const bad = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } };

const brief = cleanBrief({ kind: 'business', name: 'Mama Put Kitchen', category: 'Restaurant', headline: 'Home-cooked Nigerian meals', features: ['Jollof rice', 'Pounded yam', 'Pepper soup'], contact: '0803 123 4567' });
const photos = ['a', 'b', 'c'].map((n) => ({ id: n, kind: 'image', url: `/u/${n}.jpg`, name: `${n}.jpg`, role: 'photo' }));
const plan = { aspect_ratio: '9:16', duration_seconds: 24, business: { name: brief.name, category: brief.category }, scenes: [] };

let reply = null, lastBody = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] }] }), { status: 200 });
  if (/generateContent/.test(u)) { lastBody = JSON.parse(init.body); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] }, finishReason: 'STOP' }] }), { status: 200 }); }
  return realFetch(url, init);
};
const ai = (beats, extra = {}) => ({ concept: 'A test film', font: 'Inter', beats, ...extra });
const run = async (salt = '') => { forget(); return directMotion({ plan, brief, assets: photos, useAi: true, salt }); };
const H = (t) => ({ type: 'words', dur: 3, bg: 'light', out: 'push', lines: [t], accent: [0] });

// 1. what Gemini is told
reply = ai([H('Fresh meals'), { type: 'icon', dur: 3, bg: 'light', out: 'push', mode: 'wordmark' }, H('Pounded yam'), H('Pepper soup'), { type: 'end', dur: 4, bg: 'brand', out: 'push', tagline: 'Eat well', contact: '0803 123 4567' }]);
let r = await run();
const prompt = lastBody.contents[0].parts.at(-1).text, system = lastBody.systemInstruction.parts[0].text;
bad(/THE STRUCTURE \(fixed, from the content\)/.test(prompt) && /OPENING:/.test(prompt) && /ENDING:/.test(prompt), 'prompt does not carry the structure');
bad(!/hook that stops the thumb.*the brand \(icon\).*the end card/s.test(system), 'system prompt still prescribes one universal recipe');
bad(/layout/.test(system) && /editorial/.test(system), 'beat library does not describe layouts');
bad(r.source === 'gemini', 'the stubbed AI storyboard was not used');

// 2. an AI storyboard that ignores layouts: the structure fills them in (end card and photos follow the planned structure)
let planned = null;
for (let i = 0; i < 25 && !planned; i++) { r = await run(); if (r.data.sig.intended.ending !== 'card') planned = r.data; }
bad(planned && planned.beats.at(-1).layout === planned.sig.intended.ending || (planned && planned.sig.intended.ending === 'photo' && planned.beats.at(-1).layout !== 'minimal'), 'a layout-less AI end card did not follow the planned ending');
bad(planned.beats.at(-1).contact === '0803 123 4567', 'the end card lost the contact');

// 3. what the AI chooses itself is kept (its own opening, its own layouts, its own ending)
reply = ai([
  { type: 'photos', dur: 3.6, bg: 'dark', out: 'zoom', urls: ['/u/a.jpg', '/u/b.jpg'], lines: ['Home-cooked meals'], accent: [1], layout: 'split' },
  { type: 'words', dur: 3, bg: 'light', out: 'rise', lines: ['Jollof rice and more'], accent: [0], layout: 'left' },
  { type: 'photos', dur: 3.6, bg: 'light', out: 'push', urls: ['/u/c.jpg', '/u/a.jpg'], lines: [], layout: 'editorial' },
  H('Pounded yam, pepper soup'),
  { type: 'end', dur: 4, bg: 'light', out: 'push', tagline: 'Eat well', contact: '0803 123 4567', layout: 'minimal' },
]);
r = await run();
const b = r.data.beats;
bad(b[0].type === 'photos' && b[0].layout === 'split', `AI opening replaced (${b[0].type}:${b[0].layout})`);
bad(b.some((x) => x.type === 'words' && x.layout === 'left'), 'AI left-set statement lost');
bad(b.some((x) => x.type === 'photos' && x.layout === 'editorial'), 'AI editorial photo layout lost');
bad(b.at(-1).layout === 'minimal', `AI ending replaced (${b.at(-1).layout})`);
bad(r.data.sig.opening === 'photos:split' && r.data.sig.ending === 'end:minimal', 'the signature does not describe what the AI actually made');
// the rendered page carries the same layouts
const page = readMotion(r.html);
bad(page.beats[0].layout === 'split' && page.beats.at(-1).layout === 'minimal', 'the page that gets rendered lost the layouts');

// 4. bad AI output is cleaned, not trusted
reply = ai([{ ...H('x'), layout: 'sideways' }, { type: 'photos', dur: 3, urls: ['/u/zzz.jpg'], layout: 'full' }, { type: 'words', mode: 'slam', lines: ['Big'], layout: 'left', dur: 2 }, H('Pepper soup now'), H('Jollof rice'), { type: 'end', layout: 'photo', url: '/not/theirs.jpg', tagline: 'Eat', contact: '0803 123 4567', dur: 4 }]);
r = await run();
bad(r.data.beats.every((x) => !x.layout || ['full', 'split', 'editorial', 'left', 'minimal', 'poster', 'photo'].includes(x.layout)), 'an invented layout got through');
bad(!r.data.beats.some((x) => x.type === 'words' && x.mode === 'slam' && x.layout), 'slam words got a left layout');
const e = r.data.beats.at(-1);
bad(e.layout !== 'photo' || photos.some((p) => p.url === e.url), 'end photo used a picture the owner never gave');

// 5. an AI storyboard that repeats itself loses the repeat, never the owner's chosen length
reply = ai([H('Fresh meals'), H('Pounded yam'), H('Pounded yam'), H('Pepper soup'), { type: 'end', dur: 4, bg: 'brand', out: 'push', tagline: 'Eat well', contact: '0803 123 4567' }]);
r = await run();
const aiLen = r.data.beats.reduce((a, x) => a + x.dur, 0);
bad(Math.abs(aiLen - 24) < 0.2, `an AI film with a repeated beat came out ${aiLen.toFixed(1)}s instead of 24s`);

globalThis.fetch = realFetch;
console.log(failed ? `${failed} Gemini-path check(s) failed` : 'Gemini-path checks passed (network stubbed)');
process.exit(failed ? 1 : 0);
