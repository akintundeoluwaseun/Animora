// AI service used by the API routes.
// Real mode: Google Gemini (planner + code writer + editor), checked by our validator.
// Offline mode (no key) or Gemini failure: our practice planner + template engine,
// so the product never dead-ends in front of a customer (or a judge).
import { config } from '../config.js';
import { getDbObject } from '../storage.js';
import { planChat, generateAnimation, editAnimation } from '../engine/gemini.js';
import { validatePlan } from '../engine/validate.js';
import { offlinePlannerTurn } from './offline.js';
import { templateFromPlan, offlineEdit } from './templates.js';
import { directedHtml, directorEdit, readData } from './director.js';
import { describeAssets, upgradeRuntime } from './describe.js';
import { isFlyer, editFlyer } from './flyer.js';
import { THEMES } from './themes.js';
import { directCinema, cinemaEdit, isCinema, readCinema, CINEMA_ASPECTS } from './cinema/index.js';
import { directMotion, motionEdit, motionOfflineEdit, isMotion, readMotion, MOTION_ASPECTS } from './motion/index.js';
import { piecesFilm, piecesEdit, isPieces, PIECES_ASPECTS, isTemplateBrief } from './pieces/index.js';
import { premiumFilm, premiumEdit, isPremium, PREMIUM_ASPECTS } from './premium/index.js';

// 'director' (default): Gemini directs the shots, our motion engine animates them (fast, always renders).
// 'html': Gemini writes the whole HTML/GSAP file itself (slower, experimental).
const CODE_MODE = (process.env.AI_CODE_MODE || 'director').toLowerCase();

export const aiMode = () => (config.useGemini ? 'gemini' : 'offline');

export function limitsFor(user) {
  const p = config.pricing;
  return { minSeconds: p.minSeconds, maxSeconds: user.plan === 'pro' || config.noAuth ? p.proMaxSeconds : p.freeMaxSeconds };
}

export const themeKeyFor = (style) => style?.palette?.theme || 'bold';

/** The bytes of an uploaded picture (from our own database when it lives there). */
export async function loadImage(a) {
  let buf = null, type = a.mime;
  const key = config.storageMode === 'db' && String(a.url).includes('/files/') ? decodeURIComponent(String(a.url).split('/files/')[1]) : null;
  if (key) { const f = await getDbObject(key); if (f) { buf = f.data; type = type || f.type; } }
  if (!buf) { const res = await fetch(a.url, { signal: AbortSignal.timeout(8000) }); if (!res.ok) return null; buf = Buffer.from(await res.arrayBuffer()); type = type || res.headers.get('content-type'); }
  return { buf, type: type || 'image/png' };
}

