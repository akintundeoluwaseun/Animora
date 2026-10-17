// Voiceover: script formats for text-to-speech tools, and voice generation with Gemini TTS.
import { config } from '../config.js';
import { toMp3, assembleVoiceTrack, run, withTemp } from '../media.js';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Basic offline voice (espeak-ng, open source, runs on our server). Robotic, but works with no internet.
export const hasOfflineVoice = (() => { try { return spawnSync('espeak-ng', ['--version']).status === 0; } catch { return false; } })();

async function offlineSpeak(text) {
  return withTemp(async (dir) => {
    const wav = path.join(dir, 'v.wav');
    await run('espeak-ng', ['-v', 'en-gb+f3', '-s', '150', '-p', '45', '-w', wav, text]);
    return toMp3(await readFile(wav));
  });
}

export const SPEAKING_RATE = 2.3;   // words per second for a clear, friendly ad read
export const MAX_RATE = 3.0;        // faster than this sounds rushed

export const VOICES = [
  { name: 'Sulafat', tone: 'Warm' }, { name: 'Puck', tone: 'Upbeat' }, { name: 'Achird', tone: 'Friendly' },
  { name: 'Kore', tone: 'Firm' }, { name: 'Aoede', tone: 'Breezy' }, { name: 'Laomedeia', tone: 'Upbeat' },
  { name: 'Charon', tone: 'Informative' }, { name: 'Gacrux', tone: 'Mature' }, { name: 'Sadachbia', tone: 'Lively' },
];

export const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
export const speakSeconds = (s) => wordCount(s) / SPEAKING_RATE;

// ---------------------------------------------------------------------------
// Text that TTS engines read correctly (prices, phone numbers, symbols)
// ---------------------------------------------------------------------------
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function numberToWords(n) {
  n = Math.floor(Math.abs(Number(n)));
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${numberToWords(n % 100)}` : ''}`;
  for (const [size, word] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) {
    if (n >= size) {
      const rest = n % size;
      return `${numberToWords(Math.floor(n / size))} ${word}${rest ? (rest < 100 ? ' and ' : ' ') + numberToWords(rest) : ''}`;
    }
  }
  return String(n);
}

