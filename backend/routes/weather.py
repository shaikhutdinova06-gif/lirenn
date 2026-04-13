import requests
from fastapi import APIRouter

router = APIRouter()

API_KEY = "your_key"

@router.get("/weather")
def get_weather(lat: float, lon: float):
    # Если API ключ не установлен, возвращаем моковые данные
    if API_KEY == "your_key":
        return {
            "temp": 20.0,
            "humidity": 60
        }
    
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
        data = requests.get(url).json()

        return {
            "temp": data["main"]["temp"],
            "humidity": data["main"]["humidity"]
        }
    except Exception as e:
        # В случае ошибки возвращаем моковые данные
        return {
            "temp": 20.0,
            "humidity": 60
        }
