// Tests image placement and separate narration scripts through the API (test mode, no sign-in).
//   upload logo + photos (size/transparency detected) -> chat with a script -> plan has images + voice lines
//   -> code uses the images + captions -> script formats for TTS apps -> upload voice -> fit to voice
//   -> render: legacy uploaded audio is ignored and the MP4 remains silent. Also checks Gemini TTS parsing with a stub.
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dataDir = await mkdtemp(path.join(tmpdir(), 'adflash-media-'));
const PORT = 3998;
Object.assign(process.env, {
  ANIMORA_ENGINE: 'motion',   // this file checks the Motion engine (captions, motion-v4); premium films are covered by test-audio.js
  DATA_DIR: dataDir, PORT: String(PORT), PUBLIC_BASE_URL: `http://localhost:${PORT}`, AI_MODE: 'offline', AUTH: 'off',
  DATABASE_URL: '', SUPABASE_URL: '', SEED_DEMO_HISTORY: 'false',
});
const ff = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]); if (r.status) throw new Error(r.stderr.toString()); };
const probe = (f) => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,duration:format=duration', '-of', 'json', f]).stdout.toString());

// Test files: transparent logo, portrait + landscape photos, a 26-second "voice"
const files = path.join(dataDir, 'in');
await mkdir(files, { recursive: true });
ff(['-f', 'lavfi', '-i', 'color=c=black:s=600x300', '-vf', 'drawbox=x=40:y=40:w=520:h=220:color=#C9A227:t=fill,colorkey=black:0.05:0,format=rgba', '-frames:v', '1', `${files}/logo.png`]);
ff(['-f', 'lavfi', '-i', 'gradients=s=800x1000', '-frames:v', '1', `${files}/cake.jpg`]);
ff(['-f', 'lavfi', '-i', 'gradients=s=1200x800', '-frames:v', '1', `${files}/cupcakes.jpg`]);
ff(['-f', 'lavfi', '-i', 'sine=frequency=330:duration=26', '-c:a', 'libmp3lame', `${files}/voice.mp3`]);

