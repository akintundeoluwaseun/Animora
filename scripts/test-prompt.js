// The words used to ASK for a video must never become its content; what the owner described must.
import assert from 'node:assert/strict';
import { parseBriefRules, cleanBrief, briefToPlanRules, stripAsk } from '../server/ai/brief.js';
const texts = (p) => p.scenes.flatMap((s) => s.on_screen_text).join(' | ');
const run = (p) => { const b = cleanBrief({ ...parseBriefRules(p), mode: 'paste' }); return { b, plan: briefToPlanRules(b, { assets: [] }) }; };

let r = run('Use this prompt to make a video: we sell cupcakes and wedding cakes in Lekki, call 08035550101');
assert.ok(!/prompt|make a video|\bwe\b/i.test(texts(r.plan)), 'instruction echoed: ' + texts(r.plan));
assert.match(r.b.name, /cupcakes/i);

r = run('make a video for Techwave Repairs, a laptop repair business. Is your laptop crashing again? Visit 12 Allen Avenue, Ikeja or call 0803 555 0101');
assert.equal(r.b.name, 'Techwave Repairs');
assert.equal(r.b.headline, 'Is your laptop crashing again?');
assert.match(r.b.contact, /12 Allen Avenue, Ikeja(?!\s*or)/);
assert.ok(!/ or\b/.test(r.b.contact), r.b.contact);
assert.ok(!/make a video/i.test(texts(r.plan)));

r = run('A music app called Music mart. It helps people listen and make good music.');
assert.equal(r.b.name, 'Music mart'); assert.equal(r.b.category, 'Music app');
assert.ok(!/\.[a-z]/.test(texts(r.plan)) && !/\.com/i.test(texts(r.plan)), texts(r.plan));

assert.equal(parseBriefRules('Create a 30 second ad for Mama Tee Kitchen').duration, 30);
assert.ok(!/create/i.test(stripAsk('Can you please create a video about Mama Tee Kitchen')));
// category intelligence: phone/app screens only for apps; no ghost numerals; closing never headlines a description
import { composeMotion } from '../server/ai/motion/compose.js';
import { autoStyleSlug } from '../server/ai/brief.js';
import fs from 'node:fs';
const beatsFor = (brief) => { const b = cleanBrief(brief); const pl = briefToPlanRules({ ...b, aspect: '9:16', duration: 20 }, { assets: [] }); const out = []; for (let i = 0; i < 12; i++) out.push(...composeMotion(pl, { brief: b, assets: [], salt: 's' + i }).beats); return out; };
const lap = beatsFor({ kind: 'business', name: 'Techwave Repairs', category: 'Laptop repair business', headline: 'Is your laptop crashing again?', contact: '0803 555 0101' });
assert.ok(!lap.some((x) => ['phone', 'toggles'].includes(x.type)), 'a laptop repair shop got phone/app screens');
const perf = beatsFor({ kind: 'business', name: 'Maison Oud', category: 'Luxury perfume', headline: 'The scent of distinction', features: ['Hand-blended oud', 'Limited edition'] });
assert.ok(!perf.some((x) => ['phone', 'toggles', 'search', 'notif'].includes(x.type)), 'a perfume brand got app screens');
const app = beatsFor({ kind: 'business', name: 'Music mart', category: 'Music app', headline: 'Listen and make good music', features: ['Playlists', 'Offline mode'] });
assert.ok(app.some((x) => ['phone', 'toggles', 'notif'].includes(x.type)), 'an app lost its phone screens');
for (const n of ['Mama Put Kitchen', 'Chop Life', 'Buka Hut', 'Suya Spot']) assert.notEqual(autoStyleSlug({ kind: 'business', name: n, category: 'Restaurant' }), 'mono-editorial', 'restaurant got the pale editorial look');
const motionSrc = fs.readFileSync(new URL('../server/ai/motion/browser/motion.js', import.meta.url), 'utf8');
assert.ok(!/padStart\(2, '0'\);\s*\n\s*tl\.fromTo\(num, \{ y: N\(40\) \}/.test(motionSrc), 'ghost numeral is back');
assert.ok(lap.filter((x) => x.type === 'end').every((x) => x.generic || !x.tagline || x.layout !== 'poster'), 'closing headlines a description');
console.log('prompt-reading ok');
