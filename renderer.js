document.getElementById('go-btn').addEventListener('click', () => {
    const url = document.getElementById('url-input').value;
    if (url.trim() !== "") {
        window.uLemdoAPI.navigateTo(url);
    }
});

// Enter tugmasini bosganda ham o'tish
document.getElementById('url-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const url = document.getElementById('url-input').value;
        if (url.trim() !== "") {
            window.uLemdoAPI.navigateTo(url);
        }
    }
});

function openModal() { document.getElementById('auth-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('auth-modal').classList.add('hidden'); }
