def predict_recovery(soil, current_health, pollution="clean"):
    """Прогноз восстановления почвы с учётом загрязнений"""
    
    growth_rate = {
        "chernozem": 0.05,
        "gray_forest": 0.04,
        "podzolic": 0.03,
        "chestnut": 0.04,
        "gley": 0.02,
        "tundra_gley": 0.01
    }
    
    rate = growth_rate.get(soil, 0.03)
    
    # Корректировка на загрязнение
    pollution_factor = {
        "clean": 1.0,
        "chemical_possible": 0.3,
        "oil_possible": 0.2,
        "debris_or_pollution": 0.5
    }
    
    factor = pollution_factor.get(pollution, 1.0)
    adjusted_rate = rate * factor
    
    future = []
    h = current_health
    
    for i in range(12):  # 12 периодов (год)
        h = min(1.0, h + adjusted_rate)
        future.append(round(h, 2))
    
    return future
