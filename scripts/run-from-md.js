const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:latest';

/**
 * 1. Parse Markdown file for Test Metadata
 */
function parseMarkdown(mdPath) {
  const content = fs.readFileSync(mdPath, 'utf8');
  const getField = (regex, fallback = '') => (content.match(regex)?.[1] || fallback).trim();

  // Create a clean PascalCase page name (e.g. VerifyOrangeHRMLoginWithValidCredentialsPage)
  const rawTitle = getField(/^- Title:\s*(.+)$/im, 'Generated Test');
  const baseName = rawTitle
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^./, (chr) => chr.toUpperCase());

  return {
    pageClassName: `${baseName}Page`,
    pageFileName: `${baseName[0].toLowerCase() + baseName.slice(1)}Page.js`,
    title: rawTitle,
    url: getField(/^- URL(?: under test)?:\s*(https?:\/\/[^\s]+)/im, 'https://example.com'),
    username: getField(/^- Username:\s*([^\s]+)/im),
    password: getField(/^- Password:\s*([^\s]+)/im),
    rawMarkdown: content,
  };
}

/**
 * 2. Fallback POM Implementation
 */
function fallbackPom(testCase) {
  const hasCredentials = Boolean(testCase.username && testCase.password);

  const pageObjectCode = `class ${testCase.pageClassName} {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"], input[placeholder*="Username" i]').first();
    this.passwordInput = page.locator('input[type="password"], input[placeholder*="Password" i]').first();
    this.submitButton = page.locator('button[type="submit"], button:has-text("Login")').first();
    this.sellLink = page.locator('a[data-csa-c-content-id*="sell"], a.nav-a:has-text("Sell")').first();
  }

  async goto() {
    await this.page.goto('${testCase.url}', { waitUntil: 'domcontentloaded' });
  }

  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async clickSell() {
    await this.sellLink.click();
  }
}

module.exports = { ${testCase.pageClassName} };`;

  const specCode = `const { test, expect } = require('@playwright/test');
const { ${testCase.pageClassName} } = require('./pages/${testCase.pageFileName}');

test.describe('${testCase.title}', () => {
  test('${testCase.title.replace(/'/g, "\\'")}', async ({ page }) => {
    const pageObj = new ${testCase.pageClassName}(page);
    await pageObj.goto();
    ${hasCredentials ? `await pageObj.login('${testCase.username}', '${testCase.password}');` : ''}
  });
});`;

  return { pageObjectCode, specCode };
}

/**
 * 3. Generate POM via Ollama in JSON format
 */
async function generatePomWithOllama(testCase) {
  console.log(`🤖 Asking Ollama (${OLLAMA_MODEL}) to generate Page Object Model structure...`);

  const systemPrompt = `You are an expert Playwright automation engineer following strict Page Object Model (POM) architecture.

Output ONLY valid JSON with exactly two string keys: "pageObjectCode" and "specCode".

Strict Validation Rules:
1. "pageObjectCode":
   - NEVER import or require '@playwright/test' (do not import test or expect).
   - ONLY export the class named "${testCase.pageClassName}".
   - Constructor must receive 'page' (constructor(page) { this.page = page; ... }).
   - Initialize all locators in the constructor.
   - NO assertions (expect) inside the page object.
   - End strictly with: module.exports = { ${testCase.pageClassName} };

2. "specCode":
   - MUST import test and expect from '@playwright/test'.
   - MUST import "${testCase.pageClassName}" from './pages/${testCase.pageFileName}'.
   - Page Object instantiation MUST ONLY happen INSIDE the test callback:
     test('${testCase.title}', async ({ page }) => {
       const pageObj = new ${testCase.pageClassName}(page);
     });
   - NEVER instantiate the page object outside a test or beforeEach callback.
   - NEVER include placeholder comments (do NOT write TODO, FIXME, or COPILOT comments). All code must be complete and runnable.

STRICT JSON ONLY. No markdown code blocks (no \`\`\`json or \`\`\`), no conversational wrapper text.`;

  const userPrompt = `Target URL: ${testCase.url}
Title: ${testCase.title}
Page Object Class Name: ${testCase.pageClassName}
Page Object File Name: ${testCase.pageFileName}

Markdown Spec:
${testCase.rawMarkdown}`;

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

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    let rawText = (result.response || '').trim();

    // Strip any lingering markdown formatting
    rawText = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');

    const parsed = JSON.parse(rawText);
    const pageObjectCode = parsed.pageObjectCode || parsed.pageObject || parsed.page_object_code;
    const specCode = parsed.specCode || parsed.spec || parsed.spec_code;

    if (!pageObjectCode || !specCode || pageObjectCode.trim().length === 0) {
      throw new Error('Incomplete POM code returned from Ollama');
    }

    return { pageObjectCode, specCode };
  } catch (error) {
    console.error(`⚠️ POM generation fallback triggered: ${error.message}`);
    return fallbackPom(testCase);
  }
}

/**
 * 4. Save Both POM Files Safely
 */
function savePomFiles(testCase, pomData) {
  const fallback = fallbackPom(testCase);
  const pageCode = String(pomData?.pageObjectCode || fallback.pageObjectCode);
  const specCode = String(pomData?.specCode || fallback.specCode);

  // 1. Write Page Object to tests/pages/
  const pagePath = path.join(process.cwd(), 'tests', 'pages', testCase.pageFileName);
  fs.mkdirSync(path.dirname(pagePath), { recursive: true });
  fs.writeFileSync(pagePath, pageCode, 'utf8');
  console.log(`📄 Created Page Object: tests/pages/${testCase.pageFileName}`);

  // 2. Write Spec to tests/generated-from-md.spec.js
  const specPath = path.join(process.cwd(), 'tests', 'generated-from-md.spec.js');
  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(specPath, specCode, 'utf8');
  console.log(`📄 Created Spec: tests/generated-from-md.spec.js`);

  return specPath;
}

/**
 * 5. Execute Playwright Test (Windows-Safe Execution)
 */
function runTest(specFile) {
  const relativeSpec = path
    .relative(process.cwd(), specFile)
    .replace(/\\/g, '/');

  console.log(`\n🚀 Executing POM Test: ${relativeSpec}`);

  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'cmd.exe' : 'npx';
  const args = isWindows
    ? ['/c', 'npx', 'playwright', 'test', relativeSpec]
    : ['playwright', 'test', relativeSpec];

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.error) {
    return {
      status: 'FAIL',
      error: result.error.message,
      exitCode: result.status,
    };
  }

  if (result.status !== 0) {
    return {
      status: 'FAIL',
      error: `Playwright exited with code ${result.status}`,
      exitCode: result.status,
    };
  }

  return {
    status: 'PASS',
    exitCode: result.status,
  };
}

/**
 * Main Runner
 */
async function main() {
  const mdFile = process.argv[2];
  if (!mdFile) {
    console.error('❌ Error: Missing markdown file.');
    console.log('Usage: node scripts/run-from-md.js specs/<test-name>.md');
    process.exit(1);
  }

  const absoluteMdPath = path.resolve(process.cwd(), mdFile);
  if (!fs.existsSync(absoluteMdPath)) {
    console.error(`❌ Error: File not found at ${absoluteMdPath}`);
    process.exit(1);
  }

  const testCase = parseMarkdown(absoluteMdPath);
  const pomData = await generatePomWithOllama(testCase);
  const specFile = savePomFiles(testCase, pomData);

  const result = runTest(specFile);
  console.log(`\n📊 Execution Result: ${result.status}`);
}

if (require.main === module) {
  main();
}