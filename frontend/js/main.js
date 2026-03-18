// ========================================
// ⚙️ КОНФИГУРАЦИЯ
// ========================================
const API_URL = '/api';
const CONFIG = {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedExtensions: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
    debounceDelay: 300
};

// ========================================
// 🛠 УТИЛИТЫ
// ========================================
function showAlert(message, isError = false) {
    const type = isError ? 'error' : 'success';
    const icon = isError ? '❌' : '✅';
    
    // Создаём красивое уведомление
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `<span>${icon}</span> ${message}`;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 15px 25px;
        background: ${isError ? 'rgba(239, 83, 80, 0.9)' : 'rgba(76, 175, 80, 0.9)'};
        color: white;
        border-radius: 8px;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        max-width: 400px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function redirectTo(url) {
    if (url) window.location.href = url;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password && password.length >= 8;
}

// ========================================
// 🔐 АВТОРИЗАЦИЯ
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    
    // === РЕГИСТРАЦИЯ ===
    const regForm = document.getElementById('registerForm');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(regForm);
            const data = Object.fromEntries(formData);
            const submitBtn = regForm.querySelector('.auth-submit');
            
            // Валидация
            if (!validateEmail(data.email)) {
                showAlert('Введите корректный email', true);
                return;
            }
            
            if (!validatePassword(data.password)) {
                showAlert('Пароль должен содержать минимум 8 символов', true);
                return;
            }
            
            if (data.password !== data.confirm_password) {
                showAlert('Пароли не совпадают', true);
                return;
            }
            
            // Блокировка кнопки
            submitBtn.disabled = true;
            submitBtn.textContent = 'Регистрация...';
            
            try {
                const res = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                
                if (res.ok) {
                    showAlert(result.message, false);
                    setTimeout(() => redirectTo('/login'), 1500);
                } else {
                    showAlert(result.error, true);
                }
            } catch (err) {
                showAlert('Ошибка сети: ' + err.message, true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Зарегистрироваться';
            }
        });
    }
    
    // === ВХОД ===
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData);
            const submitBtn = loginForm.querySelector('.auth-submit');
            
            if (!validateEmail(data.email)) {
                showAlert('Введите корректный email', true);
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Вход...';
            
            try {
                const res = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                
                if (res.ok) {
                    showAlert('Вход выполнен успешно!', false);
                    setTimeout(() => redirectTo(result.redirect), 1000);
                } else {
                    showAlert(result.error, true);
                }
            } catch (err) {
                showAlert('Ошибка сети: ' + err.message, true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Войти';
            }
        });
    }
    
    // === ПРОВЕРКА СТАТУСА АВТОРИЗАЦИИ ===
    checkAuthStatus();
});

async function checkAuthStatus() {
    try {
        const res = await fetch(`${API_URL}/auth/status`);
        const data = await res.json();
        
        if (data.authenticated) {
            // Обновляем UI для авторизованного пользователя
            updateAuthUI(data.user);
        }
    } catch (err) {
        console.log('Auth check failed:', err);
    }
}

function updateAuthUI(user) {
    // Обновляем ссылки навигации
    const authLinks = document.querySelectorAll('.auth-link, nav a'); // Ищем и в спец классах и в обычном меню
    
    authLinks.forEach(link => {
        const text = link.textContent.trim();
        // Если ссылка ведет на вход или регистрацию, меняем её
        if (link.getAttribute('href') === '/login' || link.getAttribute('href') === '/register') {
            link.textContent = 'Кабинет';
            link.href = '/profile'; // Ссылка на новый профиль
            link.classList.add('profile-link'); // Можно добавить стиль
        }
        
        // Если пользователь уже в профиле, можно подсветить активный пункт
        if (window.location.pathname === '/profile' && link.getAttribute('href') === '/profile') {
            link.style.fontWeight = 'bold';
        }
    });

    // Опционально: Показать имя пользователя в хедере, если есть элемент с id current-user
    const userDisplay = document.getElementById('current-user-name');
    if (userDisplay && user) {
        userDisplay.textContent = user.username;
        userDisplay.style.display = 'inline';
    }
}

