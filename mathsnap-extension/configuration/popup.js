// State Management
let state = {
  problemsUsed: 0,
  maxFreeProblems: 5,
  isPremium: false,
  currentSolution: null
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  setupEventListeners();
  updateUI();
});

// Load state from chrome storage
async function loadState() {
  try {
    const result = await chrome.storage.local.get(['problemsUsed', 'isPremium', 'lastReset']);
    
    state.problemsUsed = result.problemsUsed || 0;
    state.isPremium = result.isPremium || false;
    
    // Reset counter daily
    const lastReset = result.lastReset || Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (Date.now() - lastReset > dayInMs) {
      state.problemsUsed = 0;
      await saveState({ lastReset: Date.now() });
    }
  } catch (error) {
    console.error('Error loading state:', error);
  }
}

// Save state to chrome storage
async function saveState(updates = {}) {
  try {
    const dataToSave = {
      problemsUsed: state.problemsUsed,
      isPremium: state.isPremium,
      ...updates
    };
    await chrome.storage.local.set(dataToSave);
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

// Update UI based on state
function updateUI() {
  const usageBar = document.getElementById('usage-bar');
  const upgradeBtn = document.getElementById('upgrade-btn');
  const progressFill = document.getElementById('progress-fill');
  const problemsUsedEl = document.getElementById('problems-used');
  const screenshotBtn = document.getElementById('screenshot-btn');
  const uploadBtn = document.getElementById('upload-btn');
  
  if (!state.isPremium) {
    usageBar.classList.remove('hidden');
    upgradeBtn.classList.remove('hidden');
    
    // Update usage display
    problemsUsedEl.textContent = state.problemsUsed;
    const percentage = (state.problemsUsed / state.maxFreeProblems) * 100;
    progressFill.style.width = `${percentage}%`;
    
    // Show premium badges on image features
    screenshotBtn.querySelector('.premium-badge').classList.remove('hidden');
    uploadBtn.querySelector('.premium-badge').classList.remove('hidden');
  } else {
    usageBar.classList.add('hidden');
    upgradeBtn.classList.add('hidden');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Settings button
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  });
  
  // Navigation
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.back || 'home';
      showView(target);
    });
  });
  
  // Action buttons
  document.getElementById('screenshot-btn').addEventListener('click', handleScreenshot);
  document.getElementById('upload-btn').addEventListener('click', handleUpload);
  document.getElementById('type-btn').addEventListener('click', () => showView('type'));
  document.getElementById('solve-typed-btn').addEventListener('click', handleTypedProblem);
  
  // Upgrade
  document.getElementById('upgrade-btn').addEventListener('click', () => showView('upgrade'));
  document.getElementById('checkout-btn').addEventListener('click', handleCheckout);
  
  // File input
  document.getElementById('file-input').addEventListener('change', handleFileSelect);
  
  // Solution actions
  document.getElementById('save-btn').addEventListener('click', handleSave);
  document.getElementById('share-btn').addEventListener('click', handleShare);
}

// View navigation
function showView(viewName) {
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  document.getElementById(`${viewName}-view`).classList.add('active');
}

// Check if user can solve problems
function canSolveProblem() {
  if (state.isPremium) return true;
  if (state.problemsUsed >= state.maxFreeProblems) {
    showView('upgrade');
    return false;
  }
  return true;
}

// Handle screenshot
async function handleScreenshot() {
  if (!state.isPremium) {
    showView('upgrade');
    return;
  }
  
  if (!canSolveProblem()) return;
  
  try {
    // Capture the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    
    // Convert to base64
    const base64 = dataUrl.split(',')[1];
    
    // Solve problem
    await solveProblem(base64, 'image');
  } catch (error) {
    console.error('Screenshot error:', error);
    alert('Failed to capture screenshot. Please try again.');
  }
}

// Handle upload
function handleUpload() {
  if (!state.isPremium) {
    showView('upgrade');
    return;
  }
  
  if (!canSolveProblem()) return;
  document.getElementById('file-input').click();
}

