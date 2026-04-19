import uuid
from datetime import datetime
from backend.services.storage import save_point, get_points, get_user_points, save_user_annotation, get_user_annotations
from backend.services.ai_model import deepseek_analyze, deepseek_classify, call_deepseek
from backend.services.compare import find_similar

async def process_block1(data):
    """
    Полная реализация Блока 1 согласно спецификации с пошаговыми вызовами DeepSeek
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
    
    # Контекст для накопления информации
    context = []

    # =========================
    # ШАГ 1 — ПРОВЕРКА ФОТО
    # =========================
    if image:
        classification = await deepseek_classify(image)
        if classification != "soil":
            return {
                "error": "Загруженное изображение не содержит образца почвы. Пожалуйста, загрузите фото почвы или введите данные вручную"
            }
        context.append("Фото: это почва")
    else:
        context.append("Фото отсутствует")

    # =========================
    # ШАГ 2 — AI ОПИСАНИЕ
    # =========================
    msg = [
        {"role": "system", "content": "Ты почвовед. Опиши характеристики почвы."},
        {"role": "user", "content": str(context)}
    ]
    ai_description = call_deepseek(msg)
    context.append(ai_description)
    result["image_analysis"] = ai_description

    # =========================
    # ШАГ 3 — PH И ВЛАЖНОСТЬ
    # =========================
    if ph or moisture:
        msg = [
            {"role": "system", "content": "Проанализируй pH и влажность почвы."},
            {"role": "user", "content": f"pH={ph}, влажность={moisture}%"}
        ]
        chem_analysis = call_deepseek(msg)
        context.append(chem_analysis)
        result["chemistry"] = {"ph": ph, "moisture": moisture}
        result["chem_analysis"] = chem_analysis
    else:
        msg = [
            {"role": "system", "content": "Предположи pH и влажность по описанию"},
            {"role": "user", "content": str(context)}
        ]
        guess = call_deepseek(msg)
        context.append(guess)
        result["chemistry"] = "Нет данных — оценка через AI"
        result["chem_analysis"] = guess

    # =========================
    # ШАГ 4 — ГЕОЛОКАЦИЯ
    # =========================
    if lat and lng:
        msg = [
            {"role": "system", "content": "Опиши ландшафт по координатам"},
            {"role": "user", "content": f"{lat}, {lng}"}
        ]
        geo = call_deepseek(msg)
        context.append(geo)
        result["geo_analysis"] = geo
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
        result["geo_analysis"] = "Нет координат — требуется фиксация точки на карте"
        result["has_location"] = False

    # =========================
    # ШАГ 5 — ФИНАЛЬНЫЙ ОТЧЁТ
    # =========================
    msg = [
        {"role": "system", "content": "Сформируй структурированный отчёт по почве"},
        {"role": "user", "content": str(context)}
    ]
    final_report = call_deepseek(msg)
    result["report"] = final_report

    # =========================
    # ПРОВЕРКА НАЛИЧИЯ ФОТО
    # =========================
    result["image_check"] = "soil" if image else "no_image"
    result["has_user_photo"] = bool(image)

    # =========================
    # СОХРАНЕНИЕ ПОМЕТОК
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
    # СОСТОЯНИЕ ПРОЦЕССА
    # =========================
    result["state"] = {
        "has_image": bool(image),
        "has_geo": bool(lat and lng),
        "has_chem": bool(ph or moisture),
        "has_annotations": bool(notes or tags),
        "completed": bool(image and lat and lng)
    }

    # =========================
    # СОХРАНЕНИЕ ТОЧКИ (append-only, без перезаписи)
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
        "report": final_report,
        "result": result,
        "is_test": False
    }
    save_point(point)

    # =========================
    # СОХРАНЕНИЕ ПОМЕТОК В ПЕРСОНАЛЬНУЮ БАЗУ
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
