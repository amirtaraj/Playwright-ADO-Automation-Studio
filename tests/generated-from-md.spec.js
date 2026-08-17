const { test, expect } = require('@playwright/test');

test('Verify user can navigate to the Sell page on Amazon', async ({ page }) => {
  // Step 1: Navigate to 'https://www.amazon.in' with waitUntil: 'domcontentloaded'
  await page.goto('https://www.amazon.in', { waitUntil: 'domcontentloaded' });

  // Step 2: Check if a 'Continue shopping' button/interstitial exists; if visible, click it
  const continueShoppingButton = page.locator('button[aria-label="Continue shopping"]');
  if (await continueShoppingButton.isVisible()) {
    await continueShoppingButton.click();
  }

  // Step 3: Locate the 'Sell' link directly using page.getByRole('link', { name: /^sell$/i })
  const sellLink = page.getByRole('link', { name: /^sell$/i });
  await sellLink.click();

  // Step 4: Assert that the URL contains 'Sell' or 'services.amazon'
  await expect(page).toHaveURL(/sell/i);
});