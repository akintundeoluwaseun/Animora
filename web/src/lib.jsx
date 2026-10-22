import { publicMessage } from './lib/errors.js';
// Shared client helpers: API calls, auth context, formatting.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const TOKEN_KEY = 'adflash_token';
const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };

// No sign-in: this device's own secret key keeps its videos private. "Use on another device" shares it by link.
const DEVICE_KEY = 'animora-key';
const newKey = () => { const a = new Uint8Array(24); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
(() => {   // opened from a "use on another device" link: #k=<key>
  try {
    const m = location.hash.match(/^#k=([A-Za-z0-9_-]{24,128})$/);
    if (m) { localStorage.setItem(DEVICE_KEY, m[1]); history.replaceState(null, '', '/videos'); }
  } catch { /* storage blocked */ }
})();
let memKey = null;
export function deviceKey() {
  try { let k = localStorage.getItem(DEVICE_KEY); if (!k) { k = newKey(); localStorage.setItem(DEVICE_KEY, k); } return k; } catch { return memKey || (memKey = newKey()); }
}
export const otherDeviceLink = () => `${location.origin}/#k=${deviceKey()}`;

// The developer, shown in the menu and on the home page (help, custom videos, feedback).
export const DEVELOPER = {
  name: 'Oluwaseun Joshua.', handle: '@oluwaseun85148',
  website: 'https://oluwaseun-joshua-site.vercel.app', websiteLabel: 'oluwaseun-joshua-site.vercel.app',
  whatsapp: `https://wa.me/2348076911614?text=${encodeURIComponent("Hi, I'm messaging from Animora.")}`,
};

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { 'X-Animora-Key': deviceKey() };
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
  if (!res.ok) throw new ApiError(publicMessage(data.error), res.status, data);   // plain words only, never technical details
  return data;
}

// ---------------- auth ----------------
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState('');

  const refresh = useCallback(async () => {
    try { const { user: u } = await api('/auth/me'); setUser(u); setServerError(''); return u; }
    catch (e) { setUser(null); setServerError(e.status && e.status !== 401 ? e.message : ''); return null; }
    finally { setLoading(false); }
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

  return <AuthCtx.Provider value={{ user, setUser, loading, login, signup, logout, refresh, serverError }}>{children}</AuthCtx.Provider>;
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
  '4:5': { w: 1080, h: 1350, label: 'Instagram & Facebook post' },
  'A4': { w: 1240, h: 1754, label: 'Print (A4)' },
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

/**
 * Shrink a picture before upload: phone photos are often 4-10 MB, and the server (Vercel) accepts about 4.5 MB.
 * Keeps PNGs as PNG (logos keep their transparent background); other pictures become JPEG. Max side 1920 px.
 */
export async function shrinkImage(file, maxSide = 1920) {
  if (!file?.type?.startsWith('image/') || /svg|gif/.test(file.type) || file.size < 1.2e6) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * k); canvas.height = Math.round(bmp.height * k);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const png = file.type === 'image/png';
    let blob = await new Promise((r) => canvas.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.85));
    if (png && blob && blob.size > 3.5e6) blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'picture'}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}

/** How a picture looks: { alpha: has see-through pixels, light: its visible pixels are mostly light }. */
export async function imageLook(file) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 96 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let clear = 0, n = 0, lum = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) { clear++; continue; }
      n++; lum += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    }
    return { alpha: clear > d.length / 4 * 0.02, light: n ? lum / n > 0.72 : null };
  } catch { return {}; }
}
