// Static checks on AI-generated HTML, run before the (slower) browser preflight.
// Returns a list of human-readable problems that can be sent straight back to Gemini.

import { GSAP_CDN, ALLOWED_PLUGINS } from './prompts.js';
import { CANVAS } from './renderer.js';

const stripComments = (js) => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`\\])\/\/.*$/gm, '$1');

export function extractHtml(text) {
  if (!text) return '';
  const fence = text.match(/```html\s*([\s\S]*?)```/i) || text.match(/```\s*(<!DOCTYPE[\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const raw = text.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
  return raw ? raw[0].trim() : '';
}

export function extractPlan(text) {
  const m = text?.match(/```adflash-plan\s*([\s\S]*?)```/i);
  if (!m) return null;
  return JSON.parse(m[1]);
}

/** Validate a plan object from the planner. Returns problems (empty = OK). */
export function validatePlan(plan, { maxSeconds = 300, minSeconds = 15 } = {}) {
  const problems = [];
  if (!plan || typeof plan !== 'object') return ['Plan is missing'];
  if (!CANVAS[plan.aspect_ratio]) problems.push(`aspect_ratio must be one of ${Object.keys(CANVAS).join(', ')}`);
  const d = plan.duration_seconds;
  if (!(d >= minSeconds && d <= maxSeconds)) problems.push(`duration_seconds must be ${minSeconds}-${maxSeconds}, got ${d}`);
  if (!Array.isArray(plan.scenes) || !plan.scenes.length) problems.push('scenes must be a non-empty array');
  else {
    let t = 0;
    plan.scenes.forEach((s, i) => {
      if (Math.abs(s.start - t) > 0.01) problems.push(`scene ${i + 1} starts at ${s.start}s, expected ${t}s`);
      if (!(s.end > s.start)) problems.push(`scene ${i + 1} ends before it starts`);
      t = s.end;
    });
    if (Math.abs(t - d) > 0.01) problems.push(`last scene ends at ${t}s but duration_seconds is ${d}`);
    // Voiceover pacing: a line must fit in its scene (max ~3 words per second).
    plan.scenes.forEach((sc, i) => {
      const words = String(sc.voiceover || '').trim().split(/\s+/).filter(Boolean).length;
      const len = sc.end - sc.start;
      if (words && words / len > 3.2) {
        problems.push(`scene ${i + 1} voiceover has ${words} words for ${len}s (too fast); make the scene about ${Math.ceil(words / 2.3 + 0.8)}s long or shorten the line, and shift later scenes`);
      }
    });
  }
  return problems;
}

/** Static checks on generated HTML against the AdFlash technical contract. */
export function validateHtml(html, { duration } = {}) {
  const problems = [];
  if (!/^<!DOCTYPE html>/i.test(html.trim())) problems.push('Document must start with <!DOCTYPE html>.');
  if (!/<\/html>\s*$/i.test(html.trim())) problems.push('Document is incomplete (missing </html>). Return the full file.');
  if (/\/\/\s*\.\.\.|\.\.\.\s*(rest|more|other)\b/i.test(html)) problems.push('File contains placeholder "..." sections. Write the complete code.');

  // Scripts
  const srcs = [...html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1]);
  if (!srcs.some((s) => /gsap(\.min)?\.js$/.test(s))) problems.push(`GSAP must be loaded from ${GSAP_CDN}/gsap.min.js.`);
  for (const s of srcs) {
    const name = s.split('/').pop().replace(/(\.min)?\.js$/, '');
    if (!s.includes('/gsap') || (name !== 'gsap' && !ALLOWED_PLUGINS.includes(name))) {
      problems.push(`External script not allowed: ${s}. Only GSAP and its plugins (${ALLOWED_PLUGINS.join(', ')}).`);
    }
  }

  const inline = stripComments([...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n'));
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n')
    + [...html.matchAll(/\sstyle=["']([^"']*)["']/gi)].map((m) => m[1]).join(';');

  const banned = [
    [/\bsetTimeout\s*\(/, 'setTimeout'], [/\bsetInterval\s*\(/, 'setInterval'],
    [/\brequestAnimationFrame\s*\(/, 'requestAnimationFrame'], [/\bperformance\.now\s*\(/, 'performance.now()'],
    [/\bDate\.now\s*\(|new\s+Date\s*\(/, 'Date / Date.now()'], [/\bMath\.random\s*\(/, 'Math.random() (use the seeded rnd() helper)'],
    [/\bfetch\s*\(|XMLHttpRequest/, 'network requests (fetch/XHR)'],
    [/\bgsap\.(to|from|fromTo|delayedCall)\s*\(/, 'gsap.to/from/fromTo/delayedCall outside the master timeline (add them to tl instead)'],
    [/repeat\s*:\s*-\s*1/, 'repeat: -1 (infinite repeat)'],
    [/\.(play|resume|restart)\s*\(/, 'tl.play()/resume()/restart() (the timeline must stay paused)'],
    [/addEventListener\s*\(\s*["'](click|scroll|mousemove|wheel|touchstart)/, 'user-interaction handlers'],
  ];
  for (const [re, label] of banned) if (re.test(inline)) problems.push(`Forbidden in a video: ${label}.`);

  if (/@keyframes|(^|[;{\s])animation(-name)?\s*:/i.test(css)) problems.push('Forbidden: CSS @keyframes/animation. Animate with the GSAP timeline only.');
  if (/(^|[;{\s])transition\s*:/i.test(css)) problems.push('Forbidden: CSS transition. Animate with the GSAP timeline only.');
  if (/<(video|audio|iframe)\b/i.test(html)) problems.push('Forbidden: <video>, <audio> or <iframe> elements.');

  if (!/gsap\.timeline\s*\(\s*\{[^}]*paused\s*:\s*true/.test(inline)) problems.push('The master timeline must be created with gsap.timeline({ paused: true, ... }).');
  if (!/window\.__timeline\s*=/.test(inline)) problems.push('The script must end with: window.__timeline = tl;');
  if ((inline.match(/gsap\.timeline\s*\(/g) || []).length > 1 && !/\btl\.add\s*\(/.test(inline)) {
    problems.push('Use one master timeline; if you build sub-timelines, add them to tl with tl.add(sub, time).');
  }
  if (duration && !new RegExp(`\\.set\\(\\s*\\{\\s*\\}\\s*,\\s*\\{\\s*\\}\\s*,\\s*(${duration}(\\.0+)?|DURATION)\\s*\\)`).test(inline)) {
    problems.push(`Lock the length with tl.set({}, {}, ${duration}); before window.__timeline = tl;`);
  }
  return problems;
}

/** Problems from the in-browser preflight (renderer.inspectAnimation). */
export function inspectProblems(info, { duration } = {}) {
  const problems = [];
  if (info.pageErrors?.length) problems.push(`JavaScript errors: ${info.pageErrors.join(' | ')}`);
  if (!info.wasPaused) problems.push('The timeline was not paused when created.');
  if (info.stray) problems.push(`${info.stray} animation(s) were created outside the master timeline; add them to tl.`);
  if (info.cssAnimations) problems.push(`${info.cssAnimations} CSS animation(s)/transition(s) found; remove them and use tl.`);
  if (duration && Math.abs(info.duration - duration) > 0.05) problems.push(`tl.duration() is ${info.duration.toFixed(2)}s but must be exactly ${duration}s.`);
  return problems;
}
