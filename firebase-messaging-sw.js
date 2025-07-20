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
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'cricstreamzone-match',
    requireInteraction: true,
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
  
  if (event.action === 'open' || !event.action) {
    // Open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if app is not open
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data?.url || '/');
        }
      })
    );
  }
});

// Background sync for match notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(checkMatchUpdates());
  }
});

// Check for match updates in background
async function checkMatchUpdates() {
  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycbxZfHUGsH19x3hZp5eeo3tEMJuQxvOPHpyS_LAqow4rlBciyrhP0NdaI2NzeZiyA5SF9A/exec');
    const data = await response.json();
    const matches = data.matches || [];
    
    const now = new Date();
    
    matches.forEach(match => {
      const matchTime = new Date(match.MatchTime);
      const duration = parseInt(match.MatchDuration) || 360;
      const endTime = new Date(matchTime.getTime() + duration * 60 * 1000);
      
      // Check for notifications to send
      const timeDiff = matchTime.getTime() - now.getTime();
      const minutesDiff = Math.floor(timeDiff / (1000 * 60));
      
      // 15 minutes before
      if (minutesDiff === 15) {
        sendMatchNotification(
          '🏏 Match Starting Soon!',
          `${match.Team1} vs ${match.Team2} starts in 15 minutes`,
          match.Team1Logo,
          match
        );
      }
      
      // 5 minutes before
      if (minutesDiff === 5) {
        sendMatchNotification(
          '⚡ Match Starting Very Soon!',
          `${match.Team1} vs ${match.Team2} starts in 5 minutes`,
          match.Team1Logo,
          match
        );
      }
      
      // Match started
      if (now >= matchTime && now <= new Date(matchTime.getTime() + 5 * 60 * 1000)) {
        sendMatchNotification(
          '🔴 LIVE NOW!',
          `${match.Team1} vs ${match.Team2} has started!`,
          match.Team1Logo,
          match
        );
      }
      
      // Match ended
      if (now >= endTime && now <= new Date(endTime.getTime() + 5 * 60 * 1000)) {
        sendMatchNotification(
          '🏁 Match Finished',
          `${match.Team1} vs ${match.Team2} has ended`,
          match.Team1Logo,
          match
        );
      }
    });
    
  } catch (error) {
    console.error('Error checking match updates:', error);
  }
}

// Send match notification
function sendMatchNotification(title, body, icon, match) {
  const notificationOptions = {
    body: body,
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: `match-${match.Team1}-${match.Team2}`,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'open',
        title: 'Watch Now',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-192.png'
      }
    ],
    data: {
      url: '/',
      matchId: match.Team1 + '-vs-' + match.Team2,
      matchTime: match.MatchTime
    }
  };

  return self.registration.showNotification(title, notificationOptions);
}

// Periodic background sync (every 5 minutes)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_SYNC') {
    // Schedule periodic sync
    setInterval(() => {
      checkMatchUpdates();
    }, 5 * 60 * 1000); // Every 5 minutes
  }
});

// Cache management for offline functionality
const CACHE_NAME = 'cricstreamzone-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});
