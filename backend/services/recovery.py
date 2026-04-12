def predict_recovery(soil, current_health):
    """Прогноз восстановления почвы"""
    growth_rate = {
        "chernozem": 0.05,
        "gray_forest": 0.04,
        "podzolic": 0.03,
        "chestnut": 0.04,
        "gley": 0.02,
        "tundra_gley": 0.01
    }
    
    rate = growth_rate.get(soil, 0.03)
    
    future = []
    h = current_health
    
    for i in range(10):  # 10 периодов
        h = min(1.0, h + rate)
        future.append(round(h, 2))
    
    return future