// ========================================
// 📝 ОТПРАВКА РУКОПИСИ
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const submissionForm = document.getElementById('submissionForm');
    const formMessage = document.getElementById('formMessage');
    
    if (submissionForm) {
        submissionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(submissionForm);
            const submitBtn = submissionForm.querySelector('.submit-btn');
            const fileInput = submissionForm.querySelector('input[type="file"]');
            
            // Валидация файла
            if (fileInput && fileInput.files[0]) {
                const file = fileInput.files[0];
                if (file.size > CONFIG.maxFileSize) {
                    showAlert('Файл слишком большой. Максимум 50MB', true);
                    return;
                }
                
                const ext = file.name.split('.').pop().toLowerCase();
                if (!CONFIG.allowedExtensions.includes(ext)) {
                    showAlert('Недопустимый формат файла', true);
                    return;
                }
            }
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Отправка...';
            formMessage.className = 'form-message';
            formMessage.textContent = '';
            
            try {
                const response = await fetch(`${API_URL}/submit`, {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    formMessage.classList.add('success');
                    formMessage.innerHTML = `
                        <strong>✅ ${result.message}</strong><br>
                        Мы свяжемся с вами в течение 2-4 недель на email: ${formData.get('email')}
                    `;
                    submissionForm.reset();
                    showAlert('Рукопись успешно отправлена!', false);
                } else {
                    formMessage.classList.add('error');
                    formMessage.textContent = `❌ Ошибка: ${result.error}`;
                    showAlert(result.error, true);
                    
                    if (result.error && result.error.includes('авторизации')) {
                        setTimeout(() => redirectTo('/login'), 2000);
                    }
                }
            } catch (error) {
                formMessage.classList.add('error');
                formMessage.textContent = `❌ Ошибка соединения: ${error.message}`;
                showAlert('Ошибка соединения', true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Отправить на рассмотрение';
            }
        });
    }
});

// ========================================
// 📚 КАТАЛОГ КНИГ
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const bookGrid = document.getElementById('bookGrid');
    const genreFilter = document.getElementById('genre-filter');
    const sortFilter = document.getElementById('sort-filter');
    const searchInput = document.getElementById('search-input');
    
    if (bookGrid) {
        loadBooks();
        
        // Фильтр по жанру
        if (genreFilter) {
            genreFilter.addEventListener('change', loadBooks);
        }
        
        // Сортировка
        if (sortFilter) {
            sortFilter.addEventListener('change', loadBooks);
        }
        
        // Поиск с debounce
        if (searchInput) {
            searchInput.addEventListener('input', debounce(loadBooks, CONFIG.debounceDelay));
        }
    }
});

async function loadBooks() {
    const grid = document.getElementById('bookGrid');
    if (!grid) return;
    
    // Показываем индикатор загрузки
    grid.innerHTML = '<div class="spinner"></div>';
    
    const genre = document.getElementById('genre-filter')?.value || 'All';
    const sort = document.getElementById('sort-filter')?.value || 'newest';
    const search = document.getElementById('search-input')?.value || '';
    
    try {
        const params = new URLSearchParams({ genre, sort, search });
        const res = await fetch(`${API_URL}/books?${params}`);
        
        if (!res.ok) throw new Error('Не удалось загрузить книги');
        
        const books = await res.json();
        
        if (books.length === 0) {
            grid.innerHTML = '<p class="empty-message">Книги не найдены</p>';
            return;
        }
        
        grid.innerHTML = books.map(b => `
            <div class="book-card" data-genre="${b.genre || ''}">
                <div class="book-cover">
                    <img src="${b.cover_image || '/static/placeholder.jpg'}" alt="${b.title}">
                    ${b.is_new ? '<span class="book-badge">Новинка</span>' : ''}
                    ${b.is_bestseller ? '<span class="book-badge" style="background: var(--warning)">Хит</span>' : ''}
                    ${b.discount > 0 ? `<span class="book-badge" style="background: var(--error)">-${b.discount}%</span>` : ''}
                </div>
                <div class="book-info">
                    <h3>${b.title}</h3>
                    <p class="book-author">${b.author}</p>
                    ${b.genre ? `<p class="book-genre">${b.genre}</p>` : ''}
                    <div class="book-price">
                        ${b.discount > 0 ? 
                            `<span class="old-price">${Math.round(b.price)} ₽</span> ${Math.round(b.price * (1 - b.discount/100))} ₽` : 
                            `${Math.round(b.price)} ₽`
                        }
                    </div>
                    ${b.rating ? `<div class="book-rating">⭐ ${b.rating.toFixed(1)}</div>` : ''}
                </div>
            </div>
        `).join('');
        
    } catch (err) {
        grid.innerHTML = `<p class="error-message">Ошибка загрузки: ${err.message}</p>`;
        showAlert('Не удалось загрузить книги', true);
    }
}

