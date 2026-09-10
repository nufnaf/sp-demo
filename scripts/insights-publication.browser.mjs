// Run against an isolated dev server with SYNTROPIC_PRESENTATION_ROOT set to
// build/insights-publication-validation/runtime. All business requests are mocked;
// this verifies the real desktop UI without publishing a job or calling a model.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const output = resolve('build/insights-publication-validation');
const cwd = join(output, 'runtime/workspace');
const url = process.env.INSIGHTS_TEST_URL || 'http://127.0.0.1:30261';
const artifact = { cwd, filePath: join(cwd, 'ai-agent-engineer-jd.html'), sessionId: 'fixture-jd', taskTitle: '生成岗位 JD' };
const report = { cwd, filePath: join(cwd, 'recruiting-interviewer-alignment-report.html'), sessionId: 'fixture-report', title: '高级 AI Agent 研发工程师 · 面试官评价标准不一致', summary: '9 位候选人中，3 位存在推进判断分歧。', fileName: 'recruiting-interviewer-alignment-report.html', modified: '2026-09-10T08:00:00Z' };
const draft = createHash('sha256').update(`${cwd}\n${artifact.filePath}`).digest('hex').slice(0, 32);
const job = { id: 'fixture-job', draft, title: '高级 AI Agent 研发工程师', url: `${url}/jobs/fixture-job` };
const jdHtml = '<!doctype html><html lang="zh-CN"><body style="font-family:sans-serif;padding:32px;color:#183a2c"><h1>高级 AI Agent 研发工程师</h1><p>星流科技 · Agent Platform</p><h2>岗位职责</h2><p>负责工具编排、评测与生产交付。</p><h2>任职要求</h2><p>具备 Agent 开发与故障恢复经验。</p></body></html>';
const reportHtml = '<!doctype html><html lang="zh-CN"><body><h1>面试官评价标准不一致</h1><p>9 位候选人中，3 位存在推进判断分歧。</p></body></html>';
const jdSession = { id: artifact.sessionId, cwd, path: '', firstMessage: artifact.taskTitle, created: report.modified, modified: report.modified, messageCount: 2 };
const messages = [
  { role: 'assistant', content: [{ type: 'toolCall', toolCallId: 'write-jd', toolName: 'write', input: { path: artifact.filePath } }], stopReason: 'stop' },
  { role: 'toolResult', toolCallId: 'write-jd', toolName: 'write', content: [{ type: 'text', text: 'saved' }], isError: false },
];
let sessions = [], results = [], jobs = [], tasks = [], running = [], dispatches = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1512, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await context.route('**/api/**', async route => {
  const request = route.request(), u = new URL(request.url()), path = u.pathname;
  let json = {};
  if (path.endsWith('/events') || u.searchParams.get('type') === 'watch') return route.fulfill({ contentType: 'text/event-stream', body: 'retry: 60000\n\n' });
  if (path === '/api/sessions') json = { sessions, runningSessionIds: running };
  else if (path.startsWith('/api/sessions/')) json = { context: { messages: path.includes(artifact.sessionId) ? messages : [], entryIds: [], leafId: null } };
  else if (path === '/api/workspaces') json = { workspaces: [{ cwd, name: '招聘演示验证', managed: true }] };
  else if (path === '/api/insights') json = { results, running: false, sources: {} };
  else if (path === '/api/apps/internal-recruiting') json = { jobs, scene: null, baseUrl: url };
  else if (path === '/api/apps/feishu/calendar') json = { events: [], date: u.searchParams.get('date') };
  else if (path === '/api/browser/state') json = { tasks, pages: [] };
  else if (path === '/api/agent/running') json = { runningSessionIds: running };
  else if (path === '/api/agent/new') {
    dispatches.push(request.postDataJSON());
    running = ['fixture-publication']; tasks = [{ id: 'fixture-browser-task', parentSessionId: running[0], status: 'running' }];
    json = { sessionId: running[0] };
  } else if (path.startsWith('/api/agent/')) json = { running: true, state: { isStreaming: true } };
  else if (path.startsWith('/api/files/')) {
    const content = decodeURIComponent(path).includes('interviewer-alignment') ? reportHtml : jdHtml;
    json = { content, language: 'html', size: content.length };
  } else if (path === '/api/git/diff') json = { isGitRepo: false, patch: null };
  else if (path === '/api/jarvis') json = { sessionId: 'fixture-jarvis', tasks: [] };
  else if (path === '/api/plugins') json = { packages: [] };
  else if (path === '/api/models') json = { models: [], modelList: [], defaultModel: null };
  return route.fulfill({ json });
});
const all = () => page.getByRole('button', { name: /^查看全部 AI 洞察/ });
const app = () => page.locator('.agent-os-window-insights');
const widget = () => page.locator('.workspace-widget-insights');
const closeApp = () => app().getByRole('button', { name: '关闭', exact: true }).click();
const shared = async () => {
  const desktopTitles = await widget().locator('.workspace-insight-title').allTextContents();
  const appTitles = await app().locator('nav strong').allTextContents();
  assert.deepEqual(appTitles, desktopTitles);
  assert.deepEqual(await app().locator('nav small').allTextContents(), await widget().locator('.workspace-insight-summary').allTextContents());
};
try {
  await page.goto(url);
  await all().click();
  await app().getByRole('heading', { name: '洞察会在合适的时机出现' }).waitFor();
  await closeApp();
  sessions = [jdSession];
  await page.getByRole('button', { name: '稍后发布', exact: true }).waitFor();
  assert.equal(await widget().locator('.workspace-insight').count(), 1);
  await page.getByRole('button', { name: '稍后发布', exact: true }).click();
  await page.locator('.agent-os-window-jd').getByRole('button', { name: '关闭', exact: true }).click();
  await all().click();
  await app().getByRole('button', { name: '发布岗位', exact: true }).waitFor();
  await app().frameLocator('iframe').getByRole('heading', { name: job.title }).waitFor();
  await shared();
  await page.screenshot({ path: join(output, 'publication-ready.png') });
  await app().getByRole('button', { name: '发布岗位', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.insights-publication>button')?.textContent === '正在发布…');
  assert.equal(await app().getByRole('button', { name: '正在发布…', exact: true }).isDisabled(), true);
  assert.equal(await widget().locator('.workspace-insight').isDisabled(), true);
  assert.equal(dispatches.length, 1);
  assert.equal(dispatches[0].demoAction, 'publish-jd');
  await page.screenshot({ path: join(output, 'publication-pending.png') });
  await page.reload(); await all().click();
  await page.waitForFunction(() => document.querySelector('.insights-publication>button')?.textContent === '正在发布…');
  assert.equal(await app().getByRole('button', { name: '正在发布…', exact: true }).isDisabled(), true);
  await shared(); assert.equal(dispatches.length, 1, 'reopening a pending publication does not start another task');
  jobs = [job]; running = []; tasks = [{ ...tasks[0], status: 'completed' }];
  await page.waitForFunction(() => document.querySelector('.insights-publication>button')?.textContent === '已发布');
  await shared();
  results = [report];
  await page.waitForFunction(() => document.querySelectorAll('.insights-sidebar nav>button').length === 2);
  await shared();
  assert.equal(await app().getByRole('button', { name: '已发布', exact: true }).isDisabled(), true, 'new report and reordering preserve publication selection');
  await page.screenshot({ path: join(output, 'publication-completed.png') });
  await app().getByRole('navigation', { name: '洞察列表' }).getByRole('button', { name: /面试官评价标准不一致/ }).click();
  await app().frameLocator('iframe').getByRole('heading', { name: '面试官评价标准不一致' }).waitFor();
  await app().getByRole('navigation', { name: '洞察列表' }).getByRole('button', { name: /岗位发布建议/ }).click();
  await app().frameLocator('iframe').getByRole('heading', { name: job.title }).waitFor();
  await page.reload();
  await all().click();
  await app().getByRole('navigation', { name: '洞察列表' }).getByRole('button', { name: /岗位发布建议/ }).click();
  assert.equal(await app().getByRole('button', { name: '已发布', exact: true }).isDisabled(), true);
  await shared(); assert.equal(dispatches.length, 1);
  await page.setViewportSize({ width: 800, height: 780 });
  await page.screenshot({ path: join(output, 'publication-small-window.png') });
  assert.equal(await app().locator('.insights-app').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  assert.deepEqual(errors, []);
  console.log('PASS: empty entry, real JD recognition, shared list, application publishing, synchronized states, report navigation, reload, narrow window; exactly one mocked publication dispatch.');
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png') });
  console.error('Page errors:', errors);
  throw error;
} finally { await browser.close(); }
