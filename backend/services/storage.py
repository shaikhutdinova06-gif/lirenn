import json
import os
import uuid

# Общая база данных (все точки)
DATA_DIR = os.getenv("DATA_DIR", os.path.join(os.getcwd(), "data"))
COMMON_DB = os.path.join(DATA_DIR, "points.json")

# Персональные базы данных (по пользователям)
PERSONAL_DB_DIR = os.path.join(DATA_DIR, "personal")

def ensure_directories():
    """Создать необходимые директории если их нет"""
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(PERSONAL_DB_DIR, exist_ok=True)

def get_user_db_path(user_id):
    """Получить путь к базе данных пользователя"""
    ensure_directories()
    return os.path.join(PERSONAL_DB_DIR, f"{user_id}.json")

def save_point(point):
    """
    Сохранить точку в общую базу (append-only, без перезаписи)
    """
    ensure_directories()
    if not os.path.exists(COMMON_DB):
        with open(COMMON_DB, "w") as f:
            json.dump([], f)
    with open(COMMON_DB, "r+") as f:
        data = json.load(f)
        data.append(point)
        f.seek(0)
        json.dump(data, f, indent=2)

def get_points():
    """
    Получить все точки из общей базы
    """
    ensure_directories()
    if not os.path.exists(COMMON_DB):
        return []
    with open(COMMON_DB) as f:
        return json.load(f)

def get_user_points(user_id=None):
    """
    Получить точки пользователя из общей базы
    """
    points = get_points()
    if user_id:
        return [p for p in points if p.get("user_id") == user_id]
    return points

def save_user_annotation(user_id, annotation):
    """
    Сохранить пометку в персональную базу пользователя (append-only)
    """
    ensure_directories()
    user_db = get_user_db_path(user_id)
    
    if not os.path.exists(user_db):
        with open(user_db, "w") as f:
            json.dump({"annotations": [], "settings": {}}, f)
    
    with open(user_db, "r+") as f:
        data = json.load(f)
        if "annotations" not in data:
            data["annotations"] = []
        data["annotations"].append(annotation)
        f.seek(0)
        json.dump(data, f, indent=2)

def get_user_annotations(user_id):
    """
    Получить пометки пользователя из персональной базы
    """
    ensure_directories()
    user_db = get_user_db_path(user_id)
    
    if not os.path.exists(user_db):
        return []
    
    with open(user_db) as f:
        data = json.load(f)
        return data.get("annotations", [])

def get_user_data(user_id):
    """
    Получить все данные пользователя (персональная база)
    """
    ensure_directories()
    user_db = get_user_db_path(user_id)
    
    if not os.path.exists(user_db):
        return {"annotations": [], "settings": {}}
    
    with open(user_db) as f:
        return json.load(f)

def save_user_settings(user_id, settings):
    """
    Сохранить настройки пользователя
    """
    ensure_directories()
    user_db = get_user_db_path(user_id)
    
    if not os.path.exists(user_db):
        with open(user_db, "w") as f:
            json.dump({"annotations": [], "settings": {}}, f)
    
    with open(user_db, "r+") as f:
        data = json.load(f)
        data["settings"] = settings
        f.seek(0)
        json.dump(data, f, indent=2)

def initialize_test_location():
    """
    Инициализировать тестовое местоположение для демонстрации
    """
    ensure_directories()
    
    # Проверяем, есть ли уже тестовая точка
    points = get_points()
    for point in points:
        if point.get("is_test"):
            return  # Тестовая точка уже существует
    
    # Создаём тестовую точку
    test_point = {
        "id": str(uuid.uuid4()),
        "timestamp": "2024-01-01T00:00:00",
        "user_id": "system_test",
        "lat": 55.7558,
        "lng": 37.6173,
        "ph": 7.0,
        "moisture": 50,
        "notes": "Тестовое местоположение для демонстрации функционала. Чернозём, нормальное состояние.",
        "tags": ["#чернозём", "#тест", "#демонстрация"],
        "color": "green",
        "icon": "sample",
        "image": None,
        "result": {
            "image_check": "no_image",
            "has_user_photo": False,
            "chemistry": {"ph": 7.0, "moisture": 50},
            "geo_analysis": "Москва, Центральная Россия",
            "annotations": {
                "text_notes": "Тестовая точка",
                "symbol": "sample",
                "color": "green",
                "tags": ["#чернозём", "#тест"],
                "has_photo": False
            },
            "state": {
                "has_image": False,
                "has_geo": True,
                "has_chem": True,
                "has_annotations": True,
                "completed": False
            }
        },
        "is_test": True
    }
    
    save_point(test_point)

def delete_user_point(user_id, point_id):
    """
    Удалить точку из общей базы данных полностью
    """
    ensure_directories()
    
    # Проверяем, что точка принадлежит пользователю
    points = get_points()
    point_to_delete = None
    for point in points:
        if point.get("id") == point_id and point.get("user_id") == user_id:
            point_to_delete = point
            break
    
    if not point_to_delete:
        return False
    
    # Удаляем точку из общей базы
    if not os.path.exists(COMMON_DB):
        return False
    
    with open(COMMON_DB, "r+") as f:
        data = json.load(f)
        # Фильтруем точки, удаляя нужную
        data = [p for p in data if p.get("id") != point_id]
        f.seek(0)
        f.truncate()
        json.dump(data, f, indent=2)
    
    return True
