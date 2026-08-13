const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 1. Parse Markdown file for Test Metadata
 */
function parseMarkdown(mdPath) {
  const content = fs.readFileSync(mdPath, 'utf8');

  // Regex extractors for clean key-value matching
  const getField = (regex, fallback = '') => (content.match(regex)?.[1] || fallback).trim();

  return {
    title: getField(/^- Title:\s*(.+)$/im, 'Generated Test'),
    url: getField(/^- URL(?: under test)?:\s*(https?:\/\/[^\s]+)/im, 'https://example.com'),
    username: getField(/^- Username:\s*([^\s]+)/im),
    password: getField(/^- Password:\s*([^\s]+)/im),
    rawMarkdown: content
  };
}

/**
 * 2. Generate Playwright Spec File with Copilot Prompting Comments
 */
function generateSpecFile(testCase, outputFile) {
  const escapedTitle = testCase.title.replace(/'/g, "\\'");
  const hasCredentials = Boolean(testCase.username && testCase.password);

  const specContent = `const { test, expect } = require('@playwright/test');

/**
 * SOURCE MARKDOWN WORKFLOW TEST
 * Title: ${testCase.title}
 * Target URL: ${testCase.url}
 *
 * COPILOT INSTRUCTION: 
 * Implement the step-by-step logic described in the Markdown below.
 */

/*
${testCase.rawMarkdown}
*/

test.describe('Markdown Automation', () => {
  test('${escapedTitle}', async ({ page }) => {
    // Step 1: Navigate to target URL
    await page.goto('${testCase.url}', { waitUntil: 'domcontentloaded' });

    ${hasCredentials ? `// Step 2: Fill credentials if present
    const usernameInput = page.locator('input[name="username"], input[placeholder*="Username" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"], button:has-text("Login")').first();

    if (await usernameInput.isVisible()) {
      await usernameInput.fill('${testCase.username}');
      await passwordInput.fill('${testCase.password}');
      await submitBtn.click();
    }` : '// No authentication credentials provided in markdown.'}

    // COPILOT: Add additional test steps below according to the markdown instructions
  });
});
`;

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, specContent);
  return outputFile;
}

/**
 * 3. Execute Playwright Test
 */
function runTest(specFile) {
  const projectRoot = process.cwd();
  const relativeSpec = path.relative(projectRoot, specFile).replace(/\\/g, '/');
  
  console.log(`\n🚀 Executing Playwright Test: ${relativeSpec}`);

  try {
    const output = execSync(`npx playwright test "${relativeSpec}"`, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'inherit', // Streams live logs directly to VS Code terminal
      shell: true,
    });
    return { status: 'PASS', output };
  } catch (error) {
    return { status: 'FAIL', error: error.message };
  }
}

/**
 * Main Workflow Entry Point
 */
function main() {
  const mdFile = process.argv[2];

  if (!mdFile) {
    console.error('❌ Error: Missing markdown file argument.');
    console.log('Usage: node scripts/run-from-md.js <path-to-markdown-file>');
    process.exit(1);
  }

  const absoluteMdPath = path.resolve(process.cwd(), mdFile);
  if (!fs.existsSync(absoluteMdPath)) {
    console.error(`❌ Error: File not found at ${absoluteMdPath}`);
    process.exit(1);
  }

  console.log(`📄 Reading markdown file: ${mdFile}`);
  const testCase = parseMarkdown(absoluteMdPath);

  // Outputs generated test directly into tests/ folder so VS Code Playwright plugin detects it
  const specFile = path.join(process.cwd(), 'tests', 'generated-from-md.spec.js');
  generateSpecFile(testCase, specFile);

  console.log(`✅ Generated spec file: tests/generated-from-md.spec.js`);

  // Run test
  const result = runTest(specFile);
  console.log(`\n📊 Execution Result: ${result.status}`);
}

if (require.main === module) {
  main();
}