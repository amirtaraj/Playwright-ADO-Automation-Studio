const { test } = require('@playwright/test');
const OrangeHRMLoginPage = require('./pages/orangehrmLoginPage');

test.describe('Generated from markdown', () => {
  test('Verify OrangeHRM dashboard access after login', async ({ page }) => {
    const loginPage = new OrangeHRMLoginPage(page);

    await loginPage.open('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');
    await loginPage.expectLoginFormVisible();
    await loginPage.loginAs('Admin', 'admin123');

    await page.waitForURL(/\/dashboard\//, { timeout: 20000 });
    await loginPage.expectLoginButtonMissing();
  });
});
