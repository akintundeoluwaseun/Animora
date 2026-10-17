// One video download at a time, shared by the whole app: it keeps going while you move between pages,
// shows a bar at the top, notifies you when it's done, and remembers if the page was closed mid-way.
import { useSyncExternalStore } from 'react';

const KEY = 'animora-export';
let state = { status: 'idle' };   // idle | working | done | failed | interrupted
const subs = new Set();
const set = (patch) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };
export const useExportJob = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);

const remember = (v) => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* private mode */ } };
// a download that was running when the page closed
try {
  const was = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (was?.projectId) state = { status: 'interrupted', projectId: was.projectId, title: was.title };
} catch { /* ignore */ }

export const fileName = (title) => `${String(title || 'animora-video').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').replace(/-{2,}/g, '-').slice(0, 60) || 'animora-video'}.mp4`;

let abort = null, wake = null, baseTitle = '';
const onLeave = (e) => { if (state.status === 'working') { e.preventDefault(); e.returnValue = ''; } };

async function notify(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) reg.showNotification(title, { body, icon: '/animora-icon.png', badge: '/favicon.png', tag: 'animora-export' });
    else new Notification(title, { body, icon: '/animora-icon.png', tag: 'animora-export' });
  } catch { /* notifications blocked */ }
}

export async function startExport({ project, quality }) {
  if (state.status === 'working') return;
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* ignore */ }
  abort = new AbortController();
  baseTitle = baseTitle || document.title;
  set({ status: 'working', projectId: project.id, title: project.title, progress: { stage: 'Getting ready', done: 0, total: 1 }, error: '', quality });
  remember({ projectId: project.id, title: project.title });
  window.addEventListener('beforeunload', onLeave);
  try { wake = await navigator.wakeLock?.request?.('screen'); } catch { wake = null; }   // keep the screen on while recording
  try {
    const { exportVideo, saveBlob } = await import('./exportVideo.js');
    const { prepareHtml } = await import('../components/Preview.jsx');
    const blob = await exportVideo({
      html: prepareHtml(project.code), aspect: project.aspectRatio || '9:16', fps: 30, quality, signal: abort.signal,
      onProgress: (p) => { set({ progress: p }); const pct = Math.round((p.done / Math.max(1, p.total)) * 100); document.title = `${pct}% · Making your video`; },
    });
    saveBlob(blob, fileName(project.title));
    set({ status: 'done', blob });
    notify('Your video is ready', `${fileName(project.title)} is in your downloads.`);
  } catch (e) {
    if (e?.name === 'AbortError') set({ status: 'idle' });
    else { set({ status: 'failed', error: e?.message || "Couldn't make the video." }); notify("Your video didn't finish", 'Open Animora and press Download MP4 to try again.'); }
  } finally {
    remember(null);
    window.removeEventListener('beforeunload', onLeave);
    try { await wake?.release?.(); } catch { /* ignore */ }
    wake = null;
    document.title = baseTitle || 'Animora';
  }
}

export function cancelExport() { abort?.abort(); }
export function dismissExport() { if (state.status !== 'working') { remember(null); set({ status: 'idle', blob: null, error: '' }); } }
export async function saveAgain() { if (state.blob) { const { saveBlob } = await import('./exportVideo.js'); saveBlob(state.blob, fileName(state.title)); } }
