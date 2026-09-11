// Real React and sandboxed JD playback; fixture APIs never dispatch external work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { renderRecruitingJdDemo } = await jiti.import('../lib/recruiting-jd-demo-renderer.ts');
const url = process.env.SYNTROPIC_TEST_URL;
const cwd = process.env.SYNTROPIC_TEST_CWD;
const html = renderRecruitingJdDemo();

test('JD insights follow visible completion and retain closed/unopened/reload fallbacks', { skip: !url || !cwd, timeout: 90000 }, async t => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  await Promise.all(['visible', 'closed', 'unopened'].map(async mode => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let sessions = [], writtenAt = 0;
    const sessionId = `fixture-jd-${mode}`, path = `${cwd}/ai-agent-engineer-jd.html`;
    await page.addInitScript(() => {
      window.jdFinishedAt = 0;
      window.addEventListener('message', e => { if (e.data?.type === 'jd-preview-complete' && !window.jdFinishedAt) window.jdFinishedAt = Date.now(); });
    });
    await page.route('**/api/**', async route => {
      const request = route.request(), u = new URL(request.url()), p = u.pathname;
      if (p.endsWith('/events') || u.searchParams.get('type') === 'watch') return route.fulfill({ contentType: 'text/event-stream', body: 'retry: 60000\n\n' });
      let json = {};
      if (p === '/api/sessions') json = { sessions, runningSessionIds: [] };
      else if (p.startsWith('/api/sessions/')) json = { context: { messages: [
        { role: 'assistant', content: [{ type: 'toolCall', toolCallId: 'write-jd', toolName: 'write', input: { path } }], stopReason: 'stop' },
        { role: 'toolResult', toolCallId: 'write-jd', toolName: 'write', timestamp: writtenAt, content: [{ type: 'text', text: 'saved' }], isError: false },
      ], entryIds: [], leafId: null } };
      else if (p === '/api/workspaces') json = { workspaces: [{ cwd, name: '招聘工作台', managed: true }] };
      else if (p === '/api/insights') json = { results: [], running: false, sources: {} };
      else if (p === '/api/apps/internal-recruiting') json = { jobs: [], scene: null, baseUrl: url };
      else if (p === '/api/browser/state') json = { tasks: [], pages: [] };
      else if (p === '/api/agent/running') json = { runningSessionIds: [] };
      else if (p.startsWith('/api/files/')) json = { content: html, language: 'html', size: html.length };
      else if (p === '/api/jarvis') json = { sessionId: `jarvis-${mode}`, tasks: [] };
      else if (p === '/api/models') json = { models: [], modelList: [], defaultModel: null };
      else if (p === '/api/plugins') json = { packages: [] };
      return route.fulfill({ json });
    });
    await page.goto(url);
    const input = page.getByRole('textbox', { name: '和 Syntropic 对话', exact: true });
    await input.waitFor();
    await page.waitForTimeout(1000); // Allow the empty workspace baseline to settle.
    if (mode === 'unopened') await input.focus();
    writtenAt = Date.now(); const stamp = new Date(writtenAt).toISOString();
    sessions = [{ id: sessionId, cwd, path: '', firstMessage: '生成岗位 JD', created: stamp, modified: stamp, messageCount: 2 }];
    const insight = page.getByRole('button', { name: '稍后发布', exact: true });
    if (mode === 'unopened') {
      await page.waitForTimeout(7500);
      assert.equal(await page.locator('.agent-os-window-jd').count(), 0);
      await page.reload();
    } else {
      const viewer = page.locator('.agent-os-window-jd'); await viewer.waitFor();
      const frame = await viewer.locator('iframe').elementHandle().then(el => el.contentFrame());
      await frame.waitForSelector('main[aria-busy="true"]');
      if (mode === 'closed') await viewer.getByRole('button', { name: '关闭', exact: true }).click();
      else {
        // A slow/paused renderer must not be overtaken by the fallback deadline.
        await page.evaluate(() => document.querySelector('.agent-os-window-jd iframe').contentWindow.postMessage({ type: 'jd-preview-state', animate: true, active: false }, '*'));
        await page.waitForTimeout(Math.max(0, writtenAt + 20500 - Date.now()));
        assert.equal(await insight.count(), 0, 'visible playback must finish before the suggestion');
        await page.evaluate(() => document.querySelector('.agent-os-window-jd iframe').contentWindow.postMessage({ type: 'jd-preview-state', animate: true, active: true }, '*'));
        await frame.waitForSelector('main[aria-busy="false"]');
        assert.equal(await insight.count(), 0, 'the completion event is followed by a two-second pause');
      }
    }
    await insight.waitFor();
    const now = Date.now();
    if (mode === 'visible') assert.ok(now - await page.evaluate(() => window.jdFinishedAt) >= 1900);
    else assert.ok(now >= writtenAt + 19800 && now < writtenAt + 26000, `${mode}: fallback deadline should survive closing/reload`);
    assert.equal(await page.locator('.workspace-widget-insights .workspace-insight').count(), 1);
    assert.deepEqual(errors, []);
    console.log(`${mode}: passed (${now - writtenAt}ms after file write)`);
    await context.close();
  }));
});
