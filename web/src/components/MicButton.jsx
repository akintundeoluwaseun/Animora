// Voice input: tap the mic and speak; the words are typed into the box.
// Uses the browser's own speech recognition (Chrome, Android, Edge, Safari). Where that isn't available,
// it records the voice and the server turns it into text with Gemini.
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib.jsx';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function MicButton({ onText, onError, className = '' }) {
  const [state, setState] = useState('idle'); // idle | listening | working
  const rec = useRef(null);
  const chunks = useRef([]);
  const timer = useRef(null);
  useEffect(() => () => { try { rec.current?.stop(); } catch { /* already stopped */ } clearTimeout(timer.current); }, []);

  const supported = !!SR || (typeof window !== 'undefined' && !!window.MediaRecorder && !!navigator.mediaDevices?.getUserMedia);
  if (!supported) return null;

  const stop = () => { clearTimeout(timer.current); try { rec.current?.stop(); } catch { /* already stopped */ } };

  const start = async () => {
    onError?.('');
    if (SR) {
      const r = new SR();
      r.lang = navigator.language?.startsWith('en') ? navigator.language : 'en-NG';
      r.continuous = true; r.interimResults = false;
      r.onresult = (e) => {
        const said = [...e.results].slice(e.resultIndex).filter((x) => x.isFinal).map((x) => x[0].transcript).join(' ').trim();
        if (said) onText(said);
      };
      r.onerror = (e) => { if (e.error === 'not-allowed') onError?.('Allow the microphone for this site to use voice input.'); else if (e.error !== 'no-speech' && e.error !== 'aborted') onError?.("Couldn't hear that. Try again."); };
      r.onend = () => setState('idle');
      rec.current = r; r.start(); setState('listening');
      timer.current = setTimeout(stop, 60000);
      return;
    }
    // Fallback: record, then transcribe on the server
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' });
        if (blob.size < 1000) { setState('idle'); return; }
        setState('working');
        try {
          const form = new FormData(); form.append('file', blob, 'voice.webm');
          const { text } = await api('/transcribe', { method: 'POST', form });
          if (text) onText(text);
        } catch (e) { onError?.(e.message); } finally { setState('idle'); }
      };
      rec.current = mr; mr.start(); setState('listening');
      timer.current = setTimeout(stop, 60000);
    } catch {
      onError?.('Allow the microphone for this site to use voice input.');
    }
  };

  const listening = state === 'listening';
  return (
    <button type="button" onClick={listening ? stop : start} disabled={state === 'working'}
      aria-label={listening ? 'Stop voice input' : 'Speak your answer'} aria-pressed={listening} title={listening ? 'Tap to stop' : 'Speak instead of typing'}
      className={`press grid size-12 shrink-0 place-items-center rounded-[10px] border ${listening ? 'animate-pulse border-alert bg-alert text-white' : 'border-ink/15 bg-white text-ink hover:border-ink/35'} disabled:opacity-60 ${className}`}>
      {state === 'working'
        ? <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
        : listening
          ? <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
          : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>}
    </button>
  );
}
