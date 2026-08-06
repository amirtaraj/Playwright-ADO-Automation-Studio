const OpenAI = require('openai');
require('dotenv').config();

// Connects directly to local Ollama via http://localhost:11434/v1
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
  baseURL: process.env.OPENAI_BASE_URL || 'http://localhost:11434/v1'
});

async function healSelector(failingSelector, pageHtml, targetAction) {
  const prompt = `
  You are an automated QA engineer self-healing a Playwright test.
  
  The selector "${failingSelector}" failed during action: "${targetAction}".
  
  Page HTML snippet:
  \`\`\`html
  ${pageHtml.substring(0, 3000)}
  \`\`\`
  
  Identify the updated CSS, XPath, or Playwright locator.
  Respond ONLY with a JSON object in this format:
  {
    "newSelector": "string",
    "explanation": "string"
  }
  `;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || 'qwen2.5-coder',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('[Ollama Self-Healer Error]:', error.message);
    return null;
  }
}

module.exports = { healSelector };