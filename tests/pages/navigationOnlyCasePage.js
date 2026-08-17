class NavigationOnlyCasePage {
  constructor(page) {
    this.page = page;
    this.continueShoppingBtn = page.locator('button.a-button-text:has-text("Continue shopping"), button[alt="Continue shopping"]').first();
    this.sellLink = page.locator('a[data-csa-c-content-id*="sell"], a.nav-a:has-text("Sell")').first();
  }

  async goto() {
    await this.page.goto('https://www.amazon.in', { waitUntil: 'domcontentloaded' });
  }

  async clickContinueShoppingIfPresent() {
    try {
      if (await this.continueShoppingBtn.isVisible({ timeout: 3000 })) {
        await this.continueShoppingBtn.click();
        await this.page.waitForLoadState('domcontentloaded');
      }
    } catch {
      // Proceed if no interstitial prompt appears
    }
  }

  async clickSell() {
    await this.sellLink.waitFor({ state: 'visible', timeout: 10000 });
    await this.sellLink.click();
  }
}

module.exports = { NavigationOnlyCasePage };