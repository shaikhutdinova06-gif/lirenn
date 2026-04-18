import json
import os
FILE = "data/points.json"
def save_point(point):
    if not os.path.exists(FILE):
        with open(FILE, "w") as f:
            json.dump([], f)
    with open(FILE, "r+") as f:
        data = json.load(f)
        data.append(point)
        f.seek(0)
        json.dump(data, f, indent=2)
def get_points():
    if not os.path.exists(FILE):
        return []
    with open(FILE) as f:
        return json.load(f)
