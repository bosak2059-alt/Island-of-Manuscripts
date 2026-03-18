from flask import Flask, render_template, request, jsonify, redirect, url_for, session, send_from_directory
from flask_cors import CORS
import os
import sqlite3
import uuid
from datetime import datetime, timedelta
import hashlib

# Исправлено: __name__ вместо name
app = Flask(__name__, template_folder='frontend/templates', static_folder='frontend')
app.secret_key = 'super_secret_key_island_manuscripts'
CORS(app)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
DB_NAME = 'database.db'

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    
    # 1. Таблица пользователей
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'author',
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 2. Таблица заявок (submissions)
    # Мы используем DROP TABLE IF EXISTS, чтобы гарантированно сбросить старую неверную структуру
    # В реальном продакшене так делать нельзя, но для разработки это最快ший способ исправить ошибку колонок
    c.execute('DROP TABLE IF EXISTS submissions')
    
    c.execute('''
        CREATE TABLE submissions (
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
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    # 3. Таблица книг
    c.execute('''
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            author TEXT,
            genre TEXT,
            cover_image TEXT,
            description TEXT
        )
    ''')

    # Создание админа, если нет
    c.execute('SELECT count(*) FROM users WHERE role = "admin"')
    if c.fetchone()[0] == 0:
        admin_pass = hashlib.sha256('admin123'.encode()).hexdigest()
        c.execute('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
                  ('Admin', 'admin@island.com', admin_pass, 'admin'))
        print("Создан администратор: login=admin@island.com, pass=admin123")

    # Заполнение книг, если пусто
    c.execute('SELECT count(*) FROM books')
    if c.fetchone()[0] == 0:
        books = [
            ('Whispers of the Archipelago', 'Elena Voss', 'Fiction', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400', 'Mystery.'),
            ('The Inkwell Diaries', 'Lucas Frye', 'Non-Fiction', 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400', 'Memoirs.'),
            ('Ocean of Words', 'Sarah Lin', 'Poetry', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400', 'Poems.')
        ]
        c.executemany('INSERT INTO books (title, author, genre, cover_image, description) VALUES (?, ?, ?, ?, ?)', books)
    
    conn.commit()
    conn.close()
    print("База данных инициализирована успешно.")

# Инициализируем БД при старте
init_db()

def update_user_activity(email):
    try:
        conn = get_db()
        c = conn.cursor()
        c.execute('UPDATE users SET last_seen = ? WHERE email = ?', (datetime.now(), email))
        conn.commit()
        conn.close()
    except Exception:
        pass

def get_online_users_count():
    try:
        conn = get_db()
        c = conn.cursor()
        threshold = datetime.now() - timedelta(minutes=5)
        c.execute('SELECT count(*) FROM users WHERE last_seen > ?', (threshold,))
        count = c.fetchone()[0]
        conn.close()
        return count
    except Exception:
        return 0

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

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not all([username, email, password]):
        return jsonify({'error': 'Заполните все поля'}), 400

    pwd_hash = hashlib.sha256(password.encode()).hexdigest()

    conn = get_db()
    c = conn.cursor()
    try:
        c.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', 
                  (username, email, pwd_hash))
        conn.commit()
        return jsonify({'success': True, 'message': 'Регистрация успешна! Войдите.'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Пользователь с таким Email уже существует'}), 400
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    pwd_hash = hashlib.sha256(password.encode()).hexdigest()

    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE email = ? AND password_hash = ?', (email, pwd_hash))
    user = c.fetchone()
    conn.close()

    if user:
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
        return jsonify({'error': 'Неверный логин или пароль'}), 401

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/submit', methods=['POST'])
def submit_manuscript():
    # Получаем данные из формы
    title = request.form.get('manuscript_title')
    author_name = request.form.get('author_name')
    email = request.form.get('email')
    phone = request.form.get('phone')
    genre = request.form.get('genre')
    volume = request.form.get('volume')
    text_link = request.form.get('text_link')
    comment = request.form.get('comment')
    file = request.files.get('file')

    # Валидация
    if not title or not email or not author_name:
        return jsonify({'error': 'Заполните обязательные поля (Имя, Email, Название)'}), 400

    sub_id = str(uuid.uuid4())
    filename = ''

    # Сохранение файла
    if file and file.filename:
        filename = f"{sub_id}_{file.filename}"
        file.save(os.path.join(UPLOAD_FOLDER, filename))

    conn = get_db()
    c = conn.cursor()
    
    # Исправленный SQL запрос (без лишних пробелов)
    c.execute('''
        INSERT INTO submissions (id, user_id, author_name, email, phone, manuscript_title, genre, volume, text_link, comment, filename) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (sub_id, session.get('user_id'), author_name, email, phone, title, genre, volume, text_link, comment, filename))
    
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Рукопись отправлена!'})

@app.route('/api/my-submissions')
def get_my_submissions():
    if 'user_id' not in session:
        return jsonify([]), 401
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM submissions WHERE user_id = ? ORDER BY submitted_at DESC', (session['user_id'],))
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@app.route('/api/books')
def get_books():
    genre = request.args.get('genre')
    search = request.args.get('search', '')
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

    c.execute(query, params)
    return jsonify([dict(row) for row in c.fetchall()])

@app.route('/api/admin/stats')
def admin_stats():
    if not session.get('user_role') == 'admin':
        return jsonify({'error': 'Access denied'}), 403
    conn = get_db()
    c = conn.cursor()

    c.execute('SELECT count(*) FROM users')
    total_users = c.fetchone()[0]

    online_users = get_online_users_count()

    c.execute('SELECT count(*) FROM submissions')
    total_subs = c.fetchone()[0]

    conn.close()

    return jsonify({
        'total_users': total_users,
        'online_users': online_users,
        'total_submissions': total_subs
    })

@app.route('/api/admin/all-submissions')
def admin_all_submissions():
    if not session.get('user_role') == 'admin':
        return jsonify({'error': 'Access denied'}), 403
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        SELECT s.*, u.username, u.email 
        FROM submissions s 
        LEFT JOIN users u ON s.user_id = u.id 
        ORDER BY s.submitted_at DESC
    ''')
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@app.route('/api/admin/update-status', methods=['POST'])
def admin_update_status():
    if not session.get('user_role') == 'admin':
        return jsonify({'error': 'Access denied'}), 403
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute('UPDATE submissions SET status = ? WHERE id = ?', (data['status'], data['id']))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/admin/download/<filename>')
def admin_download(filename):
    if not session.get('user_role') == 'admin':
        return jsonify({'error': 'Access denied'}), 403
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)

if __name__ == '__main__':
    print("Сервер запущен: http://127.0.0.1:5000")
    print("Админ: admin@island.com / pass=admin123")
    app.run(debug=True)