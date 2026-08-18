class VerifyOrangeHRMLoginWithValidCredentialsPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('#txtUsername');
    this.passwordInput = page.locator('#txtPassword');
    this.loginButton = page.locator('#btnLogin');
  }
}

module.exports = { VerifyOrangeHRMLoginWithValidCredentialsPage };