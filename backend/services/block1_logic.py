import uuid
from datetime import datetime
from backend.services.storage import save_point, get_points, get_user_points
from backend.services.ai_model import deepseek_analyze, deepseek_classify
from backend.services.compare import find_similar

async def process_block1(data):
    result = {}
    lat = data.get("lat")
    lng = data.get("lng")
    ph = data.get("ph")
    moisture = data.get("moisture")
    image = data.get("image")
    color = data.get("color", "green")
    icon = data.get("icon", "sample")
    tags = data.get("tags", [])
    notes = data.get("notes")

    # =========================
    # 1. ПРОВЕРКА ФОТО (классификация soil/not soil)
    # =========================
    if image:
        classification = await deepseek_classify(image)
        if classification != "soil":
            return {
                "error": "Загруженное изображение не содержит образца почвы. Пожалуйста, загрузите фото почвы или введите данные вручную"
            }
        result["image_check"] = "soil"
        result["image_analysis"] = await deepseek_analyze(image)
    else:
        result["image_check"] = "no_image"
        result["image_analysis"] = await deepseek_analyze("Предположи свойства почвы по региону и типу местности")

    # =========================
    # 2. ФИЗИКО-ХИМИЯ
    # =========================
    if ph and moisture:
        result["chemistry"] = {
            "ph": ph,
            "moisture": moisture,
            "similar": find_similar(data)
        }
        result["chem_analysis"] = await deepseek_analyze(f"""
Дано:
pH: {ph}
влажность: {moisture}
Сделай структурированный анализ без рекомендаций
""")
    else:
        result["chemistry"] = "Нет данных — оценка через AI"
        result["chem_analysis"] = await deepseek_analyze("Предположи pH, влажность и гумус по типу почвы")

    # =========================
    # 3. ГЕОЛОКАЦИЯ
    # =========================
    if lat and lng:
        result["geo_analysis"] = await deepseek_analyze(f"Опиши ландшафт и рельеф координат {lat}, {lng}")
    else:
        result["geo_analysis"] = "Нет координат"

    # =========================
    # 4. СОСТОЯНИЕ ПРОЦЕССА
    # =========================
    result["state"] = {
        "has_image": bool(image),
        "has_geo": bool(lat and lng),
        "has_chem": bool(ph or moisture),
        "completed": True
    }

    # =========================
    # 5. СОХРАНЕНИЕ (append-only)
    # =========================
    point = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": data.get("user_id"),
        "lat": lat,
        "lng": lng,
        "ph": ph,
        "moisture": moisture,
        "notes": notes,
        "tags": tags,
        "color": color,
        "icon": icon,
        "result": result
    }
    save_point(point)
    return {
        "status": "ok",
        "point": point,
        "analysis": result
    }
