import rasterio
import requests
import numpy as np
import os
from rasterio.transform import from_bounds
import json

print("Creating sample soil data for testing...")

# Create a simple test soil map for demonstration
# This creates a sample GeoTIFF with different soil types

# Define bounds for a test area (example: small region)
bounds = (-180, -85, 180, 85)  # World bounds
width, height = 360, 180  # Low resolution for testing

# Create sample soil data (1-14 representing different soil types)
soil_data = np.random.randint(1, 15, (height, width), dtype=np.uint8)

# Create transform
transform = from_bounds(*bounds, width, height)

# Create the GeoTIFF
output_path = './gis/soil_data/soil_map.tif'
os.makedirs('./gis/soil_data', exist_ok=True)

with rasterio.open(
    output_path,
    'w',
    driver='GTiff',
    height=height,
    width=width,
    count=1,
    dtype=soil_data.dtype,
    crs='EPSG:4326',
    transform=transform,
    compress='DEFLATE'
) as dst:
    dst.write(soil_data, 1)

print(f"Created sample soil data: {output_path}")
print("This is test data for demonstration purposes.")
print("For real data, you would need to download from SoilGrids manually.")

# Also create a simple ML model placeholder
import torch
import torch.nn as nn

def create_simple_model():
    model = nn.Sequential(
        nn.Linear(128*128*3, 128),
        nn.ReLU(),
        nn.Linear(128, 4)
    )
    return model

model = create_simple_model()
torch.save(model.state_dict(), './ml/soil_model.pth')
print("Created placeholder ML model: ./ml/soil_model.pth")

print("\nProject is now ready for testing!")
print("To start the application:")
print("1. cd liren")
print("2. uvicorn backend.main:app --reload")
print("3. Open frontend/index.html in browser")
