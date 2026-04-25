import json
import os
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
