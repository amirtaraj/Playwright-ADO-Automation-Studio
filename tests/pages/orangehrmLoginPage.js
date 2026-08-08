const { expect } = require('@playwright/test');
const { healSelector } = require('../../lib/aiHelper');

class OrangeHRMLoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('//input[@name="username"]');
    this.passwordInput = page.locator('//input[@type="password"]');
    this.loginButton = page.locator('//button[@type="submit" and contains(., "Login")]');
  }

  async open(url = 'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login') {
    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
    });
  }

  async expectLoginFormVisible() {
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.loginButton).toBeVisible();
  }

  async clickWithHealing(selector, actionName) {
    try {
      await this.page.locator(selector).click({ timeout: 5000 });
    } catch (error) {
      const healedSelector = await healSelector(selector, await this.page.content(), actionName);
      if (healedSelector?.newSelector) {
        await this.page.locator(healedSelector.newSelector).click({ timeout: 5000 });
      } else {
        throw error;
      }
    }
  }

  async loginAs(username = 'Admin', password = 'admin123') {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.clickWithHealing('//button[@type="submit" and contains(., "Login")]', 'click login button');
  }

  async expectLoginButtonMissing() {
    await expect(this.loginButton).toHaveCount(0);
  }
}

module.exports = OrangeHRMLoginPage;
