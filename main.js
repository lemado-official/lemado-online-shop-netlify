const { app, BrowserWindow } = require('electron');
const path = require('path');

function createBrowserWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "uLemado Browser",
        webPreferences: {
            // 🔴 RED TEAM xavfi: Agar nodeIntegration true bo'lsa, saytdagi har qanday XSS zaifligi orqali kiberjinoyatchi kompyuter fayllarini o'chira oladi.
            // 🔵 BLUE TEAM himoyasi: Node integratsiyasini o'chiramiz va izolyatsiyani yoqamiz.
            nodeIntegration: false, 
            contextIsolation: true, 
            
            // Xavfsiz ko'prik (Bridge) faylini ulaymiz
            preload: path.join(__dirname, 'preload.js'),
            
            // HTTPS bo'lmagan (buzuq) kontentlarni cheklash
            allowRunningInsecureContent: false 
        }
    });

    // Bosh sahifamizni yuklaymiz
    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createBrowserWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createBrowserWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
