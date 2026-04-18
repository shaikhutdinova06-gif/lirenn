# Russian Soil Data Setup for LIRENN MAP v2

This guide explains how to load real Russian soil data from the NSIDC dataset into your LIRENN MAP v2 application.

## Prerequisites

### Required Tools

**For Linux/Mac:**
- wget
- unzip
- ogr2ogr (GDAL)
- psql (PostgreSQL client)

**For Windows:**
- wget (https://eternallybored.org/misc/wget/ or `choco install wget`)
- unzip (https://infozip.sourceforge.net/UnZip.html or `choco install unzip`)
- ogr2ogr (https://gisinternals.com/release.php or `choco install gdal`)
- psql (PostgreSQL client)

### Environment Variables

Set your `DATABASE_URL`:
```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
```

For Windows PowerShell:
```powershell
$env:DATABASE_URL = "postgresql://user:password@host:port/database"
```

## Quick Setup

### Linux/Mac

```bash
cd liren-map-v2/backend
chmod +x setup-russia-soils.sh
export DATABASE_URL="postgresql://user:password@host:port/database"
./setup-russia-soils.sh
```

### Windows PowerShell

```powershell
cd liren-map-v2\backend
$env:DATABASE_URL = "postgresql://user:password@host:port/database"
.\setup-russia-soils.ps1
```

## What the Script Does

1. **Downloads** Russian soil data from NSIDC (NSIDC ggd601 dataset)
2. **Extracts** the shapefiles from zip archives
3. **Imports** the soil classification data into PostGIS
4. **Creates** spatial indexes for performance
5. **Verifies** the import by counting soil zones

## Data Source

The data comes from the **Land Resources of Russia Soil Maps** dataset:
- Source: NSIDC (National Snow and Ice Data Center)
- Dataset: ggd601
- Scale: 1:2,500,000
- Coverage: All of Russia
- Format: ESRI Shapefile

## Manual Steps (If Script Fails)

### 1. Download Data

**Using wget:**
```bash
wget -r -nH --cut-dirs=4 -A "*.zip" ftp://sidads.colorado.edu/pub/DATASETS/fgdc/ggd601_russia_soil_maps/
```

**Using FTP client:**
- Host: sidads.colorado.edu
- Path: /pub/DATASETS/fgdc/ggd601_russia_soil_maps/
- Download all .zip files

### 2. Extract Files

```bash
unzip *.zip
```

### 3. Import to PostGIS

```bash
ogr2ogr -f "PostgreSQL" \
    PG:"$DATABASE_URL" \
    soil_classification.shp \
    -nln soil_zones \
    -lco GEOMETRY_NAME=geom \
    -nlt MULTIPOLYGON \
    -a_srs EPSG:4326 \
    -overwrite
```

### 4. Create Spatial Index

```bash
psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS soil_zones_geom_idx ON soil_zones USING GIST (geom);"
```

## Verification

Check the import:
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM soil_zones;"
```

Check via API:
```
https://your-backend.onrender.com/debug/db
```

## Troubleshooting

### FTP Connection Issues
If FTP download fails, try:
- Using a different FTP client (FileZilla)
- Downloading during off-peak hours
- Checking your network connection

### ogr2ogr Errors
- Ensure GDAL is installed correctly
- Check DATABASE_URL format
- Verify the shapefile path

### Permission Errors
- Ensure you have write permissions to the data directory
- Check PostGIS extension is enabled in your database

## Alternative: Use Sample Data

If you cannot download the full dataset, the application includes sample soil zones for testing. The sample data includes:
- Chernozem (чернозём)
- Podzol (подзолистая почва)
- Gray forest soil (серая лесная почва)

To use sample data, simply deploy the application without running the setup script.

## Next Steps

After importing real data:

1. **Restart your backend service** on Render
2. **Verify data**: Check `/debug/db` endpoint
3. **Test the map**: Open your frontend application
4. **Toggle soil zones**: Click the "Почвенные зоны" button

## Support

For issues with the NSIDC dataset:
- NSIDC User Services: nsidc@nsidc.org
- Dataset documentation: https://nsidc.org/data/ggd601/versions/1

For LIRENN MAP issues:
- Check the main README.md
- Review logs on Render
- Test with sample data first
