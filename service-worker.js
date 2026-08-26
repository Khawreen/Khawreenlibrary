// Self-destroying service worker to clear stale client cache
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => caches.delete(key)));
    }).then(() => {
      return self.clients.matchAll({ type: 'window' });
    }).then(clients => {
      for (const client of clients) {
        client.navigate(client.url);
      }
      return self.registration.unregister();
    })
  );
});

self.addEventListener('fetch', event => {
  // Pass through all requests directly to network
  return;
});
