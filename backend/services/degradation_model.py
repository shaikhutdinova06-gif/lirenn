# Научная модель деградации почв
# Каждое загрязнение влияет по-разному

def degradation_rate(pollution_type):
    """
    Возвращает скорость деградации для типа загрязнения
    
    pollution_type: тип загрязнения (chemical, heavy_metals, organic, clean)
    
    Возвращает: скорость деградации за период (0-1)
    """
    rates = {
        "chemical": 0.1,      # Химическое загрязнение - высокая деградация
        "heavy_metals": 0.15, # Тяжёлые металлы - очень высокая деградация
        "organic": 0.05,      # Органическое - умеренная деградация
        "salt": 0.08,         # Солевое - высокая деградация
        "oil": 0.12,          # Нефтяное - высокая деградация
        "clean": 0.01         # Чистая почва - минимальная деградация
    }
    
    return rates.get(pollution_type, 0.05)

def calculate_degradation(health, pollution_type, periods=12):
    """
    Рассчитывает деградацию здоровья почвы за период
    
    health: текущее здоровье (0-1)
    pollution_type: тип загрязнения
    periods: количество периодов (месяцев)
    
    Возвращает: список значений здоровья для каждого периода
    """
    rate = degradation_rate(pollution_type)
    
    future = []
    h = health
    
    for i in range(periods):
        h -= rate
        h = max(0, h)  # Здоровье не может быть ниже 0
        future.append(round(h, 3))
    
    return future

def calculate_recovery(health, pollution_type, periods=12):
    """
    Рассчитывает восстановление здоровья почвы за период
    
    health: текущее здоровье (0-1)
    pollution_type: тип загрязнения
    periods: количество периодов (месяцев)
    
    Возвращает: список значений здоровья для каждого периода
    """
    # Скорость восстановления зависит от типа загрязнения
    recovery_rates = {
        "chemical": 0.03,
        "heavy_metals": 0.02,
        "organic": 0.05,
        "salt": 0.04,
        "oil": 0.03,
        "clean": 0.06
    }
    
    rate = recovery_rates.get(pollution_type, 0.04)
    
    future = []
    h = health
    
    for i in range(periods):
        h += rate
        h = min(1, h)  # Здоровье не может быть выше 1
        future.append(round(h, 3))
    
    return future

def estimate_time_to_critical(health, pollution_type, threshold=0.3):
    """
    Оценивает время до критического состояния
    
    health: текущее здоровье (0-1)
    pollution_type: тип загрязнения
    threshold: порог критического состояния
    
    Возвращает: количество периодов до критического состояния
    """
    rate = degradation_rate(pollution_type)
    
    if rate == 0:
        return -1  # Никогда не достигнет критического состояния
    
    periods_needed = (health - threshold) / rate
    
    if periods_needed < 0:
        return 0  # Уже в критическом состоянии
    
    return int(periods_needed)
