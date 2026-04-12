from fastapi import APIRouter, UploadFile, Form
from backend.services.ai_model import predict
from backend.services.soil_map import get_soil_type
from backend.services.soil_health import soil_health
from backend.services.auto_train import save_for_training
from backend.services.pollution import detect_pollution
import cv2
import numpy as np

router = APIRouter()

@router.post("/analyze")
async def analyze(file: UploadFile, lat: float = Form(...), lon: float = Form(...)):
    ai_type, conf = predict(file)
    map_type = get_soil_type(lat, lon)
    match = ai_type == map_type
    health = soil_health(map_type, 6.5)
    
    # Детекция загрязнений
    contents = file.file.read()
    npimg = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    pollution = detect_pollution(img)
    
    # Автообучение если совпадение и высокая уверенность
    if match and conf > 0.8:
        file.file.seek(0)  # сбросить позицию файла
        save_for_training(file, ai_type)

    return {
        "ai": ai_type,
        "confidence": conf,
        "map": map_type,
        "match": match,
        "health": health,
        "pollution": pollution,
        "lat": lat,
        "lon": lon
    }
