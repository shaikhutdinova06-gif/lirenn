import uuid
from datetime import datetime
from backend.services.storage import save_point, get_points
from backend.services.ai_model import deepseek_analyze, deepseek_classify
from backend.services.compare import find_similar

async def process_block1(data):
    result = {}
    # =========================
    # 1. ПРОВЕРКА ФОТО
    # =========================
    image = data.get("image")
    if image:
        classification = await deepseek_classify(image)
        if classification != "soil":
            return {
                "error": "Загруженное изображение не содержит образца почвы"
            }
        result["image_analysis"] = await deepseek_analyze(image)
    else:
        result["image_analysis"] = "Нет фото — используется предположение"
    # =========================
    # 2. ФИЗИКО-ХИМИЯ
    # =========================
    ph = data.get("ph")
    moisture = data.get("moisture")
    if ph and moisture:
        result["chemistry"] = {
            "ph": ph,
            "moisture": moisture,
            "similar": find_similar(data)
        }
    else:
        result["chemistry"] = "Нет данных — оценка через AI"
    # =========================
    # 3. ГЕОЛОКАЦИЯ
    # =========================
    lat = data.get("lat")
    lng = data.get("lng")
    if lat and lng:
        geo = await deepseek_analyze(f"Опиши рельеф {lat},{lng}")
        result["geo"] = geo
    else:
        result["geo"] = "Нет координат"
    # =========================
    # 4. СОХРАНЕНИЕ (append-only)
    # =========================
    point = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": data.get("user_id"),
        "lat": lat,
        "lng": lng,
        "ph": ph,
        "moisture": moisture,
        "notes": data.get("notes"),
        "tags": data.get("tags"),
        "color": data.get("color"),
        "result": result
    }
    save_point(point)
    return {
        "status": "ok",
        "point": point,
        "analysis": result
    }
