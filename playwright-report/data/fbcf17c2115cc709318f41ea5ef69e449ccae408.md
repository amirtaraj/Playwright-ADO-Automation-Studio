# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: generated-from-md.spec.js >> Verify OrangeHRM login with valid credentials >> Verify user can navigate to the Sell page
- Location: tests\generated-from-md.spec.js:5:3

# Error details

```
TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('a[data-csa-c-content-id*="sell"], a.nav-a:has-text("Sell")').first() to be visible

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e6]:
    - img "company-branding" [ref=e8]
    - generic [ref=e9]:
      - heading "Login" [level=5] [ref=e10]
      - generic [ref=e11]:
        - generic [ref=e13]:
          - paragraph [ref=e14]: "Username : Admin"
          - paragraph [ref=e15]: "Password : admin123"
        - generic [ref=e16]:
          - generic [ref=e18]:
            - generic [ref=e19]:
              - generic [ref=e20]: 
              - generic [ref=e21]: Username
            - textbox "Username" [active] [ref=e23]
          - generic [ref=e25]:
            - generic [ref=e26]:
              - generic [ref=e27]: 
              - generic [ref=e28]: Password
            - textbox "Password" [ref=e30]
          - button "Login" [ref=e32] [cursor=pointer]
          - paragraph [ref=e34] [cursor=pointer]: Forgot your password?
      - generic [ref=e35]:
        - generic [ref=e36]:
          - link [ref=e37] [cursor=pointer]:
            - /url: https://www.linkedin.com/company/orangehrm/mycompany/
          - link [ref=e40] [cursor=pointer]:
            - /url: https://www.facebook.com/OrangeHRM/
          - link [ref=e43] [cursor=pointer]:
            - /url: https://twitter.com/orangehrm?lang=en
          - link [ref=e46] [cursor=pointer]:
            - /url: https://www.youtube.com/c/OrangeHRMInc
        - generic [ref=e49]:
          - paragraph [ref=e50]: OrangeHRM OS 5.9
          - paragraph [ref=e51]:
            - text: © 2005 - 2026
            - link "OrangeHRM, Inc" [ref=e52] [cursor=pointer]:
              - /url: http://www.orangehrm.com
            - text: . All rights reserved.
  - img "orangehrm-logo" [ref=e54]
```

# Test source

```ts
  1  | class NavigationOnlyCasePage {
  2  |   constructor(page) {
  3  |     this.page = page;
  4  |     this.continueShoppingBtn = page.locator('button.a-button-text:has-text("Continue shopping"), button[alt="Continue shopping"]').first();
  5  |     this.sellLink = page.locator('a[data-csa-c-content-id*="sell"], a.nav-a:has-text("Sell")').first();
  6  |   }
  7  | 
  8  |   async goto() {
  9  |     await this.page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login', { waitUntil: 'domcontentloaded' });
  10 |   }
  11 | 
  12 |   async clickContinueShoppingIfPresent() {
  13 |     try {
  14 |       if (await this.continueShoppingBtn.isVisible({ timeout: 3000 })) {
  15 |         await this.continueShoppingBtn.click();
  16 |         await this.page.waitForLoadState('domcontentloaded');
  17 |       }
  18 |     } catch {
  19 |       // Proceed if no interstitial prompt appears
  20 |     }
  21 |   }
  22 | 
  23 |   async clickSell() {
> 24 |     await this.sellLink.waitFor({ state: 'visible', timeout: 10000 });
     |                         ^ TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
  25 |     await this.sellLink.click();
  26 |   }
  27 | }
  28 | 
  29 | module.exports = { NavigationOnlyCasePage };
```