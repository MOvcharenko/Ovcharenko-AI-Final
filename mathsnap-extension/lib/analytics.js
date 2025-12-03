/*
  Consolidated Analytics client for MathSnap extension.
  - PostHog-compatible capture to <host>/capture/
  - Stores config and events in chrome.storage.local
  - Public API on window.analytics
*/

(function () {
  const STORAGE = {
    API_KEY: 'posthogApiKey',
    HOST: 'posthogHost',
    ENABLED: 'analyticsEnabled',
    DISTINCT_ID: 'analyticsDistinctId',
    EVENTS: 'analyticsEvents'
  };

  const DEFAULT_HOST = 'https://app.posthog.com';
  const MAX_EVENTS = 1000;

  function nowIso() { return new Date().toISOString(); }

  async function getAll(keys) {
    return await chrome.storage.local.get(keys);
  }

  async function setAll(obj) {
    return await chrome.storage.local.set(obj);
  }

  async function ensureDistinctId() {
    const r = await getAll([STORAGE.DISTINCT_ID]);
    if (r[STORAGE.DISTINCT_ID]) return r[STORAGE.DISTINCT_ID];
    const id = 'ext_' + Math.random().toString(36).slice(2, 12) + '_' + Date.now().toString(36);
    await setAll({ [STORAGE.DISTINCT_ID]: id });
    return id;
  }

  const Analytics = {
    // Initialize or update config (apiKey, host, enabled)
    async init({ apiKey, host, enabled } = {}) {
      const updates = {};
      if (apiKey !== undefined) updates[STORAGE.API_KEY] = apiKey;
      if (host !== undefined) updates[STORAGE.HOST] = host || DEFAULT_HOST;
      if (enabled !== undefined) updates[STORAGE.ENABLED] = !!enabled;
      if (Object.keys(updates).length) await setAll(updates);
      await ensureDistinctId();
      return true;
    },

    async getSettings() {
      const r = await getAll([STORAGE.API_KEY, STORAGE.HOST, STORAGE.ENABLED, STORAGE.DISTINCT_ID]);
      return {
        posthogApiKey: r[STORAGE.API_KEY] || '',
        posthogHost: r[STORAGE.HOST] || DEFAULT_HOST,
        analyticsEnabled: r[STORAGE.ENABLED] === undefined ? false : !!r[STORAGE.ENABLED],
        analyticsDistinctId: r[STORAGE.DISTINCT_ID] || ''
      };
    },

    async setApiKey(key) {
      await setAll({ [STORAGE.API_KEY]: key });
      return true;
    },

    async setHost(host) {
      await setAll({ [STORAGE.HOST]: host || DEFAULT_HOST });
      return true;
    },

    async optIn() {
      await setAll({ [STORAGE.ENABLED]: true });
      return true;
    },

    async optOut() {
      await setAll({ [STORAGE.ENABLED]: false });
      return true;
    },

    async isEnabled() {
      const s = await this.getSettings();
      return !!s.analyticsEnabled;
    },

    async getDistinctId() {
      return await ensureDistinctId();
    },

    // Store event locally (keeps bounded history)
    async storeLocally(event) {
      try {
        const r = await getAll([STORAGE.EVENTS]);
        const events = r[STORAGE.EVENTS] || [];
        events.push(event);
        if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
        await setAll({ [STORAGE.EVENTS]: events });
      } catch (err) {
        console.warn('analytics.storeLocally error', err);
      }
    },

    async getEvents() {
      try {
        const r = await getAll([STORAGE.EVENTS]);
        return r[STORAGE.EVENTS] || [];
      } catch (err) {
        console.error('analytics.getEvents error', err);
        return [];
      }
    },

    async clear() {
      await setAll({ [STORAGE.EVENTS]: [] });
      return true;
    },

    // Send event to PostHog capture endpoint (returns boolean)
    async _sendToPostHog(eventName, properties = {}) {
      try {
        const s = await this.getSettings();
        if (!s.posthogApiKey) {
          console.warn('analytics: missing PostHog API key');
          return false;
        }
        const distinct_id = s.analyticsDistinctId || await ensureDistinctId();
        const payload = {
          api_key: s.posthogApiKey,
          event: eventName,
          properties: Object.assign({
            distinct_id,
            time: nowIso(),
            source: 'mathsnap-extension',
            $lib: 'chrome-extension',
            $lib_version: chrome.runtime.getManifest().version
          }, properties)
        };
        const host = s.posthogHost || DEFAULT_HOST;
        const res = await fetch(`${host.replace(/\/$/, '')}/capture/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          console.warn('analytics: PostHog returned', res.status);
          return false;
        }
        return true;
      } catch (err) {
        console.warn('analytics: send error', err);
        return false;
      }
    },

    // Public track method: stores locally and attempts to send if enabled
    async track(eventName, properties = {}) {
      try {
        const settings = await this.getSettings();
        const eventRecord = {
          name: eventName,
          properties: Object.assign({}, properties),
          timestamp: Date.now()
        };

        // store locally always (for debugging/summary)
        await this.storeLocally(eventRecord);

        if (!settings.analyticsEnabled) {
          // not enabled, do not send to remote
          return false;
        }

        const ok = await this._sendToPostHog(eventName, properties);
        return ok;
      } catch (err) {
        console.warn('analytics.track error', err);
        return false;
      }
    },

    // Summary helpers
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

      const solved = events.filter(e => e.name === 'problem_solved' && e.properties && typeof e.properties.latency === 'number');
      if (solved.length) {
        const totalLatency = solved.reduce((sum, e) => sum + e.properties.latency, 0);
        summary.averageLatency = Math.round(totalLatency / solved.length);
      }

      const totalAttempts = summary.problemsSolved + summary.problemsFailed;
      if (totalAttempts > 0) summary.successRate = Math.round((summary.problemsSolved / totalAttempts) * 100);

      return summary;
    }
  };

  // Expose API
  window.analytics = Analytics;
})();