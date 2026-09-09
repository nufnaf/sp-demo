import { app, BrowserWindow, ipcMain } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';


const here = dirname(fileURLToPath(import.meta.url));
const electronRoot = process.env.SYNTROPIC_TEST_ELECTRON_ROOT || join(here, '../../electron');
const { StartupScreen, STARTUP_STATE } = await import(pathToFileURL(join(electronRoot, 'startup-screen.mjs')).href);
app.setPath('userData', process.env.SYNTROPIC_TEST_DATA);
void app.whenReady().then(async () => {
const win = new BrowserWindow({ width: 1000, height: 740, show: false, backgroundColor: '#273878', webPreferences: {
  preload: join(electronRoot, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false,
} });
const screen = new StartupScreen(win, { timeoutMs: process.env.SYNTROPIC_TEST_WORKBENCH_URL ? 45000 : 800, onTimeout: () => screen.show({ phase: 'error', title: '工作空间加载时间较长', detail: '请重新尝试。', retry: true }) });
globalThis.startupFixture = { win, screen, retries: 0 };
win.webContents.on('did-start-navigation', details => {
  if (details.isMainFrame && !details.isSameDocument && process.env.SYNTROPIC_TEST_WORKBENCH_URL) screen.waitForWorkbench();
});
ipcMain.on('desktop:workbench-ready', event => {
  if (event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame) screen.reveal();
});
ipcMain.handle('desktop:retry', event => {
  if (!screen.accepts(event) || screen.state.phase !== 'error' || !screen.state.retry) return;
  globalThis.startupFixture.retries++;
  screen.show(STARTUP_STATE);
});
win.on('closed', () => screen.dispose());
globalThis.startupFixture.loaded = (async () => {
await screen.loaded;
if (!process.env.SYNTROPIC_TEST_WORKBENCH_URL) await win.loadURL('data:text/html,<html style="background:%23293c88"><body style="color:white;font:24px system-ui"><h1>工作空间已就绪</h1><button id="action">可以使用</button></body></html>');
win.show();
})();
app.on('window-all-closed', () => app.quit());

});
