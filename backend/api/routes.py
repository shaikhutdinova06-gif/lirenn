from fastapi import APIRouter, UploadFile, Form, Request
from backend.services.soil_health import soil_health
from backend.services.pollution import detect_pollution
from backend.services.surface_diagnostics import get_surface_diagnosis
from backend.services.science_rules import get_soil_description
from backend.services.block1_logic import process_block1
import cv2
import numpy as np
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/analyze")
async def analyze(file: UploadFile, lat: float = Form(...), lon: float = Form(...)):
    logger.info(f"Starting analysis for lat={lat}, lon={lon}")
    
    try:
        # Читаем файл
        contents = await file.read()
        logger.info(f"File read: {len(contents)} bytes")
        
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
        
        # Научное описание (по умолчанию чернозём)
        ai_type = "chernozem"
        description = get_soil_description(ai_type)
        
        # Здоровье почвы
        health = soil_health(ai_type, 6.5)
        
        result = {
            "ai": ai_type,
            "map": ai_type,
            "confidence": 0.5,
            "match": True,
            "valid": True,
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

@router.post("/block1")
async def block1(request: Request):
    data = await request.json()
    return process_block1(data)
