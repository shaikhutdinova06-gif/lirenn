from fastapi import APIRouter

router = APIRouter()

@router.post("/calc")
def calc(data: dict):

    ph = data.get("ph", 6.5)
    moist = data.get("moist", 50)
    organic = data.get("organic", 5)

    health = (ph/14 + moist/100 + organic/10) / 3

    return {"health": round(health, 2)}
