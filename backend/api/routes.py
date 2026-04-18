from fastapi import APIRouter, Request
from backend.services.block1_logic import process_block1
from backend.services.storage import get_user_points
router = APIRouter()
@router.post("/block1")
async def block1(request: Request):
    data = await request.json()
    return await process_block1(data)
@router.get("/my-points")
async def my_points(user_id: str):
    return get_user_points(user_id)
