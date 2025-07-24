// sw.js - Updated Service Worker with OneSignal Support

const CACHE_NAME = 'cricstreamzone-v1.2';
const urlsToCache = [
  '/',
  '/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.7.4/lottie.min.js',
  'https://cdn.onesignal.com/sdks/OneSignalSDK.js',
  'https://i.postimg.cc/3rPWWckN/icon-192.png'
];

// Install event
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Activate event
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Background sync for notifications
self.addEventListener('sync', function(event) {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Perform background sync operations
      fetch('/api/sync-data')
        .then(response => response.json())
        .then(data => {
          console.log('Background sync completed:', data);
        })
        .catch(error => {
          console.error('Background sync failed:', error);
        })
    );
  }
});

// Handle push notifications (OneSignal will handle most of this)
self.addEventListener('push', function(event) {
  console.log('Push notification received:', event);
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: data.data,
      actions: [
        {
          action: 'open',
          title: 'Open App',
          icon: '/icon-192.png'
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/icon-192.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle messages from main thread
self.addEventListener('message', function(event) {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

console.log('Service Worker loaded with OneSignal support');
