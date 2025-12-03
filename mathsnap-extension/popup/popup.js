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
    const result = await chrome.storage.local.get(['apiKey', 'apiProvider']);
    console.log('🔍 Storage check:', {
      hasKey: !!result.apiKey,
      keyPrefix: result.apiKey ? result.apiKey.substring(0, 10) : 'NONE',
      provider: result.apiProvider
    });
    
    if (!result.apiKey) {
      alert('Please configure your API key in settings first!');
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
      showView('home');
      return;
    }
    
    console.log('📝 Solving problem:', { input, type });
    
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
  console.log('🎨 Displaying solution:', solution);
  
  // Display problem
  const problemEl = document.getElementById('problem-text');
  problemEl.textContent = solution.problem || 'Math problem';
  
  // Display final answer
  const answerEl = document.getElementById('final-answer');
  answerEl.textContent = solution.answer || 'See steps above';
  
  // Display steps
  const stepsList = document.getElementById('steps-list');
  stepsList.innerHTML = '';
  
  if (!solution.steps || solution.steps.length === 0) {
    console.warn('⚠️ No steps to display');
    const emptyStep = document.createElement('div');
    emptyStep.className = 'step-item';
    emptyStep.innerHTML = `
      <div class="step-number">1</div>
      <div class="step-content">
        <div class="step-description">Solution provided</div>
        <div class="step-equation">Check the final answer below</div>
      </div>
    `;
    stepsList.appendChild(emptyStep);
    return;
  }
  
  solution.steps.forEach(step => {
    console.log('Adding step:', step);
    
    const stepEl = document.createElement('div');
    stepEl.className = 'step-item';
    
    const stepNumber = step.step || stepsList.children.length + 1;
    const description = step.description || 'Step';
    const equation = step.equation || step.description || '';
    
    stepEl.innerHTML = `
      <div class="step-number">${stepNumber}</div>
      <div class="step-content">
        <div class="step-description">${description}</div>
        <div class="step-equation">${equation}</div>
      </div>
    `;
    stepsList.appendChild(stepEl);
  });
}

// Handle checkout
async function handleCheckout() {
  try {
    Analytics.track('checkout_initiated', {
      tier: 'premium'
    });
    
    // Open Stripe Payment Link
    await StripePayment.openCheckout();
    
    Analytics.track('stripe_checkout_opened');
    
  } catch (error) {
    console.error('Checkout error:', error);
    alert('Checkout failed. Please try again.\n\nError: ' + error.message);
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