const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('@playwright/test');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:latest';
const MAX_AGENT_RETRIES = 3;

/**
 * 1. Helper: Parse Markdown Metadata based strictly on MD File Name
 */
function parseMarkdown(mdPath) {
  const content = fs.readFileSync(mdPath, 'utf8');
  const getField = (regex, fallback = '') => (content.match(regex)?.[1] || fallback).trim();

  const baseFileName = path.basename(mdPath, path.extname(mdPath));
  const title = getField(/^- Title:\s*(.+)$/im, baseFileName);

  const cleanWords = baseFileName.replace(/[^a-zA-Z0-9\s_-]/g, ' ').split(/[\s_-]+/).filter(Boolean);
  const camelBase = cleanWords.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('') || 'generatedTest';
  const pascalBase = cleanWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('') || 'GeneratedTest';

  return {
    title,
    baseFileName,
    pascalBase,
    camelBase,
    pageClassName: `${pascalBase}Page`,
    pageFileName: `${camelBase}Page.js`,
    specFileName: `${baseFileName}.spec.js`,
    pagePath: path.join(process.cwd(), 'tests', 'pages', `${camelBase}Page.js`),
    specPath: path.join(process.cwd(), 'tests', `${baseFileName}.spec.js`),
    url: getField(/^- URL(?: under test)?:\s*(https?:\/\/[^\s]+)/im, 'https://example.com'),
    username: getField(/^- Username:\s*([^\s]+)/im),
    password: getField(/^- Password:\s*([^\s]+)/im),
    rawMarkdown: content,
  };
}

/**
 * 2. Helper: Clean Allure Results to ensure only the latest run is captured
 */
function cleanAllureResults() {
  const resultsDir = path.join(process.cwd(), 'allure-results');
  if (fs.existsSync(resultsDir)) {
    fs.rmSync(resultsDir, { recursive: true, force: true });
  }
}

/**
 * 3. DOM Inspector Tool
 */
async function fetchCleanDOM(url) {
  console.log(`🌐 [DOM Inspector]: Inspecting live DOM structure at ${url}...`);
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
      await page.waitForLoadState('domcontentloaded');
    });

    await page.waitForTimeout(2000);

    const pageData = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input, button, select, textarea, a, form, label, [role="button"], [role="link"], [role="combobox"]'));
      return elements.map(el => ({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        name: el.getAttribute('name') || '',
        id: el.getAttribute('id') || '',
        placeholder: el.getAttribute('placeholder') || '',
        role: el.getAttribute('role') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        text: (el.innerText || el.textContent || '').trim().slice(0, 50),
        classes: el.className || ''
      }));
    });

    await browser.close();
    return JSON.stringify(pageData.slice(0, 60), null, 2);
  } catch (err) {
    if (browser) await browser.close();
    console.warn(`⚠️ [DOM Inspector]: Live DOM inspection skipped (${err.message}). Using spec fallback.`);
    return '[]';
  }
}

/**
 * 4. Ollama Query Helper
 */
async function askAgent(systemPrompt, userPrompt) {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system: systemPrompt,
        prompt: userPrompt,
        format: 'json',
        stream: false,
        options: { temperature: 0.1 }
      })
    });

    if (!response.ok) throw new Error(`Ollama status ${response.status}`);

    const result = await response.json();
    let rawText = (result.response || '').trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
    return JSON.parse(rawText);
  } catch (error) {
    console.error(`⚠️ Agent reasoning error: ${error.message}`);
    return null;
  }
}

/**
 * 5. Code Generation Tool
 */
async function generatePomWithAgent(testCase, domContext) {
  console.log(`🤖 [Agent Decision]: Synthesizing POM architecture using ${OLLAMA_MODEL}...`);

  const systemPrompt = `You are an expert Playwright automation engineer following strict Page Object Model (POM) architecture.

Output ONLY a JSON object with two string keys: "pageObjectCode" and "specCode".

Strict Rules:
1. "pageObjectCode":
   - Class named "${testCase.pageClassName}".
   - Constructor(page) initializes locators (page.locator(), page.getByRole(), page.getByPlaceholder()).
   - Explicit Waits: Use "await this.element.waitFor({ state: 'visible', timeout: 15000 })" before actions.
   - For goto(), use "await this.page.goto('${testCase.url}', { waitUntil: 'domcontentloaded' });".
   - NO assertions inside Page Object.
   - NEVER import '@playwright/test' in the Page Object.
   - MUST end with: module.exports = { ${testCase.pageClassName} };

2. "specCode":
   - Imports test and expect from '@playwright/test'.
   - Imports "${testCase.pageClassName}" from './pages/${testCase.pageFileName}'.
   - Executes workflow inside test('${testCase.title}', async ({ page }) => { ... }).
   - Performs all assertions (expect) inside the spec test.

STRICT JSON ONLY. No markdown wrapper ticks, no extra conversation.`;

  const userPrompt = `Requirements:
Title: ${testCase.title}
Target URL: ${testCase.url}

Markdown Specification:
${testCase.rawMarkdown}

Live DOM Inspection Data:
${domContext}`;

  const res = await askAgent(systemPrompt, userPrompt);
  if (!res || !res.pageObjectCode || !res.specCode) {
    return fallbackPom(testCase);
  }
  return res;
}

