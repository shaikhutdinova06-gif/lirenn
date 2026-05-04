from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.services.block1_logic import process_block1
from backend.services.storage import get_user_points, get_points, get_user_data, initialize_test_location, delete_user_point, get_all_points, get_point_history
from backend.services.ai_model import deepseek_classify
from backend.services.auth import register_user, authenticate_user, create_access_token, get_current_user
from backend.services.satellite import get_satellite_image, get_ndvi_image
from math import radians, cos, sin, sqrt, asin
import json
import os
import traceback
router = APIRouter()
security = HTTPBearer()

def get_current_user_from_token(credentials: HTTPAuthorizationCredentials):
    """Получить текущего пользователя из токена"""
    token = credentials.credentials
    user = get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

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

@router.get("/soil-types")
async def get_soil_types():
    """Получить полный список типов почвы из Почвенной карты России"""
    from backend.services.soil_types_russia import SOIL_TYPES_RUSSIA
    
    # Группируем почвы по категориям для лучшей организации
    categories = {
        "ПОЧВЫ ЕВРОАЗИАТСКОЙ ПОЛЯРНОЙ ОБЛАСТИ": [],
        "ПОЧВЫ ТАЕЖНОЙ ЗОНЫ": [],
        "ПОЧВЫ ЛЕСНОЙ ЗОНЫ": [],
        "ПОЧВЫ СТЕПНОЙ ЗОНЫ": [],
        "ПОЧВЫ СУХОСТЕПНОЙ И ПОЛУПУСТЫННОЙ ЗОНЫ": [],
        "БОЛОТНЫЕ ПОЧВЫ": [],
        "ПОЧВЫ ПОЙМ И ДЕЛЬТ": [],
        "СОЛОНЦЫ И СОЛОНЧАКИ": [],
        "ГОРНЫЕ ПОЧВЫ": [],
        "ПОЧВЫ АРКТИЧЕСКИХ ПУСТЫНЬ И ТУНДР": [],
        "ПРОЧИЕ ПОЧВЫ": []
    }
    
    # Распределяем почвы по категориям
    for code, name in SOIL_TYPES_RUSSIA.items():
        if any(keyword in name for keyword in ["Арктические", "Тундровые", "Арктотундровые"]):
            categories["ПОЧВЫ ЕВРОАЗИАТСКОЙ ПОЛЯРНОЙ ОБЛАСТИ"].append(name)
        elif any(keyword in name for keyword in ["Подзолистые", "Таежные", "Глеево-подзолистые", "Дерново-подзолистые"]):
            categories["ПОЧВЫ ТАЕЖНОЙ ЗОНЫ"].append(name)
        elif any(keyword in name for keyword in ["Серые лесные", "Бурые лесные", "Палевые", "Дерново-"]):
            categories["ПОЧВЫ ЛЕСНОЙ ЗОНЫ"].append(name)
        elif any(keyword in name for keyword in ["Чернозем", "Каштановые"]):
            categories["ПОЧВЫ СТЕПНОЙ ЗОНЫ"].append(name)
        elif any(keyword in name for keyword in ["Бурые", "Коричневые"]):
            categories["ПОЧВЫ СУХОСТЕПНОЙ И ПОЛУПУСТЫННОЙ ЗОНЫ"].append(name)
        elif any(keyword in name for keyword in ["Торфяные", "Болотные"]):
            categories["БОЛОТНЫЕ ПОЧВЫ"].append(name)
        elif any(keyword in name for keyword in ["Пойменные", "Маршевые"]):
            categories["ПОЧВЫ ПОЙМ И ДЕЛЬТ"].append(name)
        elif any(keyword in name for keyword in ["Солонцы", "Солончаки", "Солоди"]):
            categories["СОЛОНЦЫ И СОЛОНЧАКИ"].append(name)
        elif any(keyword in name for keyword in ["Горные", "Высокогорные"]):
            categories["ГОРНЫЕ ПОЧВЫ"].append(name)
        elif any(keyword in name for keyword in ["Пески", "Каменистые", "Рыхлые", "Ледники", "Вода"]):
            categories["ПРОЧИЕ ПОЧВЫ"].append(name)
        else:
            categories["ПОЧВЫ АРКТИЧЕСКИХ ПУСТЫНЬ И ТУНДР"].append(name)
    
    # Удаляем пустые категории
    result_categories = []
    for category, types in categories.items():
        if types:  # Добавляем только непустые категории
            result_categories.append({
                "category": category,
                "types": sorted(types)  # Сортируем для удобства
            })
    
    return {
        "soil_types": result_categories
    }

