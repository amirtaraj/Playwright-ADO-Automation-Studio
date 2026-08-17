const { test, expect } = require('@playwright/test');
const { NavigationOnlyCasePage } = require('./pages/navigationOnlyCasePage.js');

test.describe('Verify user can navigate to the Sell page on Amazon', () => {
  test('Verify user can navigate to the Sell page', async ({ page }) => {
    const pageObj = new NavigationOnlyCasePage(page);
    
    await pageObj.goto();
    await pageObj.clickContinueShoppingIfPresent();
    await pageObj.clickSell();

    await expect(page).toHaveURL(/sell/i);
  });
});