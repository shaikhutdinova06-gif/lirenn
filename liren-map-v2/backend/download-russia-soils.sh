#!/bin/bash

echo "🌍 Downloading Russia Soil Dataset..."

# Create data directory
mkdir -p data/soils

# Download Land Resources of Russia Soil Maps
# Source: https://nsidc.org/data/ggd601
echo "Downloading Russian Soil Shapefile..."
curl -L -o data/soils/russia_soils.zip "https://nsidc.org/data/ggd601/versions/1/ggd601_soils_russia_shapefile.zip"

# Extract
echo "Extracting..."
unzip -o data/soils/russia_soils.zip -d data/soils/

echo "✅ Download complete!"
echo "Shapefile location: data/soils/"
