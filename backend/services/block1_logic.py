import uuid
from datetime import datetime
from backend.services.ai_model import classify_image, analyze_soil
from backend.services.storage import save_point
from backend.services.soil_metrics import calculate_zc
def process_block1(data):
    image = data.get("image")
    # 1. Проверка фото
    if image:
        result = classify_image(image)
        if result == "not_soil":
            return {"error": "Это не почва"}
    # 2. AI анализ
    ai_result = analyze_soil(data)
    # 3. Zc
    zc = calculate_zc(data.get("pollutants", []))
    # 4. Формирование точки
    point = {
        "id": str(uuid.uuid4()),
        "lat": data.get("lat"),
        "lng": data.get("lng"),
        "user_id": data.get("user_id"),
        "ph": data.get("ph"),
        "moisture": data.get("moisture"),
        "notes": data.get("notes"),
        "tags": data.get("tags"),
        "color": data.get("color"),
        "image": image,
        "ai": ai_result,
        "report": {
            "zc": zc
        },
        "timestamp": datetime.utcnow().isoformat()
    }
    save_point(point)
    return {"status": "ok", "point": point}