// ========================================
// 📬 КОНТАКТНАЯ ФОРМА
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    const formMessage = document.getElementById('formMessage');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData);
            const submitBtn = contactForm.querySelector('.submit-btn');
            
            if (!validateEmail(data.email)) {
                showAlert('Введите корректный email', true);
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Отправка...';
            formMessage.className = 'form-message';
            formMessage.textContent = '';
            
            try {
                const res = await fetch(`${API_URL}/contact`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                
                if (res.ok) {
                    formMessage.classList.add('success');
                    formMessage.textContent = result.message;
                    contactForm.reset();
                    showAlert('Сообщение отправлено!', false);
                } else {
                    formMessage.classList.add('error');
                    formMessage.textContent = result.error;
                    showAlert(result.error, true);
                }
            } catch (err) {
                formMessage.classList.add('error');
                formMessage.textContent = 'Ошибка соединения';
                showAlert('Ошибка соединения', true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Отправить сообщение';
            }
        });
    }
    
    // === РАССЫЛКА ===
    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = newsletterForm.querySelector('input[type="email"]').value;
            const submitBtn = newsletterForm.querySelector('.submit-btn');
            
            if (!validateEmail(email)) {
                showAlert('Введите корректный email', true);
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Подписка...';
            
            try {
                const res = await fetch(`${API_URL}/newsletter`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ email })
                });
                
                const result = await res.json();
                
                if (res.ok) {
                    showAlert(result.message, false);
                    newsletterForm.reset();
                } else {
                    showAlert(result.error, true);
                }
            } catch (err) {
                showAlert('Ошибка соединения', true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Подписаться';
            }
        });
    }
});

// ========================================
// 👑 АДМИН-ПАНЕЛЬ
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const adminStats = document.getElementById('adminStats');
    const adminTableBody = document.getElementById('adminTableBody');
    
    if (adminStats) {
        loadAdminStats();
    }
});

async function loadAdminStats() {
    const statsContainer = document.getElementById('adminStats');
    if (!statsContainer) return;
    
    try {
        const res = await fetch(`${API_URL}/admin/stats`);
        
        if (!res.ok) {
            showAlert('Требуется авторизация администратора', true);
            setTimeout(() => redirectTo('/login'), 2000);
            return;
        }
        
        const data = await res.json();
        
        statsContainer.innerHTML = `
            <div class="stat-box">
                <span class="stat-value">${data.total_users ?? 0}</span>
                <span class="stat-label">Пользователей</span>
            </div>
            <div class="stat-box" style="color: var(--success)">
                <span class="stat-value">${data.online_users ?? 0}</span>
                <span class="stat-label">Онлайн</span>
            </div>
            <div class="stat-box">
                <span class="stat-value">${data.total_submissions ?? 0}</span>
                <span class="stat-label">Заявок</span>
            </div>
            <div class="stat-box" style="color: var(--warning)">
                <span class="stat-value">${data.pending_submissions ?? 0}</span>
                <span class="stat-label">На рассмотрении</span>
            </div>
        `;
        
        await loadAdminSubmissions();
    } catch (err) {
        statsContainer.innerHTML = `<p class="error-message">Ошибка: ${err.message}</p>`;
        showAlert('Ошибка загрузки статистики', true);
    }
}

