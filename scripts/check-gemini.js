// Checks that GEMINI_API_KEY in .env works, in plain words.
// Usage: npm run check:gemini
import '../server/config.js'; // loads .env
import { geminiGenerate } from '../server/engine/gemini.js';

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.log('✗ GEMINI_API_KEY is empty. Put your key in the .env file.');
  process.exit(1);
}
console.log(`Key found (${key.slice(0, 6)}…${key.slice(-4)}). Contacting Gemini…\n`);

// 1. Can the key see any models?
let res;
try {
  res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', { headers: { 'x-goog-api-key': key } });
} catch (e) {
  console.log(`✗ Cannot reach Google from this computer (${e.cause?.code || e.message}). Check the internet connection.`);
  process.exit(1);
}
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  const msg = body.error?.message || res.statusText;
  console.log(`✗ Google rejected the key (${res.status}): ${msg}`);
  if ([400, 401, 403].includes(res.status)) {
    console.log('\n  Most likely the key is wrong or is not a Gemini API key.');
    console.log('  Make a new one at https://aistudio.google.com/apikey (Gemini keys usually start with "AIza"),');
    console.log('  paste it into .env as GEMINI_API_KEY=..., and run this check again.');
  }
  process.exit(1);
}
const names = (body.models || []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => m.name.replace('models/', ''));
console.log(`✓ Key works. ${names.length} models available, e.g. ${names.filter((n) => /flash|pro/.test(n)).slice(0, 6).join(', ')}`);

// 2. Can it actually generate with the models Animora uses?
for (const [label, model] of [['Chat model', process.env.GEMINI_CHAT_MODEL || 'gemini-flash-latest'], ['Code model', process.env.GEMINI_CODE_MODEL || 'gemini-pro-latest']]) {
  try {
    const t0 = Date.now();
    const r = await geminiGenerate({ system: 'Reply with exactly: OK', messages: [{ role: 'user', text: 'Say OK' }], model, maxOutputTokens: 1024 });
    console.log(`✓ ${label}: ${r.model} answered "${r.text.trim().slice(0, 20)}" in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.log(`✗ ${label} (${model}) failed: ${e.message.slice(0, 300)}`);
    if (/429|quota/i.test(e.message)) console.log('  This is a rate/quota limit. Free keys allow only a few requests per minute; wait a minute or enable billing.');
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log('\nAll good. Restart Animora (npm start) and the "Practice mode" bar disappears: the real AI is on.');
