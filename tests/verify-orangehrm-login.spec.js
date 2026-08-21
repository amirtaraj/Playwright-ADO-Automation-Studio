const { test, expect } = require('@playwright/test');
const { VerifyOrangehrmLoginPage } = require('./pages/verifyOrangehrmLoginPage.js');


test('Verify OrangeHRM login with valid credentials', async ({ page }) => {
  const loginPage = new VerifyOrangehrmLoginPage(page);
  await loginPage.goto();
  await loginPage.login('Admin', 'admin123');
  await expect(page).toHaveURL('https://opensource-demo.orangehrmlive.com/web/index.php/dashboard/index');
});