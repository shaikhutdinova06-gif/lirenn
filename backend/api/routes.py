from fastapi import APIRouter, UploadFile, File, Form
import shutil, uuid, os, json

from services.soil_analysis import analyze_soil_image
from services.texture_analysis import analyze_texture
from services.anomaly_detection import detect_anomaly
from services.contamination_detection import detect_contamination
from services.save_results import save
from gis.soil_map_service import get_soil_type

router = APIRouter()

@router.post("/analyze")
async def analyze(file: UploadFile = File(...), lat: float = Form(...), lon: float = Form(...)):

    filename = f"{uuid.uuid4()}.jpg"

    with open(filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    color = analyze_soil_image(filename)
    texture = analyze_texture(filename)
    anomaly = detect_anomaly(color)
    contamination = detect_contamination(filename)

    soil = get_soil_type(lat, lon)

    save(lat, lon, contamination)

    os.remove(filename)

    return {
        "map_soil": soil["name"],
        "ai": color,
        "texture": texture,
        "anomaly": anomaly,
        "contamination": contamination
    }


@router.get("/map")
def get_map():

    if not os.path.exists("data/contamination.json"):
        return []

    with open("data/contamination.json") as f:
        return json.load(f)


@router.get("/report")
def get_report():

    if not os.path.exists("data/contamination.json"):
        return {
            "total": 0,
            "contamination": 0,
            "clean": 0,
            "entries": []
        }

    with open("data/contamination.json") as f:
        data = json.load(f)

    contamination = sum(1 for item in data if item.get("result") == "загрязнение")
    clean = len(data) - contamination
    entries = list(reversed(data))[:20]

    return {
        "total": len(data),
        "contamination": contamination,
        "clean": clean,
        "entries": entries
    }
