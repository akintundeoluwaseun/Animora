import { publicMessage } from '../lib/errors.js';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ago, duration, naira, otherDeviceLink, useAuth, usePolling } from '../lib.jsx';
import { Alert, Button, Empty, Modal, PageLoader, PlanBadge, Spinner } from '../components/ui.jsx';
import BuyCredits, { creditsLeft } from '../components/BuyCredits.jsx';
import { FullView, goFull } from '../components/Preview.jsx';
import { downloadVideo } from '../lib/videoFile.js';
import { newPath } from '../components/Shell.jsx';

// A style card: shows the poster, plays the preview while hovered or focused.
export function StyleCard({ s, selected, onPick }) {
  const ref = useRef(null);
  const play = () => { const v = ref.current; if (v) { v.currentTime = 0; v.play().catch(() => {}); } };
  const stop = () => { const v = ref.current; if (v) v.pause(); };
  return (
    <button onClick={() => onPick(s)} aria-pressed={selected} onMouseEnter={play} onMouseLeave={stop} onFocus={play} onBlur={stop}
      className={`style-card group overflow-hidden rounded-3xl bg-white text-left ring-1 ${selected ? 'ring-4 ring-danfo' : 'ring-ink/8'}`}>
      <div className="relative aspect-[9/14] overflow-hidden" style={{ background: s.palette?.background || '#1B1446' }}>
        {s.poster_url && <img src={s.poster_url} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />}
        {s.preview_url && <video ref={ref} src={s.preview_url} className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" muted loop playsInline preload="none" />}
        <span className="absolute bottom-3 left-3 flex gap-1" aria-hidden="true">
          {['primary', 'secondary'].map((k) => s.palette?.[k] && <i key={k} className="size-4 rounded-full ring-2 ring-white/80" style={{ background: s.palette[k] }} />)}
        </span>
        {selected && <span className="absolute right-3 top-3 rounded-full bg-danfo px-2.5 py-1 text-xs font-bold text-white">Selected</span>}
      </div>
      <div className="p-3.5">
        <p className="font-display text-[17px] font-extrabold leading-tight">{s.name}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-ink-mute">{s.description}</p>
      </div>
    </button>
  );
}

export function StylePicker({ value, onPick }) {
  const [styles, setStyles] = useState(null);
  const [cat, setCat] = useState('All');
  useEffect(() => { api('/styles').then((r) => setStyles(r.styles)).catch(() => setStyles([])); }, []);
  if (!styles) return <div className="py-8 text-center text-ink-mute"><Spinner /></div>;
  const cats = ['All', ...new Set(styles.map((s) => s.palette?.category).filter(Boolean))];
  const shown = cat === 'All' ? styles : styles.filter((s) => s.palette?.category === cat);
  return (
    <div>
      {cats.length > 2 && (
        <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter styles">
          {cats.map((c) => <button key={c} className="chip press shrink-0" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {shown.map((s) => <StyleCard key={s.id} s={s} selected={value === s.id} onPick={onPick} />)}
      </div>
    </div>
  );
}

// New: pick a video or a flyer, then the guided questions start (the style comes later).

// "Link another device": the same private videos and bought videos on your phone and your computer (no sign-in).
// One device shows a 6-digit code; the other types it in. The long private link still works as a backup.
function OtherDevice({ onLinked }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(null);
  const [left, setLeft] = useState(0);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!code) return undefined; const t = setInterval(() => setLeft((s) => { if (s <= 1) { setCode(null); return 0; } return s - 1; }), 1000); return () => clearInterval(t); }, [code]);
  const make = async () => { setError(''); try { const r = await api('/devices/code', { method: 'POST' }); setCode(r.code); setLeft(r.minutes * 60); } catch (e) { setError(e.message); } };
  const link = async () => {
    setBusy(true); setError(''); setMsg('');
    try { const r = await api('/devices/link', { method: 'POST', body: { code: typed } }); setMsg(r.same ? 'This device is already linked.' : 'Linked. Your videos are here now.'); setTyped(''); onLinked?.(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const copyLink = async () => { try { await navigator.clipboard.writeText(otherDeviceLink()); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* blocked */ } };
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="13" height="10" rx="1.5" /><rect x="16" y="8" width="6" height="12" rx="1.5" /><path d="M6 18h6" /></svg>
        Sync my devices
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label="Sync my devices">
        <h2 className="text-xl font-bold">Sync your phone and computer</h2>
        <p className="mt-1 text-sm text-ink-soft">No account needed. Link your devices once and they share the same videos, flyers and bought videos.</p>

        <div className="mt-5 rounded-[16px] border border-ink/12 p-4">
          <p className="font-semibold text-ink">1. On this device</p>
          {code ? (
            <div className="mt-3 text-center">
              <p className="font-mono text-4xl font-bold tracking-[0.25em] text-ink tabular-nums" aria-live="polite">{code.slice(0, 3)} {code.slice(3)}</p>
              <p className="mt-1 text-xs text-ink-mute">Type it on your other device · expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p>
            </div>
          ) : <Button className="mt-3 w-full" onClick={make}>Show a code</Button>}
        </div>

        <div className="mt-3 rounded-[16px] border border-ink/12 p-4">
          <p className="font-semibold text-ink">2. Or, if the other device showed you a code</p>
          <div className="mt-3 flex gap-2">
            <input value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" aria-label="Code from your other device"
              className="min-w-0 flex-1 rounded-[10px] border border-ink/15 bg-white px-3 py-2.5 font-mono text-lg tracking-[0.2em] text-ink outline-none focus:border-ink/40" />
            <Button onClick={link} loading={busy} disabled={typed.length !== 6}>Link</Button>
          </div>
        </div>
        {msg && <p className="mt-3 text-sm font-semibold text-money" role="status">{msg}</p>}
        {error && <p className="mt-3 text-sm text-alert" role="alert">{publicMessage(error)}</p>}
        <button onClick={copyLink} className="mt-4 text-xs font-semibold text-ink-mute hover:text-ink">{copied ? 'Private link copied' : 'Or copy a private link instead'}</button>
      </Modal>
    </>
  );
}

function statusLabel(p) {
  const r = p.last_render;
  if (r?.status === 'rendering') return { t: `Rendering ${Math.round(r.progress)}%`, c: 'bg-danfo text-white' };
  if (r?.status === 'queued') return { t: 'In the queue', c: 'bg-danfo text-white' };
  if (r?.status === 'done') return { t: 'Video ready', c: 'bg-money text-white' };
  if (r?.status === 'failed') return { t: 'Render failed', c: 'bg-alert text-white' };
  return { planning: { t: 'Planning', c: 'bg-white text-ink' }, coding: { t: p.kind === 'flyer' ? 'Designing' : 'Making video', c: 'bg-white text-ink' }, ready: { t: p.kind === 'flyer' ? 'Flyer ready' : 'Ready', c: 'bg-ink text-white' }, rendered: { t: 'Video ready', c: 'bg-money text-white' } }[p.status];
}

// Video or flyer, at a glance: a play icon for videos, a picture icon for flyers.
export function KindBadge({ kind, className = '' }) {
  const flyer = kind === 'flyer';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${flyer ? 'bg-flyer text-white' : 'bg-video text-white'} ${className}`}>
      {flyer
        ? <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M2.5 9l2.5-3 2 2 1.5-1.5L10 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        : <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor" /></svg>}
      {flyer ? 'Flyer' : 'Video'}
    </span>
  );
}

// The ⋯ menu on a tile: make the MP4, make it and download it, download the last one, edit, delete.
const MI = {
  chat: <path d="M4 5.5h16v11H10L5.5 20v-3.5H4z" />,
  play: <path d="M7 4.5v15l12-7.5z" />, down: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />, edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13M10.5 11v5.5M13.5 11v5.5" />, full: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />, more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
};
const MIcon = ({ k }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={k === 'more' ? 3.2 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{MI[k]}</svg>;
function TileMenu({ p, onDelete, onFull }) {
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState(null);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest?.('[role="dialog"]')) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', off); window.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', off); window.removeEventListener('keydown', key); };
  }, [open]);
  const flyer = p.kind === 'flyer';
  const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
  const designed = p.status !== 'planning';
  const done = p.last_render?.status === 'done';
  const busy = ['queued', 'rendering'].includes(p.last_render?.status);
  const go = (to) => { setOpen(false); navigate(to); };
  const download = async () => {
    setOpen(false); setPct(0);
    try { const { render } = await api(`/renders/${p.last_render.id}`); if (render) await downloadVideo(render, p.title, setPct); else navigate(`/p/${p.id}/render?new=1&download=1`); }
    catch { navigate(`/p/${p.id}/render`); } finally { setPct(null); }
  };
  const items = flyer
    ? [designed && ['Edit flyer', 'edit', () => go(`/p/${p.id}/studio`)], designed && ['Open chat', 'chat', () => go(`/p/${p.id}/plan`)], designed && ['Full screen', 'full', () => { setOpen(false); onFull(p); }], !designed && ['Continue', 'edit', () => go(`/p/${p.id}/plan`)]]
    : designed
      ? [busy ? ['See progress', 'play', () => go(`/p/${p.id}/render`)] : ['Generate video', 'play', () => go(`/p/${p.id}/render?new=1`)],
        !busy && ['Generate & download', 'down', () => go(`/p/${p.id}/render?new=1&download=1`)],
        done && ['Download MP4', 'down', download],
        ['Edit video', 'edit', () => go(`/p/${p.id}/studio`)],
        ['Open chat', 'chat', () => go(`/p/${p.id}/plan`)]]
      : [['Continue planning', 'edit', () => go(`/p/${p.id}/plan`)]];
  return (
    <div ref={ref} className="relative ml-auto">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`More for ${p.title}`}
        className={`press grid size-9 place-items-center rounded-full ${open ? 'bg-ink text-white' : 'text-ink-soft hover:bg-ink/8 hover:text-ink'}`}>
        {pct != null ? <span className="text-[11px] font-bold tabular-nums">{Math.round(pct * 100)}%</span> : <MIcon k="more" />}
      </button>
      {open && phone && (
        <Modal open onClose={() => setOpen(false)} label={`${p.title}: options`}>
          <div className="mx-auto -mt-2 mb-4 h-1.5 w-10 rounded-full bg-ink/12" aria-hidden="true" />
          <p className="mb-3 truncate px-1 text-[17px] font-bold tracking-[-0.02em]">{p.title}</p>
          <div className="flex flex-col gap-1" role="menu">
            {items.filter(Boolean).map(([label, icon, fn]) => (
              <button key={label} role="menuitem" type="button" onClick={fn} className="press flex items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left text-[16px] font-semibold hover:bg-ink/5">
                <span className={`grid size-10 place-items-center rounded-xl ${flyer ? 'bg-flyer-soft text-flyer' : 'bg-video-soft text-video'}`}><MIcon k={icon} /></span>{label}
              </button>
            ))}
            <button role="menuitem" type="button" onClick={() => { setOpen(false); onDelete(p); }} className="press flex items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left text-[16px] font-semibold text-alert hover:bg-alert/8">
              <span className="grid size-10 place-items-center rounded-xl bg-alert/10"><MIcon k="trash" /></span>Delete
            </button>
          </div>
        </Modal>
      )}
      {open && !phone && (
        <div role="menu" className="tile-menu absolute right-0 top-10 z-30 w-56 overflow-hidden rounded-2xl border border-ink/10 bg-white p-1.5 shadow-[0_18px_44px_-12px_rgba(20,18,40,.35)]">
          {items.filter(Boolean).map(([label, icon, fn]) => (
            <button key={label} role="menuitem" type="button" onClick={fn} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] font-semibold text-ink hover:bg-ink/5">
              <span className={flyer ? 'text-flyer' : 'text-video'}><MIcon k={icon} /></span>{label}
            </button>
          ))}
          <div className="my-1 h-px bg-ink/8" />
          <button role="menuitem" type="button" onClick={() => { setOpen(false); onDelete(p); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] font-semibold text-alert hover:bg-alert/8">
            <MIcon k="trash" />Delete
          </button>
        </div>
      )}
    </div>
  );
}

function nextStep(p) {
  if (p.kind === 'flyer') return p.status === 'planning' ? `/p/${p.id}/plan` : `/p/${p.id}/studio`;
  if (p.last_render && ['queued', 'rendering', 'done'].includes(p.last_render.status)) return `/p/${p.id}/render`;
  return p.status === 'planning' ? `/p/${p.id}/plan` : `/p/${p.id}/studio`;
}

export default function Dashboard({ kind = 'video' }) {   // /videos shows videos, /flyers shows flyers
  const { user, refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [error, setError] = useState('');
  const [buyOpen, setBuyOpen] = useState(false);
  const [paidMsg, setPaidMsg] = useState('');
  // back from Paystack: confirm the payment and add the videos
  useEffect(() => {
    const ref = params.get('paid'); if (!ref) return;
    api(`/credits/verify?ref=${encodeURIComponent(ref)}`).then((r) => {
      setPaidMsg(r.status === 'paid' ? `Payment received. ${r.user?.credits?.packSize || 5} videos were added.` : "We're still waiting for Paystack to confirm your payment. It will show here once it does.");
      refresh();
    }).catch((e) => setPaidMsg(e.message)).finally(() => setParams({}, { replace: true }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // old "new" links (/videos?new=1, /flyers?new=flyer) start the project straight away
  const newParam = params.get('new');
  useEffect(() => { if (newParam) navigate(newPath(newParam === 'video' || newParam === 'flyer' ? newParam : kind), { replace: true }); }, [newParam]); // eslint-disable-line react-hooks/exhaustive-deps
  const startNew = () => navigate(newPath(kind));

  const [full, setFull] = useState(null);   // { html, aspect } of the flyer shown full screen
  // full screen starts inside the tap (browsers only allow it there); the flyer loads into it a moment later
  const openFull = async (p) => {
    const aspect = p.aspect_ratio || '4:5';
    goFull(aspect); setFull({ html: null, aspect });
    try { const { project } = await api(`/projects/${p.id}`); if (project.code) setFull({ html: project.code, aspect: project.aspectRatio || aspect }); else setFull(null); }
    catch (e) { setFull(null); setError(e.message); }
  };
  const load = async () => { try { setProjects((await api('/projects')).projects.filter((p) => (p.kind || 'video') === kind)); } catch (e) { setError(e.message); } };
  useEffect(() => { load(); refresh(); api('/pricing').then((r) => setPricing(r.pricing)).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // videos made online have no thumbnail yet: make them here, one at a time, in the background
  const thumbing = useRef(false);
  useEffect(() => {
    if (!projects || thumbing.current) return;
    const missing = projects.filter((p) => !p.thumbnail_url && ['ready', 'rendered'].includes(p.status)).slice(0, 6);
    if (!missing.length) return;
    thumbing.current = true;
    (async () => {
      try {
        const { snapshot } = await import('../lib/exportVideo.js');
        const { prepareHtml } = await import('../components/Preview.jsx');
        for (const m of missing) {
          try {
            const { project } = await api(`/projects/${m.id}`);
            if (!project.code) continue;
            const blob = await snapshot({ html: prepareHtml(project.code), aspect: project.aspectRatio });
            const form = new FormData(); form.append('file', blob, 'thumb.jpg');
            const r = await api(`/projects/${m.id}/thumbnail`, { method: 'POST', form });
            setProjects((list) => list?.map((x) => (x.id === m.id ? { ...x, thumbnail_url: r.thumbnailUrl } : x)));
          } catch { /* skip this one */ }
        }
      } finally { thumbing.current = false; }
    })();
  }, [projects?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = projects?.some((p) => ['queued', 'rendering'].includes(p.last_render?.status));
  usePolling(load, 3000, active);

  const remove = async (p) => {
    if (!confirm(p.kind === 'flyer' ? `Delete the flyer "${p.title}"?` : `Delete "${p.title}" and its MP4s? This can't be undone.`)) return;
    await api(`/projects/${p.id}`, { method: 'DELETE' }); load();
  };

  if (!user) return <PageLoader />;
  const limit = pricing?.proVideosPerMonth || 30;

  return (
    <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-10 sm:py-10">
      <div className={`mb-6 h-1.5 w-16 rounded-full ${kind === 'flyer' ? 'bg-flyer' : 'bg-video'}`} aria-hidden="true" />
      {full && <FullView html={full.html} aspect={full.aspect} still onClose={() => setFull(null)} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold tracking-[-0.045em] sm:text-4xl ${kind === 'flyer' ? 'text-flyer' : 'text-video'}`}>{kind === 'flyer' ? 'Your flyers' : 'Your videos'}</h1>
          <p className="mt-1 text-sm text-ink-mute">{projects?.length ? `${projects.length} ${kind === 'flyer' ? 'flyer' : 'video'}${projects.length === 1 ? '' : 's'}` : '\u00a0'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button className={kind === 'flyer' ? '!bg-flyer hover:!bg-flyer' : '!bg-video hover:!bg-video'} onClick={startNew}><svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>New {kind === 'flyer' ? 'flyer' : 'video'}</Button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-ink/8 py-3 text-sm">
        {creditsLeft(user) !== null && (
          <span className="flex items-center gap-2 text-ink-soft">
            <b className="tabular-nums text-ink">{creditsLeft(user)}</b> {user.credits.free > 0 && !user.credits.paid ? 'free ' : ''}video{creditsLeft(user) === 1 ? '' : 's'} left
            <button className="font-semibold text-danfo hover:underline" onClick={() => setBuyOpen(true)}>Buy {user.credits.packSize}</button>
          </span>
        )}
        {!user.testMode && (user.plan === 'pro'
          ? <span className="text-ink-soft">{user.proVideosRemaining} of {limit} ad-free videos left this month</span>
          : <Link to="/checkout" className="font-semibold text-ink-soft hover:text-ink">Upgrade to Pro for {naira(pricing?.proPriceNgn || 5000)}/month</Link>)}
        <span className="ml-auto"><OtherDevice onLinked={() => { load(); refresh(); }} /></span>
      </div>
      <BuyCredits open={buyOpen} onClose={() => setBuyOpen(false)} />
      {paidMsg && <div className="mt-6 rounded-[12px] border border-money/30 bg-money/10 px-4 py-3 text-sm font-semibold text-ink" role="status">{paidMsg}</div>}
      <div className="mt-8"><Alert>{error}</Alert></div>
      {!projects ? <PageLoader /> : !projects.length ? (
        // first visit: say what happens next, in three short steps, with one clear button
        <div className={`first-run rounded-3xl p-6 sm:p-10 ${kind === 'flyer' ? 'first-run-flyer' : ''}`}>
          <h2 className="max-w-[18ch] text-[1.75rem] font-bold leading-[1.1] tracking-[-0.04em] sm:text-4xl">{kind === 'flyer' ? 'Your first flyer is a few answers away.' : 'Your first video is a few answers away.'}</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {(kind === 'flyer'
              ? [['Tell me about your business', 'Name, what you sell, your offer. Skip anything you like.'], ['Pick a look', 'Or let Animora choose one that suits you.'], ['Download the picture', 'Ready for WhatsApp, Instagram or print.']]
              : [['Tell me about your business', 'Name, what you sell, your message, a few pictures.'], ['Watch the preview', 'Change anything by typing it, like "make it red".'], ['Download the MP4', 'With music and sound, ready for WhatsApp, TikTok or Instagram.']]
            ).map(([t, d], i) => (
              <li key={t} className="first-run-step">
                <span className="first-run-num" aria-hidden="true">{i + 1}</span>
                <b className="block text-[15px]">{t}</b>
                <span className="mt-0.5 block text-sm text-ink-soft">{d}</span>
              </li>
            ))}
          </ol>
          <Button size="lg" className={`mt-7 w-full sm:w-auto ${kind === 'flyer' ? '!bg-flyer hover:!bg-flyer' : '!bg-video hover:!bg-video'}`} onClick={startNew}>{kind === 'flyer' ? 'Make my first flyer' : 'Make my first video'}</Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          <li>
            <button onClick={startNew} className="press group grid aspect-[9/14] w-full place-items-center rounded-xl border border-dashed border-ink/20 bg-white text-ink-soft hover:border-ink/40 hover:text-ink">
              <span className="flex flex-col items-center gap-3">
                <span className={`grid size-12 place-items-center rounded-full text-white ${kind === 'flyer' ? 'bg-flyer' : 'bg-video'}`}><svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg></span>
                <span className="font-semibold">{kind === 'flyer' ? 'New flyer' : 'New video'}</span>
              </span>
            </button>
          </li>
          {projects.map((p, i) => {
            const st = statusLabel(p);
            const tile = p.aspect_ratio === '16:9' ? 'aspect-video' : p.aspect_ratio === '1:1' ? 'aspect-square' : p.aspect_ratio === 'A4' ? 'aspect-[1240/1754]' : p.aspect_ratio === '4:5' ? 'aspect-[4/5]' : 'aspect-[9/14]';
            return (
              <motion.li key={p.id} className="group" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28, delay: Math.min(i, 12) * 0.035 }}>
                <Link to={nextStep(p)} className="block">
                  <div className={`relative grid ${tile} place-items-center overflow-hidden ${p.kind === 'flyer' ? 'rounded-md bg-[#F4EFE8] p-2 ring-2 ring-flyer/35' : 'rounded-xl bg-[#0B0A12] ring-2 ring-video/30'} transition-transform duration-200 group-hover:-translate-y-0.5`}>
                    <div className={`relative size-full overflow-hidden ${p.kind === 'flyer' ? 'shadow-md' : ''}`}>
                      {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="size-full object-cover" loading="lazy" />
                        : <span className="grid size-full place-items-center"><img src="/animora-mark.png" alt="" className="size-10 animate-pulse opacity-60" /></span>}
                    </div>
                    <span className={`absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-xs font-semibold ${st.c}`}>{st.t}</span>
                    <KindBadge kind={p.kind} className="absolute right-2.5 top-2.5" />
                    {p.kind !== 'flyer' && <span className="pointer-events-none absolute inset-0 grid place-items-center"><span className="grid size-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur"><svg width="18" height="18" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 1.8v8.4L10 6z" fill="currentColor" /></svg></span></span>}
                    {p.kind !== 'flyer' && p.duration_seconds > 0 && <span className="absolute bottom-2.5 left-2.5 rounded bg-black/65 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white">{duration(p.duration_seconds)}</span>}
                    {p.kind === 'flyer' && ['ready', 'rendered'].includes(p.status) && (
                      <button type="button" aria-label={`See ${p.title} full screen`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); openFull(p); }}
                        className="press absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/80">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>Full screen
                      </button>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 font-semibold leading-snug tracking-[-0.01em]">{p.title}</p>
                </Link>
                <div className="mt-1 flex items-center gap-2 text-sm text-ink-mute">
                  <span>{p.kind === 'flyer' ? 'Flyer' : duration(p.duration_seconds)}, {p.aspect_ratio}, {ago(p.updated_at)}</span>
                  <TileMenu p={p} onDelete={remove} onFull={openFull} />
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
