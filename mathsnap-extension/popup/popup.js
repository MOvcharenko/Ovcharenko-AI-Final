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

  document.getElementById('settings-btn')
    .addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") }));

  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.back || "home";
      showView(target);
    });
  });

  document.getElementById('screenshot-btn').addEventListener('click', handleScreenshot);
  document.getElementById('upload-btn').addEventListener('click', handleUpload);
  document.getElementById('type-btn').addEventListener('click', () => showView('type'));
  document.getElementById('solve-typed-btn').addEventListener('click', handleTypedProblem);

  document.getElementById('upgrade-btn').addEventListener('click', () => showView('upgrade'));
  document.getElementById('checkout-btn').addEventListener('click', handleCheckout);

  document.getElementById('file-input').addEventListener('change', handleFileSelect);

  document.getElementById('save-btn').addEventListener('click', handleSave);
  document.getElementById('share-btn').addEventListener('click', handleShare);
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove("active"));
  document.getElementById(name + "-view").classList.add("active");
}


// ---------------------------
// Limits
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
// Screenshot
// ---------------------------

async function handleScreenshot() {
  if (!state.isPremium) return showView("upgrade");
  if (!canSolveProblem()) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });

    const base64 = dataUrl.split(",")[1];
    await solveProblem(base64, "image");

  } catch (e) {
    console.error("Screenshot error:", e);
    alert("Screenshot failed.");
  }
}


// ---------------------------
// Upload
// ---------------------------

function handleUpload() {
  if (!state.isPremium) return showView("upgrade");
  if (!canSolveProblem()) return;

  document.getElementById('file-input').click();
}

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const base64 = await fileToBase64(file);
  await solveProblem(base64, "image");
}


// ---------------------------
// Typed Problem
// ---------------------------

async function handleTypedProblem() {
  const input = document.getElementById('problem-input');
  const text = input.value.trim();

  if (!text) return alert("Enter a problem first.");

  if (!canSolveProblem()) return;

  await solveProblem(text, "text");
  input.value = "";
}


// ---------------------------
// Solve Logic
// ---------------------------

async function solveProblem(input, type) {
  showView("solving");

  try {
    const { apiKey } = await chrome.storage.local.get(['apiKey']);
    if (!apiKey) {
      alert("Set your API key first.");
      chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
      showView("home");
      return;
    }

    const result = await APIClient.solveMath(input, type);

    state.problemsUsed += 1;
    state.currentSolution = result;
    await saveState();

    displaySolution(result);
    updateUI();
    showView("solution");

  } catch (e) {
    console.error(e);
    alert("Failed to solve problem.");
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
  alert("Saved!");
}

function handleShare() {
  if (!state.currentSolution) return;

  const text = `Problem: ${state.currentSolution.problem}\nAnswer: ${state.currentSolution.answer}`;

  navigator.clipboard.writeText(text)
    .then(() => alert("Copied!"))
    .catch(() => alert("Copy failed."));
}


// ---------------------------
// Utility
// ---------------------------

function fileToBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.readAsDataURL(file);
  });
}
