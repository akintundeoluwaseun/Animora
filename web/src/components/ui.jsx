import { publicMessage } from '../lib/errors.js';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth, api, DEVELOPER } from '../lib.jsx';
import { useInstall } from './InstallApp.jsx';

export function Logo({ light = false }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap font-display text-[20px] font-bold tracking-[-0.04em]" aria-label="Animora home">
      <img src="/animora-mark.png" width="34" height="34" alt="" className="size-[34px] shrink-0" />
      <span className={light ? 'text-white' : 'text-ink'}>Animora</span>
    </Link>
  );
}

const SPRING = { type: 'spring', stiffness: 520, damping: 30, mass: 0.6 };
export function Button({ as: As = 'button', variant = 'primary', size = 'md', className = '', loading, children, ...rest }) {
  const v = {
    primary: 'bg-danfo text-white hover:bg-danfo-deep',
    dark: 'bg-ink text-white hover:bg-[#2A2160]',
    ghost: 'bg-transparent text-ink hover:bg-ink/5',
    outline: 'bg-white text-ink border border-ink/15 hover:border-ink/35',
    glass: 'bg-white/8 text-white border border-white/15 hover:bg-white/14',
    danger: 'bg-white text-alert border border-alert/30 hover:bg-alert/5',
    money: 'bg-money text-white hover:brightness-95',
  }[variant];
  const s = { sm: 'h-9 px-3.5 text-sm', md: 'h-11 px-5 text-[15px]', lg: 'h-12 px-6 text-base' }[size];
  const cls = `press inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] disabled:opacity-50 ${v} ${s} ${className}`;
  const off = loading || rest.disabled;
  // real buttons get a springy press and a small lift on hover
  if (As === 'button') return (
    <motion.button className={cls.replace('press ', '')} disabled={off} whileHover={off ? undefined : { y: -1.5 }} whileTap={off ? undefined : { scale: 0.96 }} transition={SPRING} {...rest}>
      {loading && <Spinner className="size-4" />}
      {children}
    </motion.button>
  );
  return (
    <As className={cls} disabled={off} {...rest}>
      {loading && <Spinner className="size-4" />}
      {children}
    </As>
  );
}

export function Spinner({ className = 'size-5' }) {
  return <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-sm text-ink-mute">{hint}</span>}
      {error && <span className="mt-1 block text-sm text-alert">{publicMessage(error)}</span>}
    </label>
  );
}

export const inputCls = 'w-full h-12 rounded-2xl border border-ink/12 bg-white px-4 text-[15px] text-ink placeholder:text-ink-mute shadow-[inset_0_1px_2px_rgba(27,20,70,.06)] focus:border-ink focus:outline-none';

