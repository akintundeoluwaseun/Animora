import { Component, StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { initTheme } from './components/ThemeToggle.jsx';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import './styles.css';
import { AuthProvider, useAuth } from './lib.jsx';
import { PageLoader } from './components/ui.jsx';
import Shell from './components/Shell.jsx';
import Home from './pages/Home.jsx';
import ExportScreen from './components/ExportScreen.jsx';
import InstallPrompt from './components/InstallApp.jsx';

// every page fades in softly (opacity only, so fixed toasts and dialogs inside keep their place)
function PageFade({ children }) {
  const { pathname } = useLocation();
  // a CSS fade (not a JS animation): it always ends fully visible, even when the first frame is slow or the tab starts hidden
  return <div key={pathname} className="page-fade">{children}</div>;
}

function Keyed({ el: Page }) { const { id } = useParams(); return <Page key={id} />; }


const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Styles = lazy(() => import('./pages/Styles.jsx'));
const Plan = lazy(() => import('./pages/Plan.jsx'));
const NewProject = lazy(() => import('./pages/NewProject.jsx'));
const Studio = lazy(() => import('./pages/Studio.jsx'));
const Render = lazy(() => import('./pages/Render.jsx'));
const Pricing = lazy(() => import('./pages/Pricing.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));

// After a new version is deployed, the old page's files are gone: reload once to get the new ones.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  try { if (sessionStorage.getItem('animora-reloaded') !== location.pathname) { sessionStorage.setItem('animora-reloaded', location.pathname); location.reload(); } } catch { location.reload(); }
});

// Never a blank white page: show what happened and a way out.
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error('[page error]', error); }
  render() {
    if (!this.state.error) return this.props.children;
    const stale = /dynamically imported module|Failed to fetch|Importing a module script failed|ChunkLoadError/i.test(String(this.state.error?.message));
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">{stale ? 'Animora was just updated' : 'Something went wrong on this page'}</h1>
        <p className="mt-3 text-ink-soft">{stale ? 'Reload to get the new version. Your answers are saved.' : 'Your work is saved. Reload the page to continue.'}</p>
        <button className="mt-6 rounded-[10px] bg-danfo px-5 py-3 font-semibold text-white" onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}

function Private({ children, roles }) {
  const { user, loading, serverError } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <div className="mx-auto max-w-lg px-4 py-24 text-center text-ink-soft">{serverError || "Can't reach the Animora server. Check your connection and refresh the page."}</div>;
  if (roles && !roles.includes(user.role)) return <Navigate to="/videos" replace />;
  return children;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-4xl font-extrabold">Page not found</h1>
      <p className="mt-3 text-ink-soft">This link may be old. Go back to your videos.</p>
      <a className="mt-6 inline-block font-semibold underline" href="/videos">My videos</a>
    </div>
  );
}

// old links (/dashboard?new=1) keep working
function DashboardRedirect() { return <Navigate to={`/videos${window.location.search}`} replace />; }

function App() {
  return (
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
      <AuthProvider>
        <Shell>
          <ExportScreen />
          <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <PageFade>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<Navigate to="/" replace />} />
              <Route path="/styles" element={<Private><Styles /></Private>} />
              <Route path="/videos" element={<Private><Dashboard key="video" kind="video" /></Private>} />
              <Route path="/flyers" element={<Private><Dashboard key="flyer" kind="flyer" /></Private>} />
              <Route path="/login" element={<Navigate to="/videos" replace />} />
              <Route path="/signup" element={<Navigate to="/videos" replace />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/dashboard" element={<DashboardRedirect />} />
              {/* each project gets a fresh page, so a flyer never shows the video's buttons (or the other way round) */}
              <Route path="/new/:kind" element={<Private><NewProject /></Private>} />
              <Route path="/p/:id/plan" element={<Private><Keyed el={Plan} /></Private>} />
              <Route path="/p/:id/studio" element={<Private><Keyed el={Studio} /></Private>} />
              <Route path="/p/:id/render" element={<Private><Keyed el={Render} /></Private>} />
              <Route path="/checkout" element={<Private><Checkout /></Private>} />
              <Route path="/creator" element={<Navigate to="/videos" replace />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </PageFade>
          </Suspense>
          </ErrorBoundary>
        <InstallPrompt />
        </Shell>
      </AuthProvider>
    </BrowserRouter>
    </MotionConfig>
  );
}

initTheme();
createRoot(document.getElementById('root')).render(<StrictMode><App /><Analytics /></StrictMode>);