// Handle file selection
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const base64 = await fileToBase64(file);
    await solveProblem(base64, 'image');
  } catch (error) {
    console.error('File upload error:', error);
    alert('Failed to process image. Please try again.');
  }
}

// Handle typed problem
async function handleTypedProblem() {
  const input = document.getElementById('problem-input');
  const problemText = input.value.trim();
  
  if (!problemText) {
    alert('Please enter a math problem');
    return;
  }
  
  if (!canSolveProblem()) return;
  
  await solveProblem(problemText, 'text');
  input.value = '';
}

// Main solve function
async function solveProblem(input, type) {
  showView('solving');
  
  const startTime = Date.now();
  
  try {
    // Check if API key is configured
    const result = await chrome.storage.local.get(['apiKey']);
    if (!result.apiKey) {
      alert('Please configure your API key in settings first!');
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
      showView('home');
      return;
    }
    
    // Call AI API
    const solution = await APIClient.solveMath(input, type);
    
    // Track analytics
    const latency = Date.now() - startTime;
    Analytics.track('problem_solved', {
      type,
      latency,
      success: true,
      isPremium: state.isPremium
    });
    
    // Update state
    state.problemsUsed++;
    state.currentSolution = solution;
    await saveState();
    
    // Display solution
    displaySolution(solution);
    showView('solution');
    updateUI();
    
  } catch (error) {
    console.error('Solving error:', error);
    
    Analytics.track('problem_failed', {
      type,
      error: error.message,
      isPremium: state.isPremium
    });
    
    alert('Failed to solve problem. Please try again.');
    showView('home');
  }
}

// Display solution
function displaySolution(solution) {
  document.getElementById('problem-text').textContent = solution.problem;
  document.getElementById('final-answer').textContent = solution.answer;
  
  const stepsList = document.getElementById('steps-list');
  stepsList.innerHTML = '';
  
  solution.steps.forEach(step => {
    const stepEl = document.createElement('div');
    stepEl.className = 'step-item';
    stepEl.innerHTML = `
      <div class="step-number">${step.step}</div>
      <div class="step-content">
        <div class="step-description">${step.description}</div>
        <div class="step-equation">${step.equation}</div>
      </div>
    `;
    stepsList.appendChild(stepEl);
  });
}

// Handle checkout
async function handleCheckout() {
  try {
    // In production, this would call your Stripe backend
    // For now, we'll simulate the flow
    
    Analytics.track('checkout_initiated', {
      tier: 'premium'
    });
    
    // Simulate payment processing
    const confirmed = confirm(
      'This will redirect you to Stripe checkout.\n\n' +
      'In test mode, this just activates premium.\n\n' +
      'Continue?'
    );
    
    if (confirmed) {
      // Activate premium (in production, this happens after payment)
      state.isPremium = true;
      await saveState();
      
      Analytics.track('subscription_created', {
        tier: 'premium',
        price: 4.99
      });
      
      alert('Premium activated! 🎉');
      showView('home');
      updateUI();
    }
  } catch (error) {
    console.error('Checkout error:', error);
    alert('Checkout failed. Please try again.');
  }
}

// Handle save
async function handleSave() {
  if (!state.currentSolution) return;
  
  try {
    // Save to chrome storage
    const saved = await chrome.storage.local.get(['savedSolutions']) || { savedSolutions: [] };
    const solutions = saved.savedSolutions || [];
    
    solutions.push({
      ...state.currentSolution,
      timestamp: Date.now()
    });
    
    await chrome.storage.local.set({ savedSolutions: solutions });
    
    Analytics.track('solution_saved');
    
    alert('Solution saved! ✓');
  } catch (error) {
    console.error('Save error:', error);
    alert('Failed to save solution.');
  }
}

// Handle share
function handleShare() {
  if (!state.currentSolution) return;
  
  const text = `Problem: ${state.currentSolution.problem}\nAnswer: ${state.currentSolution.answer}`;
  
  navigator.clipboard.writeText(text).then(() => {
    Analytics.track('solution_shared');
    alert('Solution copied to clipboard! 📋');
  }).catch(error => {
    console.error('Share error:', error);
    alert('Failed to copy to clipboard.');
  });
}

// Helper: Convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}