export function Alert({ kind = 'error', children, onClose }) {
  if (!children) return null;
  const c = { error: 'bg-alert/8 text-alert border-alert/25', info: 'bg-lilac text-ink border-lilac-deep', success: 'bg-money/10 text-money border-money/25', warn: 'bg-danfo/15 text-ink border-danfo/40' }[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${c}`}>
      <div className="flex-1">{typeof children === 'string' ? publicMessage(children) : children}</div>
      {onClose && <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Dismiss">✕</button>}
    </div>
  );
}

export function Modal({ open, onClose, children, label, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="modal" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <motion.div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={`max-h-[92vh] w-full overflow-auto rounded-t-4xl bg-white p-6 text-ink shadow-2xl sm:rounded-4xl sm:p-8 ${wide === 'xl' ? 'sm:max-w-6xl' : wide ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PlanBadge({ plan }) {
  return plan === 'pro'
    ? <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-[#A9B4FF]">Pro</span>
    : <span className="rounded-full bg-lilac px-2.5 py-0.5 text-xs font-bold text-ink-soft">Free</span>;
}

// App shell navigation: a dark side rail on desktop (like an editing suite), a slim top bar + sheet on phones.
const I = {
  home: <path d="M4 11l8-7 8 7v9H4zM10 20v-6h4v6" />,
  videos: <path d="M4 5h16v14H4zM10 9l5 3-5 3z" />,
  flyers: <path d="M5 3h14v18H5zM8 15l3-3 2 2 3-3M9 7.5h.01" />,
  styles: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
  pricing: <path d="M4 7h16v10H4zM4 11h16M8 15h3" />,
  about: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01" />,
};
const Icon = ({ k }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[k]}</svg>;

export function Nav() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();
  const inst = useInstall();
  useEffect(() => { api('/status').then(setStatus).catch(() => {}); }, []);
  const links = [['/', 'Home', 'home'], ['/videos', 'My videos', 'videos'], ['/flyers', 'My flyers', 'flyers'], ['/styles', 'Styles', 'styles'], ['/pricing', 'Pricing', 'pricing']];
  const railLink = () => ({ isActive }) => `rail-link ${isActive ? 'is-active' : ''}`;
  const newVideo = () => { setOpen(false); navigate('/new/video'); };
  const newFlyer = () => { setOpen(false); navigate('/new/flyer'); };
  return (
    <>
      <aside className="rail" aria-label="Main">
        <div className="px-5 pt-6"><Logo light /></div>
        <div className="px-4 pt-7">
          <button onClick={newVideo} className="press flex h-11 w-full items-center justify-center gap-2 rounded-full bg-danfo font-semibold text-white hover:bg-danfo-deep">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I.videos}</svg>New video
          </button>
          <button onClick={newFlyer} className="press mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 font-semibold text-white hover:bg-white/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I.flyers}</svg>New flyer
          </button>
        </div>
        <nav className="mt-6 flex flex-col gap-1 px-3">
          {links.map(([to, l, k]) => <NavLink key={l} to={to} end={to === '/'} className={railLink(to)}><Icon k={k} />{l}</NavLink>)}
        </nav>
        <div className="mt-auto space-y-3 p-5 text-sm">
          <BuiltBy />
          {inst.can && <button onClick={inst.install} className="flex w-full items-center gap-2 rounded-full border border-white/12 px-3 py-2.5 font-semibold text-white/80 hover:text-white"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>Install the app</button>}
          {status && status.ai === 'offline' && <p className="rounded-lg border border-white/10 p-3 text-xs leading-relaxed text-white/55">Practice mode: add a Gemini API key for the full AI director.</p>}
          {user && !user.testMode && (
            <div className="flex items-center justify-between text-white/70">
              <span className="flex items-center gap-2">{user.name.split(' ')[0]} <PlanBadge plan={user.plan} /></span>
              <button onClick={() => { logout(); navigate('/'); }} className="font-semibold hover:text-white">Log out</button>
            </div>
          )}
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/8 bg-[#0B0A12] px-4 lg:hidden">
        <Logo light />
        <div className="ml-auto flex items-center gap-2">
          <button onClick={newVideo} className="press flex h-9 items-center gap-1.5 rounded-[9px] bg-danfo px-3 text-sm font-semibold text-white"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I.videos}</svg>Video</button>
          <button onClick={newFlyer} className="press flex h-9 items-center gap-1.5 rounded-[9px] border border-white/20 px-3 text-sm font-semibold text-white"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I.flyers}</svg>Flyer</button>
          <button className="press grid size-10 place-items-center rounded-xl text-white hover:bg-white/10" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={open ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} /></svg>
          </button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-x-0 top-14 z-40 border-b border-white/8 bg-[#0B0A12] p-3 lg:hidden" onClick={() => setOpen(false)}>
          <nav className="flex flex-col gap-1">{links.map(([to, l, k]) => <NavLink key={l} to={to} end={to === '/'} className={railLink(to)}><Icon k={k} />{l}</NavLink>)}</nav>
          {status && status.ai === 'offline' && <p className="mt-2 px-3 text-xs text-white/55">Practice mode: add a Gemini API key for the full AI director.</p>}
        </div>
      )}
    </>
  );
}

