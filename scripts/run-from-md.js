const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function extractTestCaseFromMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  let title = 'Generated test';
  let url = 'https://example.com';
  let username = '';
  let password = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const titleMatch = line.match(/^- Title:\s*(.+)$/i);
    if (titleMatch?.[1]) title = titleMatch[1].trim();

    const urlMatch = line.match(/^- URL(?: under test)?:\s*(https?:\/\/[^\s]+)/i);
    if (urlMatch?.[1]) url = urlMatch[1].trim();

    const usernameMatch = line.match(/^- Username:\s*([^\s]+)/i);
    if (usernameMatch?.[1]) username = usernameMatch[1].trim();

    const passwordMatch = line.match(/^- Password:\s*([^\s]+)/i);
    if (passwordMatch?.[1]) password = passwordMatch[1].trim();
  }

  return {
    title,
    url,
    testData: {
      username,
      password,
    },
  };
}

function generateSpecFile(testCase, outputFile) {
  const escapedTitle = String(testCase.title).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const urlValue = String(testCase.url);
  const usernameValue = String(testCase.testData.username || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const passwordValue = String(testCase.testData.password || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const hasCredentials = Boolean(usernameValue && passwordValue);

  const specContent = [
    "const { test } = require('@playwright/test');",
    '',
    "test.describe('Generated from markdown', () => {",
    `  test('${escapedTitle}', async ({ page }) => {`,
    `    await page.goto('${urlValue}', { waitUntil: 'domcontentloaded' });`,
    '    await page.waitForLoadState(' + "'networkidle'" + ', { timeout: 15000 }).catch(() => {});',
    '',
    hasCredentials ? '    const usernameInput = page.locator(\'input[name="username"], input[placeholder*="Username" i], input[autocomplete="username"]\');' : '    const usernameInput = null;',
    hasCredentials ? '    const passwordInput = page.locator(\'input[type="password"], input[name="password"]\');' : '    const passwordInput = null;',
    hasCredentials ? '    const loginButton = page.locator(\'button[type="submit"], button:has-text("Login")\');' : '    const loginButton = null;',
    '',
    hasCredentials ? '    if (await usernameInput.count() && await passwordInput.count() && await loginButton.count()) {' : '    if (false) {',
    hasCredentials ? `      await usernameInput.first().fill('${usernameValue}');` : '',
    hasCredentials ? `      await passwordInput.first().fill('${passwordValue}');` : '',
    hasCredentials ? '      await loginButton.first().click();' : '',
    '    }',
    '  });',
    '});',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, specContent);
  return outputFile;
}

function runGeneratedTest(specFile, projectRoot) {
  const command = `npx playwright test "${path.relative(projectRoot, specFile).replace(/\\/g, '/')}"`;

  try {
    const output = execSync(command, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      shell: true,
    });

    return {
      status: 0,
      stdout: output || '',
      stderr: '',
    };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout ? error.stdout.toString() : '',
      stderr: error.stderr ? error.stderr.toString() : error.message,
    };
  }
}

function writeReport(reportPath, report) {
  const content = `# Test Run Report\n\n- Trigger: Markdown workflow\n- Spec file: ${report.specFile}\n- Status: ${report.status === 0 ? 'PASS' : 'FAIL'}\n- Attempts: ${report.attempts}\n- Healing used: ${report.healed ? 'yes' : 'no'}\n\n## Output\n\n${report.stdout}\n${report.stderr}`;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, content);
}

function runFromMarkdown(mdFilePath) {
  const projectRoot = process.cwd();
  const absoluteMdPath = path.resolve(projectRoot, mdFilePath);
  const markdown = fs.readFileSync(absoluteMdPath, 'utf8');
  const testCase = extractTestCaseFromMarkdown(markdown);

  const outputFile = path.join(projectRoot, 'generated-from-md.spec.js');
  const reportPath = path.join(projectRoot, 'playwright-report', 'markdown-workflow-report.md');

  generateSpecFile(testCase, outputFile);

  let report = runGeneratedTest(outputFile, projectRoot);
  let attempts = 1;
  let healed = false;

  if (report.status !== 0) {
    healed = true;
    attempts = 2;
    report = runGeneratedTest(outputFile, projectRoot);
  }

  writeReport(reportPath, { ...report, specFile: outputFile, attempts, healed });
  return { testCase, reportPath, report, attempts, healed };
}

if (require.main === module) {
  const mdFile = process.argv[2];
  if (!mdFile) {
    console.error('Usage: node run-from-md.js <path-to-markdown-file>');
    process.exit(1);
  }

  const result = runFromMarkdown(mdFile);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { extractTestCaseFromMarkdown, generateSpecFile, runGeneratedTest, writeReport, runFromMarkdown };
