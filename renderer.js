// 1. Preload orqali kelgan ma'lumotni status-barga yozish
document.addEventListener('DOMContentLoaded', () => {
    const versionElement = document.getElementById('electron-ver');
    if (window.uLemdoAPI) {
        versionElement.textContent = `Engine v${window.uLemdoAPI.getBrowserVersion()}`;
    } else {
        versionElement.textContent = "Standart Web Mode";
    }
});

// 2. Oddiy soat funksiyasi
function updateClock() {
    const clock = document.getElementById('digital-clock');
    const now = new Date();
    clock.textContent = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
}
setInterval(updateClock, 1000);
updateClock();

// 3. Modal boshqaruvi
function openModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('auth-modal').classList.add('hidden');
}
