const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const OLLAMA_HOST =
  process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL || 'qwen2.5-coder:latest';

const GENERATED_SPEC_FILE =
  process.env.GENERATED_SPEC_FILE || 'generated-from-md.spec.js';

const OLLAMA_TIMEOUT_MS =
  Number(process.env.OLLAMA_TIMEOUT_MS) || 6000000;

/**
 * Converts a file name or title into a valid PascalCase JavaScript name.
 *
 * Example:
 *   amazon-sell-test -> AmazonSellTest
 *   Login Test       -> LoginTest
 */
function toPascalCase(value) {
  const normalizedValue = String(value || '')
    .replace(/\.md$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();

  const pascalCaseValue = normalizedValue
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join('');

  const safeValue = pascalCaseValue || 'GeneratedTest';

  return /^[0-9]/.test(safeValue)
    ? `Test${safeValue}`
    : safeValue;
}

/**
 * Converts PascalCase to camelCase.
 *
 * Example:
 *   AmazonSellTest -> amazonSellTest
 */
function toCamelCase(value) {
  if (!value) {
    return 'generatedTest';
  }

  return value.charAt(0).toLowerCase() + value.slice(1);
}

/**
 * Safely reads a Markdown metadata field.
 *
 * Supported examples:
 *   - Title: Login Test
 *   Title: Login Test
 *   **Title:** Login Test
 */
function getMarkdownField(content, fieldNames, fallback = '') {
  for (const fieldName of fieldNames) {
    const escapedFieldName = fieldName.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    const patterns = [
      new RegExp(
        `^\\s*[-*]?\\s*${escapedFieldName}\\s*:\\s*(.+?)\\s*$`,
        'im'
      ),
      new RegExp(
        `^\\s*\\*\\*${escapedFieldName}\\s*:\\*\\*\\s*(.+?)\\s*$`,
        'im'
      ),
      new RegExp(
        `^\\s*\\*\\*${escapedFieldName}\\*\\*\\s*:\\s*(.+?)\\s*$`,
        'im'
      ),
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);

      if (match?.[1]) {
        return match[1].trim();
      }
    }
  }

  return fallback;
}

/**
 * Extracts a Markdown section by heading.
 *
 * Supported heading examples:
 *   ## Steps
 *   ### Test Steps
 *   ## Expected Results
 */
function extractMarkdownSection(
  content,
  possibleHeadings
) {
  const lines = content.split(/\r?\n/);
  let insideTargetSection = false;
  let targetHeadingLevel = 0;
  const sectionLines = [];

  for (const line of lines) {
    const headingMatch = line.match(
      /^(#{1,6})\s+(.+?)\s*$/
    );

    if (headingMatch) {
      const headingLevel = headingMatch[1].length;
      const headingText = headingMatch[2]
        .replace(/\*\*/g, '')
        .replace(/:$/, '')
        .trim()
        .toLowerCase();

      const isTargetHeading = possibleHeadings.some(
        (heading) =>
          headingText === heading.toLowerCase() ||
          headingText.startsWith(
            `${heading.toLowerCase()} `
          )
      );

      if (isTargetHeading) {
        insideTargetSection = true;
        targetHeadingLevel = headingLevel;
        continue;
      }

      if (
        insideTargetSection &&
        headingLevel <= targetHeadingLevel
      ) {
        break;
      }
    }

    if (insideTargetSection) {
      sectionLines.push(line);
    }
  }

  return sectionLines.join('\n').trim();
}

/**
 * Decodes common HTML entities that may appear when code or Markdown
 * is copied from a rich-text editor.
 */
function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(
      /<\/?strong(?:\s+[^>]*)?>/gi,
      ''
    );
}

/**
 * Extracts metadata and test instructions from the Markdown file.
 *
 * The complete Markdown is preserved so that Ollama receives every
 * instruction provided by the user.
 */
