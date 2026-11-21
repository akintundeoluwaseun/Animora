// "Sound" tab for premium videos: the voice (pick from the voice library, hear a sample), spoken captions on or off,
// the sound effects (volume, how many, a fresh pick), every effect on a timeline with the visual moment that made it
// (hear it, swap it for another fitting sound, or switch it off), and background music started on the beat.
// Every change is saved as a new version of the video (Undo works), and the preview and the MP4 use the same choices.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib.jsx';
import { Alert, Spinner } from './ui.jsx';

// uisfx sound packs (CC0): one family of small sounds per film
const SOUND_STYLES = [['soft', 'Soft'], ['glass', 'Glass'], ['studio', 'Studio'], ['zen', 'Zen'], ['dreamy', 'Dreamy'], ['cinematic', 'Cinematic'], ['rubber', 'Playful'], ['scifi', 'Sci-fi']];

const ROLE_COLOR = { whoosh: '#6C5CE7', transition: '#6C5CE7', zoom: '#6C5CE7', impact: '#E84393', riser: '#E84393', sting: '#E84393', pop: '#00B894', ding: '#00B894', shimmer: '#00B894', click: '#0984E3', tick: '#0984E3', blip: '#0984E3', typing: '#FDCB6E', glitch: '#D63031' };
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${String(Math.floor((t % 1) * 10))}`;

// one shared audio context for hearing samples here (the preview has its own)
let ac = null; const bufs = {};
const actx = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());
async function buffer(k) { if (bufs[k]) return bufs[k]; const r = await fetch(`/sfx/${k}.wav`); bufs[k] = await actx().decodeAudioData(await r.arrayBuffer()); return bufs[k]; }
async function hear(k, v = 0.8) { try { const c = actx(); if (c.state !== 'running') await c.resume(); const s = c.createBufferSource(); const g = c.createGain(); g.gain.value = v; s.buffer = await buffer(k); s.connect(g).connect(c.destination); s.start(); } catch { /* sound unavailable */ } }

function Wave({ k }) {
  const ref = useRef(null);
  useEffect(() => {
    let off = false;
    buffer(k).then((b) => {
      if (off || !ref.current) return;
      const c = ref.current, x = c.getContext('2d'), d = b.getChannelData(0), W = c.width, H = c.height, step = Math.max(1, Math.floor(d.length / W));
      x.clearRect(0, 0, W, H); x.fillStyle = '#1B1446';
      for (let i = 0; i < W; i++) { let m = 0; for (let j = 0; j < step; j++) m = Math.max(m, Math.abs(d[i * step + j] || 0)); const h = Math.max(1, m * H); x.fillRect(i, (H - h) / 2, 1, h); }
    }).catch(() => {});
    return () => { off = true; };
  }, [k]);
  return <canvas ref={ref} width={260} height={36} className="h-9 w-full rounded-lg bg-lilac" aria-label={`Waveform of ${k}`} />;
}

export default function SoundPanel({ project, onUpdate, info, time = 0, control }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [sel, setSel] = useState(null);
  const sample = useRef(null);
  useEffect(() => { api(`/projects/${project.id}/audio`).then(setData).catch((e) => setErr(e.message)); }, [project.id, project.code]);
  const save = async (key, patch) => {
    setBusy(key); setErr(''); setMsg('');
    try {
      const r = await api(`/projects/${project.id}/audio`, { method: 'PATCH', body: patch });
      onUpdate(r.project);
      if (r.aligned) setMsg(r.aligned.errorMs < r.aligned.beforeMs ? `Music starts on the beat: the big moments now land within ${r.aligned.errorMs} ms of a beat (was ${r.aligned.beforeMs} ms).` : 'Music added.');
      else setMsg('Saved. Undo is under the preview.');
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const sfx = useMemo(() => (info?.sfx || []).filter((e) => e.id), [info]);
  const D = info?.d || 1;
  if (!data) return <div className="grid h-full place-items-center"><Spinner /></div>;
  if (!data.premium) return <div className="p-4 text-sm text-ink-soft">These sound settings work on the new premium videos. Press <b>Regenerate</b> under the preview to make this video with them.</div>;
  const a = data.audio || {}, voice = data.voice || {};
  const muted = new Set(a.mute || []);
  const chip = (on) => `press rounded-xl border px-3 py-2 text-left text-sm ${on ? 'border-ink bg-ink text-white' : 'border-ink/12 bg-white hover:border-ink/30'}`;
  const playVoice = (id) => { try { sample.current?.pause(); sample.current = new Audio(`/voices/${id}.mp3`); sample.current.play(); } catch { /* ignore */ } };
  const ev = sel ? sfx.find((e) => e.id === sel) : null;
  const toggleMute = (id) => { const m = new Set(muted); if (m.has(id)) m.delete(id); else m.add(id); save('mute', { mute: [...m] }); };

  return (
    <div className="h-full space-y-6 overflow-y-auto p-4">
      {msg && <p className="rounded-xl bg-money/10 px-3 py-2 text-sm font-semibold text-ink" role="status">{msg}</p>}
      {err && <Alert onClose={() => setErr('')}>{err}</Alert>}

      <section>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">Voice-over</h3>
          <button type="button" className={chip(voice.on)} disabled={!!busy} onClick={() => save('voice', { voiceOn: !voice.on })} aria-pressed={!!voice.on}>{busy === 'voice' ? '…' : voice.on ? 'On' : 'Off'}</button>
        </div>
        <p className="text-sm text-ink-mute">A natural voice reads the words on screen, with real pauses. It is added when your MP4 is made (the preview shows the captions).</p>
        {voice.on && (
          <>
            {['female', 'male'].map((g) => (
              <div key={g} className="mt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-mute">{g === 'female' ? 'Women' : 'Men'}</p>
                <div className="grid grid-cols-2 gap-2">
                  {data.voices.filter((v) => v.gender === g).map((v) => (
                    <div key={v.id} className={`${chip(voice.id === v.id)} flex items-center gap-2`}>
                      <button type="button" className="min-w-0 flex-1 text-left" disabled={!!busy || voice.id === v.id} onClick={() => save('voice-' + v.id, { voice: v.id })} aria-pressed={voice.id === v.id}>
                        <span className="block truncate font-semibold">{busy === 'voice-' + v.id ? '…' : v.name}</span>
                        <span className="block truncate text-xs opacity-70">{v.accent} · {v.tone}</span>
                      </button>
                      <button type="button" onClick={() => playVoice(v.id)} className="shrink-0 rounded-full bg-black/10 px-2 py-1 text-xs" aria-label={`Hear ${v.name}`}>▶</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <label className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span><b>Captions</b> <span className="text-ink-mute">— the spoken words on screen, word by word</span></span>
              <input type="checkbox" checked={voice.captions} disabled={!!busy} onChange={(e) => save('captions', { captions: e.target.checked })} className="size-5" />
            </label>
            {voice.lines?.length > 0 && <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-ink-soft">{voice.lines.map((l, i) => <li key={i}>{l}</li>)}</ol>}
          </>
        )}
      </section>

      <section>
        <h3 className="font-bold">Sound effects</h3>
        <p className="text-sm text-ink-mute">Each sound is picked for what moves on screen: a whoosh for a slide, a pop for a card, an impact for the ending.</p>
        <label className="mt-3 block text-sm font-semibold" htmlFor="sfx-vol">Volume <span className="font-normal text-ink-mute">({(a.sfxGain || 0) > 0 ? '+' : ''}{a.sfxGain || 0} dB)</span></label>
        <input id="sfx-vol" type="range" min={-18} max={6} step={1} defaultValue={a.sfxGain || 0} disabled={!!busy} onMouseUp={(e) => save('vol', { sfxGain: Number(e.currentTarget.value) })} onTouchEnd={(e) => save('vol', { sfxGain: Number(e.currentTarget.value) })} onKeyUp={(e) => save('vol', { sfxGain: Number(e.currentTarget.value) })} className="w-full" />
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[['low', 'Fewer'], ['normal', 'Normal'], ['high', 'More']].map(([v, l]) => (
            <button key={v} type="button" className={chip((a.density || 'normal') === v)} disabled={!!busy} onClick={() => save('density', { density: v })}>{busy === 'density' && (a.density || 'normal') !== v ? '…' : l}</button>
          ))}
        </div>
        <button type="button" className={`${chip(false)} mt-2 w-full text-center`} disabled={!!busy} onClick={() => save('shuffle', { reshuffle: true })}>{busy === 'shuffle' ? 'Choosing…' : 'Pick different sounds'}</button>
        <p className="mt-4 text-sm font-semibold">Sound style</p>
        <p className="text-sm text-ink-mute">The family of small sounds: taps, ticks, prices and the closing chime.</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {SOUND_STYLES.map(([v, l]) => (
            <button key={v} type="button" className={chip(a.pack === v)} disabled={!!busy} onClick={() => save('pack', { pack: v })}>{busy === 'pack' && a.pack !== v ? '…' : l}</button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-bold">Timeline</h3>
        <p className="text-sm text-ink-mute">Each mark is a sound, placed on the moment that made it. Tap one to hear it, change it or switch it off.</p>
        <div className="relative mt-3 h-12 rounded-xl bg-lilac" role="group" aria-label="Sound timeline">
          <div className="absolute inset-y-0 w-0.5 bg-ink/60" style={{ left: `${Math.min(100, (time / D) * 100)}%` }} aria-hidden="true" />
          {sfx.map((e) => (
            <button key={e.id} type="button" title={`${fmt(e.at ?? e.t)} ${e.label}`} onClick={() => { setSel(e.id); control?.current?.seek(Math.max(0, (e.at ?? e.t) - 0.05)); }}
              className={`absolute top-1.5 h-9 w-1.5 -translate-x-1/2 rounded-full ${sel === e.id ? 'ring-2 ring-ink' : ''}`}
              style={{ left: `${Math.min(100, ((e.at ?? e.t) / D) * 100)}%`, background: e.muted ? '#B2BEC3' : ROLE_COLOR[e.role] || '#636E72' }} aria-label={`${e.label} at ${fmt(e.at ?? e.t)}`} />
          ))}
        </div>
        {ev && (
          <div className="mt-3 space-y-2 rounded-2xl border border-ink/10 p-3">
            <p className="text-sm"><b>{ev.label}</b> <span className="text-ink-mute">at {fmt(ev.at ?? ev.t)}</span></p>
            <Wave k={ev.k} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(false)} onClick={() => control?.current?.playFrom((ev.at ?? ev.t) - 0.6)}>▶ Play this moment</button>
              <button type="button" className={chip(ev.muted)} disabled={!!busy} onClick={() => toggleMute(ev.id)}>{ev.muted ? 'Switched off (turn on)' : 'Switch off'}</button>
            </div>
            <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-ink-mute">Other sounds that fit</p>
            <div className="grid grid-cols-2 gap-2">
              {(ev.alts || []).map((k) => (
                <div key={k} className={`${chip(ev.k === k)} flex items-center gap-2`}>
                  <button type="button" className="min-w-0 flex-1 truncate text-left" disabled={!!busy || ev.k === k} onClick={() => save('swap', { swap: { ...(a.swap || {}), [ev.id]: k } })}>{ev.k === k ? '✓ ' : ''}{k.replace(/^mg-/, '')}</button>
                  <button type="button" onClick={() => hear(k)} className="shrink-0 rounded-full bg-black/10 px-2 py-1 text-xs" aria-label={`Hear ${k}`}>▶</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <ul className="mt-3 divide-y divide-ink/8 text-sm">
          {sfx.map((e) => (
            <li key={e.id} className="flex items-center gap-2 py-1.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: e.muted ? '#B2BEC3' : ROLE_COLOR[e.role] || '#636E72' }} aria-hidden="true" />
              <button type="button" className={`min-w-0 flex-1 truncate text-left ${e.muted ? 'text-ink-mute line-through' : ''}`} onClick={() => { setSel(e.id); control?.current?.seek(Math.max(0, (e.at ?? e.t) - 0.05)); }}>
                <span className="tabular-nums text-ink-mute">{fmt(e.at ?? e.t)}</span> {e.label}
              </button>
              <button type="button" onClick={() => hear(e.k, e.v || 0.6)} className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs" aria-label={`Hear ${e.label}`}>▶</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-bold">Music</h3>
        <p className="text-sm text-ink-mute">Free songs (public domain). The song starts where its beats meet your video's big moments; it gets quieter under the voice.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className={chip(!a.music)} disabled={!!busy || !a.music} onClick={() => save('music', { music: null })}>No music</button>
          {data.music.map((m) => (
            <button key={m.url} type="button" className={chip(a.music === m.url)} disabled={!!busy || a.music === m.url} onClick={() => save('music', { music: m.url, events: sfx.map((e) => ({ t: e.at ?? e.t, k: e.k, muted: e.muted })) })}>
              <span className="block truncate font-semibold">{busy === 'music' ? '…' : m.title}</span><span className="block truncate text-xs opacity-70">{m.mood} · {m.bpm} bpm</span>
            </button>
          ))}
        </div>
        {a.music && (
          <>
            <label className="mt-3 block text-sm font-semibold" htmlFor="mus-vol">Music volume <span className="font-normal text-ink-mute">({(a.musicGain || 0) > 0 ? '+' : ''}{a.musicGain || 0} dB)</span></label>
            <input id="mus-vol" type="range" min={-12} max={6} step={1} defaultValue={a.musicGain || 0} disabled={!!busy} onMouseUp={(e) => save('mvol', { musicGain: Number(e.currentTarget.value) })} onTouchEnd={(e) => save('mvol', { musicGain: Number(e.currentTarget.value) })} onKeyUp={(e) => save('mvol', { musicGain: Number(e.currentTarget.value) })} className="w-full" />
          </>
        )}
      </section>
    </div>
  );
}
