const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { extractTestCaseFromMarkdown } = require('../scripts/run-from-md');

test('extracts title, url, steps, and expected result from markdown', () => {
  const markdown = `# ADO / Prompt to Playwright Test Case Template

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
The user is successfully logged in and the login button is no longer present on the authenticated page.`;

  const result = extractTestCaseFromMarkdown(markdown);

  assert.equal(result.title, 'Verify OrangeHRM login with valid credentials');
  assert.equal(result.url, 'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');
  assert.equal(result.steps.length, 6);
  assert.match(result.expectedResult, /logged in/i);
  assert.equal(result.testData.username, 'Admin');
  assert.equal(result.testData.password, 'admin123');
});
