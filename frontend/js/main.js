const API_URL = '/api'; // Относительный путь, так как Flask проксирует всё

// === УТИЛИТЫ ===
function showAlert(message, isError = false) {
    alert(message);
}

function redirectTo(url) {
    if (url) window.location.href = url;
}

// === АВТОРИЗАЦИЯ ===

// Регистрация
const regForm = document.getElementById('registerForm');
if (regForm) {
    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(regForm);
        const data = Object.fromEntries(formData);
        
        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            const result = await res.json();
            showAlert(result.message || result.error, !res.ok);
            if (res.ok) redirectTo('/login');
        } catch (err) {
            showAlert('Ошибка сети: ' + err.message, true);
        }
    });
}

// Вход
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(loginForm);
        const data = Object.fromEntries(formData);
        
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (res.ok) {
                redirectTo(result.redirect);
            } else {
                showAlert(result.error, true);
            }
        } catch (err) {
            showAlert('Ошибка сети: ' + err.message, true);
        }
    });
}

// === ГЛАВНАЯ: ОТПРАВКА РУКОПИСИ ===
const submitForm = document.getElementById('submitForm');
if (submitForm) {
    submitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(submitForm);
        const msgDiv = document.getElementById('message');
        
        try {
            const res = await fetch(`${API_URL}/submit`, {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            
            if (res.ok) {
                msgDiv.innerHTML = `<p style="color:green">${result.message}</p>`;
                submitForm.reset();
            } else {
                msgDiv.innerHTML = `<p style="color:red">${result.error}</p>`;
                if (result.error && result.error.includes('войдите')) {
                    redirectTo('/login');
                }
            }
        } catch (err) {
            msgDiv.innerHTML = `<p style="color:red">Ошибка: ${err.message}</p>`;
        }
    });
}

// === КАТАЛОГ ===
async function loadBooks() {
    const grid = document.getElementById('bookGrid');
    if (!grid) return;
    
    try {
        const res = await fetch(`${API_URL}/books`);
        if (!res.ok) throw new Error('Не удалось загрузить книги');
        const books = await res.json();
        
        grid.innerHTML = books.map(b => `
            <div class="book-card">
                <div class="book-cover">
                    <img src="${b.cover_image || '/static/placeholder.jpg'}" alt="${b.title}">
                </div>
                <div class="book-info">
                    <h3>${b.title}</h3>
                    <p class="book-author">${b.author}</p>
                    ${b.genre ? `<p class="book-genre">${b.genre}</p>` : ''}
                </div>
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = `<p style="color:red">Ошибка загрузки: ${err.message}</p>`;
    }
}
if (document.getElementById('bookGrid')) loadBooks();

// === АДМИНКА (admin.html) ===
async function loadAdminStats() {
    const statsContainer = document.getElementById('adminStats');
    if (!statsContainer) return;

    try {
        const res = await fetch(`${API_URL}/admin/stats`);
        if (!res.ok) { 
            redirectTo('/login'); 
            return; 
        }
        
        const data = await res.json();
        statsContainer.innerHTML = `
            <div class="stat-box">Пользователей всего: ${data.total_users ?? 0}</div>
            <div class="stat-box" style="color:green">Онлайн: ${data.online_users ?? 0}</div>
            <div class="stat-box">Рукописей: ${data.total_subs ?? 0}</div>
        `;
        
        await loadAdminSubmissions();
    } catch (err) {
        statsContainer.innerHTML = `<p style="color:red">Ошибка: ${err.message}</p>`;
    }
}

async function loadAdminSubmissions() {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;
    
    try {
        const res = await fetch(`${API_URL}/admin/all-submissions`);
        if (!res.ok) throw new Error('Не удалось загрузить рукописи');
        const subs = await res.json();
        
        tbody.innerHTML = subs.map(s => `
            <tr>
                <td>${s.username || '—'}</td>
                <td>${s.manuscript_title || 'Без названия'}</td>
                <td>
                    <span class="status status-${s.status?.toLowerCase()}">${s.status || 'Unknown'}</span>
                </td>
                <td>
                    <select onchange="changeStatus('${s.id}', this.value)" data-status="${s.status}">
                        <option value="Submitted" ${s.status === 'Submitted' ? 'selected' : ''}>Отправлено</option>
                        <option value="Accepted" ${s.status === 'Accepted' ? 'selected' : ''}>Принято</option>
                        <option value="Rejected" ${s.status === 'Rejected' ? 'selected' : ''}>Отклонено</option>
                    </select>
                    <a href="${API_URL}/admin/download/${encodeURIComponent(s.filename)}" download>Скачать</a>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:red">Ошибка: ${err.message}</td></tr>`;
    }
}

async function changeStatus(id, status) {
    try {
        const res = await fetch(`${API_URL}/admin/update-status`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id, status})
        });
        if (res.ok) {
            showAlert('Статус обновлен');
            await loadAdminStats();
        } else {
            const err = await res.json();
            showAlert(err.error || 'Ошибка обновления', true);
        }
    } catch (err) {
        showAlert('Ошибка сети: ' + err.message, true);
    }
}

