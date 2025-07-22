// 🔔 CricStreamZone Service Worker - Working Notification System
const CACHE_NAME = 'cricstreamzone-v2.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.7.4/lottie.min.js',
  'https://i.postimg.cc/3rPWWckN/icon-192.png'
];

// Install Service Worker
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cache opened');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        self.skipWaiting();
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activated');
      self.clients.claim();
      
      // Initialize notification system
      initializeNotificationSystem();
    })
  );
});

// Fetch Event - Cache Strategy
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

// 🔔 NOTIFICATION SYSTEM VARIABLES
let matches = [];
let notificationSettings = {
  enabled: false,
  notify15min: true,
  notify5min: true,
  notifyStart: true,
  notifyEnd: true
};
let sentNotifications = new Set();
let notificationInterval = null;

const matchesApi = "https://script.google.com/macros/s/AKfycbxZfHUGsH19x3hZp5eeo3tEMJuQxvOPHpyS_LAqow4rlBciyrhP0NdaI2NzeZiyA5SF9A/exec";

// Initialize notification system
function initializeNotificationSystem() {
  console.log('🔔 Initializing notification system...');
  
  // Load settings from clients
  loadNotificationSettings();
  
  // Start periodic checks
  startNotificationChecker();
  
  // Fetch initial matches
  fetchMatches();
}

// Load notification settings
async function loadNotificationSettings() {
  try {
    // Try to get settings from main app
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      clients[0].postMessage({ action: 'getSettings' });
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Fetch matches data
async function fetchMatches() {
  try {
    console.log('📊 Fetching matches...');
    const response = await fetch(matchesApi);
    const data = await response.json();
    matches = data.matches || [];
    console.log(`✅ Fetched ${matches.length} matches`);
  } catch (error) {
    console.error('❌ Error fetching matches:', error);
  }
}

// Get match status
function getMatchStatus(matchTime, matchDuration, now) {
  const startTime = new Date(matchTime);
  const endTime = new Date(startTime.getTime() + (matchDuration * 60 * 1000));
  
  if (now >= endTime) {
    return 'finished';
  } else if (now >= startTime) {
    return 'live';
  } else {
    return 'upcoming';
  }
}

// Show notification
async function showNotification(title, body, options = {}) {
  const defaultOptions = {
    icon: 'https://i.postimg.cc/3rPWWckN/icon-192.png',
    badge: 'https://i.postimg.cc/3rPWWckN/icon-192.png',
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
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
    ],
    ...options
  };

  try {
    await self.registration.showNotification(title, {
      body: body,
      ...defaultOptions
    });
    console.log('✅ Notification shown:', title);
  } catch (error) {
    console.error('❌ Error showing notification:', error);
  }
}

// Check and send notifications
async function checkNotifications() {
  if (!notificationSettings.enabled || !matches.length) {
    return;
  }

  const now = new Date();
  console.log(`🔍 Checking notifications at ${now.toLocaleTimeString()}`);

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
        `${match.Team1} vs ${match.Team2} starts in 15 minutes\n🕐 ${matchTime.toLocaleTimeString()}`,
        {
          tag: `${matchId}-15min`,
          data: { matchId, type: '15min', match }
        }
      );
      
      sentNotifications.add(`${matchId}-15min`);
      console.log(`✅ Sent 15min notification: ${match.Match}`);
    }

    // 5 minutes before
    const time5min = new Date(matchTime.getTime() - 5 * 60 * 1000);
    if (notificationSettings.notify5min && 
        now >= time5min && 
        now < matchTime && 
        !sentNotifications.has(`${matchId}-5min`)) {
      
      await showNotification(
        '⏰ Match Starting Very Soon!',
        `${match.Team1} vs ${match.Team2} starts in 5 minutes\n🚨 Get ready to watch!`,
        {
          tag: `${matchId}-5min`,
          data: { matchId, type: '5min', match },
          vibrate: [500, 200, 500, 200, 500]
        }
      );
      
      sentNotifications.add(`${matchId}-5min`);
      console.log(`✅ Sent 5min notification: ${match.Match}`);
    }

    // Match started
    if (notificationSettings.notifyStart && 
        now >= matchTime && 
        now < new Date(matchTime.getTime() + 10 * 60 * 1000) && 
        !sentNotifications.has(`${matchId}-start`)) {
      
      await showNotification(
        '🔴 LIVE NOW!',
        `${match.Team1} vs ${match.Team2} is now LIVE!\n⚡ Don't miss the action!`,
        {
          tag: `${matchId}-start`,
          data: { matchId, type: 'start', match },
          vibrate: [1000, 300, 1000]
        }
      );
      
      sentNotifications.add(`${matchId}-start`);
      console.log(`✅ Sent start notification: ${match.Match}`);
    }

    // Match ended
    if (notificationSettings.notifyEnd && 
        now >= endTime && 
        now < new Date(endTime.getTime() + 30 * 60 * 1000) && 
        !sentNotifications.has(`${matchId}-end`)) {
      
      await showNotification(
        '🏁 Match Finished',
        `${match.Team1} vs ${match.Team2} has ended\n📊 Check the final scores!`,
        {
          tag: `${matchId}-end`,
          data: { matchId, type: 'end', match },
          requireInteraction: false
        }
      );
      
      sentNotifications.add(`${matchId}-end`);
      console.log(`✅ Sent end notification: ${match.Match}`);
    }
  }

  // Cleanup old notifications
  cleanupOldNotifications(now);
}

