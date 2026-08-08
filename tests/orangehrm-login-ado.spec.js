const { test } = require('@playwright/test');
const OrangeHRMLoginPage = require('./pages/orangehrmLoginPage');

test.describe('ADO / Prompt-based OrangeHRM login test', () => {
  test('Verify OrangeHRM login with valid credentials', async ({ page }) => {
    const loginPage = new OrangeHRMLoginPage(page);

    await loginPage.open();
    await loginPage.expectLoginFormVisible();
    await loginPage.loginAs('Admin', 'admin123');

    await page.waitForURL(/\/dashboard\//, { timeout: 20000 });
    await loginPage.expectLoginButtonMissing();
  });
});
