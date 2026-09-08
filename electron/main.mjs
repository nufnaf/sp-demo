import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import { fork } from 'node:child_process';
import { cp, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { APP_ORIGIN, isAppUrl, isExternalUrl } from './policy.mjs';
import { preparePresentation, clearPresentation } from './presentation.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packaged = existsSync(join(process.resourcesPath, 'desktop-runtime.json'));
const recoveryUrl = pathToFileURL(join(here, 'status.html'));
app.setName(packaged ? 'Syntropic' : 'Syntropic Dev');
// Renderer preferences only. Pi keeps its own existing ~/.pi/agent directory.
app.setPath('userData', join(app.getPath('appData'), packaged ? 'Syntropic' : 'Syntropic Dev'));
let window = null;
let supervisor = null;
let quitting = false;
let ready = false;
let status = { title: '正在启动本机后台…', detail: '正在准备工作空间，请稍候。服务就绪后将自动打开工作台。' };
let supervisorStopped = Promise.resolve();
let presentation;

async function showStatus(next) {
  status = next;
  if (window && !window.isDestroyed()) {
    await window.loadFile(join(here, 'status.html'), { query: {
      title: status.title, detail: status.detail, retry: String(Boolean(status.retry)),
    } }).catch(() => {});
  }
}
function focusWindow() {
  if (!window) createWindow();
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
  window = new BrowserWindow({
    title: 'Syntropic', width: 1440, height: 960, minWidth: 960, minHeight: 640,
    backgroundColor: '#151719',
    webPreferences: {
      preload: join(here, 'preload.cjs'), nodeIntegration: false,
      contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false,
    },
  });
  const contents = window.webContents;
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
    ready = false;
    void showStatus({ title: '工作台页面已停止', detail: '点击重试重新连接本机后台。', retry: true });
  });
  contents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isAppUrl(url)) {
      ready = false;
      void showStatus({ title: '工作台加载失败', detail: '本机页面暂时无法加载。请重试；如果仍然失败，请退出并重新打开应用。', retry: true });
    }
  });
  window.on('closed', () => { window = null; });
  if (ready) void window.loadURL(APP_ORIGIN).catch(() => {});
  else void showStatus(status);
}
async function startSupervisor() {
  let node = process.env.SYNTROPIC_NODE;
  let root = join(here, '..');
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: undefined };
  if (packaged) {
    try {
      const manifest = JSON.parse(await readFile(join(process.resourcesPath, 'desktop-runtime.json'), 'utf8'));
      root = join(app.getPath('userData'), 'runtimes', manifest.buildId);
      // Runtime caches are writable and upgrades never replace recruitment/Pi data.
      if (!existsSync(join(root, 'package.json'))) {
        const pending = `${root}.pending`;
        await mkdir(dirname(root), { recursive: true });
        await rm(pending, { recursive: true, force: true });
        await cp(join(process.resourcesPath, 'runtime'), pending, { recursive: true, verbatimSymlinks: true });
        await rename(pending, root);
      }
      node = join(process.resourcesPath, 'node/bin/node');
      Object.assign(env, {
        SYNTROPIC_PACKAGED: '1',
        SYNTROPIC_APP_ROOT: root,
        RECRUITING_DATA_FILE: join(app.getPath('userData'), 'recruiting/state.json'),
        SYNTROPIC_RECRUITING_URL: 'http://127.0.0.1:30143/',
        PI_WEB_BROWSER_EXECUTABLE: join(process.resourcesPath, manifest.browserExecutable),
        PATH: `${join(process.resourcesPath, 'node/bin')}:/usr/bin:/bin:/usr/sbin:/sbin`,
      });
    } catch {
      await showStatus({ title: '应用运行文件准备失败', detail: '请确认磁盘空间充足，或重新复制完整的 Syntropic.app 后启动。', retry: false });
      return;
    }
  }
  if (quitting) return;
  if (!node) {
    void showStatus({ title: '缺少本机 Node 启动器', detail: '请从项目目录运行 npm run desktop。', retry: false });
    return;
  }
  try {
    presentation ??= await preparePresentation(app.getPath('userData'));
    Object.assign(env, {
      SYNTROPIC_PRESENTATION_ROOT: presentation.root,
      SYNTROPIC_PRESENTATION_RUN: presentation.runId,
      RECRUITING_DATA_FILE: join(presentation.root, 'recruiting.json'),
    });
  } catch {
    await showStatus({ title: '无法准备招聘工作台', detail: '演示目录无法安全恢复，现有数据未被覆盖。', retry: false });
    return;
  }
  supervisor = fork(join(here, 'supervisor.mjs'), [], {
    execPath: node, execArgv: [], cwd: root, env,
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
      console.info(`[desktop] 后台已就绪（${message.owned ? '由 App 管理' : '复用外部服务'}）。`);
      if (window) void window.loadURL(APP_ORIGIN).catch(() => {});
    } else if (message.type === 'status') {
      ready = false;
      void showStatus(message.status);
    }
  });
  const failed = () => {
    if (!quitting) {
      ready = false;
      void showStatus({ title: '后台管理进程已停止', detail: '请退出并重新打开应用。', retry: false });
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
    void supervisorStopped.then(async () => {
      if (presentation) await clearPresentation(app.getPath('userData'));
    }).catch(() => { /* A failed cleanup is retried before the next startup. */ }).finally(() => app.quit());
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.quit());
  // npm launcher died: don't leave a hidden desktop and backend running.
  process.on('disconnect', () => app.quit());
  void app.whenReady().then(() => {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ label: 'Syntropic', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
      { role: 'fileMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
    ]));
    session.defaultSession.setPermissionRequestHandler(async (contents, permission, callback, details) => {
      if (!contents || !isAppUrl(contents.getURL()) || !isAppUrl(details.requestingUrl)
          || !['media', 'notifications', 'clipboard-sanitized-write', 'fullscreen'].includes(permission)) {
        callback(false); return;
      }
      if (['clipboard-sanitized-write', 'fullscreen'].includes(permission)) { callback(true); return; }
      const result = await dialog.showMessageBox({
        type: 'question', buttons: ['不允许', '允许'], defaultId: 0, cancelId: 0,
        message: permission === 'media' ? '允许 Syntropic 使用麦克风或摄像头？' : '允许 Syntropic 显示通知？',
      });
      callback(result.response === 1);
    });
    ipcMain.handle('desktop:retry', (event) => {
      if (event.sender !== window?.webContents || event.senderFrame !== window?.webContents.mainFrame
        || !event.senderFrame.url.startsWith(`${recoveryUrl.href}?`)) return;
      if (supervisor?.connected) supervisor.send({ type: 'start' });
    });
    createWindow();
    void startSupervisor();
  });
}
