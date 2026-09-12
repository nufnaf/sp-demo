import { app, BrowserWindow, ipcMain, shell, screen } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ComputerUseDriver } from './driver.mjs';

// Phase-zero host: no Next service, presentation initialization, calendar API, or installed-App replacement.
// This observation runtime is separate from the task executor, preserving the agent's AX snapshots.
const here = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(here, 'preview.html')).href;
const targetTitle = process.env.SYNTROPIC_CUA_PREVIEW_EDITOR === '1' ? '创建日程' : '飞书';
app.setName('Syntropic Computer Use');
app.setPath('userData', join(app.getPath('appData'), 'Syntropic Computer Use Development'));
let driver;
let window;
let generation = 0;
let timer;
let closing = false;

function stopPreview() {
  generation++; clearTimeout(timer);
  if (driver && !closing) void driver.unbind().catch(() => {});
}
async function publishFrame(current) {
  if (current !== generation || closing || window?.isDestroyed()) return;
  const started = performance.now();
  try {
    const frame = await driver.capture();
    if (current !== generation || closing || window?.isDestroyed()) return;
    window.webContents.send('computer-preview:frame', { dataUrl: `data:${frame.image.mimeType};base64,${frame.image.dataBase64}` });
    // Backpressure: one capture in flight, never queue obsolete images.
    timer = setTimeout(() => void publishFrame(current), Math.max(0, 200 - (performance.now() - started)));
  } catch {
    if (current === generation && !closing && !window?.isDestroyed()) {
      stopPreview();
      window.webContents.send('computer-preview:frame', { error: '画面连接已暂停，请检查飞书窗口后重新连接。' });
    }
  }
}

void app.whenReady().then(async () => {
  driver = await ComputerUseDriver.create({ liveCapture: true });
  window = new BrowserWindow({ title: '飞书 · 实时画面', width: 920, height: 660,
    minWidth: 400, minHeight: 320,
    backgroundColor: '#101319',
    webPreferences: { preload: join(here, 'preview-preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  if (process.env.SYNTROPIC_CUA_OCCLUSION_TEST === '1') {
    window.setBounds(screen.getPrimaryDisplay().workArea);
  }
  const trustedEvent = event => event.sender === window?.webContents
    && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === url;
  ipcMain.handle('computer-preview:connect', async event => {
    if (!trustedEvent(event)) return { error: '无法识别当前窗口。' };
    stopPreview();
    const current = generation;
    try {
      const permissions = driver.permissions();
      if (!permissions.accessibility || !permissions.screenRecording) return { permissions, error: '请在系统设置中允许此应用使用辅助功能和屏幕录制，然后重新打开。' };
      const candidates = (await driver.listWindows()).filter(window => window.title === targetTitle
        && window.bounds.width >= 400 && window.bounds.height >= 300 && window.minimized !== true);
      if (candidates.length !== 1) return { error: targetTitle === '飞书' ? '请打开一个飞书主窗口，并保持窗口展开。' : '请打开一个日程编辑窗口，并保持窗口展开。' };
      await driver.bind(candidates[0].windowId);
      if (current !== generation || closing) return { error: '连接已取消。' };
      timer = setTimeout(() => void publishFrame(current), 0);
      return { connected: true };
    } catch { return { error: '暂时无法连接飞书，请检查客户端后重试。' }; }
  });
  ipcMain.handle('computer-preview:disconnect', event => { if (trustedEvent(event)) stopPreview(); });
  ipcMain.handle('computer-preview:settings', async event => {
    if (trustedEvent(event)) await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-redirect', event => event.preventDefault());
  window.webContents.on('did-start-loading', stopPreview);
  window.on('closed', stopPreview);
  await window.loadURL(url);
}).catch(() => { console.error('实时预览初始化失败。请检查原生组件安装及当前平台。'); app.quit(); });

app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (closing || !driver) return;
  event.preventDefault();
  closing = true;
  stopPreview();
  void driver.close().finally(() => app.quit());
});
