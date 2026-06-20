from osgeo import gdal,ogr,osr
import shutil
import os

# Example bounding box (homolosine) for Ghana - you can modify this for your region
bb = (-337500.000, 1242500.000, 152500.000, 527500.000) 
igh='+proj=igh +lat_0=0 +lon_0=0 +datum=WGS84 +units=m +no_defs' # proj string for Homolosine projection
res=250 

sg_url="/vsicurl?max_retry=3&retry_delay=1&list_dir=no&url=https://files.isric.org/soilgrids/latest/data/"

print("Downloading soil data from SoilGrids...")

# Create GeoTIFF in Homolosine projection
kwargs = {'format': 'GTiff', 'projWin': bb, 'projWinSRS': igh, 'xRes': res, 'yRes': res, 'creationOptions': ["TILED=YES", "COMPRESS=DEFLATE", "PREDICTOR=2", "BIGTIFF=YES"]}

ds = gdal.Translate('./crop_roi_igh_py.tif', 
                    sg_url + 'ocs/ocs_0-30cm_mean.vrt', 
                    **kwargs)
del ds

print("Created Homolosine projection file: crop_roi_igh_py.tif")

# Create local VRT in homologine system
kwargs = {'format': 'VRT', 'projWin': bb, 'projWinSRS': igh, 'xRes': res, 'yRes': res}

ds = gdal.Translate('./crop_roi_igh_py.vrt', 
                    '/vsicurl?max_retry=3&retry_delay=1&list_dir=no&url=https://files.isric.org/soilgrids/latest/data/ocs/ocs_0-30cm_mean.vrt', 
                    **kwargs)
del ds

print("Created VRT file: crop_roi_igh_py.vrt")

# Create VRT in LatLong projection
ds = gdal.Warp('./crop_roi_ll_py.vrt', 
    './crop_roi_igh_py.vrt', 
    dstSRS='EPSG:4326')
del ds

print("Created LatLong VRT: crop_roi_ll_py.vrt")

# Create final GeoTIFF in LatLong projection
kwargs = {'format': 'GTiff', 'creationOptions': ["TILED=YES", "COMPRESS=DEFLATE", "PREDICTOR=2", "BIGTIFF=YES"] }
ds = gdal.Translate('./crop_roi_ll_py.tif',
    './crop_roi_ll_py.vrt', 
    **kwargs)

del ds

print("Created final GeoTIFF: crop_roi_ll_py.tif")

# Move the final file to the GIS directory
os.makedirs('./gis/soil_data/', exist_ok=True)
shutil.move('./crop_roi_ll_py.tif', './gis/soil_data/soil_map.tif')

print("Soil data downloaded and moved to gis/soil_data/soil_map.tif")
print("Ready to use with the LIREN application!")
