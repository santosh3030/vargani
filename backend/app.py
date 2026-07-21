import psycopg2
import psycopg2.extras
import random
import os
import hashlib
from flask import Flask, render_template, jsonify, request, session, redirect, url_for
from flask_cors import CORS

base_dir = os.path.abspath(os.path.dirname(__file__))
frontend_dir = os.path.join(base_dir, '..', 'frontend')

app = Flask(__name__,
            template_folder=os.path.join(frontend_dir, 'templates'),
            static_folder=os.path.join(frontend_dir, 'static'))
app.secret_key = 'rambaugchi_matarni_2026_key_secret'

# --- CORS & Session Config ---
CORS(app, supports_credentials=True)
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True

# --- Database Config ---
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://localhost/vargani')

def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL)
    return conn

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def init_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Create flats table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS flats (
                flat_no TEXT PRIMARY KEY,
                floor INTEGER NOT NULL,
                owner_name TEXT,
                is_paid INTEGER DEFAULT 0,
                amount_paid REAL DEFAULT 0.0,
                payment_date TEXT,
                receipt_no TEXT,
                received_by TEXT,
                bhandara_items TEXT
            )
        ''')
        conn.commit()

        # Safely add columns if they don't exist (for older databases)
        columns_to_add = [
            ("received_by", "TEXT"),
            ("bhandara_items", "TEXT")
        ]
        
        for col_name, col_type in columns_to_add:
            cursor.execute('''
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='flats' AND column_name=%s
            ''', (col_name,))
            if not cursor.fetchone():
                cursor.execute(f'ALTER TABLE flats ADD COLUMN {col_name} {col_type}')
                conn.commit()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                flat_no TEXT,
                role TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS karykartas (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                position TEXT NOT NULL,
                flat_no TEXT,
                photo_base64 TEXT,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS journey (
                year INTEGER PRIMARY KEY,
                image_base64 TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()

        # Insert default flats
        cursor.execute('SELECT COUNT(*) FROM flats')
        count = cursor.fetchone()[0]
        if count == 0:
            total_floors = 7
            flats_per_floor = 24
            flats_to_insert = []
            for floor in range(0, total_floors + 1):
                for flat in range(1, flats_per_floor + 1):
                    flat_no = f"{floor}{str(flat).zfill(2)}"
                    flats_to_insert.append((flat_no, floor, '', 0, 0.0, None, None, None))
            
            cursor.executemany('''
                INSERT INTO flats (flat_no, floor, owner_name, is_paid, amount_paid, payment_date, receipt_no, received_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', flats_to_insert)
            conn.commit()

        # Insert default admin user
        cursor.execute('SELECT * FROM users WHERE email = %s', ('admin@vargani.com',))
        admin = cursor.fetchone()
        if not admin:
            cursor.execute('''
                INSERT INTO users (name, email, password, role)
                VALUES (%s, %s, %s, %s)
            ''', ('Admin', 'admin@vargani.com', hash_password('admin123'), 'admin'))
            conn.commit()
        
        cursor.close()
        conn.close()
    except Exception as e:
        import traceback
        print("Database initialization skipped or failed:", e)
        traceback.print_exc()

init_db()

# --- Page Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin_page():
    if session.get('role') != 'admin':
        return redirect(url_for('index'))
    return render_template('admin.html')

@app.route('/user')
def user_page():
    if session.get('role') != 'user':
        return redirect(url_for('index'))
    return render_template('user.html')

# --- Authentication API ---
@app.route('/api/health', methods=['GET'])
def api_health():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'database': 'connected'})
    except Exception as e:
        return jsonify({'status': 'error', 'database': 'disconnected', 'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not email or not password:
        return jsonify({'success': False, 'message': 'Email and password are required'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cursor.execute('SELECT * FROM users WHERE email = %s', (email,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if not user or user['password'] != hash_password(password):
        return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
    
    session['role'] = user['role']
    session['user'] = user['name']
    session['email'] = user['email']
    if user['flat_no']:
        session['flatNo'] = user['flat_no']
    
    return jsonify({
        'success': True,
        'role': user['role'],
        'name': user['name'],
        'flatNo': user['flat_no']
    })

@app.route('/api/quick-status', methods=['POST'])
def api_quick_status():
    data = request.json or {}
    flat_no = data.get('flatNo', '').strip()
    
    if not flat_no:
        return jsonify({'success': False, 'message': 'Flat number is required'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cursor.execute('SELECT * FROM flats WHERE flat_no = %s', (flat_no,))
    flat = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if not flat:
        return jsonify({'success': False, 'message': 'Invalid flat number'}), 404
        
    return jsonify({
        'success': True,
        'flatNo': flat['flat_no'],
        'ownerName': flat['owner_name'],
        'isPaid': bool(flat['is_paid']),
        'amount': flat['amount_paid']
    })

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    flat_no = data.get('flatNo', '').strip()
    
    if not name or not email or not password:
        return jsonify({'success': False, 'message': 'Name, email and password are required'}), 400
    
    if len(password) < 4:
        return jsonify({'success': False, 'message': 'Password must be at least 4 characters'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('SELECT * FROM users WHERE email = %s', (email,))
    existing = cursor.fetchone()
    if existing:
        cursor.close()
        conn.close()
        return jsonify({'success': False, 'message': 'An account with this email already exists'}), 409
    
    if flat_no:
        cursor.execute('SELECT * FROM flats WHERE flat_no = %s', (flat_no,))
        flat = cursor.fetchone()
        if not flat:
            cursor.close()
            conn.close()
            return jsonify({'success': False, 'message': 'Invalid flat number'}), 400
    
    cursor.execute('''
        INSERT INTO users (name, email, password, flat_no, role)
        VALUES (%s, %s, %s, %s, %s)
    ''', (name, email, hash_password(password), flat_no if flat_no else None, 'user'))
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Account created successfully! Please sign in.'})

@app.route('/api/reset-password', methods=['POST'])
def api_reset_password():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    flat_no = data.get('flatNo', '').strip()
    new_password = data.get('newPassword', '')
    
    if not email or not flat_no or not new_password:
        return jsonify({'success': False, 'message': 'Email, flat number and new password are required'}), 400
        
    if len(new_password) < 4:
        return jsonify({'success': False, 'message': 'Password must be at least 4 characters'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cursor.execute('SELECT * FROM users WHERE email = %s AND flat_no = %s', (email, flat_no))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        conn.close()
        return jsonify({'success': False, 'message': 'Invalid email or flat number combination'}), 404
        
    cursor.execute('UPDATE users SET password = %s WHERE email = %s AND flat_no = %s', (hash_password(new_password), email, flat_no))
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Password reset successfully!'})

@app.route('/api/logout', methods=['POST', 'GET'])
def api_logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/session', methods=['GET'])
def api_session():
    if 'role' in session:
        return jsonify({
            'loggedIn': True,
            'role': session['role'],
            'flatNo': session.get('flatNo'),
            'user': session.get('user'),
            'email': session.get('email')
        })
    return jsonify({'loggedIn': False})

import base64
import os

@app.route('/api/admin/logo', methods=['POST'])
def api_admin_logo():
    if 'admin' not in session.get('role', ''):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
    
    data = request.json or {}
    image_b64 = data.get('imageBase64')
    if image_b64:
        try:
            if "," in image_b64:
                header, encoded = image_b64.split(",", 1)
            else:
                encoded = image_b64
            img_data = base64.b64decode(encoded)
            images_dir = os.path.join(app.root_path, 'static', 'images')
            os.makedirs(images_dir, exist_ok=True)
            with open(os.path.join(images_dir, 'logo.png'), 'wb') as f:
                f.write(img_data)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500
    return jsonify({'success': False, 'message': 'No image provided'}), 400


@app.route('/api/user/bhandara', methods=['POST'])
def update_user_bhandara():
    if session.get('role') != 'user':
        return jsonify({'error': 'Unauthorized'}), 403
    
    flat_no = session.get('flatNo')
    if not flat_no:
        return jsonify({'error': 'No flat assigned to user'}), 400

    data = request.json or {}
    items = data.get('items', '').strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE flats 
        SET bhandara_items = %s
        WHERE flat_no = %s
    ''', (items, flat_no))
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Bhandara donation updated'})

@app.route('/api/admin/bhandara', methods=['POST'])
def add_admin_bhandara():
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
        
    data = request.json or {}
    flat_no = data.get('flatNo', '').strip()
    items = data.get('items', '').strip()
    
    if not flat_no or not items:
        return jsonify({'error': 'Flat number and items are required'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE flats 
        SET bhandara_items = %s
        WHERE flat_no = %s
    ''', (items, flat_no))
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Donation added successfully'})

# --- Flat Management API ---
@app.route('/api/flats', methods=['GET'])
def get_flats():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cursor.execute('SELECT * FROM flats')
    flats = cursor.fetchall()
    cursor.close()
    conn.close()
    
    result = []
    for f in flats:
        result.append({
            'flatNo': f['flat_no'],
            'floor': f['floor'],
            'ownerName': f['owner_name'] or '',
            'isPaid': bool(f['is_paid']),
            'amountPaid': f['amount_paid'] or 0.0,
            'paymentDate': f['payment_date'],
            'receiptNo': f['receipt_no'],
            'receivedBy': f['received_by'] or '',
            'bhandaraItems': f['bhandara_items'] or ''
        })
    return jsonify(result)

@app.route('/api/flats/<flat_no>', methods=['GET'])
def get_flat(flat_no):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cursor.execute('SELECT * FROM flats WHERE flat_no = %s', (flat_no,))
    f = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if not f:
        return jsonify({'error': 'Flat not found'}), 404
        
    return jsonify({
        'flatNo': f['flat_no'],
        'floor': f['floor'],
        'ownerName': f['owner_name'] or '',
        'isPaid': bool(f['is_paid']),
        'amountPaid': f['amount_paid'] or 0.0,
        'paymentDate': f['payment_date'],
        'receiptNo': f['receipt_no'],
        'receivedBy': f['received_by'] or '',
        'bhandaraItems': f['bhandara_items'] or ''
    })

@app.route('/api/flats/<flat_no>', methods=['POST'])
def update_flat_api(flat_no):
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
        
    data = request.json or {}
    owner_name = data.get('ownerName', '').strip()
    is_paid = bool(data.get('isPaid', False))
    amount_paid = float(data.get('amountPaid', 0.0)) if is_paid else 0.0
    payment_date = data.get('paymentDate') if is_paid else None
    received_by = data.get('receivedBy', '').strip() if is_paid else None
    bhandara_items = data.get('bhandaraItems', '').strip()
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cursor.execute('SELECT receipt_no FROM flats WHERE flat_no = %s', (flat_no,))
    existing = cursor.fetchone()
    existing_receipt = existing['receipt_no'] if existing else None
    
    receipt_no = None
    if is_paid:
        receipt_no = data.get('receiptNo')
        if not receipt_no:
            receipt_no = existing_receipt
        if not receipt_no:
            import time
            receipt_no = f"RMV-2026-{flat_no}-{int(time.time()) % 10000}"

    cursor.execute('''
        UPDATE flats 
        SET owner_name = %s, is_paid = %s, amount_paid = %s, payment_date = %s, receipt_no = %s, received_by = %s, bhandara_items = %s
        WHERE flat_no = %s
    ''', (owner_name, int(is_paid), amount_paid, payment_date, receipt_no, received_by, bhandara_items, flat_no))
    conn.commit()
    
    cursor.execute('SELECT * FROM flats WHERE flat_no = %s', (flat_no,))
    updated = cursor.fetchone()
    cursor.close()
    conn.close()
    
    return jsonify({
        'flatNo': updated['flat_no'],
        'floor': updated['floor'],
        'ownerName': updated['owner_name'] or '',
        'isPaid': bool(updated['is_paid']),
        'amountPaid': updated['amount_paid'] or 0.0,
        'paymentDate': updated['payment_date'],
        'receiptNo': updated['receipt_no'],
        'receivedBy': updated['received_by'] or ''
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT COUNT(*) FROM flats')
        total = cursor.fetchone()[0]
        cursor.execute('SELECT COUNT(*) FROM flats WHERE is_paid = 1')
        paid = cursor.fetchone()[0]
        unpaid = total - paid
        cursor.execute('SELECT SUM(amount_paid) FROM flats')
        amount = cursor.fetchone()[0] or 0.0
        
        return jsonify({
            'total': total,
            'paid': paid,
            'unpaid': unpaid,
            'totalAmount': amount
        })
    finally:
        cursor.close()
        conn.close()

# ---- Karykartas API ----
@app.route('/api/karykartas', methods=['GET'])
def get_karykartas():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cursor.execute('SELECT * FROM karykartas ORDER BY id ASC')
        karykartas = cursor.fetchall()
        result = []
        for k in karykartas:
            result.append({
                'id': k['id'],
                'name': k['name'],
                'position': k['position'],
                'flatNo': k['flat_no'],
                'photoBase64': k['photo_base64'],
                'details': k['details']
            })
        return jsonify(result)
    finally:
        cursor.close()
        conn.close()

@app.route('/api/karykartas', methods=['POST'])
def add_karykarta():
    if session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
    data = request.json
    name = data.get('name')
    position = data.get('position')
    flat_no = data.get('flatNo')
    photo_base64 = data.get('photoBase64')
    details = data.get('details')
    
    if not name or not position:
        return jsonify({'success': False, 'message': 'Name and Position are required'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO karykartas (name, position, flat_no, photo_base64, details)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        ''', (name, position, flat_no, photo_base64, details))
        new_id = cursor.fetchone()[0]
        conn.commit()
        return jsonify({'success': True, 'id': new_id})
    finally:
        cursor.close()
        conn.close()

@app.route('/api/karykartas/<int:id>', methods=['DELETE'])
def delete_karykarta(id):
    if session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM karykartas WHERE id = %s', (id,))
        conn.commit()
        return jsonify({'success': True})
    finally:
        cursor.close()
        conn.close()

@app.route('/api/journey', methods=['GET'])
def get_journey():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cursor.execute('SELECT * FROM journey ORDER BY year ASC')
        journey = cursor.fetchall()
        result = []
        for j in journey:
            result.append({
                'year': j['year'],
                'imageBase64': j['image_base64']
            })
        return jsonify(result)
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/journey', methods=['POST'])
def update_journey():
    if session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
    data = request.json
    year = data.get('year')
    image_base64 = data.get('imageBase64')
    
    if not year or not image_base64:
        return jsonify({'success': False, 'message': 'Year and Image are required'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO journey (year, image_base64)
            VALUES (%s, %s)
            ON CONFLICT (year) DO UPDATE SET image_base64 = EXCLUDED.image_base64
        ''', (year, image_base64))
        conn.commit()
        return jsonify({'success': True})
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
