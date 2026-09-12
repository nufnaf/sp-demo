import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright-core';

// Real desktop components with isolated API fixtures: no model calls, Feishu
// reads or published jobs. Run against a presentation dev server.
const url = process.env.SYNTROPIC_TEST_URL;
test('JD shortcut works before documents and follows submitted workspace progress', { skip: !url, timeout: 120000 }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [], sent = [], reads = [];
    let cwd, jdStatus = null, publication = 'unavailable', unrelatedBusy = false;
    let restoredTasks = true;
    const jdTask = () => ({ sessionId: 'fixture-jd', description: '生成岗位 JD', status: jdStatus, createdAt: '2026-09-10T00:00:00Z' });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const request = route.request(), target = new URL(request.url());
      reads.push(target.pathname);
      if (target.pathname.endsWith('/events') || target.searchParams.get('type') === 'watch') {
        return route.fulfill({ contentType: 'text/event-stream', body: 'data: {"type":"connected","isStreaming":false}\n\n' });
      }
      let body = { sessions: [], workspaces: [], packages: [], tasks: [], pages: [], results: [], items: [], models: [], installations: [] };
      if (target.pathname === '/api/jarvis') {
        if (request.method() === 'POST') cwd = request.postDataJSON().cwd;
        body = { sessionId: 'fixture-jarvis', created: !jdStatus, tasks: jdStatus && restoredTasks ? [jdTask()] : [] };
      }
      if (target.pathname === '/api/sessions') {
        const session = { id: 'fixture-jd', cwd, path: '', created: '2026-09-10T00:00:00Z', modified: '2026-09-10T00:00:00Z', messageCount: 1, firstMessage: '帮我写一个岗位描述' };
        body = { sessions: jdStatus ? [session] : unrelatedBusy ? [{ ...session, id: 'other-task', firstMessage: '总结本周反馈' }] : [], runningSessionIds: unrelatedBusy ? ['other-task'] : jdStatus === 'running' ? ['fixture-jd'] : [] };
      }
      if (target.pathname.startsWith('/api/sessions/')) body = { context: { messages: [] } };
      if (target.pathname === '/api/agent/fixture-jarvis' && request.method() === 'POST') {
        sent.push(request.postDataJSON());
        jdStatus = 'running';
        body = { success: true };
      }
      if (target.pathname === '/api/apps/internal-recruiting') {
        if (publication === 'unavailable') return route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"fixture unavailable"}' });
        body = { jobs: publication === 'published' ? [{ id: 'job-1', title: '高级 AI Agent 研发工程师' }] : [], scene: null };
      }
      if (target.pathname.startsWith('/api/files/')) body = { entries: [], content: '', language: 'text', size: 0 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    const input = page.getByRole('textbox', { name: '和 Syntropic 对话' });
    const suggestions = page.getByRole('region', { name: '你可能想问' });
    const cue = suggestions.getByRole('button', { name: /生成.*JD/ });
    const waitHidden = () => suggestions.waitFor({ state: 'hidden' });
    const openCue = async () => { await input.click(); await cue.waitFor(); };
    await page.goto(url);
    await openCue();
    assert.equal(reads.some(path => path.startsWith('/api/apps/feishu/documents')), false, 'opening cue needs no document visit');
    assert.equal(sent.length, 0);
    await mkdir(new URL('../build/verification/quick-prompts/', import.meta.url), { recursive: true });
    await page.screenshot({ path: new URL('../build/verification/quick-prompts/initial.png', import.meta.url).pathname });

    // Selecting only fills; clearing, typing, Escape and outside clicks preserve behavior.
    await cue.click();
    assert.match(await input.inputValue(), /星流科技业务介绍/);
    assert.equal(sent.length, 0);
    await waitHidden();
    await input.fill(''); await cue.waitFor();
    await input.press('Escape'); await waitHidden();
    await openCue(); await input.fill('随便输入'); await waitHidden();
    await input.fill(''); await cue.waitFor();
    await input.press('ArrowDown');
    assert.equal(await cue.evaluate(element => element === document.activeElement), true);
    await cue.press('Enter'); assert.equal(sent.length, 0);
    await input.fill(''); await cue.waitFor();

    // A different app may be visited first. No business document is opened.
    await page.getByRole('navigation', { name: '应用程序 Dock' }).getByRole('button', { name: /(?:打开|切换到) 产物库$/ }).click();
    await waitHidden(); await openCue();
    unrelatedBusy = true;
    await page.reload(); await openCue();
    unrelatedBusy = false;

    // Manual generation uses the same boundary; the pending request hides it
    // immediately, even before task SSE arrives or any artifact exists.
    await input.fill('帮我写一个岗位描述'); await input.press('Enter');
    await page.waitForFunction(() => document.querySelector('input[aria-label="和 Syntropic 对话"]').value === '');
    await input.click(); await waitHidden();
    assert.equal(sent.length, 1);
    for (const status of ['running', 'aborted', 'failed', 'completed']) {
      jdStatus = status;
      await page.reload(); await input.click();
      await page.getByRole('button', { name: /正在准备|生成岗位 JD|帮我写一个岗位描述/ }).first().waitFor();
      await waitHidden();
    }
    // A cold restoration can have no in-memory Jarvis tasks or transcript;
    // saved workspace sessions still prevent the opening cue from returning.
    restoredTasks = false;
    await page.reload(); await input.click(); await waitHidden();

    // Confirmed publication retains the existing context-specific query cue.
    publication = 'published';
    await page.reload(); await input.click(); await waitHidden();
    await page.getByRole('navigation', { name: '应用程序 Dock' }).getByRole('button', { name: /(?:打开|切换到) 人才招聘$/ }).click();
    await input.click(); await suggestions.getByRole('button', { name: /评价没齐/ }).waitFor();

    // A new presentation has no prior request/task, so the cue is available again.
    jdStatus = null; publication = 'empty';
    await page.reload(); await openCue();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
