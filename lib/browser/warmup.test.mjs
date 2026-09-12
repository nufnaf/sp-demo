import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { BrowserManager } = await jiti.import('./manager.ts');
const { BrowserStartupTimer } = await jiti.import('./startup-timing.ts');

test('warm browser stays hidden, is claimed once, and handles closed or cancelled preparation', { timeout: 60000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'browser-warmup-'));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = root;
  const managers = [];
  const make = () => { const manager = new BrowserManager(); managers.push(manager); return manager; };
  try {
    const manager = make();
    const events = [];
    manager.subscribe(event => {
      events.push(event);
      if (event.type === 'browser.opened') void manager.resize(event.page.pageId, 1440, 900);
    });
    await Promise.all([manager.prepareTaskBrowser(root), manager.prepareTaskBrowser(root)]);
    assert.equal(manager.workspaces.size, 1);
    assert.deepEqual(await manager.list(root), []);
    assert.equal(events.length, 0, 'preparation cannot open or focus a UI page');
    const warmContext = [...manager.workspaces.values()][0].context;
    const timer = new BrowserStartupTimer();
    const [first, second] = await Promise.all([
      manager.openTaskPage(root, 'parent1', 'task1', timer),
      manager.openTaskPage(root, 'parent2', 'task2'),
    ]);
    assert.equal(first.page.context(), warmContext);
    assert.notEqual(second.page.context(), warmContext);
    assert.notEqual(first.targetId, second.targetId);
    assert.equal(first.warmup.status, 'claimed');
    assert.equal(timer.entries.some(entry => entry.phase === 'chromium-launch'), false);
    assert.equal(timer.entries[0].phase, 'prepared-browser-wait');
    await manager.prepareTaskBrowser(root);
    assert.equal(manager.workspaces.size, 2, 'refresh after claim must not replenish');

    const closed = make();
    await closed.prepareTaskBrowser(root);
    await [...closed.workspaces.values()][0].context.close();
    closed.subscribe(event => { if (event.type === 'browser.opened') void closed.resize(event.page.pageId, 1440, 900); });
    const fallback = await closed.openTaskPage(root, 'parent', 'fallback');
    assert.equal(fallback.page.url(), 'about:blank');
    assert.equal(fallback.warmup.status, 'failed');

    const cancelled = make();
    let opened = false;
    cancelled.subscribe(event => { if (event.type === 'browser.opened') opened = true; });
    const preparing = cancelled.prepareTaskBrowser(root);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(cancelled.openTaskPage(root, 'parent', 'cancelled', undefined, controller.signal));
    await preparing;
    assert.equal(opened, false);
    assert.equal(cancelled.workspaces.size, 0);
  } finally {
    for (const manager of managers) for (const workspace of manager.workspaces.values()) {
      await workspace.context.close(); clearTimeout(workspace.idleTimer);
    }
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previous;
    await rm(root, { recursive: true, force: true });
  }
});
