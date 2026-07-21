import sqlite3

conn = sqlite3.connect('database.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [r[0] for r in cursor.fetchall()]

for table in tables:
    print(f"\n========== TABLE: {table.upper()} ==========")
    cursor.execute(f"SELECT * FROM {table} LIMIT 10;")
    rows = cursor.fetchall()
    
    if not rows:
        print(" (No data)")
        continue
        
    keys = rows[0].keys()
    # Print header
    print(" | ".join(keys))
    print("-" * 50)
    # Print rows
    for row in rows:
        print(" | ".join(str(row[k]) for k in keys))

conn.close()
