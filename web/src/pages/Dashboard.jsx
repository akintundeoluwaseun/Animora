import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ago, duration, naira, otherDeviceLink, useAuth, usePolling } from '../lib.jsx';
import { Alert, Button, Empty, Modal, PageLoader, PlanBadge, Spinner } from '../components/ui.jsx';

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

// "Use on another device": the same private videos on a second phone or computer (no sign-in).
function OtherDevice() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = otherDeviceLink();
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ title: 'My Animora', url: link }); return; } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* blocked */ }
  };
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm font-semibold text-ink-soft hover:text-ink">Use on another device</button>
      <Modal open={open} onClose={() => setOpen(false)} label="Use on another device">
        <h2 className="text-xl font-bold">Open your videos on another device</h2>
        <p className="mt-2 text-sm text-ink-soft">Your videos and flyers are private to this device. Open this link on your other phone or computer to see the same ones there. Keep it to yourself: anyone with the link can see and change them.</p>
        <input readOnly value={link} onFocus={(e) => e.target.select()} className="mt-4 w-full rounded-[10px] border border-ink/15 bg-lilac px-3 py-2.5 font-mono text-xs text-ink" aria-label="Your private link" />
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Close</Button>
          <Button className="flex-1" onClick={share}>{copied ? 'Copied' : 'Share or copy link'}</Button>
        </div>
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
  return { planning: { t: 'Planning', c: 'bg-white text-ink' }, coding: { t: p.kind === 'flyer' ? 'Designing' : 'Making video', c: 'bg-white text-ink' }, ready: { t: 'Ready', c: 'bg-ink text-white' }, rendered: { t: 'Video ready', c: 'bg-money text-white' } }[p.status];
}

function nextStep(p) {
  if (p.kind === 'flyer') return p.status === 'planning' ? `/p/${p.id}/plan` : `/p/${p.id}/studio`;
  if (p.last_render && ['queued', 'rendering', 'done'].includes(p.last_render.status)) return `/p/${p.id}/render`;
  return p.status === 'planning' ? `/p/${p.id}/plan` : `/p/${p.id}/studio`;
}

export default function Dashboard() {
  const { user, refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [error, setError] = useState('');
  const newParam = params.get('new');
  const newOpen = !!newParam;
  const newKind = newParam === 'video' || newParam === 'flyer' ? newParam : null;

  const load = async () => { try { setProjects((await api('/projects')).projects); } catch (e) { setError(e.message); } };
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
        <h1 className="text-4xl font-bold tracking-[-0.045em]">My videos</h1>
        <OtherDevice />
        {!user.testMode && (user.plan === 'pro'
          ? <p className="text-sm text-ink-soft">{user.proVideosRemaining} of {limit} ad-free videos left this month</p>
          : <Link to="/checkout" className="text-sm font-semibold text-ink-soft hover:text-ink">Upgrade to Pro for {naira(pricing?.proPriceNgn || 5000)}/month</Link>)}
      </div>
      <div className="mt-8"><Alert>{error}</Alert></div>
      {!projects ? <PageLoader /> : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          <li>
            <button onClick={() => setParams({ new: '1' })} className="press group grid aspect-[4/5] w-full place-items-center rounded-xl border border-dashed border-ink/20 bg-white text-ink-soft hover:border-ink/40 hover:text-ink">
              <span className="flex flex-col items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full bg-danfo text-white"><svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg></span>
                <span className="font-semibold">New video or flyer</span>
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
