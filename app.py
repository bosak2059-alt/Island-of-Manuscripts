from flask import Flask, render_template, request, jsonify, redirect, url_for, session, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
import sqlite3
import uuid
from datetime import datetime, timedelta
import functools

# ========================================
# ⚙️ КОНФИГУРАЦИЯ
# ========================================
app = Flask(__name__, template_folder='frontend/templates', static_folder='frontend')
app.secret_key = 'super_secret_key_island_manuscripts_change_in_production'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
app.config['ALLOWED_EXTENSIONS'] = {'pdf', 'doc', 'docx', 'txt', 'rtf'}

CORS(app, supports_credentials=True)
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

DB_NAME = 'database.db'

# ========================================
# 🗄️ БАЗА ДАННЫХ
# ========================================
def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    
    # ✅ ИСПРАВЛЕНО: Все SQL-опечатки устранены
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'author',
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            author_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            manuscript_title TEXT NOT NULL,
            genre TEXT,
            volume TEXT,
            text_link TEXT,
            comment TEXT,
            filename TEXT,
            status TEXT DEFAULT 'Submitted',
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TIMESTAMP,
            reviewer_notes TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            genre TEXT,
            cover_image TEXT,
            description TEXT,
            price REAL DEFAULT 0,
            rating REAL DEFAULT 0,
            is_new BOOLEAN DEFAULT 0,
            is_bestseller BOOLEAN DEFAULT 0,
            discount REAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS contact_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_read BOOLEAN DEFAULT 0
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS newsletter_subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    ''')
    
    # Создание админа
    c.execute('SELECT count(*) FROM users WHERE role = "admin"')
    if c.fetchone()[0] == 0:
        admin_pass = generate_password_hash('admin123')
        c.execute('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
                  ('Admin', 'admin@island.com', admin_pass, 'admin'))
        print("✅ Создан администратор: admin@island.com / admin123")
    
    # Заполнение книг
    c.execute('SELECT count(*) FROM books')
    if c.fetchone()[0] == 0:
        books = [
            ('Whispers of the Archipelago', 'Elena Voss', 'Fiction', 
             'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400', 
             'Mystery novel.', 450, 4.8, 1, 0, 0),
            ('The Inkwell Diaries', 'Lucas Frye', 'Non-Fiction', 
             'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400', 
             'Memoirs.', 390, 4.5, 0, 1, 0),
            ('Ocean of Words', 'Sarah Lin', 'Poetry', 
             'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400', 
             'Poems.', 350, 4.6, 1, 0, 10)
        ]
        c.executemany('''
            INSERT INTO books (title, author, genre, cover_image, description, price, rating, is_new, is_bestseller, discount) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', books)
        print("✅ Добавлены тестовые книги")
    
    conn.commit()
    conn.close()
    print("✅ База данных инициализирована успешно")

# ========================================
# 🔐 ДЕКОРАТОРЫ
# ========================================
def login_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Требуется авторизация'}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('user_role') == 'admin':
            return jsonify({'error': 'Доступ запрещён'}), 403
        return f(*args, **kwargs)
    return decorated_function

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# ========================================
# 🔄 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ========================================
def update_user_activity(email):
    try:
        conn = get_db()
        c = conn.cursor()
        c.execute('UPDATE users SET last_seen = ? WHERE email = ?', 
                  (datetime.now().isoformat(), email))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

def get_online_users_count():
    try:
        conn = get_db()
        c = conn.cursor()
        threshold = datetime.now() - timedelta(minutes=5)
        c.execute('SELECT count(*) FROM users WHERE last_seen > ?', 
                  (threshold.isoformat(),))
        count = c.fetchone()[0]
        conn.close()
        return count
    except Exception:
        return 0

# ========================================
# 📄 МАРШРУТЫ
# ========================================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/register')
def register_page():
    return render_template('register.html')

@app.route('/catalog')
def catalog_page():
    return render_template('catalog.html')

@app.route('/to-authors')
def authors_page():
    return render_template('toTheAuthors.html')

