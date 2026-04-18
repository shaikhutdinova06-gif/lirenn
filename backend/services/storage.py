import json
import os

FILE = "data/points.json"

def save_point(point):
    if not os.path.exists(FILE):
        with open(FILE, "w") as f:
            json.dump([], f)
    with open(FILE, "r") as f:
        data = json.load(f)
    data.append(point)
    with open(FILE, "w") as f:
        json.dump(data, f, indent=2)

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
