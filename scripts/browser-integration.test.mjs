import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { BrowserManager } = await jiti.import('../lib/browser/manager.ts');
const { AgentBrowserExecutor } = await jiti.import('../lib/browser/agent-browser.ts');

test('real agent-browser shares its assigned page, blocks manual writes, pins closure and leaves another task untouched', { timeout: 40000 }, async () => {
  const fixture = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<title>Isolation fixture</title><label>Name <input id="name"></label><button disabled>Unavailable</button>');
  });
  await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${fixture.address().port}`;
  const manager = new BrowserManager();
  const events = [];
  manager.subscribe((event) => events.push(event));
  const executor = new AgentBrowserExecutor();
  const secondExecutor = new AgentBrowserExecutor();
  let one, two;
  try {
    one = await manager.openTaskPage(process.cwd(), 'test-parent-one', `test-one-${Date.now()}`);
    two = await manager.openTaskPage(process.cwd(), 'test-parent-two', `test-two-${Date.now()}`);
    const signal = new AbortController();
    await executor.start(one.cdpUrl, one.targetId, signal.signal);
    await secondExecutor.start(two.cdpUrl, two.targetId, new AbortController().signal);
    await executor.perform({ action: 'navigate', url });
    await secondExecutor.perform({ action: 'navigate', url });
    const snapshot = await executor.snapshot();
    const ref = snapshot.match(/textbox "Name\s*".*?ref=(e\d+)/)?.[1];
    assert.ok(ref, snapshot);
    await executor.perform({ action: 'fill', ref, value: 'REAL_AGENT_BROWSER' });
    assert.equal(await one.page.locator('#name').inputValue(), 'REAL_AGENT_BROWSER');
    assert.equal(await two.page.locator('#name').inputValue(), '');
    assert.notEqual(one.cdpUrl, two.cdpUrl);
    await assert.rejects(manager.userInput(one.pageId, { action: 'insert_text', text: 'CONFLICT' }), /AI 正在操作/);
    await assert.rejects(manager.navigate(one.pageId, { url }), /AI 正在操作/);
    await assert.rejects(one.page.goto('http://127.0.0.1:30141/'), /ERR_BLOCKED_BY_CLIENT/);
    await executor.perform({ action: 'navigate', url });
    await one.page.evaluate(() => window.open('about:blank'));
    for (let i = 0; i < 50 && one.page.context().pages().length !== 1; i++) await delay(20);
    assert.equal(one.page.context().pages().length, 1, JSON.stringify(one.page.context().pages().map(p => p.url())));
    const pendingReads = Array.from({ length: 5 }, () => manager.refreshTaskPage(one.pageId));
    await one.page.close();
    await Promise.allSettled(pendingReads);
    const closedAt = events.findIndex((event) => event.type === 'browser.closed' && event.pageId === one.pageId);
    assert.ok(closedAt >= 0);
    assert.equal(events.slice(closedAt + 1).some((event) => event.type === 'browser.updated' && event.page.pageId === one.pageId), false, 'late reads must not resurrect a closed page');
    await assert.rejects(executor.snapshot(), /closed|gone|tab|page|target/i);
    await assert.rejects(executor.perform({ action: 'navigate', url }), /closed|gone|tab|page|target/i);
    assert.equal(await two.page.locator('#name').inputValue(), '');
    const secondSnapshot = await secondExecutor.snapshot();
    const secondRef = secondSnapshot.match(/textbox "Name\s*".*?ref=(e\d+)/)?.[1];
    await secondExecutor.perform({ action: 'fill', ref: secondRef, value: 'SECOND_ALIVE' });
    assert.equal(await two.page.locator('#name').inputValue(), 'SECOND_ALIVE');
    await secondExecutor.stop();
    await assert.rejects(secondExecutor.perform({ action: 'fill', ref: secondRef, value: 'LATE' }), /已停止/);
    assert.equal(await two.page.locator('#name').inputValue(), 'SECOND_ALIVE');
  } finally {
    await executor.stop(); await secondExecutor.stop();
    await one?.page.context().close(); await two?.page.context().close();
    await new Promise((resolve) => fixture.close(resolve));
  }
});
