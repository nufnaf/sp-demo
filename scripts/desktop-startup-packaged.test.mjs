import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { _electron as electron } from 'playwright-core';
import { preparePackagedRuntime } from '../electron/packaged-runtime.mjs';
import { createPresentationRun } from '../electron/presentation.mjs';
import { LocalService } from '../electron/service.mjs';

const appPath = process.env.SYNTROPIC_TEST_APP;
test('packaged preparation gate uses bundled CLI and native permission bridge on first load and reload', { skip: !appPath, timeout: 90000 }, async () => {
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
    const env = { ...process.env, SYNTROPIC_PRESENTATION_ROOT: presentation.root, SYNTROPIC_PRESENTATION_ID: presentation.id, PI_CODING_AGENT_DIR: join(data, 'pi'), SYNTROPIC_RECRUITING_URL: manifest.recruitingUrl, SYNTROPIC_FEISHU_HOME: join(data, 'feishu'), SYNTROPIC_FEISHU_CLI: join(resources, 'helpers/lark-cli') };
    delete env.ELECTRON_RUN_AS_NODE;
    service = new LocalService({ root: runtime, origin, production: true, timeout: 30000, env, command: [join(resources, 'node/bin/node'), '--preserve-symlinks-main', join(runtime, 'server.js')] });
    await service.start();
    desktop = await electron.launch({
      args: [join(import.meta.dirname, 'fixtures/startup-harness.mjs')], timeout: 15000,
      env: { ...env, SYNTROPIC_TEST_DATA: join(data, 'browser'), SYNTROPIC_TEST_WORKBENCH_URL: origin, SYNTROPIC_TEST_ELECTRON_ROOT: join(resources, 'app/electron') },
    });
    await desktop.firstWindow();
    await desktop.evaluate(async () => { await globalThis.startupFixture.loaded; });
    // Read the actual bundled CLI's empty isolated config and native OS permissions.
    // Other APIs are fixtures; no authorization, model call or cloud write occurs.
    await desktop.context().route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/apps/feishu' && route.request().method() === 'GET') return route.continue();
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
    await main.getByRole('button', { name: '连接飞书', exact: true }).waitFor();
    assert.equal(await main.getByRole('button', { name: '连接飞书', exact: true }).isEnabled(), true);
    const connection = await main.evaluate(async () => (await fetch('/api/apps/feishu')).json());
    assert.equal(connection.installed, true);
    assert.equal(connection.configured, false);
    assert.equal(connection.authState, 'not_authenticated');
    const permissions = await main.evaluate(() => window.syntropicDesktop.getComputerPermissions());
    assert.equal(permissions.supported, true);
    assert.equal(await main.getByText('浏览器预览不支持跳转系统设置', { exact: false }).count(), 0);
    assert.equal(await main.locator('.agent-os-desktop').count(), 0);
    await splash.waitForFunction(() => document.getElementById('splash').dataset.phase === 'revealing', null, { timeout: 15000 });
    await desktop.evaluate(() => new Promise(resolve => setTimeout(resolve, 800)));
    assert.equal(await desktop.evaluate(() => globalThis.startupFixture.screen.state.phase), 'hidden');
    const output = join(import.meta.dirname, '../build/startup-validation');
    await mkdir(output, { recursive: true });
    await main.screenshot({ path: join(output, 'packaged-preparation.png') });
    await main.getByRole('heading', { name: '屏幕录制权限' }).scrollIntoViewIfNeeded();
    await main.screenshot({ path: join(output, 'packaged-preparation-permissions.png') });
    await main.reload();
    await main.getByRole('button', { name: '连接飞书', exact: true }).waitFor();
    await splash.waitForFunction(() => document.getElementById('splash').dataset.phase === 'revealing', null, { timeout: 15000 });
    await desktop.evaluate(() => new Promise(resolve => setTimeout(resolve, 800)));
    assert.equal(await desktop.evaluate(() => globalThis.startupFixture.screen.state.phase), 'hidden');
    assert.deepEqual(errors, []);
    // Exercise the real renderer + native splash transition with isolated
    // permission/API fixtures. No OS grants or the user's Feishu data change.
    await desktop.evaluate(({ ipcMain }) => {
      const permissions = { supported: true, accessibility: true, screenRecording: true, captureVerified: false, initializationComplete: false };
      for (const name of ['desktop:computer-permissions:get', 'desktop:computer-permissions:request', 'desktop:startup:complete']) ipcMain.removeHandler(name);
      ipcMain.handle('desktop:computer-permissions:get', () => permissions);
      ipcMain.handle('desktop:computer-permissions:request', () => { permissions.captureVerified = true; return permissions; });
      ipcMain.handle('desktop:startup:complete', (_event, value) => { permissions.initializationComplete = value; return permissions; });
    });
    await main.route('**/api/apps/feishu', route => route.fulfill({ json: { installed: true, configured: true, authState: 'authenticated', account: 'Startup test' } }));
    let finishPreparation, preparationStarted;
    let prepCount = 0;
    const waitForPreparation = () => new Promise(resolve => { preparationStarted = resolve; });
    await main.route('**/api/desktop/prepare', async route => {
      prepCount++;
      const outcome = await new Promise(resolve => { finishPreparation = resolve; preparationStarted(); });
      await route.fulfill(outcome);
    });
    const covered = async () => {
      await splash.waitForFunction(() => document.querySelector('#splash').dataset.phase === 'starting' && getComputedStyle(document.querySelector('#splash')).opacity === '1');
      assert.equal(await desktop.evaluate(() => globalThis.startupFixture.screen.view.getVisible()), true);
      await new Promise(resolve => setTimeout(resolve, 1200));
      assert.equal(await desktop.evaluate(() => globalThis.startupFixture.screen.state.phase), 'starting', 'no stale setup-ready callback dismisses the splash');
    };
    const uncovered = () => main.waitForFunction(async () => {
      // The renderer is painted before the native overlay fades out.
      return !!document.querySelector('.feishu-startup-card, .agent-os-desktop');
    });
    await main.reload();
    await main.getByRole('button', { name: '验证屏幕访问', exact: true }).waitFor();
    await splash.waitForFunction(() => document.querySelector('#splash').dataset.phase === 'revealing');
    await new Promise(resolve => setTimeout(resolve, 800));
    let started = waitForPreparation();
    await main.getByRole('button', { name: '验证屏幕访问', exact: true }).click();
    await started;
    await covered();
    await splash.screenshot({ path: join(output, 'packaged-after-capture-splash.png') });
    finishPreparation({ status: 503, json: { error: '同步暂时失败，请重试。' } });
    await main.getByRole('alert').filter({ hasText: '同步暂时失败' }).waitFor();
    await uncovered();
    await new Promise(resolve => setTimeout(resolve, 800));
    assert.equal(await desktop.evaluate(() => globalThis.startupFixture.screen.view.getVisible()), false, 'failure reveals the retry page');
    started = waitForPreparation();
    await main.getByRole('button', { name: '重新准备', exact: true }).click();
    await started;
    await covered();
    finishPreparation({ json: { ready: true } });
    await main.locator('.agent-os-desktop').waitFor();
    await new Promise(resolve => setTimeout(resolve, 800));
    assert.equal(await desktop.evaluate(() => globalThis.startupFixture.screen.view.getVisible()), false);
    started = waitForPreparation();
    await main.reload();
    await started;
    await covered();
    assert.equal(await main.getByRole('heading', { name: '演示前的一次性准备' }).count(), 0, 'completed startup skips setup');
    finishPreparation({ json: { ready: true } });
    await main.locator('.agent-os-desktop').waitFor();
    await new Promise(resolve => setTimeout(resolve, 800));
    assert.equal(await desktop.evaluate(() => globalThis.startupFixture.screen.view.getVisible()), false);
    assert.equal(prepCount, 3);
    assert.deepEqual(errors, []);
    if (process.env.SYNTROPIC_TEST_BROWSER_FLOWS === '1') {
      const browserEnv = { ...process.env, FEISHU_PREVIEW_ORIGIN: origin };
      delete browserEnv.NODE_TEST_CONTEXT;
      const result = await promisify(execFile)(process.execPath, ['--test', '--test-reporter=spec', join(import.meta.dirname, 'feishu-startup.test.mjs')], {
        env: browserEnv, timeout: 65000,
      });
      assert.match(result.stdout, /tests 3/);
      assert.match(result.stdout, /pass 3/);
      console.log(result.stdout);
    }
  } finally {
    if (desktop) await desktop.close();
    if (service) await service.stop();
    await rm(data, { recursive: true, force: true });
  }
});
