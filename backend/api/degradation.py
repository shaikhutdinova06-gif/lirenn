from fastapi import APIRouter
from backend.services.degradation import calc_degradation, generate_sample_points

router = APIRouter()

@router.get("/degradation")
def get_degradation():
    points = generate_sample_points()
    return calc_degradation(points)
