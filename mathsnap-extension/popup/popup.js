// ---------------------------
//   MathSnap Popup.js (Fixed)
// ---------------------------

let state = {
  problemsUsed: 0,
  maxFreeProblems: 5,
  isPremium: false,
  currentSolution: null
};

document.addEventListener('DOMContentLoaded', async () => {
  
  // 🔥 Restore premium automatically if user came from Stripe
  await StripePayment.verifyRestoreFromSuccessURL();

  // Load extension state
  await loadState();
  setupEventListeners();
  updateUI();
});


// ---------------------------
// View Management
// ---------------------------

function showView(viewId) {
  // Hide all views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  
  // Show the requested view
  const targetView = document.getElementById(`${viewId}-view`);
  if (targetView) {
    targetView.classList.add('active');
  } else {
    console.error(`View not found: ${viewId}-view`);
    // Fallback to home
    document.getElementById('home-view').classList.add('active');
  }
}


// ---------------------------
// Load + Save State
// ---------------------------

async function loadState() {
  try {
    const data = await chrome.storage.local.get([
      'problemsUsed',
      'isPremium',
      'lastReset'
    ]);

    state.problemsUsed = data.problemsUsed || 0;
    state.isPremium = data.isPremium || false;

    const lastReset = data.lastReset || Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (Date.now() - lastReset > oneDay) {
      state.problemsUsed = 0;
      await saveState({ lastReset: Date.now() });
    }
  } catch (err) {
    console.error("Error loading state:", err);
  }
}

async function saveState(extra = {}) {
  try {
    await chrome.storage.local.set({
      problemsUsed: state.problemsUsed,
      isPremium: state.isPremium,
      ...extra
    });
  } catch (err) {
    console.error("Error saving:", err);
  }
}


// ---------------------------
// UI Update
// ---------------------------

function updateUI() {
  const usageBar = document.getElementById('usage-bar');
  const upgradeBtn = document.getElementById('upgrade-btn');
  const progressFill = document.getElementById('progress-fill');
  const usedEl = document.getElementById('problems-used');
  const maxEl = document.getElementById('max-problems');
  const screenshotBtn = document.getElementById('screenshot-btn');
  const uploadBtn = document.getElementById('upload-btn');

  maxEl.textContent = state.maxFreeProblems;

  if (!state.isPremium) {
    usageBar.classList.remove("hidden");
    upgradeBtn.classList.remove("hidden"); // Show upgrade button when NOT premium

    usedEl.textContent = state.problemsUsed;
    progressFill.style.width = ((state.problemsUsed / state.maxFreeProblems) * 100) + "%";

    screenshotBtn.querySelector('.premium-badge').classList.remove("hidden");
    uploadBtn.querySelector('.premium-badge').classList.remove("hidden");

  } else {
    usageBar.classList.add("hidden");
    upgradeBtn.classList.add("hidden"); // Hide upgrade button when premium

    screenshotBtn.querySelector('.premium-badge').classList.add("hidden");
    uploadBtn.querySelector('.premium-badge').classList.add("hidden");
  }
}


// ---------------------------
// Navigation
// ---------------------------

function setupEventListeners() {
  // Settings & Analytics buttons
  document.getElementById('settings-btn')
    .addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
      if (window.analytics) analytics.track('settings_opened');
    });

  document.getElementById('analytics-btn')
    .addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("analytics.html") });
      if (window.analytics) analytics.track('analytics_opened');
    });

  // View navigation
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.back || "home";
      showView(target);
    });
  });

  // Screenshot button - fixed logic
  document.getElementById('screenshot-btn').addEventListener('click', () => {
    if (window.analytics) analytics.track('screenshot_clicked', { isPremium: state.isPremium });
    
    // Check if free user reached limit
    if (!state.isPremium && state.problemsUsed >= state.maxFreeProblems) {
      showView("upgrade");
      return;
    }
    
    // If free user with available problems, allow screenshot
    handleScreenshot();
  });
  
  // Upload button - fixed logic
  document.getElementById('upload-btn').addEventListener('click', () => {
    if (window.analytics) analytics.track('upload_clicked', { isPremium: state.isPremium });
    
    // Check if free user reached limit
    if (!state.isPremium && state.problemsUsed >= state.maxFreeProblems) {
      showView("upgrade");
      return;
    }
    
    // If free user with available problems, allow upload
    handleUpload();
  });
  
  // Type button - fixed
  document.getElementById('type-btn').addEventListener('click', () => {
    if (window.analytics) analytics.track('type_clicked');
    showView('type');
  });
  
  // Solve typed problem button
  document.getElementById('solve-typed-btn').addEventListener('click', () => {
    if (window.analytics) analytics.track('solve_clicked', { method: 'typed' });
    handleTypedProblem();
  });

  // Upgrade button
  document.getElementById('upgrade-btn').addEventListener('click', () => {
    if (window.analytics) analytics.track('upgrade_clicked');
    showView('upgrade');
  });
  
  // Checkout button
  document.getElementById('checkout-btn').addEventListener('click', () => {
    if (window.analytics) analytics.track('checkout_initiated');
    handleCheckout();
  });

  // File input
  document.getElementById('file-input').addEventListener('change', handleFileSelect);

  // Solution actions
  document.getElementById('save-btn').addEventListener('click', () => {
    if (window.analytics) analytics.track('solution_saved');
    handleSave();
  });
  
  document.getElementById('share-btn').addEventListener('click', () => {
    if (window.analytics) analytics.track('solution_shared');
    handleShare();
  });
}


