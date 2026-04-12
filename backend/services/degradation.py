def calc_degradation(points):
    """Вычисляет деградацию для каждой точки"""
    result = []
    
    for p in points:
        # Деградация = 1 - здоровье
        degradation = 1 - p.get("health", 0.5)
        
        result.append({
            "lat": p.get("lat", 0),
            "lon": p.get("lon", 0),
            "deg": round(degradation, 2)
        })
    
    return result

def generate_sample_points():
    """Генерирует примерные точки для карты деградации"""
    points = []
    
    # Генерируем точки по России
    for lat in range(40, 70, 2):
        for lon in range(20, 180, 5):
            # Случайное здоровье (для демо)
            import random
            health = random.uniform(0.3, 0.9)
            
            points.append({
                "lat": lat,
                "lon": lon,
                "health": health
            })
    
    return points