function parseMarkdown(mdPath) {
  const originalContent = fs.readFileSync(
    mdPath,
    'utf8'
  );

  const content = decodeHtmlEntities(originalContent);

  const markdownFileName = path.basename(
    mdPath,
    path.extname(mdPath)
  );

  const title = getMarkdownField(
    content,
    ['Title', 'Test Title', 'Test Case'],
    markdownFileName
  );

  const classBaseName = toPascalCase(
    title || markdownFileName
  );

  const steps = extractMarkdownSection(content, [
    'Steps',
    'Test Steps',
    'Test Procedure',
    'Procedure',
    'Actions',
  ]);

  const expectedResults = extractMarkdownSection(
    content,
    [
      'Expected Results',
      'Expected Result',
      'Expected',
      'Assertions',
      'Validations',
    ]
  );

  const preconditions = extractMarkdownSection(
    content,
    [
      'Preconditions',
      'Precondition',
      'Prerequisites',
      'Setup',
    ]
  );

  const testData = extractMarkdownSection(
    content,
    [
      'Test Data',
      'Data',
      'Input Data',
      'Inputs',
    ]
  );

  const url = getMarkdownField(
    content,
    [
      'URL',
      'URL under test',
      'Base URL',
      'Application URL',
    ],
    ''
  );

  return {
    markdownPath: mdPath,
    markdownFileName,
    title,
    pageClassName: `${classBaseName}Page`,
    pageFileName: `${toCamelCase(
      classBaseName
    )}Page.js`,
    specFileName: GENERATED_SPEC_FILE,
    url,
    steps,
    expectedResults,
    preconditions,
    testData,
    rawMarkdown: content,
  };
}

/**
 * Validates that the Markdown contains sufficient test instructions.
 *
 * A dedicated Steps section is preferred. If it is missing, the model
 * can still process the complete Markdown, but metadata-only files are
 * rejected.
 */
function validateMarkdown(testCase) {
  if (!testCase.rawMarkdown.trim()) {
    throw new Error('Markdown file is empty.');
  }

  if (
    !testCase.steps &&
    !testCase.expectedResults &&
    testCase.rawMarkdown.trim().length < 30
  ) {
    throw new Error(
      'Markdown does not contain sufficient test steps or expected results.'
    );
  }
}

/**
 * Creates the strict system prompt used by Ollama.
 *
 * Important behavior:
 *   1. Generate only what is explicitly written in the Markdown.
 *   2. Do not add Amazon-specific or reusable sample actions.
 *   3. Do not invent test data, credentials, steps, or validations.
 *   4. Use environment variables for sensitive values.
 */