@app.route('/about')
def about_page():
    return render_template('aboutThePublishingHouse.html')

@app.route('/contacts')
def contacts_page():
    return render_template('contacts.html')

@app.route('/blog')
def blog_page():
    return render_template('Blog.html')

@app.route('/admin-panel')
def admin_panel():
    if not session.get('user_role') == 'admin':
        return redirect(url_for('login_page'))
    return render_template('admin.html')

# ========================================
# 🔐 API: АУТЕНТИФИКАЦИЯ
# ========================================
@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not all([username, email, password]):
        return jsonify({'error': 'Заполните все поля'}), 400
    
    if len(password) < 8:
        return jsonify({'error': 'Пароль минимум 8 символов'}), 400
    
    pwd_hash = generate_password_hash(password)
    
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', 
                  (username, email, pwd_hash))
        conn.commit()
        return jsonify({'success': True, 'message': 'Регистрация успешна!'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email уже существует'}), 400
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not all([email, password]):
        return jsonify({'error': 'Введите email и пароль'}), 400
    
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE email = ?', (email,))
    user = c.fetchone()
    conn.close()
    
    if user and check_password_hash(user['password_hash'], password):
        # ✅ ИСПРАВЛЕНО: Конвертируем sqlite3.Row в dict перед .get()
        user_dict = dict(user)
        if not user_dict.get('is_active', 1):
            return jsonify({'error': 'Аккаунт деактивирован'}), 403
        
        session['user_id'] = user['id']
        session['user_email'] = user['email']
        session['user_role'] = user['role']
        session['username'] = user['username']
        
        update_user_activity(email)
        
        if user['role'] == 'admin':
            return jsonify({'success': True, 'redirect': '/admin-panel'})
        else:
            return jsonify({'success': True, 'redirect': '/'})
    else:
        return jsonify({'error': 'Неверный email или пароль'}), 401

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/auth/status')
def auth_status():
    if 'user_id' in session:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': session['user_id'],
                'email': session['user_email'],
                'role': session['user_role'],
                'username': session['username']
            }
        })
    return jsonify({'authenticated': False})

# ========================================
# 📝 API: РУКОПИСИ
# ========================================
@app.route('/api/submit', methods=['POST'])
@login_required
def submit_manuscript():
    author_name = request.form.get('author_name', '').strip()
    email = request.form.get('email', '').strip()
    title = request.form.get('manuscript_title', '').strip()
    genre = request.form.get('genre', '').strip()
    file = request.files.get('file')
    
    if not all([author_name, email, title]):
        return jsonify({'error': 'Заполните обязательные поля'}), 400
    
    sub_id = str(uuid.uuid4())
    filename = ''
    
    if file and file.filename:
        if not allowed_file(file.filename):
            return jsonify({'error': 'Недопустимый формат файла'}), 400
        filename = f"{sub_id}_{secure_filename(file.filename)}"
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
    
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        INSERT INTO submissions (id, user_id, author_name, email, manuscript_title, genre, filename) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (sub_id, session.get('user_id'), author_name, email, title, genre, filename))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Рукопись отправлена!'})

@app.route('/api/my-submissions')
@login_required
def get_my_submissions():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM submissions WHERE user_id = ? ORDER BY submitted_at DESC', 
              (session['user_id'],))
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

# ========================================
# 📚 API: КНИГИ
# ========================================
@app.route('/api/books')
def get_books():
    genre = request.args.get('genre')
    search = request.args.get('search', '')
    sort = request.args.get('sort', 'newest')
    
    conn = get_db()
    c = conn.cursor()
    
    query = "SELECT * FROM books WHERE 1=1"
    params = []
    
    if genre and genre != 'All':
        query += " AND genre = ?"
        params.append(genre)
    
    if search:
        query += " AND (title LIKE ? OR author LIKE ?)"
        s = f"%{search}%"
        params.extend([s, s])
    
    if sort == 'newest':
        query += " ORDER BY created_at DESC"
    elif sort == 'popular':
        query += " ORDER BY rating DESC"
    elif sort == 'price':
        query += " ORDER BY price ASC"
    
    c.execute(query, params)
    books = [dict(row) for row in c.fetchall()]
    conn.close()
    
    return jsonify(books)