@router.post("/block1")
async def block1(request: Request):
    try:
        data = await request.json()
        # Требуем авторизацию
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Authorization required")
        
        token = auth_header.replace("Bearer ", "")
        user = get_current_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        data["user_id"] = user["username"]
        result = await process_block1(data)  # async function now
        return result
    except HTTPException:
        raise
    except Exception as e:
        return {"error": str(e)}
@router.get("/points")
def points():
    return get_all_points()
@router.get("/user-cabinet")
async def user_cabinet(request: Request):
    """
    Получить данные личного кабинета пользователя
    """
    # Требуем авторизацию
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    
    token = auth_header.replace("Bearer ", "")
    user = get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = user["username"]
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

@router.get("/history")
def history(lat: float, lng: float):
    return get_point_history(lat, lng)

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
    try:
        data = await request.json()
        username = data.get("username")
        password = data.get("password")
        
        if not username or not password:
            raise HTTPException(status_code=400, detail="Username and password required")
        
        result = register_user(username, password)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")

@router.post("/login")
async def login(request: Request):
    """Вход пользователя"""
    print(f"Login endpoint called with method: {request.method}")
    print(f"Request headers: {dict(request.headers)}")
    
    try:
        data = await request.json()
        username = data.get("username")
        password = data.get("password")
        
        print(f"Login attempt for user: {username}")
        
        if not username or not password:
            raise HTTPException(status_code=400, detail="Username and password required")
        
        user = authenticate_user(username, password)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        access_token = create_access_token(data={"sub": username})
        result = {
            "access_token": access_token,
            "token_type": "bearer",
            "username": username
        }
        print(f"Login successful for user: {username}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")

# =========================
# SATELLITE IMAGERY ENDPOINTS
# =========================

@router.get("/satellite-test")
def satellite_test():
    """Test endpoint to verify satellite route is working"""
    import os
    return {
        "status": "ok",
        "message": "Satellite endpoint is accessible",
        "env_vars": [k for k in os.environ.keys() if 'SENTINEL' in k]
    }

@router.get("/satellite")
def satellite(lat: float, lng: float, width: int = 512, height: int = 512):
    """
    Get real satellite image from Sentinel-2 for given coordinates
    """
    print(f"[API /satellite] Request received: lat={lat}, lng={lng}")
    
    # Check if env var is set
    import os
    instance_id = os.getenv("SENTINEL_INSTANCE_ID")
    client_id = os.getenv("SENTINEL_CLIENT_ID")
    
    print(f"[API /satellite] SENTINEL_INSTANCE_ID: {'SET' if instance_id else 'NOT SET'}")
    print(f"[API /satellite] SENTINEL_CLIENT_ID: {'SET' if client_id else 'NOT SET'}")
    
    # Fallback to hardcoded key if env not set
    if not instance_id and not client_id:
        print(f"[API /satellite] No env vars set, using hardcoded key")
        os.environ["SENTINEL_INSTANCE_ID"] = "PLAK1e9d4e8d569b4660af940ff20a9865cb"
        print(f"[API /satellite] Set env var temporarily")
    
    try:
        result = get_satellite_image(lat, lng, width, height)
        print(f"[API /satellite] Result success: {result.get('success')}")
        if not result.get('success'):
            print(f"[API /satellite] Error: {result.get('error')}")
        return result
    except Exception as e:
        print(f"[API /satellite] Exception: {e}")
        return {
            "success": False,
            "error": f"Failed to get satellite image: {str(e)}"
        }

@router.get("/satellite/ndvi")
def satellite_ndvi(lat: float, lng: float, width: int = 512, height: int = 512):
    """
    Get NDVI (vegetation health) satellite image
    
    NDVI shows vegetation health:
    - Red: barren/urban areas
    - Orange: sparse vegetation
    - Yellow: moderate vegetation
    - Light green: healthy vegetation
    - Dark green: very healthy vegetation
    """
    try:
        result = get_ndvi_image(lat, lng, width, height)
        return result
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to get NDVI image: {str(e)}"
        }

