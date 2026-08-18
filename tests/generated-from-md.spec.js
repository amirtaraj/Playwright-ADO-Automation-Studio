const { test, expect } = require('@playwright/test');
const VerifyOrangeHRMLoginWithValidCredentialsPage = require('./pages/verifyOrangeHRMLoginWithValidCredentialsPage.js');

const USERNAME = process.env.ORANGEHRM_USERNAME || 'Admin';
const PASSWORD = process.env.ORANGEHRM_PASSWORD || 'admin123';

test.describe('Verify OrangeHRM login with valid credentials', () => {
  let page;
  let verifyOrangeHRMLoginWithValidCredentialsPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    verifyOrangeHRMLoginWithValidCredentialsPage = new VerifyOrangeHRMLoginWithValidCredentialsPage(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should successfully log in with valid credentials', async () => {
    await verifyOrangeHRMLoginWithValidCredentialsPage.goto();
    await verifyOrangeHRMLoginWithValidCredentialsPage.login(USERNAME, PASSWORD);

    // Add assertions here based on the expected results
    // For example:
    // await expect(page.locator('#dashboard')).toBeVisible();
  });
});
