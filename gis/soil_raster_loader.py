import rasterio

RASTER = "gis/soil_data/soil_map.tif"
ds = None

def load():
    global ds
    if ds is None:
        ds = rasterio.open(RASTER)
    return ds
