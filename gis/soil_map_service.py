from gis.soil_raster_loader import load
from data.soil_types import SOILS

def normalize(v):

    mapping = {
        1:"chernozem",2:"phaeozem",3:"kastanozem",
        4:"luvisol",5:"alfisol",6:"cambisol",
        7:"podzol",8:"arenosol",9:"gleysol",
        10:"histosol",11:"regosol",12:"leptosol",
        13:"solonchak",14:"solonetz"
    }

    return mapping.get(int(v),"unknown")

def get_soil_type(lat, lon):

    ds = load()

    try:
        row, col = ds.index(lon, lat)
        val = ds.read(1)[row, col]

        key = normalize(val)

        return SOILS.get(key, {"name":"Unknown"})

    except:
        return {"name":"Unknown"}
