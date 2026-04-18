#!/bin/bash

echo "🌍 Importing Russia Soil Data to PostGIS..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable not set"
    echo "Usage: DATABASE_URL=postgresql://user:pass@host:port/db ./import-russia-soils.sh"
    exit 1
fi

# Install ogr2ogr if not available
if ! command -v ogr2ogr &> /dev/null; then
    echo "ogr2ogr not found. Installing GDAL..."
    # For Ubuntu/Debian
    sudo apt-get update && sudo apt-get install -y gdal-bin
    # For macOS
    # brew install gdal
fi

# Find the shapefile in data/soils/
SHAPEFILE=$(find data/soils/ -name "*.shp" | head -n 1)

if [ -z "$SHAPEFILE" ]; then
    echo "ERROR: No shapefile found in data/soils/"
    echo "Please run download-russia-soils.sh first"
    exit 1
fi

echo "Found shapefile: $SHAPEFILE"

# Import to PostGIS
echo "Importing to PostGIS..."
ogr2ogr -f "PostgreSQL" \
    PG:"$DATABASE_URL" \
    "$SHAPEFILE" \
    -nln soil_zones \
    -lco GEOMETRY_NAME=geom \
    -nlt MULTIPOLYGON \
    -a_srs EPSG:4326 \
    -overwrite

echo "✅ Import complete!"
echo "Table 'soil_zones' created in PostGIS"

# Create spatial index
echo "Creating spatial index..."
PGPASSWORD="${DATABASE_URL##*@}" psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS soil_zones_geom_idx ON soil_zones USING GIST (geom);"

echo "✅ Spatial index created"
