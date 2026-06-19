import requests


NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_HEADERS = {"User-Agent": "soil-analysis-app"}


def _nominatim_reverse(lat, lng, extra_params=None):
    """Shared helper for Nominatim reverse-geocoding requests.

    Returns the parsed address dict, or an empty dict on failure.
    """
    params = {
        "lat": lat,
        "lon": lng,
        "format": "json",
    }
    if extra_params:
        params.update(extra_params)

    try:
        response = requests.get(
            NOMINATIM_BASE_URL,
            params=params,
            headers=NOMINATIM_HEADERS,
            timeout=5,
        )
        if response.status_code == 200:
            return response.json().get("address", {})
        print(f"[GEO] API error: {response.status_code}")
    except Exception as e:
        print(f"[GEO] Request error: {e}")

    return {}


def detect_region(lat, lng):
    """Определение региона по координатам"""
    address = _nominatim_reverse(lat, lng, {"accept-language": "ru"})

    region = (
        address.get("state") or
        address.get("province") or
        address.get("oblast") or
        address.get("county") or
        address.get("city") or
        "неизвестно"
    )

    print(f"[GEO] Detected region: {region}")
    return region


def get_country(lat, lng):
    """Получение страны по координатам"""
    address = _nominatim_reverse(lat, lng, {"addressdetails": "1"})
    return address.get("country", "неизвестно")
