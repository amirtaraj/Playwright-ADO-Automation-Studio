const { test, expect } = require('@playwright/test');
const { healSelector } = require('../lib/aiHelper');

test.describe('Studio Verification Suite', () => {
  async function aiClick(page, selector, stepName) {
    try {
      await page.click(selector, { timeout: 3000 });
    } catch (error) {
      console.warn(`[AI Self-Healer] Selector "${selector}" failed for step: "${stepName}". Healing...`);
      const html = await page.content();
      const healResult = await healSelector(selector, html, stepName);

      if (healResult && healResult.newSelector) {
        console.log(`[AI Self-Healer] Fixed selector: ${healResult.newSelector}`);
        await page.click(healResult.newSelector);
      } else {
        throw error;
      }
    }
  }

  test('Verify Setup Execution', async ({ page }) => {
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example Domain/);
  });
});