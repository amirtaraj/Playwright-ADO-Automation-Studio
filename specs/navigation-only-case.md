# Test Case: Amazon Navigation to Sell

- Title: Verify user can navigate to the Sell page on Amazon
- URL under test: https://www.amazon.in

## Explicit Element Selectors
- Interstitial button: `page.locator('button.a-button-text:has-text("Continue shopping"), button[alt="Continue shopping"]')`
- Sell link: `page.locator('a[data-csa-c-content-id*="sell"], a.nav-a:has-text("Sell")').first()`

## Implementation Details
- `clickContinueShoppingIfPresent()` method must use a 3000ms timeout wrapped in a try/catch block so the test continues immediately if no interstitial appears.
- `clickSell()` must click the Sell link.

## Test Steps
1. Navigate to 'https://www.amazon.in'.
2. Handle optional 'Continue shopping' button if present.
3. Click 'Sell' link.
4. Verify that the URL contains '/sell' or 'bestsellers'.