/**
 * 6. Self-Healing Tool
 */
async function healCodeWithAgent(testCase, currentPom, failureError, domContext) {
  console.log(`🔧 [Agent Action]: Diagnosing failures & overwriting code for next attempt...`);

  const systemPrompt = `You are an autonomous self-healing Playwright QA Agent.
The test failed during execution. Inspect the live DOM elements, error log, and current code.
Fix the broken locators, timing waits, or sequences.

Strict Requirements:
- Page class name MUST remain "${testCase.pageClassName}".
- Spec file MUST import "${testCase.pageClassName}" from './pages/${testCase.pageFileName}'.
- End page object with: module.exports = { ${testCase.pageClassName} };

Strict Output JSON:
{
  "pageObjectCode": "string",
  "specCode": "string",
  "explanation": "short summary of the fix"
}`;

  const userPrompt = `Target URL: ${testCase.url}
Title: ${testCase.title}

Current Page Object:
${currentPom.pageObjectCode}

Current Spec:
${currentPom.specCode}

Execution Error Stack:
${failureError}

Live DOM Elements:
${domContext}`;

  const healed = await askAgent(systemPrompt, userPrompt);
  if (!healed || !healed.pageObjectCode || !healed.specCode) {
    return fallbackPom(testCase);
  }
  return healed;
}

/**
 * 7. Fallback Template
 */
function fallbackPom(testCase) {
  const pageObjectCode = `class ${testCase.pageClassName} {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"], input[placeholder*="Username" i]').first();
    this.passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    this.submitButton = page.locator('button[type="submit"], button:has-text("Login")').first();
  }

  async goto() {
    await this.page.goto('${testCase.url}', { waitUntil: 'domcontentloaded' });
    await this.usernameInput.waitFor({ state: 'visible', timeout: 15000 });
  }

  async login(username, password) {
    await this.usernameInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

module.exports = { ${testCase.pageClassName} };`;

  const specCode = `const { test, expect } = require('@playwright/test');
const { ${testCase.pageClassName} } = require('./pages/${testCase.pageFileName}');

test.describe('${testCase.title.replace(/'/g, "\\'")}', () => {
  test('${testCase.title.replace(/'/g, "\\'")}', async ({ page }) => {
    const pageObj = new ${testCase.pageClassName}(page);
    await pageObj.goto();
    await pageObj.login('${testCase.username || 'Admin'}', '${testCase.password || 'admin123'}');
    await expect(page).toHaveURL(/dashboard/i, { timeout: 15000 });
  });
});`;

  return { pageObjectCode, specCode, explanation: 'Applied resilient fallback POM template' };
}

/**
 * 8. File System Saver (Overwrites in-place)
 */
function savePomFiles(testCase, pomData) {
  fs.mkdirSync(path.dirname(testCase.pagePath), { recursive: true });
  fs.writeFileSync(testCase.pagePath, pomData.pageObjectCode, 'utf8');

  fs.mkdirSync(path.dirname(testCase.specPath), { recursive: true });
  fs.writeFileSync(testCase.specPath, pomData.specCode, 'utf8');
}

/**
 * 9. Agent Log Recorder
 */
function recordAgentLog(testCase, logHistory) {
  const logDir = path.join(process.cwd(), 'agent-logs');
  fs.mkdirSync(logDir, { recursive: true });

  const logFilePath = path.join(logDir, `${testCase.baseFileName}-agent-history.json`);
  fs.writeFileSync(logFilePath, JSON.stringify(logHistory, null, 2), 'utf8');

  console.log(`📁 [Agent Logs]: Execution & healing steps archived to ${logFilePath}`);
}

/**
 * 10. Test Execution (Cleans previous allure-results before each attempt)
 */
