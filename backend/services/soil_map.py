def get_soil_type(lat, lon):
    # временно
    if lat > 55:
        return "podzolic"
    return "chernozem"
