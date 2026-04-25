from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.services.block1_logic import process_block1
from backend.services.storage import get_user_points, get_points, get_user_data, initialize_test_location, delete_user_point
from backend.services.ai_model import deepseek_classify
from backend.services.auth import register_user, authenticate_user, create_access_token, get_current_user
from math import radians, cos, sin, sqrt, asin
import json
import os
import traceback
router = APIRouter()
security = HTTPBearer()

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
async def block1(request: Request, current_user: dict = Depends(get_current_user_from_token)):
    try:
        data = await request.json()
        # Используем username из токена как user_id
        data["user_id"] = current_user["username"]
        result = await process_block1(data)
        return result
    except Exception as e:
        return {"error": str(e)}
@router.get("/points")
def points():
    return get_points()
@router.get("/user-cabinet")
async def user_cabinet(current_user: dict = Depends(get_current_user_from_token)):
    """
    Получить данные личного кабинета пользователя
    """
    user_id = current_user["username"]
    user_data = get_user_data(user_id)
    user_points = get_user_points(user_id)
    
    return {
        "user_id": user_id,
        "points": user_points,
        "annotations": user_data.get("annotations", []),
        "settings": user_data.get("settings", {})
    }


@router.delete("/delete-point")
async def delete_point(point_id: str, current_user: dict = Depends(get_current_user_from_token)):
    """
    Удалить точку пользователя (только из личного кабинета)
    """
    user_id = current_user["username"]
    
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

# =========================
# AUTH ENDPOINTS
# =========================

@router.post("/register")
async def register(request: Request):
    """Регистрация нового пользователя"""
    data = await request.json()
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    
    result = register_user(username, password)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.post("/login")
async def login(request: Request):
    """Вход пользователя"""
    data = await request.json()
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    
    user = authenticate_user(username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    access_token = create_access_token(data={"sub": username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": username
    }

async def get_current_user_from_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Получить текущего пользователя из токена"""
    token = credentials.credentials
    user = get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user
