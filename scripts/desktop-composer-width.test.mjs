import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const url = process.env.SYNTROPIC_TEST_URL;
// This test only edits the draft; no prompt or external action is submitted.
test('quick prompts and manual input share content width, then wrap at the cap', { skip: !url, timeout: 30000 }, async t => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(url);
  const input = page.getByRole('textbox', { name: '和 Syntropic 对话', exact: true });
  await input.click();
  const surface = page.locator('.agent-os-ai-surface');
  const width = () => surface.evaluate(el => el.getBoundingClientRect().width);
  assert.equal(await width(), 362);
  await page.getByRole('region', { name: '你可能想问' }).getByRole('button').first().click();
  await page.waitForFunction(() => document.querySelector('.agent-os-ai-surface').getBoundingClientRect().width === 560);
  const quick = await input.inputValue(); const quickHeight = (await input.boundingBox()).height;
  await input.fill('');
  await page.waitForFunction(() => document.querySelector('.agent-os-ai-surface').getBoundingClientRect().width === 362);
  await input.fill(quick);
  await page.waitForFunction(() => document.querySelector('.agent-os-ai-surface').getBoundingClientRect().width === 560);
  assert.equal((await input.boundingBox()).height, quickHeight);
  await input.fill(quick.repeat(5));
  assert.equal(await width(), 560); assert.ok((await input.boundingBox()).height > quickHeight);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.ok(await width() <= 362);
});
