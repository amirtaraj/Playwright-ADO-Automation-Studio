const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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
 * 2. Ollama Query Helper
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
 * 3. Agent Tool: Generate Initial Code
 */
async function generateInitialPom(testCase) {
  console.log(`🤖 [Agent Decision]: Analyzing Markdown & Generating POM structure using ${OLLAMA_MODEL}...`);

  const systemPrompt = `You are an autonomous Playwright QA Agent.
Generate clean CommonJS JavaScript implementing strict Page Object Model (POM).

Strict Rules:
1. "pageObjectCode": Class "${testCase.pageClassName}". Constructor(page) initializes all locators. Methods are atomic actions. DO NOT import '@playwright/test'. End with: module.exports = { ${testCase.pageClassName} };
2. "specCode": Imports test and expect from '@playwright/test'. Imports "${testCase.pageClassName}" from './pages/${testCase.pageFileName}'. Orchestrates actions and performs expect() assertions INSIDE the test callback.

Output JSON ONLY:
{
  "pageObjectCode": "string",
  "specCode": "string"
}`;

  const userPrompt = `Requirements:\nTitle: ${testCase.title}\nURL: ${testCase.url}\nSpecification:\n${testCase.rawMarkdown}`;

  const res = await askAgent(systemPrompt, userPrompt);
  if (!res || !res.pageObjectCode || !res.specCode) {
    throw new Error('Failed to generate initial test code from Ollama');
  }
  return res;
}

/**
 * 4. Agent Tool: Self-Heal and Repair on Failure
 */
async function healCodeWithAgent(testCase, currentPom, failureError) {
  console.log(`🔧 [Agent Action]: Self-healing code based on Playwright failure logs...`);

  const systemPrompt = `You are an autonomous self-healing Playwright QA Agent.
The previously generated Playwright test failed during execution.
Analyze the error stack trace, identify the broken selector, timing issue, or incorrect workflow step, and output the corrected code.

Strict Output JSON:
{
  "pageObjectCode": "string",
  "specCode": "string",
  "explanation": "short summary of the fix"
}`;

  const userPrompt = `Test Details:
Title: ${testCase.title}
Target URL: ${testCase.url}

Current Page Object Code:
${currentPom.pageObjectCode}

Current Spec Code:
${currentPom.specCode}

Playwright Error Output:
${failureError}

Please diagnose the issue and return the corrected "pageObjectCode" and "specCode".`;

  return await askAgent(systemPrompt, userPrompt);
}

/**
 * 5. File System Tool
 */
function savePomFiles(testCase, pomData) {
  fs.mkdirSync(path.dirname(testCase.pagePath), { recursive: true });
  fs.writeFileSync(testCase.pagePath, pomData.pageObjectCode, 'utf8');

  fs.mkdirSync(path.dirname(testCase.specPath), { recursive: true });
  fs.writeFileSync(testCase.specPath, pomData.specCode, 'utf8');
}

/**
 * 6. Execution Tool
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
    stdio: 'pipe', // Pipe logs so the agent can inspect the output
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
 * 7. Autonomous Agent Loop
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

  // Step 1: Agent creates initial POM
  let currentPom = await generateInitialPom(testCase);
  savePomFiles(testCase, currentPom);

  let attempt = 1;
  let testPassed = false;

  // Step 2: Agent execution & self-healing loop
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
      console.log(`🧐 [Agent Reasoning]: Analyzing test logs to fix selectors / steps...`);
      const healedData = await healCodeWithAgent(testCase, currentPom, execution.output);

      if (healedData && healedData.pageObjectCode && healedData.specCode) {
        console.log(`💡 [Agent Strategy]: ${healedData.explanation || 'Applied fixes to POM and Spec'}`);
        currentPom = healedData;
        savePomFiles(testCase, currentPom);
      } else {
        console.log('⚠️ Could not obtain structured fix from agent. Retrying with existing code...');
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