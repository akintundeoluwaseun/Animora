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
