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

// ---------------------------------------------------------------- phones
// Remember which library you came from, so "back" from a project goes to Videos or Flyers correctly.
const LIB_KEY = 'animora.lib';
const rememberLib = (p) => { try { if (p === '/videos' || p === '/flyers') sessionStorage.setItem(LIB_KEY, p); } catch { /* private mode */ } };
export function announceKind(kind) { const p = kind === 'flyer' ? '/flyers' : '/videos'; rememberLib(p); window.dispatchEvent(new CustomEvent('animora:kind', { detail: p })); }
const lastLib = () => { try { return sessionStorage.getItem(LIB_KEY) || '/videos'; } catch { return '/videos'; } };

// A floating dock: five even slots. Videos and Flyers light up in their own colour, Create is raised in the middle.
function BottomTabs({ onCreate }) {
  const [me, setMe] = useState(false);
  const { pathname } = useLocation();
  const on = (to) => pathname.startsWith(to);
  const Slot = ({ to, label, icon, tone, onClick, active }) => {
    const inner = (
      <>
        <span className={`grid h-8 w-12 place-items-center rounded-full transition-colors duration-200 ${active ? tone.on : tone.idle}`}><Icon k={icon} size={20} /></span>
        <span className={`text-[11.5px] font-semibold leading-none ${active ? tone.text : 'text-ink-mute'}`}>{label}</span>
      </>
    );
    const cls = 'press flex min-w-0 flex-col items-center justify-center gap-1 py-1.5';
    return to ? <NavLink to={to} className={cls} aria-current={active ? 'page' : undefined}>{inner}</NavLink> : <button type="button" onClick={onClick} className={cls} aria-label={label === 'Me' ? 'Me: account, credits and more' : label}>{inner}</button>;
  };
  const T = {
    video: { on: 'bg-video text-white', idle: 'text-video', text: 'text-video' },
    flyer: { on: 'bg-flyer text-white', idle: 'text-flyer', text: 'text-flyer' },
    plain: { on: 'bg-ink text-white', idle: 'text-ink-soft', text: 'text-ink' },
  };
  return (
    <>
      <nav className="dock fixed inset-x-3 bottom-[max(10px,env(safe-area-inset-bottom))] z-40 lg:hidden" aria-label="Main">
        <div className="grid grid-cols-5 items-end rounded-[26px] border border-ink/8 bg-white/94 px-1 pb-1 pt-1.5 shadow-[0_18px_40px_-14px_rgba(20,18,40,.35)] backdrop-blur-xl">
          <Slot to="/videos" label="Videos" icon="videos" tone={T.video} active={on('/videos')} />
          <Slot to="/flyers" label="Flyers" icon="flyers" tone={T.flyer} active={on('/flyers')} />
          <button type="button" onClick={onCreate} aria-label="Create a video or flyer" className="press flex flex-col items-center gap-1 pb-1.5">
            <span className="dock-create -mt-6 grid size-14 place-items-center rounded-full text-white ring-4 ring-white"><Icon k="plus" size={26} /></span>
            <span className="text-[11.5px] font-bold leading-none text-ink">Create</span>
          </button>
          <Slot to="/styles" label="Styles" icon="styles" tone={T.plain} active={on('/styles')} />
          <Slot label="Me" icon="user" tone={T.plain} active={me} onClick={() => setMe(true)} />
        </div>
      </nav>
      <MeSheet open={me} onClose={() => setMe(false)} />
    </>
  );
}

