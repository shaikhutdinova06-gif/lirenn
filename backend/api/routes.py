from fastapi import APIRouter, UploadFile, Form
import time
import logging

# Опциональные импорты для AI сервисов
try:
    from backend.services.hybrid_ai import hybrid_predict
    from backend.services.soil_health import soil_health
    from backend.services.auto_train import save_for_training
    from backend.services.pollution import detect_pollution
    from backend.services.surface_diagnostics import get_surface_diagnosis
    from backend.services.science_rules import get_soil_description
    import cv2
    import numpy as np
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    logging.warning("AI services not available (cv2/numpy missing). Using fallback mode.")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/analyze")
async def analyze(file: UploadFile, lat: float = Form(...), lon: float = Form(...)):
    logger.info(f"Starting analysis for lat={lat}, lon={lon}")
    
    if not AI_AVAILABLE:
        # Fallback режим без AI
        logger.info("Using fallback mode (no AI services)")
        return {
            "ai": "unknown",
            "map": "unknown",
            "confidence": 0.5,
            "match": False,
            "valid": False,
            "health": 0.5,
            "pollution": "clean",
            "surface_diagnosis": "Не удалось определить (AI недоступен)",
            "surface_confidence": 0.0,
            "description": "Анализ по фото недоступен. Используйте ручной ввод параметров.",
            "lat": lat,
            "lon": lon,
            "timestamp": time.time()
        }
    
    try:
        # Читаем файл один раз
        contents = await file.read()
        logger.info(f"File read: {len(contents)} bytes")
        
        # Гибридное предсказание (нужно сбросить позицию файла)
        file.file.seek(0)
        ai_type, map_type, conf, valid = hybrid_predict(file, lat, lon)
        logger.info(f"Hybrid predict: ai={ai_type}, map={map_type}, conf={conf}")
        
        # Детекция загрязнений
        npimg = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
        
        if img is None:
            logger.error("Failed to decode image")
            return {"error": "Failed to decode image"}
        
        pollution = detect_pollution(img)
        logger.info(f"Pollution: {pollution}")
        
        # Диагностика по поверхности
        surface_diag, surface_conf = get_surface_diagnosis(img)
        logger.info(f"Surface: {surface_diag}, conf={surface_conf}")
        
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

        result = {
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
        
        logger.info(f"Analysis complete: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Error in analysis: {e}", exc_info=True)
        return {"error": str(e)}
