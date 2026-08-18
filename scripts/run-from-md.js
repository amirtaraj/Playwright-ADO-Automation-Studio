const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:latest';

/**
 * Helper: Generate clean timestamp string (YYYYMMDD_HHMMSS)
 */
function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

/**
 * Helper: Convert title to clean PascalCase and camelCase identifiers
 */
function sanitizeNames(rawTitle) {
  const cleanTitle = rawTitle.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  const words = cleanTitle.split(/\s+/).filter(Boolean);
  
  if (words.length === 0) {
    words.push('GeneratedTest');
  }

  const pascalBase = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
    
  const camelBase = pascalBase.charAt(0).toLowerCase() + pascalBase.slice(1);

  return { pascalBase, camelBase };
}

/**
 * 1. Parse Markdown file for Test Metadata & Compute Unique File Paths
 */
function parseMarkdown(mdPath) {
  const content = fs.readFileSync(mdPath, 'utf8');
  const getField = (regex, fallback = '') => (content.match(regex)?.[1] || fallback).trim();

  const title = getField(/^- Title:\s*(.+)$/im, path.basename(mdPath, '.md'));
  const { pascalBase, camelBase } = sanitizeNames(title);

  // Standard non-colliding initial file and class names
  let pageClassName = `${pascalBase}Page`;
  let pageFileName = `${camelBase}Page.js`;
  let specFileName = `${camelBase}.spec.js`;

  const pagesDir = path.join(process.cwd(), 'tests', 'pages');
  const testsDir = path.join(process.cwd(), 'tests');

  let pagePath = path.join(pagesDir, pageFileName);
  let specPath = path.join(testsDir, specFileName);

  // If file exists, append timestamp to prevent overwriting
  if (fs.existsSync(pagePath) || fs.existsSync(specPath)) {
    const ts = getTimestamp();
    pageClassName = `${pascalBase}_${ts}Page`;
    pageFileName = `${camelBase}_${ts}Page.js`;
    specFileName = `${camelBase}_${ts}.spec.js`;

    pagePath = path.join(pagesDir, pageFileName);
    specPath = path.join(testsDir, specFileName);
  }

  return {
    title,
    pageClassName,
    pageFileName,
    specFileName,
    pagePath,
    specPath,
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
    this.continueShoppingBtn = page.locator('button.a-button-text:has-text("Continue shopping"), button[alt="Continue shopping"]').first();
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

  async clickContinueShoppingIfPresent() {
    try {
      if (await this.continueShoppingBtn.isVisible({ timeout: 3000 })) {
        await this.continueShoppingBtn.click();
      }
    } catch {}
  }

  async clickSell() {
    await this.sellLink.click();
  }
}

module.exports = { ${testCase.pageClassName} };`;

  const specCode = `const { test, expect } = require('@playwright/test');
const { ${testCase.pageClassName} } = require('./pages/${testCase.pageFileName}');

test.describe('${testCase.title.replace(/'/g, "\\'")}', () => {
  test('Execute test steps', async ({ page }) => {
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
  console.log(`🤖 Prompting Ollama (${OLLAMA_MODEL}) to generate Page Object & Spec...`);

  const systemPrompt = `You are an expert Playwright automation engineer following strict Page Object Model (POM) architecture.

Output ONLY valid JSON with exactly two string keys: "pageObjectCode" and "specCode".

Strict Validation Rules:
1. "pageObjectCode":
   - NEVER import or require '@playwright/test' (do not import test or expect).
   - ONLY export the class named "${testCase.pageClassName}".
   - Constructor must receive 'page' (constructor(page) { this.page = page; ... }).
   - Initialize all locators in constructor.
   - Methods: fine-grained, atomic actions only.
   - NO assertions (expect) inside page object.
   - End strictly with: module.exports = { ${testCase.pageClassName} };

2. "specCode":
   - MUST import test and expect from '@playwright/test'.
   - MUST import "${testCase.pageClassName}" from './pages/${testCase.pageFileName}'.
   - Page Object instantiation MUST ONLY happen INSIDE the test callback:
     test('${testCase.title}', async ({ page }) => {
       const pageObj = new ${testCase.pageClassName}(page);
       // actions and assertions
     });
   - NEVER instantiate the page object outside a test or beforeEach callback.
   - NEVER include placeholder comments (no TODO, FIXME, or COPILOT comments).

STRICT JSON ONLY. No markdown code blocks (no \`\`\`json), no extra conversational text.`;

  const userPrompt = `Target URL: ${testCase.url}
Title: ${testCase.title}
Page Object Class Name: ${testCase.pageClassName}
Page Object File Name: ${testCase.pageFileName}

Markdown Requirements:
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

    // Strip markdown code fences if present
    rawText = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');

    const parsed = JSON.parse(rawText);
    const pageObjectCode = parsed.pageObjectCode || parsed.pageObject || parsed.page_object_code;
    const specCode = parsed.specCode || parsed.spec || parsed.spec_code;

    if (!pageObjectCode || !specCode || pageObjectCode.trim().length === 0) {
      throw new Error('Incomplete POM code returned from model');
    }

    return { pageObjectCode, specCode };
  } catch (error) {
    console.error(`⚠️ Generation fallback triggered: ${error.message}`);
    return fallbackPom(testCase);
  }
}

/**
 * 4. Write Files without Overwriting
 */
function savePomFiles(testCase, pomData) {
  const fallback = fallbackPom(testCase);
  const pageCode = String(pomData?.pageObjectCode || fallback.pageObjectCode);
  const specCode = String(pomData?.specCode || fallback.specCode);

  // Write Page Object
  fs.mkdirSync(path.dirname(testCase.pagePath), { recursive: true });
  fs.writeFileSync(testCase.pagePath, pageCode, 'utf8');
  console.log(`📄 Created Page Object: tests/pages/${testCase.pageFileName}`);

  // Write Spec
  fs.mkdirSync(path.dirname(testCase.specPath), { recursive: true });
  fs.writeFileSync(testCase.specPath, specCode, 'utf8');
  console.log(`📄 Created Spec: tests/${testCase.specFileName}`);

  return testCase.specPath;
}

/**
 * 5. Run Test
 */
function runTest(specFile) {
  const relativeSpec = path
    .relative(process.cwd(), specFile)
    .replace(/\\/g, '/');

  console.log(`\n🚀 Executing Playwright Test: ${relativeSpec}`);

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
    console.error('❌ Error: Missing markdown file argument.');
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