// "Me": credits, plan, the rest of the app, sign out.
function MeSheet({ open, onClose }) {
  const { user } = useAuth();
  const inst = useInstall();
  const left = user ? creditsLeft(user) : null;
  const Row = ({ to, icon, children, sub }) => (
    <Link to={to} onClick={onClose} className="press flex items-center gap-3.5 rounded-2xl px-3 py-3.5 hover:bg-ink/5">
      <span className="grid size-10 place-items-center rounded-xl bg-ink/[0.05] text-ink-soft"><Icon k={icon} size={19} /></span>
      <span className="min-w-0 flex-1 leading-tight"><b className="block text-[15.5px] font-semibold">{children}</b>{sub && <span className="block text-[13px] text-ink-mute">{sub}</span>}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-ink-mute" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
  return (
    <Modal open={open} onClose={onClose} label="Me">
      <div className="mx-auto -mt-2 mb-4 h-1.5 w-10 rounded-full bg-ink/12 sm:hidden" aria-hidden="true" />
      {user && (
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-video to-flyer text-lg font-bold text-white">{String(user.name || 'You').trim().charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1 leading-tight"><b className="block truncate text-lg tracking-[-0.02em]">{user.testMode ? 'Welcome' : user.name}</b><span className="mt-0.5 inline-block"><PlanBadge plan={user.plan} /></span></div>
        </div>
      )}
      {left !== null && (
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Link to="/videos" onClick={onClose} className="rounded-2xl bg-video-soft p-4"><b className="block text-3xl tabular-nums tracking-[-0.04em] text-video">{left}</b><span className="text-[13px] font-semibold text-ink-soft">videos left</span></Link>
          <Link to="/pricing" onClick={onClose} className="rounded-2xl bg-ink p-4 text-white"><b className="block text-[15px]">Get more</b><span className="text-[13px] text-white/65">Buy a pack or go Pro</span></Link>
        </div>
      )}
      <div className="mt-4 flex flex-col">
        <Row to="/videos" icon="videos" sub="Motion ads you made">My videos</Row>
        <Row to="/flyers" icon="flyers" sub="Posters and still designs">My flyers</Row>
        <Row to="/styles" icon="styles" sub="Looks to start from">Styles</Row>
        <Row to="/pricing" icon="pricing" sub="Plans and video packs">Pricing</Row>
        <Row to="/" icon="more" sub="What Animora does">About Animora</Row>
      </div>
      {inst.can && <button onClick={() => { inst.install(); onClose(); }} className="press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-ink/12 py-3.5 text-[15px] font-semibold">Install the app on this phone</button>}
      <div className="mt-4"><Account /></div>
      <div className="mt-4"><DeveloperCard /></div>
    </Modal>
  );
}

function AppTopBar() {   // phones only: logo, the library you're in, videos left
  const { user } = useAuth();
  const { pathname } = useLocation();
  const left = user ? creditsLeft(user) : null;
  const kind = pathname.startsWith('/flyers') ? 'flyer' : pathname.startsWith('/videos') ? 'video' : null;
  return (
    <header className="sticky top-0 z-30 border-b border-ink/8 bg-white/88 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
      <div className="flex h-14 items-center gap-2 px-4">
        <Logo />
        {kind && <span className={`ml-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${kind === 'flyer' ? 'bg-flyer-soft text-flyer' : 'bg-video-soft text-video'}`}>{kind === 'flyer' ? 'Flyers' : 'Videos'}</span>}
        {left !== null && (
          <Link to="/pricing" className="press ml-auto flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-[13px] font-semibold text-ink-soft">
            <span className="size-2 rounded-full bg-money" aria-hidden="true" /><b className="tabular-nums text-ink">{left}</b> left
          </Link>
        )}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- focus (editing a project)
function FocusBar() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [back, setBack] = useState(lastLib);
  useEffect(() => { const on = (e) => setBack(e.detail); window.addEventListener('animora:kind', on); return () => window.removeEventListener('animora:kind', on); }, []);
  const flyer = back === '/flyers';
  return (
    <header className="sticky top-0 z-30 border-b border-ink/8 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="flex h-12 items-center gap-2 px-2 sm:gap-3 sm:px-5">
        <button onClick={() => navigate(back)} className={`press flex h-10 items-center gap-1 rounded-full pl-1.5 pr-3.5 text-[14px] font-semibold ${flyer ? 'text-flyer hover:bg-flyer-soft' : 'text-video hover:bg-video-soft'}`} aria-label={flyer ? 'Back to my flyers' : 'Back to my videos'}>
          <Icon k="back" size={20} />{flyer ? 'Flyers' : 'Videos'}
        </button>
        <span className="hidden h-5 w-px bg-ink/12 sm:block" aria-hidden="true" />
        <span className="hidden sm:block"><Logo /></span>
        {state?.hint && <span className="ml-auto truncate text-sm text-ink-mute">{state.hint}</span>}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- the shell
export default function Shell({ children }) {
  const { pathname } = useLocation();
  const mode = modeFor(pathname);
  useEffect(() => { rememberLib(pathname); }, [pathname]);
  const create = useCreate();
  const { user } = useAuth();
  void user; void naira;
  return (
    <div className={`app ${mode === 'app' ? 'lg:grid lg:grid-cols-[236px_minmax(0,1fr)]' : ''} ${mode === 'site' ? 'bg-white' : ''}`}>
      {mode === 'site' && <SiteBar onCreate={create.show} />}
      {mode === 'app' && <><Rail onCreate={create.show} /><AppTopBar /></>}
      {mode === 'focus' && <FocusBar />}
      <main className={`app-main ${mode === 'app' ? 'pb-32 lg:pb-12' : ''}`}>{children}</main>
      {mode === 'site' && <SiteFooter />}
      {mode === 'app' && <BottomTabs onCreate={create.show} />}
      <CreateSheet open={create.open} onClose={create.hide} />
    </div>
  );
}
