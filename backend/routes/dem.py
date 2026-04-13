import requests
from fastapi import APIRouter

router = APIRouter()

@router.get("/elevation")
def get_elevation(lat: float, lon: float):
    url = f"https://api.opentopodata.org/v1/test-dataset?locations={lat},{lon}"
    r = requests.get(url).json()

    return {
        "elevation": r["results"][0]["elevation"]
    }
