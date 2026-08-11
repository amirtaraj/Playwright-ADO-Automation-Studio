# ADO / Prompt to Playwright Test Case Template

Use this file when a test case is received from Azure DevOps (ADO) or from a natural-language prompt. It helps convert the requirement into a Playwright test and page object structure.

## 1. Capture the test case

- Test Case ID:
- Title:
- Source:
- URL under test:
- Preconditions:
- Test Data:

## 2. ADO import pass-through

The step list and expected result for this scenario will be fetched from Azure DevOps into a separate markdown file.

The source template remains intentionally limited to the request metadata so a downstream import file can carry the executable workflow body.

## 3. ADO import file reference

The ADO detail file is expected to contain:

- Steps
- Expected Result
- Any test data needed for execution

## Example from the current prompt

- Test Case ID: ORG-LOGIN-001
- Title: Verify OrangeHRM login with valid credentials
- Source: Prompt / ADO
- URL: https://opensource-demo.orangehrmlive.com/web/index.php/auth/login
- Preconditions: Browser is available and the site is reachable.
- Test Data:
  - Username: Admin
  - Password: admin123
