import assert from 'node:assert/strict';
import { config } from '../server/config.js';
import { cleanBrief, parseBriefRules, briefToPlanRules } from '../server/ai/brief.js';
import { factsOf, piecesFilm } from '../server/ai/pieces/index.js';
import { composeStory } from '../server/ai/story/index.js';
import { composeMotion } from '../server/ai/motion/compose.js';
import { readMotion } from '../server/ai/motion/index.js';
import { directMotion } from '../server/ai/motion/director.js';
import { generateCode } from '../server/ai/index.js';

const written = parseBriefRules('Make a warm birthday video for my brother Tony turning twenty. Say: Happy birthday, brother! I am proud of you. May this new age bring you many blessings.');
assert.equal(written.kind, 'personal');
assert.equal(written.category, 'Birthday');
assert.equal(written.name, 'Tony');
assert.equal(written.relationship, 'brother');
assert.equal(written.milestone, '20');
assert.match(written.personalMessage, /Happy birthday, brother!/);

const missingName = parseBriefRules('Make a birthday video for my brother turning twenty');
assert.equal(missingName.name, undefined, 'a relationship must not be mistaken for the recipient name');
assert.equal(missingName.relationship, 'brother');
assert.equal(missingName.milestone, '20');

const possessive = parseBriefRules("Make a video for Tony's 20th birthday");
assert.equal(possessive.name, 'Tony');
assert.equal(possessive.milestone, '20');

const brief = {
  ...written,
  kind: 'personal',
  category: 'Birthday',
  name: 'Tony',
  relationship: 'brother',
  milestone: '20',
  personalMessage: 'Happy birthday, brother! I am proud of you. May this new age bring you many blessings. I am so happy for you.',
  memories: ['Always makes us laugh', 'Kind to everyone'],
  duration: 20,
  aspect: '9:16',
  voiceover: false,
};
const plan = briefToPlanRules(brief, { assets: [], limits: { minSeconds: 15, maxSeconds: 60 } });
const onScreen = plan.scenes.flatMap((scene) => [].concat(scene.on_screen_text || []));
assert.ok(plan.scenes.length >= 5, 'birthday plan must contain multiple distinct scenes');
assert.match(onScreen[0], /Happy 20th Birthday, Tony!/);
assert.ok(onScreen.some((line) => /proud of you/i.test(line)));
assert.ok(onScreen.some((line) => /blessings/i.test(line)));
assert.ok(onScreen.some((line) => /Always makes us laugh/i.test(line)));
assert.equal(plan.business.phone, '');
assert.equal(plan.business.location, '');
assert.doesNotMatch(plan.cta, /order|call|visit|contact|book/i);
assert.doesNotMatch(plan.special_instructions, /sales call to action/i);

const facts = factsOf(plan, brief, []);
assert.equal(facts.personalBirthday, true);
assert.equal(facts.age, '20th');
assert.equal(facts.relationship, 'brother');
assert.equal(facts.phone, '');
const beats = composeStory({ facts, duration: plan.duration_seconds, seed: 2026, look: 'fresh', aspect: '9:16' });
const visible = beats.flatMap((beat) => [beat.data?.headline, beat.data?.text, beat.data?.cta, ...(beat.data?.items || [])].filter(Boolean).map((x) => typeof x === 'string' ? x : ''));
assert.ok(visible.some((line) => /Happy 20th Birthday, Tony!/i.test(line)));
assert.ok(visible.some((line) => /proud of you/i.test(line)));
assert.ok(visible.some((line) => /blessings/i.test(line)));
assert.ok(visible.some((line) => /Blessed new age, Tony!/i.test(line)));
assert.ok(beats.every((beat) => !beat.data?.phone && !beat.data?.link), 'birthday ending must not show business contact details');
assert.ok(beats.length >= 5, 'production story must create several distinct birthday beats');
const rendered = piecesFilm({ plan, brief, assets: [], salt: '' });
assert.match(rendered.html, /animora-direction:story-/);
assert.ok(rendered.data.story.beats.some((beat) => /Happy 20th Birthday, Tony!/i.test(beat.data?.headline || '')));

