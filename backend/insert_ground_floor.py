import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check if ground floor exists
cursor.execute('SELECT COUNT(*) FROM flats WHERE floor = 0')
if cursor.fetchone()[0] == 0:
    flats_per_floor = 24
    flats_to_insert = []
    for flat in range(1, flats_per_floor + 1):
        flat_no = f"G{str(flat).zfill(2)}"
        flats_to_insert.append((flat_no, 0, '', 0, 0.0, None, None))

    conn.executemany('''
        INSERT INTO flats (flat_no, floor, owner_name, is_paid, amount_paid, payment_date, receipt_no)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', flats_to_insert)
    conn.commit()
    print("Ground floor added")
else:
    print("Ground floor already exists")
conn.close()
