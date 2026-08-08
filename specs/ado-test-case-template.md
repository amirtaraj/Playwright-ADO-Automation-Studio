# ADO / Prompt to Playwright Test Case Template

Use this file when a test case is received from Azure DevOps (ADO) or from a natural-language prompt. It helps convert the requirement into a Playwright test and page object structure.

## 1. Capture the test case

- Test Case ID:
- Title:
- Source:
- URL under test:
- Preconditions:
- Test Data:

## 2. Write the steps

1. Open the target URL.
2. Verify the login form is visible.
3. Enter the username.
4. Enter the password.
5. Click the login button.
6. Verify the user is logged in.

## 3. Expected result

- The login form is displayed before authentication.
- The user is redirected to the dashboard after successful login.
- The login button is no longer visible after authentication.

## Example from the current prompt

- Test Case ID: ORG-LOGIN-001
- Title: Verify OrangeHRM login with valid credentials
- Source: Prompt / ADO
- URL: https://opensource-demo.orangehrmlive.com/web/index.php/auth/login
- Preconditions: Browser is available and the site is reachable.
- Test Data:
  - Username: Admin
  - Password: admin123

### Steps
1. Open the OrangeHRM login page.
2. Verify the username, password, and login button are visible.
3. Enter Admin in the username field.
4. Enter admin123 in the password field.
5. Click the Login button.
6. Verify the page navigates to the dashboard.

### Expected Result
The user is successfully logged in and the login button is no longer present on the authenticated page.
