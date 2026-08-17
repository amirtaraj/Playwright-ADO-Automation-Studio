# Test Case: Amazon Navigation to Sell

- Title: Verify user can navigate to the Sell page on Amazon
- URL under test: https://www.amazon.in

## Objective
Navigate to Amazon India and click the 'Sell' link in the top navigation bar without relying on container IDs.

## Test Implementation Hints
- Do not use explicit `waitForSelector` for parent nav containers like `#nav-belt` or `header`.
- The 'Sell' element HTML is: `<a href="..." class="nav-a" data-csa-c-content-id="nav_cs_sell_T3">Sell</a>`.
- Use direct Playwright locators with built-in auto-waiting: `page.getByRole('link', { name: /^sell$/i, exact: true })` or `page.locator('a[data-csa-c-content-id*="sell"], a.nav-a:has-text("Sell")')`.

## Test Steps
1. Navigate to 'https://www.amazon.in' with `waitUntil: 'domcontentloaded'`.
2. Check if a 'Continue shopping' button/interstitial exists; if visible, click it.
3. Locate the 'Sell' link directly using `page.getByRole('link', { name: /^sell$/i })` or `page.locator('a:has-text("Sell")').first()`.
4. Click the 'Sell' link.
5. Assert that the URL contains `Sell` or `services.amazon` (e.g., `await expect(page).toHaveURL(/sell/i)`).