assert.equal(cleanBrief({ ...brief, videoEngine: 'motion' }).videoEngine, 'motion', 'the selected video director must survive brief sanitization');
assert.equal(cleanBrief({ ...brief, videoEngine: 'pieces' }).videoEngine, 'pieces', 'the Signature mix remains an explicit option');
assert.equal(cleanBrief({ kind: 'personal', category: 'Birthday', name: 'Tony', milestoneSkipped: true }).milestoneSkipped, true, 'skipping an unknown age must persist when the form is reopened');
assert.equal(cleanBrief({ kind: 'cause', category: 'Fundraiser or donation', name: 'Community Health Initiative', paymentSkipped: true }).paymentSkipped, true, 'skipping optional donation details must persist');
const previousGemini = config.useGemini;
const previousEngine = process.env.ANIMORA_ENGINE;
config.useGemini = false;
delete process.env.ANIMORA_ENGINE;
try {
  const classicBrief = { ...brief, videoEngine: undefined };
  const classicPlan = briefToPlanRules(classicBrief, { assets: [], limits: { minSeconds: 15, maxSeconds: 60 } });
  const classic = await generateCode({ plan: classicPlan, style: null, assets: [], brief: classicBrief });
  const motion = readMotion(classic.html);
  assert.ok(motion, 'a new video without an engine override must use the classic Motion director');
  const exactCopy = await directMotion({ plan: classicPlan, brief: classicBrief, useAi: true });
  assert.equal(exactCopy.aiSkipped, true, 'birthday wording must not be handed to the generic commercial AI director');
  assert.ok(readMotion(exactCopy.html), 'birthday storyboard should still render with AI enabled');
  const motionText = motion.beats.flatMap((beat) => [
    ...(beat.lines || []), beat.text, beat.tagline, beat.label, ...(beat.items || []).map((item) => typeof item === 'string' ? item : item.body || item.t || ''),
  ]).filter(Boolean).join(' ');
  for (const phrase of ['Happy 20th', 'Birthday, Tony!', 'From your brother', 'Always makes us laugh', 'Kind to everyone', 'proud of you', 'blessings', 'Blessed new age, Tony!']) {
    assert.ok(motionText.includes(phrase), `classic birthday film must include: ${phrase}`);
  }
  assert.ok(motion.beats.length >= 6, 'classic birthday film must use a sequence of distinct beats');
  assert.ok(motion.beats.every((beat) => beat.type !== 'button'), 'a personal birthday film must not end in a commercial CTA');
  assert.ok(Math.abs(motion.beats.reduce((sum, beat) => sum + beat.dur, 0) - classicPlan.duration_seconds) < 0.06, 'classic birthday beat timings must fill the planned duration');
  assert.ok(motion.beats.slice(1).every((beat, i) => beat.out !== motion.beats[i].out), 'adjacent birthday transitions must vary');
  const signature = await generateCode({ plan: classicPlan, style: null, assets: [], brief: { ...classicBrief, videoEngine: 'pieces' } });
  assert.match(signature.html, /animora-direction:story-/);
} finally {
  config.useGemini = previousGemini;
  if (previousEngine === undefined) delete process.env.ANIMORA_ENGINE; else process.env.ANIMORA_ENGINE = previousEngine;
}

const fallbackBrief = { ...brief, personalMessage: '', memories: [] };
const fallbackPlan = briefToPlanRules(fallbackBrief, { assets: [], limits: { minSeconds: 15, maxSeconds: 60 } });
const fallbackFacts = factsOf(fallbackPlan, fallbackBrief, []);
const fallbackBeats = composeStory({ facts: fallbackFacts, duration: fallbackPlan.duration_seconds, seed: 11, look: 'editorial', aspect: '9:16' });
assert.ok(fallbackBeats.some((beat) => /blessings|wonderful things|happy to celebrate/i.test(beat.data?.text || '')), 'no-message birthday path must use a warm fallback, not repeat the prompt');

console.log('All birthday flow checks passed');
