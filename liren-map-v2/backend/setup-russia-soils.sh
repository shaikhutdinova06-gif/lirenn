#!/bin/bash

# ========================================
# LIRENN MAP v2 - Russian Soil Data Setup
# ========================================
# This script downloads and imports real Russian soil data from NSIDC

set -e

echo "🌍 LIRENN MAP v2 - Russian Soil Data Setup"
echo "============================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    echo "Usage: DATABASE_URL=postgresql://user:pass@host:port/db ./setup-russia-soils.sh"
    exit 1
fi

# Create data directory
echo "📁 Creating data directory..."
mkdir -p data/soils

# Check for required tools
echo "🔍 Checking required tools..."
if ! command -v wget &> /dev/null; then
    echo "❌ wget not found. Installing..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y wget
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install wget
    else
        echo "❌ Please install wget manually"
        exit 1
    fi
fi

if ! command -v unzip &> /dev/null; then
    echo "❌ unzip not found. Installing..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get install -y unzip
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install unzip
    else
        echo "❌ Please install unzip manually"
        exit 1
    fi
fi

if ! command -v ogr2ogr &> /dev/null; then
    echo "❌ ogr2ogr not found. Installing GDAL..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y gdal-bin
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install gdal
    else
        echo "❌ Please install GDAL manually"
        echo "   Windows: https://gisinternals.com/release.php"
        exit 1
    fi
fi

# Download Russian Soil Data from NSIDC
echo "📥 Downloading Russian Soil Data from NSIDC..."
wget -r -nH --cut-dirs=4 -A "*.zip" ftp://sidads.colorado.edu/pub/DATASETS/fgdc/ggd601_russia_soil_maps/ -P data/soils/

echo "✅ Download complete"

# Extract all zip files
echo "📦 Extracting files..."
find data/soils/ -name "*.zip" -exec unzip -o {} -d data/soils/ \;

# Find the soil classification shapefile
echo "🔍 Finding soil classification shapefile..."
SOIL_SHP=$(find data/soils/ -name "*.shp" | grep -i "soil\|class" | head -n 1)

if [ -z "$SOIL_SHP" ]; then
    echo "⚠️  No soil classification shapefile found, using first available shapefile"
    SOIL_SHP=$(find data/soils/ -name "*.shp" | head -n 1)
fi

if [ -z "$SOIL_SHP" ]; then
    echo "❌ ERROR: No shapefile found"
    exit 1
fi

echo "📄 Found shapefile: $SOIL_SHP"

# Import to PostGIS
echo "🗄️  Importing to PostGIS..."
ogr2ogr -f "PostgreSQL" \
    PG:"$DATABASE_URL" \
    "$SOIL_SHP" \
    -nln soil_zones \
    -lco GEOMETRY_NAME=geom \
    -nlt MULTIPOLYGON \
    -a_srs EPSG:4326 \
    -overwrite

echo "✅ Import complete"

# Create spatial index
echo "🔧 Creating spatial index..."
PGPASSWORD="${DATABASE_URL##*@}" psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS soil_zones_geom_idx ON soil_zones USING GIST (geom);"

echo "✅ Spatial index created"

# Verify import
echo "🔍 Verifying import..."
PGPASSWORD="${DATABASE_URL##*@}" psql "$DATABASE_URL" -c "SELECT COUNT(*) as total_zones FROM soil_zones;"

echo ""
echo "============================================"
echo "✅ Russian soil data setup complete!"
echo "============================================"
echo "Total soil zones imported to database"
echo ""
echo "Next steps:"
echo "1. Restart your backend service"
echo "2. Check https://your-backend.onrender.com/debug/db"
echo "3. Test the map at https://your-frontend.onrender.com"
