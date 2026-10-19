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
// chat, brief reading and picture descriptions use the light model: plenty for the job, and a bigger free allowance
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-flash-lite-latest';
const CODE_MODEL = process.env.GEMINI_CODE_MODEL || 'gemini-pro-latest';

/**
 * messages: [{ role: 'user' | 'model', text, images?: [{ mimeType, data }] }]   (image data is base64)
 */
// ---------------------------------------------------------------------------
// Free-allowance guard. Each Gemini model has its own daily allowance. When a model says "used up for today",
// we remember it (in the database, so every server instance knows) and skip it until Google resets the
// allowance (midnight Pacific time). When every model is used up we stop calling Gemini at once, and Animora's
// built-in designer takes over instantly, instead of retrying for a minute on every request.
// ---------------------------------------------------------------------------
const paused = new Map();   // model -> until (ms)
let pausedAt = 0;
const nextReset = () => { const d = new Date(); const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 0, 0)); if (r <= d) r.setUTCDate(r.getUTCDate() + 1); return r.getTime(); };
async function db() { try { return await import('../db/index.js'); } catch { return null; } }
async function loadPauses() {
  if (Date.now() - pausedAt < 60e3) return;
  pausedAt = Date.now();
  try {
    const m = await db(); if (!m) return;
    const row = await m.one("SELECT value FROM app_state WHERE key='gemini_paused'");
    for (const [k, v] of Object.entries(row?.value || {})) if (v > Date.now()) paused.set(k, Math.max(paused.get(k) || 0, v));
  } catch { /* table missing locally: memory only */ }
}
async function savePause(model, until) {
  paused.set(model, until);
  try {
    const m = await db(); if (!m) return;
    const obj = Object.fromEntries([...paused].filter(([, v]) => v > Date.now()));
    await m.q("INSERT INTO app_state (key, value, updated_at) VALUES ('gemini_paused', $1, now()) ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=now()", [JSON.stringify(obj)]);
  } catch { /* memory only */ }
}
const isPaused = (m) => (paused.get(m) || 0) > Date.now();
/** true while every model is resting (the app uses the built-in designer meanwhile) */
export async function geminiResting() { await loadPauses(); return (paused.get('*') || 0) > Date.now(); }

export async function geminiGenerate({ system, messages, model = CHAT_MODEL, temperature = 0.7, maxOutputTokens = 8192, json = false, timeoutMs = 120000, thinking = null, apiKey = process.env.GEMINI_API_KEY }) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  await loadPauses();
  if (isPaused('*')) throw Object.assign(new Error('Gemini 429: free allowance used up for today (resting)'), { status: 429 });
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
  // so one overloaded model never sends the user to the backup template. The chain starts with the newest
  // models Google currently lists for this key (Google retires old names, so never rely on hard-coded ones).
  const live = await liveModels(apiKey);
  const kind = /pro/i.test(model) ? 'pro' : 'flash';
  const chain = [resolved.get(model), ...(live[kind] || []), ...(kind === 'pro' ? live.flash || [] : []), model, ...(FALLBACKS[model] || [])]
    .filter(Boolean).filter((m, i, a) => a.indexOf(m) === i).filter((m) => !isPaused(m));
  let lastErr;
  const tried = [];
  for (const m of chain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res;
      // 'low' thinking = much faster answers for structured jobs (directing shots, reading a brief).
      // Models that don't know the setting get the request again without it.
      const think = thinking && !noThinking.has(m) ? (/gemini-3/.test(m) ? { thinkingLevel: thinking } : /2\.5-flash/.test(m) ? { thinkingBudget: thinking === 'low' ? 512 : -1 } : null) : null;
      const sendBody = think ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: think } } : body;
      try {
        res = await fetch(`${API}/${m}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(sendBody),
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
      const errText = await res.text();
      if (res.status === 400 && think && /thinking/i.test(errText)) { noThinking.add(m); attempt--; continue; }   // retry without the setting
      lastErr = new Error(`Gemini ${res.status} (${m}): ${errText.slice(0, 300)}`);
      tried.push(`${m}: ${res.status}`);
      lastErr.status = res.status;
      if (res.status === 429) {   // used up: rest this model (for today, or a minute for a per-minute limit) and try the next one
        await savePause(m, /per ?day|PerDay|daily|quota.*day/i.test(errText) ? nextReset() : Date.now() + 65e3);
        break;
      }
      if (res.status < 500) break; // only retry server errors
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }
    if (![404, 429, 503, 500, 502, 504].includes(lastErr.status) && lastErr.status < 500) break; // a bad key or bad request won't be fixed by another model
    if (resolved.get(model) === m) resolved.delete(model);
  }
  if (lastErr && tried.length > 1) lastErr.message += ` [tried ${tried.join(', ')}]`;
  // every model we could try is resting: stop calling Gemini until the earliest one comes back
  if (!lastErr || lastErr.status === 429) {
    const back = Math.min(...[...paused.values()].filter((v) => v > Date.now()), nextReset());
    await savePause('*', back);
    if (!lastErr) lastErr = Object.assign(new Error('Gemini 429: free allowance used up for today (resting)'), { status: 429 });
  }
  throw lastErr;
}

// The models this key can use right now, newest first: { flash: [...], pro: [...] }. Cached for an hour.
let modelCache = { at: 0, list: null };
export async function liveModels(apiKey = process.env.GEMINI_API_KEY) {
  if (modelCache.list && Date.now() - modelCache.at < 3600e3) return modelCache.list;
  try {
    const res = await fetch(`${API}?pageSize=200`, { headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const { models = [] } = await res.json();
    const usable = models.filter((x) => (x.supportedGenerationMethods || []).includes('generateContent'))
      .map((x) => x.name.replace(/^models\//, ''))
      .filter((n) => /^gemini-/.test(n) && !/(image|tts|audio|live|embedding|vision|thinking-exp|learnlm|robotics|computer-use|nano)/i.test(n));
    const ver = (n) => { const m = n.match(/gemini-(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : 0; };
    const score = (n) => ver(n) * 100 - (/preview|exp/i.test(n) ? 5 : 0) - (/lite/i.test(n) ? 20 : 0) - (/\d{3,}$|-\d{2}-\d{2}/.test(n) ? 1 : 0);
    const pick = (re) => usable.filter((n) => re.test(n)).sort((a, b) => score(b) - score(a)).slice(0, 4);
    modelCache = { at: Date.now(), list: { flash: pick(/flash/i), pro: pick(/pro/i) } };
  } catch (e) {
    console.warn('[gemini] could not list models:', e.message);
    modelCache = { at: Date.now() - 3300e3, list: { flash: [], pro: [] } };   // retry in ~5 minutes
  }
  return modelCache.list;
}

// every model has its own free allowance, so a used-up or busy model hands over to the next one
const FALLBACKS = {
  'gemini-flash-lite-latest': ['gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  'gemini-flash-latest': ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'],
  [CODE_MODEL]: ['gemini-pro-latest', 'gemini-2.5-pro', 'gemini-flash-latest', 'gemini-2.5-flash'],
};
const resolved = new Map();
const noThinking = new Set();

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
