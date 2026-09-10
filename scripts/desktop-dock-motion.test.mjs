import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Real desktop/components with fixture APIs. Never calls models or writes user data.
const url = process.env.SYNTROPIC_TEST_URL;
const output = process.env.SYNTROPIC_DOCK_REVIEW_DIR;
test('Dock motion follows application lifecycle and keeps the pointer target stable', { skip: !url, timeout: 90000 }, async t => {
  if (output) await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 },
    ...(output ? { recordVideo: { dir: output, size: { width: 1440, height: 1000 } } } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route('**/api/**', async route => {
    const target = new URL(route.request().url());
    if (target.pathname.endsWith('/events') || target.searchParams.get('type') === 'watch') {
      return route.fulfill({ contentType: 'text/event-stream', body: ': fixture\n\n' });
    }
    let body = { sessions: [], workspaces: [], packages: [], tasks: [], pages: [], results: [], items: [], models: [], installations: [] };
    if (target.pathname === '/api/jarvis') body = { sessionId: 'fixture-jarvis', created: true, tasks: [] };
    if (target.pathname === '/api/apps/feishu/calendar') body = { events: [], date: target.searchParams.get('date') };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  const dock = page.getByRole('navigation', { name: '应用程序 Dock' });
  const app = name => dock.getByRole('button', { name: new RegExp(`(?:打开|切换到) ${name}$`) });
  const settle = () => page.waitForTimeout(750);
  const point = async button => {
    const b = await button.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height - 15 };
  };
  const click = async button => { const p = await point(button); await page.mouse.click(p.x, p.y); };
  // Sample rendered positions through the animation, not source strings or timers.
  const sample = async (button, duration = 1200, onClick = false) => button.evaluate((el, { ms, onClick }) => {
    window.dockSamples = new Promise(resolve => {
      const run = () => {
      const frames = [], start = performance.now();
      const frame = now => {
        const b = el.getBoundingClientRect();
        const icon = el.querySelector('.desktop-dock-icon');
        const y = new DOMMatrixReadOnly(getComputedStyle(icon).transform).m42;
        const dot = getComputedStyle(el, '::after');
        frames.push({ time: now - start, x: b.x, width: b.width, bottom: b.bottom, y,
          dotBottom: dot.bottom, buttonY: new DOMMatrixReadOnly(getComputedStyle(el).transform).m42, iconWidth: icon.getBoundingClientRect().width });
        if (now - start < ms) requestAnimationFrame(frame); else resolve(frames);
      };
      requestAnimationFrame(frame);
      };
      if (onClick) el.addEventListener('click', run, { once: true }); else run();
    });
  }, { ms: duration, onClick });
  const frames = () => page.evaluate(() => window.dockSamples);
  const spread = values => Math.max(...values) - Math.min(...values);
  const assertStill = rows => {
    assert.ok(spread(rows.map(f => f.x)) < 0.25, `stationary pointer drift: ${spread(rows.map(f => f.x))}px; ${JSON.stringify(rows.filter((_, i) => i % 10 === 0))}`);
    assert.ok(spread(rows.map(f => f.bottom)) < 0.25, 'button and indicator baseline must stay fixed');
    assert.ok(rows.every(f => f.buttonY === 0), 'button must not bounce');
  };
  try {
    await page.goto(url);
    await dock.waitFor();
    await app('产物库').waitFor();
    await settle();
    await t.test('hover settles, launch is one smooth arc, repeated clicks do not restart it', async () => {
      const library = app('产物库');
      await library.hover(); await settle();
      const p = await point(library);
      await page.mouse.move(p.x, p.y); await settle();
      assert.ok(await library.locator('.desktop-dock-scale').evaluate(el => el.getBoundingClientRect().width > 60));
      assert.equal(await library.evaluate(el => el.offsetWidth), 44);
      await sample(library, 1300);
      assertStill(await frames());
      const bar = await dock.boundingBox();
      // Cross both edges quickly, then stop: no feedback oscillation afterward.
      for (let i = 0; i < 3; i++) {
        await page.mouse.move(bar.x + bar.width - 15, p.y, { steps: 8 });
        await page.mouse.move(bar.x + 15, p.y, { steps: 8 });
      }
      await library.hover(); await settle();
      await sample(library, 1300); assertStill(await frames());
      await sample(library, 1200, true);
      await click(library);
      await page.waitForTimeout(140);
      await click(library);
      await page.waitForTimeout(140);
      await click(library);
      const rows = await frames();
      assert.ok(Math.min(...rows.map(f => f.y)) < -12, 'newly opened app must rise');
      const up = rows.findIndex(f => f.y < -1);
      const landed = rows.findIndex((f, i) => i > up && f.y > -0.3);
      assert.ok(landed > up);
      assert.ok(rows.slice(landed).every(f => f.y > -0.3), 'there must not be a second bounce');
      assert.ok(rows[landed].time - rows[up].time < 750, 'repeat clicks must not extend animation');
      assert.ok(Math.abs(rows.at(-1).y) < 0.01, 'icon must return to rest');
      assert.ok(spread(rows.map(f => f.bottom)) < 0.25);
      assert.ok(rows.every(f => f.buttonY === 0));
      assert.ok(rows.filter(f => f.y < -1).every(f => f.dotBottom === '-6px'));
      if (output) await page.screenshot({ path: `${output}/dock-open.png` });
    });
    await t.test('continuous magnification does not relayout the desktop', async () => {
      await page.mouse.move(10, 10); await settle();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      const before = await cdp.send('Performance.getMetrics');
      await dock.evaluate(el => new Promise(resolve => {
        const rect = el.getBoundingClientRect(), start = performance.now();
        const frame = now => {
          el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse',
            clientX: rect.x + rect.width / 2 + (rect.width / 2 - 40) * Math.sin((now - start) / 400), clientY: rect.bottom - 20 }));
          if (now - start < 1800) requestAnimationFrame(frame);
          else { el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: -1000 })); resolve(); }
        };
        requestAnimationFrame(frame);
      }));
      const after = await cdp.send('Performance.getMetrics');
      const metric = (result, name) => result.metrics.find(m => m.name === name).value;
      assert.ok(metric(after, 'LayoutCount') - metric(before, 'LayoutCount') <= 2, 'hover must not trigger layout every frame');
      await cdp.detach(); await settle();
    });
    await t.test('switching, restoring hidden windows and Launchpad do not bounce', async () => {
      await click(app('飞书')); await settle();
      await app('产物库').hover(); await settle();
      await sample(app('产物库')); await click(app('产物库'));
      assert.ok((await frames()).every(f => Math.abs(f.y) < 0.01));
      const p = await page.evaluate(() => {
        for (let y = 120; y < innerHeight - 130; y += 30) for (let x = innerWidth - 5; x > 0; x -= 30) {
          if (document.elementFromPoint(x, y)?.matches('.workspace-widgets, .agent-os-desktop')) return { x, y };
        }
        throw new Error('No exposed wallpaper');
      });
      await page.mouse.click(p.x, p.y);
      await page.locator('.agent-os-window.is-desktop-hidden').first().waitFor({ state: 'attached' });
      await app('产物库').hover(); await settle();
      await sample(app('产物库')); await click(app('产物库'));
      assert.ok((await frames()).every(f => Math.abs(f.y) < 0.01));
      assert.equal(await page.locator('.agent-os-window[aria-label="产物库"].is-desktop-hidden').count(), 0);
      const launchpad = dock.getByRole('button', { name: '启动台', exact: true });
      await sample(launchpad); await click(launchpad);
      assert.ok((await frames()).every(f => Math.abs(f.y) < 0.01));
      await page.keyboard.press('Escape');
      await app('产物库').click({ button: 'right' });
      await page.getByRole('menu', { name: '产物库 程序坞选项' }).waitFor();
      await page.keyboard.press('Escape');
    });
    await t.test('no-op clicks, keyboard, reduced motion and narrow screens', async () => {
      // Empty task list cannot open an app and must not falsely animate.
      await sample(app('任务')); await click(app('任务'));
      assert.ok((await frames()).every(f => Math.abs(f.y) < 0.01));
      await page.mouse.move(10, 10);
      await page.keyboard.press('Tab');
      await app('设置').focus(); await settle();
      assert.ok(await app('设置').locator('.desktop-dock-scale').evaluate(el => el.getBoundingClientRect().width > 60), 'keyboard focus magnifies');
      await sample(app('设置')); await page.keyboard.press('Enter');
      assert.ok(Math.min(...(await frames()).map(f => f.y)) < -12, 'keyboard activation launches once');
      await page.emulateMedia({ reducedMotion: 'reduce' }); await settle();
      await app('团队日程').hover();
      await sample(app('团队日程')); await click(app('团队日程'));
      const reduced = await frames();
      assert.ok(reduced.every(f => f.width === 44 && f.iconWidth === 44 && Math.abs(f.y) < 0.01));
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width: 600, height: 850 }); await settle();
      assert.equal(await dock.getAttribute('data-crowded'), 'true');
      assert.ok((await dock.boundingBox()).width <= 568);
      await app('产物库').hover(); await settle();
      assert.equal((await app('产物库').boundingBox()).width, 44);
      await page.setViewportSize({ width: 1440, height: 1000 }); await settle();
      await app('产物库').hover(); await settle();
      await sample(app('产物库'), 1300); assertStill(await frames());
      if (output) await page.screenshot({ path: `${output}/dock-hover.png` });
    });
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    if (output) await page.video()?.saveAs(`${output}/dock-verification.webm`);
    await browser.close();
  }
});
