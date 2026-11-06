// Shows what Gemini actually writes for a video idea, and flags the problems people complained about.
// Usage: node scripts/check-video-ai.js "your idea in your own words"
//   (needs GEMINI_API_KEY in .env; no key = it shows the offline writer instead)
import '../server/config.js';
import { parseBrief, briefToPlan } from '../server/ai/brief.js';
import { config } from '../server/config.js';

const idea = process.argv.slice(2).join(' ') || 'Donation video for Community Health Initiative. Help us raise money for free health checks in Ado Ekiti. Account name: Community Health Initiative, GTBank 0123456789.';
console.log(`AI: ${config.useGemini ? 'Gemini' : 'OFFLINE (no key)'}\nIDEA: ${idea}\n`);
const brief = await parseBrief(idea);
if (brief.aiError) console.log(`! Gemini failed while reading the idea: ${brief.aiError}\n`);
console.log('BRIEF:', JSON.stringify({ name: brief.name, category: brief.category, kind: brief.kind, headlines: brief.headlines, features: brief.features, ctas: brief.ctas, payment: brief.payment, contact: brief.contact }, null, 2));
const { plan, source } = await briefToPlan(brief, {});
console.log(`\nPLAN (${source}), ${plan.duration_seconds}s:`);
const seen = new Map(); const problems = [];
plan.scenes.forEach((s) => {
  console.log(`  ${s.id}. ${s.purpose.padEnd(8)} ${[].concat(s.on_screen_text).join('  /  ')}`);
  for (const line of [].concat(s.on_screen_text)) { const k = String(line).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); if (seen.has(k)) problems.push(`repeated line: "${line}"`); seen.set(k, 1); }
});
const all = plan.scenes.flatMap((s) => [].concat(s.on_screen_text)).join(' ');
if (brief.payment && !all.includes(brief.payment.split(' · ')[1] || '#')) problems.push('the account number is missing from the video');
if (/\b(5 stars?|★|rated|reviews?)\b/i.test(all) && brief.kind !== 'business') problems.push('mentions stars or reviews');
if (plan.scenes.length < 3) problems.push('only ' + plan.scenes.length + ' scenes: too thin');
console.log(problems.length ? `\nPROBLEMS:\n- ${problems.join('\n- ')}` : '\nNo repeats, nothing invented that I can detect.');
process.exit(0);
