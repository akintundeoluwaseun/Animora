// Live preview of AI-written animation code.
// The page runs in a sandboxed iframe. We never let it play on its own clock: a small bridge
// script seeks the paused GSAP timeline every frame, exactly like the render engine does,
// so what you scrub here is what ends up in the MP4.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ASPECTS, clock } from '../lib.jsx';

const BRIDGE = `<script>(function(){
  var tl=null, playing=false, last=0;
  function post(type, extra){ parent.postMessage(Object.assign({__adflash:true,type:type}, extra||{}), '*'); }
  function state(){ post('time',{t:tl.time(), d:tl.duration(), playing:playing}); }
  function loop(ts){ if(!playing) return; if(!last) last=ts; var t=tl.time()+(ts-last)/1000; last=ts;
    if(t>=tl.duration()){ t=tl.duration(); playing=false; } tl.seek(t,false); state(); if(playing) requestAnimationFrame(loop); }
  window.addEventListener('message', function(e){ var m=e.data||{}; if(!m.__adflash||!tl) return;
    if(m.cmd==='play'){ if(tl.time()>=tl.duration()-0.02) tl.seek(0,false); playing=true; last=0; requestAnimationFrame(loop); }
    else if(m.cmd==='pause'){ playing=false; state(); }
    else if(m.cmd==='seek'){ tl.seek(m.t,false); state(); } });
  // drawn at the size it is shown (not full HD shrunk down): far less work for phones
  window.addEventListener('message', function(e){ var m=e.data||{}; if(m.__adflash&&m.cmd==='zoom'&&m.z>0) document.documentElement.style.zoom=m.z; });
  try { var z0=parseFloat(window.name); if(z0>0) document.documentElement.style.zoom=z0; } catch(_){}
  window.addEventListener('error', function(e){ post('error',{message:String(e.message||'Script error')}); });
  window.addEventListener('load', function(){ var n=0; (function wait(){ tl=window.__timeline;
    if(tl){ tl.pause(); if(window.gsap&&gsap.globalTimeline){ gsap.globalTimeline.getChildren(false,true,true).forEach(function(c){ if(c!==tl) c.pause(); }); }
      tl.seek(0,false); post('ready',{d:tl.duration(), sfx:(window.__sfx||[]), music:((window.ADFLASH_DATA||{}).music||null)}); }
    else if(n++<120) setTimeout(wait,50); else post('error',{message:'The animation has no timeline.'}); })(); });
})();<\/script>`;