# ========================================
# 📬 API: КОНТАКТЫ
# ========================================
@app.route('/api/contact', methods=['POST'])
def api_contact():
    data = request.json
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    message = data.get('message', '').strip()
    
    if not all([name, email, message]):
        return jsonify({'error': 'Заполните все поля'}), 400
    
    conn = get_db()
    c = conn.cursor()
    c.execute('INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)', 
              (name, email, message))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Сообщение отправлено!'})

@app.route('/api/newsletter', methods=['POST'])
def api_newsletter():
    data = request.json
    email = data.get('email', '').strip().lower()
    
    if not email:
        return jsonify({'error': 'Email обязателен'}), 400
    
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute('INSERT INTO newsletter_subscribers (email) VALUES (?)', (email,))
        conn.commit()
        return jsonify({'success': True, 'message': 'Вы подписаны!'})
    except sqlite3.IntegrityError:
        return jsonify({'success': True, 'message': 'Вы уже подписаны'})
    finally:
        conn.close()

# ========================================
# 👑 API: АДМИН
# ========================================
@app.route('/api/admin/stats')
@admin_required
def admin_stats():
    conn = get_db()
    c = conn.cursor()
    
    c.execute('SELECT count(*) FROM users')
    total_users = c.fetchone()[0]
    
    c.execute('SELECT count(*) FROM submissions')
    total_subs = c.fetchone()[0]
    
    c.execute('SELECT count(*) FROM submissions WHERE status = "Submitted"')
    pending_subs = c.fetchone()[0]
    
    online_users = get_online_users_count()
    
    conn.close()
    
    return jsonify({
        'total_users': total_users,
        'online_users': online_users,
        'total_submissions': total_subs,
        'pending_submissions': pending_subs
    })

@app.route('/api/admin/all-submissions')
@admin_required
def admin_all_submissions():
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        SELECT s.*, u.username, u.email as user_email
        FROM submissions s
        LEFT JOIN users u ON s.user_id = u.id
        ORDER BY s.submitted_at DESC
    ''')
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@app.route('/api/admin/update-status', methods=['POST'])
@admin_required
def admin_update_status():
    data = request.json
    sub_id = data.get('id')
    status = data.get('status')
    
    if not sub_id or not status:
        return jsonify({'error': 'Некорректные данные'}), 400
    
    conn = get_db()
    c = conn.cursor()
    c.execute('UPDATE submissions SET status = ?, reviewed_at = ? WHERE id = ?', 
              (status, datetime.now().isoformat(), sub_id))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/admin/download/<filename>')
@admin_required
def admin_download(filename):
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if os.path.exists(filepath):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)
    return jsonify({'error': 'Файл не найден'}), 404

@app.route('/api/admin/messages')
@admin_required
def admin_messages():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM contact_messages ORDER BY created_at DESC')
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@app.route('/api/admin/message/<int:id>/read', methods=['POST'])
@admin_required
def mark_message_read(id):
    conn = get_db()
    c = conn.cursor()
    c.execute('UPDATE contact_messages SET is_read = 1 WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ========================================
# 🛠 ОШИБКИ
# ========================================
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Страница не найдена'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

# ========================================
# 🚀 ЗАПУСК
# ========================================
if __name__ == '__main__':
    # ⚠️ УДАЛИТЬ старую БД!
    import os
    if os.path.exists(DB_NAME):
        os.remove(DB_NAME)
        print("🗑️ Старая база данных удалена")
    
    init_db()
    print("\n" + "="*50)
    print("🏝️  ИЗДАТЕЛЬСТВО 'ОСТРОВ РУКОПИСЕЙ'")
    print("="*50)
    print("📡 Сервер: http://127.0.0.1:5000")
    print("👑 Админ: admin@island.com / admin123")
    print("="*50 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)