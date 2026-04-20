import uuid
import json
from datetime import datetime
from backend.services.storage import save_point, get_points, get_user_points, save_user_annotation, get_user_annotations
from backend.services.ai_model import deepseek_analyze, deepseek_classify, call_deepseek, analyze_image_gigachat
from backend.services.compare import find_similar

async def process_block1(data):
    """
    Полная реализация Блока 1 с GigaChat + DeepSeek и структурированным отчётом
    """
    result = {}
    lat = data.get("lat")
    lng = data.get("lng")
    ph = data.get("ph")
    moisture = data.get("moisture")
    nitrogen = data.get("nitrogen")
    phosphorus = data.get("phosphorus")
    potassium = data.get("potassium")
    image = data.get("image")
    color = data.get("color", "green")
    icon = data.get("icon", "sample")
    tags = data.get("tags", [])
    notes = data.get("notes")
    user_id = data.get("user_id")
    
    # Базовый отчёт
    report = {
        "general": {
            "soil_type": "",
            "color": "",
            "structure": "",
            "density": "",
            "notes": notes or ""
        },
        "chemistry": {
            "ph": ph,
            "organic_matter": None,
            "nitrogen": nitrogen,
            "phosphorus": phosphorus,
            "potassium": potassium
        },
        "physical": {
            "moisture": moisture,
            "texture": "",
            "porosity": None
        },
        "location": {
            "lat": lat,
            "lng": lng
        },
        "meta": {
            "source": "user",
            "confidence": 0.6
        }
    }

    # =========================
    # ШАГ 1 — GIGACHAT АНАЛИЗ ФОТО
    # =========================
    if image:
        gigachat_result = analyze_image_gigachat(image)
        
        # Проверка на "не почва"
        if "не почва" in str(gigachat_result).lower():
            return {
                "error": "Загруженное изображение не содержит образца почвы. Пожалуйста, загрузите фото почвы или введите данные вручную"
            }
        
        if "Ошибка" in gigachat_result or "не настроен" in gigachat_result:
            result["gigachat_error"] = gigachat_result
        else:
            # Парсим JSON из ответа GigaChat
            try:
                if gigachat_result.startswith("```json"):
                    gigachat_result = gigachat_result.replace("```json", "").replace("```", "").strip()
                gigachat_data = json.loads(gigachat_result)
                
                report["general"]["soil_type"] = gigachat_data.get("soil_type", "")
                report["general"]["color"] = gigachat_data.get("color", "")
                report["general"]["structure"] = gigachat_data.get("structure", "")
                report["general"]["density"] = gigachat_data.get("density", "")
                report["physical"]["texture"] = gigachat_data.get("features", "")
                
                report["meta"]["source"] = "ai"
                report["meta"]["confidence"] = 0.8
            except:
                # Если не JSON, используем как текст
                report["general"]["notes"] = gigachat_result
        
        result["gigachat_analysis"] = gigachat_result

    # =========================
    # ШАГ 2 — DEEPSEEK СТРУКТУРИРОВАНИЕ
    # =========================
    if image:
        msg = [
            {"role": "system", "content": "Ты почвовед. Структурируй данные почвы в JSON с полями: soil_type, color, structure, density, texture, organic_matter_estimate. Ответь только JSON."},
            {"role": "user", "content": f"Фото анализ: {gigachat_result}\nДанные: pH={ph}, влажность={moisture}%, азот={nitrogen}, фосфор={phosphorus}, калий={potassium}"}
        ]
        deepseek_result = call_deepseek(msg)
        
        try:
            if deepseek_result.startswith("```json"):
                deepseek_result = deepseek_result.replace("```json", "").replace("```", "").strip()
            deepseek_data = json.loads(deepseek_result)
            
            # Объединяем данные
            if deepseek_data.get("soil_type"):
                report["general"]["soil_type"] = deepseek_data["soil_type"]
            if deepseek_data.get("color"):
                report["general"]["color"] = deepseek_data["color"]
            if deepseek_data.get("structure"):
                report["general"]["structure"] = deepseek_data["structure"]
            if deepseek_data.get("density"):
                report["general"]["density"] = deepseek_data["density"]
            if deepseek_data.get("texture"):
                report["physical"]["texture"] = deepseek_data["texture"]
            if deepseek_data.get("organic_matter_estimate"):
                report["chemistry"]["organic_matter"] = deepseek_data["organic_matter_estimate"]
            
            report["meta"]["source"] = "mixed"
            report["meta"]["confidence"] = 0.9
        except:
            pass
        
        result["deepseek_structuring"] = deepseek_result

    # =========================
    # ШАГ 3 — ГЕОЛОКАЦИЯ
    # =========================
    if lat and lng:
        msg = [
            {"role": "system", "content": "Опиши ландшафт и типичные почвы для координат"},
            {"role": "user", "content": f"{lat}, {lng}"}
        ]
        geo = call_deepseek(msg)
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
    # ОПРЕДЕЛЕНИЕ ТИПА ТОЧКИ
    # =========================
    point_type = "professional" if (image and report["meta"]["confidence"] >= 0.8) else "amateur"

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
        "nitrogen": nitrogen,
        "phosphorus": phosphorus,
        "potassium": potassium,
        "notes": notes,
        "tags": tags,
        "color": color,
        "icon": icon,
        "image": image,
        "report": report,
        "type": point_type,
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
