// The workbench only signals that its first usable frame is ready.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('syntropicDesktop', Object.freeze({
  ready: () => ipcRenderer.send('desktop:workbench-ready'),
}));