const { createApp } = await import('../server/index.js');
const { startWorker } = await import('../server/worker.js');
const { closeDb } = await import('../server/db/index.js');
const app = await createApp();
const server = app.listen(PORT);
const stopWorker = await startWorker();
const base = `http://localhost:${PORT}/api`;
let failures = 0;
const ok = (n, c, d = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
const api = async (method, url, body) => {
  const res = await fetch(base + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
};
const upload = async (url, file, fields = {}) => {
  const form = new FormData();
  form.append('file', new Blob([await readFile(file)], { type: file.endsWith('png') ? 'image/png' : file.endsWith('mp3') ? 'audio/mpeg' : 'image/jpeg' }), path.basename(file));
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const res = await fetch(base + url, { method: 'POST', body: form });
  return { status: res.status, ...(await res.json()) };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function render(P, label) {
  const rr = await api('POST', `/projects/${P}/renders`, {});
  for (let i = 0; i < 400; i++) {
    const { render: r } = await api('GET', `/renders/${rr.render.id}`);
    if (['done', 'failed'].includes(r.status)) return r;
    await sleep(1000);
  }
  throw new Error(`${label} timeout`);
}

try {
  ok('no sign-in needed', (await api('GET', '/auth/me')).user?.testMode === true);
  const { project } = await api('POST', '/projects', {});
  const P = project.id;

  const logo = await upload(`/projects/${P}/assets`, `${files}/logo.png`, { role: 'logo' });
  const cake = await upload(`/projects/${P}/assets`, `${files}/cake.jpg`, { role: 'photo', name: 'cake' });
  const cup = await upload(`/projects/${P}/assets`, `${files}/cupcakes.jpg`, { role: 'photo', name: 'cupcakes' });
  ok('logo: size + transparency detected', logo.asset.width === 600 && logo.asset.height === 300 && logo.asset.has_alpha === true, `${logo.asset.width}x${logo.asset.height} alpha=${logo.asset.has_alpha}`);
  ok('photos: size detected, not transparent', cake.asset.height === 1000 && cake.asset.has_alpha === false && cup.asset.width === 1200);
  const imgRes = await fetch(logo.asset.url);
  ok('uploaded images allow cross-origin loading (needed by preview + renderer)', imgRes.headers.get('access-control-allow-origin') === '*');

  let last;
  for (const m of ['Kemi Cakes, we bake birthday and wedding cakes', 'Birthday cakes from ₦15,000, Cupcakes (box of 6) ₦4,500, Free delivery in Ado Ekiti',
    '08061234567, 3 Fajuyi Road, Ado Ekiti']) last = await api('POST', `/projects/${P}/chat`, { message: m });
  ok('asks about images before planning', /logo or product photos/i.test(last.reply));
  last = await api('POST', `/projects/${P}/chat`, { message: 'done' });
  ok('asks about a narration script', /narration script/i.test(last.reply) && /own script/i.test(last.reply), last.reply.split('\n')[0]);
  last = await api('POST', `/projects/${P}/chat`, { message: '1' });
  ok('asks for the script', /paste your script/i.test(last.reply));
  const script = 'Fresh cakes for every celebration! Kemi Cakes bakes birthday and wedding cakes. Birthday cakes start at ₦15,000. Six cupcakes for ₦4,500. Call 0806 123 4567 today!';
  last = await api('POST', `/projects/${P}/chat`, { message: script });
  last = await api('POST', `/projects/${P}/chat`, { message: 'pink and gold, whatsapp status' });
  ok('summary shows images and voice lines', /🖼/.test(last.reply) && /🎙/.test(last.reply));
  last = await api('POST', `/projects/${P}/chat`, { message: 'yes' });
  const plan = last.project.plan;
  ok('plan has a voiceover', plan.voiceover?.enabled && plan.scenes.every((s) => s.voiceover), `${plan.scenes.length} scenes, ${plan.duration_seconds}s`);
  const words = plan.scenes.map((s) => s.voiceover).join(' ').split(/\s+/).length;
  ok('scenes timed to the script (2-3 words/sec)', words / plan.duration_seconds > 1.5 && words / plan.duration_seconds < 3.1, `${words} words in ${plan.duration_seconds}s`);
  ok('user script kept word for word', plan.scenes.map((s) => s.voiceover).join(' ') === script);
  const placed = plan.scenes.flatMap((s) => (s.images || []).map((i) => i.asset));
  ok('every image placed in a scene', ['logo', 'cake', 'cupcakes'].every((n) => placed.includes(n)), placed.join(', '));

  const gen = await api('POST', `/projects/${P}/generate`);
  // generation runs in the background: wait for the code
  let proj = gen.project;
  for (let i = 0; i < 120 && !proj.code && proj.status === 'coding'; i++) { await new Promise((r) => setTimeout(r, 500)); proj = (await api('GET', `/projects/${P}`)).project || proj; }
  const code = proj.code || '';
  ok('code uses the uploaded images', [logo, cake, cup].every((a) => code.includes(a.asset.url)));
  ok('code has captions', /"captions":\[\{/.test(code) && code.includes("'cap'"));
  ok('code uses the motion engine v4 (beats with cuts, one at a time)', code.includes('engine=motion-v4') && code.includes('window.ADFLASH_DATA') && code.includes('"cut":'));

  const vo = await api('GET', `/projects/${P}/voiceover`);
  ok('TTS-ready script: prices and phone spelled out', vo.formats.plain.includes('fifteen thousand naira') && vo.formats.plain.includes('zero eight zero six, one two three, four five six seven'));
  ok('SSML version with pauses', vo.formats.ssml.startsWith('<speak>') && vo.formats.ssml.includes('<break time='));
  ok('timed script for recording', /\[0:00 – 0:0\d\]/.test(vo.formats.timed));

  const up = await upload(`/projects/${P}/voiceover/upload`, `${files}/voice.mp3`);
  ok('voice uploaded', up.project?.voice?.duration > 25, `${up.project?.voice?.duration}s`);
  const r1 = await render(P, 'silent render');
  ok('silent render done', r1.status === 'done', r1.error || '');
  if (r1.status === 'done') {
    const out = path.join(dataDir, 'out.mp4');
    await import('node:fs/promises').then((fs) => fetch(r1.videoUrl).then((x) => x.arrayBuffer()).then((b) => fs.writeFile(out, Buffer.from(b))));
    const pr = probe(out);
    const v = pr.streams.find((s) => s.codec_type === 'video');
    const a = pr.streams.find((s) => s.codec_type === 'audio');
    ok('rendered MP4 has the sound-effects track (the voice is not mixed in)', !!a && Math.abs(Number(a.duration) - plan.duration_seconds) < 0.2, a ? `${a.codec_name} ${Number(a.duration).toFixed(2)}s` : 'no audio');
    ok('audio never changes the planned video length', Math.abs(Number(pr.format.duration) - plan.duration_seconds) < 0.1 && r1.durationSeconds === plan.duration_seconds,
      `${Number(pr.format.duration).toFixed(2)}s (planned ${plan.duration_seconds}s), video ${Number(v.duration).toFixed(2)}s`);
  }
  // sound effects switched off for this video -> a silent MP4
  await api('PATCH', `/projects/${P}`, { sfx: false });
  const r2 = await render(P, 'render without sound effects');
  if (r2.status === 'done') {
    const out2 = path.join(dataDir, 'out2.mp4');
    await import('node:fs/promises').then((fs) => fetch(r2.videoUrl).then((x) => x.arrayBuffer()).then((b) => fs.writeFile(out2, Buffer.from(b))));
    ok('sound effects can be switched off', !probe(out2).streams.some((st) => st.codec_type === 'audio'));
  } else ok('render without sound effects', false, r2.error || '');
} catch (e) {
  failures++; console.error(e);
} finally {
  stopWorker(); server.close(); await closeDb(); await rm(dataDir, { recursive: true, force: true });
}

// Gemini TTS response parsing (stubbed; no network): new Interactions API and the older generateContent API.
{
  process.env.GEMINI_API_KEY = 'stub';
  const { config } = await import('../server/config.js');
  config.geminiApiKey = 'stub';
  const { generateVoiceTrack } = await import('../server/ai/voice.js');
  const pcm = Buffer.alloc(24000 * 2 * 1.2); // 1.2s of silent 24kHz 16-bit mono PCM
  for (let i = 0; i < pcm.length; i += 2) pcm.writeInt16LE(Math.round(Math.sin(i / 20) * 3000), i);
  let calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    const body = JSON.parse(init.body);
    if (String(url).endsWith('/interactions')) {
      if (calls.filter((c) => c.endsWith('/interactions')).length > 2) return { ok: false, status: 404, json: async () => ({ error: { message: 'not found' } }) };
      return { ok: true, json: async () => ({ steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/l16', data: pcm.toString('base64') }] }] }) };
    }
    if (!body.generationConfig?.responseModalities) throw new Error('bad legacy body');
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm.toString('base64') } }] } }] }) };
  };
  try {
    const plan = { duration_seconds: 8, scenes: [{ id: 1, start: 0, end: 3, voiceover: 'Hello Ado Ekiti.' }, { id: 2, start: 3, end: 6, voiceover: 'Cakes from ₦15,000.' }, { id: 3, start: 6, end: 8, voiceover: 'Call 0806 123 4567.' }] };
    const t = await generateVoiceTrack(plan, { voice: 'Puck' });
    const f = path.join(tmpdir(), `tts-${Date.now()}.mp3`);
    await import('node:fs/promises').then((fs) => fs.writeFile(f, t.mp3));
    const d = Number(probe(f).format.duration);
    ok('Gemini voice: per-scene clips assembled on one track', Math.abs(d - 8) < 0.2, `${d.toFixed(2)}s track`);
    ok('falls back to the older Gemini TTS API when needed', calls.some((c) => c.includes(':generateContent')), calls.map((c) => c.split('/').pop()).join(' → '));
  } catch (e) { failures++; console.error(e); } finally { globalThis.fetch = realFetch; }
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll image, script and silent-video checks passed');
process.exit(failures ? 1 : 0);
