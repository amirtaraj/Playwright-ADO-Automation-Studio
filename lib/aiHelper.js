async function generatePomFromMarkdown(testCase) {
  const prompt = `
You are an expert Playwright automation engineer following strict Page Object Model (POM) design patterns.

Markdown Specifications:
- Title: ${testCase.title}
- Target URL: ${testCase.url}
- Page Object Class Name: ${testCase.pageClassName}
- Page Object File Name: ${testCase.pageFileName}

Full Markdown Content:
${testCase.rawMarkdown}

Strict Architecture Rules:
1. "pageObjectCode" (Page Object Class):
   - Constructor: Initialize ALL page locators/xpaths as instance properties (e.g., this.sellLink, this.continueShoppingButton).
   - Methods: ONLY fine-grained, atomic interaction methods (e.g., "async clickSell()", "async clickContinueShopping()").
   - DO NOT bundle full workflows into composite methods like "navigateToSellPage()".
   - DO NOT include page.goto() inside action methods; provide a standalone "async goto() { await this.page.goto('${testCase.url}', { waitUntil: 'domcontentloaded' }); }" or let the test orchestrate it.
   - DO NOT include assertions.
   - End with "module.exports = { ${testCase.pageClassName} };".

2. "specCode" (Test File):
   - Import test and expect from "@playwright/test".
   - Import "${testCase.pageClassName}" from "./pages/${testCase.pageFileName}".
   - Orchestrate the step-by-step workflow inside the test: navigate, call individual atomic page methods, and perform assertions (expect).

Respond ONLY with a JSON object in this exact schema:
{
  "pageObjectCode": "string",
  "specCode": "string"
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content.trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('[Ollama POM Generator Error]:', error.message);
    return null;
  }
}