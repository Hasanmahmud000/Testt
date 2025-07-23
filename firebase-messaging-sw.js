importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCzWmJUAceuYGjzbVv0ceu7RU78fVs0OM4",
  authDomain: "criczone-b1c64.firebaseapp.com",
  projectId: "criczone-b1c64",
  storageBucket: "criczone-b1c64.firebasestorage.app",
  messagingSenderId: "508655160995",
  appId: "1:508655160995:web:813362e519ed6f79b07916"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification.title || 'CricStreamZone';
  const notificationOptions = {
    body: payload.notification.body || 'New cricket match update!',
    icon: payload.notification.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.data?.tag || 'cricket-update',
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
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click in background
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // If app is already open, focus it
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          // If app is not open, open it
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});
