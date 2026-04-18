#!/usr/bin/env python3
"""
Update database schema to add soil_type column
"""

import psycopg2
import os

DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set")
    exit(1)

url_parts = DATABASE_URL.replace('postgresql://', '').split('@')
user_pass = url_parts[0].split(':')
host_db = url_parts[1].split('/')
host_port = host_db[0].split(':')

DB_CONFIG = {
    'host': host_port[0],
    'port': int(host_port[1]) if len(host_port) > 1 else 5432,
    'database': host_db[1],
    'user': user_pass[0],
    'password': user_pass[1] if len(user_pass) > 1 else ''
}

try:
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Add soil_type column if it doesn't exist
    cur.execute("""
        ALTER TABLE soil_zones 
        ADD COLUMN IF NOT EXISTS soil_type TEXT
    """)
    
    # Add soil_name column if it doesn't exist
    cur.execute("""
        ALTER TABLE soil_zones 
        ADD COLUMN IF NOT EXISTS soil_name TEXT
    """)
    
    conn.commit()
    print("✅ Schema updated successfully")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"❌ Error: {e}")
    if 'conn' in locals():
        conn.rollback()
        conn.close()
    exit(1)
