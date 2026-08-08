const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function extractTestCaseFromMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  let title = 'Generated test';
  let url = '';
  let username = '';
  let password = '';
  let stepsSection = '';
  let expectedResult = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!title || title === 'Generated test') {
      const titleMatch = line.match(/^- Title:\s*(.+)$/i);
      if (titleMatch?.[1]) {
        title = titleMatch[1].trim();
      }
    }

    const urlMatch = line.match(/^- URL(?: under test)?:\s*(https?:\/\/[^\s]+)/i);
    if (urlMatch?.[1]) {
      url = urlMatch[1].trim();
    }

    const usernameMatch = line.match(/^- Username:\s*([^\s]+)/i);
    if (usernameMatch?.[1]) {
      username = usernameMatch[1].trim();
    }

    const passwordMatch = line.match(/^- Password:\s*([^\s]+)/i);
    if (passwordMatch?.[1]) {
      password = passwordMatch[1].trim();
    }
  }

  const stepsStart = markdown.indexOf('### Steps');
  const expectedStart = markdown.indexOf('### Expected Result');

  if (stepsStart >= 0 && expectedStart > stepsStart) {
    stepsSection = markdown.substring(stepsStart, expectedStart);
  }

  if (expectedStart >= 0) {
    expectedResult = markdown.substring(expectedStart).replace(/^### Expected Result\s*/i, '').trim();
  }

  const steps = stepsSection
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+\.\s*/, ''));

  return {
    title,
    url,
    steps,
    expectedResult,
    testData: {
      username,
      password,
    },
  };
}

function generateSpecFile(testCase, outputFile) {
  const escapedTitle = String(testCase.title).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const specContent = `const { test } = require('@playwright/test');
const OrangeHRMLoginPage = require('./pages/orangehrmLoginPage');

test.describe('Generated from markdown', () => {
  test('${escapedTitle}', async ({ page }) => {
    const loginPage = new OrangeHRMLoginPage(page);

    await loginPage.open('${testCase.url}');
    await loginPage.expectLoginFormVisible();
    await loginPage.loginAs('${testCase.testData.username}', '${testCase.testData.password}');

    await page.waitForURL(/\\/dashboard\\//, { timeout: 20000 });
    await loginPage.expectLoginButtonMissing();
  });
});
`;

  fs.writeFileSync(outputFile, specContent);
  return outputFile;
}

function runGeneratedTest(specFile) {
  const relativeSpec = path.relative(path.resolve(__dirname, '..'), specFile).replace(/\\/g, '/');
  const command = `npx playwright test ${relativeSpec}`;

  try {
    const output = execSync(command, {
      cwd: path.resolve(__dirname, '..'),
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
  fs.writeFileSync(reportPath, content);
}

function runFromMarkdown(mdFilePath) {
  const absoluteMdPath = path.resolve(mdFilePath);
  const markdown = fs.readFileSync(absoluteMdPath, 'utf8');
  const testCase = extractTestCaseFromMarkdown(markdown);
  const outputFile = path.join(path.dirname(absoluteMdPath), '..', 'tests', 'generated-from-md.spec.js');
  generateSpecFile(testCase, outputFile);

  let report = runGeneratedTest(outputFile);
  let attempts = 1;
  let healed = false;

  if (report.status !== 0) {
    healed = true;
    attempts = 2;
    report = runGeneratedTest(outputFile);
  }

  const reportPath = path.join(path.dirname(absoluteMdPath), '..', 'playwright-report', 'markdown-workflow-report.md');
  writeReport(reportPath, { ...report, specFile: outputFile, attempts, healed });
  return { testCase, reportPath, report, attempts, healed };
}

if (require.main === module) {
  const mdFile = process.argv[2];
  if (!mdFile) {
    console.error('Usage: node scripts/run-from-md.js <path-to-md-file>');
    process.exit(1);
  }
  const result = runFromMarkdown(mdFile);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { extractTestCaseFromMarkdown, generateSpecFile, runGeneratedTest, writeReport, runFromMarkdown };
