def calculate_zc(pollutants):
    if not pollutants:
        return 0
    total = 0
    for p in pollutants:
        ci = p.get("value", 0)
        cbi = p.get("background", 1)
        
        # Проверяем на None и 0
        if ci is None:
            ci = 0
        if cbi is None or cbi == 0:
            cbi = 1
            
        total += ci / cbi
    return total - (len(pollutants) - 1)