function createSystemPrompt(testCase) {
  return `
You are an expert Playwright JavaScript automation engineer.

Generate a Playwright test strictly and exclusively from the supplied Markdown test case.

STRICT SOURCE-OF-TRUTH RULES:

1. The supplied Markdown is the only source of truth.
2. Implement every executable test step from the Markdown in the same logical order.
3. Implement every expected result or validation from the Markdown.
4. Do not invent additional navigation, clicks, inputs, assertions, waits, test data, URLs, credentials, or business behavior.
5. Do not add sample actions from unrelated applications.
6. Do not add Amazon-specific logic unless Amazon and that behavior are explicitly written in the Markdown.
7. Do not add login logic unless login is explicitly required by the Markdown.
8. Do not hard-code usernames, passwords, tokens, OTP values, or secrets.
9. When the Markdown references sensitive values, read them from process.env using a meaningful uppercase variable name.
10. Do not silently skip a Markdown step.
11. If a step cannot be translated safely because essential information is missing, generate an explicit JavaScript throw new Error(...) at the exact point of that step. The error must clearly state what Markdown information is missing.
12. Do not create assertions that are not supported by an expected result in the Markdown.
13. Do not use page.waitForTimeout().
14. Prefer Playwright auto-waiting and web-first assertions.
15. Prefer getByRole, getByLabel, getByPlaceholder, and getByText when supported by the Markdown.
16. Use locator only when a semantic locator cannot be derived.
17. Do not invent data-testid, CSS selectors, XPath, labels, roles, or accessible names that are not stated or reasonably identified from the Markdown.
18. Keep actions in the Page Object and assertions in the spec where practical.
19. Use CommonJS require and module.exports syntax.
20. Return valid JSON only. Do not return Markdown fences or explanatory text.

PAGE OBJECT REQUIREMENTS:

1. Create exactly one CommonJS class named "${testCase.pageClassName}".
2. The constructor must receive page and assign this.page = page.
3. Create reusable locators in the constructor only when they are required by the Markdown.
4. Create small action methods based only on the Markdown steps.
5. Keep method names meaningful and specific to the described action.
6. Add a goto method only when the Markdown supplies a URL or explicitly requires navigation.
7. End the Page Object with:
   module.exports = { ${testCase.pageClassName} };

SPEC REQUIREMENTS:

1. Import test and expect from "@playwright/test".
2. Import the Page Object from:
   "./pages/${testCase.pageFileName}"
3. Use the Markdown title as the test.describe title.
4. Use one test unless the Markdown explicitly defines multiple independent test cases or scenarios.
5. Execute the Markdown steps in their documented order.
6. Add only the validations stated in the Markdown expected results.
7. Do not use test.skip, test.fixme, or commented placeholder steps.
8. If required information is missing, fail clearly with throw new Error instead of guessing.

OUTPUT:

Return one JSON object with exactly these two string properties:

{
  "pageObjectCode": "complete JavaScript Page Object code",
  "specCode": "complete Playwright spec code"
}
`.trim();
}

/**
 * Creates a structured model prompt while preserving the complete
 * Markdown.
 */
function createUserPrompt(testCase) {
  return `
TEST METADATA

Title:
${testCase.title || '[Not provided]'}

URL:
${testCase.url || '[Not provided]'}

Page Object Class:
${testCase.pageClassName}

Page Object File:
${testCase.pageFileName}

PRECONDITIONS SECTION

${testCase.preconditions || '[No dedicated preconditions section provided]'}

TEST DATA SECTION

${testCase.testData || '[No dedicated test data section provided]'}

STEPS SECTION

${testCase.steps || '[No dedicated steps section found. Read the complete Markdown below.]'}

EXPECTED RESULTS SECTION

${testCase.expectedResults || '[No dedicated expected results section found. Read the complete Markdown below.]'}

COMPLETE MARKDOWN SOURCE

${testCase.rawMarkdown}
`.trim();
}

/**
 * Removes accidental Markdown code fences from Ollama output.
 */
