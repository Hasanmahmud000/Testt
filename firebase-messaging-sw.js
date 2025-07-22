// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCzWmJUAceuYGjzbVv0ceu7RU78fVs0OM4",
  authDomain: "criczone-b1c64.firebaseapp.com",
  projectId: "criczone-b1c64",
  storageBucket: "criczone-b1c64.firebasestorage.app",
  messagingSenderId: "508655160995",
  appId: "1:508655160995:web:813362e519ed6f79b07916"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'cricket-match',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'view',
        title: 'View Match',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-192.png'
      }
    ],
    data: {
      url: payload.data?.url || '/',
      matchId: payload.data?.matchId || null
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    // Open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If app is not open, open it
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data?.url || '/');
        }
      })
    );
  }
});

// Handle push events (for custom notifications)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    console.log('Push event received:', data);
    
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'cricket-notification',
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: data.data || {}
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Cache management for PWA
const CACHE_NAME = 'cricstreamzone-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.7.4/lottie.min.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
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
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
