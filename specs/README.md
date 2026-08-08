# Specs

This folder contains reusable test-case and test-generation assets for the Playwright automation studio.

## ADO / prompt to Playwright workflow

Use [ado-test-case-template.md](ado-test-case-template.md) when you receive a test case from Azure DevOps (ADO) or from a natural-language prompt.

### Install prerequisites
1. Install project dependencies:
   - npm install
2. Install Playwright browsers if needed:
   - npx playwright install

### How to use it
1. Open [ado-test-case-template.md](ado-test-case-template.md).
2. Fill in the test case ID, title, URL, preconditions, and test data.
3. Write the test steps and expected result in the template.
4. Save the markdown file.
5. Run the workflow from the project root with:
   - npm run from-md -- specs/ado-test-case-template.md
6. The generated spec will appear in [../tests/generated-from-md.spec.js](../tests/generated-from-md.spec.js) and the report will be written to [../playwright-report/markdown-workflow-report.md](../playwright-report/markdown-workflow-report.md).

### Current example
The repository already includes a working example for OrangeHRM login:
- [../tests/orangehrm-login-ado.spec.js](../tests/orangehrm-login-ado.spec.js)
- [../tests/pages/orangehrmLoginPage.js](../tests/pages/orangehrmLoginPage.js)
- [../.vscode/tasks.json](../.vscode/tasks.json)
