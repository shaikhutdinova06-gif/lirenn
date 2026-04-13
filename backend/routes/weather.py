import requests
from fastapi import APIRouter

router = APIRouter()

API_KEY = "your_key"

@router.get("/weather")
def get_weather(lat: float, lon: float):
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
    data = requests.get(url).json()

    return {
        "temp": data["main"]["temp"],
        "humidity": data["main"]["humidity"]
    }
