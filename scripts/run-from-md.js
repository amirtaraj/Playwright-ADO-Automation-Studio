const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('@playwright/test');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:latest';
const MAX_AGENT_RETRIES = 3;

/**
 * 1. Helper: Parse Markdown Metadata
 */
function parseMarkdown(mdPath) {
  const content = fs.readFileSync(mdPath, 'utf8');
  const getField = (regex, fallback = '') => (content.match(regex)?.[1] || fallback).trim();

  const title = getField(/^- Title:\s*(.+)$/im, path.basename(mdPath, '.md'));
  const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  const words = cleanTitle.split(/\s+/).filter(Boolean);

  const pascalBase = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('') || 'GeneratedTest';
  const camelBase = pascalBase.charAt(0).toLowerCase() + pascalBase.slice(1);

  return {
    title,
    pageClassName: `${pascalBase}Page`,
    pageFileName: `${camelBase}Page.js`,
    specFileName: `${camelBase}.spec.js`,
    pagePath: path.join(process.cwd(), 'tests', 'pages', `${camelBase}Page.js`),
    specPath: path.join(process.cwd(), 'tests', `${camelBase}.spec.js`),
    url: getField(/^- URL(?: under test)?:\s*(https?:\/\/[^\s]+)/im, 'https://example.com'),
    username: getField(/^- Username:\s*([^\s]+)/im),
    password: getField(/^- Password:\s*([^\s]+)/im),
    rawMarkdown: content,
  };
}

/**
 * 2. DOM Inspector Tool: Fetches sanitized HTML/DOM tree from live page
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

    // Wait 2 seconds for client-side frameworks (Vue/React/Aura) to mount
    await page.waitForTimeout(2000);

    // Extract relevant interactive elements (forms, inputs, buttons, links, labels)
    const pageData = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input, button, select, textarea, a, form, label, [role="button"], [role="link"], [role="combobox"]'));
      return elements.map(el => {
        return {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || '',
          name: el.getAttribute('name') || '',
          id: el.getAttribute('id') || '',
          placeholder: el.getAttribute('placeholder') || '',
          role: el.getAttribute('role') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          text: (el.innerText || el.textContent || '').trim().slice(0, 50),
          classes: el.className || ''
        };
      });
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
 * 3. Ollama Query Helper
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
 * 4. Agent Tool: Generate Initial Code with DOM Context
 */
async function generateInitialPom(testCase, domContext) {
  console.log(`🤖 [Agent Decision]: Synthesizing DOM & Generating POM structure using ${OLLAMA_MODEL}...`);

  const systemPrompt = `You are an expert Playwright automation engineer following strict Page Object Model (POM) architecture.

Output ONLY a JSON object with two string keys: "pageObjectCode" and "specCode".

Strict Rules:
1. "pageObjectCode":
   - Class named "${testCase.pageClassName}".
   - Constructor(page) initializes locators using best practices (page.locator(), page.getByRole(), page.getByPlaceholder()).
   - Explicit Waits: Use "await this.element.waitFor({ state: 'visible', timeout: 15000 })" before interactions if elements render dynamically.
   - For goto(), use "await this.page.goto('${testCase.url}', { waitUntil: 'networkidle' });".
   - NO assertions inside the Page Object.
   - NEVER import '@playwright/test' in the Page Object.
   - MUST end with: module.exports = { ${testCase.pageClassName} };

2. "specCode":
   - Imports test and expect from '@playwright/test'.
   - Imports "${testCase.pageClassName}" from './pages/${testCase.pageFileName}'.
   - Executes workflow inside test('${testCase.title}', async ({ page }) => { ... }).
   - Performs all assertions (expect) inside the test file.

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
 * 5. Agent Tool: Self-Heal and Repair on Failure
 */
async function healCodeWithAgent(testCase, currentPom, failureError, domContext) {
  console.log(`🔧 [Agent Action]: Diagnosing failures and self-healing code...`);

  const systemPrompt = `You are an autonomous self-healing Playwright QA Agent.
The test failed during execution. Inspect the live DOM elements, error log, and current code to provide corrected Page Object and Spec implementations.
Ensure explicit element visibility waits and fallback locators are added.

Strict Output JSON format:
{
  "pageObjectCode": "string",
  "specCode": "string",
  "explanation": "short summary of the fix"
}`;

  const userPrompt = `Target URL: ${testCase.url}
Title: ${testCase.title}

Current Page Object Code:
${currentPom.pageObjectCode}

Current Spec Code:
${currentPom.specCode}

Execution Error Stack:
${failureError}

Live DOM Elements on Page:
${domContext}

Fix the locators, timing waits, or action sequences and return valid JSON.`;

  return await askAgent(systemPrompt, userPrompt);
}

/**
 * 6. Resilient Fallback Template
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
  test('Verify OrangeHRM login with valid credentials', async ({ page }) => {
    const pageObj = new ${testCase.pageClassName}(page);
    await pageObj.goto();
    await pageObj.login('${testCase.username || 'Admin'}', '${testCase.password || 'admin123'}');
    await expect(page).toHaveURL(/dashboard/i, { timeout: 15000 });
  });
});`;

  return { pageObjectCode, specCode };
}

