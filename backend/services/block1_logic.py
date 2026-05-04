import uuid
from datetime import datetime
from backend.services.ai_model import classify_image, analyze_soil
from backend.services.storage import save_point
from backend.services.soil_metrics import calculate_zc

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
    """
    Обработка блока 1: анализ почвы с фото и AI
    """
    try:
        image = data.get("image")
        
        # 1. Проверка фото
        if image:
            result = classify_image(image)
            if result == "not_soil":
                return {"error": "Загружено не фото почвы. Пожалуйста, сфотографируйте участок с почвой."}
        
        # 2. Подготовка данных для AI анализа
        ai_data = {
            "ph": data.get("ph"),
            "moisture": data.get("moisture"),
            "notes": data.get("notes"),
            "has_image": bool(image)
        }
        
        # 3. AI анализ почвы как в лаборатории
        ai_result = await analyze_soil(ai_data)
        
        # 4. Расчет Zc (коэффициент загрязнения)
        components = data.get("components", data.get("pollutants", []))
        zc = calculate_zc(components)
        zc_cat = zc_category(zc)
        
        # 5. Формирование полной точки
        point = {
            "id": str(uuid.uuid4()),
            "lat": data.get("lat"),
            "lng": data.get("lng"),
            "ph": data.get("ph"),
            "moisture": data.get("moisture"),
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
                "nitrogen": None,  # Заполняется позже через динамику
                "phosphorus": None,
                "potassium": None,
                "notes": "Входной анализ",
                "added_by": data.get("user_id")
            }],
            # AI анализ как в лаборатории
            "ai_analysis": {
                "soil_type": ai_result.get("soil_type", "не определено"),
                "fertility_score": ai_result.get("fertility_score", 5),
                "fertility_text": ai_result.get("fertility_text", ""),
                "chemical_analysis": ai_result.get("chemical_analysis", ""),
                "risks": ai_result.get("risks", []),
                "recommendations": ai_result.get("recommendations", []),
                "suitable_crops": ai_result.get("suitable_crops", []),
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
        
        # 6. Сохранение точки
        save_point(point)
        
        return {
            "status": "success", 
            "point": point,
            "message": "Точка успешно сохранена с AI анализом"
        }
        
    except Exception as e:
        print(f"[BLOCK1] Error: {e}")
        return {"error": str(e)}
