// Isolated UI regression fixtures only: no external publishing or meeting writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createJiti } from 'jiti';
import { seedData } from '../apps/recruiting/src/seed.mjs';
import { mutate } from '../apps/recruiting/src/domain.mjs';
import { presentationProjection } from '../apps/recruiting/src/presentation.mjs';

const base = process.env.SYNTROPIC_TEST_URL;
const output = process.env.SYNTROPIC_TEST_SCREENSHOTS || '/tmp/syntropic-ui-followup-screenshots';
test('query result navigation and audit layout regressions', { skip: !base, timeout: 120_000 }, async t => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  await mkdir(output, { recursive: true });
  const jiti = createJiti(import.meta.url);
  const { renderRecruitingInsightReport } = await jiti.import('../lib/recruiting-insight-report.ts');
  const { recruitingQueryResult } = await jiti.import('../lib/recruiting-query-result.ts');
  const scene = presentationProjection(mutate(seedData(true), '/jobs/publish', { draft: 'followup', title: '高级 AI Agent 研发工程师', description: '岗位说明', target: '6', location: '北京 / 上海', department: 'Agent Platform', owner: '陈晓' }));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 844 } });
  page.setDefaultTimeout(12_000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const initialRequest = page.waitForRequest(r => r.url().includes('/api/browser/state?cwd='));
  await page.goto(base);
  const cwd = new URL((await initialRequest).url()).searchParams.get('cwd');
  const id = 'query-fixture', now = new Date().toISOString();
  const question = '查询招聘进展，多少人面试结束，谁还没提交评价？';
  const filePath = `${cwd}/recruiting-interviewer-alignment-report.html`;
  const insight = { cwd, filePath, fileName: 'recruiting-interviewer-alignment-report.html', title: scene.insight.title, modified: now, sessionId: `presentation:${scene.job.id}`, summary: '查看面试评价与标准对齐建议' };
  const snapshot = recruitingQueryResult(scene, id, question, '**12 人**面试已结束，其中 **3 人**评价未齐。', now);
  let legacy = false, loadFails = false, failed = false, running = false;
  const task = { id: 'browser-fixture', cwd, parentSessionId: id, pageId: 'page-fixture', task: question, status: 'completed', createdAt: now, updatedAt: now };
  await page.route('**/api/sessions', route => route.fulfill({ json: { sessions: [
    { id, path: '/fixture.jsonl', cwd, name: '查询招聘进展', firstMessage: question, modified: now, created: now, messageCount: 2 },
    { id: 'other-workspace', path: '/other.jsonl', cwd: '/another-workspace', name: '其他工作台任务', firstMessage: '其他工作台任务', modified: new Date(Date.parse(now) + 1000).toISOString(), created: now, messageCount: 2 },
  ], runningSessionIds: running ? [id] : [] } }));
  await page.route('**/api/sessions/query-fixture?*', route => route.fulfill({ json: { context: { messages: [{ role: 'user', content: question }, { role: 'assistant', content: [{ type: 'text', text: '查询完成' }], stopReason: failed ? 'error' : 'stop' }], entryIds: [] } } }));
  await page.route('**/api/browser/state?*', route => route.fulfill({ json: { tasks: [{ ...task, status: running ? 'running' : 'completed' }], pages: [] } }));
  await page.route('**/api/desktop/scenario', route => route.fulfill(loadFails ? { status: 503, json: { error: 'unavailable' } } : { json: { recruiting: { scene, jobs: [] }, insight, queries: legacy ? {} : { [id]: snapshot } } }));
  await page.route('**/api/apps/internal-recruiting', route => route.fulfill({ json: { scene, jobs: [{ ...scene.job, headcount: 6 }], baseUrl: 'http://localhost' } }));
  await page.route('**/api/insights?*', route => route.fulfill({ json: { results: [insight], running: false } }));
  await page.route('**/api/files/**', route => route.request().url().includes('recruiting-interviewer-alignment-report')
    ? route.fulfill({ json: { content: renderRecruitingInsightReport(scene, now), language: 'html', name: insight.fileName, path: filePath, size: 5000, type: 'file' } }) : route.continue());
  const openQuery = async () => {
    const detailReady = page.waitForResponse(r => r.url().includes('/api/sessions/query-fixture?'));
    await page.reload();
    const taskButton = page.locator('.workspace-widget-tasks').getByRole('button', { name: /查询招聘进展/ });
    await taskButton.waitFor();
    await detailReady;
    await taskButton.click();
    await page.locator('.recruiting-query-result').waitFor();
    const dismiss = page.locator('.agent-os-insight-notification .jd-dismiss');
    if (await dismiss.isVisible()) await dismiss.click();
  };
  const close = title => page.locator(`.agent-os-window[aria-label="${title}"]`).getByRole('button', { name: '关闭', exact: true }).first().click();

  await t.test('completed task opens its persisted result, candidate filter and report', async () => {
    await openQuery();
    assert.deepEqual(await page.locator('.recruiting-query-counts strong').allTextContents(), ['12', '3']);
    assert.equal(await page.locator('.recruiting-query-followup li').count(), 3);
    assert.equal(await page.locator('.recruiting-query-answer strong').first().textContent(), '12 人');
    await page.screenshot({ path: `${output}/query-result.png` });
    await page.setViewportSize({ width: 961, height: 609 });
    await page.locator('.recruiting-query-followup').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: `${output}/query-result-small.png` });
    await page.setViewportSize({ width: 1440, height: 844 });
    await page.getByRole('button', { name: '查看候选人', exact: true }).click();
    await page.locator('.presentation-metrics button.selected').filter({ hasText: '结束但评价未齐' }).waitFor();
    assert.equal(await page.locator('.presentation-table-scroll tbody tr').count(), 3);
    await close('人才招聘');
    await page.locator('.recruiting-query-result').getByRole('button', { name: '查看完整报告', exact: true }).click();
    await page.locator('.insights-report iframe').waitFor();
  });

  await t.test('report reading area clears composer at normal and small sizes, focused and after dragging', async () => {
    for (const size of [{ width: 1440, height: 844 }, { width: 961, height: 609 }]) {
      await page.setViewportSize(size);
      const input = page.getByRole('textbox', { name: '和 Syntropic 对话', exact: true });
      for (const focused of [false, true]) {
        if (focused) await input.fill('稍后继续核对招聘进展');
        else { await input.fill(''); await input.blur(); }
        await page.waitForFunction(() => {
          const frame = document.querySelector('.insights-report iframe')?.getBoundingClientRect();
          const composer = document.querySelector('.agent-os-ai-surface')?.getBoundingClientRect();
          return frame && composer && frame.height > 50 && frame.bottom <= composer.top - 10;
        });
        const frame = page.frameLocator('.insights-report iframe');
        await frame.locator('.scope-note').evaluate(el => el.scrollIntoView({ block: 'end' }));
        assert.equal(await frame.locator('.scope-note').isVisible(), true);
        await page.screenshot({ path: `${output}/report-${size.width}-${focused ? 'draft' : 'idle'}.png` });
      }
      await input.fill(''); await input.blur();
    }
    await page.setViewportSize({ width: 1440, height: 844 });
    const bar = page.locator('.agent-os-window-insights .agent-os-window-bar');
    const rect = await bar.boundingBox();
    await page.mouse.move(rect.x + 250, rect.y + 25); await page.mouse.down(); await page.mouse.move(rect.x + 250, rect.y + 75); await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('.insights-report iframe').getBoundingClientRect().bottom < document.querySelector('.agent-os-ai-surface').getBoundingClientRect().top);
    await page.getByRole('button', { name: '打开报告文件 ↗' }).click();
    const standalone = page.locator('.agent-os-window[aria-label="recruiting-interviewer-alignment-report.html"]');
    await standalone.locator('iframe').waitFor();
    await standalone.frameLocator('iframe').locator('.scope-note').evaluate(el => el.scrollIntoView({ block: 'end' }));
    await page.waitForFunction(() => {
      const f = document.querySelector('.agent-os-window[aria-label="recruiting-interviewer-alignment-report.html"] iframe').getBoundingClientRect();
      return f.bottom < document.querySelector('.agent-os-ai-surface').getBoundingClientRect().top;
    });
    await page.screenshot({ path: `${output}/standalone-report.png` });
    await close('recruiting-interviewer-alignment-report.html');
    await close('AI 洞察');
  });

  await t.test('metric baselines and candidate headings stay consistent in small windows', async () => {
    await page.getByRole('navigation', { name: '应用程序 Dock' }).getByRole('button', { name: /(?:打开|切换到) 人才招聘$/ }).click();
    for (const height of [842, 609]) {
      await page.setViewportSize({ width: 961, height });
      const positions = await page.locator('.presentation-metrics strong').evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
      assert.equal(positions.length, 5); assert.ok(Math.max(...positions) - Math.min(...positions) <= 1);
      await page.locator('.recruiting-funnel').evaluate(el => el.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: `${output}/metrics-961-${height}.png` });
    }
    await page.getByRole('button', { name: '查看林然档案' }).click();
    const headings = await page.locator('.presentation-candidate-backdrop h3').evaluateAll(els => els.map(el => { const s = getComputedStyle(el); return [s.fontSize, s.fontWeight, s.marginTop]; }));
    assert.deepEqual(headings, [['16px', '600', '28px'], ['16px', '600', '28px']]);
    await page.screenshot({ path: `${output}/candidate-961.png` });
    await page.locator('.presentation-candidate-backdrop h3').last().evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${output}/candidate-sections.png` });
  });

  await t.test('legacy, zero missing reviews, read failure and retry remain honest', async () => {
    legacy = true; await openQuery();
    assert.match(await page.locator('.recruiting-query-heading').innerText(), /最近同步/);
    legacy = false; snapshot.metrics.missing = 0; snapshot.missingCandidates = [];
    await openQuery(); assert.match(await page.locator('.recruiting-query-followup').innerText(), /均已齐全/);
    loadFails = true; await openQuery();
    assert.equal(await page.locator('.recruiting-query-counts').count(), 0);
    loadFails = false; await page.getByRole('button', { name: '重新读取' }).click();
    await page.locator('.recruiting-query-counts').waitFor();
    await close('招聘查询结果');
    await page.getByRole('navigation', { name: '应用程序 Dock' }).getByRole('button', { name: /(?:打开|切换到) 任务$/ }).click();
    await page.locator('.recruiting-query-result').waitFor();
  });

  await t.test('running and failed tasks do not open a successful query result', async () => {
    for (const state of ['running', 'failed']) {
      running = state === 'running'; failed = state === 'failed';
      const detailReady = page.waitForResponse(r => r.url().includes('/api/sessions/query-fixture?'));
      await page.reload();
      await page.locator('.workspace-widget-tasks').getByRole('button', { name: /查询招聘进展/ }).waitFor();
      await detailReady;
      await page.locator('.workspace-widget-tasks').getByRole('button', { name: /查询招聘进展/ }).click();
      await page.locator('.agent-os-window[aria-label="浏览器"]').waitFor();
      assert.equal(await page.locator('.recruiting-query-result').count(), 0);
    }
  });
  assert.deepEqual(errors, []);
});
