import uuid
from datetime import datetime
from backend.services.storage import save_point, get_points, get_user_points, save_user_annotation, get_user_annotations
from backend.services.ai_model import deepseek_analyze, deepseek_classify
from backend.services.compare import find_similar

async def process_block1(data):
    """
    Полная реализация Блока 1 согласно спецификации
    """
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
    user_id = data.get("user_id")

    # =========================
    # 1. ВХОДНОЙ АНАЛИЗ ФОТО (классификация «почва — не почва»)
    # =========================
    if image:
        classification = await deepseek_classify(image)
        if classification != "soil":
            return {
                "error": "Загруженное изображение не содержит образца почвы. Пожалуйста, загрузите фото почвы или введите данные вручную"
            }
        result["image_check"] = "soil"
        result["image_analysis"] = await deepseek_analyze(f"Проанализируй это фото почвы: опиши тип почвы, структуру, цвет, возможные загрязнения")
    else:
        result["image_check"] = "no_image"
        result["image_analysis"] = await deepseek_analyze("Предположи свойства почвы по региону и типу местности")

    # =========================
    # 2. ПРОВЕРКА НАЛИЧИЯ ФОТО ПОЛЬЗОВАТЕЛЯ
    # =========================
    if image:
        result["has_user_photo"] = True
        # Переход к анализу физико-химических показателей
    else:
        result["has_user_photo"] = False
        # Задействовать DeepSeek для формирования предположений
        result["assumed_data"] = await deepseek_analyze("Предположи тип почвы, pH, влажность и содержание веществ для данного региона")

    # =========================
    # 3. АНАЛИЗ ФИЗИКО-ХИМИЧЕСКИХ ПОКАЗАТЕЛЕЙ ПОЧВЫ (рН, влажность, содержание веществ)
    # =========================
    if ph and moisture:
        # Показатели есть - сопоставить с базой данных
        result["chemistry"] = {
            "ph": ph,
            "moisture": moisture,
            "similar": find_similar(data)
        }
        # Передать данные в DeepSeek для предположительного анализа
        result["chem_analysis"] = await deepseek_analyze(f"""
Проанализируй следующие показатели почвы:
pH: {ph}
Влажность: {moisture}%
Сделай структурированный анализ состояния почвы без рекомендаций.
""")
    else:
        # Показателей нет - предложить ввести вручную или использовать DeepSeek
        result["chemistry"] = "Нет данных — оценка через AI"
        result["chem_analysis"] = await deepseek_analyze("Предположи pH, влажность и содержание гумуса по типу почвы и региону")
        result["manual_input_required"] = True

    # =========================
    # 4. РАБОТА С ГЕОЛОКАЦИЕЙ (местоположение точки)
    # =========================
    if lat and lng:
        # Местоположение есть - сопоставить с базой данных
        result["geo_analysis"] = await deepseek_analyze(f"Опиши ландшафт, рельеф и типичные почвы для координат {lat}, {lng}")
        result["has_location"] = True
        
        # Сопоставление с базой данных
        existing_points = get_points()
        nearby_points = []
        for point in existing_points:
            if point.get("lat") and point.get("lng"):
                from math import radians, cos, sin, sqrt, asin
                R = 6371
                dlat = radians(point["lat"] - lat)
                dlon = radians(point["lng"] - lng)
                a = sin(dlat/2)**2 + cos(radians(lat)) * cos(radians(point["lat"])) * sin(dlon/2)**2
                c = 2 * asin(sqrt(a))
                distance = R * c
                if distance <= 5:  # радиус 5 км
                    nearby_points.append({"point": point, "distance": distance})
        
        result["nearby_points"] = nearby_points
    else:
        # Местоположения нет - предложить зафиксировать точку на карте
        result["geo_analysis"] = "Нет координат — требуется фиксация точки на карте"
        result["has_location"] = False
        result["location_required"] = True

    # =========================
    # 5. СОХРАНЕНИЕ ПОМЕТОК (текст, символы, цвета, теги, фото)
    # =========================
    annotations = {
        "text_notes": notes if notes else None,
        "symbol": icon,
        "color": color,
        "tags": tags if tags else [],
        "has_photo": bool(image)
    }
    result["annotations"] = annotations

    # =========================
    # 6. СОСТОЯНИЕ ПРОЦЕССА
    # =========================
    result["state"] = {
        "has_image": bool(image),
        "has_geo": bool(lat and lng),
        "has_chem": bool(ph or moisture),
        "has_annotations": bool(notes or tags),
        "completed": bool(image and lat and lng and ph and moisture)
    }

    if not result["state"]["completed"]:
        result["message"] = "Для полного анализа необходимо дополнить данные"

    # =========================
    # 7. СОХРАНЕНИЕ ТОЧКИ (append-only, без перезаписи)
    # =========================
    point = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
        "lat": lat,
        "lng": lng,
        "ph": ph,
        "moisture": moisture,
        "notes": notes,
        "tags": tags,
        "color": color,
        "icon": icon,
        "image": image,
        "result": result,
        "is_test": False  # обычная точка пользователя
    }
    save_point(point)

    # =========================
    # 8. СОХРАНЕНИЕ ПОМЕТОК В ПЕРСОНАЛЬНУЮ БАЗУ
    # =========================
    if user_id and (notes or tags or image):
        annotation = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "point_id": point["id"],
            "notes": notes,
            "tags": tags,
            "image": image
        }
        save_user_annotation(user_id, annotation)

    return {
        "status": "ok",
        "point": point,
        "analysis": result,
        "message": "Точка успешно сохранена. Данные добавлены в базу (append-only)."
    }
