class VerifyOrangeHRMLoginWithValidCredentialsPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"], input[placeholder*="Username" i]').first();
    this.passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    this.submitButton = page.locator('button[type="submit"], button:has-text("Login")').first();
  }

  async goto() {
    await this.page.goto('https://opensource-demo.orangehrmlive.com/', { waitUntil: 'domcontentloaded' });
    await this.usernameInput.waitFor({ state: 'visible', timeout: 15000 });
  }

  async login(username, password) {
    await this.usernameInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

module.exports = { VerifyOrangeHRMLoginWithValidCredentialsPage };