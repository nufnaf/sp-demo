// Run only against an isolated local presentation server. Business responses are
// intercepted here; no publication, calendar mutation or external message occurs.
// SYNTROPIC_TEST_URL=http://127.0.0.1:30142 node --test scripts/design-audit.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createJiti } from 'jiti';

const base = process.env.SYNTROPIC_TEST_URL;
const output = process.env.SYNTROPIC_TEST_SCREENSHOTS || '/tmp/syntropic-design-audit-screenshots';
test('card header typography stays consistent in regular and short windows', { skip: !base, timeout: 30_000 }, async t => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(base);
  await page.locator('.workspace-widget-tasks header small').waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (const height of [1000, 800]) {
    await page.setViewportSize({ width: 1440, height });
    const labels = await page.locator('.workspace-widget .agent-os-card > header > :is(button, small)').evaluateAll(elements => elements.map(el => {
      const style = getComputedStyle(el);
      const range = document.createRange(); range.selectNodeContents(el.firstChild);
      return { text: el.textContent, y: range.getBoundingClientRect().y,
        typography: [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight, style.letterSpacing],
      };
    }));
    assert.equal(labels.length, 5);
    for (const label of labels) assert.deepEqual(label.typography, labels[0].typography, `${height}px: ${label.text}`);
    assert.equal(labels[0].typography[1], height === 1000 ? '13px' : '12px');
    const firstRow = labels.slice(0, 4).map(label => label.y);
    assert.ok(Math.max(...firstRow) - Math.min(...firstRow) <= 0.5, 'actions and status share the same text baseline');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/header-typography-${height}.png` });
  }
});

test('design audit: composer, shared branding, schedules and publication states', { skip: !base, timeout: 120_000 }, async t => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let jobs = [], calendarReads = 0, sends = 0;
  await page.route('**/api/apps/feishu/calendar?*', route => {
    calendarReads++;
    const date = new URL(route.request().url()).searchParams.get('date');
    return route.fulfill({ json: { date, fetchedAt: new Date().toISOString(), events: [{ id: 'meeting', title: '招聘进展周会', startsAt: `${date}T06:00:00Z`, endsAt: `${date}T07:00:00Z`, location: '线上会议', description: '核对候选人进展，确认下一轮面试安排。' }] } });
  });
  await page.route('**/api/apps/feishu/documents', route => route.fulfill({ json: { items: [{ id: 'intro', title: '星流科技业务介绍', type: 'docx', readable: true, modifiedAt: '2026-09-11T00:00:00Z' }] } }));
  await page.route('**/api/apps/internal-recruiting', route => route.fulfill({ json: { jobs, baseUrl: 'http://localhost' } }));
  await page.route(/\/api\/agent\/[\w-]+$/, route => {
    if (route.request().method() !== 'POST') return route.continue();
    sends++;
    return route.fulfill({ status: 400, json: { error: '请检查输入后重试', code: 'prompt_rejected', accepted: false } });
  });
  await page.route('**/api/app-store/installations', route => route.fulfill({ json: { installed: ['boss-zhipin'], builtins: ['feishu'] } }));
  await page.goto(base);
  const input = page.getByRole('textbox', { name: '和 Syntropic 对话', exact: true });
  await input.waitFor();
  const form = page.locator('form.agent-os-composer');
  const shot = async name => {
    await page.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))));
    await page.screenshot({ path: `${output}/${name}.png` });
  };
  const blur = () => input.evaluate(el => el.blur());
  const height = () => form.evaluate(el => el.getBoundingClientRect().height);
  await t.test('focus expands, multiline and IME keep drafts, rejected Enter send stays retryable', async () => {
    await blur();
    assert.ok(await height() < 70);
    await input.focus();
    await page.waitForFunction(() => document.querySelector('form.agent-os-composer').getBoundingClientRect().height >= 130);
    await input.fill('第一行');
    await input.press('Shift+Enter');
    await input.press('a');
    assert.equal(await input.inputValue(), '第一行\na');
    await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
    assert.equal(sends, 0);
    await blur();
    assert.ok(await height() >= 130);
    await shot('composer-expanded');
    await input.focus();
    await page.getByRole('button', { name: '发送给 Syntropic', exact: true }).waitFor();
    await input.press('Enter');
    await page.waitForFunction(() => !document.querySelector('button[aria-label="发送给 Syntropic"]')?.disabled);
    assert.equal(sends, 1);
    assert.equal(await input.inputValue(), '第一行\na');
    await input.fill(''); await blur();
    await page.waitForFunction(() => document.querySelector('form.agent-os-composer').getBoundingClientRect().height < 70);
  });
  const open = name => page.getByRole('navigation', { name: '应用程序 Dock' }).getByRole('button', { name: new RegExp(`(?:打开|切换到) ${name}$`) }).click();
  const close = async name => page.locator(`.agent-os-window[aria-label="${name}"]`).getByRole('button', { name: '关闭', exact: true }).first().click();
  const iconMarkup = root => root.locator('[data-app-brand="recruiting"] img').getAttribute('src');
  await t.test('recruiting and BOSS brands match across Dock, launcher, app headers, source cards and store', async () => {
    const dock = page.getByRole('navigation', { name: '应用程序 Dock' });
    const recruiting = await iconMarkup(dock);
    const boss = await dock.locator('[data-app-brand="boss-zhipin"]').getAttribute('src');
    assert.equal(boss, '/icons/apps/boss-zhipin.jpg');
    await open('人才招聘');
    const hr = page.locator('.hr-recruiting-app');
    assert.equal(await iconMarkup(hr), recruiting);
    assert.equal(await page.locator('.agent-os-window[aria-label="人才招聘"] .agent-os-window-bar > strong').innerText(), '');
    await hr.getByRole('button', { name: /招聘应用/ }).first().click();
    assert.equal(await hr.locator('[data-app-brand="boss-zhipin"]').getAttribute('src'), boss);
    await shot('recruiting-sources');
    await close('人才招聘');
    await open('BOSS 直聘');
    assert.equal(await page.locator('.boss-demo-brand [data-app-brand="boss-zhipin"]').getAttribute('src'), boss);
    await close('BOSS 直聘');
    await page.getByRole('button', { name: '启动台', exact: true }).click();
    const launcher = page.locator('.agent-os-launchpad');
    assert.equal(await iconMarkup(launcher), recruiting);
    assert.equal(await launcher.locator('[data-app-brand="boss-zhipin"]').getAttribute('src'), boss);
    await shot('launcher');
    await page.keyboard.press('Escape');
    await open('应用市场');
    const storeBoss = page.locator('.agent-store-icon').filter({ has: page.locator('[data-app-brand="boss-zhipin"]') }).first();
    await storeBoss.waitFor();
    assert.equal(await storeBoss.evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
    await shot('app-store');
    await close('应用市场');
  });
  await t.test('Feishu typography and both schedule entrances preserve refresh and date navigation', async () => {
    await open('团队日程');
    await page.locator('.presentation-schedule h2').filter({ hasText: '招聘进展周会' }).waitFor();
    await shot('schedule');
    await close('团队日程');
    await open('飞书');
    const feishu = page.locator('.feishu-workspace');
    assert.equal(await feishu.locator('.feishu-home-header h2').evaluate(el => getComputedStyle(el).fontWeight), '500');
    await feishu.getByRole('button', { name: '会议', exact: true }).click();
    await feishu.getByRole('heading', { name: '招聘进展周会', exact: true }).waitFor();
    const prior = await feishu.locator('.calendar-controls > span').innerText();
    await feishu.getByRole('button', { name: '查看后 7 天' }).click();
    await page.waitForFunction(prior => document.querySelector('.feishu-workspace .calendar-controls > span').textContent !== prior, prior);
    const reads = calendarReads;
    await feishu.getByRole('button', { name: '刷新日程', exact: true }).click();
    assert.ok(calendarReads > reads);
    await shot('feishu-schedule');
    await close('飞书');
  });
  await t.test('publication detail restores ready, attention and verified channel states', async () => {
    const key = await page.evaluate(() => Object.keys(localStorage).find(key => key.startsWith('syntropic:notifications:')));
    assert.ok(key);
    const cwd = key.slice('syntropic:notifications:'.length);
    const suggestion = { cwd, filePath: `${cwd}/engineer-jd.html`, sessionId: 'audit-jd', taskTitle: '生成岗位 JD', recognizedAt: new Date().toISOString() };
    const draft = createHash('sha256').update(`${cwd}\n${suggestion.filePath}`).digest('hex').slice(0, 32);
    const job = { id: 'audit-job', draft, title: '高级 AI Agent 研发工程师', department: 'Agent Platform', location: '北京 / 上海', headcount: 6, owner: '招聘团队', candidateCount: 0, publishedAt: new Date().toISOString(), url: 'http://localhost/jobs/audit-job' };
    for (const state of ['ready', 'attention', 'internal-only', 'published']) {
      jobs = state === 'internal-only' ? [job] : state === 'published' ? [{ ...job, bossPublication: { mode: 'demo', status: 'published', publishedAt: job.publishedAt } }] : [];
      await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key, saved: { suggestion, dismissed: true, completedJob: jobs[0] ?? null, publicationError: state === 'attention' ? '尚未核对网页保存结果，请检查任务进展。' : null } });
      await page.reload();
      await page.getByRole('button', { name: /查看全部 AI 洞察/ }).click();
      const detail = page.locator('.insights-publication');
      await detail.waitFor();
      assert.equal(await page.locator('.insights-detail iframe').count(), 0, 'JD is a separate action');
      if (state === 'ready') assert.equal(await detail.getByRole('button', { name: '发布岗位', exact: true }).isEnabled(), true);
      if (state === 'attention') assert.match(await detail.getByRole('alert').innerText(), /尚未核对/);
      if (jobs.length) {
        assert.equal(await detail.locator('.publication-channels > div').nth(1).innerText(), `BOSS 直聘\n${state === 'published' ? '已发布' : '未发布'}`);
        await detail.getByRole('button', { name: '查看招聘进展' }).click();
        await page.locator('.hr-recruiting-app').waitFor();
        await close('人才招聘');
      }
      await shot(`insight-${state}`);
      if (state === 'published') {
        await page.setViewportSize({ width: 1000, height: 800 });
        await shot('insight-narrow');
        assert.equal(await detail.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      }
      await close('AI 洞察');
    }
  });
  await t.test('JD icons render without a server or network', async () => {
    const jiti = createJiti(import.meta.url);
    const { renderRecruitingJdDemo } = await jiti.import('../lib/recruiting-jd-demo-renderer.ts');
    const offline = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
    const document = await offline.newPage();
    await document.setContent(renderRecruitingJdDemo());
    assert.equal(await document.locator('.chips .jd-icon').count(), 3);
    assert.equal(await document.locator('.jd-icon').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)), true);
    await document.screenshot({ path: `${output}/jd-offline.png` });
    await offline.close();
  });
  assert.deepEqual(errors, []);
});
