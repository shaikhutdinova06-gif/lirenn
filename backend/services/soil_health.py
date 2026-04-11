def soil_health(soil, ph):

    optimal = {
        "chernozem": 6.5,
        "podzolic": 5.5,
        "tundra_gley": 4.5,
        "gray_forest": 6.0,
        "chestnut": 7.0
    }

    target = optimal.get(soil, 6.5)

    ph_score = max(0, 1 - abs(ph - target)/3)

    fertility = {
        "chernozem": 1,
        "gray_forest": 0.8,
        "podzolic": 0.5,
        "tundra_gley": 0.3,
        "chestnut": 0.7
    }.get(soil, 0.6)

    return round((ph_score + fertility)/2, 2)
