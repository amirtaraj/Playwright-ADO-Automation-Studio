const { test, expect } = require('@playwright/test');
const { VerifyOrangeHRMLoginWithValidCredentialsPage } = require('./pages/verifyOrangeHRMLoginWithValidCredentialsPage.js');

test.describe('Verify OrangeHRM login with valid credentials', () => {
  test('Verify OrangeHRM login with valid credentials', async ({ page }) => {
    const pageObj = new VerifyOrangeHRMLoginWithValidCredentialsPage(page);
    await pageObj.goto();
    await pageObj.login('Admin', 'admin123');
    await expect(page).toHaveURL(/dashboard/i, { timeout: 15000 });
  });
});