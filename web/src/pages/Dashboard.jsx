import { publicMessage } from '../lib/errors.js';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ago, duration, naira, otherDeviceLink, useAuth, usePolling } from '../lib.jsx';
import { Alert, Button, Empty, Modal, PageLoader, PlanBadge, Spinner } from '../components/ui.jsx';
import BuyCredits, { creditsLeft } from '../components/BuyCredits.jsx';

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
function NewThing({ open, kind, onPick, onClose }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open || !kind) return;
    setError('');
    api('/projects', { method: 'POST', body: { title: kind === 'flyer' ? 'New flyer' : 'New video', kind } })
      .then(({ project }) => navigate(`/p/${project.id}/plan`, { replace: true }))
      .catch((e) => setError(e.message));
  }, [open, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} label="What do you want to make?">
      {error ? <Alert>{error}</Alert> : kind ? (
        <div className="py-10 text-center"><Spinner className="mx-auto size-8" /><p className="mt-3 text-ink-soft">Starting your {kind}…</p></div>
      ) : (
        <>
          <h2 className="text-xl font-bold">What do you want to make?</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[['video', 'Video ad', 'Motion graphics with music, as an MP4'], ['flyer', 'Flyer', 'A still design: picture to post, or PDF to print']].map(([k, l, d]) => (
              <button key={k} type="button" onClick={() => onPick(k)} className="press rounded-[14px] border border-ink/12 bg-white p-4 text-left hover:border-ink/40">
                <span className="grid size-10 place-items-center rounded-full bg-danfo text-white" aria-hidden="true">
                  {k === 'video'
                    ? <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3v10l8-5z" /></svg>
                    : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="2" width="10" height="12" rx="1.5" /><path d="M5.5 6h5M5.5 9h3" /></svg>}
                </span>
                <span className="mt-3 block font-semibold text-ink">{l}</span>
                <span className="mt-0.5 block text-sm leading-snug text-ink-mute">{d}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

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
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${flyer ? 'bg-[#FFE8A3] text-[#5A4300]' : 'bg-[#DCEBFF] text-[#0B3B80]'} ${className}`}>
      {flyer
        ? <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M2.5 9l2.5-3 2 2 1.5-1.5L10 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        : <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor" /></svg>}
      {flyer ? 'Flyer' : 'Video'}
    </span>
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
  const newParam = params.get('new');
  const newOpen = !!newParam;
  const newKind = newParam === 'video' || newParam === 'flyer' ? newParam : null;

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
    if (!confirm(`Delete "${p.title}"? This also deletes its videos.`)) return;
    await api(`/projects/${p.id}`, { method: 'DELETE' }); load();
  };

  if (!user) return <PageLoader />;
  const limit = pricing?.proVideosPerMonth || 30;

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-10 sm:px-10">
      <NewThing open={newOpen} kind={newKind} onPick={(k) => setParams({ new: k })} onClose={() => setParams({})} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-bold tracking-[-0.045em]">{kind === 'flyer' ? 'My flyers' : 'My videos'}</h1>
        <div className="flex flex-wrap items-center gap-4">
          {creditsLeft(user) !== null && (
            <span className="flex items-center gap-2 rounded-full border border-ink/12 bg-white px-3 py-1.5 text-sm">
              <b className="tabular-nums">{creditsLeft(user)}</b> {user.credits.free > 0 && !user.credits.paid ? 'free ' : ''}video{creditsLeft(user) === 1 ? '' : 's'} left
              <button className="font-semibold text-danfo hover:underline" onClick={() => setBuyOpen(true)}>Buy {user.credits.packSize}</button>
            </span>
          )}
          <OtherDevice onLinked={() => { load(); refresh(); }} />
        </div>
        {!user.testMode && (user.plan === 'pro'
          ? <p className="text-sm text-ink-soft">{user.proVideosRemaining} of {limit} ad-free videos left this month</p>
          : <Link to="/checkout" className="text-sm font-semibold text-ink-soft hover:text-ink">Upgrade to Pro for {naira(pricing?.proPriceNgn || 5000)}/month</Link>)}
      </div>
      <BuyCredits open={buyOpen} onClose={() => setBuyOpen(false)} />
      {paidMsg && <div className="mt-6 rounded-[12px] border border-money/30 bg-money/10 px-4 py-3 text-sm font-semibold text-ink" role="status">{paidMsg}</div>}
      <div className="mt-8"><Alert>{error}</Alert></div>
      {!projects ? <PageLoader /> : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          <li>
            <button onClick={() => setParams({ new: kind })} className="press group grid aspect-[4/5] w-full place-items-center rounded-xl border border-dashed border-ink/20 bg-white text-ink-soft hover:border-ink/40 hover:text-ink">
              <span className="flex flex-col items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full bg-danfo text-white"><svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg></span>
                <span className="font-semibold">{kind === 'flyer' ? 'New flyer' : 'New video'}</span>
              </span>
            </button>
          </li>
          {projects.map((p) => {
            const st = statusLabel(p);
            const ratio = p.aspect_ratio === '16:9' ? 'aspect-video w-full' : p.aspect_ratio === '1:1' ? 'aspect-square w-full' : p.aspect_ratio === '4:5' ? 'aspect-[4/5] h-full' : p.aspect_ratio === 'A4' ? 'aspect-[1240/1754] h-full' : 'aspect-[9/16] h-full';
            return (
              <li key={p.id} className="group">
                <Link to={nextStep(p)} className="block">
                  <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-xl bg-[#0B0A12]">
                    <div className={`relative ${ratio} overflow-hidden`}>
                      {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="size-full object-cover" loading="lazy" />
                        : <span className="grid size-full place-items-center"><img src="/animora-mark.png" alt="" className="size-10 animate-pulse opacity-60" /></span>}
                    </div>
                    <span className={`absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-xs font-semibold ${st.c}`}>{st.t}</span>
                    <KindBadge kind={p.kind} className="absolute right-2.5 top-2.5" />
                  </div>
                  <p className="mt-3 line-clamp-2 font-semibold leading-snug tracking-[-0.01em]">{p.title}</p>
                </Link>
                <div className="mt-1 flex items-center gap-3 text-sm text-ink-mute">
                  <span>{p.kind === 'flyer' ? 'Flyer' : duration(p.duration_seconds)}, {p.aspect_ratio}, {ago(p.updated_at)}</span>
                  {p.last_render?.status === 'done' && <a href={`/download/${p.last_render.id}`} className="font-semibold text-money hover:underline">Download</a>}
                  <button onClick={() => remove(p)} className="ml-auto opacity-0 hover:text-alert focus:opacity-100 group-hover:opacity-100" aria-label={`Delete ${p.title}`}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
