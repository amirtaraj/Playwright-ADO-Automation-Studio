const { test, expect } = require('@playwright/test');

test('Verify user can navigate to the Sell page on Amazon', async ({ page }) => {
  // Step 1: Navigate to 'https://www.amazon.in'
  await page.goto('https://www.amazon.in');

  // Step 2: If an interstitial or landing prompt appears, locate and click the button or link labeled 'Continue shopping'
  await page.click('button:has-text("Continue shopping")', { timeout: 5000, noWaitAfter: true });

  // Step 3: Wait for the primary navigation bar to be visible and stable
  await page.waitForSelector('nav#nav-belt', { state: 'visible' });

  // Step 4: Locate the 'Sell' link in the top navigation bar
  const sellLink = page.getByRole('link', { name: /^sell$/i });

  // Step 5: Click on the 'Sell' link
  await sellLink.click();

  // Step 6: Verify that the URL changes to contain '/sell' and that the seller portal header/content is visible on the page
  await expect(page).toHaveURL(/\/sell/);
  await expect(page.locator('h1:has-text("Sell on Amazon")')).toBeVisible();
});