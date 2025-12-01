// Content Script
// Runs on web pages to enable screenshot selection overlay

let overlayActive = false;
let overlay = null;
let selectionBox = null;
let startX, startY;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startScreenshotSelection') {
    startScreenshotSelection();
    sendResponse({ success: true });
  }
  
  if (request.action === 'cancelScreenshot') {
    cancelScreenshot();
    sendResponse({ success: true });
  }
});

// Start screenshot selection mode
function startScreenshotSelection() {
  if (overlayActive) return;
  
  overlayActive = true;
  
  // Create overlay
  overlay = document.createElement('div');
  overlay.id = 'mathsnap-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 999999;
    cursor: crosshair;
  `;
  
  // Create selection box
  selectionBox = document.createElement('div');
  selectionBox.id = 'mathsnap-selection';
  selectionBox.style.cssText = `
    position: fixed;
    border: 2px solid #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    display: none;
    z-index: 1000000;
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(selectionBox);
  
  // Add event listeners
  overlay.addEventListener('mousedown', handleMouseDown);
  overlay.addEventListener('mousemove', handleMouseMove);
  overlay.addEventListener('mouseup', handleMouseUp);
  overlay.addEventListener('keydown', handleKeyDown);
  
  // Instructions
  showInstructions();
}

// Cancel screenshot mode
function cancelScreenshot() {
  if (!overlayActive) return;
  
  overlayActive = false;
  
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
  
  if (selectionBox) {
    selectionBox.remove();
    selectionBox = null;
  }
  
  hideInstructions();
}

// Mouse event handlers
function handleMouseDown(e) {
  startX = e.clientX;
  startY = e.clientY;
  
  selectionBox.style.left = startX + 'px';
  selectionBox.style.top = startY + 'px';
  selectionBox.style.width = '0px';
  selectionBox.style.height = '0px';
  selectionBox.style.display = 'block';
}

function handleMouseMove(e) {
  if (!selectionBox || selectionBox.style.display === 'none') return;
  
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  
  selectionBox.style.left = left + 'px';
  selectionBox.style.top = top + 'px';
  selectionBox.style.width = width + 'px';
  selectionBox.style.height = height + 'px';
}

async function handleMouseUp(e) {
  if (!selectionBox || selectionBox.style.display === 'none') return;
  
  // Get selection coordinates
  const rect = {
    left: parseInt(selectionBox.style.left),
    top: parseInt(selectionBox.style.top),
    width: parseInt(selectionBox.style.width),
    height: parseInt(selectionBox.style.height)
  };
  
  // Minimum size check
  if (rect.width < 20 || rect.height < 20) {
    cancelScreenshot();
    return;
  }
  
  // Capture the selected area
  await captureSelection(rect);
  
  // Cleanup
  cancelScreenshot();
}

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    cancelScreenshot();
  }
}

// Capture the selected area
async function captureSelection(rect) {
  try {
    // Send message to background to capture screenshot
    const response = await chrome.runtime.sendMessage({
      action: 'captureScreenshot'
    });
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    // Crop the image to selection
    const croppedImage = await cropImage(response.dataUrl, rect);
    
    // Send to popup
    chrome.runtime.sendMessage({
      action: 'screenshotCaptured',
      dataUrl: croppedImage
    });
    
  } catch (error) {
    console.error('Capture error:', error);
    alert('Failed to capture screenshot');
  }
}

// Crop image to selection
function cropImage(dataUrl, rect) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Account for device pixel ratio
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      ctx.drawImage(
        img,
        rect.left * dpr,
        rect.top * dpr,
        rect.width * dpr,
        rect.height * dpr,
        0,
        0,
        rect.width * dpr,
        rect.height * dpr
      );
      
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Show instructions
function showInstructions() {
  const instructions = document.createElement('div');
  instructions.id = 'mathsnap-instructions';
  instructions.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    color: #1f2937;
  `;
  instructions.innerHTML = `
    <strong>📸 Select Problem Area</strong><br>
    Click and drag to select the math problem<br>
    <small style="color: #6b7280;">Press ESC to cancel</small>
  `;
  
  document.body.appendChild(instructions);
}

// Hide instructions
function hideInstructions() {
  const instructions = document.getElementById('mathsnap-instructions');
  if (instructions) {
    instructions.remove();
  }
}