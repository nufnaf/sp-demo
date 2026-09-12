import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.SYNTROPIC_TEST_ELECTRON_ROOT || join(import.meta.dirname, '../../electron');
const { createSpaceThumbnailCapture } = await import(pathToFileURL(join(root, 'space-thumbnail.mjs')).href);
app.setPath('userData', process.env.SYNTROPIC_TEST_DATA);
void app.whenReady().then(() => {
const win = new BrowserWindow({ width: 1440, height: 960, show: true, webPreferences: {
  preload: join(root, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false,
} });
const capture = createSpaceThumbnailCapture(() => win, url => new URL(url).origin === new URL(process.env.SYNTROPIC_TEST_URL).origin);
globalThis.spaceFixture = { win, samples: [] };
ipcMain.handle('desktop:space-thumbnail', async event => {
  const start = performance.now();
  const image = await capture(event);
  globalThis.spaceFixture.samples.push({ ms: performance.now() - start, bytes: image?.length ?? 0 });
  return image;
});
void win.loadURL('about:blank');
app.on('window-all-closed', () => app.quit());

});
