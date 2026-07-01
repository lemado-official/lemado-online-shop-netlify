async function handleAuth(event) {
    event.preventDefault();
    
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    // O'zingizning ishlagan Render URL manzilingizni qo'ying
    const BACKEND_URL = 'https://sizning-app-nomingiz.onrender.com'; 
    const endpoint = isLoginMode ? '/api/login' : '/api/register';

    try {
        // Render serveriga haqiqiy so'rov yuborish
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Hammasi to'g'ri bo'lsa, tizimga kirish
            loginSuccess(email); 
        } else {
            // Parol xato yoki bunday akkaunt yo'q bo'lsa
            alert(data.message || "Xatolik yuz berdi");
        }

    } catch (error) {
        console.error('Render serverga ulanishda xato:', error);
        alert('Server bilan bog\'lanib bo\'lmadi. Internetni yoki serverni tekshiring.');
    }
}
