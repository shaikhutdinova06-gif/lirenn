import numpy as np

# Правила цветов почв из научного определителя
SOIL_COLOR_HINTS = {
    "chernozem": np.array([60, 60, 60]),      # Темно-серый с бурым оттенком
    "podzolic": np.array([200, 200, 200]),    # Белесый
    "gray_forest": np.array([138, 138, 138]), # Серый
    "gley": np.array([169, 178, 195]),        # Сизые, голубые
    "chestnut": np.array([180, 140, 100]),    # Палевый
    "tundra_gley": np.array([120, 130, 140])   # Тундровый глей
}

def match_color(avg_color):
    """Определяет тип почвы по среднему цвету"""
    best = None
    min_dist = 9999
    
    for soil, ref in SOIL_COLOR_HINTS.items():
        dist = np.sum((avg_color - ref) ** 2)
        if dist < min_dist:
            min_dist = dist
            best = soil
    
    return best

def get_confidence(avg_color, predicted_soil):
    """Вычисляет уверенность в предсказании на основе близости цвета"""
    ref = SOIL_COLOR_HINTS.get(predicted_soil, np.array([100, 100, 100]))
    dist = np.sqrt(np.sum((avg_color - ref) ** 2))
    max_dist = 300  # максимальное возможное расстояние
    confidence = max(0.5, 1 - (dist / max_dist))
    return round(confidence, 2)
