// Narrow workbench-only bridge; no general IPC or native desktop access.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('syntropicDesktop', Object.freeze({
  getUiPreferences: () => ipcRenderer.invoke('desktop:ui-preferences:get'),
  setUiPreferences: value => ipcRenderer.invoke('desktop:ui-preferences:set', value),
  ready: () => ipcRenderer.send('desktop:workbench-ready'),
  captureSpaceThumbnail: () => ipcRenderer.invoke('desktop:space-thumbnail'),
  getComputerPermissions: () => ipcRenderer.invoke('desktop:computer-permissions:get'),
  requestComputerPermission: kind => ipcRenderer.invoke('desktop:computer-permissions:request', kind),
  completeInitialization: value => ipcRenderer.invoke('desktop:startup:complete', value),
}));
