import uuid
import json
from datetime import datetime
from backend.services.storage import save_point, get_points, get_user_points, save_user_annotation, get_user_annotations
from backend.services.ai_model import deepseek_analyze, deepseek_classify, call_deepseek, analyze_image_deepseek_vision
from backend.services.compare import find_similar
import os

def get_valid_soil_types():
    """Загрузить список валидных типов почв"""
    try:
        soil_types_path = os.path.join(os.path.dirname(__file__), "..", "data", "soil_types.json")
        with open(soil_types_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            all_types = []
            for category in data.get("soil_types", []):
                all_types.extend(category.get("types", []))
            return all_types
    except:
        return []

async def process_block1(data):
    """
    Полная реализация Блока 1 с DeepSeek Vision + DeepSeek и структурированным отчётом
    """
    try:
        result = {}
        validate_only = data.get("validate_only", False)
        lat = data.get("lat")
        lng = data.get("lng")
        ph = data.get("ph")
        moisture = data.get("moisture")
        nitrogen = data.get("nitrogen")
        phosphorus = data.get("phosphorus")
        potassium = data.get("potassium")
        images = data.get("images", [])
        color = data.get("color", "green")
        icon = data.get("icon", "sample")
        tags = data.get("tags", [])
        notes = data.get("notes")
        user_id = data.get("user_id")
        soil_type = data.get("soil_type")  # Выбранный пользователем тип почвы
        
        print(f"Processing block1: lat={lat}, lng={lng}, user_id={user_id}, soil_type={soil_type}")
        
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
    # ШАГ 1 — DEEPSEEK VISION АНАЛИЗ ФОТО
    # =========================
    if images and len(images) > 0:
        # Анализируем первое фото для валидации
        vision_result = analyze_image_deepseek_vision(images[0])
        
        # Проверяем ответ DeepSeek
        result_lower = str(vision_result).lower().strip()
        
        # Сначала проверяем на очевидные не-почва (строгие reject keywords)
        strict_reject_keywords = [
            "кот", "кошка", "собака", "животное", "человек", "лицо", "голова",
            "шерсть", "хвост", "лапа", "коготь", "мех"
        ]
        
        for keyword in strict_reject_keywords:
            if keyword in result_lower:
                return {
                    "error": "Загруженное изображение не содержит образца почвы. Пожалуйста, загрузите фото почвы или введите данные вручную"
                }
        
        # Проверяем наличие ключевых слов почвы
        soil_keywords = [
            # Основные типы
            "почва", "грунт", "земля", "земельный", "почвенный",
            "субстрат", "субстраты", "почвогрунт",
            # Минеральные компоненты
            "песок", "песчаный", "глина", "глинистый", "суглинок", "суглинистый",
            "супесь", "супесчаный", "ил", "иловый", "иловатый",
            "щебень", "гравий", "галька", "камень", "каменистый",
            "дресва", "крупнообломочный", "мелкозём",
            # Органические компоненты
            "гумус", "гумусовый", "перегной", "перегнойный", "торф", "торфяной",
            "компост", "компостный", "биогумус", "вермикомпост",
            "навоз", "помёт", "солома", "опилки", "мульча",
            # Типы почв
            "чернозём", "чернозем", "чернозёмный", "подзол", "подзолистый", "подзолистые",
            "дерново-подзолистый", "дерновой", "дёрна", "дёрновый",
            "каштановый", "каштановые", "светло-каштановый", "темно-каштановый",
            "серозём", "серозем", "серозёмный", "бурые", "бурый", "бурозём",
            "солонец", "солонцеватый", "солончак", "засоленный",
            "болотный", "болотистый", "болото", "торфяник",
            "аллювиальный", "аллювий", "аллювиальные",
            "луговой", "луговые", "лугово-чернозёмный",
            "тундровый", "арктический", "пустынный",
            "желтозём", "краснозём", "краснозёмный", "желтозёмный",
            # Серые лесные и вариации
            "серый лесной", "серые лесные", "серолесной", "серолесные",
            "светло-серый", "тёмно-серый", "серо-лесной",
            # Другие лесные почвы
            "лесной", "лесные", "лесостепной", "лесостепные",
            "таёжный", "таёжные", "бореальный",
            # Структура почвы
            "структура", "зернистая", "комковатая", "пылеватая", "слитая",
            "пористость", "пористый", "плотность", "плотный", "рыхлый",
            "текстура", "тяжелый", "средний", "легкий",
            # Цвета почв
            "черный", "тёмный", "коричневый", "бурый", "красный", "жёлтый",
            "серый", "белый", "светлый", "рыжий",
            # Химические свойства
            "кислый", "щелочной", "нейтральный", "ph", "кислотность",
            "соленый", "засоление", "засолённый",
            # Влажность
            "влажный", "сухой", "увлажненный", "обводненный", "заболоченный",
            "мерзлый", "многолетнемерзлый", "вечная мерзлота",
            # Образцы и контейнеры
            "образец", "проба", "пробы", "монолит", "монолиты",
            "контейнер", "пробирка", "чашка", "стакан", "коробка",
            "пакет", "пакетик", "пленка", "плёнка",
            # Почвенные горизонты
            "горизонт", "горизонты", "перегнойный", "гумусовый", "иллювиальный",
            "элювиальный", "материнская порода", "почвообразующая порода",
            # Разрезы и профили
            "разрез", "почвенный разрез", "профиль", "почвенный профиль",
            "шурф", "скважина", "бурение",
            # Растения в почве
            "корень", "корневая система", "корневище", "клубень", "луковица",
            "семя", "семена", "росток", "всходы", "побег", "стебель",
            "трава", "травяной", "злак", "злаки", "сорняк", "сорняки",
            # Другие термины
            "агрохимический", "агрофизический", "агрономический",
            "удобрение", "удобрения", "питательные вещества", "минеральные удобрения",
            "органические удобрения", "азот", "фосфор", "калий", "npk",
            "пахотный", "пахота", "вспашка", "боронование", "культивация",
            "орошение", "полив", "ирригация", "дренаж", "водный режим"
        ]
        
        has_soil_keyword = any(keyword in result_lower for keyword in soil_keywords)
        
        # Если есть soil keyword - принимаем
        if has_soil_keyword:
            pass  # Продолжаем с обработкой
        # Если нет soil keyword, но ответ достаточно длинный - всё равно принимаем (DeepSeek мог описать по-другому)
        elif len(vision_result) >= 20:
            pass  # Принимаем, если ответ не слишком короткий и нет очевидных не-почва
        # Если ответ слишком короткий и нет soil keyword - отклоняем
        else:
            return {
                "error": "Загруженное изображение не содержит образца почвы. Пожалуйста, загрузите фото почвы или введите данные вручную"
            }
        
        if "Ошибка" in vision_result or "не настроен" in vision_result:
            result["vision_error"] = vision_result
        else:
            # Парсим JSON из ответа DeepSeek Vision
            try:
                if vision_result.startswith("```json"):
                    vision_result = vision_result.replace("```json", "").replace("```", "").strip()
                vision_data = json.loads(vision_result)
                
                identified_soil_type = vision_data.get("soil_type", "")
                
                # Если пользователь выбрал тип почвы вручную, используем его
                if soil_type:
                    report["general"]["soil_type"] = soil_type
                else:
                    # Проверяем, соответствует ли тип почвы списку
                    valid_types = get_valid_soil_types()
                    if identified_soil_type and valid_types:
                        # Проверяем точное совпадение или частичное
                        matches_exact = identified_soil_type in valid_types
                        matches_partial = any(identified_soil_type.lower() in t.lower() or t.lower() in identified_soil_type.lower() for t in valid_types)
                        
                        if not matches_exact and not matches_partial:
                            result["soil_type_not_in_list"] = True
                            result["identified_soil_type"] = identified_soil_type
                            result["valid_soil_types"] = valid_types
                            report["general"]["soil_type"] = identified_soil_type  # Сохраняем AI-определение
                        else:
                            report["general"]["soil_type"] = identified_soil_type
                    else:
                        report["general"]["soil_type"] = identified_soil_type
                
                report["general"]["color"] = vision_data.get("color", "")
                report["general"]["structure"] = vision_data.get("structure", "")
                report["general"]["density"] = vision_data.get("density", "")
                report["physical"]["texture"] = vision_data.get("features", "")
                
                report["meta"]["source"] = "ai"
                report["meta"]["confidence"] = 0.8
            except:
                # Если не JSON, используем как текст
                report["general"]["notes"] = vision_result
        
        result["vision_analysis"] = vision_result
    
    # Если только валидация - возвращаем результат после проверки фото
    if validate_only:
        return {
            "status": "ok",
            "message": "Фото прошло валидацию"
        }

    # =========================
    # ПРОВЕРКА: точка должна иметь либо фото, либо химические показатели
    # =========================
    has_photo = images and len(images) > 0
    has_indicators = ph or nitrogen or phosphorus or potassium
    
    if not has_photo and not has_indicators:
        return {
            "error": "Точка не может быть добавлена без фото и без химических показателей. Пожалуйста, загрузите фото почвы или введите хотя бы один химический показатель (pH, азот, фосфор, калий)."
        }

    # =========================
    # ПРОВЕРКА ДОСТОВЕРНОСТИ ХИМИЧЕСКИХ ПОКАЗАТЕЛЕЙ (если нет фото)
    # =========================
    if not images or len(images) == 0:
        if ph or nitrogen or phosphorus or potassium:
            msg = [
                {"role": "system", "content": "Ты почвовед. Оцени достоверность химических показателей без фото. Ответь ТОЛЬКО 'ДА' или 'НЕТ'."},
                {"role": "user", "content": f"pH={ph}, азот={nitrogen}, фосфор={phosphorus}, калий={potassium}. Эти показатели реалистичны для почвы или похожи на случайные числа? Напиши ДА если реалистичны, НЕТ если похожи на ложные/случайные."}
            ]
            reliability_check = call_deepseek(msg)
            
            reliability_lower = str(reliability_check).lower().strip()
            first_word = reliability_lower.split()[0] if reliability_lower else ""
            
            if first_word == "нет" or first_word == "no":
                return {
                    "error": "Химические показатели кажутся недостоверными. Без фото невозможно подтвердить их точность. Пожалуйста, загрузите фото или введите более реалистичные значения."
                }
            
            result["reliability_check"] = reliability_check

    # =========================
    # ШАГ 2 — DEEPSEEK СТРУКТУРИРОВАНИЕ
    # =========================
    if image:
        msg = [
            {"role": "system", "content": "Ты почвовед. Структурируй данные почвы в JSON с полями: soil_type, color, structure, density, texture, organic_matter_estimate. Ответь только JSON."},
            {"role": "user", "content": f"Фото анализ: {vision_result}\nДанные: pH={ph}, влажность={moisture}%, азот={nitrogen}, фосфор={phosphorus}, калий={potassium}"}
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
    point_type = "professional" if (images and len(images) > 0 and report["meta"]["confidence"] >= 0.8) else "amateur"

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
        "images": images,
        "report": report,
        "type": point_type,
        "result": result,
        "is_test": False,
        "soil_type": report.get("general", {}).get("soil_type", "")  # Добавляем soil_type на верхний уровень
    }
    
    try:
        save_point(point)
    except Exception as e:
        return {
            "error": f"Ошибка при сохранении точки в базу данных: {str(e)}"
        }

    # =========================
    # СОХРАНЕНИЕ ПОМЕТОК В ПЕРСОНАЛЬНУЮ БАЗУ
    # =========================
    if user_id and (notes or tags or (images and len(images) > 0)):
        annotation = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "point_id": point["id"],
            "notes": notes,
            "tags": tags,
            "images": images
        }
        save_user_annotation(user_id, annotation)

        return {
            "status": "ok",
            "point": point,
            "analysis": result,
            "message": "Точка успешно сохранена. Данные добавлены в базу (append-only)."
        }
    
    except Exception as e:
        import traceback
        error_msg = f"Error in process_block1: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        return {"error": error_msg}
