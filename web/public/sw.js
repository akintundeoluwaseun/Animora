// Animora service worker: makes the site installable as an app and shows notifications,
// including "your video is ready" pushes that arrive while Animora and the browser are closed.
// Pages and the API always come from the network (so you never see an old version).
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', () => { /* network as usual */ });

self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { title: 'Animora', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(m.title || 'Animora', {
    body: m.body || '', icon: '/icon-192.png', badge: '/favicon.png', tag: m.tag || 'animora', renotify: true,
    data: { url: m.url || '/videos' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/videos';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => 'focus' in c);
    if (open) { open.focus(); if ('navigate' in open) return open.navigate(url).catch(() => {}); return undefined; }
    return self.clients.openWindow(url);
  }));
});
