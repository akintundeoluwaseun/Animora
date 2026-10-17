// Voice input fallback: browsers without built-in speech recognition send a short recording; Gemini writes it out.
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth.js';
import { config } from '../config.js';
import { geminiGenerate } from '../engine/gemini.js';

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

r.post('/transcribe', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No recording received. Try again.' });
  if (!config.useGemini) return res.status(400).json({ error: "Voice input isn't available in this browser. Use the microphone on your phone's keyboard instead." });
  try {
    const { text } = await geminiGenerate({
      system: 'Write out exactly what the speaker says, in the language they speak (Nigerian English, Pidgin and Yoruba words are common). Return only the words, no notes, no quotes.',
      messages: [{ role: 'user', text: 'Transcribe this recording.', images: [{ mimeType: (req.file.mimetype || 'audio/webm').split(';')[0], data: req.file.buffer.toString('base64') }] }],
      temperature: 0, timeoutMs: 25000, maxOutputTokens: 1024,
    });
    res.json({ text: String(text || '').trim() });
  } catch (e) {
    res.status(502).json({ error: `Couldn't turn that into text (${String(e.message).slice(0, 120)}). Try again or type it.` });
  }
});

export default r;
