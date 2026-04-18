#!/bin/bash

echo "🌍 Downloading Russia Soil Dataset..."

# Create data directory
mkdir -p data/soils

# Download Land Resources of Russia Soil Maps via FTP
# Source: https://nsidc.org/data/ggd601
echo "Downloading Russian Soil Shapefile from NSIDC FTP..."
wget -r -nH --cut-dirs=4 -A "*.zip" ftp://sidads.colorado.edu/pub/DATASETS/fgdc/ggd601_russia_soil_maps/ -P data/soils/

# Find and extract the main soil map file
echo "Extracting..."
find data/soils/ -name "*.zip" -exec unzip -o {} -d data/soils/ \;

echo "✅ Download complete!"
echo "Shapefile location: data/soils/"
echo "Note: This downloads the full NSIDC Russian soil dataset which contains multiple soil characteristic maps."
