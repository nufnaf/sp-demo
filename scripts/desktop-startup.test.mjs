import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import test from 'node:test';
import { _electron as electron } from 'playwright-core';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'build/startup-validation');

test('native startup overlay: slow/fast start, retry, timeout, resize, reduced motion and cleanup', { timeout: 45000 }, async () => {
  const data = await mkdtemp(join(tmpdir(), 'syntropic-startup-test-'));
  await mkdir(output, { recursive: true });
  const env = { ...process.env, SYNTROPIC_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const desktop = await electron.launch({ args: [join(root, 'scripts/fixtures/startup-harness.mjs')], env, timeout: 15000 });
  try {
    await desktop.firstWindow();
    await desktop.evaluate(async () => { await globalThis.startupFixture.loaded; });
    const main = desktop.context().pages().find(page => page.url().startsWith('data:'));
    assert.ok(main);
    const splash = desktop.context().pages().find(page => page.url().endsWith('/status.html'));
    assert.ok(splash, 'local startup page is an independent WebContents');
    const errors = [];
    splash.on('pageerror', error => errors.push(error.message));
    const phase = () => desktop.evaluate(() => globalThis.startupFixture.screen.state.phase);
    const visible = () => desktop.evaluate(() => globalThis.startupFixture.screen.view.getVisible());
    await splash.locator('.brand').waitFor();
    assert.equal(await phase(), 'starting');
    assert.ok(await visible());
    assert.ok(await splash.locator('img').evaluate(img => img.complete && img.naturalWidth === 1024));
    assert.equal(await splash.locator('#error').isVisible(), false);
    const navCount = await splash.evaluate(() => performance.getEntriesByType('navigation').length);
    await desktop.evaluate(() => globalThis.startupFixture.screen.show({ phase: 'starting', title: '内部服务状态', detail: '技术信息', retry: false }));
    assert.equal(await splash.locator('#detail').isVisible(), false);
    assert.equal(await splash.evaluate(() => performance.getEntriesByType('navigation').length), navCount);
    await splash.screenshot({ path: join(output, 'startup.png') });
    // Already-loaded backend HTML must remain covered until the renderer signals.
    assert.ok(await main.locator('#action').isVisible());
    await main.evaluate(() => window.syntropicDesktop.ready());
    await splash.waitForFunction(() => document.querySelector('#splash').dataset.phase === 'revealing');
    await desktop.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
    assert.equal(await phase(), 'hidden');
    assert.equal(await visible(), false);
    await main.locator('#action').click();
    // An error during fade must cancel its delayed dismissal.
    await desktop.evaluate(() => {
      const s = globalThis.startupFixture.screen;
      s.show(); s.reveal();
      s.show({ phase: 'error', title: '无法启动工作台', detail: '服务未能启动，请重新尝试。', retry: true });
    });
    await splash.locator('#retry').waitFor();
    await desktop.evaluate(() => new Promise(resolve => setTimeout(resolve, 800)));
    assert.equal(await phase(), 'error');
    assert.ok(await visible());
    assert.equal(await splash.locator('.icon-motion').evaluate(el => getComputedStyle(el).animationName), 'none');
    await splash.screenshot({ path: join(output, 'startup-error.png') });
    await splash.locator('#retry').click();
    assert.equal(await desktop.evaluate(() => globalThis.startupFixture.retries), 1);
    assert.equal(await phase(), 'starting');
    // Fast start does not wait for the 3.2-second breathing cycle.
    const start = Date.now();
    await main.evaluate(() => window.syntropicDesktop.ready());
    await desktop.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
    assert.equal(await phase(), 'hidden');
    assert.ok(Date.now() - start < 1500);
    await desktop.evaluate(() => globalThis.startupFixture.screen.waitForWorkbench());
    await splash.locator('#error').waitFor();
    assert.match(await splash.locator('#title').textContent(), /加载时间/);
    await splash.locator('#retry').click();
    await desktop.evaluate(() => globalThis.startupFixture.win.setContentSize(1120, 780));
    assert.deepEqual(await desktop.evaluate(() => globalThis.startupFixture.screen.view.getBounds()), { x: 0, y: 0, width: 1120, height: 780 });
    await splash.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await splash.locator('.icon-motion').evaluate(el => getComputedStyle(el).animationName), 'none');
    await main.evaluate(() => window.syntropicDesktop.ready());
    await desktop.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)));
    assert.equal(await phase(), 'hidden');
    await desktop.evaluate(() => globalThis.startupFixture.screen.show({ phase: 'error', title: '安装包配置不可用', detail: '请重新安装。', retry: false }));
    assert.equal(await splash.locator('#retry').isVisible(), false);
    assert.deepEqual(errors, []);
    assert.equal(await desktop.evaluate(async () => {
      const s = globalThis.startupFixture.screen;
      const contents = s.view.webContents;
      const destroyed = new Promise(resolve => contents.once('destroyed', resolve));
      s.dispose();
      await destroyed;
      return contents.isDestroyed();
    }), true);
  } finally { await desktop.close(); await rm(data, { recursive: true, force: true }); }
});

test('desktop PNG has transparent corners and the macOS icon contains full-size artwork', async () => {
  const png = join(root, 'electron/assets/syntropic-app.png');
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 1024);
  assert.equal(metadata.hasAlpha, true);
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023]]) assert.equal(data[(y * info.width + x) * 4 + 3], 0);
  assert.equal(data[(512 * info.width + 512) * 4 + 3], 255);
  const icns = await readFile(join(root, 'electron/assets/Syntropic.icns'));
  assert.equal(icns.toString('ascii', 0, 4), 'icns');
  assert.equal(icns.readUInt32BE(4), icns.length);
  let fullSize;
  for (let offset = 8; offset < icns.length;) {
    const type = icns.toString('ascii', offset, offset + 4);
    const length = icns.readUInt32BE(offset + 4);
    assert.ok(length > 8);
    if (type === 'ic10') fullSize = icns.subarray(offset + 8, offset + length);
    offset += length;
  }
  assert.ok(fullSize, '1024px representation is included');
  assert.equal((await sharp(fullSize).metadata()).width, 1024);
});
