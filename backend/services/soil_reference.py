# Эталонные характеристики почв РФ
SOIL_REFERENCE = {
    "чернозем": {
        "ph": 6.5,
        "humus": 4.0,
        "nitrogen": 0.3,
        "phosphorus": 45,
        "potassium": 120
    },
    "подзол": {
        "ph": 4.5,
        "humus": 1.5,
        "nitrogen": 0.1,
        "phosphorus": 15,
        "potassium": 60
    },
    "серая лесная": {
        "ph": 5.5,
        "humus": 2.5,
        "nitrogen": 0.2,
        "phosphorus": 25,
        "potassium": 80
    },
    "каштановая": {
        "ph": 7.5,
        "humus": 2.0,
        "nitrogen": 0.15,
        "phosphorus": 20,
        "potassium": 70
    },
    "солонец": {
        "ph": 8.5,
        "humus": 1.8,
        "nitrogen": 0.12,
        "phosphorus": 18,
        "potassium": 65
    },
    "болотная": {
        "ph": 3.5,
        "humus": 8.0,
        "nitrogen": 0.4,
        "phosphorus": 10,
        "potassium": 30
    },
    "дерново-подзолистая": {
        "ph": 5.0,
        "humus": 2.0,
        "nitrogen": 0.15,
        "phosphorus": 20,
        "potassium": 75
    }
}

def get_reference(soil_name):
    """Получить эталонные характеристики по названию почвы"""
    if not soil_name:
        return None
    
    soil_name_lower = soil_name.lower()
    
    # Ищем точное совпадение
    for key, ref in SOIL_REFERENCE.items():
        if key in soil_name_lower:
            return ref
    
    # Ищем частичные совпадения
    for key, ref in SOIL_REFERENCE.items():
        if any(word in soil_name_lower for word in key.split()):
            return ref
    
    return None

def calculate_deviation(current_data, reference):
    """Рассчитать отклонения от эталона"""
    if not reference:
        return None
    
    deviation = {}
    
    # Рассчитываем отклонения для каждого параметра
    for param in ["ph", "humus", "nitrogen", "phosphorus", "potassium"]:
        if param in current_data and current_data[param] is not None and param in reference:
            diff = current_data[param] - reference[param]
            deviation[f"{param}_diff"] = round(diff, 2)
            
            # Рассчитываем процентное отклонение
            if reference[param] != 0:
                percent = (diff / reference[param]) * 100
                deviation[f"{param}_percent"] = round(percent, 1)
    
    return deviation if deviation else None

def get_soil_quality_score(deviation):
    """Оценка качества почвы по отклонениям от эталона"""
    if not deviation:
        return 50  # Средняя оценка если нет данных
    
    score = 100
    count = 0
    
    # Учитываем только процентные отклонения
    for key, value in deviation.items():
        if key.endswith("_percent"):
            # Чем больше отклонение, тем ниже оценка
            score -= min(abs(value), 50)  # Ограничиваем максимальное снижение
            count += 1
    
    if count > 0:
        score = max(0, min(100, score / count))
    else:
        score = 50
    
    return round(score, 0)

def get_recommendations(deviation, soil_type):
    """Получить рекомендации по улучшению почвы"""
    if not deviation:
        return ["Недостаточно данных для рекомендаций"]
    
    recommendations = []
    
    # Рекомендации по pH
    if "ph_percent" in deviation:
        ph_diff = deviation["ph_percent"]
        if ph_diff < -10:
            recommendations.append("pH ниже нормы - рекомендуется известкование")
        elif ph_diff > 10:
            recommendations.append("pH выше нормы - рекомендуется внесение серы или кислых удобрений")
    
    # Рекомендации по гумусу
    if "humus_percent" in deviation:
        humus_diff = deviation["humus_percent"]
        if humus_diff < -20:
            recommendations.append("Низкое содержание гумуса - рекомендуется внесение органических удобрений")
        elif humus_diff > 20:
            recommendations.append("Высокое содержание гумуса - хороший показатель")
    
    # Рекомендации по азоту
    if "nitrogen_percent" in deviation:
        n_diff = deviation["nitrogen_percent"]
        if n_diff < -30:
            recommendations.append("Дефицит азота - рекомендуется внесение азотных удобрений")
        elif n_diff > 30:
            recommendations.append("Высокое содержание азота - контролировать дозы")
    
    # Рекомендации по фосфору
    if "phosphorus_percent" in deviation:
        p_diff = deviation["phosphorus_percent"]
        if p_diff < -30:
            recommendations.append("Дефицит фосфора - рекомендуется внесение фосфорных удобрений")
    
    # Рекомендации по калию
    if "potassium_percent" in deviation:
        k_diff = deviation["potassium_percent"]
        if k_diff < -30:
            recommendations.append("Дефицит калия - рекомендуется внесение калийных удобрений")
    
    if not recommendations:
        recommendations.append("Показатели в пределах нормы")
    
    return recommendations
