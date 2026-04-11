from fastapi import APIRouter, UploadFile, Form
from backend.services.ai_model import predict
from backend.services.soil_map import get_soil_type
from backend.services.soil_health import soil_health

router = APIRouter()

@router.post("/analyze")
async def analyze(file: UploadFile, lat: float = Form(...), lon: float = Form(...)):
    ai_type, conf = predict(file)
    map_type = get_soil_type(lat, lon)
    match = ai_type == map_type
    health = soil_health(map_type, 6.5)

    return {
        "ai": ai_type,
        "confidence": conf,
        "map": map_type,
        "match": match,
        "health": health,
        "lat": lat,
        "lon": lon
    }
