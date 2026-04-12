from fastapi import APIRouter
from backend.services.recovery import predict_recovery

router = APIRouter()

@router.get("/recovery")
def get_recovery(soil: str, health: float, pollution: str = "clean"):
    return {
        "forecast": predict_recovery(soil, health, pollution)
    }
