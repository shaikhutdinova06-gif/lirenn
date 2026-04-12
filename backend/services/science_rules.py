import numpy as np

# Научные правила из "Полевого определителя почв России"

SOIL_COLOR_LIMITS = {
    "chernozem": {"min": 0, "max": 80},      # Темно-серый до черного
    "podzolic": {"min": 180, "max": 255},    # Белесый
    "gray_forest": {"min": 100, "max": 160}, # Серый
    "gley": {"min": 140, "max": 200},        # Сизые, голубые
    "chestnut": {"min": 120, "max": 180},   # Палевый
    "tundra_gley": {"min": 100, "max": 160}  # Тундровый глей
}

SOIL_DEPTH_LIMITS = {
    "chernozem": {"min": 30, "max": 100},    # Мощный гумус
    "podzolic": {"min": 5, "max": 30},       # Тонкий гумус
    "gray_forest": {"min": 10, "max": 40},   # Средний
    "chestnut": {"min": 15, "max": 50},      # Средний
    "tundra_gley": {"min": 5, "max": 20}     # Тонкий
}

def validate_soil(ai_type, confidence):
    """Научная валидация предсказания"""
    
    # Если уверенность слишком низкая - отклоняем
    if confidence < 0.3:
        return False
    
    # Если уверенность высокая - принимаем
    if confidence > 0.9:
        return True
    
    # Для средней уверенности - нужны дополнительные проверки
    return True

def validate_with_features(ai_type, features):
    """Валидация с учётом признаков"""
    
    avg_color = features.get("avg_color", 128)
    
    limits = SOIL_COLOR_LIMITS.get(ai_type)
    if limits:
        if not (limits["min"] <= avg_color <= limits["max"]):
            return False
    
    return True

def get_soil_description(soil_type):
    """Возвращает научное описание типа почвы"""
    
    descriptions = {
        "chernozem": "Темногумусовая почва, мощный гумусовый горизонт (AU), плодородная, характерна для степей",
        "podzolic": "Подзолистая почва, светлый элювиальный горизонт (E), характерна для лесной зоны",
        "gray_forest": "Серая лесная почва, серогумусовый горизонт (AY), переходная между лесом и степью",
        "gley": "Глеевая почва, сизые оттенки, переувлажнённая",
        "chestnut": "Каштановая почва, светлогумусовый горизонт (AJ), сухие степи",
        "tundra_gley": "Тундровая глеевая почва, тонкий гумус, характерна для тундры"
    }
    
    return descriptions.get(soil_type, "Неизвестный тип почвы")
