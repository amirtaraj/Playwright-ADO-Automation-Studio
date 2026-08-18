# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: generated-from-md.spec.js >> Verify OrangeHRM login with valid credentials
- Location: tests\generated-from-md.spec.js:5:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#txtUsername')

```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const { VerifyOrangeHRMLoginWithValidCredentialsPage } = require('./pages/verifyOrangeHRMLoginWithValidCredentialsPage.js');
  3  | 
  4  | 
  5  | test('Verify OrangeHRM login with valid credentials', async ({ page }) => {
  6  |   const pageObj = new VerifyOrangeHRMLoginWithValidCredentialsPage(page);
  7  | 
> 8  |   await pageObj.usernameInput.fill('Admin');
     |                               ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  9  |   await pageObj.passwordInput.fill('admin123');
  10 |   await pageObj.loginButton.click();
  11 | 
  12 |   // Add assertions here if needed
  13 | });
```