// Запуск админки при загрузке
if (document.getElementById('adminStats')) {
    loadAdminStats();
}

// === МОБИЛЬНОЕ МЕНЮ ===
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navUl = document.querySelector('nav ul');

if (mobileMenuBtn && navUl) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenuBtn.classList.toggle('active');
        navUl.classList.toggle('active');
    });
    
    // Закрыть меню при клике на ссылку
    document.querySelectorAll('nav ul li a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuBtn.classList.remove('active');
            navUl.classList.remove('active');
        });
    });
    
    // Закрыть меню при клике вне
    document.addEventListener('click', (e) => {
        if (!e.target.closest('nav') && !e.target.closest('.mobile-menu-btn')) {
            mobileMenuBtn.classList.remove('active');
            navUl.classList.remove('active');
        }
    });
}

// === SCROLLED HEADER ===
function handleHeaderScroll() {
    const header = document.querySelector('header');
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 50);
}
window.addEventListener('scroll', handleHeaderScroll, {passive: true});
handleHeaderScroll(); // инициализация при загрузке

// === АНИМАЦИЯ ПРИ СКРОЛЛЕ (Intersection Observer) ===
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target); // оптимизация: перестаем следить после анимации
        }
    });
}, observerOptions);

document.querySelectorAll('.advantage-card, .book-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'all 0.6s ease-out';
    observer.observe(card);
});

// === ОЧИСТКА ПРИ ВЫГРУЗКЕ ===
window.addEventListener('beforeunload', () => {
    observer.disconnect();
    window.removeEventListener('scroll', handleHeaderScroll);
});

// === ОБРАБОТКА ФОРМЫ ПОДАЧИ РУКОПИСИ ===
const submissionForm = document.getElementById('submissionForm');
const formMessage = document.getElementById('formMessage');

if (submissionForm) {
    submissionForm.addEventListener('submit', async (e) => {
        // ✅ ИСПРАВЛЕНО: Блокируем стандартную отправку
        e.preventDefault();
        
        const formData = new FormData(submissionForm);
        const submitBtn = submissionForm.querySelector('.submit-btn');
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';
        formMessage.className = 'form-message';
        formMessage.textContent = '';

        try {
            const response = await fetch('/api/submit', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                formMessage.classList.add('success');
                formMessage.innerHTML = `
                    <strong>✅ Заявка успешно отправлена!</strong><br>
                    Мы свяжемся с вами в течение 2-4 недель на email: ${formData.get('email')}
                `;
                submissionForm.reset();
            } else {
                formMessage.classList.add('error');
                formMessage.textContent = `❌ Ошибка: ${result.error || 'Не удалось отправить заявку'}`;
            }
        } catch (error) {
            formMessage.classList.add('error');
            formMessage.textContent = `❌ Ошибка соединения: ${error.message}`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить на рассмотрение';
        }
    });
}

// === FAQ АККОРДЕОН ===
document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
        const faqItem = question.parentElement;
        const isActive = faqItem.classList.contains('active');
        
        document.querySelectorAll('.faq-item').forEach(item => {
            item.classList.remove('active');
        });
        
        if (!isActive) {
            faqItem.classList.add('active');
        }
    });
});

// === SCROLLED HEADER ===
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});