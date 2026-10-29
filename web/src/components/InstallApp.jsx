// "Install Animora": Android/desktop Chrome get the browser's own install dialog; iPhone gets the two taps to do.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

let deferred = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; window.dispatchEvent(new Event('animora:installable')); });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
const installed = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
// asked only from the second visit on, and never while someone is making a video (it covered the main buttons)
const visits = (() => { try { const n = Number(localStorage.getItem('animora-visits') || 0) + 1; localStorage.setItem('animora-visits', String(n)); return n; } catch { return 1; } })();
const dismissed = () => { try { return Number(localStorage.getItem('animora-install-dismissed') || 0) > Date.now(); } catch { return false; } };

export function useInstall() {
  const [can, setCan] = useState(!!deferred);
  useEffect(() => { const f = () => setCan(true); window.addEventListener('animora:installable', f); return () => window.removeEventListener('animora:installable', f); }, []);
  const install = async () => { if (!deferred) return false; deferred.prompt(); const r = await deferred.userChoice.catch(() => null); deferred = null; setCan(false); return r?.outcome === 'accepted'; };
  return { can: can && !installed(), ios: isIos() && !installed(), install };
}

/** A small card offering the app: from the second visit, in the library and on the home page only, until installed or dismissed (for 2 weeks). */
export default function InstallPrompt() {
  const { can, ios, install } = useInstall();
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(dismissed());
  const [help, setHelp] = useState(false);
  const calm = pathname === '/' || pathname === '/videos' || pathname === '/flyers';
  if (hidden || (!can && !ios) || visits < 2 || !calm) return null;
  const docked = pathname !== '/';   // the library has the floating menu at the bottom: sit just above it
  const close = () => { try { localStorage.setItem('animora-install-dismissed', String(Date.now() + 14 * 864e5)); } catch { /* ignore */ } setHidden(true); };
  return (
    <div className={`install-card fixed inset-x-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-[#0B0A12] px-3 py-2.5 text-white shadow-2xl lg:bottom-5 lg:left-auto lg:right-5 lg:mx-0 ${docked ? 'bottom-[calc(96px+env(safe-area-inset-bottom))]' : 'bottom-3'}`}>
      <img src="/icon-192.png" alt="" className="size-9 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Install Animora</p>
        <p className="text-white/60">{help ? 'Tap the Share button, then “Add to Home Screen”.' : 'Open it from your home screen like an app.'}</p>
      </div>
      {can ? <button className="rounded-[10px] bg-danfo px-3.5 py-2 text-sm font-semibold" onClick={async () => { if (await install()) setHidden(true); }}>Install</button>
        : !help && <button className="rounded-[10px] bg-danfo px-3.5 py-2 text-sm font-semibold" onClick={() => setHelp(true)}>How</button>}
      <button className="px-1 text-white/50 hover:text-white" onClick={close} aria-label="Not now">✕</button>
    </div>
  );
}
