from fastapi import APIRouter, UploadFile, Form
from backend.services.hybrid_ai import hybrid_predict
from backend.services.soil_health import soil_health
from backend.services.auto_train import save_for_training
from backend.services.pollution import detect_pollution
from backend.services.surface_diagnostics import get_surface_diagnosis
from backend.services.science_rules import get_soil_description
import cv2
import numpy as np
import time

router = APIRouter()

@router.post("/analyze")
async def analyze(file: UploadFile, lat: float = Form(...), lon: float = Form(...)):
    # Читаем файл один раз
    contents = await file.read()
    
    # Гибридное предсказание (нужно сбросить позицию файла)
    file.file.seek(0)
    ai_type, map_type, conf, valid = hybrid_predict(file, lat, lon)
    
    # Детекция загрязнений
    npimg = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    pollution = detect_pollution(img)
    
    # Диагностика по поверхности
    surface_diag, surface_conf = get_surface_diagnosis(img)
    
    # Здоровье почвы
    health = soil_health(map_type, 6.5)
    
    # Научное описание
    description = get_soil_description(ai_type)
    
    # Совпадение
    match = (ai_type == map_type) and valid
    
    # Автообучение если совпадение и высокая уверенность
    if match and conf > 0.85:
        file.file.seek(0)
        save_for_training(file, ai_type)

    return {
        "ai": ai_type,
        "map": map_type,
        "confidence": round(conf, 2),
        "match": match,
        "valid": valid,
        "health": round(health, 2),
        "pollution": pollution,
        "surface_diagnosis": surface_diag,
        "surface_confidence": round(surface_conf, 2),
        "description": description,
        "lat": lat,
        "lon": lon,
        "timestamp": time.time()
    }
