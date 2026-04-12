from backend.services.degradation_model import calculate_degradation, calculate_recovery, estimate_time_to_critical

def predict_future(health, pollution_type, periods=12, mode="degradation"):
    """
    Прогноз будущего состояния почвы
    
    health: текущее здоровье (0-1)
    pollution_type: тип загрязнения
    periods: количество периодов (месяцев)
    mode: "degradation" или "recovery"
    
    Возвращает: список значений здоровья для каждого периода
    """
    if mode == "degradation":
        return calculate_degradation(health, pollution_type, periods)
    elif mode == "recovery":
        return calculate_recovery(health, pollution_type, periods)
    else:
        return [health] * periods

def predict_with_intervention(health, pollution_type, intervention_type, periods=12):
    """
    Прогноз с учётом вмешательства
    
    health: текущее здоровье (0-1)
    pollution_type: тип загрязнения
    intervention_type: тип вмешательства (fertilizer, liming, irrigation, drainage)
    periods: количество периодов
    
    Возвращает: список значений здоровья для каждого периода
    """
    # Эффективность вмешательств
    intervention_effects = {
        "fertilizer": 0.08,      # Удобрения
        "liming": 0.06,         # Известкование
        "irrigation": 0.05,     # Орошение
        "drainage": 0.04,       # Дренаж
        "none": 0.0             # Без вмешательства
    }
    
    effect = intervention_effects.get(intervention_type, 0.0)
    rate = degradation_rate(pollution_type) - effect
    
    future = []
    h = health
    
    for i in range(periods):
        h -= rate
        h = max(0, min(1, h))  # Ограничиваем 0-1
        future.append(round(h, 3))
    
    return future

def degradation_rate(pollution_type):
    """Вспомогательная функция для скорости деградации"""
    rates = {
        "chemical": 0.1,
        "heavy_metals": 0.15,
        "organic": 0.05,
        "salt": 0.08,
        "oil": 0.12,
        "clean": 0.01
    }
    return rates.get(pollution_type, 0.05)

def get_prediction_summary(health, pollution_type):
    """
    Возвращает сводку прогноза
    
    health: текущее здоровье (0-1)
    pollution_type: тип загрязнения
    
    Возвращает: dict с прогнозом degradation, recovery и временем до критического состояния
    """
    degradation = calculate_degradation(health, pollution_type, 12)
    recovery = calculate_recovery(health, pollution_type, 12)
    time_to_critical = estimate_time_to_critical(health, pollution_type)
    
    return {
        "degradation": degradation,
        "recovery": recovery,
        "time_to_critical_months": time_to_critical,
        "current_health": health,
        "pollution_type": pollution_type
    }