async function imageParts(assets) {
  // The AI only needs to see the pictures roughly: logo first, at most 3, about 3 MB in total.
  // Files kept in our own database are read directly (no extra web request).
  const out = [];
  let total = 0;
  const imgs = assets.filter((x) => x.kind === 'image').sort((a, b) => (b.role === 'logo') - (a.role === 'logo')).slice(0, 3);
  for (const a of imgs) {
    try {
      const got = await loadImage(a); if (!got) continue;
      const { buf, type } = got;
      if (buf.length > 2.5e6 || total + buf.length > 3.2e6) continue;
      total += buf.length;
      out.push({ mimeType: type || 'image/png', data: buf.toString('base64') });
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
  const meta = (a) => ({ name: a.name, url: a.url, role: a.role || (/logo/i.test(a.name) ? 'logo' : 'photo'), width: a.width || undefined, height: a.height || undefined, transparent: !!a.has_alpha, light: a.is_light ?? undefined, description: a.description || undefined });
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

/** A short, plain reason for an AI failure (shown to the user; never contains the key). */
export function aiReason(e) {
  const m = String(e?.message || e);
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(m)) return 'your Gemini key has hit its usage limit';
  if (/40[03]|API key|PERMISSION_DENIED|API_KEY_INVALID/i.test(m)) return 'the Gemini key was refused';
  if (/timeout|aborted|TimeoutError/i.test(m)) return 'Gemini took too long';
  if (/JSON|Unexpected token|no text|MAX_TOKENS/i.test(m)) return "Gemini's answer was cut off";
  return m.replace(/key=\S+/g, '').slice(0, 100);
}

/** Plan -> HTML. Returns { html, source, problems, notice? } */
export async function generateCode({ plan, style, assets, brief = null, previous = null, onStatus }) {
  const themeKey = themeKeyFor(style);
  const motionFirst = CODE_MODE !== 'html' && process.env.ANIMORA_ENGINE !== 'cinema' && MOTION_ASPECTS.includes(plan.aspect_ratio || '9:16');
  // The Motion director sees the pictures itself, so it skips the separate "describe the pictures" call (one AI round trip saved).
  if (config.useGemini && !motionFirst) { onStatus?.('Looking at your pictures'); assets = await describeAssets(assets, loadImage); }
  let planWithAssets = enrichPlan(plan, assets);
  // Every video size is made by the Motion engine (Apple-style product films): the AI directs, or the rule-based composer without a key
  const motion = CODE_MODE !== 'html' && process.env.ANIMORA_ENGINE !== 'cinema' && MOTION_ASPECTS.includes(planWithAssets.aspect_ratio || '9:16');
  // Vertical videos are spelled from the premium motion library: a different mix of pieces for every business and every Regenerate.
  // ANIMORA_ENGINE=motion (or cinema) switches back to the older engines.
  const pieces = CODE_MODE !== 'html' && !['motion', 'cinema'].includes(process.env.ANIMORA_ENGINE) && (PIECES_ASPECTS.includes(planWithAssets.aspect_ratio || '9:16') || ['16:9', '1:1', '4:5'].includes(planWithAssets.aspect_ratio));
  // Premium first: a designer-made template filled with the owner's details (no AI call). ANIMORA_ENGINE=pieces skips it.
  const premium = CODE_MODE !== 'html' && !['motion', 'cinema', 'pieces'].includes(process.env.ANIMORA_ENGINE) && PREMIUM_ASPECTS.includes(planWithAssets.aspect_ratio || '9:16');
  if (premium) {
    try {
      onStatus?.('Building your film');
      const r = premiumFilm({ plan: planWithAssets, brief: brief || {}, assets: planWithAssets.assets, salt: previous ? String(Date.now()) : '', previous });
      return { html: r.html, source: 'template', problems: [] };
    } catch (e) { console.warn('[premium] no fit, using pieces:', e.message); }
  }
  if (pieces) {
    try {
      onStatus?.('Building your film');
      const r = piecesFilm({ plan: planWithAssets, brief: brief || {}, assets: planWithAssets.assets, style, themeColors: THEMES[themeKey]?.colors || {}, salt: previous ? String(Date.now()) : '', previous });
      return { html: r.html, source: 'template', problems: [] };
    } catch (e) { console.warn('[pieces] failed, using Motion:', e.message); }
  }
  if (motion) {
    try {
      onStatus?.(config.useGemini ? 'Directing your film' : 'Building animation');
      const prev = readMotion(previous) || readCinema(previous);
      const r = await directMotion({
        plan: planWithAssets, brief, assets: planWithAssets.assets, themeColors: THEMES[themeKey]?.colors || {},
        images: config.useGemini ? await imageParts(assets) : [], useAi: !!config.useGemini,
        salt: previous ? String(Date.now()) : '', avoid: (prev?.beats || prev?.scenes || []).map((x) => x.type), style,
      });
      return { html: r.html, source: config.useGemini && r.source === 'gemini' ? 'gemini' : 'template', problems: [], ...(config.useGemini && r.source !== 'gemini' ? { notice: "The AI director couldn't finish, so this version was arranged automatically. Press Regenerate to try the AI again." } : {}) };
    } catch (e) { console.warn('[motion] failed, trying Cinema:', e.message); }
    // the older engines below use picture descriptions
    if (config.useGemini) { onStatus?.('Looking at your pictures'); assets = await describeAssets(assets, loadImage); planWithAssets = enrichPlan(plan, assets); }
  }
  // older engine (kept for 9:16 if Motion fails, and for editing videos made before Motion)
  const cinema = CODE_MODE !== 'html' && CINEMA_ASPECTS.includes(planWithAssets.aspect_ratio || '9:16');
  if (cinema) {
    try {
      onStatus?.(config.useGemini ? 'Directing the scenes' : 'Building animation');
      const r = await directCinema({
        plan: planWithAssets, brief, assets: planWithAssets.assets, themeColors: THEMES[themeKey]?.colors || {},
        images: config.useGemini ? await imageParts(assets) : [], useAi: !!config.useGemini,
        salt: previous ? String(Date.now()) : '', avoid: (readCinema(previous)?.scenes || []).map((x) => x.type),
      });
      return { html: r.html, source: config.useGemini && r.source === 'gemini' ? 'gemini' : 'template', problems: [], ...(config.useGemini && r.source !== 'gemini' ? { notice: "The AI director couldn't finish, so this version was arranged automatically. Press Regenerate to try the AI again." } : {}) };
    } catch (e) { console.warn('[cinema] failed, using the classic engine:', e.message); }
  }
  const rule = () => templateFromPlan(planWithAssets, { themeKey, salt: previous ? String(Date.now()) : '' });   // regenerate = a different arrangement
  if (config.useGemini && CODE_MODE !== 'html') {
    try {
      onStatus?.('Directing the shots');
      const html = await directedHtml({ plan: planWithAssets, brief, style, themeKey, assets: planWithAssets.assets, images: await imageParts(assets), previous });
      return { html, source: 'gemini', problems: [] };
    } catch (e) {
      console.warn('[ai] Gemini director failed:', e.message);
      return { html: rule(), source: 'template', problems: [], notice: `The AI director couldn't finish (${aiReason(e)}), so this version was arranged automatically. Press Regenerate to try the AI again.` };
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
  if (isPremium(html)) {
    try { const r = await premiumEdit({ html, instruction, useAi: !!config.useGemini }); if (r) return { html: r.html, source: config.useGemini ? 'gemini' : 'offline', summary: r.summary }; }
    catch (e) { console.warn('[premium] edit failed:', e.message); }
    return { html, source: 'offline', unchanged: true, summary: config.useGemini ? "I couldn't make that change just now. Please try again in a moment, or press Regenerate for a different design." : 'Press Regenerate for a different design. Changing the words needs the AI, which is off right now.' };
  }
  if (config.useGemini && !isMotion(html) && !isPieces(html)) assets = await describeAssets(assets, loadImage);
  if (isFlyer(html)) {
    if (!config.useGemini) return { html, source: 'offline', unchanged: true, summary: 'Flyer changes need the AI, which is off right now.' };
    try { const r = await editFlyer({ html, instruction, assets }); return { html: r.html, source: 'gemini', summary: r.summary }; }
    catch (e) { console.warn('[ai] flyer edit failed:', e.message); return { html, source: 'offline', unchanged: true, summary: `I couldn't change the flyer (${aiReason(e)}). Try again.` }; }
  }
  if (isPieces(html)) {
    try { const r = await piecesEdit({ html, instruction, useAi: !!config.useGemini }); if (r) return { html: r.html, source: config.useGemini ? 'gemini' : 'offline', summary: r.summary }; }
    catch (e) { console.warn('[pieces] edit failed:', e.message); }
    return { html, source: 'offline', unchanged: true, summary: config.useGemini ? "I couldn't make that change just now. Please try again in a moment." : 'Without the AI I can change the colour ("make it blue"), dark or light, the pace ("make it calmer") or give a fresh mix ("try a different one").' };
  }
  if (isMotion(html)) {
    if (config.useGemini) {
      try { const r = await motionEdit({ html, instruction, assets, images: await imageParts(assets) }); return { html: r.html, source: 'gemini', summary: r.summary }; }
      catch (e) { console.warn('[motion] edit failed:', e.message); }
    }
    const off = motionOfflineEdit(html, instruction);
    if (off) return { html: off.html, source: 'offline', summary: `Updated: ${off.changes.join(', ')}.` };
    return { html, source: 'offline', unchanged: true, summary: config.useGemini ? "I couldn't make that change just now. Please try again in a moment." : 'Without the AI I can change the colour ("make it blue"), the backgrounds ("make it dark") and the pace ("make it faster"). Add a Gemini key for any change.' };
  }
  if (isCinema(html)) {
    if (!config.useGemini) return { html, source: 'offline', unchanged: true, summary: 'Changes to a Cinema video need the AI, which is off right now. Add a Gemini key.' };
    try { const r = await cinemaEdit({ html, instruction, assets, images: await imageParts(assets) }); return { html: r.html, source: 'gemini', summary: r.summary }; }
    catch (e) { console.warn('[cinema] edit failed:', e.message); return { html, source: 'offline', unchanged: true, summary: `I couldn't make that change (${aiReason(e)}). Try again.` }; }
  }
  html = upgradeRuntime(html, assets);
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
