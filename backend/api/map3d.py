from fastapi import APIRouter
from backend.services.soil_map import get_soil_type
from backend.services.soil_health import soil_health
import numpy as np

router = APIRouter()

@router.get("/3d")
def get_3d():
    """Generate 3D soil health data for visualization"""
    points = []
    
    # Generate sample points across Russia
    for lat in range(40, 70, 2):
        for lon in range(20, 180, 5):
            soil = get_soil_type(lat, lon)
            ph = 6.5  # default pH
            health = soil_health(soil, ph)
            points.append({
                "lat": lat,
                "lon": lon,
                "soil": soil,
                "health": health
            })
    
    return {
        "x": [p["lon"] for p in points],
        "y": [p["lat"] for p in points],
        "z": [p["health"] for p in points],
        "total": len(points)
    }
