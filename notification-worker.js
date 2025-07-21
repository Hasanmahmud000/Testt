// Advanced Notification Worker for Background Processing
class AdvancedNotificationWorker {
  constructor() {
    this.matches = [];
    this.notificationQueue = [];
    this.isProcessing = false;
    this.init();
  }

  init() {
    // Check for matches every minute in background
    setInterval(() => {
      this.checkMatches();
    }, 60000); // 1 minute

    // Process notification queue every 5 seconds
    setInterval(() => {
      this.processNotificationQueue();
    }, 5000);

    console.log('Advanced Notification Worker initialized');
  }

  async checkMatches() {
    try {
      const response = await fetch('https://script.google.com/macros/s/AKfycbxZfHUGsH19x3hZp5eeo3tEMJuQxvOPHpyS_LAqow4rlBciyrhP0NdaI2NzeZiyA5SF9A/exec');
      const data = await response.json();
      
      if (data.matches) {
        this.matches = data.matches;
        this.scheduleNotifications();
      }
    } catch (error) {
      console.error('Error fetching matches in background:', error);
    }
  }

  scheduleNotifications() {
    const now = new Date();
    
    this.matches.forEach(match => {
      const matchTime = new Date(match.MatchTime);
      const duration = parseInt(match.MatchDuration) || 360;
      const endTime = new Date(matchTime.getTime() + (duration * 60 * 1000));
      
      // 15 minutes before
      const time15Min = matchTime.getTime() - (15 * 60 * 1000);
      if (time15Min > now.getTime() && time15Min <= now.getTime() + 60000) {
        this.addToQueue({
          type: '15min',
          match: match,
          time: time15Min,
          title: '🏏 Match Starting Soon!',
          body: `${match.Team1} vs ${match.Team2} starts in 15 minutes`
        });
      }

      // 5 minutes before
      const time5Min = matchTime.getTime() - (5 * 60 * 1000);
      if (time5Min > now.getTime() && time5Min <= now.getTime() + 60000) {
        this.addToQueue({
          type: '5min',
          match: match,
          time: time5Min,
          title: '⚡ Match Starting Very Soon!',
          body: `${match.Team1} vs ${match.Team2} starts in 5 minutes`
        });
      }

      // Match start
      if (matchTime.getTime() > now.getTime() && matchTime.getTime() <= now.getTime() + 60000) {
        this.addToQueue({
          type: 'live',
          match: match,
          time: matchTime.getTime(),
          title: '🔴 LIVE NOW!',
          body: `${match.Team1} vs ${match.Team2} is now LIVE!`
        });
      }

      // Match end
      if (endTime.getTime() > now.getTime() && endTime.getTime() <= now.getTime() + 60000) {
        this.addToQueue({
          type: 'end',
          match: match,
          time: endTime.getTime(),
          title: '🏁 Match Ended',
          body: `${match.Team1} vs ${match.Team2} has ended`
        });
      }
    });
  }

  addToQueue(notification) {
    // Check if notification already exists
    const exists = this.notificationQueue.some(n => 
      n.type === notification.type && 
      n.match.Team1 === notification.match.Team1 && 
      n.match.Team2 === notification.match.Team2
    );

    if (!exists) {
      this.notificationQueue.push(notification);
      console.log('Added notification to queue:', notification.title);
    }
  }

  async processNotificationQueue() {
    if (this.isProcessing || this.notificationQueue.length === 0) return;

    this.isProcessing = true;
    const now = new Date().getTime();

    // Process notifications that are due
    const dueNotifications = this.notificationQueue.filter(n => n.time <= now);
    
    for (const notification of dueNotifications) {
      await this.sendNotification(notification);
      
      // Remove from queue
      const index = this.notificationQueue.indexOf(notification);
      if (index > -1) {
        this.notificationQueue.splice(index, 1);
      }
    }

    // Clean up old notifications (older than 1 hour)
    this.notificationQueue = this.notificationQueue.filter(n => 
      n.time > now - (60 * 60 * 1000)
    );

    this.isProcessing = false;
  }

  async sendNotification(notification) {
    // Check if notifications are enabled
    const notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true';
    
    if (!notificationsEnabled || Notification.permission !== 'granted') {
      console.log('Notifications disabled or permission denied');
      return;
    }

    try {
      const notif = new Notification(notification.title, {
        body: notification.body,
        icon: 'https://i.postimg.cc/3rPWWckN/icon-192.png',
        badge: 'https://i.postimg.cc/3rPWWckN/icon-192.png',
        tag: `${notification.type}-${notification.match.Team1}-${notification.match.Team2}`,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200],
        data: {
          match: notification.match,
          type: notification.type,
          timestamp: Date.now()
        }
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
        
        // Navigate to live matches if needed
        if (typeof showCategory === 'function') {
          showCategory('live');
        }
      };

      // Auto close after 15 seconds
      setTimeout(() => {
        notif.close();
      }, 15000);

      console.log('Notification sent:', notification.title);
      
      // Store notification history
      this.storeNotificationHistory(notification);
      
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  storeNotificationHistory(notification) {
    try {
      let history = JSON.parse(localStorage.getItem('notificationHistory') || '[]');
      
      history.push({
        title: notification.title,
        body: notification.body,
        type: notification.type,
        match: `${notification.match.Team1} vs ${notification.match.Team2}`,
        timestamp: Date.now()
      });

      // Keep only last 50 notifications
      if (history.length > 50) {
        history = history.slice(-50);
      }

      localStorage.setItem('notificationHistory', JSON.stringify(history));
    } catch (error) {
      console.error('Error storing notification history:', error);
    }
  }

  getNotificationHistory() {
    try {
      return JSON.parse(localStorage.getItem('notificationHistory') || '[]');
    } catch (error) {
      console.error('Error getting notification history:', error);
      return [];
    }
  }

  clearNotificationHistory() {
    localStorage.removeItem('notificationHistory');
  }

  // Test notification function
  sendTestNotification() {
    this.sendNotification({
      title: '🧪 Test Notification',
      body: 'This is a test notification from CricStreamZone',
      type: 'test',
      match: { Team1: 'Test', Team2: 'Team' }
    });
  }
}

// Initialize the advanced notification worker
if (typeof window !== 'undefined') {
  window.advancedNotificationWorker = new AdvancedNotificationWorker();
}
