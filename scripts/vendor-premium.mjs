// Copies the chosen HyperFrames blocks (Apache-2.0, github.com/heygen-com/hyperframes) into Animora:
//   server/ai/premium/blocks/<id>.js   the block's HTML as a string (asset links point at __PREMIUM_BASE__)
//   web/public/premium/<id>/assets/*   the pictures and fonts it uses
// Run: node scripts/vendor-premium.mjs <path to hyperframes/registry/blocks> id1 id2 ...
import fs from 'node:fs'; import path from 'node:path';
const [src, ...ids] = process.argv.slice(2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outJs = path.join(root, 'server/ai/premium/blocks'); fs.mkdirSync(outJs, { recursive: true });
for (const id of ids) {
  const dir = path.join(src, id);
  let html = fs.readFileSync(path.join(dir, `${id}.html`), 'utf8');
  html = html.replace(/(["'(])\.?\/?assets\//g, `$1__PREMIUM_BASE__/premium/${id}/assets/`);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'registry-item.json'), 'utf8'));
  fs.writeFileSync(path.join(outJs, `${id}.js`), `// ${meta.title} — from HyperFrames (Apache-2.0, Copyright HeyGen Inc.). Vendored by scripts/vendor-premium.mjs; edit the copy, not this note.\nexport const meta = ${JSON.stringify({ id, title: meta.title, width: meta.dimensions.width, height: meta.dimensions.height, duration: meta.duration })};\nexport default ${JSON.stringify(html)};\n`);
  if (fs.existsSync(path.join(dir, 'assets'))) fs.cpSync(path.join(dir, 'assets'), path.join(root, 'web/public/premium', id, 'assets'), { recursive: true });
  console.log('vendored', id, Math.round(html.length / 1024) + 'KB');
}
