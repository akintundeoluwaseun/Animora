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
