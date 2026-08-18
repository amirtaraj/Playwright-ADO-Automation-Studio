class VerifyOrangeHRMLoginWithValidCredentialsPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('#txtUsername');
    this.passwordInput = page.locator('#txtPassword');
    this.loginButton = page.locator('#btnLogin');
  }

  async enterUsername(username) {
    await this.usernameInput.fill(username);
  }

  async enterPassword(password) {
    await this.passwordInput.fill(password);
  }

  async clickLoginButton() {
    await this.loginButton.click();
  }
}

module.exports = { VerifyOrangeHRMLoginWithValidCredentialsPage };