// ---------------------------
// Limits - simplified
// ---------------------------

function canSolveProblem() {
  if (state.isPremium) return true;

  if (state.problemsUsed >= state.maxFreeProblems) {
    showView("upgrade");
    return false;
  }
  return true;
}


// ---------------------------
// Screenshot - fixed
// ---------------------------

async function handleScreenshot() {
  // Check if user can solve problems (limits)
  if (!canSolveProblem()) return;

  try {
    // Take screenshot using chrome.tabs API
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
    
    // Convert to base64
    const base64 = dataUrl.split(",")[1];
    await solveProblem(base64, "image");

  } catch (e) {
    console.error("Screenshot error:", e);
    alert("Screenshot failed: " + e.message);
  }
}


// ---------------------------
// Upload - fixed
// ---------------------------

function handleUpload() {
  // Check if user can solve problems (limits)
  if (!canSolveProblem()) return;

  document.getElementById('file-input').click();
}

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const base64 = await fileToBase64(file);
    await solveProblem(base64, "image");
  } catch (error) {
    console.error("File upload error:", error);
    alert("Failed to process image: " + error.message);
  }
}


// ---------------------------
// Typed Problem - fixed
// ---------------------------

async function handleTypedProblem() {
  const input = document.getElementById('problem-input');
  const text = input.value.trim();

  if (!text) {
    alert("Enter a math problem first.");
    return;
  }

  if (!canSolveProblem()) return;

  try {
    await solveProblem(text, "text");
    input.value = "";
  } catch (error) {
    console.error("Typed problem error:", error);
    alert("Failed to solve problem: " + error.message);
  }
}


// ---------------------------
// Solve Logic
// ---------------------------

async function solveProblem(input, type) {
  showView("solving");

  const startTime = Date.now();

  try {
    // Get API key from storage
    const { apiKey } = await chrome.storage.local.get(['apiKey']);
    if (!apiKey) {
      alert("Set your API key first in Settings.");
      chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
      showView("home");
      return;
    }

    // Call API client
    const result = await APIClient.solveMath(input, type);

    // Track successful solve
    const latency = Date.now() - startTime;
    if (window.analytics) {
      analytics.track('problem_solved', {
        type: type,
        latency: latency,
        success: true,
        isPremium: state.isPremium
      });
    }

    // Update state
    state.problemsUsed += 1;
    state.currentSolution = result;
    await saveState();

    // Display results
    displaySolution(result);
    updateUI();
    showView("solution");

  } catch (e) {
    console.error("Solve error:", e);
    
    // Track failed solve
    if (window.analytics) {
      analytics.track('problem_failed', {
        type: type,
        error: e.message,
        isPremium: state.isPremium
      });
    }
    
    alert("Failed to solve problem: " + e.message);
    showView("home");
  }
}


// ---------------------------
// Display Solution
// ---------------------------

function displaySolution(solution) {
  document.getElementById('problem-text').textContent = solution.problem;
  document.getElementById('final-answer').textContent = solution.answer;

  const list = document.getElementById('steps-list');
  list.innerHTML = "";

  (solution.steps || []).forEach((step, i) => {
    const div = document.createElement("div");
    div.className = "step-item";
    div.innerHTML = `
      <div class="step-number">${i + 1}</div>
      <div class="step-content">
        <div class="step-description">${step.description}</div>
        <div class="step-equation">${step.equation || ""}</div>
      </div>`;
    list.appendChild(div);
  });
}


// ---------------------------
// Checkout
// ---------------------------

async function handleCheckout() {
  try {
    await StripePayment.openCheckout();
  } catch (e) {
    alert("Checkout failed: " + e.message);
  }
}


// ---------------------------
// Save + Share
// ---------------------------

async function handleSave() {
  if (!state.currentSolution) return;

  const saved = await chrome.storage.local.get(['savedSolutions']);
  const list = saved.savedSolutions || [];

  list.push({ ...state.currentSolution, timestamp: Date.now() });

  await chrome.storage.local.set({ savedSolutions: list });
  alert("Solution saved!");
}

function handleShare() {
  if (!state.currentSolution) return;

  const text = `Problem: ${state.currentSolution.problem}\nAnswer: ${state.currentSolution.answer}`;

  navigator.clipboard.writeText(text)
    .then(() => alert("Copied to clipboard!"))
    .catch(() => alert("Failed to copy to clipboard."));
}


// ---------------------------
// Utility
// ---------------------------

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Track popup open
(async () => {
  try {
    if (window.analytics) {
      await analytics.track('popup_open', { ts: new Date().toISOString() });
    }
  } catch (e) {
    console.error("Analytics track error:", e);
  }
})();