async function loadAdminSubmissions() {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;
    
    try {
        const res = await fetch(`${API_URL}/admin/all-submissions`);
        
        if (!res.ok) throw new Error('Не удалось загрузить заявки');
        
        const subs = await res.json();
        
        if (subs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Заявок нет</td></tr>';
            return;
        }
        
        tbody.innerHTML = subs.map(s => `
            <tr>
                <td>${s.username || s.author_name || '—'}</td>
                <td>${s.manuscript_title || 'Без названия'}</td>
                <td>${s.genre || '—'}</td>
                <td>
                    <span class="status-cell status-${s.status}">${s.status || 'Unknown'}</span>
                </td>
                <td>${new Date(s.submitted_at).toLocaleDateString('ru-RU')}</td>
                <td>
                    <select onchange="changeStatus('${s.id}', this.value)" data-status="${s.status}">
                        <option value="Submitted" ${s.status === 'Submitted' ? 'selected' : ''}>Отправлено</option>
                        <option value="Approved" ${s.status === 'Approved' ? 'selected' : ''}>Принято</option>
                        <option value="Rejected" ${s.status === 'Rejected' ? 'selected' : ''}>Отклонено</option>
                    </select>
                    ${s.filename ? 
                        `<a href="${API_URL}/admin/download/${encodeURIComponent(s.filename)}" class="btn-download" download>📥</a>` : 
                        '<span class="no-file">—</span>'
                    }
                </td>
            </tr>
        `).join('');
        
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="error-message">Ошибка: ${err.message}</td></tr>`;
        showAlert('Ошибка загрузки заявок', true);
    }
}

async function changeStatus(id, status) {
    try {
        const res = await fetch(`${API_URL}/admin/update-status`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id, status })
        });
        
        const result = await res.json();
        
        if (res.ok) {
            showAlert(result.message, false);
            await loadAdminStats();
        } else {
            showAlert(result.error, true);
        }
    } catch (err) {
        showAlert('Ошибка сети: ' + err.message, true);
    }
}

// ========================================
// 📱 МОБИЛЬНОЕ МЕНЮ
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navUl = document.querySelector('nav ul');
    
    if (mobileMenuBtn && navUl) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenuBtn.classList.toggle('active');
            navUl.classList.toggle('active');
            document.body.classList.toggle('menu-open');
        });
        
        // Закрыть меню при клике на ссылку
        document.querySelectorAll('nav ul li a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenuBtn.classList.remove('active');
                navUl.classList.remove('active');
                document.body.classList.remove('menu-open');
            });
        });
        
        // Закрыть меню при клике вне
        document.addEventListener('click', (e) => {
            if (!e.target.closest('nav') && !e.target.closest('.mobile-menu-btn')) {
                mobileMenuBtn.classList.remove('active');
                navUl.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });
    }
});

// ========================================
// 📜 SCROLL ЭФФЕКТЫ
// ========================================
let scrollTimeout;
function handleHeaderScroll() {
    const header = document.querySelector('header');
    if (!header) return;
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        header.classList.toggle('scrolled', window.scrollY > 50);
    }, 10);
}

window.addEventListener('scroll', handleHeaderScroll, { passive: true });
handleHeaderScroll();

// ========================================
// 🎬 АНИМАЦИЯ ПРИ СКРОЛЛЕ
// ========================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.advantage-card, .book-card, .blog-card, .team-member, .value-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'all 0.6s ease-out';
        observer.observe(card);
    });
});

// ========================================
// ❓ FAQ АККОРДЕОН
// ========================================
document.addEventListener('DOMContentLoaded', function() {
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
});

// ========================================
// 🧹 ОЧИСТКА ПРИ ВЫГРУЗКЕ
// ========================================
window.addEventListener('beforeunload', () => {
    observer.disconnect();
    window.removeEventListener('scroll', handleHeaderScroll);
});

// ========================================
// 🎨 ДОПОЛНИТЕЛЬНЫЕ СТИЛИ ДЛЯ УВЕДОМЛЕНИЙ
// ========================================
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .notification {
        font-family: 'Georgia', serif;
    }
    body.menu-open {
        overflow: hidden;
    }
`;
document.head.appendChild(style);