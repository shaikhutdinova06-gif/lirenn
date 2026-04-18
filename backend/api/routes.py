from fastapi import APIRouter, Request
from backend.services.block1_logic import process_block1

router = APIRouter()

@router.post("/block1")
async def block1(request: Request):
    data = await request.json()
    return process_block1(data)
