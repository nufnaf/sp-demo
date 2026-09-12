import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { BrowserStartupTimer, measureStartup } = await jiti.import('./startup-timing.ts');
const { BrowserManager } = await jiti.import('./manager.ts');
const { AgentBrowserExecutor } = await jiti.import('./agent-browser.ts');

test('failed and interrupted preparation preserves measurements without recording error contents', async () => {
  const timer = new BrowserStartupTimer();
  const failure = new Error('private diagnostic content');
  assert.equal(await measureStartup(timer, 'profile-prepare', () => 42), 42);
  await assert.rejects(measureStartup(timer, 'chromium-launch', async () => { throw failure; }), error => error === failure);
  assert.deepEqual(timer.entries.map(entry => entry.status), ['completed', 'failed']);
  assert.doesNotMatch(JSON.stringify(timer.entries), /private|diagnostic/);
  const controller = new AbortController();
  controller.abort(failure);
  await assert.rejects(measureStartup(timer, 'executor-ready', () => controller.signal.throwIfAborted()), error => error === failure);
  assert.equal(timer.entries.at(-1).status, 'failed');
});

test('real startup separates Chromium, viewport handshake and executor connection', { timeout: 60000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'browser-startup-timing-'));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  const manager = new BrowserManager();
  try {
    for (const mode of ['ready', 'ready', 'timeout']) {
      const timer = new BrowserStartupTimer();
      const executor = new AgentBrowserExecutor();
      const unsubscribe = manager.subscribe(event => {
        if (event.type === 'browser.opened' && mode === 'ready') void manager.resize(event.page.pageId, 1440, 900);
      });
      let target;
      try {
        const started = performance.now();
        target = await manager.openTaskPage(dir, 'startup-test', crypto.randomUUID(), timer);
        await executor.start(target.cdpUrl, target.targetId, new AbortController().signal, timer);
        const totalMs = Math.round(performance.now() - started);
        assert.deepEqual(timer.entries.map(entry => entry.phase), [
          'profile-prepare', 'chromium-launch', 'context-connect', 'page-register',
          'target-identify', 'initial-page-state', 'viewport-wait', 'viewport-seal',
          'executor-spawn', 'executor-ready', 'executor-connect', 'target-pin',
        ]);
        assert.ok(timer.entries.every(entry => entry.status === 'completed' && entry.durationMs >= 0 && entry.offsetMs >= 0));
        const viewport = timer.entries.find(entry => entry.phase === 'viewport-wait');
        assert.equal(viewport.outcome, mode);
        if (mode === 'timeout') assert.ok(viewport.durationMs >= 1400);
        assert.deepEqual(target.page.viewportSize(), mode === 'ready' ? { width: 1440, height: 900 } : { width: 1280, height: 800 });
        assert.equal(target.page.url(), 'about:blank', 'startup must not navigate to the business website');
        await executor.snapshot();
        assert.equal(timer.entries.length, 12, 'later page reads must not inflate startup timings');
        assert.ok(timer.entries.reduce((sum, entry) => sum + entry.durationMs, 0) <= totalMs + 12, 'subphases must not overlap (allow rounding)');
        t.diagnostic(JSON.stringify({ mode, totalMs, startupTimings: timer.entries }));
      } finally {
        unsubscribe();
        await executor.stop();
        await target?.page.context().close();
      }
    }
  } finally {
    for (const workspace of manager.workspaces.values()) {
      await workspace.context.close();
      clearTimeout(workspace.idleTimer);
    }
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
