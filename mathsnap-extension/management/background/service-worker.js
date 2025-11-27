// Background Service Worker
// Handles long-running tasks and background operations

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('MathSnap AI installed!');
    
    // Initialize storage
    chrome.storage.local.set({
      problemsUsed: 0,
      isPremium: false,
      lastReset: Date.now(),
      analytics: []
    });
    
    // Open welcome page (optional)
    // chrome.tabs.create({ url: 'welcome.html' });
  } else if (details.reason === 'update') {
    console.log('MathSnap AI updated!');
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreenshot') {
    handleScreenshotCapture(sender.tab.id).then(sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'getAnalytics') {
    getAnalyticsSummary().then(sendResponse);
    return true;
  }
  
  if (request.action === 'checkSubscription') {
    checkSubscriptionStatus().then(sendResponse);
    return true;
  }
});

// Capture screenshot of active tab
async function handleScreenshotCapture(tabId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    return { success: true, dataUrl };
  } catch (error) {
    console.error('Screenshot error:', error);
    return { success: false, error: error.message };
  }
}

// Get analytics summary
async function getAnalyticsSummary() {
  try {
    const result = await chrome.storage.local.get(['analytics']);
    const events = result.analytics || [];
    
    // Calculate metrics
    const summary = {
      totalProblems: events.filter(e => e.name === 'problem_solved').length,
      totalErrors: events.filter(e => e.name === 'problem_failed').length,
      avgLatency: calculateAverageLatency(events),
      successRate: calculateSuccessRate(events),
      problemsByType: getProblemsByType(events),
      usageByDay: getUsageByDay(events)
    };
    
    return { success: true, summary };
  } catch (error) {
    console.error('Analytics error:', error);
    return { success: false, error: error.message };
  }
}

// Check subscription status with backend
async function checkSubscriptionStatus() {
  try {
    const result = await chrome.storage.local.get(['isPremium', 'subscriptionId']);
    
    // In production, verify with Stripe
    // const response = await fetch('YOUR_BACKEND/verify-subscription', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ subscriptionId: result.subscriptionId })
    // });
    
    return {
      success: true,
      isPremium: result.isPremium || false
    };
  } catch (error) {
    console.error('Subscription check error:', error);
    return { success: false, error: error.message };
  }
}

// Helper: Calculate average latency
function calculateAverageLatency(events) {
  const solvedEvents = events.filter(e => 
    e.name === 'problem_solved' && e.properties?.latency
  );
  
  if (solvedEvents.length === 0) return 0;
  
  const total = solvedEvents.reduce((sum, e) => sum + e.properties.latency, 0);
  return Math.round(total / solvedEvents.length);
}

// Helper: Calculate success rate
function calculateSuccessRate(events) {
  const solved = events.filter(e => e.name === 'problem_solved').length;
  const failed = events.filter(e => e.name === 'problem_failed').length;
  const total = solved + failed;
  
  if (total === 0) return 100;
  
  return Math.round((solved / total) * 100);
}

// Helper: Get problems by type
function getProblemsByType(events) {
  const types = {};
  
  events
    .filter(e => e.name === 'problem_solved')
    .forEach(e => {
      const type = e.properties?.type || 'unknown';
      types[type] = (types[type] || 0) + 1;
    });
  
  return types;
}

// Helper: Get usage by day
function getUsageByDay(events) {
  const days = {};
  
  events.forEach(e => {
    const date = new Date(e.properties.timestamp).toLocaleDateString();
    days[date] = (days[date] || 0) + 1;
  });
  
  return days;
}

// Reset daily usage counter at midnight
function scheduleDailyReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const timeUntilMidnight = tomorrow - now;
  
  setTimeout(async () => {
    await chrome.storage.local.set({
      problemsUsed: 0,
      lastReset: Date.now()
    });
    
    console.log('Daily usage counter reset');
    scheduleDailyReset(); // Schedule next reset
  }, timeUntilMidnight);
}

// Start daily reset scheduler
scheduleDailyReset();

// Listen for alarm (alternative to setTimeout)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyReset') {
    chrome.storage.local.set({
      problemsUsed: 0,
      lastReset: Date.now()
    });
  }
});

// Create daily reset alarm
chrome.alarms.create('dailyReset', {
  when: getTomorrowMidnight(),
  periodInMinutes: 1440 // 24 hours
});

function getTomorrowMidnight() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}