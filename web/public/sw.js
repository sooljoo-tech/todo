/* 서비스 워커: 푸시 알림 수신 + 알림 클릭 시 앱 열기 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || '오늘 할 일';
  const options = {
    body: data.body || '',
    icon: '/todo/icons/icon-192.png',
    badge: '/todo/icons/icon-192.png',
    tag: data.tag || 'daily',
    renotify: true,
    data: { url: data.url || '/todo/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/todo/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes('/todo/') && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
