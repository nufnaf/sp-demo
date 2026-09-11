import { app, BrowserWindow, ipcMain } from 'electron';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createUiPreferencesStore, registerUiPreferences } from '../../electron/ui-preferences.mjs';
const [directory, action] = process.argv.slice(2);
app.setPath('userData', directory);
void app.whenReady().then(async () => {
  const server = createServer((_request, response) => response.end('<!doctype html><title>Preferences fixture</title>'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const window = new BrowserWindow({ show: false, webPreferences: { partition: `fixture-${crypto.randomUUID()}`, preload: fileURLToPath(new URL('../../electron/preload.cjs', import.meta.url)), sandbox: true, contextIsolation: true } });
  registerUiPreferences(ipcMain, createUiPreferencesStore(directory), () => window, candidate => candidate === url);
  try {
    await window.loadURL(url);
    const expected = { desktopSpacesEnabled: true, previewWidthScale: 1.75 };
    if (action === 'write') await window.webContents.executeJavaScript(`window.syntropicDesktop.setUiPreferences(${JSON.stringify(expected)})`);
    assert.deepEqual(await window.webContents.executeJavaScript('window.syntropicDesktop.getUiPreferences()'), expected);
    console.log('PREFERENCES_OK');
  } finally { window.destroy(); server.close(); app.quit(); }
}).catch(error => { console.error(error); app.exit(1); });
