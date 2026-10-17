// Shared client helpers: API calls, auth context, formatting.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const TOKEN_KEY = 'adflash_token';
const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined) });
  } catch {
    throw new ApiError('Cannot reach Animora. Check your internet connection.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { setToken(null); window.dispatchEvent(new Event('adflash:logout')); }
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  return data;
}

// ---------------- auth ----------------
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { const { user: u } = await api('/auth/me'); setUser(u); return u; } catch { setUser(null); return null; } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const onLogout = () => setUser(null);
    window.addEventListener('adflash:logout', onLogout);
    return () => window.removeEventListener('adflash:logout', onLogout);
  }, [refresh]);

  const login = async (email, password) => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(r.token); setUser(r.user); return r.user;
  };
  const signup = async (fields) => {
    const r = await api('/auth/signup', { method: 'POST', body: fields });
    setToken(r.token); setUser(r.user); return r.user;
  };
  const logout = () => { setToken(null); setUser(null); };

  return <AuthCtx.Provider value={{ user, setUser, loading, login, signup, logout, refresh }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

// ---------------- formatting ----------------
export const naira = (n, dp = 0) => `₦${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const nairaExact = (n) => naira(n, Number(n) % 1 ? 2 : 0);

export function duration(s) {
  s = Math.round(Number(s) || 0);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`;
}

export function clock(s) {
  s = Math.max(0, Number(s) || 0);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export function ago(date) {
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

export const ASPECTS = {
  '9:16': { w: 1080, h: 1920, label: 'WhatsApp Status · TikTok' },
  '1:1': { w: 1080, h: 1080, label: 'Instagram feed' },
  '16:9': { w: 1920, h: 1080, label: 'YouTube' },
};

export function usePolling(fn, ms, active) {
  useEffect(() => {
    if (!active) return undefined;
    let stop = false;
    const tick = async () => { if (stop) return; await fn(); if (!stop) setTimeout(tick, ms); };
    tick();
    return () => { stop = true; };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
}
