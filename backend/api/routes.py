from fastapi import APIRouter, Request
from backend.services.block1_logic import process_block1
from backend.services.storage import get_user_points, get_points
from math import radians, cos, sin, sqrt, asin
router = APIRouter()
@router.post("/block1")
async def block1(request: Request):
    data = await request.json()
    return await process_block1(data)
@router.get("/points")
async def all_points():
    return get_points()
@router.get("/my-points")
async def my_points(user_id: str):
    return get_user_points(user_id)
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
def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return R * c
