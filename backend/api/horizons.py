from fastapi import APIRouter
from backend.services.horizons import get_horizons, get_horizon_description, get_horizon_color

router = APIRouter()

@router.get("/horizons")
def get_soil_horizons(soil_type: str):
    """Возвращает горизонты для типа почвы"""
    horizons = get_horizons(soil_type)
    descriptions = {h: get_horizon_description(h) for h in horizons}
    colors = {h: get_horizon_color(h) for h in horizons}
    
    return {
        "soil_type": soil_type,
        "horizons": horizons,
        "descriptions": descriptions,
        "colors": colors
    }
