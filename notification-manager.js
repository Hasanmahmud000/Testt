// Notification Manager for CricStreamZone
class NotificationManager {
  constructor() {
    this.notificationEnabled = localStorage.getItem('notificationEnabled') === 'true';
    this.scheduledNotifications = new Map();
    this.backgroundCheckInterval = null;
    this.init();
  }

  async init() {
    console.log('Initializing Notification Manager...');
    
    if ('Notification' in window && 'serviceWorker' in navigator) {
      await this.setupServiceWorker();
      this.handleVisibilityChange();
      
      // Start background check if notifications are enabled
      if (this.isEnabled()) {
        this.startBackgroundCheck();
      }
    } else {
      console.warn('Notifications or Service Workers not supported');
    }
  }

  async setupServiceWorker() {
    try {
      // Register Firebase messaging service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      
      console.log('Firebase SW registered successfully:', registration);
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      
      // Send periodic sync message to service worker
      if (registration.active) {
        registration.active.postMessage({ 
          type: 'SCHEDULE_SYNC',
          enabled: this.notificationEnabled 
        });
      }
      
      // Listen for service worker updates
      registration.addEventListener('updatefound', () => {
        console.log('Service worker update found');
      });
      
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  async requestPermission() {
    console.log('Requesting notification permission...');
    
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    // Check current permission
    if (Notification.permission === 'granted') {
      this.notificationEnabled = true;
      localStorage.setItem('notificationEnabled', 'true');
      return true;
    }

    if (Notification.permission === 'denied') {
      console.log('Notification permission denied by user');
      return false;
    }

    // Request permission
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('Notification permission granted');
        this.notificationEnabled = true;
        localStorage.setItem('notificationEnabled', 'true');
        
        // Start background checking
        this.startBackgroundCheck();
        
        // Send test notification
        setTimeout(() => {
          this.sendTestNotification();
        }, 1000);
        
        return true;
      } else {
        console.log('Notification permission denied');
        this.notificationEnabled = false;
        localStorage.setItem('notificationEnabled', 'false');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  scheduleMatchNotifications(matches) {
    if (!this.isEnabled()) {
      console.log('Notifications not enabled, skipping scheduling');
      return;
    }

    console.log(`Scheduling notifications for ${matches.length} matches...`);

    // Clear existing scheduled notifications
    this.clearScheduledNotifications();

    const now = new Date();
    let scheduledCount = 0;

    matches.forEach((match, index) => {
      const matchTime = new Date(match.MatchTime);
      const duration = parseInt(match.MatchDuration) || 360; // Default 6 hours
      const endTime = new Date(matchTime.getTime() + duration * 60 * 1000);

      // Only schedule for future matches
      if (matchTime <= now) return;

      // Schedule 15 minutes before match
      const fifteenMinBefore = new Date(matchTime.getTime() - 15 * 60 * 1000);
      if (fifteenMinBefore > now) {
        const timeoutId = setTimeout(() => {
          this.showNotification(
            '🏏 Match Starting Soon!',
            `${match.Team1} vs ${match.Team2} starts in 15 minutes`,
            match.Team1Logo || '/icon-192.png',
            {
              tag: `match-15min-${index}`,
              data: { matchId: index, type: '15min', match: match }
            }
          );
        }, fifteenMinBefore.getTime() - now.getTime());
        
        this.scheduledNotifications.set(`15min-${index}`, {
          timeoutId,
          time: fifteenMinBefore,
          match: match,
          type: '15min'
        });
        scheduledCount++;
      }

      // Schedule 5 minutes before match
      const fiveMinBefore = new Date(matchTime.getTime() - 5 * 60 * 1000);
      if (fiveMinBefore > now) {
        const timeoutId = setTimeout(() => {
          this.showNotification(
            '⚡ Match Starting Very Soon!',
            `${match.Team1} vs ${match.Team2} starts in 5 minutes`,
            match.Team1Logo || '/icon-192.png',
            {
              tag: `match-5min-${index}`,
              data: { matchId: index, type: '5min', match: match }
            }
          );
        }, fiveMinBefore.getTime() - now.getTime());
        
        this.scheduledNotifications.set(`5min-${index}`, {
          timeoutId,
          time: fiveMinBefore,
          match: match,
          type: '5min'
        });
        scheduledCount++;
      }

      // Schedule match start notification
      if (matchTime > now) {
        const timeoutId = setTimeout(() => {
          this.showNotification(
            '🔴 LIVE NOW!',
            `${match.Team1} vs ${match.Team2} has started! Watch now!`,
            match.Team1Logo || '/icon-192.png',
            {
              tag: `match-start-${index}`,
              data: { matchId: index, type: 'start', match: match },
              requireInteraction: true,
              actions: [
                {
                  action: 'watch',
                  title: 'Watch Now',
                  icon: '/icon-192.png'
                },
                {
                  action: 'close',
                  title: 'Close',
                  icon: '/icon-192.png'
                }
              ]
            }
          );
        }, matchTime.getTime() - now.getTime());
        
        this.scheduledNotifications.set(`start-${index}`, {
          timeoutId,
          time: matchTime,
          match: match,
          type: 'start'
        });
        scheduledCount++;
      }

      // Schedule match end notification
      if (endTime > now) {
        const timeoutId = setTimeout(() => {
          this.showNotification(
            '🏁 Match Finished',
            `${match.Team1} vs ${match.Team2} has ended`,
            match.Team1Logo || '/icon-192.png',
            {
              tag: `match-end-${index}`,
              data: { matchId: index, type: 'end', match: match }
            }
          );
        }, endTime.getTime() - now.getTime());
        
        this.scheduledNotifications.set(`end-${index}`, {
          timeoutId,
          time: endTime,
          match: match,
          type: 'end'
        });
        scheduledCount++;
      }
    });

    console.log(`Successfully scheduled ${scheduledCount} notifications`);
    
    // Store scheduled notifications info in localStorage for persistence
    const scheduledInfo = Array.from(this.scheduledNotifications.entries()).map(([key, value]) => ({
      key,
      time: value.time.toISOString(),
      matchTeams: `${value.match.Team1} vs ${value.match.Team2}`,
      type: value.type
    }));
    
    localStorage.setItem('scheduledNotifications', JSON.stringify(scheduledInfo));
  }

  showNotification(title, body, icon = '/icon-192.png', options = {}) {
    if (!this.isEnabled()) {
      console.log('Cannot show notification: not enabled');
      return null;
    }

    try {
      const defaultOptions = {
        body: body,
        icon: icon,
        badge: '/icon-192.png',
        tag: options.tag || 'cricstreamzone-match',
        requireInteraction: options.requireInteraction || false,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        timestamp: Date.now(),
        data: options.data || {}
      };

      // Merge with custom options
      const finalOptions = { ...defaultOptions, ...options };

      const notification = new Notification(title, finalOptions);

      // Handle notification click
      notification.onclick = (event) => {
        console.log('Notification clicked:', event);
        
        // Focus the app window
        if (window) {
          window.focus();
        }
        
        // Close notification
        notification.close();
        
        // Handle action based on notification type
        if (finalOptions.data && finalOptions.data.type === 'start') {
          // Redirect to live matches
          if (typeof showCategory === 'function') {
            showCategory('live');
          }
        }
      };

      // Handle notification error
      notification.onerror = (error) => {
        console.error('Notification error:', error);
      };

      // Auto close after 10 seconds (except for important ones)
      if (!finalOptions.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 10000);
      }

      console.log('Notification shown:', title);
      return notification;

    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }

  clearScheduledNotifications() {
    console.log(`Clearing ${this.scheduledNotifications.size} scheduled notifications...`);
    
    this.scheduledNotifications.forEach((notification, key) => {
      if (notification.timeoutId) {
        clearTimeout(notification.timeoutId);
      }
    });
    
    this.scheduledNotifications.clear();
    localStorage.removeItem('scheduledNotifications');
    
    console.log('All scheduled notifications cleared');
  }

  toggleNotifications() {
    const wasEnabled = this.notificationEnabled;
    this.notificationEnabled = !this.notificationEnabled;
    localStorage.setItem('notificationEnabled', this.notificationEnabled.toString());
    
    console.log(`Notifications ${this.notificationEnabled ? 'enabled' : 'disabled'}`);
    
    if (!this.notificationEnabled) {
      // Disable notifications
      this.clearScheduledNotifications();
      this.stopBackgroundCheck();
      
      this.showNotification(
        '🔕 Notifications Disabled',
        'You will no longer receive match alerts',
        '/icon-192.png'
      );
    } else if (!wasEnabled && this.notificationEnabled) {
      // Enable notifications
      if (Notification.permission === 'granted') {
        this.startBackgroundCheck();
        
        this.showNotification(
          '🔔 Notifications Enabled!',
          'You will now receive match alerts',
          '/icon-192.png'
        );
      } else {
        // Request permission first
        this.requestPermission();
      }
    }
    
    return this.notificationEnabled;
  }

  isEnabled() {
    return this.notificationEnabled && 
           'Notification' in window && 
           Notification.permission === 'granted';
  }

  getPermissionStatus() {
    if (!('Notification' in window)) {
      return 'not-supported';
    }
    return Notification.permission;
  }

  // Send test notification
  sendTestNotification() {
    if (this.isEnabled()) {
      this.showNotification(
        '🔔 Notifications Ready!',
        'You will receive alerts for upcoming matches',
        '/icon-192.png',
        {
          tag: 'test-notification',
          requireInteraction: false
        }
      );
      
      console.log('Test notification sent');
      return true;
    } else {
      console.log('Cannot send test notification: not enabled');
      return false;
    }
  }

  // Start background checking for match updates
  startBackgroundCheck() {
    if (!this.isEnabled()) {
      console.log('Cannot start background check: notifications not enabled');
      return;
    }

    // Clear existing interval
    this.stopBackgroundCheck();

    console.log('Starting background notification check...');

    // Check immediately
    this.performBackgroundCheck();

    // Then check every 3 minutes
    this.backgroundCheckInterval = setInterval(() => {
      this.performBackgroundCheck();
    }, 3 * 60 * 1000); // Every 3 minutes

    console.log('Background check started (every 3 minutes)');
  }

  stopBackgroundCheck() {
    if (this.backgroundCheckInterval) {
      clearInterval(this.backgroundCheckInterval);
      this.backgroundCheckInterval = null;
      console.log('Background check stopped');
    }
  }

  async performBackgroundCheck() {
    if (!this.isEnabled()) return;

    try {
      console.log('Performing background check for match updates...');
      
      const response = await fetch('https://script.google.com/macros/s/AKfycbxZfHUGsH19x3hZp5eeo3tEMJuQxvOPHpyS_LAqow4rlBciyrhP0NdaI2NzeZiyA5SF9A/exec');
      const data = await response.json();
      
      if (data.matches && Array.isArray(data.matches)) {
        // Re-schedule notifications with updated match data
        this.scheduleMatchNotifications(data.matches);
        console.log('Background check completed successfully');
      } else {
        console.warn('Invalid match data received in background check');
      }
      
    } catch (error) {
      console.error('Background check failed:', error);
    }
  }

  // Handle app visibility changes
  handleVisibilityChange() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('App became visible');
        
        if (this.isEnabled()) {
          // App became visible, refresh notifications
          setTimeout(() => {
            this.performBackgroundCheck();
          }, 1000);
        }
      } else {
        console.log('App became hidden');
      }
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      console.log('App is closing, notifications will continue in background');
    });
  }

  // Get notification statistics
  getStats() {
    const scheduled = this.scheduledNotifications.size;
    const enabled = this.isEnabled();
    const permission = this.getPermissionStatus();
    
    return {
      enabled,
      permission,
      scheduledCount: scheduled,
      backgroundCheckActive: !!this.backgroundCheckInterval,
      scheduledNotifications: Array.from(this.scheduledNotifications.entries()).map(([key, value]) => ({
        key,
        time: value.time,
        match: `${value.match.Team1} vs ${value.match.Team2}`,
        type: value.type
      }))
    };
  }

  // Debug method (continuing...)
  debug() {
    console.log('=== Notification Manager Debug Info ===');
    console.log('Stats:', this.getStats());
    console.log('Local Storage:', {
      notificationEnabled: localStorage.getItem('notificationEnabled'),
      scheduledNotifications: localStorage.getItem('scheduledNotifications')
    });
    console.log('Browser Support:', {
      notifications: 'Notification' in window,
      serviceWorker: 'serviceWorker' in navigator,
      permission: Notification.permission
    });
    console.log('Scheduled Notifications:', this.scheduledNotifications);
    console.log('Background Check Active:', !!this.backgroundCheckInterval);
    console.log('========================================');
  }

  // Force refresh all notifications
  async refreshNotifications() {
    console.log('Force refreshing all notifications...');
    
    if (!this.isEnabled()) {
      console.log('Cannot refresh: notifications not enabled');
      return false;
    }

    try {
      await this.performBackgroundCheck();
      console.log('Notifications refreshed successfully');
      return true;
    } catch (error) {
      console.error('Failed to refresh notifications:', error);
      return false;
    }
  }

  // Clean up method
  destroy() {
    console.log('Destroying Notification Manager...');
    
    this.clearScheduledNotifications();
    this.stopBackgroundCheck();
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    console.log('Notification Manager destroyed');
  }

  // Check if a specific match has notifications scheduled
  hasNotificationsForMatch(matchIndex) {
    const keys = [`15min-${matchIndex}`, `5min-${matchIndex}`, `start-${matchIndex}`, `end-${matchIndex}`];
    return keys.some(key => this.scheduledNotifications.has(key));
  }

  // Cancel notifications for a specific match
  cancelMatchNotifications(matchIndex) {
    const keys = [`15min-${matchIndex}`, `5min-${matchIndex}`, `start-${matchIndex}`, `end-${matchIndex}`];
    let canceledCount = 0;
    
    keys.forEach(key => {
      if (this.scheduledNotifications.has(key)) {
        const notification = this.scheduledNotifications.get(key);
        clearTimeout(notification.timeoutId);
        this.scheduledNotifications.delete(key);
        canceledCount++;
      }
    });
    
    console.log(`Canceled ${canceledCount} notifications for match ${matchIndex}`);
    return canceledCount;
  }

  // Get next scheduled notification
  getNextNotification() {
    if (this.scheduledNotifications.size === 0) {
      return null;
    }

    let nextNotification = null;
    let earliestTime = null;

    this.scheduledNotifications.forEach((notification, key) => {
      if (!earliestTime || notification.time < earliestTime) {
        earliestTime = notification.time;
        nextNotification = {
          key,
          time: notification.time,
          match: notification.match,
          type: notification.type,
          timeUntil: notification.time.getTime() - Date.now()
        };
      }
    });

    return nextNotification;
  }

  // Format time until next notification
  getTimeUntilNext() {
    const next = this.getNextNotification();
    if (!next || next.timeUntil <= 0) {
      return null;
    }

    const minutes = Math.floor(next.timeUntil / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // Send immediate notification for testing
  sendImmediateTestNotification(type = 'test') {
    const notifications = {
      test: {
        title: '🔔 Test Notification',
        body: 'This is a test notification from CricStreamZone!',
        icon: '/icon-192.png'
      },
      match15: {
        title: '🏏 Match Starting Soon!',
        body: 'India vs Pakistan starts in 15 minutes',
        icon: '/icon-192.png'
      },
      match5: {
        title: '⚡ Match Starting Very Soon!',
        body: 'India vs Pakistan starts in 5 minutes',
        icon: '/icon-192.png'
      },
      live: {
        title: '🔴 LIVE NOW!',
        body: 'India vs Pakistan has started! Watch now!',
        icon: '/icon-192.png'
      },
      finished: {
        title: '🏁 Match Finished',
        body: 'India vs Pakistan has ended',
        icon: '/icon-192.png'
      }
    };

    const notification = notifications[type] || notifications.test;
    
    return this.showNotification(
      notification.title,
      notification.body,
      notification.icon,
      {
        tag: `test-${type}-${Date.now()}`,
        requireInteraction: type === 'live'
      }
    );
  }

  // Restore notifications from localStorage (for page refresh)
  restoreScheduledNotifications() {
    try {
      const stored = localStorage.getItem('scheduledNotifications');
      if (stored) {
        const scheduledInfo = JSON.parse(stored);
        console.log(`Found ${scheduledInfo.length} stored notification schedules`);
        
        // Note: We can't restore the actual timeouts after page refresh
        // This is just for display purposes
        return scheduledInfo;
      }
    } catch (error) {
      console.error('Error restoring scheduled notifications:', error);
    }
    return [];
  }

  // Update notification settings
  updateSettings(settings) {
    const {
      enabled = this.notificationEnabled,
      backgroundCheck = true
    } = settings;

    // Update enabled state
    if (enabled !== this.notificationEnabled) {
      this.toggleNotifications();
    }

    // Update background check
    if (backgroundCheck && this.isEnabled()) {
      this.startBackgroundCheck();
    } else {
      this.stopBackgroundCheck();
    }

    console.log('Notification settings updated:', settings);
  }

  // Get user-friendly status message
  getStatusMessage() {
    if (!('Notification' in window)) {
      return 'Notifications not supported in this browser';
    }

    if (Notification.permission === 'denied') {
      return 'Notifications blocked. Please enable in browser settings.';
    }

    if (Notification.permission === 'default') {
      return 'Click to enable match notifications';
    }

    if (!this.notificationEnabled) {
      return 'Notifications disabled. Click to enable.';
    }

    const scheduledCount = this.scheduledNotifications.size;
    const nextTime = this.getTimeUntilNext();
    
    if (scheduledCount === 0) {
      return 'No upcoming matches to notify about';
    }

    if (nextTime) {
      return `${scheduledCount} notifications scheduled. Next in ${nextTime}`;
    }

    return `${scheduledCount} notifications scheduled`;
  }
}

// Create global instance
const notificationManager = new NotificationManager();

// Export for global use
window.NotificationManager = NotificationManager;
window.notificationManager = notificationManager;

// Auto-start when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, notification manager ready');
  });
} else {
  console.log('Notification manager ready');
}

// Export default
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationManager;
}
