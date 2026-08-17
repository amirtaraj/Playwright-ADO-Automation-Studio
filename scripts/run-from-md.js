const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b'; // adjust to your installed model

/**
 * 1. Parse Markdown file for Test Metadata
 */
function parseMarkdown(mdPath) {
  const content = fs.readFileSync(mdPath, 'utf8');
  const getField = (regex, fallback = '') => (content.match(regex)?.[1] || fallback).trim();

  return {
    title: getField(/^- Title:\s*(.+)$/im, 'Generated Test'),
    url: getField(/^- URL(?: under test)?:\s*(https?:\/\/[^\s]+)/im, 'https://example.com'),
    username: getField(/^- Username:\s*([^\s]+)/im),
    password: getField(/^- Password:\s*([^\s]+)/im),
    rawMarkdown: content,
  };
}

/**
 * 2. Generate Playwright Code via Ollama
 */
async function generateTestCodeWithOllama(testCase) {
  console.log(`🤖 Prompting local Ollama model (${OLLAMA_MODEL})...`);

  const systemPrompt = `You are an expert Playwright automation engineer.
Generate clean, valid Playwright test code in CommonJS JavaScript.
Strict Rules:
- Return ONLY the executable JavaScript code.
- Do NOT wrap code in markdown tags (\`\`\`javascript or \`\`\`).
- Must import { test, expect } from '@playwright/test'.
- Follow every step defined in the user's markdown specification.`;

  const userPrompt = `Generate a Playwright test specification:

Title: ${testCase.title}
Target URL: ${testCase.url}
${testCase.username ? `Credentials: Username: ${testCase.username} | Password: ${testCase.password}` : ''}

Markdown Instructions:
${testCase.rawMarkdown}`;

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system: systemPrompt,
        prompt: userPrompt,
        stream: false,
        options: { temperature: 0.1 }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    let code = data.response.trim();

    // Clean up codeblock markers if generated
    return code.replace(/^```(?:javascript|js)?\n?/i, '').replace(/\n?```$/i, '');
  } catch (error) {
    console.error(`⚠️ Ollama call failed: ${error.message}`);
    console.log('💡 Falling back to standard template generation...');
    return fallbackTemplate(testCase);
  }
}

function fallbackTemplate(testCase) {
  const escapedTitle = testCase.title.replace(/'/g, "\\'");
  return `const { test, expect } = require('@playwright/test');

test.describe('Markdown Automation', () => {
  test('${escapedTitle}', async ({ page }) => {
    await page.goto('${testCase.url}', { waitUntil: 'domcontentloaded' });
  });
});`;
}

/**
 * 3. Save spec file
 */
function saveSpecFile(code, outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, code, 'utf8');
  return outputFile;
}

/**
 * 4. Execute Playwright Test
 */
function runTest(specFile) {
  const projectRoot = process.cwd();
  const relativeSpec = path.relative(projectRoot, specFile).replace(/\\/g, '/');

  console.log(`\n🚀 Executing Playwright Test: ${relativeSpec}`);

  try {
    const output = execSync(`npx playwright test "${relativeSpec}"`, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'inherit',
      shell: true,
    });
    return { status: 'PASS', output };
  } catch (error) {
    return { status: 'FAIL', error: error.message };
  }
}

/**
 * Main Entry Point
 */
async function main() {
  const mdFile = process.argv[2];

  if (!mdFile) {
    console.error('❌ Error: Missing markdown file argument.');
    console.log('Usage: node scripts/run-from-md.js specs/<file-name>.md');
    process.exit(1);
  }

  const absoluteMdPath = path.resolve(process.cwd(), mdFile);
  if (!fs.existsSync(absoluteMdPath)) {
    console.error(`❌ Error: File not found at ${absoluteMdPath}`);
    process.exit(1);
  }

  console.log(`📄 Reading markdown file: ${mdFile}`);
  const testCase = parseMarkdown(absoluteMdPath);

  const specCode = await generateTestCodeWithOllama(testCase);
  const specFile = path.join(process.cwd(), 'tests', 'generated-from-md.spec.js');
  saveSpecFile(specCode, specFile);

  console.log(`✅ Test spec saved to: tests/generated-from-md.spec.js`);

  const result = runTest(specFile);
  console.log(`\n📊 Execution Result: ${result.status}`);
}

if (require.main === module) {
  main();
}