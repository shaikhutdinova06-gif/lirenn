from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.storage import save_point, get_points, delete_point
import json

router = APIRouter()

class PointData(BaseModel):
    lat: float
    lon: float
    soil_type: str
    health: float
    pollution: str
    user_id: str = None
    ph: float = None
    humus: float = None
    moisture: float = None

@router.post("/save_point")
async def save(data: PointData):
    """Сохраняет точку пользователя"""
    save_point(data.dict())
    return {"status": "saved"}

@router.get("/points")
def get_all_points():
    """Возвращает все точки"""
    return get_points()

@router.get("/points/{user_id}")
def get_user_points(user_id: str):
    """Возвращает точки конкретного пользователя"""
    from backend.services.storage import get_user_points
    return get_user_points(user_id)

@router.delete("/point/{timestamp}")
def delete_point_endpoint(timestamp: float):
    """Удаляет точку по timestamp"""
    delete_point(timestamp)
    return {"status": "deleted"}
