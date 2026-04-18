def validate_input(data):
    errors = []
    if "user_id" not in data:
        errors.append("user_id обязателен")
    if data.get("ph") is not None:
        try:
            ph = float(data["ph"])
            if ph < 0 or ph > 14:
                errors.append("pH вне диапазона")
        except:
            errors.append("pH должен быть числом")
    if data.get("moisture") is not None:
        try:
            m = float(data["moisture"])
            if m < 0 or m > 100:
                errors.append("влажность вне диапазона")
        except:
            errors.append("влажность должна быть числом")
    if data.get("lat") and (data["lat"] < -90 or data["lat"] > 90):
        errors.append("неверная широта")
    if data.get("lng") and (data["lng"] < -180 or data["lng"] > 180):
        errors.append("неверная долгота")
    return errors
