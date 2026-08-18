const { test, expect } = require('@playwright/test');
const VerifyOrangeHRMLoginWithValidCredentialsPage = require('./pages/verifyOrangeHRMLoginWithValidCredentialsPage.js');

const username = 'Admin';
const password = 'admin123';

test('Verify OrangeHRM login with valid credentials', async ({ page }) => {
  const loginPage = new VerifyOrangeHRMLoginWithValidCredentialsPage(page);

  await loginPage.navigateToLoginPage();
  await loginPage.enterUsername(username);
  await loginPage.enterPassword(password);
  await loginPage.clickSubmitButton();
  await loginPage.verifyDashboard();
});