// App chrome. Three modes, because a marketing page, a library and a focused editor need different navigation:
//   site   (/, /pricing)         top bar over the page, footer
//   app    (/videos /flyers ...) light side rail + mobile bottom tabs, one Create button
//   focus  (/p/:id/...)          no rail: a slim bar with "Back to library", all the room goes to the work
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, api, naira } from '../lib.jsx';
import { useInstall } from './InstallApp.jsx';
import { Logo, Modal, PlanBadge, DeveloperCard } from './ui.jsx';
import { creditsLeft } from './BuyCredits.jsx';

export function modeFor(pathname) {
  if (pathname === '/' || pathname === '/pricing') return 'site';
  if (pathname.startsWith('/p/')) return 'focus';
  return 'app';
}

const P = {
  videos: <path d="M4 5h16v14H4zM10 9l5 3-5 3z" />,
  flyers: <path d="M5 3h14v18H5zM8 15l3-3 2 2 3-3M9 7.5h.01" />,
  styles: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
  pricing: <path d="M4 7h16v10H4zM4 11h16M8 15h3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  back: <path d="M15 5l-7 7 7 7" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
};
const Icon = ({ k, size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[k]}</svg>;

// "What do you want to make?" lives in one place, reachable from every screen.
function CreateSheet({ open, onClose }) {
  const navigate = useNavigate();
  const go = (kind) => { onClose(); navigate(`/${kind === 'flyer' ? 'flyers' : 'videos'}?new=${kind}`); };
  const items = [
    ['video', 'Video ad', 'Motion graphics as an MP4 for WhatsApp, TikTok and YouTube', 'videos'],
    ['flyer', 'Flyer', 'A still design: a picture to post or a PDF to print', 'flyers'],
  ];
  return (
    <Modal open={open} onClose={onClose} label="Create">
      <h2 className="text-2xl font-bold tracking-[-0.03em]">What are we making?</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map(([k, t, d, icon]) => (
          <button key={k} onClick={() => go(k)} className={`press group rounded-2xl border-2 p-5 text-left ${k === 'flyer' ? 'border-[#FFD9BF] bg-[#FFF8F3] hover:border-flyer' : 'border-[#D9D6FF] bg-[#F6F5FF] hover:border-video'}`}>
            <span className={`grid size-11 place-items-center rounded-xl text-white ${k === 'flyer' ? 'bg-flyer' : 'bg-video'}`}><Icon k={icon} /></span>
            <span className="mt-4 block text-lg font-semibold tracking-[-0.02em]">{t}</span>
            <span className="mt-1 block text-sm leading-snug text-ink-mute">{d}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function useCreate() {
  const [open, setOpen] = useState(false);
  return { open, show: () => setOpen(true), hide: () => setOpen(false) };
}

// ---------------------------------------------------------------- site (marketing)
function SiteBar({ onCreate }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const link = ({ isActive }) => `rounded-lg px-3 py-2 text-[15px] font-medium transition-colors ${isActive ? 'text-white' : 'text-white/60 hover:text-white'}`;
  return (
    <header className={`sticky top-0 z-40 transition-colors ${solid ? 'bg-[#0B0A12]/85 backdrop-blur-xl border-b border-white/8' : 'bg-[#0B0A12] border-b border-transparent'}`}>
      <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-2 px-6 sm:px-10">
        <Logo light />
        <nav className="ml-8 hidden items-center gap-1 sm:flex" aria-label="Main">
          <NavLink to="/styles" className={link}>Styles</NavLink>
          <NavLink to="/pricing" className={link}>Pricing</NavLink>
          <NavLink to="/videos" className={link}>My work</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/videos" className="hidden rounded-lg px-3 py-2 text-[15px] font-medium text-white/70 hover:text-white sm:block">Open library</Link>
          <button onClick={onCreate} className="press h-10 rounded-[10px] bg-white px-4 text-[15px] font-semibold text-ink hover:bg-white/90">Make a video</button>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-white">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-6 py-12 sm:px-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-ink-soft">Motion-design video ads and flyers for businesses, directed by AI and rendered in minutes.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
          <span className="font-semibold">Product</span>
          <Link to="/styles" className="text-ink-soft hover:text-ink">Styles</Link>
          <Link to="/pricing" className="text-ink-soft hover:text-ink">Pricing</Link>
          <Link to="/videos" className="text-ink-soft hover:text-ink">My videos</Link>
          <Link to="/flyers" className="text-ink-soft hover:text-ink">My flyers</Link>
        </nav>
        <DeveloperCard />
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------- app (library)
const RAIL_LINKS = [
  ['Explore', [['/styles', 'Styles', 'styles'], ['/pricing', 'Pricing', 'pricing']]],
];
const railCls = ({ isActive }) => `group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14.5px] font-medium transition-colors ${isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-ink/5 hover:text-ink'}`;

function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const left = creditsLeft(user);
  return (
    <div className="space-y-2">
      {left !== null && (
        <Link to="/videos" className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-3.5 py-3 hover:border-ink/25">
          <span className="text-sm text-ink-soft">Videos left</span>
          <b className="text-lg tabular-nums tracking-[-0.03em]">{left}</b>
        </Link>
      )}
      {!user.testMode && (
        <div className="flex items-center justify-between px-1 text-sm text-ink-soft">
          <span className="flex items-center gap-2">{user.name.split(' ')[0]} <PlanBadge plan={user.plan} /></span>
          <button onClick={() => { logout(); navigate('/'); }} className="font-semibold hover:text-ink">Log out</button>
        </div>
      )}
    </div>
  );
}


// Videos and flyers are two different places, each with its own colour, home and "new" button.
function Studio({ kind, to, label, sub, icon }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const on = pathname.startsWith(to);
  const v = kind === 'video';
  const c = v ? { solid: 'bg-video', soft: 'bg-video-soft', text: 'text-video', ring: 'border-video' } : { solid: 'bg-flyer', soft: 'bg-flyer-soft', text: 'text-flyer', ring: 'border-flyer' };
  return (
    <div className={`overflow-hidden rounded-2xl border-2 bg-white transition-colors ${on ? c.ring : 'border-ink/8'}`}>
      <Link to={to} className={`flex items-center gap-3 px-3 py-3 ${on ? c.soft : 'hover:bg-ink/[0.03]'}`}>
        <span className={`grid size-10 place-items-center rounded-xl text-white ${c.solid}`}><Icon k={icon} size={20} /></span>
        <span className="min-w-0 leading-tight"><b className="block text-[15px] tracking-[-0.02em]">{label}</b><span className="block truncate text-xs text-ink-mute">{sub}</span></span>
      </Link>
      <button onClick={() => navigate(`${to}?new=${kind}`)} className={`press flex h-9 w-full items-center justify-center gap-1.5 border-t border-ink/8 text-[13px] font-semibold ${c.text} hover:${c.soft}`}>
        <Icon k="plus" size={15} />New {v ? 'video' : 'flyer'}
      </button>
    </div>
  );
}

function Rail({ onCreate }) {
  const [status, setStatus] = useState(null);
  const inst = useInstall();
  useEffect(() => { api('/status').then(setStatus).catch(() => {}); }, []);
  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-ink/8 bg-[#FBFBFD] lg:flex" aria-label="Main">
      <div className="px-5 pb-2 pt-6"><Logo /></div>
      <div className="mt-5 space-y-3 px-4">
        <Studio kind="video" to="/videos" label="Videos" sub="Motion ads, MP4" icon="videos" />
        <Studio kind="flyer" to="/flyers" label="Flyers" sub="Posters, still designs" icon="flyers" />
      </div>
      <nav className="mt-7 flex flex-col gap-6 px-3" aria-label="Sections">
        {RAIL_LINKS.map(([group, links]) => (
          <div key={group}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">{group}</p>
            <div className="flex flex-col gap-0.5">
              {links.map(([to, label, k]) => <NavLink key={to} to={to} className={railCls}><Icon k={k} size={19} />{label}</NavLink>)}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-auto space-y-3 p-4">
        {status?.ai === 'offline' && <p className="rounded-xl border border-ink/10 bg-white p-3 text-xs leading-relaxed text-ink-mute">Practice mode: add a Gemini key for the full AI director.</p>}
        {inst.can && <button onClick={inst.install} className="flex w-full items-center gap-2 rounded-[10px] border border-ink/12 bg-white px-3 py-2.5 text-sm font-semibold text-ink-soft hover:text-ink">Install the app</button>}
        <Account />
        <Link to="/" className="block px-1 text-xs text-ink-mute hover:text-ink">About Animora · Built by the developer</Link>
      </div>
    </aside>
  );
}

function BottomTabs({ onCreate }) {
  const [more, setMore] = useState(false);
  const tab = ({ isActive }) => `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-ink' : 'text-ink-mute'}`;
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-ink/10 bg-white/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Main">
        <NavLink to="/videos" className={({ isActive }) => `${tab({ isActive: false })} ${isActive ? '!text-video' : ''}`}><span className="grid size-8 place-items-center rounded-lg bg-video-soft text-video"><Icon k="videos" size={18} /></span>Videos</NavLink>
        <NavLink to="/flyers" className={({ isActive }) => `${tab({ isActive: false })} ${isActive ? '!text-flyer' : ''}`}><span className="grid size-8 place-items-center rounded-lg bg-flyer-soft text-flyer"><Icon k="flyers" size={18} /></span>Flyers</NavLink>
        <div className="flex flex-1 justify-center">
          <button onClick={onCreate} aria-label="Create" className="press -mt-5 grid size-14 place-items-center rounded-full bg-danfo text-white shadow-[0_10px_24px_-8px_var(--color-danfo)]"><Icon k="plus" size={26} /></button>
        </div>
        <NavLink to="/styles" className={tab}><Icon k="styles" />Styles</NavLink>
        <button onClick={() => setMore(true)} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-ink-mute"><Icon k="more" />More</button>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} label="More">
        <div className="flex flex-col gap-1" onClick={() => setMore(false)}>
          <Link to="/pricing" className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium hover:bg-ink/5"><Icon k="pricing" />Pricing</Link>
          <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium hover:bg-ink/5"><Icon k="styles" />About Animora</Link>
        </div>
        <div className="mt-4"><Account /></div>
        <div className="mt-4"><DeveloperCard /></div>
      </Modal>
    </>
  );
}

function AppTopBar() {   // phones only: logo plus videos-left
  const { user } = useAuth();
  const left = user ? creditsLeft(user) : null;
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-ink/8 bg-white/90 px-4 backdrop-blur-xl lg:hidden">
      <Logo />
      {left !== null && <span className="ml-auto rounded-full border border-ink/10 px-3 py-1 text-sm"><b className="tabular-nums">{left}</b> left</span>}
    </header>
  );
}

// ---------------------------------------------------------------- focus (editing a project)
function FocusBar() {
  const navigate = useNavigate();
  const { state } = useLocation();
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-ink/8 bg-white/90 px-3 backdrop-blur-xl sm:px-5">
      <button onClick={() => navigate('/videos')} className="press flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-ink-soft hover:bg-ink/5 hover:text-ink" aria-label="Back to library">
        <Icon k="back" size={18} />Library
      </button>
      <span className="h-5 w-px bg-ink/12" aria-hidden="true" />
      <Logo />
      {state?.hint && <span className="ml-auto text-sm text-ink-mute">{state.hint}</span>}
    </header>
  );
}

// ---------------------------------------------------------------- the shell
export default function Shell({ children }) {
  const { pathname } = useLocation();
  const mode = modeFor(pathname);
  const create = useCreate();
  const { user } = useAuth();
  void user; void naira;
  return (
    <div className={`app ${mode === 'app' ? 'lg:grid lg:grid-cols-[236px_minmax(0,1fr)]' : ''} ${mode === 'site' ? 'bg-white' : ''}`}>
      {mode === 'site' && <SiteBar onCreate={create.show} />}
      {mode === 'app' && <><Rail onCreate={create.show} /><AppTopBar /></>}
      {mode === 'focus' && <FocusBar />}
      <main className={`app-main ${mode === 'app' ? 'pb-28 lg:pb-12' : ''}`}>{children}</main>
      {mode === 'site' && <SiteFooter />}
      {mode === 'app' && <BottomTabs onCreate={create.show} />}
      <CreateSheet open={create.open} onClose={create.hide} />
    </div>
  );
}
