// Settings Page Logic

let selectedProvider = 'anthropic';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

// Load saved settings
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['apiKey', 'apiProvider']);
    
    if (result.apiKey) {
      document.getElementById('api-key').value = result.apiKey;
    }
    
    if (result.apiProvider) {
      selectedProvider = result.apiProvider;
      updateProviderUI();
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Provider selection
  document.querySelectorAll('.provider-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedProvider = btn.dataset.provider;
      updateProviderUI();
    });
  });
  
  // Save button
  document.getElementById('save-btn').addEventListener('click', saveSettings);
  
  // Test button
  document.getElementById('test-btn').addEventListener('click', testConnection);
  
  // Enter key to save
  document.getElementById('api-key').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveSettings();
    }
  });
}

// Update provider UI
function updateProviderUI() {
  document.querySelectorAll('.provider-btn').forEach(btn => {
    if (btn.dataset.provider === selectedProvider) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update help text
  const helpText = document.getElementById('help-text');
  if (selectedProvider === 'anthropic') {
    helpText.innerHTML = 'Get your key from <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>';
  } else {
    helpText.innerHTML = 'Get your key from <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a>';
  }
}

// Save settings
async function saveSettings() {
  const apiKey = document.getElementById('api-key').value.trim();
  
  if (!apiKey) {
    showStatus('Please enter an API key', 'error');
    return;
  }
  
  // Validate key format
  if (selectedProvider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
    showStatus('Invalid Anthropic API key format. Should start with "sk-ant-"', 'error');
    return;
  }
  
  if (selectedProvider === 'openai' && !apiKey.startsWith('sk-')) {
    showStatus('Invalid OpenAI API key format. Should start with "sk-"', 'error');
    return;
  }
  
  try {
    await chrome.storage.local.set({
      apiKey: apiKey,
      apiProvider: selectedProvider
    });
    
    showStatus('✓ Settings saved successfully!', 'success');
    
    // Close settings after 1.5 seconds
    setTimeout(() => {
      window.close();
    }, 1500);
    
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Failed to save settings. Please try again.', 'error');
  }
}

// Test API connection
async function testConnection() {
  const apiKey = document.getElementById('api-key').value.trim();
  
  if (!apiKey) {
    showStatus('Please enter an API key first', 'error');
    return;
  }
  
  const testBtn = document.getElementById('test-btn');
  testBtn.textContent = 'Testing...';
  testBtn.disabled = true;
  
  try {
    let endpoint, headers, body;
    
    if (selectedProvider === 'anthropic') {
      endpoint = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      };
      body = JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: 'Say "test successful" if you can read this.'
        }]
      });
    } else {
      endpoint = 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      body = JSON.stringify({
        model: 'gpt-4',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: 'Say "test successful" if you can read this.'
        }]
      });
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: body
    });
    
    if (response.ok) {
      showStatus('✓ Connection successful! API key is valid.', 'success');
    } else {
      const error = await response.json();
      showStatus(`✗ Connection failed: ${error.error?.message || 'Invalid API key'}`, 'error');
    }
    
  } catch (error) {
    console.error('Test error:', error);
    showStatus('✗ Connection failed. Check your API key and internet connection.', 'error');
  } finally {
    testBtn.textContent = 'Test Connection';
    testBtn.disabled = false;
  }
}

// Show status message
function showStatus(message, type) {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  
  if (type === 'error') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 5000);
  }
}