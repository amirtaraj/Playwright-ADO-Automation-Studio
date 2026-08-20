Specs
This folder contains reusable test-case templates and AI-powered test-generation assets for the Playwright Automation Studio.
The framework includes an Autonomous Test Automation Agent that converts Markdown-based test cases into executable Playwright Page Object Model (POM) tests using a local Ollama LLM and can automatically self-heal failed tests.
Core Architecture Overview
`run-from-md.js` is an Autonomous Test Automation Agent that:
Reads a Markdown test case.
Extracts metadata and test steps.
Inspects the live application DOM.
Generates enterprise-standard Playwright POM code.
Executes the generated tests.
Diagnoses failures.
Automatically repairs and retries failed tests.
Workflow
```text
Markdown Test Case
        |
        v
Metadata Parser
        |
        v
DOM Inspection
        |
        v
LLM Code Generation
        |
        v
Generate POM + Spec
        |
        v
Execute Test
        |
        v
 Pass? ----------------> SUCCESS
        |
        v
Analyze Failure
        |
        v
Self-Heal Code
        |
        v
Re-Execute
```
ADO / Prompt to Playwright Workflow
Use `ado-test-case-template.md` when you receive:
A test case from Azure DevOps (ADO)
A business test scenario
A natural-language prompt
Install Prerequisites
Install project dependencies
```bash
npm install
```
Install Playwright browsers
```bash
npx playwright install
```
Create a Test Case
Open `ado-test-case-template.md`.
Populate the following information:
Test Case ID
Test Title
Application URL
Credentials
Preconditions
Test Data
Test Steps
Expected Results
Save the Markdown file.
Run the Test-Generation Workflow
Option 1: Use the NPM script
Generate automation using the default configured model:
```bash
npm run from-md -- specs/ado-test-case-template.md
```
Option 2: Run the script directly
Execute the autonomous workflow directly:
```bash
node scripts/run-from-md.js specs/ado-test-case-template.md
```
Option 3: Run with a specific Ollama model
Override the configured model with `qwen2.5-coder:latest`.
Windows PowerShell
```powershell
$env:OLLAMA_MODEL="qwen2.5-coder:latest"
node scripts/run-from-md.js specs/navigation-only-case.md
```
Windows Command Prompt
```cmd
set OLLAMA_MODEL=qwen2.5-coder:latest
node scripts/run-from-md.js specs/navigation-only-case.md
```
macOS, Linux, or Git Bash
```bash
OLLAMA_MODEL="qwen2.5-coder:latest" node scripts/run-from-md.js specs/navigation-only-case.md
```
Generated Output
Test specification
The generated Playwright test is written to:
```text
tests/generated-from-md.spec.js
```
Page objects
Generated Page Object files are written to:
```text
tests/pages/
```
Execution report
The Markdown workflow report is written to:
```text
playwright-report/markdown-workflow-report.md
```
Open the Generated Report
Visual Studio Code
```bash
code playwright-report/markdown-workflow-report.md
```
Windows
```cmd
start playwright-report\markdown-workflow-report.md
```
macOS
```bash
open playwright-report/markdown-workflow-report.md
```
Linux
```bash
xdg-open playwright-report/markdown-workflow-report.md
```
Execute the Generated Test Separately
Run only the generated Playwright specification:
```bash
npx playwright test tests/generated-from-md.spec.js
```
Open the Playwright HTML Report
```bash
npx playwright show-report
```
Key Components and Workflow
1. Metadata and Markdown Parser: `parseMarkdown`
The parser reads the `.md` specification file and uses regular expressions to extract metadata including:
Test title
Target URL
Credentials
Test steps and expected results
It formats names into standardized PascalCase and camelCase identifiers for generated classes and files.
Examples:
```text
VerifyOrangeHRMLoginWithValidCredentialsPage.js
verifyOrangeHRMLoginWithValidCredentials.spec.js
```
This provides predictable naming and reduces manual framework setup.
2. Pre-Flight DOM Inspector: `fetchCleanDOM`
Before code generation, the agent launches a headless Chromium browser and inspects the live target URL.
The inspector captures relevant attributes from interactive elements, including:
Tags
Input types
Placeholders
Names
Roles
ARIA labels
The live DOM information is passed to the LLM so the generated selectors are based on the actual application rather than unsupported guesses.
3. LLM Code Generation: `generateInitialPom` and `askAgent`
The Markdown test information and DOM snapshot are sent to the local Ollama instance using:
```text
qwen2.5-coder:latest
```
The LLM returns structured JSON containing two separate code artifacts.
Page Object: `pageObjectCode`
The Page Object contains:
Locators
Constructor logic
Atomic interaction methods
Explicit visibility waits
The Page Object does not contain test assertions or Playwright test-runner imports.
Example interaction:
```javascript
await this.usernameTextbox.fill(username);
await this.loginButton.click();
```
Test Specification: `specCode`
The test specification contains:
Page Object imports
Test fixture setup
Page Object instantiation
Test-step orchestration
`expect()` assertions
Example assertion flow:
```javascript
await loginPage.login(user, password);
await expect(page).toHaveURL('/dashboard');
```
This separation keeps UI interactions in the Page Object and test validation in the specification.
4. File-System Persistence: `savePomFiles`
After generation, the agent writes the files to their expected locations:
```text
tests/pages/
tests/
```
The required directories are created recursively when they do not already exist.
5. Cross-Platform Test Execution: `runPlaywrightTest`
The generated specification is executed using:
```bash
npx playwright test
```
On Windows, the workflow uses:
```cmd
cmd.exe /c
```
This avoids `EINVAL` spawn errors. Standard output and error streams are captured during execution and supplied to the workflow.
6. Autonomous Self-Healing Feedback Loop: `healCodeWithAgent` and `main`
The generated test runs inside a retry loop with:
```javascript
MAX_AGENT_RETRIES = 3
```
When execution fails, the framework captures:
Playwright error logs
Failure stack trace
Existing Page Object code
Existing test specification code
Current DOM snapshot
The information is sent back to Ollama. The model diagnoses the failure, updates the generated code, saves the revised files, and executes the test again.
The workflow continues until:
The test passes, or
The maximum number of agent retries is reached
Self-Healing Flow
```text
Generate Code
     |
     v
Execute Test
     |
     v
Did the test pass? ---- Yes ----> Complete
     |
     No
     |
     v
Capture error, code, and DOM
     |
     v
Send context to Ollama
     |
     v
Rewrite POM and Spec
     |
     v
Save revised files
     |
     v
Re-execute the test
```
Fallback Protection
If Ollama:
Times out
Does not respond
Returns invalid JSON
The workflow uses a hardcoded robust template to create a baseline Page Object and test specification.
This fallback prevents an invalid or unavailable model response from stopping the entire generation workflow.
Current Example
The repository includes a working OrangeHRM example.
Test specification
`orangehrm-login-ado.spec.js`
Page Object
`orangehrmLoginPage.js`
Visual Studio Code tasks
`tasks.json`
Quick Commands Reference
Generate automation using the NPM script
```bash
npm run from-md -- specs/ado-test-case-template.md
```
Run the script directly
```bash
node scripts/run-from-md.js specs/ado-test-case-template.md
```
Run the navigation example using Qwen 2.5 Coder
Windows PowerShell
```powershell
$env:OLLAMA_MODEL="qwen2.5-coder:latest"
node scripts/run-from-md.js specs/navigation-only-case.md
```
Windows Command Prompt
```cmd
set OLLAMA_MODEL=qwen2.5-coder:latest
node scripts/run-from-md.js specs/navigation-only-case.md
```
macOS, Linux, or Git Bash
```bash
OLLAMA_MODEL="qwen2.5-coder:latest" node scripts/run-from-md.js specs/navigation-only-case.md
```
Open the Markdown workflow report
```bash
code playwright-report/markdown-workflow-report.md
```
Execute only the generated test
```bash
npx playwright test tests/generated-from-md.spec.js
```
Open the Playwright HTML report
```bash
npx playwright show-report
```
Solution Summary
This workflow transforms a Markdown test scenario into a self-healing Playwright automation asset by combining live DOM inspection, local LLM-driven POM generation, automatic execution, bounded retries, and fallback protection.