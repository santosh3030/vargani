import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Update ground floor flats from 1, 2... to 001, 002...
cursor.execute("SELECT flat_no FROM flats WHERE floor = 0")
flats = cursor.fetchall()
for (flat_no,) in flats:
    if flat_no.isdigit() and len(flat_no) < 3:
        new_flat_no = f"0{flat_no.zfill(2)}"
        
        # Update the flats table
        cursor.execute("UPDATE flats SET flat_no = ? WHERE flat_no = ?", (new_flat_no, flat_no))
        # Update users table if anyone registered
        cursor.execute("UPDATE users SET flat_no = ? WHERE flat_no = ?", (new_flat_no, flat_no))

conn.commit()
print("Ground floor flats updated to 001, 002... 024")
conn.close()
