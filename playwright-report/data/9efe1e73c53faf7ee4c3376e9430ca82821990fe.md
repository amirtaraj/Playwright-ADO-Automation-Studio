# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verifyOrangeHRMLoginWithValidCredentials.spec.js >> Verify OrangeHRM login with valid credentials
- Location: tests\verifyOrangeHRMLoginWithValidCredentials.spec.js:5:1

# Error details

```
TypeError: VerifyOrangeHRMLoginWithValidCredentialsPage is not a constructor
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const VerifyOrangeHRMLoginWithValidCredentialsPage = require('./pages/verifyOrangeHRMLoginWithValidCredentialsPage.js');
  3  | 
  4  | 
  5  | test('Verify OrangeHRM login with valid credentials', async ({ page }) => {
> 6  |   const pageObj = new VerifyOrangeHRMLoginWithValidCredentialsPage(page);
     |                   ^ TypeError: VerifyOrangeHRMLoginWithValidCredentialsPage is not a constructor
  7  | 
  8  |   await pageObj.enterUsername('Admin');
  9  |   await pageObj.enterPassword('admin123');
  10 |   await pageObj.clickLoginButton();
  11 | 
  12 |   await expect(page).toHaveTitle('OrangeHRM');
  13 | });
```