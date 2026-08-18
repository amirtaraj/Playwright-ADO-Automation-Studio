const { test, expect } = require('@playwright/test');
const { VerifyOrangeHRMLoginWithValidCredentialsPage } = require('./pages/verifyOrangeHRMLoginWithValidCredentialsPage.js');


test('Verify OrangeHRM login with valid credentials', async ({ page }) => {
  const pageObj = new VerifyOrangeHRMLoginWithValidCredentialsPage(page);

  await pageObj.usernameInput.fill('Admin');
  await pageObj.passwordInput.fill('admin123');
  await pageObj.loginButton.click();

  // Add assertions here if needed
});