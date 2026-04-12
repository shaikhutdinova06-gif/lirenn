import time
import random

def calc_degradation(points):
    """Вычисляет деградацию для каждой точки с учётом времени"""
    result = []
    
    now = time.time()
    
    for p in points:
        # Деградация = 1 - здоровье
        degradation = 1 - p.get("health", 0.5)
        
        # Добавляем временной фактор (старение данных)
        age = now - p.get("timestamp", now)
        time_factor = age * 0.000001  # очень маленький коэффициент
        
        total_degradation = min(1.0, degradation + time_factor)
        
        result.append({
            "lat": p.get("lat", 0),
            "lon": p.get("lon", 0),
            "deg": round(total_degradation, 2),
            "timestamp": p.get("timestamp", now)
        })
    
    return result

def generate_sample_points():
    """Генерирует примерные точки для карты деградации с временными метками"""
    points = []
    
    now = time.time()
    
    # Генерируем точки по России
    for lat in range(40, 70, 2):
        for lon in range(20, 180, 5):
            # Случайное здоровье (для демо)
            health = random.uniform(0.3, 0.9)
            
            # Случайная временная метка (от 0 до 30 дней назад)
            timestamp = now - random.uniform(0, 30 * 24 * 60 * 60)
            
            points.append({
                "lat": lat,
                "lon": lon,
                "health": health,
                "timestamp": timestamp
            })
    
    return points

def get_degradation_trend(points, lat, lon, radius=5):
    """Получает тренд деградации для конкретной области"""
    nearby = []
    
    for p in points:
        if abs(p["lat"] - lat) < radius and abs(p["lon"] - lon) < radius:
            nearby.append(p)
    
    if not nearby:
        return []
    
    # Сортируем по времени
    nearby.sort(key=lambda x: x.get("timestamp", 0))
    
    # Вычисляем деградацию во времени
    trend = []
    for p in nearby:
        deg = 1 - p.get("health", 0.5)
        trend.append({
            "timestamp": p.get("timestamp", time.time()),
            "degradation": round(deg, 2)
        })
    
    return trend
