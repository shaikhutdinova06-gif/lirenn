# ========================================
# LIRENN MAP v2 - Russian Soil Data Setup (Windows PowerShell)
# ========================================
# This script downloads and imports real Russian soil data from NSIDC

Write-Host "🌍 LIRENN MAP v2 - Russian Soil Data Setup" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "❌ ERROR: DATABASE_URL environment variable not set" -ForegroundColor Red
    Write-Host "Usage: `$env:DATABASE_URL='postgresql://user:pass@host:port/db'; .\setup-russia-soils.ps1" -ForegroundColor Yellow
    exit 1
}

# Create data directory
Write-Host "📁 Creating data directory..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "data\soils" | Out-Null

# Check for required tools
Write-Host "🔍 Checking required tools..." -ForegroundColor Cyan

# Check for wget
$wgetExists = Get-Command wget -ErrorAction SilentlyContinue
if (-not $wgetExists) {
    Write-Host "❌ wget not found. Please install:" -ForegroundColor Red
    Write-Host "   Download from: https://eternallybored.org/misc/wget/" -ForegroundColor Yellow
    Write-Host "   Or use: choco install wget" -ForegroundColor Yellow
    exit 1
}

# Check for unzip
$unzipExists = Get-Command unzip -ErrorAction SilentlyContinue
if (-not $unzipExists) {
    Write-Host "❌ unzip not found. Please install:" -ForegroundColor Red
    Write-Host "   Download from: https://infozip.sourceforge.net/UnZip.html" -ForegroundColor Yellow
    Write-Host "   Or use: choco install unzip" -ForegroundColor Yellow
    exit 1
}

# Check for ogr2ogr
$ogr2ogrExists = Get-Command ogr2ogr -ErrorAction SilentlyContinue
if (-not $ogr2ogrExists) {
    Write-Host "❌ ogr2ogr not found. Please install GDAL:" -ForegroundColor Red
    Write-Host "   Windows: https://gisinternals.com/release.php" -ForegroundColor Yellow
    Write-Host "   Or use: choco install gdal" -ForegroundColor Yellow
    exit 1
}

# Download Russian Soil Data from NSIDC
Write-Host "📥 Downloading Russian Soil Data from NSIDC..." -ForegroundColor Cyan
wget -r -nH --cut-dirs=4 -A "*.zip" ftp://sidads.colorado.edu/pub/DATASETS/fgdc/ggd601_russia_soil_maps/ -P data/soils/

Write-Host "✅ Download complete" -ForegroundColor Green

# Extract all zip files
Write-Host "📦 Extracting files..." -ForegroundColor Cyan
Get-ChildItem -Path data\soils -Filter *.zip -Recurse | ForEach-Object {
    Write-Host "Extracting: $($_.Name)" -ForegroundColor Gray
    Expand-Archive -Path $_.FullName -DestinationPath data\soils -Force
}

# Find the soil classification shapefile
Write-Host "🔍 Finding soil classification shapefile..." -ForegroundColor Cyan
$soilShp = Get-ChildItem -Path data\soils -Filter *.shp -Recurse | Where-Object { $_.Name -match "soil|class" } | Select-Object -First 1

if (-not $soilShp) {
    Write-Host "⚠️  No soil classification shapefile found, using first available shapefile" -ForegroundColor Yellow
    $soilShp = Get-ChildItem -Path data\soils -Filter *.shp -Recurse | Select-Object -First 1
}

if (-not $soilShp) {
    Write-Host "❌ ERROR: No shapefile found" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Found shapefile: $($soilShp.FullName)" -ForegroundColor Cyan

# Import to PostGIS
Write-Host "🗄️  Importing to PostGIS..." -ForegroundColor Cyan
$env:PGPASSWORD = $env:DATABASE_URL.Split('@')[-1]
ogr2ogr -f "PostgreSQL" `
    PG:"$env:DATABASE_URL" `
    "$($soilShp.FullName)" `
    -nln soil_zones `
    -lco GEOMETRY_NAME=geom `
    -nlt MULTIPOLYGON `
    -a_srs EPSG:4326 `
    -overwrite

Write-Host "✅ Import complete" -ForegroundColor Green

# Create spatial index
Write-Host "🔧 Creating spatial index..." -ForegroundColor Cyan
$env:PGPASSWORD = $env:DATABASE_URL.Split('@')[-1]
psql $env:DATABASE_URL -c "CREATE INDEX IF NOT EXISTS soil_zones_geom_idx ON soil_zones USING GIST (geom);"

Write-Host "✅ Spatial index created" -ForegroundColor Green

# Verify import
Write-Host "🔍 Verifying import..." -ForegroundColor Cyan
$env:PGPASSWORD = $env:DATABASE_URL.Split('@')[-1]
psql $env:DATABASE_URL -c "SELECT COUNT(*) as total_zones FROM soil_zones;"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "✅ Russian soil data setup complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "Total soil zones imported to database"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart your backend service"
Write-Host "2. Check https://your-backend.onrender.com/debug/db"
Write-Host "3. Test the map at https://your-frontend.onrender.com"
