import uuid
from datetime import datetime
from backend.services.storage import save_point
from backend.services.compare import find_similar
from backend.services.ai_model import deepseek_call

def process_block1(data):
    result = {}
    lat = data.get("lat")
    lng = data.get("lng")
    ph = data.get("ph")
    moisture = data.get("moisture")
    image = data.get("image")

    # === 1. ПРОВЕРКА ФОТО ===
    if image:
        check = deepseek_call(
            "Определи: это почва или нет. Ответ: soil или not_soil"
        )
        if "not_soil" in check.lower():
            return {
                "error": "Загруженное изображение не содержит образца почвы"
            }
        result["image_check"] = "soil"

    # === 2. АНАЛИЗ ===
    if image:
        result["ai_analysis"] = deepseek_call(
            "Опиши почву: цвет, структура, признаки горизонта"
        )
    else:
        result["ai_analysis"] = deepseek_call(
            "Предположи свойства почвы по региону и типу местности"
        )

    # === 3. ФИЗИКО-ХИМИЯ ===
    if ph or moisture:
        result["matches"] = find_similar(data)
        result["chem_analysis"] = deepseek_call(f"""
Данные:
pH: {ph}
влажность: {moisture}
Сделай структурированный анализ без рекомендаций
""")
    else:
        result["chem_analysis"] = deepseek_call(
            "Предположи pH, влажность и гумус по типу почвы"
        )

    # === 4. ГЕОЛОКАЦИЯ ===
    if lat and lng:
        result["geo_analysis"] = deepseek_call(
            f"Опиши ландшафт и рельеф координат {lat}, {lng}"
        )

    # === 5. СОХРАНЕНИЕ (append-only)
    point = {
        "id": str(uuid.uuid4()),
        "lat": lat,
        "lng": lng,
        "ph": ph,
        "moisture": moisture,
        "notes": data.get("notes"),
        "tags": data.get("tags"),
        "color": data.get("color"),
        "user_id": data.get("user_id"),
        "created_at": datetime.utcnow().isoformat()
    }
    save_point(point)
    result["saved_point"] = point

    # === 6. СОСТОЯНИЕ ПРОЦЕССА ===
    result["state"] = {
        "has_image": bool(image),
        "has_geo": bool(lat and lng),
        "has_chem": bool(ph or moisture),
        "completed": True
    }

    return result
