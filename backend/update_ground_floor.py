import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Update ground floor flats from G01, G02... to 1, 2...
cursor.execute("SELECT flat_no FROM flats WHERE floor = 0")
flats = cursor.fetchall()
for (flat_no,) in flats:
    if flat_no.startswith('G'):
        new_flat_no = str(int(flat_no[1:])) # G01 -> 1, G02 -> 2
        
        # Update the flats table
        cursor.execute("UPDATE flats SET flat_no = ? WHERE flat_no = ?", (new_flat_no, flat_no))
        # Update users table if anyone registered
        cursor.execute("UPDATE users SET flat_no = ? WHERE flat_no = ?", (new_flat_no, flat_no))

conn.commit()
print("Ground floor flats updated to 1, 2, 3... 24")
conn.close()
