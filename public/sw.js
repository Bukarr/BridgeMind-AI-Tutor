const CACHE_NAME = 'bridgemind-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://img.icons8.com/isometric/512/brain.png'
];

self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  // Bypass service worker for API calls to avoid intercepting POST/streaming responses
  try {
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(fetch(event.request));
      return;
    }
  } catch (e) {
    // If URL parsing fails, fall through to default handling
  }

  event.respondWith((async () => {
    try {
      const networkResponse = await fetch(event.request);
      if (!networkResponse) throw new Error('No network response');
      return networkResponse;
    } catch (err) {
      console.error('Service Worker fetch error:', err);
      const accept = event.request.headers.get('accept') || '';
      if (accept.includes('application/json')) {
        return new Response(JSON.stringify({ error: 'Network error or offline' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (event.request.mode === 'navigate') {
        return new Response('<h1>Offline</h1><p>Network error</p>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' }
        });
      }
      return new Response('Network error', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  })());
});
