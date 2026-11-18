/**
 * ZÉNITH — Service Worker para Web Push.
 * Solo recibe el aviso del servidor y lo muestra, aunque la app esté cerrada.
 */
self.addEventListener('push', (event) => {
  let data = { title: 'ZÉNITH', body: 'Tienes una actualización.' };
  try { if (event.data) data = event.data.json(); } catch { /* texto plano, se usa el default */ }

  event.waitUntil(
    self.registration.showNotification(data.title || 'ZÉNITH', {
      body: data.body || '',
      icon: '/zenith-eagle-marker.svg',
      badge: '/zenith-eagle-marker.svg',
      data: data.data || {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('/');
    })
  );
});
