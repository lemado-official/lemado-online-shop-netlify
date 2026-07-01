// 1. Soat va Ob-havo
function updateClock() {
    const clockElement = document.getElementById('digital-clock');
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    clockElement.textContent = `${hours}:${minutes}`;
}
setInterval(updateClock, 1000);
updateClock();

document.getElementById('weather-temp').textContent = `☀️ +32°C Clear Sky`;

// 2. Auth Modal Logikasi
let isLoginMode = true; 

function openModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('auth-modal').classList.add('hidden');
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const title = document.getElementById('modal-title');
    const toggleSpan = document.querySelector('.toggle-text span');
    const toggleP = document.querySelector('.toggle-text');
    
    if (isLoginMode) {
        title.textContent = "Tizimga kirish";
        toggleP.innerHTML = `Akkauntingiz yo'qmi? <span onclick="toggleAuthMode()">Ro'yxatdan o'tish</span>`;
    } else {
        title.textContent = "Ro'yxatdan o'tish";
        toggleP.innerHTML = `Akkauntingiz bormi? <span onclick="toggleAuthMode()">Tizimga kirish</span>`;
    }
}

// 3. Backend (Render) bilan ishlash (MongoDB ga yuborish)
async function handleAuth(event) {
    event.preventDefault();
    
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    // DIQQAT: O'zingizning Render domenini shu yerga qo'ying!
    // Masalan: 'https://ulemado-backend.onrender.com'
    const BACKEND_URL = 'https://lemado-online-shop-render.onrender.com';
    const endpoint = isLoginMode ? '/api/login' : '/api/register';

    try {
        /* SO'ROV YUBORISH KODI (Backend to'liq ishga tushganda izohdan chiqaring):
        
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        
        if(response.ok) {
            loginSuccess(email); 
        } else {
            alert(data.message || "Xatolik yuz berdi");
        }
        */

        // Hozircha vizual test uchun:
        console.log(`[Test] ${isLoginMode ? "Kirish" : "Ro'yxatdan o'tish"} amalga oshdi:`, email);
        loginSuccess(email);

    } catch (error) {
        console.error('Serverga ulanishda xato:', error);
        alert('Server bilan bog\'lanib bo\'lmadi.');
    }
}

// Muvaffaqiyatli kirish ui o'zgarishi
function loginSuccess(email) {
    closeModal();
    document.getElementById('login-btn').classList.add('hidden');
    document.getElementById('user-profile').classList.remove('hidden');
    
    // Ism o'rniga emailning bosh qismini chiqaramiz (masalan: admin@mail.uz -> admin)
    const username = email.split('@')[0];
    document.getElementById('user-name-display').textContent = `Salom, ${username}`;
}

// Chiqish
function logout() {
    document.getElementById('user-profile').classList.add('hidden');
    document.getElementById('login-btn').classList.remove('hidden');
    document.getElementById('auth-form').reset();
}
