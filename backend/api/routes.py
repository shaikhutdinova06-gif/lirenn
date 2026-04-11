from fastapi import APIRouter, UploadFile, Form
from backend.services.ai_model import predict
from backend.services.soil_map import get_soil_type

router = APIRouter()

@router.post("/analyze")
async def analyze(file: UploadFile, lat: float = Form(...), lon: float = Form(...)):
    ai_type, conf = predict(file)
    map_type = get_soil_type(lat, lon)

    return {
        "ai": ai_type,
        "confidence": conf,
        "map": map_type,
        "match": ai_type == map_type
    }
