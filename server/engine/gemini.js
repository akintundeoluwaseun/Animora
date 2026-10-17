// Thin Gemini REST client + the three AdFlash AI operations.
// Gemini is the ONLY external service: it plans the video and writes the animation code.
// Everything it returns is checked by our own validator and browser preflight, and
// automatically sent back for repair if it breaks the rendering contract.

import {
  plannerSystemPrompt, codegenSystemPrompt, codegenUserPrompt,
  editSystemPrompt, editUserPrompt, repairUserPrompt, PLAN_LIMITS,
} from './prompts.js';
import { extractHtml, extractPlan, validateHtml, validatePlan, inspectProblems } from './validate.js';
import { inspectAnimation } from './renderer.js';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
// "-latest" aliases track Google's current models; pin explicit versions via env for production.
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-flash-latest';
const CODE_MODEL = process.env.GEMINI_CODE_MODEL || 'gemini-pro-latest';

/**
 * messages: [{ role: 'user' | 'model', text, images?: [{ mimeType, data }] }]   (image data is base64)
 */
export async function geminiGenerate({ system, messages, model = CHAT_MODEL, temperature = 0.7, maxOutputTokens = 8192, json = false, timeoutMs = 120000, apiKey = process.env.GEMINI_API_KEY }) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      parts: [
        ...(m.images || []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
        { text: m.text },
      ],
    })),
    generationConfig: { temperature, maxOutputTokens, ...(json ? { responseMimeType: 'application/json' } : {}) },
  };

  // Busy (429/5xx) or missing (404) models: retry briefly, then move to the next model in the chain,
  // so one overloaded model never sends the user to the backup template.
  const chain = [resolved.get(model) || model, ...(FALLBACKS[model] || [])].filter((m, i, a) => a.indexOf(m) === i);
  let lastErr;
  for (const m of chain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res;
      try {
        res = await fetch(`${API}/${m}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        lastErr = new Error(`Gemini request failed (${m}): ${e.message}`); lastErr.status = 503;
        continue;
      }
      if (res.ok) {
        if (m !== model && !resolved.has(model)) console.log(`[gemini] "${model}" busy or unavailable, using "${m}"`);
        resolved.set(model, m);
        const out = await res.json();
        const cand = out.candidates?.[0];
        const text = cand?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || '').join('') || '';
        if (!text) throw new Error(`Gemini returned no text (finishReason: ${cand?.finishReason || out.promptFeedback?.blockReason || 'unknown'})`);
        return { text, finishReason: cand.finishReason, usage: out.usageMetadata, model: m };
      }
      lastErr = new Error(`Gemini ${res.status} (${m}): ${(await res.text()).slice(0, 500)}`);
      lastErr.status = res.status;
      if (res.status !== 429 && res.status < 500) break; // only retry rate limits / server errors
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }
    if (![404, 429, 503, 500, 502, 504].includes(lastErr.status) && lastErr.status < 500) break; // a bad key or bad request won't be fixed by another model
    if (resolved.get(model) === m) resolved.delete(model);
  }
  throw lastErr;
}

const FALLBACKS = {
  [CHAT_MODEL]: ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'],
  [CODE_MODEL]: ['gemini-pro-latest', 'gemini-2.5-pro', 'gemini-flash-latest', 'gemini-2.5-flash'],
};
const resolved = new Map();

// ---------------------------------------------------------------------------
// Page 1: planning chat
// ---------------------------------------------------------------------------
/**
 * @returns {{ reply: string, plan: object|null, planProblems: string[] }}
 * `reply` is what to show in the chat (plan JSON block removed); `plan` is set once the user confirmed.
 */
export async function planChat({ history, userPlan = 'free', assets = [], style = null, limits }) {
  const { text } = await geminiGenerate({
    system: plannerSystemPrompt({ plan: userPlan, assets, style, limits }),
    messages: history,
    model: CHAT_MODEL,
    temperature: 0.8,
  });
  let plan = null, planProblems = [];
  try { plan = extractPlan(text); } catch (e) { planProblems = [`Plan JSON is invalid: ${e.message}`]; }
  if (plan) planProblems = validatePlan(plan, limits || PLAN_LIMITS[userPlan] || PLAN_LIMITS.free);
  const reply = text.replace(/```adflash-plan[\s\S]*?```/i, '').trim();
  return { reply, plan: planProblems.length ? null : plan, planProblems, raw: text };
}

// ---------------------------------------------------------------------------
// Shared: check code, ask Gemini to repair until it passes (max N rounds)
// ---------------------------------------------------------------------------
async function checkCode(html, { aspectRatio, duration }) {
  const problems = validateHtml(html, { duration });
  if (problems.length) return problems;
  try {
    const info = await inspectAnimation(html, { aspectRatio });
    return inspectProblems(info, { duration });
  } catch (e) {
    return [`The page failed to run in the browser: ${e.message}`];
  }
}

async function generateUntilValid({ system, firstMessage, aspectRatio, duration, maxRepairs = 2, onStatus = () => {} }) {
  const messages = [{ role: 'user', text: firstMessage }];
  let html = '', problems = [];
  for (let round = 0; round <= maxRepairs; round++) {
    onStatus(round === 0 ? 'Writing animation code' : `Fixing ${problems.length} issue(s) (round ${round})`);
    const { text, finishReason } = await geminiGenerate({
      system, messages, model: CODE_MODEL, temperature: round ? 0.2 : 0.6, maxOutputTokens: 65536,
    });
    html = extractHtml(text);
    if (!html) problems = [finishReason === 'MAX_TOKENS'
      ? 'Your answer was cut off. Write more compact code (reuse functions for repeated scenes) and return the full file.'
      : 'No HTML document found. Reply with one ```html code block containing the full file.'];
    else {
      onStatus('Checking the animation');
      problems = await checkCode(html, { aspectRatio, duration });
    }
    if (!problems.length) return { html, problems: [], rounds: round };
    // Repair as a fresh, focused request (keeps the context small for long files).
    messages.splice(0, messages.length, { role: 'user', text: html ? repairUserPrompt(html, problems) : firstMessage + '\n\n' + problems.join('\n') });
  }
  return { html, problems, rounds: maxRepairs }; // caller decides: show preview with warning or ask user to retry
}

// ---------------------------------------------------------------------------
// Page 2: generate code from plan, and edit by prompt
// ---------------------------------------------------------------------------
export function generateAnimation(plan, { style = null, ...opts } = {}) {
  const aspectRatio = plan.aspect_ratio, duration = plan.duration_seconds;
  return generateUntilValid({
    system: codegenSystemPrompt({ aspectRatio, duration, style }),
    firstMessage: codegenUserPrompt(plan),
    aspectRatio, duration, ...opts,
  });
}

export function editAnimation(html, instruction, { aspectRatio, duration, ...opts }) {
  return generateUntilValid({
    system: editSystemPrompt({ aspectRatio, duration }),
    firstMessage: editUserPrompt(html, instruction),
    aspectRatio, duration, ...opts,
  });
}