// A short burst of colour when something the person waited for is ready (the MP4). It answers their wait, plays once,
// and Motion skips it for people who ask their phone for less motion.
const BURST = ['#5546FF', '#F2691B', '#2FCB93', '#FFC93C', '#B06BFF', '#4F7DFF'];
export function Burst({ className = '' }) {
  const bits = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.2, d = 70 + (i * 37) % 70;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.75 - 20, r: (i * 53) % 180, c: BURST[i % BURST.length], w: i % 4 === 0 ? 10 : 7, round: i % 2 === 0 };
  });
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute left-6 top-2 ${className}`}>
      {bits.map((b, i) => (
        <motion.span key={i} className="absolute block" style={{ width: b.w, height: b.round ? b.w : b.w * 0.5, borderRadius: b.round ? 999 : 2, background: b.c }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }} animate={{ x: b.x, y: [0, b.y, b.y + 60], opacity: [1, 1, 0], rotate: b.r, scale: 1 }}
          transition={{ duration: 1.3, ease: [0.2, 0.8, 0.3, 1], times: [0, 0.55, 1] }} />
      ))}
    </span>
  );
}

// Chat / Edit / Video: move between a project's pages at any time, so the questions and the edits are never lost behind you.
export function ProjectTabs({ project, current, className = '' }) {
  if (!project?.id || !project.plan) return null;
  const id = project.id, flyer = project.kind === 'flyer';
  const tabs = [
    { key: 'chat', label: 'Chat', to: `/p/${id}/plan`, on: true, d: 'M4 5.5h16v11H10L5.5 20v-3.5H4z' },
    { key: 'edit', label: 'Edit', to: `/p/${id}/studio`, on: true, d: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4' },
    !flyer && { key: 'video', label: 'Video', to: `/p/${id}/render`, on: !!project.code, d: 'M4 5h16v14H4zM10 9l5 3-5 3z' },
  ].filter(Boolean);
  return (
    <nav aria-label="Project" className={`project-tabs inline-flex rounded-full border border-ink/10 bg-white p-1 ${className}`}>
      {tabs.map((t) => {
        const icon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t.d} /></svg>;
        const cls = 'flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors';
        if (t.key === current) return <span key={t.key} aria-current="page" className={`${cls} bg-ink text-white`}>{icon}{t.label}</span>;
        if (!t.on) return <span key={t.key} className={`${cls} text-ink-mute opacity-50`} title="Make the video first">{icon}{t.label}</span>;
        return <Link key={t.key} to={t.to} className={`press ${cls} text-ink-soft hover:bg-ink/5 hover:text-ink`}>{icon}{t.label}</Link>;
      })}
    </nav>
  );
}

// Plan -> Preview -> Video progress shown on the three main pages.
export function Steps({ current, projectId, hasPlan, hasCode }) {
  const steps = [
    { key: 'plan', label: 'Plan', to: `/p/${projectId}/plan`, enabled: true },
    { key: 'studio', label: 'Preview', to: `/p/${projectId}/studio`, enabled: hasPlan },
    { key: 'render', label: 'Video', to: `/p/${projectId}/render`, enabled: hasCode },
  ];
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-1 rounded-full border border-ink/10 bg-white p-1 text-sm font-medium" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1">
          {i > 0 && <span className={`h-0.5 w-3 rounded-full sm:w-6 ${i <= idx ? 'bg-ink' : 'bg-lilac-deep'}`} aria-hidden="true" />}
          {s.enabled && i !== idx ? (
            <Link to={s.to} className="press flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-ink-soft hover:bg-ink/5">
              <span className={`grid size-6 place-items-center rounded-full text-xs ${i < idx ? 'bg-ink text-white' : 'bg-lilac text-ink-soft'}`}>{i < idx ? '✓' : i + 1}</span>{s.label}
            </Link>
          ) : (
            <span aria-current={i === idx ? 'step' : undefined} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 ${i === idx ? 'bg-ink text-white' : 'text-ink-mute'}`}>
              <span className={`grid size-6 place-items-center rounded-full text-xs ${i === idx ? 'bg-danfo text-white' : 'bg-lilac'}`}>{i + 1}</span>{s.label}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="surface px-6 py-14 text-center">
      <div className="mx-auto mb-5 grid size-14 place-items-center rounded-xl bg-ink" aria-hidden="true">
        <img src="/animora-mark.png" width="34" height="34" alt="" />
      </div>
      <h3 className="text-2xl font-extrabold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PageLoader() {
  return <div className="grid min-h-[50vh] place-items-center text-ink-mute"><Spinner className="size-8" /></div>;
}

// The developer's credit: a small pill that opens the portfolio in a new tab.
export function BuiltBy({ className = '' }) {
  return (
    <a href={DEVELOPER.website} target="_blank" rel="noopener noreferrer" className={`built-by press ${className}`}
       aria-label="Built by Oluwaseun. Opens his portfolio in a new tab">
      <span className="built-by-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" /></svg>
      </span>
      <span>Built by <strong>Oluwaseun</strong></span>
    </a>
  );
}
