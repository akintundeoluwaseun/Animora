// Makes a video with the live Animora website, exactly like a person would: new project, logo upload,
// answers, build, AI generate, then the MP4 render. Runs on GitHub Actions (.github/workflows/make-video.yml).
// Usage: node scripts/make-video.js <base64 JSON spec>
//   spec: { base, key, logo, logoLight, brief: {...} }
import { readFile } from 'node:fs/promises';

const spec = JSON.parse(Buffer.from(process.argv[2], 'base64').toString('utf8'));
const base = spec.base.replace(/\/$/, '');
const H = { 'X-Animora-Key': spec.key };
const api = async (path, { method = 'GET', body, form } = {}) => {
  const res = await fetch(`${base}/api${path}`, { method, headers: form ? H : { ...H, 'Content-Type': 'application/json' }, body: form || (body !== undefined ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${data.error || ''}`);
  return data;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// edit mode: { edit: <project id>, instructions: [...] } -> plain-words edits, then a new MP4
if (spec.edit) {
  for (const instruction of spec.instructions || []) {
    const r = await api(`/projects/${spec.edit}/edit`, { method: 'POST', body: { instruction } });
    console.log('edit:', r.changed ? 'changed' : 'unchanged', '-', r.summary);
  }
  const { render } = await api(`/projects/${spec.edit}/renders`, { method: 'POST', body: {} });
  console.log('render started', render.id);
  process.exit(0);
}
const { project } = await api('/projects', { method: 'POST', body: { title: spec.brief.name, kind: spec.kind || 'video' } });
console.log('project', project.id);
if (spec.logo) {
  const form = new FormData();
  form.append('file', new Blob([await readFile(spec.logo)], { type: 'image/png' }), 'logo.png');
  form.append('role', 'logo'); form.append('alpha', 'true'); form.append('light', String(spec.logoLight ?? true));
  await api(`/projects/${project.id}/assets`, { method: 'POST', form });
}
await api(`/projects/${project.id}/brief`, { method: 'PATCH', body: { brief: spec.brief } });
await api(`/projects/${project.id}/build`, { method: 'POST', body: {} });
await api(`/projects/${project.id}/generate`, { method: 'POST' });
let p;
for (let i = 0; i < 80; i++) {
  await sleep(5000);
  p = (await api(`/projects/${project.id}`)).project;
  if (p.gen?.state !== 'working') break;
  if (i % 4 === 0) console.log('…', p.gen?.message);
}
console.log('generated:', p.gen?.state, p.aiSource, p.gen?.message || p.gen?.error || '');
if (p.gen?.state !== 'done') process.exit(1);
if (spec.render !== false && (spec.kind || 'video') === 'video') {
  const { render } = await api(`/projects/${project.id}/renders`, { method: 'POST', body: {} });
  console.log('render started', render.id);
}
console.log(`RESULT ${project.id}`);
