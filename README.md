# Playwright ADO Automation Studio

This project demonstrates a simple Playwright workflow for converting Azure DevOps (ADO) test cases or prompt-based requirements into executable browser tests using a local Ollama LLM.

## Install
1. Open the project folder in a terminal.
2. Install dependencies:
   - `npm install`
3. If you want the browser engine available for local execution, install Playwright browsers once:
   - `npx playwright install`

## Prerequisites (Local LLM)
1. Install and start [Ollama](https://ollama.com/).
2. Pull your desired code model:
   - `ollama pull qwen2.5-coder:latest`
3. Verify Ollama is running:
   - `curl http://127.0.0.1:11434`

## Quick start
1. Run the sample OrangeHRM login test:
   - `npm test -- --grep "Verify OrangeHRM login with valid credentials"`
2. Run the markdown-driven workflow using your local Ollama model:
   - `OLLAMA_MODEL="qwen2.5-coder:latest" node scripts/run-from-md.js specs/navigation-only-case.md`
3. Or run with npm script:
   - `npm run from-md -- specs/ado-test-case-template.md`
4. Or trigger the flow from VS Code using the task named "Run markdown-to-test workflow".

## How to use the ADO / prompt workflow
1. Create or open a specification file inside `specs/` (e.g., [specs/navigation-only-case.md](specs/navigation-only-case.md) or [specs/ado-test-case-template.md](specs/ado-test-case-template.md)).
2. Fill in the test case details such as Title, URL under test, steps, and expected results.
3. Save the markdown file.
4. Run the workflow with your local model:
   ```bash
   OLLAMA_MODEL="qwen2.5-coder:latest" node scripts/run-from-md.js specs/navigation-only-case.md

   flowchart LR
    A[Markdown test case] --> B[Parse markdown metadata]
    B --> C[Ollama LLM Code Generation]
    C --> D[Save tests/generated-from-md.spec.js]
    D --> E[Run Playwright test]
    E --> F{Pass?}
    F -->|No| G[Self-heal selector]
    G --> E
    F -->|Yes| H[Write report]