# =========================
# SOIL MEASUREMENTS ENDPOINTS (DYNAMICS)
# =========================

@router.get("/point/{point_id}/measurements")
def get_measurements(point_id: str, request: Request):
    """
    Получить историю измерений точки (pH, влажность, N, P, K)
    """
    # Проверяем авторизацию
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    
    token = auth_header.replace("Bearer ", "")
    user = get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    from backend.services.storage import get_point_measurements
    measurements = get_point_measurements(point_id, user["username"])
    
    return {
        "point_id": point_id,
        "measurements": measurements,
        "count": len(measurements)
    }

@router.post("/point/{point_id}/measurements")
async def add_measurement(point_id: str, request: Request):
    """
    Добавить новое измерение к точке
    Body: {ph, moisture, nitrogen, phosphorus, potassium, notes}
    """
    # Проверяем авторизацию
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    
    token = auth_header.replace("Bearer ", "")
    user = get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Получаем данные измерения
    data = await request.json()
    
    from backend.services.storage import add_measurement_to_point
    result = add_measurement_to_point(point_id, data, user["username"])
    
    if "error" in result:
        raise HTTPException(status_code=404 if "not found" in result["error"] else 403, detail=result["error"])
    
    return result

@router.get("/point/{point_id}/dynamics")
def get_dynamics(point_id: str, request: Request):
    """
    Получить данные для графика динамики почвы
    """
    # Проверяем авторизацию
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    
    token = auth_header.replace("Bearer ", "")
    user = get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    from backend.services.storage import get_point_measurements
    measurements = get_point_measurements(point_id, user["username"])
    
    # Форматируем данные для графика
    dates = []
    ph_values = []
    moisture_values = []
    nitrogen_values = []
    phosphorus_values = []
    potassium_values = []
    
    for m in measurements:
        # Форматируем дату
        ts = m.get("timestamp", "")
        if ts:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                dates.append(dt.strftime("%d.%m.%Y"))
            except:
                dates.append(ts[:10])
        else:
            dates.append("")
        
        ph_values.append(m.get("ph"))
        moisture_values.append(m.get("moisture"))
        nitrogen_values.append(m.get("nitrogen"))
        phosphorus_values.append(m.get("phosphorus"))
        potassium_values.append(m.get("potassium"))
    
    return {
        "point_id": point_id,
        "dates": dates,
        "datasets": {
            "ph": {"label": "pH", "data": ph_values, "color": "#2196F3"},
            "moisture": {"label": "Влажность (%)", "data": moisture_values, "color": "#4CAF50"},
            "nitrogen": {"label": "Азот (N)", "data": nitrogen_values, "color": "#9C27B0"},
            "phosphorus": {"label": "Фосфор (P)", "data": phosphorus_values, "color": "#FFC107"},
            "potassium": {"label": "Калий (K)", "data": potassium_values, "color": "#F44336"}
        },
        "count": len(measurements)
    }

@router.post("/point/{point_id}/analyze-dynamics")
async def analyze_dynamics(point_id: str, request: Request):
    """ИИ анализ динамики почвы"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    
    token = auth_header.replace("Bearer ", "")
    user = get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    try:
        from backend.services.ai_model import analyze_soil_dynamics
        from backend.services.storage import get_points
        
        # Получаем точку и измерения
        points = get_points()
        point = None
        for p in points:
            if p.get("id") == point_id and p.get("user_id") == user["username"]:
                point = p
                break
        
        if not point:
            raise HTTPException(status_code=404, detail="Point not found")
        
        measurements = point.get("measurements", [])
        if len(measurements) < 2:
            return {
                "analysis": {
                    "summary": "Недостаточно данных для анализа динамики (нужно минимум 2 измерения)",
                    "trends": [],
                    "recommendations": ["Продолжайте регулярные измерения для отслеживания изменений"]
                }
            }
        
        # ИИ анализ динамики
        analysis_result = await analyze_soil_dynamics(point, measurements)
        
        return {
            "analysis": analysis_result,
            "measurements_count": len(measurements),
            "last_updated": point.get("last_updated")
        }
        
    except Exception as e:
        print(f"[API] Dynamics analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
