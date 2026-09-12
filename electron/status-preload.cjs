// Only the bundled startup page receives status/retry capabilities.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('syntropicStartup', Object.freeze({
  subscribe: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('desktop:startup-state', listener);
    ipcRenderer.send('desktop:startup-state');
    return () => ipcRenderer.removeListener('desktop:startup-state', listener);
  },
  hidden: () => ipcRenderer.send('desktop:startup-hidden'),
  retry: () => ipcRenderer.invoke('desktop:retry'),
}));
