def get_soil_type(lat, lon):

    if lat > 65:
        return "tundra_gley"
    if 58 < lat <= 65:
        return "podzolic"
    if 50 < lat <= 58:
        return "gray_forest"
    if 45 < lat <= 50:
        return "chernozem"
    if lat <= 45:
        return "chestnut"

    return "unknown"
