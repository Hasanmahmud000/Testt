// 🔔 CricStreamZone Service Worker - Push Notifications & Caching
const CACHE_NAME = 'cricstreamzone-v1.2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.7.4/lottie.min.js',
  'https://i.postimg.cc/3rPWWckN/icon-192.png'
];

// Install Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        self.skipWaiting();
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
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
      self.clients.claim();
    })
  );
});

// Fetch Event - Cache Strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Skip Waiting Message
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// 🔔 NOTIFICATION SYSTEM - Background Processing
let matches = [];
let notificationSettings = {
  enabled: false,
  notify15min: true,
  notify5min: true,
  notifyStart: true,
  notifyEnd: true
};
let sentNotifications = new Set();

// API URL
const matchesApi = "https://script.google.com/macros/s/AKfycbxZfHUGsH19x3hZp5eeo3tEMJuQxvOPHpyS_LAqow4rlBciyrhP0NdaI2NzeZiyA5SF9A/exec";

// Load settings from IndexedDB
async function loadSettings() {
  try {
    const settings = await getFromIndexedDB('notificationSettings');
    if (settings) {
      notificationSettings = { ...notificationSettings, ...settings };
    }
    
    const notifications = await getFromIndexedDB('sentNotifications');
    if (notifications) {
      sentNotifications = new Set(notifications);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings to IndexedDB
async function saveSettings() {
  try {
    await saveToIndexedDB('notificationSettings', notificationSettings);
    await saveToIndexedDB('sentNotifications', Array.from(sentNotifications));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// IndexedDB Helper Functions
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CricStreamZoneDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

async function saveToIndexedDB(key, value) {
  const db = await openDB();
  const transaction = db.transaction(['settings'], 'readwrite');
  const store = transaction.objectStore('settings');
  await store.put({ key, value });
}

async function getFromIndexedDB(key) {
  const db = await openDB();
  const transaction = db.transaction(['settings'], 'readonly');
  const store = transaction.objectStore('settings');
  const result = await store.get(key);
  return result ? result.value : null;
}

// Fetch matches data
async function fetchMatches() {
  try {
    const response = await fetch(matchesApi);
    const data = await response.json();
    matches = data.matches || [];
    console.log('Matches updated:', matches.length);
  } catch (error) {
    console.error('Error fetching matches:', error);
  }
}

// Get match status
function getMatchStatus(matchTime, matchDuration, now) {
  const startTime = new Date(matchTime);
  const endTime = new Date(startTime.getTime() + (matchDuration * 60 * 1000));
  const oneHourBefore = new Date(startTime.getTime() - 60 * 60 * 1000);
  
  if (now >= endTime) {
    return 'finished';
  } else if (now >= startTime) {
    return 'live';
  } else if (now >= oneHourBefore) {
    return 'coming_soon';
  } else {
    return 'upcoming';
  }
}

// Show notification
function showNotification(title, body, data = {}) {
  const options = {
    body: body,
    icon: 'https://i.postimg.cc/3rPWWckN/icon-192.png',
    badge: 'https://i.postimg.cc/3rPWWckN/icon-192.png',
    tag: data.tag || `cricstream-${Date.now()}`,
    data: data,
    requireInteraction: true,
    silent: false,
    actions: [
      {
        action: 'view',
        title: '👀 View Match',
        icon: 'https://i.postimg.cc/3rPWWckN/icon-192.png'
      },
      {
        action: 'dismiss',
        title: '✕ Dismiss',
        icon: 'https://i.postimg.cc/3rPWWckN/icon-192.png'
      }
    ]
  };
  
  return self.registration.showNotification(title, options);
}

// Check and send notifications
async function checkNotifications() {
  if (!notificationSettings.enabled || !matches.length) return;
  
  const now = new Date();
  console.log('Checking notifications at:', now.toISOString());
  
  for (const match of matches) {
    const matchTime = new Date(match.MatchTime);
    const duration = parseInt(match.MatchDuration) || 360;
    const endTime = new Date(matchTime.getTime() + (duration * 60 * 1000));
    const matchId = match.Match.replace(/\s+/g, '-').toLowerCase();
    
    // 15 minutes before
    const time15min = new Date(matchTime.getTime() - 15 * 60 * 1000);
    if (notificationSettings.notify15min && 
        now >= time15min && 
        now < matchTime && 
        !sentNotifications.has(`${matchId}-15min`)) {
      
      await showNotification(
        '🏏 Match Starting Soon!',
        `${match.Team1} vs ${match.Team2} starts in 15 minutes`,
        {
          tag: `${matchId}-15min`,
          matchId: matchId,
          type: '15min'
        }
      );
      
      sentNotifications.add(`${matchId}-15min`);
      console.log('Sent 15min notification for:', match.Match);
    }
    
    // 5 minutes before
    const time5min = new Date(matchTime.getTime() - 5 * 60 * 1000);
    if (notificationSettings.notify5min && 
        now >= time5min && 
        now < matchTime && 
        !sentNotifications.has(`${matchId}-5min`)) {
      
      await showNotification(
        '⏰ Match Starting Very Soon!',
        `${match.Team1} vs ${match.Team2} starts in 5 minutes`,
        {
          tag: `${matchId}-5min`,
          matchId: matchId,
          type: '5min'
        }
      );
      
      sentNotifications.add(`${matchId}-5min`);
      console.log('Sent 5min notification for:', match.Match);
    }
    
    // Match started
    if (notificationSettings.notifyStart && 
        now >= matchTime && 
        now < new Date(matchTime.getTime() + 10 * 60 * 1000) && 
        !sentNotifications.has(`${matchId}-start`)) {
      
      await showNotification(
        '🔴 LIVE NOW!',
        `${match.Team1} vs ${match.Team2} is now LIVE!`,
        {
          tag: `${matchId}-start`,
          matchId: matchId,
          type: 'start'
        }
      );
      
      sentNotifications.add(`${matchId}-start`);
      console.log('Sent start notification for:', match.Match);
    }
    
    // Match ended
    if (notificationSettings.notifyEnd && 
        now >= endTime && 
        now < new Date(endTime.getTime() + 30 * 60 * 1000) && 
        !sentNotifications.has(`${matchId}-end`)) {
      
      await showNotification(
        '🏁 Match Ended',
        `${match.Team1} vs ${match.Team2} has finished`,
        {
          tag: `${matchId}-end`,
          matchId: matchId,
          type: 'end'
        }
      );
      
      sentNotifications.add(`${matchId}-end`);
      console.log('Sent end notification for:', match.Match);
    }
  }
  
  // Clean old notifications (older than 24 hours)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  matches.forEach(match => {
    const matchTime = new Date(match.MatchTime);
    if (matchTime < oneDayAgo) {
      const matchId = match.Match.replace(/\s+/g, '-').toLowerCase();
      sentNotifications.delete(`${matchId}-15min`);
      sentNotifications.delete(`${matchId}-5min`);
      sentNotifications.delete(`${matchId}-start`);
      sentNotifications.delete(`${matchId}-end`);
    }
  });
  
  await saveSettings();
}

// Handle notification click
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event.notification.data);
  
  event.notification.close();
  
  if (event.action === 'view' || event.action === '') {
    // Open the app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('Notification closed:', event.notification.data);
});

// Message handling from main app
self.addEventListener('message', event => {
  const { action, data } = event.data;
  
  switch (action) {
    case 'updateSettings':
      notificationSettings = { ...notificationSettings, ...data };
      saveSettings();
      console.log('Settings updated:', notificationSettings);
      break;
      
    case 'skipWaiting':
      self.skipWaiting();
      break;
      
    case 'checkNotifications':
      checkNotifications();
      break;
  }
});

// Background sync for notifications
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      Promise.all([
        fetchMatches(),
        checkNotifications()
      ])
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'match-notifications') {
    event.waitUntil(
      Promise.all([
        fetchMatches(),
        checkNotifications()
      ])
    );
  }
});

// Initialize on service worker start
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      loadSettings(),
      fetchMatches()
    ]).then(() => {
      console.log('Service Worker initialized with notification system');
      
      // Set up periodic checks every minute
      setInterval(async () => {
        await fetchMatches();
        await checkNotifications();
      }, 60000);
      
      // Initial check
      checkNotifications();
    })
  );
});

// Handle push events (for future server-side notifications)
self.addEventListener('push', event => {
  console.log('Push event received:', event);
  
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      showNotification(data.title, data.body, data.data)
    );
  }
});

// Background fetch (for offline support)
self.addEventListener('backgroundfetch', event => {
  console.log('Background fetch:', event);
});

// Error handling
self.addEventListener('error', event => {
  console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('Service Worker unhandled rejection:', event.reason);
});

console.log('🔔 CricStreamZone Service Worker loaded with notification system');
