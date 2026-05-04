import requests
import json

def detect_region(lat, lng):
    """Определение региона по координатам"""
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json&accept-language=ru"
        headers = {"User-Agent": "soil-analysis-app"}
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            address = data.get("address", {})
            
            # Пытаемся получить регион в порядке приоритета
            region = (
                address.get("state") or           # Область/край
                address.get("province") or       # Провинция
                address.get("oblast") or         # Область (другое название)
                address.get("county") or         # Уезд/район
                address.get("city") or           # Город если ничего больше
                "неизвестно"
            )
            
            print(f"[GEO] Detected region: {region}")
            return region
        else:
            print(f"[GEO] API error: {response.status_code}")
            return "неизвестно"
            
    except Exception as e:
        print(f"[GEO] Region detection error: {e}")
        return "неизвестно"

def get_country(lat, lng):
    """Получение страны по координатам"""
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json&addressdetails=1"
        headers = {"User-Agent": "soil-analysis-app"}
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            address = data.get("address", {})
            return address.get("country", "неизвестно")
        else:
            return "неизвестно"
            
    except Exception as e:
        print(f"[GEO] Country detection error: {e}")
        return "неизвестно"
