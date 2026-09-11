import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const url = process.env.SYNTROPIC_TEST_URL;
// Real React/Spaces and browser events; all APIs are fixtures. No model, calendar
// write, or native activation is permitted by this test's route interceptor.
test('picture-in-picture keeps its task and recording across controls and Spaces', { skip: !url, timeout: 120000 }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    const errors = [], controls = [], opens = [], reconnects = [];
    page.on('pageerror', error => errors.push(error.message));
    const jpeg = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 410;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f3f5f8'; ctx.fillRect(0, 0, 720, 410);
      ctx.fillStyle = '#3370ff'; ctx.fillRect(0, 0, 80, 410);
      return canvas.toDataURL('image/jpeg');
    });
    let state = { available: true, interactionStarted: false, phase: 'running', detail: '正在填写会议', taskId: 'fixture-task', steps: 2, target: { windowId: '1', title: '飞书' } };
    await page.addInitScript(({ jpeg, state }) => {
      const Source = window.EventSource;
      const channels = new Set();
      window.previewSubscriptions = 0;
      window.previewStatus = state;
      window.emitComputerState = value => {
        window.previewStatus = value;
        for (const channel of channels) channel.publish();
      };
      window.EventSource = class extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        constructor(url, options) {
          super();
          if (!String(url).startsWith('/api/desktop/events')) return new Source(url, options);
          this.frames = String(url).includes('frames=1');
          if (this.frames) window.previewSubscriptions++;
          channels.add(this);
          queueMicrotask(() => this.onopen?.());
          this.timer = setInterval(() => this.publish(), 200);
        }
        publish() {
          this.dispatchEvent(new MessageEvent('computer-status', { data: JSON.stringify(window.previewStatus) }));
          if (this.frames) this.dispatchEvent(new MessageEvent('computer-frame', { data: JSON.stringify(window.previewFrameError ? { error: '画面连接已中断，请检查飞书。' } : { dataUrl: jpeg, windowId: window.previewStatus.target?.windowId }) }));
        }
        close() { clearInterval(this.timer); channels.delete(this); }
      };
    }, { jpeg, state });
    await page.route('**/api/**', async route => {
      const request = route.request(), target = new URL(request.url());
      if (target.pathname === '/api/computer/open') { opens.push(request.postDataJSON()); return route.fulfill({ json: { opened: true } }); }
      if (target.pathname === '/api/computer' && request.method() === 'POST') {
        const action = request.postDataJSON().action;
        if (action === "reconnect") {
          reconnects.push(action);
          // Recovery follows the reconnect request; an earlier good frame can
          // correctly remove the button before Playwright gets to click it.
          await page.evaluate(() => { window.previewFrameError = false; });
          return route.fulfill({ json: { accepted: true } });
        }
        controls.push(action);
        const phase = { pause: 'paused', resume: 'running', stop: 'stopped' }[action];
        state = { ...state, phase, detail: { pause: '操作已暂停，可继续或检查飞书草稿', resume: '继续处理会议', stop: '操作已停止，请检查飞书中保留的草稿。' }[action] };
        await page.evaluate(state => window.emitComputerState(state), state);
        return route.fulfill({ json: { accepted: true } });
      }
      if (target.pathname.endsWith('/events') || target.searchParams.get('type') === 'watch') return route.fulfill({ contentType: 'text/event-stream', body: ': fixture\n\n' });
      let body = { sessions: [], workspaces: [], packages: [], tasks: [], pages: [], results: [], items: [], models: [], installations: [] };
      if (target.pathname === '/api/jarvis') body = { sessionId: 'fixture-jarvis', created: true, tasks: [] };
      return route.fulfill({ json: body });
    });
    await page.goto(url);
    const pip = page.locator('.computer-preview');
    const switchSpace = async (name) => {
      await page.getByRole('button', { name: `切换到${name}`, exact: true }).click();
      // Check actual in-flight movement, not just declared transition styles.
      const moving = await page.waitForFunction(() => {
        const elements = ['.agent-os-desktop', '.agent-os-window-insights', '.computer-preview'].map(selector => document.querySelector(selector));
        const animations = elements.map(el => el.getAnimations().find(a => a.transitionProperty === 'transform'));
        if (animations.some(a => !a || a.currentTime <= 0 || a.playState !== 'running')) return false;
        return animations.map(a => ({ duration: a.effect.getTiming().duration, progress: a.effect.getComputedTiming().progress }));
      });
      const samples = await moving.jsonValue();
      assert.ok(samples.every(sample => sample.duration >= 450 && sample.duration <= 600 && sample.progress > 0 && sample.progress < 1));
      assert.ok(Math.max(...samples.map(s => s.progress)) - Math.min(...samples.map(s => s.progress)) < .08, 'cards, windows and PiP move together');
      await page.evaluate(() => Promise.all([...document.querySelectorAll('.agent-os-desktop, .agent-os-window-insights, .computer-preview')].flatMap(el => el.getAnimations().map(a => a.finished))));
    };
    const ready = () => page.waitForFunction(() => { const image = document.querySelector('.computer-canvas img'); return image?.naturalWidth > 0 && !image.hidden; });
    await page.getByRole('textbox', { name: '和 Syntropic 对话', exact: true }).waitFor();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: '打开 浏览器', exact: true }).click();
    // Seed overlapping application windows through the real widget callback.
    await page.getByRole('button', { name: /^查看全部 AI 洞察/ }).dispatchEvent('click');
    const insight = page.locator('.agent-os-window-insights');
    const assertInsightFront = async () => {
      assert.match(await insight.getAttribute('class'), /is-front/, 'PiP must preserve the underlying app focus');
      await page.waitForFunction(() => {
        const window = document.querySelector('.agent-os-window-insights');
        const box = window.getBoundingClientRect();
        return document.elementFromPoint(box.x + box.width / 2, box.y + 20)?.closest('[data-window-id]')?.getAttribute('data-window-id') === 'insights';
      }); // Wait for the Space slide to finish before checking actual hit order.
    };
    await assertInsightFront();
    assert.equal(await pip.count(), 0, 'task creation and bootstrap must not open PiP');
    assert.equal(await page.getByRole('button', { name: '飞书实时画面', exact: true }).count(), 0, 'no manual preview entry');
    state = { ...state, interactionStarted: true };
    await page.evaluate(state => window.emitComputerState(state), state);
    await ready();
    await assertInsightFront();
    await page.evaluate(() => { window.previewFrameError = true; });
    await pip.locator('.computer-recovering').waitFor();
    assert.equal(await pip.locator('img').isVisible(), true, 'keep last frame during a short interruption');
    await page.evaluate(() => { window.previewFrameError = false; });
    await pip.locator('.computer-recovering').waitFor({ state: 'hidden' });
    await page.waitForTimeout(1700);
    assert.equal(await pip.locator('img').isVisible(), true, 'recovery cancels the stale error timer');
    state = { ...state, target: { windowId: '2', title: '新建日程' } };
    await page.evaluate(state => window.emitComputerState(state), state);
    await ready();
    await page.waitForTimeout(5200);
    assert.equal(await pip.locator('img').isVisible(), true, 'target switch must not clear the new frame later');
    await page.mouse.move(750, 300);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.computer-controls')).opacity === '0');
    await page.waitForFunction(() => { const r = document.querySelector('.computer-preview').getBoundingClientRect(); return Math.abs(r.width / r.height - 720 / 410) < .002; });
    const compact = await pip.boundingBox(); assert.equal(compact.width, 350);
    assert.ok(Math.abs(compact.width / compact.height - 720 / 410) < .002);
    assert.equal(await pip.locator('.agent-os-window-bar, header, footer').count(), 0);
    assert.deepEqual(opens, []);
    await page.evaluate(() => { window.previewNode = document.querySelector('.computer-canvas img'); });
    await pip.hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.computer-controls')).opacity === '1');
    await pip.getByRole('button', { name: '暂停任务', exact: true }).click();
    await pip.getByRole('button', { name: '继续任务', exact: true }).waitFor();
    assert.match(await pip.locator('.computer-notice').innerText(), /已暂停/);
    await assertInsightFront();
    await pip.hover(); await pip.getByRole('button', { name: '继续任务', exact: true }).click();
    await pip.getByRole('button', { name: '暂停任务', exact: true }).waitFor();
    await page.evaluate(() => { window.previewNode = document.querySelector('.computer-canvas img'); window.subscriptionBaseline = window.previewSubscriptions; });
    const rect = await pip.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
    await page.mouse.move(650, 110, { steps: 20 });
    const target = page.locator('[data-space-target="new"]'); await target.waitFor(); const box = await target.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 }); await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('.spaces-trigger span').textContent === '桌面 2');
    await pip.hover(); await pip.getByRole('button', { name: '放大预览', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.computer-preview').getBoundingClientRect().width > 1000);
    const expanded = await pip.boundingBox(); assert.ok(Math.abs(expanded.width / expanded.height - 720 / 410) < .002);
    await page.getByRole('button', { name: '桌面总览', exact: true }).click();
    await switchSpace('桌面 1');
    assert.equal(await pip.getAttribute('aria-hidden'), 'true');
    await assertInsightFront();
    await page.getByRole('button', { name: '桌面总览', exact: true }).click();
    await switchSpace('桌面 2');
    assert.ok(await page.evaluate(() => document.querySelector('.computer-canvas img') === window.previewNode && window.previewSubscriptions === window.subscriptionBaseline));
    await pip.hover(); await pip.getByRole('button', { name: '还原小窗', exact: true }).click();
    await page.waitForFunction(() => Math.abs(document.querySelector('.computer-preview').getBoundingClientRect().width - 350) < .1);
    await pip.getByRole('button', { name: '打开飞书客户端', exact: true }).click(); assert.equal(opens.length, 1);
    assert.deepEqual(controls, ['pause', 'resume']);
    await pip.getByRole('button', { name: '小窗选项', exact: true }).click();
    await pip.getByRole('combobox', { name: '将飞书小窗移到桌面' }).selectOption('desktop-1');
    await page.waitForFunction(() => document.querySelector('.spaces-trigger span').textContent === '桌面 1');
    for (const [phase, detail, title] of [['verifying', '正在核对飞书日历', '正在核对日历'], ['completed', '会议已保存，日历已同步', '会议已安排'], ['failed', '请让日历所有者授予编辑权限。', '需要你处理']]) {
      state = { ...state, phase, detail };
      await page.evaluate(state => window.emitComputerState(state), state);
      await page.waitForFunction(title => document.querySelector('.computer-notice strong')?.textContent === title, title);
      assert.match(await pip.innerText(), new RegExp(detail));
      await assertInsightFront();
    }
    await page.evaluate(() => { window.previewFrameError = true; });
    await pip.getByRole('button', { name: '重新连接' }).waitFor();
    assert.equal(await pip.locator('img').getAttribute('hidden'), '');
    await pip.getByRole('button', { name: '重新连接' }).click(); await ready();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const small = await pip.boundingBox(); assert.ok(small.x >= 0 && small.x + small.width <= 390 && small.y >= 44 && small.y + small.height <= 844);
    await page.setViewportSize({ width: 1440, height: 1000 });
    state = { ...state, phase: 'running', detail: '继续处理会议' };
    await page.evaluate(state => window.emitComputerState(state), state);
    await pip.getByRole('button', { name: '暂停任务', exact: true }).waitFor();
    await pip.hover(); await pip.getByRole('button', { name: '小窗选项', exact: true }).click();
    await pip.getByRole('button', { name: '停止任务', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.computer-notice strong')?.textContent === '任务已停止');
    await pip.getByRole('button', { name: '隐藏小窗', exact: true }).click();
    assert.equal(await pip.count(), 0);
    state = { ...state, phase: 'running' };
    await page.evaluate(state => window.emitComputerState(state), state);
    await page.waitForTimeout(300);
    assert.equal(await pip.count(), 0, 'status updates must not reopen a hidden preview');
    state = { ...state, taskId: 'fixture-next-task' };
    await page.evaluate(state => window.emitComputerState(state), state);
    await ready();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.press('Control+ArrowRight');
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.agent-os-desktop, .agent-os-window-insights, .computer-preview')].every(el => el.getAnimations().length === 0)), 'reduced motion switches without animation');
    assert.deepEqual(reconnects, ['reconnect']); assert.deepEqual(controls, ['pause', 'resume', 'stop']); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
