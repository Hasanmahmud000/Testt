const CACHE_NAME = 'cricstreamzone-v2.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.7.4/lottie.min.js',
  'https://i.postimg.cc/3rPWWckN/icon-192.png'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker installed successfully');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Handle skip waiting message
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Background sync for notifications (if supported)
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // This will run in background to check for match updates
  return fetch('https://script.google.com/macros/s/AKfycbxZfHUGsH19x3hZp5eeo3tEMJuQxvOPHpyS_LAqow4rlBciyrhP0NdaI2NzeZiyA5SF9A/exec')
    .then(response => response.json())
    .then(data => {
      // Process match data and send notifications if needed
      console.log('Background sync completed');
    })
    .catch(error => {
      console.log('Background sync failed:', error);
    });
}

// Push notification event (for future server-side notifications)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New cricket match update!',
    icon: 'https://i.postimg.cc/3rPWWckN/icon-192.png',
    badge: 'https://i.postimg.cc/3rPWWckN/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Match',
        icon: 'https://i.postimg.cc/3rPWWckN/icon-192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: 'https://i.postimg.cc/3rPWWckN/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('CricStreamZone', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close the notification
    event.notification.close();
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
