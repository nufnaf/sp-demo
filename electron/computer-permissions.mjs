const SETTINGS = Object.freeze({
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  screenRecording: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
});

/** OS permission state is never persisted as an application preference. */
export function createComputerPermissions({ systemPreferences, desktopCapturer, shell, startupState, verifyCapture, platform = process.platform }) {
  let memory = {};
  const store = startupState ?? { read: () => memory, write: value => { memory = value; } };
  const read = () => {
    const state = store.read();
    const permissions = {
    supported: platform === 'darwin',
    accessibility: platform === 'darwin' && systemPreferences.isTrustedAccessibilityClient(false),
    screenRecording: platform === 'darwin' && systemPreferences.getMediaAccessStatus('screen') === 'granted',
    };
    if ((!permissions.screenRecording && state.captureVerified) || ((!permissions.accessibility || !permissions.screenRecording) && state.complete)) {
      state.complete = false;
      if (!permissions.screenRecording) state.captureVerified = false;
      store.write(state);
    }
    return { ...permissions, captureVerified: permissions.screenRecording && state.captureVerified === true, initializationComplete: state.complete === true };
  };
  let pending;
  return {
    read,
    complete(value) {
      if (typeof value !== 'boolean') throw new Error('无效的准备状态。');
      const permissions = read();
      if (value && (!permissions.accessibility || !permissions.screenRecording)) throw new Error('请先完成系统权限准备。');
      store.write({ ...store.read(), complete: value });
      return read();
    },
    request(kind) {
      if (!Object.hasOwn(SETTINGS, kind)) return Promise.reject(new Error('未知的权限类型。'));
      if (platform !== 'darwin') return Promise.reject(new Error('请在 macOS 桌面 App 中开启权限。'));
      if (pending) return pending;
      pending = (async () => {
        if (!read()[kind] && kind === 'accessibility') systemPreferences.isTrustedAccessibilityClient(true);
        else if (!read()[kind]) {
          // Register this App with macOS on an explicit click. No thumbnails,
          // audio or screen contents are retained or returned to the renderer.
          try { await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false }); }
          catch { /* Denial is recoverable through System Settings below. */ }
        }
        if (!read()[kind]) await shell.openExternal(SETTINGS[kind]);
        // macOS's TCC result is the source of truth. Actual capture failures
        // are reported by the Computer Use operation that needs the screen.
        return read();
      })().finally(() => { pending = undefined; });
      return pending;
    },
  };
}

export function registerComputerPermissions(ipcMain, permissions, getWindow, isAppUrl) {
  const check = event => {
    const contents = getWindow()?.webContents;
    if (!contents || event.sender !== contents || event.senderFrame !== contents.mainFrame
      || !isAppUrl(event.senderFrame.url) || new URL(event.senderFrame.url).pathname !== '/') throw new Error('Untrusted permissions request');
  };
  ipcMain.handle('desktop:computer-permissions:get', event => { check(event); return permissions.read(); });
  ipcMain.handle('desktop:computer-permissions:request', (event, kind) => { check(event); return permissions.request(kind); });
  ipcMain.handle('desktop:startup:complete', (event, value) => { check(event); return permissions.complete(value); });
}
