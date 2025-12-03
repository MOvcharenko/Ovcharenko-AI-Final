// UI script for analytics.html (no inline code in HTML to satisfy CSP)

(async () => {
  const apiKeyEl = document.getElementById('apiKey');
  const hostEl = document.getElementById('host');
  const enabledEl = document.getElementById('enabled');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const clearBtn = document.getElementById('clearBtn');
  const viewDashboardBtn = document.getElementById('viewDashboardBtn');
  const statusMsg = document.getElementById('status-message');
  const statsGrid = document.getElementById('statsGrid');
  const eventCountEl = document.getElementById('eventCount');
  const lastEventEl = document.getElementById('lastEvent');

  function showStatus(message, type = 'info') {
    statusMsg.textContent = message;
    statusMsg.className = `status-message ${type}`;
    statusMsg.style.display = 'block';
    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 5000);
  }

  async function loadSettings() {
    try {
      const settings = await window.analytics.getSettings();
      apiKeyEl.value = settings.posthogApiKey || '';
      hostEl.value = settings.posthogHost || 'https://app.posthog.com';
      enabledEl.checked = !!settings.analyticsEnabled;
      // populate stats if any
      const events = await window.analytics.getEvents();
      if (events.length) {
        statsGrid.style.display = 'grid';
        eventCountEl.textContent = events.length;
        const last = events[events.length - 1];
        lastEventEl.textContent = new Date(last.timestamp || Date.now()).toLocaleString();
      } else {
        statsGrid.style.display = 'none';
        eventCountEl.textContent = '-';
        lastEventEl.textContent = '-';
      }

      showStatus('Settings loaded successfully', 'success');
    } catch (error) {
      console.error('Load error:', error);
      showStatus('Failed to load settings', 'error');
    }
  }

  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyEl.value.trim();
    const host = hostEl.value.trim() || 'https://app.posthog.com';

    if (!apiKey) {
      showStatus('Please enter a PostHog API key', 'error');
      return;
    }

    if (!apiKey.startsWith('phc_')) {
      showStatus('Invalid API key format. Should start with "phc_"', 'error');
      return;
    }

    try {
      await window.analytics.init({
        apiKey: apiKey,
        host: host,
        enabled: enabledEl.checked
      });

      showStatus('✅ Settings saved successfully!', 'success');

      // update stats view
      const events = await window.analytics.getEvents();
      if (events.length) {
        statsGrid.style.display = 'grid';
        eventCountEl.textContent = events.length;
        lastEventEl.textContent = new Date(events[events.length - 1].timestamp || Date.now()).toLocaleString();
      } else {
        statsGrid.style.display = 'none';
      }
    } catch (error) {
      console.error('Save error:', error);
      showStatus('Failed to save settings', 'error');
    }
  });

  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    const prevText = testBtn.textContent;
    testBtn.textContent = 'Testing...';

    try {
      const success = await window.analytics.track('extension_test_event', {
        testTime: new Date().toISOString(),
        testSource: 'analytics_setup_page'
      });

      if (success) {
        showStatus('✅ Test event sent successfully! Check your PostHog dashboard in a few seconds.', 'success');
      } else {
        showStatus('Test failed. Make sure analytics is enabled and API key is correct.', 'error');
      }
    } catch (error) {
      console.error('Test error:', error);
      showStatus('Test failed: ' + (error.message || error), 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = prevText;
    }
  });

  viewDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://app.posthog.com/events' });
  });

  clearBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear all analytics data?')) return;

    try {
      await window.analytics.setApiKey('');
      await window.analytics.optOut();
      apiKeyEl.value = '';
      hostEl.value = 'https://app.posthog.com';
      enabledEl.checked = false;
      statsGrid.style.display = 'none';
      showStatus('Analytics data cleared', 'info');
    } catch (error) {
      console.error('Clear error:', error);
      showStatus('Failed to clear data', 'error');
    }
  });

  // initialize page
  await loadSettings();
})();