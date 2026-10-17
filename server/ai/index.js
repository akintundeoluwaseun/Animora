// AI service used by the API routes.
// Real mode: Google Gemini (planner + code writer + editor), checked by our validator.
// Offline mode (no key) or Gemini failure: our practice planner + template engine,
// so the product never dead-ends in front of a customer (or a judge).
import { config } from '../config.js';
import { planChat, generateAnimation, editAnimation } from '../engine/gemini.js';
import { validatePlan } from '../engine/validate.js';
import { offlinePlannerTurn } from './offline.js';
import { templateFromPlan, offlineEdit } from './templates.js';
import { directedHtml, directorEdit, readData } from './director.js';

// 'director' (default): Gemini directs the shots, our motion engine animates them (fast, always renders).
// 'html': Gemini writes the whole HTML/GSAP file itself (slower, experimental).
const CODE_MODE = (process.env.AI_CODE_MODE || 'director').toLowerCase();

export const aiMode = () => (config.useGemini ? 'gemini' : 'offline');

export function limitsFor(user) {
  const p = config.pricing;
  return { minSeconds: p.minSeconds, maxSeconds: user.plan === 'pro' || config.noAuth ? p.proMaxSeconds : p.freeMaxSeconds };
}

export const themeKeyFor = (style) => style?.palette?.theme || 'bold';

async function imageParts(assets) {
  const out = [];
  for (const a of assets.filter((x) => x.kind === 'image').slice(-3)) {
    try {
      const res = await fetch(a.url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 4e6) continue;
      out.push({ mimeType: a.mime || res.headers.get('content-type') || 'image/png', data: buf.toString('base64') });
    } catch { /* image is optional context */ }
  }
  return out;
}

/**
 * One planning-chat turn. `history` already contains the new user message.
 * Returns { reply, plan|null, ask?, source }
 */
export async function chatTurn({ history, user, style, assets, newAssets = [] }) {
  const limits = limitsFor(user);
  if (config.useGemini) {
    try {
      const msgs = history.map((m) => ({ role: m.role, text: m.text }));
      if (newAssets.length) msgs[msgs.length - 1].images = await imageParts(newAssets);
      const r = await planChat({
        history: msgs, userPlan: user.plan, style, limits,
        assets,
      });
      if (r.planProblems.length && !r.plan) {
        // Gemini tried to output a plan but it was invalid: ask it to fix silently once.
        const fix = await planChat({
          history: [...msgs, { role: 'model', text: r.raw }, { role: 'user', text: `Your plan JSON has problems: ${r.planProblems.join('; ')}. Output the corrected adflash-plan block.` }],
          userPlan: user.plan, style, limits, assets,
        });
        if (fix.plan) return { reply: r.reply || fix.reply, plan: fix.plan, source: 'gemini' };
      }
      return { reply: r.reply, plan: r.plan, source: 'gemini' };
    } catch (e) {
      console.warn('[ai] Gemini chat failed, using practice AI:', e.message);
      const r = offlinePlannerTurn(history, { limits, assets });
      return { ...r, source: 'offline', notice: 'The AI service is busy, so the backup assistant answered.' };
    }
  }
  return { ...offlinePlannerTurn(history, { limits, assets }), source: 'offline' };
}

/**
 * Give the code writer everything about the user's real images: URL, size, transparency, and resolve each
 * scene's images[].asset name to its file. Unknown names are dropped (never invented URLs).
 */
export function enrichPlan(plan, assets) {
  const images = assets.filter((a) => a.kind === 'image');
  const meta = (a) => ({ name: a.name, url: a.url, role: a.role || (/logo/i.test(a.name) ? 'logo' : 'photo'), width: a.width || undefined, height: a.height || undefined, transparent: !!a.has_alpha });
  const find = (ref) => {
    const key = String(ref || '').toLowerCase().trim();
    return images.find((a) => a.url === ref || a.name.toLowerCase() === key) || images.find((a) => key && (a.name.toLowerCase().includes(key) || key.includes(a.name.toLowerCase())))
      || (key === 'logo' ? images.find((a) => a.role === 'logo') : null);
  };
  return {
    ...plan,
    assets: images.map(meta),
    scenes: (plan.scenes || []).map((sc) => ({
      ...sc,
      images: (sc.images || []).map((im) => { const a = find(im.asset || im.url || im.name); return a ? { ...im, asset: a.name, url: a.url, role: meta(a).role, width: a.width, height: a.height, transparent: !!a.has_alpha } : null; }).filter(Boolean),
    })),
  };
}

/** Plan -> HTML. Returns { html, source, problems, notice? } */
export async function generateCode({ plan, style, assets, brief = null, previous = null, onStatus }) {
  const planWithAssets = enrichPlan(plan, assets);
  const themeKey = themeKeyFor(style);
  const rule = () => templateFromPlan(planWithAssets, { themeKey, salt: previous ? String(Date.now()) : '' });   // regenerate = a different arrangement
  if (config.useGemini && CODE_MODE !== 'html') {
    try {
      onStatus?.('Directing the shots');
      const html = await directedHtml({ plan: planWithAssets, brief, style, themeKey, assets: planWithAssets.assets, images: await imageParts(assets), previous });
      return { html, source: 'gemini', problems: [] };
    } catch (e) {
      console.warn('[ai] Gemini director failed:', e.message);
      return { html: rule(), source: 'template', problems: [], notice: 'The AI director was busy, so this version was arranged automatically. Press Regenerate to try the AI again.' };
    }
  }
  if (config.useGemini) {
    try {
      const r = await generateAnimation(planWithAssets, { style, onStatus });
      if (!r.problems.length) return { html: r.html, source: 'gemini', problems: [] };
      console.warn('[ai] Gemini code still has problems after repairs:', r.problems);
    } catch (e) {
      console.warn('[ai] Gemini codegen failed:', e.message);
    }
    onStatus?.('Using the Animora template engine');
    return { html: rule(), source: 'template', problems: [], notice: 'The AI writer had trouble, so we built this with the Animora template engine. You can still edit it.' };
  }
  onStatus?.('Building animation');
  return { html: rule(), source: 'template', problems: [] };
}

/** Plain-words edit. Returns { html, source, summary } */
export async function editCode({ html, instruction, aspectRatio, duration, plan = null, assets = [], onStatus }) {
  const directed = !!readData(html)?.beats;
  if (config.useGemini) {
    try {
      if (directed) {
        const planWithAssets = plan ? enrichPlan(plan, assets) : null;
        const r = await directorEdit({ html, plan: planWithAssets, instruction, assets: planWithAssets?.assets || assets, images: await imageParts(assets) });
        return { html: r.html, source: 'gemini', summary: r.summary };
      }
      const r = await editAnimation(html, instruction, { aspectRatio, duration, onStatus });
      if (!r.problems.length) return { html: r.html, source: 'gemini', summary: 'Done! Check the preview.' };
    } catch (e) {
      console.warn('[ai] Gemini edit failed:', e.message);
    }
  }
  const r = offlineEdit(html, instruction);
  if (!r.changes.length) {
    return {
      html, source: 'offline', unchanged: true,
      summary: config.useGemini
        ? "The AI editor couldn't be reached just now, and that change needs it. Please try again in a moment."
        : 'The practice AI can change text size ("make the text bigger"), colours ("change the background to green") and speed ("make it faster"). Add a Gemini key for any change.',
    };
  }
  return { html: r.html, source: 'offline', summary: `Updated: ${r.changes.join(', ')}.` };
}

export { validatePlan };
