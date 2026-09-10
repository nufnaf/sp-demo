// Run against an isolated presentation server:
// SYNTROPIC_TEST_URL=http://127.0.0.1:<port> node --test scripts/desktop-composer.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const base = process.env.SYNTROPIC_TEST_URL;
const commandUrl = /\/api\/agent\/[\w-]+$/;
const eventsUrl = /\/api\/agent\/[\w-]+\/events$/;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function gate() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}

test('desktop composer handles rejected, uncertain and concurrent sends and reconnects', { skip: !base, timeout: 90_000 }, async t => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());

  async function openPage(configure) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.connectionEvents = [];
      const NativeEventSource = window.EventSource;
      window.EventSource = class extends NativeEventSource {
        constructor(url, options) {
          super(url, options);
          this.addEventListener('message', event => {
            if (String(url).includes('/api/agent/')) window.connectionEvents.push(JSON.parse(event.data));
          });
        }
      };
    });
    if (configure) await configure(page);
    await page.goto(base);
    const scenario = await page.request.get(`${base}/api/desktop/scenario`);
    assert.equal(scenario.status(), 200, 'requires an isolated presentation server');
    const input = page.getByRole('textbox', { name: '和 Syntropic 对话', exact: true });
    await input.waitFor();
    return { page, input, errors, context, send: page.getByRole('button', { name: '发送给 Syntropic', exact: true }) };
  }
  const waitConnected = page => page.waitForFunction(() => window.connectionEvents.some(event => event.type === 'connected'));
  const waitEnabled = page => page.waitForFunction(() => !document.querySelector('button[aria-label="发送给 Syntropic"]')?.disabled);

  await t.test('404 keeps the draft, resolves the session and permits a manual retry', async () => {
    let attempts = 0;
    const h = await openPage(async page => {
      await page.route(commandUrl, async route => {
        if (route.request().method() !== 'POST') return route.continue();
        attempts++;
        if (attempts === 1) return route.fulfill({ status: 404, json: { error: 'Session not found', code: 'prompt_rejected', accepted: false } });
        return route.continue();
      });
    });
    try {
      await waitConnected(h.page);
      const text = '帮助：发送失败后手动重试';
      await h.input.fill(text);
      await h.send.click();
      await waitEnabled(h.page);
      assert.equal(await h.input.inputValue(), text);
      assert.equal(attempts, 1);
      await h.send.click();
      await h.page.waitForFunction(() => document.querySelector('input[aria-label="和 Syntropic 对话"]').value === '');
      assert.equal(attempts, 2);
      assert.deepEqual(h.errors, []);
    } finally { await h.context.close(); }
  });

  await t.test('a response lost after server acceptance is never automatically resent', async () => {
    let attempts = 0;
    const h = await openPage(async page => {
      await page.route(commandUrl, async route => {
        if (route.request().method() !== 'POST') return route.continue();
        attempts++;
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        await route.abort('failed');
      });
    });
    try {
      await waitConnected(h.page);
      const text = '帮助：响应丢失';
      await h.input.fill(text);
      await h.send.click();
      await h.page.getByText('发送结果暂时无法确认，请先查看任务进展，避免重复发送。', { exact: true }).first().waitFor();
      await waitEnabled(h.page);
      await delay(300);
      assert.equal(attempts, 1);
      assert.equal(await h.input.inputValue(), text);
      assert.deepEqual(h.errors, []);
    } finally { await h.context.close(); }
  });

  await t.test('overlapping submits send once and acceptance preserves a newer draft', async () => {
    const held = gate();
    let attempts = 0;
    const h = await openPage(async page => {
      await page.route(commandUrl, async route => {
        if (route.request().method() !== 'POST') return route.continue();
        attempts++;
        await held.promise;
        await route.continue();
      });
    });
    try {
      await waitConnected(h.page);
      await h.input.fill('帮助：连续发送');
      await h.input.evaluate(input => {
        input.form.requestSubmit();
        input.form.requestSubmit();
      });
      await h.page.waitForFunction(() => document.querySelector('button[aria-label="发送给 Syntropic"]')?.disabled);
      await delay(200);
      assert.equal(attempts, 1);
      await h.input.fill('下一条草稿');
      held.release();
      await waitEnabled(h.page);
      assert.equal(await h.input.inputValue(), '下一条草稿');
      assert.equal(attempts, 1);
      assert.deepEqual(h.errors, []);
    } finally { held.release(); await h.context.close(); }
  });

  await t.test('send waits for the replacement event connection after session disposal', async () => {
    const held = gate();
    let connections = 0;
    let attempts = 0;
    const h = await openPage(async page => {
      await page.route(eventsUrl, async route => {
        connections++;
        if (connections === 1) return route.fulfill({
          status: 200, contentType: 'text/event-stream',
          body: 'data: {"type":"connected","isStreaming":false}\n\ndata: {"type":"session_closed"}\n\n',
        });
        await held.promise;
        await route.continue();
      });
      await page.route(commandUrl, async route => {
        if (route.request().method() === 'POST') attempts++;
        await route.continue();
      });
    });
    try {
      await h.page.waitForFunction(() => window.connectionEvents.some(event => event.type === 'session_closed'));
      await h.input.fill('帮助：重新连接后发送');
      await h.send.click();
      await delay(200);
      assert.equal(attempts, 0, 'must subscribe before sending');
      held.release();
      await h.page.waitForFunction(() => document.querySelector('input[aria-label="和 Syntropic 对话"]').value === '');
      assert.equal(attempts, 1);
      assert.ok(connections >= 2);
      assert.deepEqual(h.errors, []);
    } finally { held.release(); await h.context.close(); }
  });
});
