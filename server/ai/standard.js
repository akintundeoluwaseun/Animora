// Animora creative standard: the rules every AI director follows, and "Creative QA", the check run before anything is delivered.
// Creative understanding comes first: what is this for, who is it for, what should it feel like, does it need a call to action at all.
import { videoGroup, closingLine } from './closing.js';

export const CREATIVE_STANDARD = `
ANIMORA CREATIVE STANDARD (applies to everything you write):
1. Understand the purpose BEFORE designing. Decide what this is (birthday, wedding, memorial, church programme, school event, conference, music event, graduation, announcement, product promo, business advert, fashion, food...), who it is for, and the right feeling: birthday = joy and celebration; wedding = romance and elegance; memorial = respect and dignity (no playful or flashy motion); church = reverent and uplifting; business = clear and persuasive; music event = energy and rhythm.
2. Never treat everything as an advertisement. Only businesses selling something get sales language.
3. Birthdays, weddings, memorials, graduations, church and school programmes and announcements must NEVER get "Visit our website", "Call us now", "Order now", "Book now", "Visit our store" or any similar line, unless the owner wrote it.
4. NEVER invent content: no website, phone number, address, slogan, logo, price, discount, award, testimonial or call to action that the owner did not provide. If a detail is missing, leave it out; never fill space with made-up words.
5. A logo appears only if the owner uploaded it. Never create a monogram, badge or brand identity.
6. Use the owner's own words, names, ages, dates and places exactly. Every scene must have a reason; simple and elegant beats busy. No random zooms, spinning text or effects without purpose.
7. Different purposes need different creative directions: a birthday must not look like a real-estate ad, a memorial not like a nightclub promo, a church programme not like a fashion commercial.
8. Before you answer, check: did I understand the purpose? did I add anything that was not provided? is the feeling right for the occasion? Fix it first.
`;

const COMMERCIAL = /\b(visit (our|us|the)|call (us|now|our|today)|order (now|today|on|with)|book (now|today|a)|buy now|shop now|dm us|whats\s?app us|chat with us|our (website|store|shop|number)|contact us|get yours|limited offer|best prices?|special offer|click (here|the link)|sign up (now|today))\b/i;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s"'<>]+|\b[a-z0-9-]{3,}\.(?:com|ng|app|io|co|org|net|store|shop|site|online)\b/gi;
const PHONE_RE = /\+?\d[\d\s-]{8,}\d/g;
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ');

// everything the owner actually gave us: anything else showing on screen is an invention
function given(brief = {}) {
  return norm([brief.contact, brief.address, brief.pasteText, brief.extra, brief.offer, brief.when, brief.headline, ...[].concat(brief.headlines || [], brief.ctas || [], brief.cta || [], brief.features || [], brief.phrases || [], brief.products || [], brief.memories || [])].join(' | '));
}
const digits = (s) => String(s || '').replace(/\D/g, '');

/** Score a set of on-screen text lines against the brief. Purpose and content accuracy decide pass/fail. */
export function creativeQA(brief = {}, texts = []) {
  const group = videoGroup(brief), src = given(brief), srcDigits = digits(src);
  const issues = []; const bad = new Set();
  for (const t0 of texts) {
    const t = String(t0 || '').trim(); if (!t) continue;
    if (group === 'social' && COMMERCIAL.test(t) && !src.includes(norm(t))) { issues.push({ kind: 'purpose', text: t, why: 'sales language on a personal or event video' }); bad.add(t0); }
    for (const u of t.match(URL_RE) || []) if (!src.includes(norm(u).replace(/^https?:\/\//, ''))) { issues.push({ kind: 'content', text: u, why: 'website the owner never gave' }); bad.add(t0); }
    for (const p of t.match(PHONE_RE) || []) if (!srcDigits.includes(digits(p))) { issues.push({ kind: 'content', text: p, why: 'phone number the owner never gave' }); bad.add(t0); }
  }
  const purpose = Math.max(0, 100 - 40 * issues.filter((i) => i.kind === 'purpose').length), content = Math.max(0, 100 - 40 * issues.filter((i) => i.kind === 'content').length);
  return { pass: purpose >= 80 && content >= 80, score: { purpose, content }, issues, bad };
}

/** Drop lines that fail QA (keeps order, never leaves a list empty for a required field). */
export const qaFilter = (brief, list) => { const arr = [].concat(list || []); const r = creativeQA(brief, arr); return arr.filter((x) => !r.bad.has(x)); };

/** Clean a plan's on-screen text before a film is made. */
export function qaPlan(brief, plan) {
  if (!plan || !Array.isArray(plan.scenes)) return plan;
  const all = plan.scenes.flatMap((s) => [].concat(s.on_screen_text || []));
  const r = creativeQA(brief, all);
  if (!r.issues.length) return plan;
  for (const s of plan.scenes) {
    const keep = [].concat(s.on_screen_text || []).filter((x) => !r.bad.has(x));
    if (keep.length) s.on_screen_text = keep;
    else if ([].concat(s.on_screen_text || []).length) s.on_screen_text = [s.purpose === 'cta' ? closingLine(brief) : ''].filter(Boolean);
  }
  plan.qa = { purpose: r.score.purpose, content: r.score.content, fixed: r.issues.length };
  return plan;
}

const visibleText = (html) => String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, '\n').split(/\n+/).map((x) => x.trim()).filter((x) => x.length > 2);
const textInScripts = (html) => [...String(html || '').matchAll(/["'`]([^"'`\n<>]{4,80})["'`]/g)].map((m) => m[1]);

/** The check before delivery: look at the finished film or flyer, and replace sales lines on social videos. */
export function qaHtml(brief, html) {
  const texts = [...visibleText(html), ...textInScripts(html)];
  const r = creativeQA(brief, texts);
  let out = html;
  if (videoGroup(brief) === 'social' && r.issues.some((i) => i.kind === 'purpose')) {
    const line = closingLine(brief);
    const hit = new RegExp(COMMERCIAL.source, 'i');
    // replace the whole line of text, not just the matching words (page text outside scripts, and string literals inside them)
    const bad = (t) => hit.test(t) && !given(brief).includes(norm(t));
    const blocks = []; const shell = String(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, (m) => { blocks.push(m); return `\u0000${blocks.length - 1}\u0000`; });
    out = shell.replace(/>([^<>\u0000]{3,90})</g, (m, t) => (bad(t) ? `>${line}<` : m))
      .replace(/\u0000(\d+)\u0000/g, (m, i) => blocks[+i].replace(/(["'`])([^"'`\n<>]{3,90})\1/g, (mm, q, t) => (bad(t) ? `${q}${line}${q}` : mm)));
  }
  return { html: out, qa: { pass: r.pass, purpose: r.score.purpose, content: r.score.content, issues: r.issues.slice(0, 6).map((i) => `${i.why}: ${i.text}`.slice(0, 120)) } };
}
