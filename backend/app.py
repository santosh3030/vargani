import sqlite3
import random
import os
import hashlib
from flask import Flask, render_template, jsonify, request, session, redirect, url_for

base_dir = os.path.abspath(os.path.dirname(__file__))
frontend_dir = os.path.join(base_dir, '..', 'frontend')

app = Flask(__name__,
            template_folder=os.path.join(frontend_dir, 'templates'),
            static_folder=os.path.join(frontend_dir, 'static'))
app.secret_key = 'rambaugchi_matarni_2026_key_secret'
DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def init_db():
    conn = get_db_connection()
    # Create flats table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS flats (
            flat_no TEXT PRIMARY KEY,
            floor INTEGER NOT NULL,
            owner_name TEXT,
            is_paid BOOLEAN DEFAULT 0,
            amount_paid REAL DEFAULT 0.0,
            payment_date TEXT,
            receipt_no TEXT,
            received_by TEXT,
            bhandara_items TEXT
        )
    ''')
    
    # Safely try to add new columns to existing DB
    try:
        conn.execute('ALTER TABLE flats ADD COLUMN received_by TEXT')
    except sqlite3.OperationalError:
        pass # Column likely exists
        
    try:
        conn.execute('ALTER TABLE flats ADD COLUMN bhandara_items TEXT')
    except sqlite3.OperationalError:
        pass # Column likely exists
    # Create users table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            flat_no TEXT,
            role TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.execute('''
        CREATE TABLE IF NOT EXISTS karykartas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            position TEXT NOT NULL,
            flat_no TEXT,
            photo_base64 TEXT,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.execute('''
        CREATE TABLE IF NOT EXISTS journey (
            year INTEGER PRIMARY KEY,
            image_base64 TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()

    # Check if we need to pre-populate flats
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM flats')
    count = cursor.fetchone()[0]
    if count == 0:
        total_floors = 7
        flats_per_floor = 24
        flats_to_insert = []
        for floor in range(0, total_floors + 1):
            for flat in range(1, flats_per_floor + 1):
                flat_no = f"{floor}{str(flat).zfill(2)}"
                flats_to_insert.append((flat_no, floor, '', 0, 0.0, None, None))
        
        conn.executemany('''
            INSERT INTO flats (flat_no, floor, owner_name, is_paid, amount_paid, payment_date, receipt_no, received_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', [(*f, None) for f in flats_to_insert])
        conn.commit()

    # Seed default admin user if not exists
    admin = conn.execute('SELECT * FROM users WHERE email = ?', ('admin@vargani.com',)).fetchone()
    if not admin:
        conn.execute('''
            INSERT INTO users (name, email, password, role)
            VALUES (?, ?, ?, ?)
        ''', ('Admin', 'admin@vargani.com', hash_password('admin123'), 'admin'))
        conn.commit()
    conn.close()

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
@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not email or not password:
        return jsonify({'success': False, 'message': 'Email and password are required'}), 400
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
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
    flat = conn.execute('SELECT * FROM flats WHERE flat_no = ?', (flat_no,)).fetchone()
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
    
    # Check if email already exists
    existing = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({'success': False, 'message': 'An account with this email already exists'}), 409
    
    # Verify flat exists if provided
    if flat_no:
        flat = conn.execute('SELECT * FROM flats WHERE flat_no = ?', (flat_no,)).fetchone()
        if not flat:
            conn.close()
            return jsonify({'success': False, 'message': 'Invalid flat number'}), 400
    
    conn.execute('''
        INSERT INTO users (name, email, password, flat_no, role)
        VALUES (?, ?, ?, ?, ?)
    ''', (name, email, hash_password(password), flat_no if flat_no else None, 'user'))
    conn.commit()
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
    user = conn.execute('SELECT * FROM users WHERE email = ? AND flat_no = ?', (email, flat_no)).fetchone()
    if not user:
        conn.close()
        return jsonify({'success': False, 'message': 'Invalid email or flat number combination'}), 404
        
    conn.execute('UPDATE users SET password = ? WHERE email = ? AND flat_no = ?', (hash_password(new_password), email, flat_no))
    conn.commit()
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
    conn.execute('''
        UPDATE flats 
        SET bhandara_items = ?
        WHERE flat_no = ?
    ''', (items, flat_no))
    conn.commit()
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
    conn.execute('''
        UPDATE flats 
        SET bhandara_items = ?
        WHERE flat_no = ?
    ''', (items, flat_no))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Donation added successfully'})

# --- Flat Management API ---
@app.route('/api/flats', methods=['GET'])
def get_flats():
    conn = get_db_connection()
    flats = conn.execute('SELECT * FROM flats').fetchall()
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
    f = conn.execute('SELECT * FROM flats WHERE flat_no = ?', (flat_no,)).fetchone()
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
    existing = conn.execute('SELECT receipt_no FROM flats WHERE flat_no = ?', (flat_no,)).fetchone()
    existing_receipt = existing['receipt_no'] if existing else None
    
    # Simple receipt number generator if paid and doesn't have one
    receipt_no = None
    if is_paid:
        receipt_no = data.get('receiptNo')
        if not receipt_no:
            receipt_no = existing_receipt
        if not receipt_no:
            import time
            receipt_no = f"RMV-2026-{flat_no}-{int(time.time()) % 10000}"

    conn.execute('''
        UPDATE flats 
        SET owner_name = ?, is_paid = ?, amount_paid = ?, payment_date = ?, receipt_no = ?, received_by = ?, bhandara_items = ?
        WHERE flat_no = ?
    ''', (owner_name, int(is_paid), amount_paid, payment_date, receipt_no, received_by, bhandara_items, flat_no))
    conn.commit()
    
    updated = conn.execute('SELECT * FROM flats WHERE flat_no = ?', (flat_no,)).fetchone()
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
    try:
        total = conn.execute('SELECT COUNT(*) FROM flats').fetchone()[0]
        paid = conn.execute('SELECT COUNT(*) FROM flats WHERE is_paid = 1').fetchone()[0]
        unpaid = total - paid
        amount = conn.execute('SELECT SUM(amount_paid) FROM flats').fetchone()[0] or 0.0
        
        return jsonify({
            'total': total,
            'paid': paid,
            'unpaid': unpaid,
            'totalAmount': amount
        })
    finally:
        conn.close()

# ---- Karykartas API ----
@app.route('/api/karykartas', methods=['GET'])
def get_karykartas():
    conn = get_db_connection()
    try:
        karykartas = conn.execute('SELECT * FROM karykartas ORDER BY id ASC').fetchall()
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
    try:
        cursor = conn.execute('''
            INSERT INTO karykartas (name, position, flat_no, photo_base64, details)
            VALUES (?, ?, ?, ?, ?)
        ''', (name, position, flat_no, photo_base64, details))
        conn.commit()
        return jsonify({'success': True, 'id': cursor.lastrowid})
    finally:
        conn.close()

@app.route('/api/karykartas/<int:id>', methods=['DELETE'])
def delete_karykarta(id):
    if session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
    conn = get_db_connection()
    try:
        conn.execute('DELETE FROM karykartas WHERE id = ?', (id,))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/journey', methods=['GET'])
def get_journey():
    conn = get_db_connection()
    try:
        journey = conn.execute('SELECT * FROM journey ORDER BY year ASC').fetchall()
        result = []
        for j in journey:
            result.append({
                'year': j['year'],
                'imageBase64': j['image_base64']
            })
        return jsonify(result)
    finally:
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
    try:
        conn.execute('''
            REPLACE INTO journey (year, image_base64)
            VALUES (?, ?)
        ''', (year, image_base64))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
