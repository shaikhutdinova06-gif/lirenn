from fastapi import APIRouter, Request
from backend.services.block1_logic import process_block1
from backend.services.validation import validate_input
from backend.services.storage import get_user_points

router = APIRouter()

@router.post("/block1")
async def block1(request: Request):
    data = await request.json()
    errors = validate_input(data)
    if errors:
        return {"status": "error", "errors": errors}
    return process_block1(data)

@router.get("/my-points")
async def my_points(user_id: str):
    return get_user_points(user_id)
