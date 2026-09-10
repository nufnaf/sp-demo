import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import { fork } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPresentationRun } from './presentation.mjs';
import { prepareDemoModelEnvironment } from './demo-model.mjs';
import { preparePackagedRuntime, removeOldPackagedRuntimes } from './packaged-runtime.mjs';
import { StartupScreen, STARTUP_STATE } from './startup-screen.mjs';
import { APP_ORIGIN, isAppUrl, isExternalUrl } from './policy.mjs';
import { createAppLocationGuard } from './app-location.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packaged = existsSync(join(process.resourcesPath, 'desktop-runtime.json'));
const appIcon = join(here, 'assets/syntropic-app.png');
app.setName(packaged ? 'Syntropic' : 'Syntropic Dev');
// Renderer preferences. Preconfigured packages give Pi a separate per-run directory.
app.setPath('userData', join(app.getPath('appData'), packaged ? 'Syntropic' : 'Syntropic Dev'));
let window = null;
let startup = null;
let supervisor = null;
let presentation = null;
let quitting = false;
let ready = false;
let packagedBuildId;
let status = STARTUP_STATE;
let supervisorStopped = Promise.resolve();
const locationAvailable = createAppLocationGuard(packaged ? process.resourcesPath : undefined, () => {
  dialog.showErrorBox('应用位置已变化', 'Syntropic 在运行时被移动，旧进程需要退出。请从新位置重新打开 Syntropic。以后移动或替换 App 前，请先按 ⌘Q 完全退出，并等待复制完成后再打开。');
  app.quit();
});

