// 🔔 Dedicated Notification Worker for Enhanced Background Processing
class NotificationManager {
  constructor() {
    this.matches = [];
    this.settings = {
      enabled: false,
      notify15min: true,
      notify5min: true,
      notifyStart: true,
      notifyEnd: true
    };
    this.sentNotifications = new Set();
    this.apiUrl = "https://script.google.com/macros/s/AKfycbxZfHUGsH19x3hZp5eeo3tEMJuQxvOPHpyS_LAqow4rlBciyrhP0NdaI2NzeZiyA5SF9A/exec";
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.fetchMatches();
    this.startPeriodicCheck();
    console.log('🔔 Notification Manager initialized');
  }

  async loadSettings() {
    try {
      const settings = localStorage.getItem('notificationSettings');
      if (settings) {
        this.settings = { ...this.settings, ...JSON.parse(settings) };
      }
      
      const notifications = localStorage.getItem('sentNotifications');
      if (notifications) {
        this.sentNotifications = new Set(JSON.parse(notifications));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  }

  async saveSettings() {
    try {
      localStorage.setItem('notificationSettings', JSON.stringify(this.settings));
      localStorage.setItem('sentNotifications', JSON.stringify(Array.from(this.sentNotifications)));
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  }

  async fetchMatches() {
    try {
      const response = await fetch(this.apiUrl);
      const data = await response.json();
      this.matches = data.matches || [];
      console.log(`📊 Fetched ${this.matches.length} matches for notification check`);
    } catch (error) {
      console.error('Error fetching matches for notifications:', error);
    }
  }

  getMatchStatus(matchTime, matchDuration, now) {
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

  async showNotification(title, body, options = {}) {
    if (!this.settings.enabled || Notification.permission !== 'granted') {
      return;
    }

    const defaultOptions = {
      icon: 'https://i.postimg.cc/3rPWWckN/icon-192.png',
      badge: 'https://i.postimg.cc/3rPWWckN/icon-192.png',
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200],
      ...options
    };

    try {
      const notification = new Notification(title, {
        body: body,
        ...defaultOptions
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 15 seconds for non-critical notifications
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 15000);
      }

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  async checkAndSendNotifications() {
    if (!this.settings.enabled || !this.matches.length) {
      return;
    }

    const now = new Date();
    console.log(`🔍 Checking notifications at ${now.toLocaleTimeString()}`);

    for (const match of this.matches) {
      const matchTime = new Date(match.MatchTime);
      const duration = parseInt(match.MatchDuration) || 360;
      const endTime = new Date(matchTime.getTime() + (duration * 60 * 1000));
      const matchId = match.Match.replace(/\s+/g, '-').toLowerCase();

      // 15 minutes before notification
      const time15min = new Date(matchTime.getTime() - 15 * 60 * 1000);
      if (this.settings.notify15min && 
          now >= time15min && 
          now < matchTime && 
          !this.sentNotifications.has(`${matchId}-15min`)) {
        
        await this.showNotification(
          '🏏 Match Alert - 15 Minutes!',
          `${match.Team1} vs ${match.Team2} starts in 15 minutes\n🕐 ${matchTime.toLocaleTimeString()}`,
          {
            tag: `${matchId}-15min`,
            requireInteraction: true,
            actions: [
              { action: 'view', title: '👀 View Match' },
              { action: 'dismiss', title: '✕ Dismiss' }
            ]
          }
        );
        
        this.sentNotifications.add(`${matchId}-15min`);
        console.log(`✅ Sent 15min notification: ${match.Match}`);
      }

      // 5 minutes before notification
      const time5min = new Date(matchTime.getTime() - 5 * 60 * 1000);
      if (this.settings.notify5min && 
          now >= time5min && 
          now < matchTime && 
          !this.sentNotifications.has(`${matchId}-5min`)) {
        
        await this.showNotification(
          '⏰ Match Starting Very Soon!',
          `${match.Team1} vs ${match.Team2} starts in 5 minutes\n🚨 Get ready to watch!`,
          {
            tag: `${matchId}-5min`,
            requireInteraction: true,
            vibrate: [300, 100, 300, 100, 300],
            actions: [
              { action: 'watch', title: '🔴 Watch Now' },
              { action: 'dismiss', title: '✕ Later' }
            ]
          }
        );
        
        this.sentNotifications.add(`${matchId}-5min`);
        console.log(`✅ Sent 5min notification: ${match.Match}`);
      }

      // Match started notification
      if (this.settings.notifyStart && 
          now >= matchTime && 
          now < new Date(matchTime.getTime() + 10 * 60 * 1000) && 
          !this.sentNotifications.has(`${matchId}-start`)) {
        
        await this.showNotification(
          '🔴 LIVE NOW!',
          `${match.Team1} vs ${match.Team2} is now LIVE!\n⚡ Don't miss the action!`,
          {
            tag: `${matchId}-start`,
            requireInteraction: true,
            vibrate: [500, 200, 500],
            actions: [
              { action: 'watch', title: '🎯 Watch Live' },
              { action: 'dismiss', title: '✕ Close' }
            ]
          }
        );
        
        this.sentNotifications.add(`${matchId}-start`);
        console.log(`✅ Sent start notification: ${match.Match}`);
      }

      // Match ended notification
      if (this.settings.notifyEnd && 
          now >= endTime && 
          now < new Date(endTime.getTime() + 30 * 60 * 1000) && 
          !this.sentNotifications.has(`${matchId}-end`)) {
        
        await this.showNotification(
          '🏁 Match Finished',
          `${match.Team1} vs ${match.Team2} has ended\n📊 Check highlights and scores`,
          {
            tag: `${matchId}-end`,
            requireInteraction: false,
            actions: [
              { action: 'view', title: '📊 View Results' },
              { action: 'dismiss', title: '✕ Close' }
            ]
          }
        );
        
        this.sentNotifications.add(`${matchId}-end`);
        console.log(`✅ Sent end notification: ${match.Match}`);
      }
    }

    // Cleanup old notifications (older than 24 hours)
    this.cleanupOldNotifications(now);
    await this.saveSettings();
  }

  cleanupOldNotifications(now) {
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    this.matches.forEach(match => {
      const matchTime = new Date(match.MatchTime);
      if (matchTime < oneDayAgo) {
        const matchId = match.Match.replace(/\s+/g, '-').toLowerCase();
        const notifications = [
          `${matchId}-15min`,
          `${matchId}-5min`,
          `${matchId}-start`,
          `${matchId}-end`
        ];
        
        notifications.forEach(notifId => {
          if (this.sentNotifications.has(notifId)) {
            this.sentNotifications.delete(notifId);
            cleanedCount++;
          }
        });
      }
    });

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old notifications`);
    }
  }

  startPeriodicCheck() {
    // Check every minute
    setInterval(async () => {
      await this.fetchMatches();
      await this.checkAndSendNotifications();
    }, 60000);

    // Initial check
    setTimeout(() => {
      this.checkAndSendNotifications();
    }, 5000);
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    console.log('🔧 Notification settings updated:', this.settings);
  }

  // Test notification function
  async testNotification() {
    await this.showNotification(
      '🧪 Test Notification',
      'CricStreamZone notifications are working perfectly! 🎉',
      {
        tag: 'test-notification',
        requireInteraction: false
      }
    );
  }

  // Get notification statistics
  getStats() {
    return {
      totalMatches: this.matches.length,
      sentNotifications: this.sentNotifications.size,
      settings: this.settings,
      lastCheck: new Date().toISOString()
    };
  }
}

// Initialize notification manager if in main thread
if (typeof window !== 'undefined') {
  window.notificationManager = new NotificationManager();
  
  // Expose global functions
  window.testNotification = () => window.notificationManager.testNotification();
  window.getNotificationStats = () => window.notificationManager.getStats();
}

// Export for service worker
if (typeof self !== 'undefined' && self.importScripts) {
  self.NotificationManager = NotificationManager;
}

console.log('🔔 Notification Worker loaded successfully');
