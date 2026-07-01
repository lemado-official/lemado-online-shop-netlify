const { contextBridge, ipcRenderer } = require('electron');

// Frontend ichida ishlatish mumkin bo'lgan xavfsiz API'lar
contextBridge.exposeInMainWorld('uLemdoAPI', {
    // Kelajakda brauzer funksiyalari (masalan: tarix, xatchoplar) shu yerga yoziladi
    getBrowserVersion: () => process.versions.electron
});
