// Turn on phone notifications (Web Push) for this device. Asked once, the first time you make a video.
import { api } from '../lib.jsx';

const b64ToBytes = (b64) => { const pad = '='.repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };

export async function enablePush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'default' && (await Notification.requestPermission()) !== 'granted') return false;
    const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { key } = await api('/push/key');
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    }
    await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
    return true;
  } catch (e) {
    console.warn('[push]', e?.message);
    return false;
  }
}

/** A notification shown by the app itself (progress of a download). Same tag = it updates in place. */
export async function showLocal(title, body, { tag = 'animora-export', silent = true, url = '/videos' } = {}) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) await reg.showNotification(title, { body, icon: '/icon-192.png', badge: '/favicon.png', tag, silent, renotify: !silent, data: { url } });
  } catch { /* blocked */ }
}