function showStatus(next) {
  status = next;
  startup?.show(status);
}
function loadWorkbench() {
  if (!window || window.isDestroyed()) return;
  status = STARTUP_STATE;
  void window.loadURL(APP_ORIGIN).catch(() => {});
}
function focusWindow() {
  if (quitting || !locationAvailable()) return;
  if (!window) createWindow();
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
async function openExternal(url) {
  if (!isExternalUrl(url)) return;
  try { await shell.openExternal(url); }
  catch { await dialog.showMessageBox({ type: 'error', message: '无法打开系统浏览器', detail: '请检查系统默认浏览器，然后重新点击登录链接。' }); }
}
function createWindow() {
  if (quitting || !locationAvailable()) return;
  window = new BrowserWindow({
    title: 'Syntropic', width: 1440, height: 960, minWidth: 960, minHeight: 640,
    backgroundColor: '#273878', icon: appIcon, show: false,
    webPreferences: {
      partition: presentation ? `syntropic-presentation-${presentation.id}` : undefined,
      preload: join(here, 'preload.cjs'), nodeIntegration: false,
      contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false,
    },
  });
  const currentWindow = window;
  startup = new StartupScreen(currentWindow, {
    onTimeout: () => showStatus({ phase: 'error', reason: 'workbench-timeout', title: '工作空间加载时间较长', detail: '暂时未能完成页面加载，请重新尝试。', retry: true }),
  });
  const currentStartup = startup;
  void currentStartup.loaded.then(() => {
    if (!currentWindow.isDestroyed()) currentWindow.show();
  }).catch(() => {
    if (!currentWindow.isDestroyed()) void dialog.showMessageBox(currentWindow, { type: 'error', message: '启动画面加载失败', detail: '请重新打开应用；如果仍然失败，请重新安装完整 App。' });
  });
  const contents = window.webContents;
  contents.on('did-start-navigation', details => {
    if (details.isMainFrame && !details.isSameDocument && isAppUrl(details.url) && ready) currentStartup.waitForWorkbench();
  });
  contents.setWindowOpenHandler(({ url }) => { void openExternal(url); return { action: 'deny' }; });
  const guard = (event, url) => {
    if (isAppUrl(url) && new URL(url).pathname === '/') return;
    event.preventDefault();
    // Redirects must never silently open external applications.
  };
  contents.on('will-navigate', (event, url) => {
    guard(event, url);
    if (event.defaultPrevented) void openExternal(url);
  });
  contents.on('will-redirect', guard);
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.on('render-process-gone', () => {
    void showStatus({ phase: 'error', title: '工作台页面已停止', detail: '点击重试重新连接本机后台。', retry: true });
  });
  contents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isAppUrl(url)) {
      void showStatus({ phase: 'error', title: '工作台加载失败', detail: '本机页面暂时无法加载。请重试；如果仍然失败，请退出并重新打开应用。', retry: true });
    }
  });
  window.on('closed', () => { currentStartup.dispose(); startup = null; window = null; });
  if (ready) loadWorkbench();
  else void showStatus(status);
}
async function startSupervisor() {
  let node = process.env.SYNTROPIC_NODE;
  let root = join(here, '..');
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: undefined };
  delete env.SYNTROPIC_DEMO_OPENROUTER;
  if (packaged) {
    try {
      const manifest = JSON.parse(await readFile(join(process.resourcesPath, 'desktop-runtime.json'), 'utf8'));
      if (manifest.demoAuth === 'openrouter') {
        try {
          Object.assign(env, await prepareDemoModelEnvironment({
            configPath: join(process.resourcesPath, 'openrouter-demo.json'),
            presentationRoot: presentation.root,
          }));
          // The bundled credential is authoritative; ignore inherited provider credentials.
          delete env.OPENROUTER_API_KEY;
        } catch {
          await showStatus({ phase: 'error', title: '演示模型配置不可用', detail: '安装包缺少有效的 OpenRouter 配置，请联系提供者重新打包。无需登录 ChatGPT。', retry: false });
          return;
        }
      }
      packagedBuildId = manifest.buildId;
      root = await preparePackagedRuntime(process.resourcesPath, app.getPath('userData'), manifest.buildId);
      node = join(process.resourcesPath, 'node/bin/node');
      Object.assign(env, {
        SYNTROPIC_PACKAGED: '1',
        SYNTROPIC_APP_ROOT: root,
        SYNTROPIC_FEISHU_CONFIG: join(process.resourcesPath, 'feishu-demo.json'),
        SYNTROPIC_RECRUITING_URL: env.SYNTROPIC_RECRUITING_URL?.trim() || manifest.recruitingUrl || 'http://127.0.0.1:30143/',
        PI_WEB_BROWSER_EXECUTABLE: join(process.resourcesPath, manifest.browserExecutable),
        PI_WEB_BROWSER_HEADLESS: 'true',
        PATH: `${join(process.resourcesPath, 'node/bin')}:/usr/bin:/bin:/usr/sbin:/sbin`,
      });
    } catch {
      await showStatus({ phase: 'error', title: '应用运行文件准备失败', detail: '请确认磁盘空间充足，或重新复制完整的 Syntropic.app 后启动。', retry: false });
      return;
    }
  }
  if (presentation) Object.assign(env, { SYNTROPIC_PRESENTATION_ROOT: presentation.root, SYNTROPIC_PRESENTATION_ID: presentation.id, RECRUITING_PRESENTATION: '1', RECRUITING_DATA_FILE: join(presentation.root, 'recruiting/state.json'), SYNTROPIC_FEISHU_CONFIG: packaged ? join(process.resourcesPath, 'feishu-demo.json') : join(root, '.env.feishu-demo.json') });
  if (quitting) return;
  if (!node) {
    void showStatus({ phase: 'error', title: '缺少本机 Node 启动器', detail: '请从项目目录运行 npm run desktop。', retry: false });
    return;
  }
  supervisor = fork(join(here, 'supervisor.mjs'), [], {
    execPath: node, execArgv: [], cwd: root, env,
    // Keep the cleanup supervisor alive when the Electron process group dies.
    // IPC disconnect still requests shutdown of only this run's services.
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  supervisorStopped = new Promise((resolve) => {
    supervisor.once('exit', resolve);
    supervisor.once('error', resolve);
  });
  supervisor.on('message', (message) => {
    if (quitting) return;
    if (message.type === 'ready') {
      ready = true;
      if (packagedBuildId) void removeOldPackagedRuntimes(app.getPath('userData'), packagedBuildId)
        .catch(() => console.warn('[desktop] 旧运行文件清理未完成，下次启动将重试。'));
      console.info(`[desktop] 后台已就绪（${message.owned ? '由 App 管理' : '复用外部服务'}）。`);
      loadWorkbench();
    } else if (message.type === 'status') {
      ready = false;
      void showStatus(message.status);
    }
  });
  const failed = () => {
    if (!quitting) {
      ready = false;
      void showStatus({ phase: 'error', title: '后台管理进程已停止', detail: '请退出并重新打开应用。', retry: false });
    }
  };
  supervisor.on('error', failed);
  supervisor.on('exit', failed);
  if (supervisor.connected) supervisor.send({ type: 'start' });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusWindow);
  app.on('activate', () => { if (app.isReady() && !quitting) focusWindow(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', (event) => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    if (supervisor?.connected) supervisor.send({ type: 'stop' });
    // The Node supervisor survives an Electron crash and cleans up on IPC disconnect.
    void supervisorStopped.finally(() => app.quit());
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.quit());
  // npm launcher died: don't leave a hidden desktop and backend running.
  process.on('disconnect', () => app.quit());
  void app.whenReady().then(async () => {
    if (process.platform === 'darwin') app.dock.setIcon(appIcon);
    presentation = await createPresentationRun(app.getPath('userData'));
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ label: 'Syntropic', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
      { role: 'fileMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
    ]));
    session.fromPartition(`syntropic-presentation-${presentation.id}`).setPermissionRequestHandler(async (contents, permission, callback, details) => {
      // Recruiting suggestions and insights live inside the workbench only.
      if (permission === 'notifications') { callback(false); return; }
      if (!contents || !isAppUrl(contents.getURL()) || !isAppUrl(details.requestingUrl)
          || !['media', 'clipboard-sanitized-write', 'fullscreen'].includes(permission)) {
        callback(false); return;
      }
      if (['clipboard-sanitized-write', 'fullscreen'].includes(permission)) { callback(true); return; }
      const result = await dialog.showMessageBox({
        type: 'question', buttons: ['不允许', '允许'], defaultId: 0, cancelId: 0,
        message: '允许 Syntropic 使用麦克风或摄像头？',
      });
      callback(result.response === 1);
    });
    ipcMain.on('desktop:workbench-ready', event => {
      if (!ready || event.sender !== window?.webContents
        || event.senderFrame !== window?.webContents.mainFrame
        || !isAppUrl(event.senderFrame.url) || new URL(event.senderFrame.url).pathname !== '/') return;
      startup?.reveal();
    });
    ipcMain.handle('desktop:retry', event => {
      if (!startup?.accepts(event) || startup.state.phase !== 'error' || !startup.state.retry) return;
      showStatus(STARTUP_STATE);
      // Page errors can reconnect to a healthy service without restarting it.
      if (ready) loadWorkbench();
      else if (supervisor?.connected) supervisor.send({ type: 'start' });
    });
    createWindow();
    void startSupervisor();
  });
}
