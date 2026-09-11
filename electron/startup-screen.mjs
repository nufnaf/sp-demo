import { WebContentsView, ipcMain } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(join(here, 'status.html')).href;
export const STARTUP_STATE = { phase: 'starting', title: '', detail: '', retry: false };

export function registerStartupControls(ipc, getWindow, getScreen, isWorkbenchUrl, isReady = () => true) {
  const accepts = event => {
    const contents = getWindow()?.webContents;
    return isReady() && contents && event.sender === contents
      && event.senderFrame === contents.mainFrame && isWorkbenchUrl(event.senderFrame.url);
  };
  ipc.handle('desktop:startup:show', event => {
    if (!accepts(event)) throw new Error('Startup request is not allowed');
    getScreen()?.waitForWorkbench();
  });
  ipc.on('desktop:workbench-ready', event => {
    if (accepts(event)) getScreen()?.reveal();
  });
}

// One local overlay covers the real page, including during navigation.
// Status changes update it in place so the animation never restarts.
export class StartupScreen {
  constructor(window, { onTimeout, timeoutMs = 45000 } = {}) {
    this.window = window;
    this.onTimeout = onTimeout;
    this.timeoutMs = timeoutMs;
    this.state = STARTUP_STATE;
    this.view = new WebContentsView({ webPreferences: {
      preload: join(here, 'status-preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
    } });
    this.view.setBackgroundColor('#00000000');
    this.window.contentView.addChildView(this.view);
    this.resize = () => {
      const [width, height] = window.getContentSize();
      this.view.setBounds({ x: 0, y: 0, width, height });
    };
    this.resize();
    window.on('resize', this.resize);
    this.view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.view.webContents.on('will-navigate', event => event.preventDefault());
    this.view.webContents.on('will-redirect', event => event.preventDefault());
    this.requestState = event => { if (this.accepts(event)) this.publish(); };
    this.fadeDone = event => {
      if (this.accepts(event) && this.state.phase === 'revealing') this.hide();
    };
    ipcMain.on('desktop:startup-state', this.requestState);
    ipcMain.on('desktop:startup-hidden', this.fadeDone);
    this.view.webContents.on('did-finish-load', () => this.publish());
    this.loaded = this.view.webContents.loadURL(pageUrl);
  }

  accepts(event) {
    return !this.disposed && event.sender === this.view.webContents
      && event.senderFrame === this.view.webContents.mainFrame
      && event.senderFrame?.url === pageUrl;
  }

  publish() {
    if (!this.disposed && !this.view.webContents.isDestroyed()) {
      this.view.webContents.send('desktop:startup-state', this.state);
    }
  }

  show(state = STARTUP_STATE) {
    if (this.disposed) return;
    clearTimeout(this.fadeTimer);
    clearTimeout(this.readyTimer);
    this.state = state;
    this.view.setVisible(true);
    this.publish();
  }

  waitForWorkbench() {
    this.show();
    this.readyTimer = setTimeout(() => this.onTimeout?.(), this.timeoutMs);
  }

  reveal() {
    // A hidden renderer can deliver its usable frame after the timeout.
    // Only that timeout may yield to readiness; service/page errors stay visible.
    const waiting = this.state.phase === 'starting'
      || (this.state.phase === 'error' && this.state.reason === 'workbench-timeout');
    if (this.disposed || !waiting) return;
    clearTimeout(this.readyTimer);
    this.state = { ...STARTUP_STATE, phase: 'revealing' };
    this.publish();
    // Minimized windows may not deliver animation frames. Never leave an
    // invisible overlay intercepting input when the window is restored.
    this.fadeTimer = setTimeout(() => this.hide(), 700);
  }

  hide() {
    if (this.disposed || this.state.phase !== 'revealing') return;
    clearTimeout(this.fadeTimer);
    this.state = { ...STARTUP_STATE, phase: 'hidden' };
    this.view.setVisible(false);
    this.window.webContents.focus();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.readyTimer);
    clearTimeout(this.fadeTimer);
    this.window.removeListener('resize', this.resize);
    ipcMain.removeListener('desktop:startup-state', this.requestState);
    ipcMain.removeListener('desktop:startup-hidden', this.fadeDone);
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(this.view);
    // Child WebContentsViews are not automatically destroyed by BrowserWindow.
    if (!this.view.webContents.isDestroyed()) this.view.webContents.close();
  }
}
