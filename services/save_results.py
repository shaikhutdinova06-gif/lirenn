import json, os
from datetime import datetime

FILE = "data/contamination.json"

def save(lat, lon, result):

    if not os.path.exists(FILE):
        data = []
    else:
        with open(FILE) as f:
            data = json.load(f)

    data.append({
        "lat": lat,
        "lon": lon,
        "result": result,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })

    with open(FILE, "w") as f:
        json.dump(data, f, indent=2)
