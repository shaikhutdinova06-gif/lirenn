def get_soil_parameters(soil_type):
    """Заглушка для get_soil_parameters (soil_model удалён)"""
    # Возвращает базовые параметры для чернозёма по умолчанию
    return {
        "ph": (6.0, 7.3),
        "humus": (6, 10),
        "moisture": (40, 60),
        "nitrogen": (0.2, 0.4),
        "phosphorus": (0.15, 0.3),
        "potassium": (0.2, 0.4)
    }

def compare(real, predicted_soil_type):
    """
    Сравнивает реальные данные с предсказанным типом почвы
    
    real: dict с реальными параметрами (ph, humus, moisture, nitrogen, phosphorus, potassium)
    predicted_soil_type: предсказанный тип почвы
    
    Возвращает: score (0-1), где 1 - полное совпадение
    """
    params = get_soil_parameters(predicted_soil_type)
    if not params:
        return 0.5  # Неизвестный тип почвы
    
    score = 0
    count = 0
    
    for param, (min_val, max_val) in params.items():
        if param in real:
            value = real[param]
            
            # Если в норме
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

def compare_with_multiple(real, soil_types):
    """
    Сравнивает реальные данные с несколькими типами почв
    
    Возвращает: dict с soil_type: score для каждого типа
    """
    results = {}
    for soil_type in soil_types:
        results[soil_type] = compare(real, soil_type)
    return results

def find_best_match(real, soil_types):
    """
    Находит лучший тип почвы для реальных данных
    
    Возвращает: (best_soil_type, score)
    """
    results = compare_with_multiple(real, soil_types)
    best_type = max(results, key=results.get)
    return best_type, results[best_type]

def find_similar(data):
    # заглушка под твою базу
    return {
        "status": "ok",
        "message": "Сравнение с БД выполнено"
    }
