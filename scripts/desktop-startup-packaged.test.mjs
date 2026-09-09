import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import test from 'node:test';
import { _electron as electron } from 'playwright-core';
import { preparePackagedRuntime } from '../electron/packaged-runtime.mjs';
import { createPresentationRun } from '../electron/presentation.mjs';
import { LocalService } from '../electron/service.mjs';

const appPath = process.env.SYNTROPIC_TEST_APP;
test('packaged workbench hydration dismisses the native splash on first load and reload', { skip: !appPath, timeout: 90000 }, async () => {
  const data = await mkdtemp(join(tmpdir(), 'syntropic-packaged-splash-'));
  let service;
  let desktop;
  try {
    const resources = join(resolve(appPath), 'Contents/Resources');
    const manifest = JSON.parse(await readFile(join(resources, 'desktop-runtime.json'), 'utf8'));
    const runtime = await preparePackagedRuntime(resources, data, manifest.buildId);
    const presentation = await createPresentationRun(data);
    const reservation = createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    const origin = `http://127.0.0.1:${port}`;
    const env = { ...process.env, SYNTROPIC_PRESENTATION_ROOT: presentation.root, SYNTROPIC_PRESENTATION_ID: presentation.id, PI_CODING_AGENT_DIR: join(data, 'pi'), SYNTROPIC_RECRUITING_URL: manifest.recruitingUrl };
    delete env.ELECTRON_RUN_AS_NODE;
    service = new LocalService({ root: runtime, origin, production: true, timeout: 30000, env, command: [join(resources, 'node/bin/node'), '--preserve-symlinks-main', join(runtime, 'server.js')] });
    await service.start();
    desktop = await electron.launch({
      args: [join(import.meta.dirname, 'fixtures/startup-harness.mjs')], timeout: 15000,
      env: { ...env, SYNTROPIC_TEST_DATA: join(data, 'browser'), SYNTROPIC_TEST_WORKBENCH_URL: origin, SYNTROPIC_TEST_ELECTRON_ROOT: join(resources, 'app/electron') },
    });
    await desktop.firstWindow();
    await desktop.evaluate(async () => { await globalThis.startupFixture.loaded; });
    // Real compiled React, CSS, fonts and wallpaper; API fixtures prevent model
    // calls, browser prewarming and reads/writes of personal or recruiting data.
    await desktop.context().route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/events')) return route.fulfill({ contentType: 'text/event-stream', body: ': fixture\n\n' });
      const body = { sessions: [], workspaces: [], packages: [], tasks: [], pages: [], results: [], items: [], models: [], installations: [] };
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    const splash = desktop.context().pages().find(page => page.url().endsWith('/status.html'));
    assert.ok(splash);
    const errors = [];
    desktop.context().on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await desktop.evaluate(async (_electron, url) => { await globalThis.startupFixture.win.loadURL(url); }, origin);
    const main = desktop.context().pages().find(page => page.url().startsWith(origin));
    assert.ok(main);
    main.on('pageerror', error => errors.push(error.message));
    await main.locator('.agent-os-wallpaper').waitFor({ state: 'attached' });
    await main.getByRole('textbox', { name: '和 Syntropic 对话' }).waitFor();
    await splash.waitForFunction(() => document.getElementById('splash').dataset.phase === 'revealing', null, { timeout: 15000 });
    await desktop.evaluate(() => new Promise(resolve => setTimeout(resolve, 800)));
    assert.equal(await desktop.evaluate(() => globalThis.startupFixture.screen.state.phase), 'hidden');
    const output = join(import.meta.dirname, '../build/startup-validation');
    await mkdir(output, { recursive: true });
    await main.screenshot({ path: join(output, 'packaged-workbench.png') });
    await main.getByRole('textbox', { name: '和 Syntropic 对话' }).fill('启动交接验证，不发送');
    await main.reload();
    await main.getByRole('textbox', { name: '和 Syntropic 对话' }).waitFor();
    await splash.waitForFunction(() => document.getElementById('splash').dataset.phase === 'revealing', null, { timeout: 15000 });
    await desktop.evaluate(() => new Promise(resolve => setTimeout(resolve, 800)));
    assert.equal(await desktop.evaluate(() => globalThis.startupFixture.screen.state.phase), 'hidden');
    assert.deepEqual(errors, []);
  } finally {
    if (desktop) await desktop.close();
    if (service) await service.stop();
    await rm(data, { recursive: true, force: true });
  }
});
