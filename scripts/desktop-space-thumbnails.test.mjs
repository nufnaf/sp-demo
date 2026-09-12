import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { _electron as electron } from 'playwright-core';

const url = process.env.SYNTROPIC_TEST_URL;
test('native desktop thumbnails show real content, cache per Space and never capture the overview', { skip: !url, timeout: 60000 }, async () => {
  const data = await mkdtemp(join(tmpdir(), 'syntropic-spaces-'));
  const output = join(import.meta.dirname, '../build/verification/space-thumbnails');
  await mkdir(output, { recursive: true });
  const env = { ...process.env, SYNTROPIC_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const desktop = await electron.launch({ args: [join(import.meta.dirname, 'fixtures/space-thumbnail-harness.mjs')], env });
  try {
    const page = await desktop.firstWindow();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => route.fulfill({ json: { sessions: [], workspaces: [], packages: [], tasks: [], pages: [], results: [], items: [], models: [], installations: [] } }));
    await page.goto(url);
    await page.getByRole('textbox', { name: '和 Syntropic 对话', exact: true }).waitFor();
    // Content appears in the native capture without a second app/iframe mount.
    await page.getByRole('button', { name: '打开 浏览器', exact: true }).click();
    await page.waitForTimeout(1800);
    const open = () => page.getByRole('button', { name: '桌面总览', exact: true }).click();
    const thumb = name => page.getByRole('button', { name: `切换到${name}`, exact: true }).locator('img');
    await open();
    await thumb('桌面 1').waitFor();
    assert.equal(await thumb('桌面 1').evaluate(img => img.naturalWidth), 480);
    const first = await thumb('桌面 1').getAttribute('src');
    const count = await desktop.evaluate(() => globalThis.spaceFixture.samples.length);
    await page.waitForTimeout(1600);
    assert.equal(await desktop.evaluate(() => globalThis.spaceFixture.samples.length), count, 'overview pauses capture');
    assert.equal(await thumb('桌面 1').getAttribute('src'), first);
    await page.getByRole('button', { name: '新建桌面', exact: true }).click();
    await page.waitForTimeout(1800);
    await open();
    const second = await thumb('桌面 2').getAttribute('src');
    assert.ok(second && second !== first, 'different desktops retain different native frames');
    assert.equal(await thumb('桌面 1').getAttribute('src'), first, 'inactive desktop retains its frame');
    const tile = await page.locator('.spaces-tile').first().boundingBox();
    const add = await page.locator('.spaces-add').boundingBox();
    assert.equal(tile.width, add.width); assert.equal(tile.height, add.height);
    const closeGeometry = await page.locator('.spaces-remove').first().evaluate(el => {
      const b = el.getBoundingClientRect(), s = el.querySelector('svg').getBoundingClientRect();
      const clip = el.closest('.spaces-strip').getBoundingClientRect();
      return { dx: s.x + s.width / 2 - b.x - b.width / 2, dy: s.y + s.height / 2 - b.y - b.height / 2, complete: b.y >= clip.y && b.bottom <= clip.bottom };
    });
    assert.equal(closeGeometry.dx, 0); assert.equal(closeGeometry.dy, 0); assert.ok(closeGeometry.complete);
    await page.locator('.spaces-overview').screenshot({ path: join(output, 'overview-native.png') });
    await page.getByRole('button', { name: '切换到桌面 1', exact: true }).click();
    await page.waitForTimeout(800);
    await page.locator('[data-window-id="browser"]').waitFor({ state: 'visible' });
    for (let i = 0; i < 4; i++) {
      await open(); await page.getByRole('button', { name: '新建桌面', exact: true }).click();
    }
    await open();
    assert.equal(await page.locator('.spaces-tile').count(), 6);
    await page.setViewportSize({ width: 960, height: 640 });
    await page.locator('.spaces-strip').evaluate(el => { el.scrollLeft = 0; });
    assert.ok(await page.getByRole('button', { name: '切换到桌面 1', exact: true }).isVisible());
    await page.getByRole('button', { name: '关闭桌面 6', exact: true }).click();
    assert.equal(await page.locator('.spaces-tile').count(), 5);
    assert.equal(await page.locator('.spaces-add').textContent(), '＋新建桌面');
    const samples = await desktop.evaluate(() => globalThis.spaceFixture.samples);
    await writeFile(join(output, 'native-capture.json'), JSON.stringify({ samples, errors }, null, 2));
    assert.deepEqual(errors, []);
  } finally { await desktop.close(); await rm(data, { recursive: true, force: true }); }
});
