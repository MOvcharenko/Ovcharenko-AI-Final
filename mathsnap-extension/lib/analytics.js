// Analytics Tracker
// Sends events to your analytics backend

const Analytics = {
  // Configuration
  ENDPOINT: 'YOUR_ANALYTICS_ENDPOINT', // e.g., Supabase, PostHog, or custom backend
  enabled: true,
  
  /**
   * Track an event
   * @param {string} eventName - Name of the event
   * @param {Object} properties - Event properties
   */
  async track(eventName, properties = {}) {
    if (!this.enabled) return;
    
    try {
      const event = {
        name: eventName,
        properties: {
          ...properties,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          extensionVersion: chrome.runtime.getManifest().version
        }
      };
      
      // Store locally
      await this.storeLocally(event);
      
      // Send to backend (optional)
      if (this.ENDPOINT) {
        await this.sendToBackend(event);
      }
      
      console.log('📊 Analytics:', eventName, properties);
    } catch (error) {
      console.error('Analytics error:', error);
    }
  },
  
  /**
   * Store event locally in Chrome storage
   */
  async storeLocally(event) {
    try {
      const result = await chrome.storage.local.get(['analytics']);
      const events = result.analytics || [];
      
      events.push(event);
      
      // Keep only last 1000 events
      if (events.length > 1000) {
        events.shift();
      }
      
      await chrome.storage.local.set({ analytics: events });
    } catch (error) {
      console.error('Failed to store analytics:', error);
    }
  },
  
  /**
   * Send event to backend
   */
  async sendToBackend(event) {
    // Skip if no endpoint configured
    if (!this.ENDPOINT || this.ENDPOINT === 'YOUR_ANALYTICS_ENDPOINT') {
      console.log('📊 Analytics: No backend endpoint configured, skipping remote tracking');
      return;
    }
    
    try {
      await fetch(this.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });
    } catch (error) {
      // Don't throw error for analytics failures
      console.warn('Analytics backend unavailable:', error.message);
    }
  },
  
  /**
   * Get all stored events
   */
  async getEvents() {
    try {
      const result = await chrome.storage.local.get(['analytics']);
      return result.analytics || [];
    } catch (error) {
      console.error('Failed to get analytics:', error);
      return [];
    }
  },
  
  /**
   * Get analytics summary
   */
  async getSummary() {
    const events = await this.getEvents();
    
    const summary = {
      totalEvents: events.length,
      problemsSolved: events.filter(e => e.name === 'problem_solved').length,
      problemsFailed: events.filter(e => e.name === 'problem_failed').length,
      checkoutsInitiated: events.filter(e => e.name === 'checkout_initiated').length,
      subscriptionsCreated: events.filter(e => e.name === 'subscription_created').length,
      averageLatency: 0,
      successRate: 0
    };
    
    // Calculate average latency
    const solvedEvents = events.filter(e => e.name === 'problem_solved' && e.properties.latency);
    if (solvedEvents.length > 0) {
      const totalLatency = solvedEvents.reduce((sum, e) => sum + e.properties.latency, 0);
      summary.averageLatency = Math.round(totalLatency / solvedEvents.length);
    }
    
    // Calculate success rate
    const totalAttempts = summary.problemsSolved + summary.problemsFailed;
    if (totalAttempts > 0) {
      summary.successRate = Math.round((summary.problemsSolved / totalAttempts) * 100);
    }
    
    return summary;
  },
  
  /**
   * Clear all analytics data
   */
  async clear() {
    try {
      await chrome.storage.local.set({ analytics: [] });
      console.log('Analytics cleared');
    } catch (error) {
      console.error('Failed to clear analytics:', error);
    }
  }
};

// PostHog Integration (if you want to use PostHog)
const PostHogAnalytics = {
  API_KEY: 'phc_x8OaNbVVPxgy1QF3SAWA7Q1ptDVNaURez9BcVp6rHmb',
  HOST: 'https://app.posthog.com',
  
  async track(eventName, properties = {}) {
    try {
      await fetch(`${this.HOST}/capture/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: this.API_KEY,
          event: eventName,
          properties: {
            ...properties,
            distinct_id: await this.getDistinctId(),
            $lib: 'chrome-extension',
            $lib_version: '1.0.0'
          }
        })
      });
    } catch (error) {
      console.error('PostHog error:', error);
    }
  },
  
  async getDistinctId() {
    const result = await chrome.storage.local.get(['distinctId']);
    if (result.distinctId) {
      return result.distinctId;
    }
    
    const newId = 'user_' + Math.random().toString(36).substr(2, 9);
    await chrome.storage.local.set({ distinctId: newId });
    return newId;
  }
};

// Supabase Integration (if you want to use Supabase)
const SupabaseAnalytics = {
  URL: 'YOUR_SUPABASE_URL',
  KEY: 'YOUR_SUPABASE_ANON_KEY',
  
  async track(eventName, properties = {}) {
    try {
      await fetch(`${this.URL}/rest/v1/analytics_events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.KEY,
          'Authorization': `Bearer ${this.KEY}`
        },
        body: JSON.stringify({
          event_name: eventName,
          properties: properties,
          created_at: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Supabase error:', error);
    }
  }
};

// Export the analytics client you want to use
// window.Analytics = Analytics; // Default local analytics
window.Analytics = PostHogAnalytics; // Use PostHog
// window.Analytics = SupabaseAnalytics; // Use Supabase