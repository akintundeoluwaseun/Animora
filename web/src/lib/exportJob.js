// One video download at a time, shared by the whole app: it keeps going while you move between pages,
// shows a full progress screen, notifies you when it's done, and remembers if the page was closed mid-way.
import { useSyncExternalStore } from 'react';
import { enablePush, showLocal } from './notify.js';

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

let abort = null, wake = null, baseTitle = '', lastArgs = null;
const onLeave = (e) => { if (state.status === 'working') { e.preventDefault(); e.returnValue = ''; } };

const notify = (title, body, url) => showLocal(title, body, { silent: false, url });
let lastShown = -1;

export async function startExport({ project, quality }) {
  if (state.status === 'working') return;
  lastArgs = { project, quality };
  enablePush();   // asks once for notifications on this device
  lastShown = -1;
  abort = new AbortController();
  baseTitle = baseTitle || document.title;
  set({ status: 'working', minimized: false, projectId: project.id, title: project.title, thumb: project.thumbnailUrl || null, progress: { stage: 'Getting ready', done: 0, total: 1 }, error: '', quality });
  remember({ projectId: project.id, title: project.title });
  window.addEventListener('beforeunload', onLeave);
  try { wake = await navigator.wakeLock?.request?.('screen'); } catch { wake = null; }   // keep the screen on while recording
  try {
    const { exportVideo, saveBlob } = await import('./exportVideo.js');
    const { prepareHtml } = await import('../components/Preview.jsx');
    const blob = await exportVideo({
      html: prepareHtml(project.code), aspect: project.aspectRatio || '9:16', fps: quality === 'fast' ? 24 : 30, quality, signal: abort.signal,
      onProgress: (p) => {
        set({ progress: p });
        const pct = Math.round((p.done / Math.max(1, p.total)) * 100);
        const bar = `${'▰'.repeat(Math.round(pct / 10))}${'▱'.repeat(10 - Math.round(pct / 10))}`;
        const url = `/p/${project.id}/studio`;
        if (p.stage === 'Paused') {
          document.title = `Paused ${pct}% · Animora`;
          showLocal(`Paused · ${project.title} · ${pct}%`, `${bar}  Open Animora to continue. Phones stop making videos while the app is in the background.`, { url, silent: false });
          lastShown = pct - 5;
          return;
        }
        document.title = `${pct}% · Making your video`;
        // a notification that updates every 5% (visible when you pull down the notifications)
        if (p.stage === 'Recording' && pct >= lastShown + 5) { lastShown = pct; showLocal(`Making ${project.title} · ${pct}%`, `${bar}${p.eta != null ? `  about ${p.eta >= 60 ? `${Math.round(p.eta / 60)} min` : `${Math.max(1, p.eta)} s`} left` : ''}`, { url }); }
      },
    });
    saveBlob(blob, fileName(project.title));
    set({ status: 'done', blob });
    notify('Download done', `${fileName(project.title)} is in your downloads.`, `/p/${project.id}/studio`);
  } catch (e) {
    if (e?.name === 'AbortError') { set({ status: 'idle' }); showLocal('Download cancelled', project.title, { url: `/p/${project.id}/studio` }); }
    else { set({ status: 'failed', error: e?.message || "Couldn't make the video." }); notify("Your video didn't finish", `${e?.message || "Couldn't make the video."} Tap to try again.`, `/p/${project.id}/studio`); }
  } finally {
    remember(null);
    window.removeEventListener('beforeunload', onLeave);
    try { await wake?.release?.(); } catch { /* ignore */ }
    wake = null;
    document.title = baseTitle || 'Animora';
  }
}

export function cancelExport() { abort?.abort(); }
export function minimizeExport(v = true) { set({ minimized: v }); }
export function retryExport() { if (lastArgs && state.status !== 'working') { dismissExport(); startExport(lastArgs); } }
export const canRetry = () => !!lastArgs;
export function dismissExport() { if (state.status !== 'working') { remember(null); set({ status: 'idle', blob: null, error: '' }); } }
export async function saveAgain() { if (state.blob) { const { saveBlob } = await import('./exportVideo.js'); saveBlob(state.blob, fileName(state.title)); } }
