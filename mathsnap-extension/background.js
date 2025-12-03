// Lightweight background worker for Stripe success callback

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg.event === "stripe_success") {
    chrome.storage.local.set({ isPremium: true }, () => {
      console.log("Premium activated in background");
      sendResponse({ ok: true });

      // Notify popup if open
      chrome.runtime.sendMessage({ event: "premium_activated" });
    });
    return true;
  }
});
