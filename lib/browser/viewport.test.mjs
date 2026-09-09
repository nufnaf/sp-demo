import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
const { BrowserManager } = await createJiti(import.meta.url).import('./manager.ts');

test('task viewport is initialized before navigation, stays stable at completion/stop, and remains manually resizable', { timeout: 30000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'browser-viewport-'));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  const manager = new BrowserManager();
  const preferred = { width: 1600, height: 1000 };
  const unsubscribe = manager.subscribe((event) => {
    if (event.type === 'browser.opened') void manager.resize(event.page.pageId, preferred.width, preferred.height);
  });
  try {
    for (const status of ['completed', 'failed', 'stopped']) {
      const target = await manager.openTaskPage(dir, 'parent', status);
      const { page, pageId } = target;
      assert.deepEqual(page.viewportSize(), preferred, 'first Agent observation must use the visible container size');
      await page.setContent('<style>aside{width:212px}main{margin-left:212px}</style><aside>Navigation</aside><main><h1>Candidate</h1><input aria-label="Notes"></main>');
      const layout = () => page.locator('h1').boundingBox();
      const before = await layout();
      await manager.resize(pageId, 1280, 800);
      assert.deepEqual(page.viewportSize(), preferred, 'execution must reject later resizes');
      await assert.rejects(manager.userInput(pageId, { action: 'insert_text', text: 'blocked' }), /AI 正在操作/);
      await manager.taskChanged({ id: status, pageId, cwd: dir, parentSessionId: 'parent', status });
      await manager.resize(pageId, preferred.width, preferred.height);
      assert.deepEqual(await layout(), before, `${status} must preserve the page layout`);
      await manager.userInput(pageId, { action: 'press', key: 'Tab' });
      await manager.resize(pageId, 1400, 900);
      assert.deepEqual(page.viewportSize(), { width: 1400, height: 900 }, 'explicit user resize still works after takeover');
    }
    unsubscribe();
    const fallback = await manager.openTaskPage(dir, 'parent', 'without-ui');
    assert.deepEqual(fallback.page.viewportSize(), { width: 1280, height: 800 });
    await manager.resize(fallback.pageId, 1600, 1000);
    assert.deepEqual(fallback.page.viewportSize(), { width: 1280, height: 800 }, 'late UI mount must not resize an executing task');

    // Exercise the real stylesheet at desktop and narrow widths: status content
    // belongs to the toolbar, so hiding it must not change the screenshot box.
    const css = await readFile(new URL('../../components/AgentDesktop.css', import.meta.url), 'utf8');
    const page = fallback.page;
    for (const width of [1440, 900, 700]) {
      await page.setViewportSize({ width, height: 960 });
      await page.setContent(`<style>${css}</style><section class="agent-browser-app" style="width:100%;height:800px"><nav class="agent-browser-tabs"></nav><header class="agent-browser-toolbar"><div class="agent-browser-navigation">← →</div><form class="agent-browser-address"></form><div class="agent-browser-task"><div class="agent-browser-task-summary"><strong>正在处理网页任务…</strong><button>停止任务</button></div></div></header><div class="agent-browser-viewport"></div></section>`);
      const before = await page.locator('.agent-browser-viewport').boundingBox();
      await page.locator('.agent-browser-task').evaluate((element) => { element.className = 'agent-browser-task-placeholder'; element.replaceChildren(); });
      assert.deepEqual(await page.locator('.agent-browser-viewport').boundingBox(), before, `toolbar must keep viewport stable at ${width}px`);
    }
  } finally {
    unsubscribe();
    for (const workspace of manager.workspaces.values()) {
      await workspace.context.close();
      clearTimeout(workspace.idleTimer);
    }
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
