# Test Case: Amazon Navigation to Sell

- Title: Verify user can navigate to the Sell page on Amazon
- URL under test: https://www.amazon.in

## Objective
Verify that a user landing on Amazon's homepage can dismiss the landing overlay/interstitial by clicking 'Continue shopping', locate and click the 'Sell' navigation link, and successfully reach the seller landing page.

## Test Steps
1. Navigate to 'https://www.amazon.in'.
2. If an interstitial or landing prompt appears, locate and click the button or link labeled 'Continue shopping' (or matching regex `/continue shopping/i`).
3. Wait for the primary navigation bar to be visible and stable.
4. Locate the 'Sell' link in the top navigation bar using `page.getByRole('link', { name: /^sell$/i })` or `page.locator('a:has-text("Sell")')`.
5. Click on the 'Sell' link.
6. Verify that the URL changes to contain `/sell` (or `bestsellers`/`services.amazon.in`) and that the seller portal header/content is visible on the page.