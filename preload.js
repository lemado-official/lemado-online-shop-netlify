const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('uLemdoAPI', {
    getBrowserVersion: () => process.versions.electron,
    // Saytga o'tish funksiyasi
    navigateTo: (url) => ipcRenderer.send('navigate-to', url)
});
