from fastapi import APIRouter
import json
import os
from datetime import datetime
import random

router = APIRouter()

DATA_FILE = "data/points.json"

def load():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE) as f:
        return json.load(f)

def save(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

# ➜ создать точку
@router.post("/point")
def create_point(point: dict):
    data = load()

    point["id"] = len(data) + 1
    point["history"] = []
    point["created"] = datetime.now().isoformat()

    data.append(point)
    save(data)

    return {"status": "ok", "point": point}

# ➜ получить все точки
@router.get("/points")
def get_points():
    return load()

# ➜ симуляция обновления (восстановление)
@router.post("/simulate")
def simulate():
    data = load()

    for p in data:
        last = p.get("state", {
            "ph": p["ph"],
            "moisture": p["moisture"],
            "health": 40
        })

        # влияние погоды (рандом пока)
        rain = random.uniform(0, 1)

        # логика восстановления
        new_health = last["health"] + rain * 5
        new_health = min(new_health, 100)

        new_state = {
            "ph": last["ph"] + random.uniform(-0.1, 0.1),
            "moisture": last["moisture"] + random.uniform(-2, 2),
            "health": new_health,
            "time": datetime.now().isoformat()
        }

        p["state"] = new_state
        p["history"].append(new_state)

    save(data)
    return {"status": "updated"}
