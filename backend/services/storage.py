import json
import os
import uuid
FILE = "/data/points.json"
os.makedirs("/data", exist_ok=True)
def get_points():
    if not os.path.exists(FILE):
        return []
    with open(FILE) as f:
        return json.load(f)
def save_point(point):
    points = get_points()
    points.append(point)
    with open(FILE, "w") as f:
        json.dump(points, f)
def get_user_points(user_id):
    return [p for p in get_points() if p.get("user_id") == user_id]
def get_user_data(user_id):
    return {"annotations": [], "settings": {}}
def initialize_test_location():
    pass
def delete_user_point(user_id, point_id):
    points = get_points()
    points = [p for p in points if not (p.get("id") == point_id and p.get("user_id") == user_id)]
    with open(FILE, "w") as f:
        json.dump(points, f)
    return True
