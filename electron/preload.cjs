// The recovery page gets one capability. The app itself uses its existing HTTP APIs.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('syntropicDesktop', Object.freeze({
  retry: () => ipcRenderer.invoke('desktop:retry'),
}));
