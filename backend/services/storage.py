import json
import time
import os

FILE = "points.json"

def save_point(data):
    """Сохраняет точку в points.json"""
    try:
        with open(FILE) as f:
            points = json.load(f)
    except:
        points = []
    
    data["timestamp"] = time.time()
    points.append(data)
    
    with open(FILE, "w") as f:
        json.dump(points, f)

def get_points():
    """Загружает все точки из points.json"""
    try:
        with open(FILE) as f:
            return json.load(f)
    except:
        return []

def get_user_points(user_id=None):
    """Загружает точки пользователя (если указан user_id)"""
    points = get_points()
    if user_id:
        return [p for p in points if p.get("user_id") == user_id]
    return points

def delete_point(timestamp):
    """Удаляет точку по timestamp"""
    points = get_points()
    points = [p for p in points if p.get("timestamp") != timestamp]
    
    with open(FILE, "w") as f:
        json.dump(points, f)

def clear_all():
    """Очищает все точки (для тестов)"""
    with open(FILE, "w") as f:
        json.dump([], f)
