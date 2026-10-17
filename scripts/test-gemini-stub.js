// Tests the real-Gemini code paths with a stubbed Gemini API (no key or internet needed):
// plan extraction from chat, code generation with auto-repair, edits, and the fallback
// to the template engine when Gemini fails.
import { readFile } from 'node:fs/promises';

process.env.GEMINI_API_KEY = 'stub';
process.env.AI_MODE = 'gemini';
process.env.AUTH = 'on';
const sample = await readFile('samples/sample-15s.html', 'utf8');
const plan = JSON.parse(await readFile('samples/plan-30s.json', 'utf8'));
plan.duration_seconds = 15;
plan.scenes = [{ id: 1, start: 0, end: 15, purpose: 'cta', on_screen_text: ['Order now', '0803 123 4567'] }];

let script = [];
const calls = [];
globalThis.fetch = async (url, init) => {
  if (!String(url).includes('generativelanguage')) throw new Error('unexpected fetch ' + url);
  const body = JSON.parse(init.body);
  calls.push({ url: String(url), system: body.systemInstruction.parts[0].text, last: body.contents.at(-1).parts.at(-1).text, headers: init.headers });
  const next = script.shift();
  if (next instanceof Error) return { ok: false, status: 500, text: async () => next.message };
  return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: next }] } }] }) };
};

const { chatTurn, generateCode, editCode } = await import('../server/ai/index.js');
let fails = 0;
const ok = (n, c, d = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
const user = { plan: 'free' };

// 1. Chat: a normal question, then a plan
script = ['What is the name of your business?'];
let r = await chatTurn({ history: [{ role: 'user', text: 'hi' }], user, style: { name: 'Naija Bold', rules: 'big type' }, assets: [] });
ok('chat reply passes through', r.reply === 'What is the name of your business?' && r.source === 'gemini');
ok('API key sent as header, not in URL', calls[0].headers['x-goog-api-key'] === 'stub' && !calls[0].url.includes('key='));
ok('style rules reach the planner prompt', calls[0].system.includes('Naija Bold') && calls[0].system.includes('between 15 and 60 seconds'));

script = ['Great, here is your plan!\n```adflash-plan\n' + JSON.stringify(plan) + '\n```'];
r = await chatTurn({ history: [{ role: 'user', text: 'yes go ahead' }], user, style: null, assets: [] });
ok('plan extracted from chat', r.plan?.duration_seconds === 15 && !r.reply.includes('adflash-plan'));

// 2. Director: Gemini directs the shots, the motion engine animates them
const assets = [{ name: 'logo', url: 'http://img.test/logo.png', kind: 'image', role: 'logo', width: 400, height: 400, has_alpha: true }];
const dplan = { ...plan, duration_seconds: 15, aspect_ratio: '16:9', business: { name: 'TechDesk' }, cta: 'Visit techdesk.space',
  scenes: [{ id: 1, start: 0, end: 15, purpose: 'cta', on_screen_text: ['TechDesk', 'Visit techdesk.space'] }] };
const beatsJson = JSON.stringify({ beats: [
  { shot: 'logo', seconds: 2.5, text: 'TechDesk', cut: 'dive' },
  { shot: 'flip', seconds: 2, text: 'Meet your AI assistant', cut: 'focus' },
  { shot: 'chat', seconds: 3, text: 'Can you fix my laptop?', sub: 'Yes! Book in 2 taps.', cut: 'morph' },
  { shot: 'nonsense', seconds: 2, text: 'Built for Ado Ekiti' },
  { shot: 'lockup', seconds: 3, text: 'TechDesk', subs: ['techdesk.space'], button: 'Try the AI chatbot' } ] });
script = [beatsJson];
const g = await generateCode({ plan: dplan, style: { name: 'Midnight Glow', palette: { theme: 'midnight' } }, assets, brief: { extra: 'Zoom into the logo of the chatbot first' } });
ok('director builds the video', g.source === 'gemini' && g.html.includes('engine=motion-v3') && g.html.includes('"shot":"logo"'));
ok('special instructions reach the director', calls.at(-1).last.includes('Zoom into the logo of the chatbot first'));
ok('director prompt lists the shot menu', calls.at(-1).system.includes('iconmorph') && calls.at(-1).system.includes('dive'));
ok('unknown shots are repaired', !g.html.includes('nonsense') && g.html.includes('"cut":{"type":"dive"'));

// 3. One model busy -> the next model answers (no template fallback)
script = [new Error('overloaded'), new Error('overloaded'), beatsJson];
const b2 = await generateCode({ plan: dplan, style: { palette: { theme: 'midnight' } }, assets });
ok('busy model falls back to the next model', b2.source === 'gemini' && /gemini/.test(calls.at(-1).url) && calls.at(-1).url !== calls.at(-3).url);

// 4. Gemini fully down -> rule-based arrangement, with a notice
script = Array(12).fill(0).map(() => new Error('overloaded'));
const f = await generateCode({ plan, style: { palette: { theme: 'luxe' } }, assets: [] });
ok('falls back to the motion engine rules', f.source === 'template' && f.html.includes('window.__timeline') && !!f.notice);

// 5. Edit by prompt on a directed video: beats + colours change
script = [JSON.stringify({ beats: JSON.parse(beatsJson).beats.slice(1), colors: { primary: '#1F8A4C' }, summary: 'Removed the logo opening and made it green.' })];
const e = await editCode({ html: g.html, instruction: 'remove the logo intro, make it green', aspectRatio: '16:9', duration: 15, plan: dplan, assets });
ok('edit via the director', e.source === 'gemini' && e.html.includes('--primary: #1F8A4C') && !e.html.includes('"shot":"logo"') && e.summary.includes('green'));

// 6. Guided questions: suggestions and plan from the answers
const { suggest, briefToPlan } = await import('../server/ai/brief.js');
script = [JSON.stringify({ options: ['Your AI helper, 24/7', 'Fix it faster', 'Smart help for your PC'] })];
const sug = await suggest('headline', { name: 'TechDesk', category: 'Tech & software' });
ok('headline suggestions from Gemini', sug.length === 3 && sug[0].includes('AI'));
script = [JSON.stringify({ title: 'TechDesk launch', scenes: [{ purpose: 'hook', seconds: 4, on_screen_text: ['Meet TechDesk'] }, { purpose: 'cta', seconds: 5, on_screen_text: ['Visit techdesk.space'] }], cta: 'Visit techdesk.space' })];
const bp = await briefToPlan({ name: 'TechDesk', aspect: '16:9', duration: 20, headline: 'Meet TechDesk' }, { assets: [], limits: { minSeconds: 15, maxSeconds: 60 } });
ok('plan from answers keeps the chosen format', bp.source === 'gemini' && bp.plan.aspect_ratio === '16:9' && bp.plan.duration_seconds === 20 && bp.plan.scenes.at(-1).end === 20);

console.log(fails ? `\n${fails} check(s) failed` : '\nAll Gemini-path checks passed');
process.exit(fails ? 1 : 0);
