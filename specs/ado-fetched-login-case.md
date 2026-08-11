# ADO Fetched Test Case

- Test Case ID: ORG-LOGIN-002
- Title: Verify OrangeHRM dashboard access after login
- Source: Azure DevOps
- URL: https://opensource-demo.orangehrmlive.com/web/index.php/auth/login
- Preconditions: OrangeHRM demo site is reachable.
- Test Data:
  - Username: Admin
  - Password: admin123

### Steps
1. Open the OrangeHRM login page.
2. Confirm the username input is visible.
3. Confirm the password input is visible.
4. Enter Admin into the username input.
5. Enter admin123 into the password input.
6. Click the Login button.
7. Verify the dashboard page is loaded.

### Expected Result
The login page accepts the credentials, the user reaches the dashboard, and the login button no longer remains available in the authenticated page state.
