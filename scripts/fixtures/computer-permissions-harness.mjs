import { app, BrowserWindow, desktopCapturer, ipcMain, shell, systemPreferences } from 'electron';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createComputerPermissions, registerComputerPermissions } from '../../electron/computer-permissions.mjs';
app.setPath('userData', process.argv[2]);
void app.whenReady().then(async () => {
  const server = createServer((_request, response) => response.end('<!doctype html><title>Permissions fixture</title>'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const window = new BrowserWindow({ show: false, webPreferences: {
    partition: `fixture-${crypto.randomUUID()}`,
    preload: fileURLToPath(new URL('../../electron/preload.cjs', import.meta.url)), sandbox: true, contextIsolation: true,
  } });
  const permissions = createComputerPermissions({ systemPreferences, desktopCapturer, shell });
  registerComputerPermissions(ipcMain, permissions, () => window, candidate => candidate === url);
  try {
    await window.loadURL(url);
    const status = await window.webContents.executeJavaScript('window.syntropicDesktop.getComputerPermissions()');
    assert.equal(status.supported, process.platform === 'darwin');
    assert.equal(typeof status.accessibility, 'boolean');
    assert.equal(typeof status.screenRecording, 'boolean');
    // Exercise the request bridge without triggering any OS permission prompt.
    assert.equal(await window.webContents.executeJavaScript("window.syntropicDesktop.requestComputerPermission('invalid').then(() => false, () => true)"), true);
    console.log('PERMISSIONS_BRIDGE_OK');
  } finally { window.destroy(); server.close(); app.quit(); }
}).catch(error => { console.error(error); app.exit(1); });
