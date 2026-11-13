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
console.log('prompt-reading ok');
