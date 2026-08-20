# 🎭 Playwright ADO Automation Studio

> Convert Azure DevOps test cases or prompt-based requirements into executable Playwright tests using a local Ollama LLM.

The studio reads a Markdown test case, inspects the live application DOM, generates a Playwright Page Object Model and test specification, executes the test, and attempts to self-heal failures.

## ✨ Workflow

```text
Markdown Test Case
        ↓
Live DOM Inspection
        ↓
Ollama Code Generation
        ↓
Page Object + Test Spec
        ↓
Playwright Execution
        ↓
Failure Analysis and Self-Healing
        ↓
Test Result and Report
```

## 📁 Key Files

```text
specs/
├── ado-test-case-template.md
└── navigation-only-case.md

scripts/
└── run-from-md.js

tests/
├── pages/
└── generated Playwright specifications

playwright-report/
└── generated execution reports
```

## 🚀 Commands

Run the following commands from the project root.

### 1. Install dependencies

```bash
npm install
```

### 2. Install Playwright browsers

```bash
npx playwright install
```

### 3. Execute the Markdown workflow

```bash
OLLAMA_MODEL="qwen2.5-coder:latest" node scripts/run-from-md.js specs/navigation-only-case.md
```

### 4. View the Playwright HTML report

```bash
npx playwright show-report
```

### 5. Open the Markdown workflow report

```bash
code playwright-report/markdown-workflow-report.md
```

## 📝 Using an ADO Test Case

1. Open [`specs/ado-test-case-template.md`](ado-test-case-template.md).
2. Add the test case ID, title, URL, preconditions, credentials, test data, steps, and expected result.
3. Save the completed test case as a Markdown file inside `specs/`.
4. Replace `specs/navigation-only-case.md` in the mandatory command with the new Markdown file path.

Example:

```bash
OLLAMA_MODEL="qwen2.5-coder:latest" node scripts/run-from-md.js specs/ado-test-case-template.md
```

## 🤖 What the Agent Does

- Parses the Markdown test case and metadata.
- Opens the target application in headless Chromium.
- Collects relevant DOM attributes for reliable locator generation.
- Uses `qwen2.5-coder:latest` through Ollama.
- Generates separate Page Object and test specification files.
- Executes the generated Playwright test.
- Sends failure logs, existing code, and the DOM snapshot back to the model for repair.
- Retries failed tests up to the configured retry limit.
- Uses a fallback template when the model fails or returns invalid JSON.

## ✅ Current Example

The repository includes an OrangeHRM example:

- [`tests/orangehrm-login-ado.spec.js`](../tests/orangehrm-login-ado.spec.js)
- [`tests/pages/orangehrmLoginPage.js`](../tests/pages/orangehrmLoginPage.js)
- [`.vscode/tasks.json`](../.vscode/tasks.json)

---

**Playwright ADO Automation Studio** provides a concise local workflow for moving from a Markdown requirement to generated, executed, and self-healing Playwright automation.
