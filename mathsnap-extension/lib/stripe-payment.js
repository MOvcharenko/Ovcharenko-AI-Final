// Stripe Payment Link Integration for MathSnap AI
// Uses Stripe Payment Links - no external scripts, no CSP issues!

const StripePayment = {
  // Your Stripe Payment Link (get from Stripe Dashboard)
  PAYMENT_LINK: 'https://buy.stripe.com/test_eVqbJ1gK4aLbcfz8u797G00', // Replace with your link
  
  // Success/cancel URLs (these are query params Stripe will redirect to)
  SUCCESS_URL: chrome.runtime.getURL('success.html'),
  CANCEL_URL: chrome.runtime.getURL('popup/popup.html'),
  
  /**
   * Open Stripe checkout
   */
  async openCheckout() {
    try {
      console.log('💳 Opening Stripe Payment Link...');
      
      // Get or create customer ID
      const customerId = await this.getCustomerId();
      
      // Build checkout URL with customer info
      const checkoutUrl = this.buildCheckoutUrl(customerId);
      
      // Open in new tab
      const checkoutTab = chrome.tabs.create({
        url: checkoutUrl,
        active: true
      });
      
      if (!checkoutTab) {
        throw new Error('Failed to open checkout tab. Please allow popups.');
      }
      
      console.log('✅ Checkout opened in new tab');
      
      // Start monitoring for successful payment
      this.startPaymentMonitoring();
      
      return { success: true };
      
    } catch (error) {
      console.error('Stripe checkout error:', error);
      throw error;
    }
  },
  
  /**
   * Build checkout URL with parameters
   */
  buildCheckoutUrl(customerId) {
    const url = new URL(this.PAYMENT_LINK);
    
    // Add prefilled customer info if available
    url.searchParams.append('prefilled_email', '');
    url.searchParams.append('client_reference_id', customerId);
    
    return url.toString();
  },
  
  /**
   * Get or create customer ID
   */
  async getCustomerId() {
    const result = await chrome.storage.local.get(['customerId']);
    
    if (result.customerId) {
      return result.customerId;
    }
    
    // Generate new customer ID
    const customerId = 'cus_' + Math.random().toString(36).substr(2, 16);
    await chrome.storage.local.set({ customerId });
    
    return customerId;
  },
  
  /**
   * Start monitoring for successful payment
   * Checks if user returned to success page
   */
  startPaymentMonitoring() {
    console.log('👀 Starting payment monitoring...');
    
    // Listen for tab updates (when user returns from Stripe)
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
    
    // Also check periodically
    const checkInterval = setInterval(async () => {
      const result = await chrome.storage.local.get(['paymentSuccess']);
      
      if (result.paymentSuccess) {
        clearInterval(checkInterval);
        await this.handleSuccessfulPayment();
      }
    }, 2000);
    
    // Stop checking after 10 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
      chrome.tabs.onUpdated.removeListener(this.handleTabUpdate);
    }, 10 * 60 * 1000);
  },
  
  /**
   * Handle tab updates (detect return from Stripe)
   */
  async handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.url && changeInfo.url.includes('success')) {
      console.log('✅ Detected return to success page');
      await this.handleSuccessfulPayment();
    }
  },
  
  /**
   * Handle successful payment
   */
  async handleSuccessfulPayment() {
    try {
      console.log('🎉 Processing successful payment...');
      
      // Activate premium
      await chrome.storage.local.set({
        isPremium: true,
        subscriptionDate: new Date().toISOString(),
        paymentProvider: 'stripe',
        paymentSuccess: false // Reset flag
      });
      
      console.log('✅ Premium activated!');
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../assets/icon-128.png',
        title: 'MathSnap AI Premium',
        message: 'Payment successful! Premium features unlocked. 🎉'
      });
      
    } catch (error) {
      console.error('Failed to activate premium:', error);
    }
  },
  
  /**
   * Verify subscription status
   * In production, this would call Stripe API
   */
  async verifySubscription() {
    const result = await chrome.storage.local.get(['isPremium', 'subscriptionDate']);
    
    return {
      isPremium: result.isPremium || false,
      subscriptionDate: result.subscriptionDate
    };
  },
  
  /**
   * Cancel subscription (for testing)
   */
  async cancelSubscription() {
    await chrome.storage.local.set({
      isPremium: false,
      subscriptionDate: null
    });
    
    console.log('❌ Subscription canceled');
  }
};

// Export
window.StripePayment = StripePayment;