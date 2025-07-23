const CACHE_NAME = 'cricstreamzone-v1.2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.7.4/lottie.min.js',
  'https://i.postimg.cc/3rPWWckN/icon-192.png'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Activate event
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
    })
  );
  self.clients.claim();
});

// Handle skip waiting message
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  
  // Handle notification requests
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { payload } = event.data;
    
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      tag: payload.tag,
      data: payload.data,
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'Watch Now',
          icon: '/icon-192.png'
        },
        {
          action: 'close',
          title: 'Close'
        }
      ]
    });
  }
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background sync for notifications
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
      // Process matches and send notifications if needed
      const matches = data.matches || [];
      const now = new Date();
      
      matches.forEach(match => {
        const matchTime = new Date(match.MatchTime);
        const timeDiff = matchTime - now;
        
        // Check for 15 minute notification
        if (timeDiff > 14 * 60 * 1000 && timeDiff <= 16 * 60 * 1000) {
          self.registration.showNotification('🏏 Match Starting Soon!', {
            body: `${match.Team1} vs ${match.Team2} starts in 15 minutes`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `match-15min-${match.Team1}-${match.Team2}`,
            requireInteraction: true,
            actions: [
              { action: 'view', title: 'Watch Now' },
              { action: 'close', title: 'Close' }
            ]
          });
        }
        
        // Check for 5 minute notification
        if (timeDiff > 4 * 60 * 1000 && timeDiff <= 6 * 60 * 1000) {
          self.registration.showNotification('⚡ Match Starting Very Soon!', {
            body: `${match.Team1} vs ${match.Team2} starts in 5 minutes! Get ready!`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `match-5min-${match.Team1}-${match.Team2}`,
            requireInteraction: true,
            actions: [
              { action: 'view', title: 'Watch Now' },
              { action: 'close', title: 'Close' }
            ]
          });
        }
        
        // Check for live notification
        if (timeDiff > -2 * 60 * 1000 && timeDiff <= 2 * 60 * 1000) {
          self.registration.showNotification('🔴 LIVE NOW!', {
            body: `${match.Team1} vs ${match.Team2} is now LIVE! Watch now!`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `match-live-${match.Team1}-${match.Team2}`,
            requireInteraction: true,
            actions: [
              { action: 'view', title: 'Watch Now' },
              { action: 'close', title: 'Close' }
            ]
          });
        }
      });
    })
    .catch(error => {
      console.error('Background sync error:', error);
    });
}

// Periodic background sync (every 5 minutes)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'match-check') {
    event.waitUntil(doBackgroundSync());
  }
});
