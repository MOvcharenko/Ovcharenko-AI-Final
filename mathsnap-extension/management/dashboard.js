(function () {
  'use strict';

  async function loadDashboard() {
    try {
      const summary = await window.analytics.getSummary();
      const events = await window.analytics.getEvents();

      // Update stats
      const totalProblemsEl = document.getElementById('totalProblems');
      const avgLatencyEl = document.getElementById('avgLatency');
      const successRateEl = document.getElementById('successRate');
      const conversionsEl = document.getElementById('conversions');

      if (totalProblemsEl) totalProblemsEl.textContent = summary.problemsSolved ?? 0;
      if (avgLatencyEl) avgLatencyEl.textContent = summary.averageLatency || '-';
      if (successRateEl) successRateEl.textContent = (summary.successRate !== undefined) ? (summary.successRate + '%') : '-';
      if (conversionsEl) conversionsEl.textContent = summary.subscriptionsCreated ?? 0;

      // Update event list
      const eventList = document.getElementById('eventList');
      if (!eventList) return;
      eventList.innerHTML = '';

      if (!events || events.length === 0) {
        eventList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <p>No events yet. Start using the extension to see analytics.</p>
          </div>
        `;
        return;
      }

      // Show last 20 events
      const recentEvents = events.slice(-20).reverse();

      recentEvents.forEach(event => {
        const li = document.createElement('li');
        li.className = 'event-item';

        const date = new Date(event.timestamp || Date.now());
        const timeStr = date.toLocaleTimeString() + ', ' + date.toLocaleDateString();

        // build content safely using DOM APIs
        const nameSpan = document.createElement('span');
        nameSpan.className = 'event-name';
        nameSpan.textContent = event.name || '(unknown)';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'event-time';
        timeSpan.textContent = timeStr;

        li.appendChild(nameSpan);
        li.appendChild(timeSpan);

        eventList.appendChild(li);
      });

    } catch (error) {
      console.error('Dashboard error:', error);
    }
  }

  function init() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadDashboard);

    // Load immediately
    loadDashboard();

    // Auto-refresh every 10 seconds
    setInterval(loadDashboard, 10000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();