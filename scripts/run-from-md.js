const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:latest';

/**
 * 1. Parse Markdown file for Test Metadata
 */
function parseMarkdown(mdPath) {
  const content = fs.readFileSync(mdPath, 'utf8');
  const getField = (regex, fallback = '') => (content.match(regex)?.[1] || fallback).trim();

  const baseName = path.basename(mdPath, '.md')
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^./, (chr) => chr.toUpperCase());

  return {
    pageClassName: `${baseName}Page`,
    pageFileName: `${baseName[0].toLowerCase() + baseName.slice(1)}Page.js`,
    title: getField(/^- Title:\s*(.+)$/im, 'Generated Test'),
    url: getField(/^- URL(?: under test)?:\s*(https?:\/\/[^\s]+)/im, 'https://www.amazon.in'),
    username: getField(/^- Username:\s*([^\s]+)/im),
    password: getField(/^- Password:\s*([^\s]+)/im),
    rawMarkdown: content,
  };
}

/**
 * 2. Fallback POM Implementation
 */
function fallbackPom(testCase) {
  const pageObjectCode = `class ${testCase.pageClassName} {
  constructor(page) {
    this.page = page;
    this.continueShoppingBtn = page.locator('button.a-button-text:has-text("Continue shopping"), button[alt="Continue shopping"]').first();
    this.sellLink = page.locator('a[data-csa-c-content-id*="sell"], a.nav-a:has-text("Sell")').first();
  }

  async goto() {
    await this.page.goto('${testCase.url}', { waitUntil: 'domcontentloaded' });
  }

  async clickContinueShoppingIfPresent() {
    try {
      if (await this.continueShoppingBtn.isVisible({ timeout: 3000 })) {
        await this.continueShoppingBtn.click();
        await this.page.waitForLoadState('domcontentloaded');
      }
    } catch {
      // Proceed if no interstitial prompt appears
    }
  }

  async clickSell() {
    await this.sellLink.waitFor({ state: 'visible', timeout: 10000 });
    await this.sellLink.click();
  }
}

module.exports = { ${testCase.pageClassName} };`;

  const specCode = `const { test, expect } = require('@playwright/test');
const { ${testCase.pageClassName} } = require('./pages/${testCase.pageFileName}');

test.describe('${testCase.title}', () => {
  test('Verify user can navigate to the Sell page', async ({ page }) => {
    const pageObj = new ${testCase.pageClassName}(page);
    
    await pageObj.goto();
    await pageObj.clickContinueShoppingIfPresent();
    await pageObj.clickSell();

    await expect(page).toHaveURL(/sell/i);
  });
});`;

  return { pageObjectCode, specCode };
}

/**
 * 3. Generate POM with Ollama
 */
async function generatePomWithOllama(testCase) {
  console.log(`🤖 Asking Ollama (${OLLAMA_MODEL}) to generate Page Object Model structure...`);

  const systemPrompt = `You are an expert Playwright automation engineer following strict Page Object Model (POM) architecture.

Output ONLY valid JSON with exactly two string keys:
1. "pageObjectCode": A CommonJS class named "${testCase.pageClassName}" initializing locators in the constructor (handling continue shopping with button.a-button-text:has-text("Continue shopping") and sell link), with atomic methods (goto, clickContinueShoppingIfPresent, clickSell). Ends with module.exports = { ${testCase.pageClassName} };.
2. "specCode": A Playwright test requiring '@playwright/test' and './pages/${testCase.pageFileName}', calling the actions and asserting toHaveURL(/sell/i).

Do not return Markdown or conversational text.`;

  const userPrompt = `Target URL: ${testCase.url}
Title: ${testCase.title}
Page Object Class Name: ${testCase.pageClassName}
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

    if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);

    const result = await response.json();
    let rawText = (result.response || '').trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
    const parsed = JSON.parse(rawText);

    const pageObjectCode = parsed.pageObjectCode || parsed.pageObject;
    const specCode = parsed.specCode || parsed.spec;

    if (!pageObjectCode || !specCode || pageObjectCode.trim().length === 0) {
      throw new Error('Incomplete POM code generated');
    }

    return { pageObjectCode, specCode };
  } catch (error) {
    console.error(`⚠️ Generation fallback triggered: ${error.message}`);
    return fallbackPom(testCase);
  }
}

/**
 * 4. Save POM Files Safely
 */
function savePomFiles(testCase, pomData) {
  const fallback = fallbackPom(testCase);
  const pageCode = pomData.pageObjectCode && pomData.pageObjectCode.trim().length > 0 ? pomData.pageObjectCode : fallback.pageObjectCode;
  const specCode = pomData.specCode && pomData.specCode.trim().length > 0 ? pomData.specCode : fallback.specCode;

  // 1. Write Page Object
  const pagePath = path.join(process.cwd(), 'tests', 'pages', testCase.pageFileName);
  fs.mkdirSync(path.dirname(pagePath), { recursive: true });
  fs.writeFileSync(pagePath, pageCode, 'utf8');
  console.log(`📄 Created Page Object: tests/pages/${testCase.pageFileName}`);

  // 2. Write Spec
  const specPath = path.join(process.cwd(), 'tests', 'generated-from-md.spec.js');
  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(specPath, specCode, 'utf8');
  console.log(`📄 Created Spec: tests/generated-from-md.spec.js`);

  return specPath;
}

/**
 * 5. Run Test
 */
function runTest(specFile) {
  const relativeSpec = path.relative(process.cwd(), specFile).replace(/\\/g, '/');
  console.log(`\n🚀 Executing POM Test: ${relativeSpec}`);

  try {
    const output = execSync(`npx playwright test "${relativeSpec}"`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'inherit',
      shell: true,
    });
    return { status: 'PASS', output };
  } catch (error) {
    return { status: 'FAIL', error: error.message };
  }
}

async function main() {
  const mdFile = process.argv[2];
  if (!mdFile) {
    console.error('Usage: node scripts/run-from-md.js specs/<test-name>.md');
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