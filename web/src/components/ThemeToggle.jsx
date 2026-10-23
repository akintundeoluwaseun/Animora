import { useEffect, useState } from 'react';

const KEY = 'animora-theme';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const currentTheme = () => (typeof document !== 'undefined' && document.documentElement.dataset.theme) || 'light';
export function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* private mode: it still works for this visit */ }
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'dark' ? '#0B0A12' : '#F7F6FD');
}
// first paint: the saved choice, otherwise the device's own light/dark setting
export function initTheme() {
  const saved = read();
  const t = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'dark' ? '#0B0A12' : '#F7F6FD');
}

export default function ThemeToggle({ className = '', onDark = false }) {
  const [t, setT] = useState(currentTheme());
  useEffect(() => { setT(currentTheme()); }, []);
  const next = t === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" onClick={() => { applyTheme(next); setT(next); }} aria-label={`Switch to ${next} mode`} title={`${next === 'dark' ? 'Dark' : 'Light'} mode`}
      className={`press grid size-10 shrink-0 place-items-center rounded-full border ${onDark ? 'border-white/15 text-white/80 hover:text-white' : 'border-ink/12 text-ink-soft hover:text-ink'} ${className}`}>
      {t === 'dark'
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
    </button>
  );
}
