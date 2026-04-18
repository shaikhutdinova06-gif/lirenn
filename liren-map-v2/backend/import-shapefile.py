#!/usr/bin/env python3
"""
Import Russian Soil Shapefile to PostGIS
"""

import shapefile
import psycopg2
import os

# Get DATABASE_URL from environment
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set")
    print("Usage: DATABASE_URL=postgresql://user:password@host:port/database python import-shapefile.py")
    exit(1)

# Parse DATABASE_URL
# Format: postgresql://user:password@host:port/database
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

print(f"🌍 Importing Russian Soil Shapefile to PostGIS")
print(f"Database: {DB_CONFIG['database']}")

# Read shapefile
shp_path = 'data/soils/ggd601_soil_russia.shp'
if not os.path.exists(shp_path):
    print(f"ERROR: Shapefile not found at {shp_path}")
    exit(1)

sf = shapefile.Reader(shp_path)
print(f"✅ Shapefile loaded: {len(sf)} records")

# Connect to database
try:
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    print("✅ Connected to database")
    
    # Enable PostGIS
    cur.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    
    # Clear existing data
    cur.execute("DELETE FROM soil_zones")
    print("✅ Cleared existing data")
    
    # Insert records
    inserted = 0
    for i, shape_rec in enumerate(sf.shapeRecords()):
        shape = shape_rec.shape
        record = shape_rec.record
        
        # Get geometry as WKT
        wkt = shape.__geo_interface__
        
        # Get properties from record
        # You may need to adjust field names based on the actual shapefile
        soil_type = str(record[0]) if len(record) > 0 else 'unknown'
        zone_type = str(record[1]) if len(record) > 1 else soil_type
        color = '#10b981'  # Default color
        
        # Convert GeoJSON to PostGIS geometry using ST_GeomFromGeoJSON
        import json
        cur.execute("""
            INSERT INTO soil_zones (soil_type, zone_type, color, geom)
            VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s::text), 4326))
        """, (soil_type, zone_type, color, json.dumps(wkt)))
        
        inserted += 1
        if inserted % 100 == 0:
            print(f"  Progress: {inserted}/{len(sf)}")
    
    conn.commit()
    print(f"✅ Inserted {inserted} soil zones")
    
    # Create spatial index
    cur.execute("CREATE INDEX IF NOT EXISTS soil_zones_geom_idx ON soil_zones USING GIST (geom)")
    print("✅ Spatial index created")
    
    # Verify
    cur.execute("SELECT COUNT(*) FROM soil_zones")
    count = cur.fetchone()[0]
    print(f"✅ Total soil zones in database: {count}")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    if 'conn' in locals():
        conn.rollback()
        conn.close()
    exit(1)

print("\n✅ Import complete!")
