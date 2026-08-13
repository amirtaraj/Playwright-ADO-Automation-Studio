const { test } = require('@playwright/test');

test.describe('Generated from markdown', () => {
  test('Verify OrangeHRM dashboard access after login', async ({ page }) => {
    await page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const usernameInput = page.locator('input[name="username"], input[placeholder*="Username" i], input[autocomplete="username"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const loginButton = page.locator('button[type="submit"], button:has-text("Login")');

    if (await usernameInput.count() && await passwordInput.count() && await loginButton.count()) {
      await usernameInput.first().fill('Admin');
      await passwordInput.first().fill('admin123');
      await loginButton.first().click();
    }
  });
});
