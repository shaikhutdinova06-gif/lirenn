from fastapi import APIRouter, Request
from backend.services.block1_logic import process_block1
from backend.services.storage import get_points, get_user_points
router = APIRouter()
@router.post("/block1")
async def block1(request: Request):
    try:
        data = await request.json()
        result = process_block1(data)
        return result
    except Exception as e:
        return {"error": str(e)}
@router.get("/points")
def points():
    return get_points()
@router.get("/user-cabinet")
def cabinet(user_id: str):
    return get_user_points(user_id)