// Cleanup old notifications
function cleanupOldNotifications(now) {
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let cleaned = 0;

  matches.forEach(match => {
    const matchTime = new Date(match.MatchTime);
    if (matchTime < oneDayAgo) {
      const matchId = match.Match.replace(/\s+/g, '-').toLowerCase();
      ['15min', '5min', 'start', 'end'].forEach(type => {
        const notifId = `${matchId}-${type}`;
        if (sentNotifications.has(notifId)) {
          sentNotifications.delete(notifId);
          cleaned++;
        }
      });
    }
  });

  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} old notifications`);
  }
}

// Start notification checker
function startNotificationChecker() {
  // Clear existing interval
  if (notificationInterval) {
    clearInterval(notificationInterval);
  }

  // Check every minute
  notificationInterval = setInterval(async () => {
    await fetchMatches();
    await checkNotifications();
  }, 60000);

  console.log('⏰ Notification checker started');
}

// Handle notification click
self.addEventListener('notificationclick', event => {
  console.log('🖱️ Notification clicked:', event.notification.data);
  
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
  console.log('❌ Notification closed:', event.notification.data);
});

// Message handling from main app
self.addEventListener('message', event => {
  const { action, data } = event.data || {};
  
  console.log('📨 Message received:', action, data);
  
  switch (action) {
    case 'updateSettings':
      notificationSettings = { ...notificationSettings, ...data };
      console.log('🔧 Settings updated:', notificationSettings);
      break;
      
    case 'getSettings':
      // Send current settings back to client
      event.ports[0]?.postMessage({
        action: 'settingsResponse',
        data: notificationSettings
      });
      break;
      
    case 'skipWaiting':
      self.skipWaiting();
      break;
      
    case 'checkNotifications':
      checkNotifications();
      break;
      
    case 'testNotification':
      showNotification(
        '🧪 Test Notification',
        'CricStreamZone notifications are working perfectly! 🎉',
        {
          tag: 'test-notification',
          requireInteraction: false
        }
      );
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

// Handle push events (for future server-side notifications)
self.addEventListener('push', event => {
  console.log('📬 Push event received:', event);
  
  if (event.data) {
    try {
      const data = event.data.json();
      event.waitUntil(
        showNotification(data.title, data.body, data.options)
      );
    } catch (error) {
      console.error('Error handling push event:', error);
    }
  }
});

// Error handling
self.addEventListener('error', event => {
  console.error('❌ Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('❌ Service Worker unhandled rejection:', event.reason);
});

// Skip waiting message
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

console.log('🔔 CricStreamZone Service Worker loaded with notification system');