function runPlaywrightTest(specFile) {
  // Purge previous allure results so only the current attempt exists in the report
  cleanAllureResults();

  const relativeSpec = path.relative(process.cwd(), specFile).replace(/\\/g, '/');
  console.log(`\n🚀 [Agent Execution]: Running npx playwright test ${relativeSpec}`);

  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'cmd.exe' : 'npx';
  const args = isWindows
    ? ['/c', 'npx', 'playwright', 'test', relativeSpec, '--reporter=list,allure-playwright,html']
    : ['playwright', 'test', relativeSpec, '--reporter=list,allure-playwright,html'];

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe',
    shell: false,
    env: { ...process.env, PLAYWRIGHT_SCREENSHOT: 'on' },
  });

  const output = (result.stdout || '') + '\n' + (result.stderr || '');
  console.log(output);

  return {
    passed: result.status === 0,
    output: output,
  };
}

/**
 * 11. Open Report Utility (Generates & opens report containing only the last attempt)
 */
function openReport() {
  console.log(`\n📊 [Reporting]: Preparing test execution report for final attempt...`);
  const isWindows = process.platform === 'win32';

  if (fs.existsSync(path.join(process.cwd(), 'allure-results'))) {
    console.log(`✨ Generating & Opening Allure Report...`);
    const allureCmd = isWindows ? 'cmd.exe' : 'npx';
    const allureArgs = isWindows
      ? ['/c', 'npx', 'allure', 'generate', 'allure-results', '--clean', '-o', 'allure-report', '&&', 'npx', 'allure', 'open', 'allure-report']
      : ['allure', 'generate', 'allure-results', '--clean', '-o', 'allure-report', '&&', 'npx', 'allure', 'open', 'allure-report'];

    const allureRun = spawnSync(allureCmd, allureArgs, { stdio: 'inherit', shell: true });
    if (allureRun.status === 0) return;
  }

  console.log(`🌐 Opening Playwright HTML Report...`);
  const cmd = isWindows ? 'cmd.exe' : 'npx';
  const args = isWindows ? ['/c', 'npx', 'playwright', 'show-report'] : ['playwright', 'show-report'];
  spawnSync(cmd, args, { stdio: 'inherit', shell: false });
}

/**
 * 12. Main Agent Orchestrator Loop
 */
async function main() {
  const mdFile = process.argv[2];
  if (!mdFile) {
    console.error('❌ Usage: node scripts/run-from-md.js specs/<test-name>.md');
    process.exit(1);
  }

  const absoluteMdPath = path.resolve(process.cwd(), mdFile);
  if (!fs.existsSync(absoluteMdPath)) {
    console.error(`❌ Spec not found at ${absoluteMdPath}`);
    process.exit(1);
  }

  const testCase = parseMarkdown(absoluteMdPath);
  console.log(`\n🧠 --- Starting Autonomous Agent for: ${testCase.title} ---`);

  const agentHistory = {
    testName: testCase.title,
    specFile: mdFile,
    startTime: new Date().toISOString(),
    iterations: []
  };

  // Step 1: Live DOM Inspection
  const domContext = await fetchCleanDOM(testCase.url);

  // Step 2: Initial POM Generation and Initial Save
  let currentPom = await generatePomWithAgent(testCase, domContext);
  savePomFiles(testCase, currentPom);

  let attempt = 1;
  let testPassed = false;

  // Step 3: Execution & Self-Healing Loop
  while (attempt <= MAX_AGENT_RETRIES && !testPassed) {
    console.log(`\n🔄 [Agent Loop]: Attempt ${attempt} of ${MAX_AGENT_RETRIES}`);

    const execution = runPlaywrightTest(testCase.specPath);

    agentHistory.iterations.push({
      attempt,
      specFile: testCase.specFileName,
      pageFile: testCase.pageFileName,
      passed: execution.passed,
      strategy: attempt === 1 ? 'Initial POM Generation' : currentPom.explanation || 'Self-healed repair',
      errorLog: execution.passed ? null : execution.output.slice(-800)
    });

    if (execution.passed) {
      console.log(`\n🎉 [Agent Verdict]: Test passed successfully on attempt ${attempt}!`);
      testPassed = true;
      savePomFiles(testCase, currentPom);
      break;
    }

    console.log(`\n⚠️ [Agent Observation]: Test failed on attempt ${attempt}.`);

    if (attempt < MAX_AGENT_RETRIES) {
      console.log(`🧐 [Agent Reasoning]: Analyzing failure and overwriting ${testCase.specFileName}...`);

      const healedData = await healCodeWithAgent(testCase, currentPom, execution.output, domContext);
      currentPom = healedData;
      savePomFiles(testCase, currentPom);
    }

    attempt++;
  }

  agentHistory.endTime = new Date().toISOString();
  agentHistory.finalStatus = testPassed ? 'PASSED' : 'FAILED';
  recordAgentLog(testCase, agentHistory);

  // Step 4: Open Report containing ONLY the last run
  openReport();

  if (!testPassed) {
    console.error(`\n❌ [Agent Verdict]: Test could not be healed after ${MAX_AGENT_RETRIES} attempts.`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}