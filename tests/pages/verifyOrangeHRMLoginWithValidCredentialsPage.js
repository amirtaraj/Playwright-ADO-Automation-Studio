class VerifyOrangeHRMLoginWithValidCredentialsPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('#txtUsername');
    this.passwordInput = page.locator('#txtPassword');
    this.submitButton = page.locator('#btnLogin');
    this.dashboardHeader = page.locator('#branding');
  }

  async navigateToLoginPage() {
    await this.page.goto('https://opensource-demo.orangehrmlive.com/');
  }

  async enterUsername(username) {
    await this.usernameInput.fill(username);
  }

  async enterPassword(password) {
    await this.passwordInput.fill(password);
  }

  async clickSubmitButton() {
    await this.submitButton.click();
  }

  async verifyDashboard() {
    await expect(this.dashboardHeader).toBeVisible();
  }
}

module.exports = { VerifyOrangeHRMLoginWithValidCredentialsPage };