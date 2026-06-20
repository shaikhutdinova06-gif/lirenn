import requests
from datetime import datetime, timedelta

def get_weather_for_point(lat, lng):
    """Fetch recent and current weather for given coordinates using Open-Meteo.

    Returns a dict with `current` and `daily` (last 7 days) fields.
    """
    try:
        if lat is None or lng is None:
            return {"error": "No coordinates provided"}

        url = (
            f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}"
            "&current_weather=true"
            "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum"
            "&past_days=7&timezone=auto"
        )

        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return {"error": f"weather API {resp.status_code}", "text": resp.text[:200]}

        data = resp.json()

        # Normalize structure
        current = data.get('current_weather', {})
        daily = data.get('daily', {})

        return {
            "source": "open-meteo",
            "fetched_at": datetime.utcnow().isoformat(),
            "current": current,
            "daily": daily
        }

    except Exception as e:
        return {"error": str(e)}
