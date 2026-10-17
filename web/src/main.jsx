import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles.css';
import { AuthProvider, useAuth } from './lib.jsx';
import { Nav, PageLoader } from './components/ui.jsx';
import Home from './pages/Home.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Styles = lazy(() => import('./pages/Styles.jsx'));
const Plan = lazy(() => import('./pages/Plan.jsx'));
const Studio = lazy(() => import('./pages/Studio.jsx'));
const Render = lazy(() => import('./pages/Render.jsx'));
const Pricing = lazy(() => import('./pages/Pricing.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));

function Private({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <div className="mx-auto max-w-lg px-4 py-24 text-center text-ink-soft">Can't reach the Animora server. Is it running (npm start)?</div>;
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
    <BrowserRouter>
      <AuthProvider>
        <div className="app">
        <Nav />
        <main className="app-main">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<Navigate to="/" replace />} />
              <Route path="/styles" element={<Private><Styles /></Private>} />
              <Route path="/videos" element={<Private><Dashboard /></Private>} />
              <Route path="/login" element={<Navigate to="/videos" replace />} />
              <Route path="/signup" element={<Navigate to="/videos" replace />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/dashboard" element={<DashboardRedirect />} />
              <Route path="/p/:id/plan" element={<Private><Plan /></Private>} />
              <Route path="/p/:id/studio" element={<Private><Studio /></Private>} />
              <Route path="/p/:id/render" element={<Private><Render /></Private>} />
              <Route path="/checkout" element={<Private><Checkout /></Private>} />
              <Route path="/creator" element={<Navigate to="/videos" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
