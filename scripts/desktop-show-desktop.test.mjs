import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

// Run against an isolated presentation dev server. All API calls are fixtures;
// this verifies the real desktop UI without model calls or user-data writes.
const url = process.env.SYNTROPIC_TEST_URL;
test('desktop background hides and restores mounted windows without losing work', { skip: !url, timeout: 90000 }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(10000);
    await page.route('**/api/**', async route => {
      const request = route.request();
      const target = new URL(request.url());
      requests.push({ path: target.pathname, method: request.method(), body: request.postData() });
      if (target.pathname.endsWith('/events') || target.searchParams.get('type') === 'watch') {
        return route.fulfill({ contentType: 'text/event-stream', body: ': fixture\n\n' });
      }
      let body = { sessions: [], workspaces: [], packages: [], tasks: [], pages: [], results: [], items: [], models: [], installations: [] };
      if (target.pathname === '/api/jarvis') body = { sessionId: 'fixture-jarvis', created: true, tasks: [] };
      if (target.pathname.startsWith('/api/files/')) {
        body = target.searchParams.get('type') === 'list'
          ? { entries: [{ name: 'draft.txt', isDir: false, size: 20 }] }
          : { content: 'Original draft\n', language: 'text', size: 20, revision: 'fixture', modified: '2026-09-10T00:00:00Z' };
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(url);
    await page.locator('.workspace-widgets').waitFor();
    const windowFor = title => page.locator(`.agent-os-window[aria-label="${title}"]`);
    const dock = name => page.getByRole('navigation', { name: '应用程序 Dock' }).getByRole('button', { name: new RegExp(`(?:打开|切换到) ${name}$`) });
    const visible = () => page.locator('.agent-os-window:not(.is-desktop-hidden)').count();
    const waitCount = count => page.waitForFunction(n => document.querySelectorAll('.agent-os-window:not(.is-desktop-hidden)').length === n, count);
    // Find genuine exposed wallpaper, including gaps in the widget scroll layer.
    const backgroundPoint = async () => page.evaluate(() => {
      for (let y = 120; y < innerHeight - 120; y += 25) {
        for (let x = innerWidth - 4; x > 0; x -= 25) {
          const el = document.elementFromPoint(x, y);
          if (el?.matches('.workspace-widgets, .agent-os-desktop')) return { x, y };
        }
      }
      throw new Error('No exposed desktop background');
    });
    const clickBackground = async () => { const p = await backgroundPoint(); await page.mouse.click(p.x, p.y); };
    const drag = async (locator, dx, dy) => {
      const box = await locator.boundingBox();
      assert.ok(box);
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up();
    };

    await dock('产物库').click();
    await windowFor('产物库').getByRole('textbox', { name: '搜索产物' }).fill('library draft');
    await dock('飞书').click();
    await windowFor('飞书').getByRole('textbox', { name: '搜索飞书文档' }).fill('保留搜索内容');
    await drag(windowFor('飞书').locator('.agent-os-window-bar'), 45, 30);
    await drag(windowFor('飞书').locator('.agent-os-window-resize.is-se'), 20, 20);
    await waitCount(2);
    const geometry = await windowFor('飞书').getAttribute('style');
    const front = await page.locator('.agent-os-window.is-front').getAttribute('aria-label');
    await page.evaluate(() => { window.__desktopTestNodes = [...document.querySelectorAll('.agent-os-window')]; });

    await clickBackground(); await waitCount(0);
    assert.equal(await page.locator('.agent-os-window').count(), 2);
    assert.equal(await page.locator('.agent-os-window[inert][aria-hidden="true"]').count(), 2);
    assert.equal(await page.evaluate(() => document.activeElement?.className), 'agent-os-desktop');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('.agent-os-window'))), false);
    await page.screenshot({ path: '/tmp/syntropic-show-desktop-hidden-verified.png' });
    await clickBackground(); await waitCount(2);
    assert.equal(await windowFor('飞书').getAttribute('style'), geometry);
    assert.equal(await page.locator('.agent-os-window.is-front').getAttribute('aria-label'), front);
    assert.equal(await windowFor('飞书').getByRole('textbox', { name: '搜索飞书文档' }).inputValue(), '保留搜索内容');
    assert.ok(await page.evaluate(() => window.__desktopTestNodes.every(node => node.isConnected)));

    // A background drag (even returning to its origin) and a right click are not clicks.
    const p = await backgroundPoint();
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(p.x - 30, p.y, { steps: 5 }); await page.mouse.move(p.x, p.y); await page.mouse.up();
    assert.equal(await visible(), 2);
    await page.mouse.click(p.x, p.y, { button: 'right' });
    assert.equal(await visible(), 2);
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: '和 Syntropic 对话' }).fill('未发送的内容');
    assert.equal(await visible(), 2);

    await clickBackground(); await waitCount(0);
    await dock('飞书').click(); await waitCount(1);
    assert.ok(await windowFor('产物库').evaluate(el => el.inert));
    await windowFor('飞书').getByRole('button', { name: '最大化', exact: true }).click();
    await clickBackground(); await waitCount(0);
    await clickBackground(); await waitCount(2);
    assert.ok(await windowFor('飞书').evaluate(el => el.classList.contains('is-maximized')));
    await windowFor('飞书').getByRole('button', { name: '还原', exact: true }).click();
    assert.equal(await windowFor('飞书').getAttribute('style'), geometry);
    await clickBackground(); await waitCount(0);
    await dock('飞书').click(); await waitCount(1);
    await windowFor('飞书').getByRole('button', { name: '关闭', exact: true }).click(); await waitCount(0);
    assert.equal(await page.locator('.agent-os-window').count(), 1);
    await clickBackground(); await waitCount(1);
    assert.equal(await windowFor('产物库').getByRole('textbox', { name: '搜索产物' }).inputValue(), 'library draft');
    await windowFor('产物库').getByRole('button', { name: '关闭', exact: true }).click();

    // Widget click/drag must not hide another window; widget links restore only their target.
    await dock('团队日程').click(); await waitCount(1);
    await drag(page.locator('.workspace-widget-goal .agent-os-card > header'), 0, 25);
    assert.equal(await visible(), 1);
    await clickBackground(); await waitCount(0);
    await page.getByRole('button', { name: '打开全部成果', exact: true }).click(); await waitCount(1);
    assert.ok(await windowFor('团队日程').evaluate(el => el.inert));
    await windowFor('产物库').getByRole('button', { name: '关闭', exact: true }).click();
    await clickBackground(); await waitCount(1);
    await windowFor('团队日程').getByRole('button', { name: '关闭', exact: true }).click();

    // Real CodeMirror edits survive hiding without a save, close or remount.
    await dock('文件').click();
    await windowFor('文件').getByText('draft.txt', { exact: true }).dblclick();
    const editor = windowFor('文件').locator('.cm-content');
    await editor.fill(['Unsaved desktop regression draft', ...Array.from({ length: 120 }, (_, index) => `Line ${index}`)].join('\n'));
    const scroller = windowFor('文件').locator('.cm-scroller');
    await scroller.evaluate(el => { el.scrollTop = 240; });
    const scrollTop = await scroller.evaluate(el => el.scrollTop);
    assert.ok(scrollTop > 0);
    await page.evaluate(() => { window.__desktopEditor = document.querySelector('.cm-content'); });
    await clickBackground(); await waitCount(0);
    await dock('文件').click(); await waitCount(1);
    assert.equal(await scroller.evaluate(el => el.scrollTop), scrollTop);
    await scroller.evaluate(el => { el.scrollTop = 0; });
    await page.waitForFunction(() => document.querySelector('.cm-content')?.textContent.includes('Unsaved desktop regression draft'));
    assert.ok(await page.evaluate(() => window.__desktopEditor === document.querySelector('.cm-content')));
    assert.equal(await page.getByRole('textbox', { name: '和 Syntropic 对话' }).inputValue(), '未发送的内容');
    assert.ok(!requests.some(r => r.path.startsWith('/api/files/') && r.method !== 'GET'));
    assert.ok(!requests.some(r => r.body?.includes('"abort"')));
    assert.deepEqual(errors, []);
    await page.screenshot({ path: '/tmp/syntropic-show-desktop-restored-verified.png' });
  } finally {
    await browser.close();
  }
});