function removeCodeFences(value) {
  return String(value || '')
    .trim()
    .replace(/^```(?:json|javascript|js)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Extracts a JSON object if the model adds text around it.
 */
function extractJsonObject(value) {
  const cleanedValue = removeCodeFences(value);

  try {
    return JSON.parse(cleanedValue);
  } catch {
    const firstBrace = cleanedValue.indexOf('{');
    const lastBrace = cleanedValue.lastIndexOf('}');

    if (
      firstBrace === -1 ||
      lastBrace === -1 ||
      lastBrace <= firstBrace
    ) {
      throw new Error(
        'Ollama response does not contain a JSON object.'
      );
    }

    return JSON.parse(
      cleanedValue.slice(firstBrace, lastBrace + 1)
    );
  }
}

/**
 * Performs basic safety and structure validation on generated code.
 */
function validateGeneratedCode(testCase, generatedData) {
  const { pageObjectCode, specCode } = generatedData;

  if (
    typeof pageObjectCode !== 'string' ||
    !pageObjectCode.trim()
  ) {
    throw new Error(
      'Ollama did not generate pageObjectCode.'
    );
  }

  if (
    typeof specCode !== 'string' ||
    !specCode.trim()
  ) {
    throw new Error(
      'Ollama did not generate specCode.'
    );
  }

  const expectedClassDeclaration =
    `class ${testCase.pageClassName}`;

  const expectedExport =
    `module.exports = { ${testCase.pageClassName} }`;

  if (!pageObjectCode.includes(expectedClassDeclaration)) {
    throw new Error(
      `Generated Page Object must contain "${expectedClassDeclaration}".`
    );
  }

  if (!pageObjectCode.includes(expectedExport)) {
    throw new Error(
      `Generated Page Object must export "${testCase.pageClassName}".`
    );
  }

  if (
    !specCode.includes("require('@playwright/test')") &&
    !specCode.includes(
      'require("@playwright/test")'
    )
  ) {
    throw new Error(
      'Generated spec must import @playwright/test.'
    );
  }

  if (
    specCode.includes('test.skip(') ||
    specCode.includes('test.fixme(')
  ) {
    throw new Error(
      'Generated spec must not skip or mark tests as fixme.'
    );
  }

  if (
    pageObjectCode.includes('waitForTimeout(') ||
    specCode.includes('waitForTimeout(')
  ) {
    throw new Error(
      'Generated code must not use waitForTimeout().'
    );
  }

  const forbiddenHardCodedExamples = [
    'continueShoppingBtn',
    'clickContinueShoppingIfPresent',
    'clickSell',
    'a.nav-a:has-text("Sell")',
    "a.nav-a:has-text('Sell')",
  ];

  for (const forbiddenValue of forbiddenHardCodedExamples) {
    const markdownContainsValue =
      testCase.rawMarkdown
        .toLowerCase()
        .includes(
          forbiddenValue.toLowerCase()
        );

    const generatedContainsValue =
      pageObjectCode.includes(forbiddenValue) ||
      specCode.includes(forbiddenValue);

    if (
      generatedContainsValue &&
      !markdownContainsValue
    ) {
      throw new Error(
        `Generated code added behavior not found in the Markdown: ${forbiddenValue}`
      );
    }
  }

  return {
    pageObjectCode: pageObjectCode.trim(),
    specCode: specCode.trim(),
  };
}

/**
 * Calls the Ollama generation API.
 *
 * No generic fallback test is created. A fallback could introduce
 * behavior that is not present in the Markdown, violating strict
 * step-based generation.
 */
async function generatePomWithOllama(testCase) {
  console.log(
    `Asking Ollama (${OLLAMA_MODEL}) to generate the test strictly from Markdown steps...`
  );

  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    OLLAMA_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${OLLAMA_HOST}/api/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          system: createSystemPrompt(testCase),
          prompt: createUserPrompt(testCase),
          format: 'json',
          stream: false,
          options: {
            temperature: 0,
            top_p: 0.1,
            seed: 42,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response
        .text()
        .catch(() => '');

      throw new Error(
        `Ollama API returned ${response.status} ${response.statusText}. ${errorBody}`.trim()
      );
    }

    const result = await response.json();

    if (!result.response) {
      throw new Error(
        'Ollama returned an empty response.'
      );
    }

    const parsedResponse = extractJsonObject(
      result.response
    );

    const generatedData = {
      pageObjectCode:
        parsedResponse.pageObjectCode,
      specCode: parsedResponse.specCode,
    };

    return validateGeneratedCode(
      testCase,
      generatedData
    );
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        `Ollama request exceeded ${OLLAMA_TIMEOUT_MS} milliseconds.`
      );
    }

    throw new Error(
      `Test generation failed: ${error.message}`
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Creates a timestamped backup before replacing an existing generated
 * file.
 */
function backupExistingFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const backupPath = `${filePath}.${timestamp}.bak`;

  fs.copyFileSync(filePath, backupPath);

  console.log(
    `Backup created: ${path.relative(
      process.cwd(),
      backupPath
    )}`
  );
}

/**
 * Writes the generated Page Object and test spec.
 */
function savePomFiles(testCase, generatedData) {
  const pagePath = path.join(
    process.cwd(),
    'tests',
    'pages',
    testCase.pageFileName
  );

  const specPath = path.join(
    process.cwd(),
    'tests',
    testCase.specFileName
  );

  fs.mkdirSync(path.dirname(pagePath), {
    recursive: true,
  });

  fs.mkdirSync(path.dirname(specPath), {
    recursive: true,
  });

  backupExistingFile(pagePath);
  backupExistingFile(specPath);

  fs.writeFileSync(
    pagePath,
    `${generatedData.pageObjectCode.trim()}\n`,
    'utf8'
  );

  fs.writeFileSync(
    specPath,
    `${generatedData.specCode.trim()}\n`,
    'utf8'
  );

  console.log(
    `Created Page Object: ${path.relative(
      process.cwd(),
      pagePath
    )}`
  );

  console.log(
    `Created Spec: ${path.relative(
      process.cwd(),
      specPath
    )}`
  );

  return {
    pagePath,
    specPath,
  };
}

/**
 * Runs Playwright without constructing a shell command.
 *
 * spawnSync with shell:false avoids command injection through file
 * names and handles arguments safely.
 */
function runTest(specFile) {
  const relativeSpec = path
    .relative(process.cwd(), specFile)
    .replace(/\\/g, '/');

  console.log(
    `\nExecuting generated Playwright test: ${relativeSpec}`
  );

  const command =
    process.platform === 'win32'
      ? 'npx.cmd'
      : 'npx';

  const result = spawnSync(
    command,
    [
      'playwright',
      'test',
      relativeSpec,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'inherit',
      shell: false,
      env: process.env,
    }
  );

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
      error:
        `Playwright exited with code ${result.status}`,
      exitCode: result.status,
    };
  }

  return {
    status: 'PASS',
    exitCode: result.status,
  };
}

/**
 * Prints parsed information to make generation traceable.
 */
function printTestCaseSummary(testCase) {
  console.log('\nMarkdown Test Summary');
  console.log(`Title: ${testCase.title}`);
  console.log(
    `Page Object: ${testCase.pageClassName}`
  );
  console.log(
    `Page File: ${testCase.pageFileName}`
  );
  console.log(
    `URL: ${testCase.url || 'Not provided'}`
  );
  console.log(
    `Dedicated Steps Section: ${
      testCase.steps ? 'Yes' : 'No'
    }`
  );
  console.log(
    `Dedicated Expected Results Section: ${
      testCase.expectedResults ? 'Yes' : 'No'
    }`
  );
}

/**
 * Main execution flow.
 */
async function main() {
  const mdFile = process.argv[2];

  if (!mdFile) {
    console.error(
      'Usage: node scripts/run-from-md.js specs/<test-name>.md'
    );
    process.exitCode = 1;
    return;
  }

  const absoluteMdPath = path.resolve(
    process.cwd(),
    mdFile
  );

  if (!fs.existsSync(absoluteMdPath)) {
    console.error(
      `Error: Markdown file not found at ${absoluteMdPath}`
    );
    process.exitCode = 1;
    return;
  }

  if (
    path.extname(absoluteMdPath).toLowerCase() !==
    '.md'
  ) {
    console.error(
      'Error: Input file must have a .md extension.'
    );
    process.exitCode = 1;
    return;
  }

  try {
    const testCase = parseMarkdown(
      absoluteMdPath
    );

    validateMarkdown(testCase);
    printTestCaseSummary(testCase);

    const generatedData =
      await generatePomWithOllama(testCase);

    const { specPath } = savePomFiles(
      testCase,
      generatedData
    );

    const result = runTest(specPath);

    console.log(
      `\nExecution Result: ${result.status}`
    );

    if (result.status === 'FAIL') {
      console.error(result.error);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseMarkdown,
  validateMarkdown,
  generatePomWithOllama,
  savePomFiles,
  runTest,
  toPascalCase,
  toCamelCase,
};