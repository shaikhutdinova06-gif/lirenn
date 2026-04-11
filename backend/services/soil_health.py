def soil_health(soil, ph):

    ph_score = max(0, 1 - abs(ph - 6.5)/3)

    soil_score = {
        "chernozem": 1,
        "podzolic": 0.5
    }.get(soil, 0.6)

    return round((ph_score + soil_score)/2, 2)
