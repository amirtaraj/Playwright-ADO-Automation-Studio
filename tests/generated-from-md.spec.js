const { test, expect } = require('@playwright/test');

test.describe('Generated from markdown', () => {
  test('Verify OrangeHRM dashboard access after login', async ({ page }) => {
    const usernameInput = page.locator('//input[@name="username" or @placeholder="Username" or @autocomplete="username"]');
    const passwordInput = page.locator('//input[@type="password" or @name="password"]');
    const loginButton = page.locator('//button[@type="submit" and contains(., "Login")]');

    await page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login', { waitUntil: 'domcontentloaded' });
    await expect(usernameInput).toBeVisible({ timeout: 15000 });
    await expect(passwordInput).toBeVisible({ timeout: 15000 });
    await expect(loginButton).toBeVisible({ timeout: 15000 });

    await usernameInput.fill('Admin');
    await passwordInput.fill('admin123');
    await loginButton.click();

    await page.waitForURL(/\/dashboard\//, { timeout: 20000 });
    await expect(page.locator('//button[@type="submit" and contains(., "Login")]')).toHaveCount(0);
  });
});