const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const PHONE_RE = /(\+?234[\s-]?|\b0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b/g;

export function speakable(text) {
  let s = String(text || '');
  // Phone numbers: digit by digit, in groups (0803 123 4567 -> "zero eight zero three, one two three, four five six seven")
  s = s.replace(PHONE_RE, (m) => {
    const d = m.replace(/\D/g, '').replace(/^234/, '0');
    const groups = d.length === 11 ? [d.slice(0, 4), d.slice(4, 7), d.slice(7)] : [d];
    return groups.map((g) => [...g].map((c) => DIGITS[c]).join(' ')).join(', ');
  });
  // Naira amounts: ₦2,500 / N2,500 / NGN 2500 / N8k / ₦1.5m
  s = s.replace(/(?:₦|NGN\s?|\bN(?=\d))\s?(\d[\d,]*(?:\.\d+)?)\s?(k|m)?\b/gi, (m, num, unit) => {
    let v = Number(num.replace(/,/g, ''));
    if (/k/i.test(unit || '')) v *= 1e3;
    if (/m/i.test(unit || '')) v *= 1e6;
    return `${numberToWords(v)} naira`;
  });
  s = s.replace(/(\d+(?:\.\d+)?)\s?%/g, (m, n) => `${numberToWords(n)} percent`);
  s = s.replace(/\b(\d{1,3}(?:,\d{3})+|\d+)\b/g, (m) => (m.length > 6 && !m.includes(',') ? m : numberToWords(m.replace(/,/g, ''))));
  s = s.replace(/&/g, ' and ').replace(/@(\w[\w.]*)/g, 'at $1').replace(/\b([a-z0-9-]+)\.(com|ng|org|net|co)\b/gi, '$1 dot $2');
  s = s.replace(/\s+([,.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  return s;
}

const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** All the ways the script is handed to the user. */
export function voiceoverFormats(plan) {
  const lines = (plan.scenes || []).filter((s) => s.voiceover && String(s.voiceover).trim());
  if (!lines.length) return null;
  const style = plan.voiceover?.voice_style || 'warm, friendly and upbeat';
  const timed = lines.map((s) => `[${clock(s.start)} – ${clock(s.end)}]  ${String(s.voiceover).trim()}`).join('\n\n');
  const plain = lines.map((s) => speakable(s.voiceover)).join('\n\n');
  const ssml = `<speak>\n${lines.map((s, i) => {
    const next = lines[i + 1];
    const gapMs = next ? Math.max(200, Math.round((next.start - s.start - speakSeconds(s.voiceover)) * 1000)) : 0;
    return `  <p><s>${esc(speakable(s.voiceover))}</s></p>${gapMs ? `\n  <break time="${Math.min(gapMs, 3000)}ms"/>` : ''}`;
  }).join('\n')}\n</speak>`;
  const words = lines.reduce((n, s) => n + wordCount(s.voiceover), 0);
  return {
    style, words, duration: plan.duration_seconds, estimatedSpeech: Math.round(words / SPEAKING_RATE),
    scenes: lines.map((s) => ({ id: s.id, start: s.start, end: s.end, text: String(s.voiceover).trim(), speakable: speakable(s.voiceover) })),
    timed, plain, ssml,
    tips: [
      `Voice: ${style}. Speed: normal (1.0×). Language: English (Nigeria) if the tool offers it.`,
      'Plain text works in ElevenLabs, CapCut, TikTok text-to-speech, Google AI Studio and most phone apps. Paste it as one block; the blank lines give natural pauses.',
      'SSML is for Google Cloud, Microsoft Azure and Amazon Polly text-to-speech: it adds exact pauses between scenes.',
      'Recording your own voice? Read the timed script and start each line at its time.',
      'Animora MP4 exports are silent; add generated audio separately in your preferred editor if needed.',
    ],
  };
}

// ---------------------------------------------------------------------------
// Gemini text-to-speech (the only external service; same API key)
// ---------------------------------------------------------------------------
const API = 'https://generativelanguage.googleapis.com/v1beta';
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
const TTS_LEGACY_MODEL = process.env.GEMINI_TTS_LEGACY_MODEL || 'gemini-2.5-flash-preview-tts';

function findAudio(obj) {
  // Returns { data, mime } from any Gemini response shape (Interactions API or generateContent).
  let found = null;
  (function walk(o) {
    if (!o || typeof o !== 'object' || found) return;
    if (o.inlineData?.data) { found = { data: o.inlineData.data, mime: o.inlineData.mimeType || '' }; return; }
    if ((o.type === 'audio' || /audio/.test(o.mime_type || o.mimeType || '')) && typeof o.data === 'string') { found = { data: o.data, mime: o.mime_type || o.mimeType || '' }; return; }
    for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
  })(obj);
  return found;
}

async function decode(audio) {
  const buf = Buffer.from(audio.data, 'base64');
  const isContainer = buf.slice(0, 4).toString() === 'RIFF' || buf.slice(0, 3).toString() === 'ID3' || /wav|mpeg|mp3|ogg/.test(audio.mime);
  const rate = Number((audio.mime.match(/rate=(\d+)/) || [])[1]) || 24000;
  return toMp3(buf, { rawPcm: !isContainer, sampleRate: rate });
}

export async function geminiSpeak(text, { voice = 'Sulafat', style = 'warm, friendly and upbeat' } = {}) {
  const key = config.geminiApiKey;
  if (!key) throw new Error('Voice generation needs a Gemini API key.');
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': key };
  const errors = [];

  // 1. Current Interactions API
  try {
    const res = await fetch(`${API}/interactions`, {
      method: 'POST', headers,
      body: JSON.stringify({
        model: TTS_MODEL,
        input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style }] }] }],
        response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
        generation_config: { speech_config: [{ voice }] },
      }),
    });
    const json = await res.json().catch(() => ({}));
    const audio = res.ok && findAudio(json);
    if (audio) return decode(audio);
    errors.push(`${TTS_MODEL}: ${res.status} ${json.error?.message || 'no audio returned'}`);
  } catch (e) { errors.push(`${TTS_MODEL}: ${e.message}`); }

  // 2. Older generateContent TTS
  try {
    const res = await fetch(`${API}/models/${TTS_LEGACY_MODEL}:generateContent`, {
      method: 'POST', headers,
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Say this in a ${style} voice: ${text}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      }),
    });
    const json = await res.json().catch(() => ({}));
    const audio = res.ok && findAudio(json);
    if (audio) return decode(audio);
    errors.push(`${TTS_LEGACY_MODEL}: ${res.status} ${json.error?.message || 'no audio returned'}`);
  } catch (e) { errors.push(`${TTS_LEGACY_MODEL}: ${e.message}`); }

  throw new Error(`Voice generation failed. ${errors.join(' | ')}`);
}

/** Speak every scene's line and place each at its scene start, so voice and visuals stay in sync.
 *  engine: 'gemini' (default when a key is set) or 'basic' (offline espeak-ng). Returns { mp3, duration, engine }. */
export async function generateVoiceTrack(plan, { voice, style, onProgress, engine } = {}) {
  const useBasic = engine === 'basic' || !config.geminiApiKey;
  if (useBasic && !hasOfflineVoice) throw new Error('No voice engine available: add a Gemini API key, or install espeak-ng for the basic offline voice.');
  const scenes = (plan.scenes || []).filter((s) => s.voiceover && String(s.voiceover).trim());
  if (!scenes.length) throw new Error('This plan has no voiceover script yet. Add one in the chat first.');
  const clips = [];
  for (let i = 0; i < scenes.length; i++) {
    onProgress?.(i, scenes.length);
    const s = scenes[i];
    const text = speakable(s.voiceover);
    const { mp3 } = useBasic ? await offlineSpeak(text) : await geminiSpeak(text, { voice, style: style || plan.voiceover?.voice_style });
    clips.push({ mp3, start: Number(s.start) + 0.15, maxLength: Math.max(0.8, Number(s.end) - Number(s.start) - 0.25) });
  }
  const track = await assembleVoiceTrack(clips, Number(plan.duration_seconds));
  return { ...track, engine: useBasic ? 'basic' : 'gemini' };
}
