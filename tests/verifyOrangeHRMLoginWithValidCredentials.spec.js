const { test, expect } = require('@playwright/test');
const VerifyOrangeHRMLoginWithValidCredentialsPage = require('./pages/verifyOrangeHRMLoginWithValidCredentialsPage.js');


test('Verify OrangeHRM login with valid credentials', async ({ page }) => {
  const pageObj = new VerifyOrangeHRMLoginWithValidCredentialsPage(page);

  await pageObj.enterUsername('Admin');
  await pageObj.enterPassword('admin123');
  await pageObj.clickLoginButton();

  await expect(page).toHaveTitle('OrangeHRM');
});