# Физико-химическая модель почв
# На основе научных данных для разных типов почв

SOIL_DB = {
    "chernozem": {
        "ph": (6.5, 7.5),          # pH (кислотность)
        "humus": (6, 12),          # Гумус, %
        "moisture": (20, 40),      # Влажность, %
        "nitrogen": (0.15, 0.35),  # Азот, %
        "phosphorus": (0.1, 0.25), # Фосфор, %
        "potassium": (1.5, 3.0),   # Калий, %
        "bulk_density": (1.0, 1.3) # Плотность, г/см³
    },
    "podzolic": {
        "ph": (4.0, 5.5),
        "humus": (1, 4),
        "moisture": (10, 30),
        "nitrogen": (0.05, 0.15),
        "phosphorus": (0.02, 0.1),
        "potassium": (0.5, 1.5),
        "bulk_density": (1.3, 1.6)
    },
    "gray_forest": {
        "ph": (5.5, 6.5),
        "humus": (3, 6),
        "moisture": (15, 35),
        "nitrogen": (0.1, 0.25),
        "phosphorus": (0.05, 0.15),
        "potassium": (1.0, 2.0),
        "bulk_density": (1.2, 1.5)
    },
    "gley": {
        "ph": (5.0, 6.0),
        "humus": (2, 5),
        "moisture": (25, 45),
        "nitrogen": (0.08, 0.2),
        "phosphorus": (0.03, 0.12),
        "potassium": (0.8, 1.8),
        "bulk_density": (1.1, 1.4)
    },
    "chestnut": {
        "ph": (7.0, 8.5),
        "humus": (2, 5),
        "moisture": (10, 25),
        "nitrogen": (0.08, 0.18),
        "phosphorus": (0.05, 0.15),
        "potassium": (1.2, 2.5),
        "bulk_density": (1.3, 1.6)
    },
    "tundra_gley": {
        "ph": (4.5, 5.5),
        "humus": (1, 3),
        "moisture": (30, 50),
        "nitrogen": (0.05, 0.12),
        "phosphorus": (0.02, 0.08),
        "potassium": (0.5, 1.2),
        "bulk_density": (0.8, 1.2)
    }
}

def get_soil_parameters(soil_type):
    """Возвращает нормальные параметры для типа почвы"""
    return SOIL_DB.get(soil_type, {})

def is_parameter_normal(soil_type, param_name, value):
    """Проверяет, находится ли параметр в норме"""
    params = get_soil_parameters(soil_type)
    if param_name not in params:
        return True  # Если параметр неизвестен, считаем нормальным
    
    min_val, max_val = params[param_name]
    return min_val <= value <= max_val

def calculate_health_from_parameters(soil_type, real_data):
    """
    Рассчитывает здоровье почвы на основе реальных данных
    
    real_data: dict с параметрами (ph, humus, moisture, nitrogen, phosphorus, potassium)
    """
    params = get_soil_parameters(soil_type)
    if not params:
        return 0.5  # Неизвестный тип почвы
    
    score = 0
    count = 0
    
    for param, (min_val, max_val) in params.items():
        if param in real_data:
            value = real_data[param]
            # Проверяем, находится ли в норме
            if min_val <= value <= max_val:
                score += 1
            else:
                # Штраф за отклонение
                deviation = min(abs(value - min_val), abs(value - max_val))
                score += max(0, 1 - deviation / 10)
            count += 1
    
    if count == 0:
        return 0.5
    
    return score / count