export function prepareHtml(html) {
  if (!html) return '';
  const origin = window.location.origin;
  // Use our own copy of GSAP (fast, same build as the renderer, works when cdnjs is slow).
  let out = html.replace(/<script([^>]*?)src=["']https?:\/\/[^"']*gsap[^"']*\/([A-Za-z]+)(?:\.min)?\.js["']/gi,
    (m, attrs, name) => `<script${attrs}src="${origin}/vendor/gsap/${name}.min.js"`);
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${BRIDGE}</body>`) : out + BRIDGE;
  return out;
}

export function PhoneFrame({ aspect = '9:16', maxWidth = 340, children, className = '' }) {
  const a = ASPECTS[aspect] || ASPECTS['9:16'];
  const wide = a.w > a.h;
  return (
    <div className={`phone mx-auto w-full ${className}`} style={{ maxWidth: wide ? Math.max(maxWidth * 1.9, 560) : a.w === a.h ? maxWidth * 1.25 : maxWidth }}>
      <div className="phone-screen" style={{ aspectRatio: `${a.w} / ${a.h}` }}>{children}</div>
    </div>
  );
}

// Sound effects in the preview: the animation's cues are played with Web Audio as the playhead passes them.
let audio = null;
const buffers = {};
function ctx() { if (!audio) { const C = window.AudioContext || window.webkitAudioContext; if (C) audio = new C(); } return audio; }
async function sound(k) {
  if (buffers[k] !== undefined) return buffers[k];
  buffers[k] = null;
  try { const r = await fetch(`/sfx/${k}.wav`); buffers[k] = await ctx().decodeAudioData(await r.arrayBuffer()); } catch { buffers[k] = null; }
  return buffers[k];
}
// every effect goes through one master bus (glue compressor + make-up gain), like the downloaded MP4
let bus = null;
function master(c) {
  if (bus) return bus;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.15;
  const out = c.createGain(); out.gain.value = 1.9;
  comp.connect(out).connect(c.destination);
  bus = comp; return bus;
}
function playSfx(e) {
  const c = ctx(); const b = buffers[e.k];
  if (!c || c.state !== 'running' || !b) return;
  const src = c.createBufferSource(); const g = c.createGain();
  g.gain.value = Math.min(1.2, (e.v || 1) * 0.8); src.buffer = b; src.connect(g).connect(master(c)); src.start();
}

export function LivePreview({ html, aspect = '9:16', autoPlay = true, maxWidth = 340, onError, sound: soundOn = true, onSoundChange, still = false, onEnded }) {
  const sfxRef = useRef([]);
  const musicRef = useRef(null);
  useEffect(() => () => { musicRef.current?.pause(); }, []);
  const lastT = useRef(0);
  const [audioReady, setAudioReady] = useState(false);
  const unlock = () => { const c = ctx(); if (c && c.state !== 'running') c.resume().then(() => setAudioReady(true)).catch(() => {}); else if (c) setAudioReady(true); };
  const [scale, setScale] = useState(0.25);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const a = ASPECTS[aspect] || ASPECTS['9:16'];
  const frameRef = useRef(null);
  const boxRef = useRef(null);
  const srcDoc = useMemo(() => prepareHtml(html), [html]);
  const scaleRef = useRef(scale);
  const wasPlaying = useRef(false);
  const onEndedRef = useRef(onEnded);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { scaleRef.current = scale; frameRef.current?.contentWindow?.postMessage({ __adflash: true, cmd: 'zoom', z: scale }, '*'); }, [scale]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / a.w));
    ro.observe(el);
    return () => ro.disconnect();
  }, [a.w]);

  useEffect(() => {
    setReady(false); setError(null); setT(0); setPlaying(false);
    const onMsg = (e) => {
      if (e.source !== frameRef.current?.contentWindow || !e.data?.__adflash) return;
      const m = e.data;
      if (m.type === 'ready') {
        send({ cmd: 'zoom', z: scaleRef.current });
        setReady(true); setD(m.d); sfxRef.current = m.sfx || []; lastT.current = 0;
        // background music: an <audio> element kept in step with the timeline
        if (musicRef.current) { musicRef.current.pause(); musicRef.current = null; }
        if (m.music?.url) { const a = new Audio(m.music.url); a.loop = true; a.volume = 0.45; a.preload = 'auto'; musicRef.current = a; }
        if (ctx()) [...new Set(sfxRef.current.map((e) => e.k))].forEach((k) => sound(k));
        if (autoPlay) send({ cmd: 'play' });
      }
      if (m.type === 'time') {
        // play every sound cue the playhead just passed (only while playing forward, not when scrubbing)
        if (m.playing && soundRef.current && m.t > lastT.current && m.t - lastT.current < 0.5) {
          for (const ev of sfxRef.current) if (ev.t > lastT.current && ev.t <= m.t) playSfx(ev);
        }
        const mu = musicRef.current;
        if (mu) {
          if (m.playing && soundRef.current && audio?.state === 'running') {
            if (mu.paused || Math.abs(mu.currentTime - m.t) > 0.25) { try { mu.currentTime = m.t % (mu.duration || 1e9); } catch { /* not loaded yet */ } }
            if (mu.paused) mu.play().catch(() => {});
            mu.volume = Math.min(0.45, 0.45 * Math.min(1, (m.d - m.t) / 1.5));   // fade out at the end, like the MP4
          } else if (!mu.paused) mu.pause();
        }
        lastT.current = m.t;
        if (wasPlaying.current && !m.playing && m.d > 0 && m.t >= m.d - 0.05) onEndedRef.current?.();   // played to the end
        wasPlaying.current = m.playing;
        setT(m.t); setD(m.d); setPlaying(m.playing);
      }
      if (m.type === 'error') { setError(m.message); onError?.(m.message); }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [srcDoc]); // eslint-disable-line react-hooks/exhaustive-deps

  const soundRef = useRef(soundOn);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);
  const send = (msg) => frameRef.current?.contentWindow?.postMessage({ __adflash: true, ...msg }, '*');
  const toggle = () => { unlock(); if (playing) send({ cmd: 'pause' }); else send({ cmd: 'play' }); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div>
      <PhoneFrame aspect={aspect} maxWidth={maxWidth}>
        <div ref={boxRef} className="absolute inset-0">
          {srcDoc && (
            <iframe ref={frameRef} title="Video preview" sandbox="allow-scripts" srcDoc={srcDoc} name={String(scale)}
              style={{ width: Math.ceil(a.w * scale), height: Math.ceil(a.h * scale), border: 0, display: 'block', overflow: 'hidden' }} scrolling="no" />
          )}
          {!ready && !error && <div className="absolute inset-0 grid place-items-center bg-ink text-sm text-white/70">Loading preview…</div>}
          {error && <div className="absolute inset-0 grid place-items-center bg-ink p-6 text-center text-sm text-white">This version has an error: {error}<br />Try "Undo" or "Regenerate".</div>}
          {!still && <button onClick={toggle} className="absolute inset-0 cursor-pointer" aria-label={playing ? 'Pause' : 'Play'} disabled={!ready} />}
        </div>
      </PhoneFrame>
      {!still && <div className="mx-auto mt-4 flex items-center gap-3" style={{ maxWidth: Math.max(maxWidth, 320) * (a.w > a.h ? 1.9 : 1) }}>
        <button onClick={toggle} disabled={!ready} className="press grid size-12 shrink-0 place-items-center rounded-full bg-danfo text-white disabled:opacity-40" aria-label={playing ? 'Pause' : 'Play'}>
          {playing
            ? <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
            : <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5Z" /></svg>}
        </button>
        <input type="range" className="range flex-1" min={0} max={d || 1} step={1 / 30} value={t} disabled={!ready}
          onChange={(e) => { send({ cmd: 'pause' }); send({ cmd: 'seek', t: Number(e.target.value) }); }} aria-label="Seek" />
        <span className="w-24 text-right text-sm tabular-nums text-white/70">{clock(t)} / {clock(d)}</span>
        {onSoundChange && (
          <button onClick={() => { unlock(); onSoundChange(!(soundOn && audioReady) ? true : false); }} className="press grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label={soundOn && audioReady ? 'Turn sound effects off' : 'Turn sound effects on'} title={soundOn ? 'Sound effects on' : 'Sound effects off'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" />{soundOn && audioReady ? <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /> : <path d="M17 9l5 6M22 9l-5 6" />}</svg>
          </button>
        )}
      </div>}
    </div>
  );
}

export function VideoPhone({ src, aspect = '9:16', maxWidth = 320, poster, autoPlay = false, loop = false, muted = false, controls = true, className }) {
  return (
    <PhoneFrame aspect={aspect} maxWidth={maxWidth} className={className}>
      <video src={src} poster={poster} className="absolute inset-0 size-full object-cover" playsInline controls={controls}
        autoPlay={autoPlay} loop={loop} muted={muted || autoPlay} preload="metadata" />
    </PhoneFrame>
  );
}

// Full screen: the flyer (or video) as big as the screen allows, sharp, with every detail readable.
export function FullView({ html, aspect = '9:16', still = false, onClose }) {
  const [box, setBox] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const fit = () => setBox({ w: window.innerWidth, h: window.innerHeight });
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('resize', fit); window.addEventListener('keydown', key);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [onClose]);
  const a = ASPECTS[aspect] || ASPECTS['9:16'];
  const width = Math.floor(Math.min(box.w - 24, (box.h - (still ? 90 : 150)) * (a.w / a.h)));
  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/92 p-3" role="dialog" aria-modal="true" aria-label="Full screen" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full bg-white/12 text-white hover:bg-white/20" aria-label="Close full screen">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <div onClick={(e) => e.stopPropagation()}>
        <LivePreview html={html} aspect={aspect} maxWidth={width} still={still} autoPlay={!still} />
      </div>
    </div>
  );
}
