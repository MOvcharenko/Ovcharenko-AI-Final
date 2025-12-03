// stripe-payment.js — Stripe Payment Link version (TEST MODE ok!)

const StripePayment = {
  PAYMENT_LINK: "https://buy.stripe.com/test_eVqbJ1gK4aLbcfz8u797G00",  // You already have this
  
  SUCCESS_URL: chrome.runtime.getURL("success.html"),
  CANCEL_URL: chrome.runtime.getURL("popup/popup.html"),

  async openCheckout() {
    try {
      console.log("Opening checkout…");

      const customerId = await this.getCustomerId();
      const url = this.buildCheckoutUrl(customerId);

      chrome.tabs.create({ url, active: true });

      // We set a flag so success.html knows this is from Stripe
      await chrome.storage.local.set({ awaitingStripeReturn: true });

      return { success: true };
    } catch (err) {
      console.error("Stripe open error:", err);
      throw err;
    }
  },

  buildCheckoutUrl(customerId) {
    const url = new URL(this.PAYMENT_LINK);

    url.searchParams.append("client_reference_id", customerId);
    url.searchParams.append("success_url", this.SUCCESS_URL);
    url.searchParams.append("cancel_url", this.CANCEL_URL);

    return url.toString();
  },

  async getCustomerId() {
    const saved = await chrome.storage.local.get(["customerId"]);
    if (saved.customerId) return saved.customerId;

    const newId = "cus_" + Math.random().toString(36).substring(2, 16);
    await chrome.storage.local.set({ customerId: newId });
    return newId;
  },

  // Called by success.html
  async markPaymentComplete() {
    console.log("Marking payment complete…");

    await chrome.storage.local.set({
      isPremium: true,
      subscriptionDate: new Date().toISOString(),
      paymentProvider: "stripe",
      awaitingStripeReturn: false
    });

    chrome.notifications.create({
      type: "basic",
      iconUrl: "assets/icon-128.png",
      title: "Premium Activated!",
      message: "Your MathSnap AI Premium is now active 🎉"
    });

    return true;
  },

  // Add this new method
  async verifyRestoreFromSuccessURL() {
    const result = await chrome.storage.local.get(["awaitingStripeReturn"]);
    if (result.awaitingStripeReturn) {
      console.log("Restoring premium from Stripe return…");
      await this.markPaymentComplete();
    }
  },

  async verifySubscription() {
    const result = await chrome.storage.local.get(["isPremium", "subscriptionDate"]);
    return {
      isPremium: result.isPremium || false,
      subscriptionDate: result.subscriptionDate || null
    };
  }
};

window.StripePayment = StripePayment;
