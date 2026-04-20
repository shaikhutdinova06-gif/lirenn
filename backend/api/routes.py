from fastapi import APIRouter, Request, HTTPException
from backend.services.block1_logic import process_block1
from backend.services.storage import get_user_points, get_points, get_user_annotations, get_user_data, initialize_test_location, delete_user_point
from backend.services.ai_model import deepseek_classify
from math import radians, cos, sin, sqrt, asin
import json
import os
import traceback
router = APIRouter()

# Инициализация тестового местоположения при запуске
@router.on_event("startup")
async def startup_event():
    initialize_test_location()

def get_client_ip(request: Request):
    """Получить IP адрес клиента"""
    # Проверяем различные заголовки для получения реального IP
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    return request.client.host if request.client else "unknown"

@router.post("/classify-image")
async def classify_image(request: Request):
    """Классификация изображения: почва или не почва"""
    data = await request.json()
    image = data.get("image")
    
    if not image:
        return {"classification": "not_soil"}
    
    classification = await deepseek_classify(image)
    return {"classification": classification}

@router.post("/block1")
async def block1(request: Request):
    try:
        data = await request.json()
        # Если user_id не передан, используем IP
        if not data.get("user_id"):
            data["user_id"] = get_client_ip(request)
        result = await process_block1(data)
        return result
    except Exception as e:
        print("🔥 ERROR in /block1:", e)
        traceback.print_exc()
        return {
            "error": "internal_error",
            "message": str(e)
        }

@router.get("/points")
async def all_points():
    return get_points()

@router.get("/soil-types")
async def get_soil_types():
    """Получить список типов почв"""
    try:
        soil_types_path = os.path.join(os.path.dirname(__file__), "..", "data", "soil_types.json")
        with open(soil_types_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        return {"soil_types": []}

@router.get("/my-points")
async def my_points(request: Request, user_id: str = None, soil_type: str = None):
    """Получить точки пользователя (по IP или переданному user_id) с фильтрацией по типу почвы"""
    if not user_id:
        user_id = get_client_ip(request)
    
    points = get_user_points(user_id)
    
    if soil_type:
        points = [p for p in points if p.get("soil_type") == soil_type or p.get("report", {}).get("general", {}).get("soil_type") == soil_type]
    
    return points

@router.get("/nearby-points")
async def nearby_points(lat: float, lng: float, radius_km: float = 5):
    points = get_points()
    nearby = []
    for point in points:
        if point.get("lat") and point.get("lng"):
            distance = haversine(lat, lng, point["lat"], point["lng"])
            if distance <= radius_km:
                nearby.append(point)
    return nearby

@router.get("/user-cabinet")
async def user_cabinet(request: Request, user_id: str = None):
    """
    Получить данные личного кабинета пользователя
    """
    if not user_id:
        user_id = get_client_ip(request)
    
    user_data = get_user_data(user_id)
    user_points = get_user_points(user_id)
    
    return {
        "user_id": user_id,
        "points": user_points,
        "annotations": user_data.get("annotations", []),
        "settings": user_data.get("settings", {})
    }

@router.get("/user-annotations")
async def user_annotations_endpoint(request: Request, user_id: str = None):
    """
    Получить пометки пользователя
    """
    if not user_id:
        user_id = get_client_ip(request)
    return get_user_annotations(user_id)

@router.delete("/delete-point")
async def delete_point(request: Request, point_id: str):
    """
    Удалить точку пользователя (только из личного кабинета)
    """
    user_id = get_client_ip(request)
    
    # Проверяем, что точка принадлежит пользователю
    points = get_user_points(user_id)
    point_exists = any(p.get("id") == point_id for p in points)
    
    if not point_exists:
        raise HTTPException(status_code=404, detail="Точка не найдена или не принадлежит вам")
    
    success = delete_user_point(user_id, point_id)
    
    if success:
        return {"status": "ok", "message": "Точка удалена из личного кабинета"}
    else:
        raise HTTPException(status_code=500, detail="Ошибка при удалении точки")

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return R * c
