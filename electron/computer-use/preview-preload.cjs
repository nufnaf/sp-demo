// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('computerPreview', Object.freeze({
  connect: () => ipcRenderer.invoke('computer-preview:connect'),
  disconnect: () => ipcRenderer.invoke('computer-preview:disconnect'),
  onFrame: callback => {
    const listener = (_event, frame) => callback(frame);
    ipcRenderer.on('computer-preview:frame', listener);
    return () => ipcRenderer.removeListener('computer-preview:frame', listener);
  },
  settings: () => ipcRenderer.invoke('computer-preview:settings'),
}));
