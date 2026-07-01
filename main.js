const { app, BrowserWindow, WebContentsView, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let contentView;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "uLemdo Browser",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // 1. Birinchi navbatda brauzerning o'z UI panelini yuklaymiz
    mainWindow.loadFile('index.html');

    // 2. Saytlar ochiladigan haqiqiy ichki oynani (View) yaratamiz
    contentView = new WebContentsView({
        webPreferences: {
            nodeIntegration: false, // 🔴 RED TEAM: Saytlar tizim kodiga kira olmaydi
            contextIsolation: true,
            sandbox: true // 🔵 BLUE TEAM: Har bir sayt alohida qumloqda (sandbox) ishlaydi
        }
    });

    mainWindow.contentView.addChildView(contentView);

    // Ichki oynaning o'lchamini sozlash (tepadan 70px navigatsiya paneli uchun joy tashlaymiz)
    contentView.setBounds({ x: 0, y: 70, width: 1200, height: 730 });

    // Oyna o'lchami o'zgarganda ichki oyna ham moslashadi
    mainWindow.on('resize', () => {
        const [width, height] = mainWindow.getSize();
        contentView.setBounds({ x: 0, y: 70, width: width, height: height - 70 });
    });

    // Boshlanishiga uLemdo portalini yoki bo'sh sahifani yuklash mumkin
    contentView.webContents.loadURL('https://duckduckgo.com'); // Google'dan qochish uchun maxfiy DuckDuckGo
}

// Frontenddan kelgan URL'ni ochish buyrug'ini qabul qilish
ipcMain.on('navigate-to', (event, url) => {
    let targetUrl = url;
    
    // Agar kiritilgan matn to'g'ridan-to'g'ri URL bo'lmasa, uni qidiruvga yo'naltirish
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (url.includes('.') && !url.includes(' ')) {
            targetUrl = 'https://' + url;
        } else {
            // Google'siz muqobil maxfiy qidiruv tizimi
            targetUrl = `https://duckduckgo.com/?q=${encodeURIComponent(url)}`;
        }
    }
    
    contentView.webContents.loadURL(targetUrl);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
