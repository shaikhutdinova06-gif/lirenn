from backend.services.ai_model import predict as ml_predict
from backend.services.soil_map import get_soil_type
from backend.services.science_rules import validate_soil

def hybrid_predict(file, lat, lon):
    """Гибридная модель: ML + правила карты + научная валидация"""
    
    # ML предсказание
    ai_type, conf = ml_predict(file)
    
    # Карта по координатам
    map_type = get_soil_type(lat, lon)
    
    # Если совпало → усиливаем доверие
    if ai_type == map_type:
        conf = min(1.0, conf + 0.2)
    # Если не совпало → понижаем
    else:
        conf *= 0.5
    
    # Научная валидация
    valid = validate_soil(ai_type, conf)
    
    if not valid:
        conf *= 0.3
    
    return ai_type, map_type, conf, valid