/**
 * 7. File System Saver
 */
function savePomFiles(testCase, pomData) {
  fs.mkdirSync(path.dirname(testCase.pagePath), { recursive: true });
  fs.writeFileSync(testCase.pagePath, pomData.pageObjectCode, 'utf8');

  fs.mkdirSync(path.dirname(testCase.specPath), { recursive: true });
  fs.writeFileSync(testCase.specPath, pomData.specCode, 'utf8');
}

/**
 * 8. Execution Tool
 */
function runPlaywrightTest(specFile) {
  const relativeSpec = path.relative(process.cwd(), specFile).replace(/\\/g, '/');
  console.log(`\n🚀 [Agent Execution]: Running npx playwright test ${relativeSpec}`);

  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'cmd.exe' : 'npx';
  const args = isWindows ? ['/c', 'npx', 'playwright', 'test', relativeSpec] : ['playwright', 'test', relativeSpec];

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe',
    shell: false,
    env: process.env,
  });

  const output = (result.stdout || '') + '\n' + (result.stderr || '');
  console.log(output);

  return {
    passed: result.status === 0,
    output: output,
  };
}

/**
 * 9. Autonomous Agent Loop
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

  // Step 1: Pre-flight DOM inspection to anchor Ollama to real selectors
  const domContext = await fetchCleanDOM(testCase.url);

  // Step 2: Agent creates initial POM
  let currentPom = await generateInitialPom(testCase, domContext);
  savePomFiles(testCase, currentPom);

  let attempt = 1;
  let testPassed = false;

  // Step 3: Agent execution & self-healing loop
  while (attempt <= MAX_AGENT_RETRIES && !testPassed) {
    console.log(`\n🔄 [Agent Loop]: Attempt ${attempt} of ${MAX_AGENT_RETRIES}`);

    const execution = runPlaywrightTest(testCase.specPath);

    if (execution.passed) {
      console.log(`\n🎉 [Agent Verdict]: Test passed successfully on attempt ${attempt}!`);
      testPassed = true;
      break;
    }

    console.log(`\n⚠️ [Agent Observation]: Test failed on attempt ${attempt}.`);

    if (attempt < MAX_AGENT_RETRIES) {
      console.log(`🧐 [Agent Reasoning]: Analyzing failure logs with DOM context...`);
      const healedData = await healCodeWithAgent(testCase, currentPom, execution.output, domContext);

      if (healedData && healedData.pageObjectCode && healedData.specCode) {
        console.log(`💡 [Agent Strategy]: ${healedData.explanation || 'Applied fixes to POM and Spec'}`);
        currentPom = healedData;
        savePomFiles(testCase, currentPom);
      } else {
        console.log('⚠️ Could not obtain structured fix from agent. Retrying with fallback...');
        currentPom = fallbackPom(testCase);
        savePomFiles(testCase, currentPom);
      }
    }

    attempt++;
  }

  if (!testPassed) {
    console.error(`\n❌ [Agent Verdict]: Test could not be healed after ${MAX_AGENT_RETRIES} attempts.`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}