// Beat types that depend on the facts must be reachable when the facts exist (and never be invented when they do not).
process.env.GEMINI_API_KEY = '';
const { cleanBrief, briefToPlanRules } = await import('../server/ai/brief.js');
const { composeMotion } = await import('../server/ai/motion/compose.js');
let failed = 0;
const bad = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } };
const seen = (raw, n = 60) => {
  const s = new Set();
  for (let i = 0; i < n; i++) {
    const b = { ...cleanBrief({ ...raw, name: `${raw.name} ${i}` }), aspect: '9:16', duration: 30 };
    const plan = briefToPlanRules(b, { assets: [], limits: { minSeconds: 15, maxSeconds: 300 } });
    composeMotion(plan, { brief: b, assets: [], salt: String(i) }).beats.forEach((x) => s.add(x.type));
  }
  return s;
};
const tech = seen({ name: 'Taskly', category: 'Tech & software', headlines: ['Your day, organised', 'Plan less, do more'], features: ['Smart reminders', 'Works offline'], cta: 'Download the app' });
bad(tech.has('phone'), 'a phone beat is never composed for an app');
const ev = seen({ name: 'Lagos Night Market', category: 'Event', goal: 'event', flyerType: 'event', headlines: ['Opening night is here'], when: 'Saturday 14 Nov, 6pm', cta: 'Get tickets' });
bad(ev.has('countdown'), 'a countdown is never composed for an event');
const num = seen({ name: 'Okafor Legal', category: 'Legal services', headlines: ['Counsel you can trust'], features: ['500+ clients served', 'Response in under 30 minutes'], cta: 'Book a consultation' });
bad(num.has('stat') || num.has('ring'), 'real numbers never become a stat or ring');
const plain = seen({ name: 'Mama Tee', category: 'Food & drinks', headlines: ['Hot meals, delivered fast'], features: ['Fresh every day', 'Friendly staff'], cta: 'Order today' });
bad(!plain.has('stat') && !plain.has('ring') && !plain.has('countdown') && !plain.has('quote'), 'a stat/ring/countdown/quote was invented without facts');
console.log(failed ? `${failed} FAILED` : 'beat reachability checks passed');
process.exit(failed ? 1 : 0);
