const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // You can expose ipcRenderer methods here if the frontend needs to talk to the electron main process
  // e.g., getApiUrl: () => ipcRenderer.invoke('get-api-url')
});
