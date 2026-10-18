// What is in each uploaded picture, in a few words ("bags of rice and beans", "Milo and Peak milk tins").
// Asked once per picture and saved with it, so the director and the editor always know which picture
// shows what, even the pictures they can't see (they only get the first few images themselves).
import { readFileSync } from 'node:fs';
import { q } from '../db/index.js';
import { geminiGenerate } from '../engine/gemini.js';

export async function describeAssets(assets, loadImage) {
  const todo = (assets || []).filter((a) => (a.kind || 'image') === 'image' && !a.description && a.id).slice(0, 12);
  if (!todo.length) return assets;
  const images = [], names = [];
  let total = 0;
  for (const a of todo) {
    try {
      const got = await loadImage(a);
      if (!got || got.buf.length > 2.5e6 || total + got.buf.length > 7e6) continue;
      total += got.buf.length;
      images.push({ mimeType: got.type, data: got.buf.toString('base64') });
      names.push(a.name);
    } catch { /* skip this picture */ }
  }
  if (!images.length) return assets;
  try {
    const { text } = await geminiGenerate({
      system: 'You describe pictures for a video editor. Be literal and short. Name the products, brands, food, people, text and objects you can actually see. Never guess what is not visible.',
      messages: [{ role: 'user', images, text: `There are ${images.length} pictures, in this order: ${names.map((n) => `"${n}"`).join(', ')}.\nReturn JSON: [{"name": "<name>", "shows": "<what is in it, max 14 words>"}] with one entry per picture, same order.` }],
      temperature: 0.2, maxOutputTokens: 2048, json: true, timeoutMs: 45000, thinking: 'low',
    });
    const raw = JSON.parse(String(text).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''));
    const list = Array.isArray(raw) ? raw : raw.pictures || raw.images || [];
    const byName = new Map();
    list.forEach((x, i) => { const n = x?.name && names.includes(x.name) ? x.name : names[i]; if (n && x?.shows) byName.set(n, String(x.shows).slice(0, 160)); });
    const out = assets.map((a) => (byName.has(a.name) && !a.description ? { ...a, description: byName.get(a.name) } : a));
    for (const a of out) if (byName.has(a.name) && a.id) await q('UPDATE assets SET description=$2 WHERE id=$1', [a.id, a.description]).catch(() => {});
    return out;
  } catch (e) {
    console.warn('[ai] describing pictures failed:', e.message);
    return assets;
  }
}

// Videos keep the engine they were made with. When we fix the engine (here: how logos are drawn),
// older videos get the fixed parts the next time they're edited.
const RUNTIME = (() => { try { return readFileSync(new URL('./runtime/motion.js', import.meta.url), 'utf8'); } catch { return ''; } })();
const block = (src) => { const a = src.indexOf('function mark(parent, size) {'), b = src.indexOf('\n  function idle(', a); return a >= 0 && b > a ? [a, b] : null; };

const shotBlock = (src, name) => { const a = src.indexOf(`SHOTS.${name} = (b, bi) => {`); const b = a >= 0 ? src.indexOf('\n  };\n', a) : -1; return a >= 0 && b > a ? [a, b] : null; };

export function upgradeRuntime(html, assets = []) {
  let out = String(html || '');
  for (const name of ['iconmorph']) {   // shots fixed since (text that could be cut off)
    const f = shotBlock(out, name), t = shotBlock(RUNTIME, name);
    if (f && t && out.indexOf('afterFonts') > 0) out = out.slice(0, f[0]) + RUNTIME.slice(t[0], t[1]) + out.slice(f[1]);
  }
  const from = block(out), to = block(RUNTIME);
  if (from && to) out = out.slice(0, from[0]) + RUNTIME.slice(to[0], to[1]) + out.slice(from[1]);
  out = out.replace('.mark.logo.card { background: #fff; padding: 12%; box-shadow: var(--shadow); }',
    '.mark.logo.card { background: #fff; box-shadow: var(--shadow); }\n  .mark.logo.card img { width: 80%; height: 80%; }\n  .mark.logo.photo { overflow: hidden; } .mark.logo.photo img { width: 100%; height: 100%; object-fit: cover; }');
  const logo = assets.find((a) => a.role === 'logo' && a.width && a.height);
  if (logo) out = out.replace(/("logo":\{"url":"[^"]*","transparent":(?:true|false),"light":(?:true|false|null))\}/, `$1,"ratio":${Math.round((logo.width / logo.height) * 100) / 100}}`);
  return out;
}
