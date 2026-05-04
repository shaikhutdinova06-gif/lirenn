import uuid
from datetime import datetime
from backend.services.ai_model import classify_image, analyze_soil, detect_soil_type
from backend.services.storage import save_point
from backend.services.soil_metrics import calculate_zc
from backend.services.geo import detect_region
from backend.services.soil_reference import get_reference, calculate_deviation, get_soil_quality_score, get_recommendations

def calculate_confidence(data):
    score = 0
    if data.get("image"):
        score += 40
    if data.get("ph") is not None:
        score += 30
    if data.get("moisture") is not None:
        score += 20
    if data.get("lat") is not None and data.get("lng") is not None:
        score += 10
    return score

def zc_category(zc):
    """Определение категории загрязнения по Zc"""
    if zc is None:
        return "не определено"
    if zc < 16:
        return "допустимое"
    elif zc < 32:
        return "умеренно опасное"
    elif zc < 128:
        return "опасное"
    else:
        return "чрезвычайно опасное"

async def process_block1(data):
    print(f"[BLOCK1] Processing data...")
    print(f"[BLOCK1] Data keys: {list(data.keys())}")
    
    # 1. Проверка изображения
    image = data.get("image")
    if image:
        result = classify_image(image)
        print(f"[BLOCK1] Classification result: {result}")
        if result == "not_soil":
            return {"error": "Загружено не фото почвы."}
    
    # 2. Определение региона
    region = detect_region(data.get("lat"), data.get("lng"))
    data["region"] = region
    print(f"[BLOCK1] Region detected: {region}")
    
    # 3. AI определение типа почвы
    soil_type_result = await detect_soil_type(data)
    print(f"[BLOCK1] Soil type detected: {soil_type_result}")
    
    # 4. AI анализ почвы
    ai_data = {
        "ph": data.get("ph"),
        "moisture": data.get("moisture"),
        "notes": data.get("notes"),
        "has_image": bool(image)
    }
    ai_result = await analyze_soil(ai_data)
    print(f"[BLOCK1] AI analysis completed")
    
    # 5. Расчет Zc
    components = data.get("components", data.get("pollutants", []))
    zc = calculate_zc(components)
    zc_cat = zc_category(zc)
    print(f"[BLOCK1] Zc calculated: {zc} ({zc_cat})")
    
    # 6. Анализ с эталоном
    reference = get_reference(soil_type_result.get("soil_ru", ""))
    current_data = {
        "ph": data.get("ph"),
        "humus": data.get("humus"),
        "nitrogen": data.get("nitrogen"),
        "phosphorus": data.get("phosphorus"),
        "potassium": data.get("potassium")
    }
    deviation = calculate_deviation(current_data, reference)
    quality_score = get_soil_quality_score(deviation)
    recommendations = get_recommendations(deviation, soil_type_result.get("soil_ru", ""))
    
    print(f"[BLOCK1] Reference analysis completed")
    
    # 7. Формирование полной точки
    point = {
        "id": str(uuid.uuid4()),
        "lat": data.get("lat"),
        "lng": data.get("lng"),
        "ph": data.get("ph"),
        "moisture": data.get("moisture"),
        "nitrogen": data.get("nitrogen"),
        "phosphorus": data.get("phosphorus"),
        "potassium": data.get("potassium"),
        "humus": data.get("humus"),
        "notes": data.get("notes"),
        "tags": data.get("tags", []),
        "color": data.get("color", "green"),
        "user_id": data.get("user_id"),
        "image": image,  # Сохраняем фото как base64
        "timestamp": datetime.utcnow().isoformat(),
        "last_updated": datetime.utcnow().isoformat(),
        "confidence": calculate_confidence(data),
        # История измерений (первое измерение)
        "measurements": [{
            "id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "ph": data.get("ph"),
            "moisture": data.get("moisture"),
            "nitrogen": data.get("nitrogen"),
            "phosphorus": data.get("phosphorus"),
            "potassium": data.get("potassium"),
            "notes": "Входной анализ",
            "added_by": data.get("user_id")
        }],
        # Умный анализ почвы
        "soil_type": soil_type_result,
        "region": region,
        "reference": reference,
        "deviation": deviation,
        "quality_score": quality_score,
        # AI анализ как в лаборатории
        "ai_analysis": {
            "soil_type": ai_result.get("soil_type", "не определено"),
            "fertility_score": ai_result.get("fertility_score", 5),
            "fertility_text": ai_result.get("fertility_text", ""),
            "chemical_analysis": ai_result.get("chemical_analysis", ""),
            "risks": ai_result.get("risks", []),
            "recommendations": recommendations,  # Умные рекомендации
            "summary": ai_result.get("summary", "")
        },
        # Экологический отчет
        "ecological_report": {
            "zc": zc,
            "zc_category": zc_cat,
            "components": components
        },
        # Полный ответ от AI
        "raw_ai": ai_result
    }
    
    # 8. Сохранение точки
    save_point(point)
    
    return {
        "status": "success",
        "point": point,
        "message": "Точка успешно сохранена с умным анализом"
    }
