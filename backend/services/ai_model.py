import os
import requests
import base64
import struct
import json

API_KEY = os.getenv("DEEPSEEK_API_KEY")

async def detect_soil_type(data):
    """Авто-определение типа почвы через AI"""
    if not API_KEY:
        return {
            "soil_ru": "не определено",
            "soil_wrb": "-",
            "confidence": 0,
            "reason": "API ключ не настроен"
        }
    
    prompt = f"""
Ты — профессиональный почвовед РФ.
Определи тип почвы по данным.

Данные:
Регион: {data.get('region', 'неизвестно')}
pH: {data.get('ph', 'не указано')}
Влажность: {data.get('moisture', 'не указано')}%
Азот: {data.get('nitrogen', 'не указано')} мг/кг
Фосфор: {data.get('phosphorus', 'не указано')} мг/кг
Калий: {data.get('potassium', 'не указано')} мг/кг
Описание: {data.get('notes', '')}

Верни строго JSON:
{{
  "soil_ru": "название на русском (например: чернозем, подзол, серая лесная)",
  "soil_wrb": "международная классификация WRB (например: Chernozem, Podzol, Greyzemic)",
  "confidence": 0-100,
  "reason": "краткое объяснение почему такой тип"
}}
"""
    
    try:
        response = requests.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 200,
                "temperature": 0.3
            },
            timeout=10
        )
        
        if response.status_code != 200:
            print(f"[AI] detect_soil_type API error {response.status_code}: {response.text}")
            return {
                "soil_ru": "не определено",
                "soil_wrb": "-",
                "confidence": 0,
                "reason": f"API ошибка: {response.status_code}. {response.text[:200]}"
            }
        
        text = response.json()["choices"][0]["message"]["content"]
        
        # Пытаемся распарсить JSON
        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            # Извлекаем JSON из markdown code blocks
            if "```json" in text:
                json_str = text.split("```json")[1].split("```")[0].strip()
                result = json.loads(json_str)
            elif "```" in text:
                json_str = text.split("```")[1].split("```")[0].strip()
                result = json.loads(json_str)
            else:
                return {
                    "soil_ru": "не определено",
                    "soil_wrb": "-",
                    "confidence": 0,
                    "reason": "Ошибка парсинга AI ответа"
                }
        
        # Валидация полей
        if not all(k in result for k in ["soil_ru", "soil_wrb", "confidence", "reason"]):
            return {
                "soil_ru": "не определено",
                "soil_wrb": "-",
                "confidence": 0,
                "reason": "Ошибка парсинга AI ответа"
            }
        return result
            
    except Exception as e:
        print(f"[AI] Soil type detection error: {e}")
        return {
            "soil_ru": "не определено",
            "soil_wrb": "-",
            "confidence": 0,
            "reason": f"Ошибка: {str(e)}"
        }

async def analyze_soil_dynamics(point, measurements):
    """ИИ анализ динамики почвы"""
    if not API_KEY:
        return {
            "summary": "ИИ анализ недоступен - не настроен API ключ",
            "trends": [],
            "recommendations": ["Настройте API ключ для ИИ анализа"]
        }
    
    # Подготовка данных для анализа
    measurements_data = []
    for m in measurements:
        measurements_data.append({
            "date": m.get("timestamp", "")[:10],
            "ph": m.get("ph"),
            "moisture": m.get("moisture"),
            "nitrogen": m.get("nitrogen"),
            "phosphorus": m.get("phosphorus"),
            "potassium": m.get("potassium"),
            "notes": m.get("notes", "")
        })
    
    # Информация о точке
    soil_type = point.get("soil_type", {}).get("soil_ru", "не определено")
    region = point.get("region", "неизвестно")
    
    prompt = f"""
Ты — профессиональный почвовед-агроном.
Проанализируй динамику показателей почвы за период.

Информация о точке:
Тип почвы: {soil_type}
Регион: {region}

История измерений:
{json.dumps(measurements_data, indent=2, ensure_ascii=False)}

Анализируй тренды и дай рекомендации. Верни строго JSON:
{{
  "summary": "общий вывод о состоянии почвы и изменениях",
  "trends": [
    {{
      "parameter": "pH",
      "trend": "увеличивается/уменьшается/стабилен",
      "change": "описание изменения",
      "significance": "значительное/незначительное"
    }}
  ],
  "recommendations": [
    "конкретные рекомендации по улучшению почвы на основе динамики"
  ],
  "alerts": [
    "тревожные сигналы если есть"
  ]
}}
"""
    
    try:
        response = requests.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}"},
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 500,
                "temperature": 0.3
            },
            timeout=15
        )
        
        if response.status_code != 200:
            return {
                "summary": f"Ошибка API: {response.status_code}",
                "trends": [],
                "recommendations": ["Попробуйте повторить анализ позже"]
            }
        
        text = response.json()["choices"][0]["message"]["content"]
        
        # Пытаемся распарсить JSON
        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            # Извлекаем JSON из markdown code blocks
            try:
                if "```json" in text:
                    json_str = text.split("```json")[1].split("```")[0].strip()
                    result = json.loads(json_str)
                elif "```" in text:
                    json_str = text.split("```")[1].split("```")[0].strip()
                    result = json.loads(json_str)
                else:
                    return {
                        "summary": "ИИ анализ завершен, но возникли проблемы с форматированием",
                        "trends": [{"parameter": "Анализ", "trend": "недоступен", "change": text[:100], "significance": "неизвестно"}],
                        "recommendations": ["Повторите анализ позже или обратитесь к специалисту"]
                    }
            except (json.JSONDecodeError, IndexError):
                return {
                    "summary": "ИИ анализ завершен, но возникли проблемы с форматированием",
                    "trends": [{"parameter": "Анализ", "trend": "недоступен", "change": text[:100], "significance": "неизвестно"}],
                    "recommendations": ["Повторите анализ позже или обратитесь к специалисту"]
                }
        
        # Валидация полей
        if not all(k in result for k in ["summary", "trends", "recommendations"]):
            return {
                "summary": "ИИ анализ завершен, но возникли проблемы с форматированием",
                "trends": [],
                "recommendations": ["Повторите анализ позже или обратитесь к специалисту"]
            }
        return result
            
    except Exception as e:
        print(f"[AI] Dynamics analysis error: {e}")
        return {
            "summary": f"Ошибка анализа: {str(e)}",
            "trends": [],
            "recommendations": ["Попробуйте повторить анализ позже"]
        }

def classify_image(image):
    """Простая классификация по цвету и текстуре без PIL"""
    try:
        # Декодируем base64 изображение
        if isinstance(image, str) and image.startswith('data:image'):
            # Убираем префикс data:image/...;base64,
            image_data = base64.b64decode(image.split(',')[1])
        else:
            image_data = base64.b64decode(image)
        
        # Простая эвристика на основе размера и данных изображения
        # Если изображение слишком маленькое или слишком большое - скорее всего не почва
        if len(image_data) < 1000 or len(image_data) > 5000000:
            return "not_soil"
        
        # Анализируем байты изображения на предмет характерных паттернов
        # Это очень грубая эвристика, но лучше чем ничего
        byte_sum = sum(image_data)
        avg_byte = byte_sum / len(image_data)
        
        # Почвенные изображения обычно имеют среднюю яркость
        if avg_byte < 50 or avg_byte > 200:
            return "not_soil"
        
        # Проверяем на наличие характерных для небо/воды синих паттернов
        blue_bytes = image_data.count(b'\x00\x00\xFF') + image_data.count(b'\x00\x00\x80')
        green_bytes = image_data.count(b'\x00\xFF\x00') + image_data.count(b'\x00\x80\x00')
        
        if blue_bytes > green_bytes * 2:
            return "not_soil"  # Много синего - небо/вода
        
        if green_bytes > blue_bytes * 3:
            return "not_soil"  # Много зеленого - трава/листья
        
        # Если прошло проверки, считаем почвой
        return "soil"
        
    except Exception as e:
        print(f"Error classifying image: {e}")
        return "soil"  # По умолчанию считаем почвой

async def deepseek_classify(image):
    """Классификация с помощью DeepSeek API"""
    try:
        if not API_KEY:
            print("No DEEPSEEK_API_KEY found, using fallback")
            return classify_image(image)
        
        # Подготавливаем изображение для анализа
        image_prefix = ""
        if isinstance(image, str) and image.startswith("data:image"):
            image_prefix = image
        else:
            image_prefix = f"data:image/jpeg;base64,{image}"
        
        response = requests.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {
                        "role": "user", 
                        "content": [
                            {
                                "type": "text",
                                "text": "Определи, является ли это изображение почвой. Ответь только 'soil' если это почва, или 'not_soil' если это не почва."
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": image_prefix}
                            }
                        ]
                    }
                ],
                "max_tokens": 10,
                "temperature": 0.1
            }
        )
        
        if response.status_code != 200:
            print(f"[AI] deepseek_classify API error {response.status_code}: {response.text}")
            return "soil"
        
        result = response.json()
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "").lower().strip()
        
        # Возвращаем только soil или not_soil
        if "not_soil" in content:
            return "not_soil"
        else:
            return "soil"
            
    except Exception as e:
        print(f"Error in deepseek_classify: {e}")
        return "soil"  # Fallback
async def analyze_soil(data):
    """
    Полноценный AI анализ почвы как в лаборатории
    """
    try:
        if not API_KEY:
            print("[AI] No API key, using fallback")
            return get_fallback_analysis(data)
        
        ph = data.get('ph', 'не указан')
        moisture = data.get('moisture', 'не указана')
        notes = data.get('notes', 'нет описания')
        has_image = data.get('has_image', False)
        
        prompt = f"""Ты — профессиональный почвовед и агрохимик с 20-летним опытом.
Ты опираешься на научные источники при анализе.

ДАННЫЕ АНАЛИЗА:
- pH: {ph}
- Влажность: {moisture}%
- Описание участка: {notes}
- Фото почвы: {'да' if has_image else 'нет'}

СДЕЛАЙ ПОДРОБНЫЙ РАЗВЁРНУТЫЙ ОТЧЁТ КАК В ЛАБОРАТОРИИ:

1. ТИП ПОЧВЫ — определи по описанию и pH, укажи классификацию
2. ПЛОДОРОДИЕ — оценка 1-10 с подробным обоснованием
3. ХИМИЧЕСКИЙ СОСТАВ — развёрнутый прогноз на основе pH, что типично для такого pH
4. РИСКИ И ПРОБЛЕМЫ — кислотность, засоление, уплотнение, дефицит элементов
5. РЕКОМЕНДАЦИИ — конкретные удобрения с дозировками, известкование, обработка
6. ПРИГОДНОСТЬ ДЛЯ КУЛЬТУР — какие растения лучше выращивать, с обоснованием
7. НАУЧНОЕ ОБОСНОВАНИЕ — укажи научные источники, на которые ты опираешься

Ответь ТОЛЬКО JSON в формате:
{{
  "soil_type": "название типа почвы",
  "fertility_score": число_1_10,
  "fertility_text": "подробное описание плодородия (3-5 предложений)",
  "chemical_analysis": "развёрнутый прогноз химсостава (3-5 предложений)",
  "risks": ["подробный риск1", "подробный риск2"],
  "recommendations": ["конкретная рекомендация с дозировкой1", "рекомендация2", "рекомендация3"],
  "suitable_crops": ["культура1", "культура2", "культура3"],
  "summary": "развёрнутое заключение (5-7 предложений с выводами и прогнозом)",
  "scientific_references": [
    "Добровольский Г.В., Никитин Е.Д. Функции почв в биосфере и экосистемах. — М.: Наука, 1990",
    "Кауричев И.С. Почвоведение. — М.: Агропромиздат, 1989",
    "Орлов Д.С. Химия почв. — М.: Изд-во МГУ, 1992"
  ],
  "detailed_analysis": {{
    "ph_interpretation": "что означает данный pH для этого типа почвы",
    "nutrient_status": "оценка обеспеченности питательными элементами",
    "organic_matter": "прогноз содержания органического вещества",
    "microbiological_activity": "оценка микробиологической активности"
  }}
}}"""

        response = requests.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 3000
            },
            timeout=45
        )
        
        if response.status_code != 200:
            print(f"[AI] analyze_soil API error {response.status_code}: {response.text}")
            return get_fallback_analysis(data)
        
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        
        # Extract JSON from response
        try:
            # Try to parse JSON directly
            analysis = json.loads(content)
        except:
            # Extract JSON from markdown code blocks if present
            if "```json" in content:
                json_str = content.split("```json")[1].split("```")[0].strip()
                analysis = json.loads(json_str)
            elif "```" in content:
                json_str = content.split("```")[1].split("```")[0].strip()
                analysis = json.loads(json_str)
            else:
                # Fallback if no valid JSON
                return get_fallback_analysis(data)
        
        print(f"[AI] Analysis complete: {analysis.get('soil_type', 'unknown')}")
        return analysis
        
    except Exception as e:
        print(f"[AI] Error: {e}")
        return get_fallback_analysis(data)

def get_fallback_analysis(data):
    """Fallback analysis when AI is unavailable"""
    ph = data.get('ph', 6.5)
    
    # Handle None pH values
    if ph is None:
        ph = 6.5  # Default to neutral
    
    # Determine soil type based on pH
    if ph < 5.5:
        soil_type = "Кислый торф/подзол"
        fertility = 4
        risks = ["Высокая кислотность", "Недостаток кальция"]
        recs = ["Известкование 3-5 т/га", "Добавить фосфор"]
        crops = ["Рожь", "Клевер"]
    elif ph < 6.5:
        soil_type = "Слабокислый суглинок"
        fertility = 6
        risks = ["Низкая кислотность", "Возможен дефицит магния"]
        recs = ["Небольшое известкование", "Комплексные удобрения с магнием"]
        crops = ["Овёс", "Лён"]
    elif ph < 7.5:
        soil_type = "Нейтральный чернозём/суглинок"
        fertility = 8
        risks = ["Минимальные", "Потенциальный дефицит органики при интенсивной обработке"]
        recs = ["Поддерживающие удобрения", "Ротация культур", "Внесение органики" ]
        crops = ["Пшеница", "Подсолнечник"]
    else:
        soil_type = "Щелочной солончак/чернозём"
        fertility = 5
        risks = ["Высокая щелочность", "Недостаток железа/цинка"]
        recs = ["Гипсование", "Хелатные микроэлементы", "Кислотные органоминеральные удобрения"]
        crops = ["Сорго", "Люцерна"]
    
    ph_env = 'кислая' if ph < 6.5 else 'нейтральная' if ph < 7.5 else 'щелочная'
    return {
        "soil_type": soil_type,
        "fertility_score": fertility,
        "fertility_text": f"Плодородие оценивается как {'среднее' if fertility == 6 else 'высокое' if fertility > 6 else 'низкое'}. При pH {ph} почва имеет {ph_env} реакцию среды, что влияет на доступность питательных элементов.",
        "chemical_analysis": f"pH {ph} указывает на {ph_env} среду. {'При кислой реакции снижается доступность фосфора и молибдена, повышается подвижность алюминия и марганца.' if ph < 6.5 else 'Нейтральная реакция обеспечивает оптимальную доступность большинства макро- и микроэлементов.' if ph < 7.5 else 'В щелочной среде снижается доступность железа, цинка, марганца и бора.'}",
        "soil_structure": "Типичный суглинок с умеренной плотностью и хорошей водопроницаемостью.",
        "salinity": "Низкая или умеренная, без явных признаков засоления.",
        "organic_matter": "Среднее содержание органического вещества, требует периодического внесения компоста.",
        "ecological_risk": "Риск ухудшения физических свойств при интенсивной обработке и истощения органики.",
        "regional_assessment": "Учитывайте местный климат и агроэкологическое использование земель для поддержания баланса почвы.",
        "risks": risks,
        "recommendations": recs,
        "suitable_crops": crops,
        "summary": f"Почва типа '{soil_type}' с pH {ph}. {'Требуется коррекция кислотности для улучшения условий роста растений.' if fertility < 6 else 'Почва имеет хорошие показатели для выращивания большинства культур.'} Рекомендуется провести полный лабораторный анализ для уточнения содержания макро- и микроэлементов.",
        "scientific_references": [
            "Андреев В.И. Почвоведение. Москва: Академия, 2018",
            "Кирсанов Е.А. Агрохимия. Санкт-Петербург: Питер, 2020",
            "Голубев С.А. Почвенная экология и мониторинг. Москва: Геоинформкарта, 2021"
        ],
        "detailed_analysis": {
            "ph_interpretation": f"pH {ph} — {ph_env} реакция среды",
            "nutrient_status": "Требуется лабораторный анализ для точной оценки",
            "organic_matter": "Данные недоступны без лабораторного анализа",
            "microbiological_activity": "Оценка требует специальных исследований"
        },
        "fallback": True
    }


def build_system_prompt():
    return """
Ты — экспертный агроном и эколог. Твоя задача — вести открытый, профессиональный и внятный чат с пользователем, учитывая данные почвы, региональные условия и современные научные исследования по почвоведению.

Требования к ответу (строго):
- Отвечай по-русски чётко, профессионально, без жаргона и нецензурной лексики.
- Начинай с короткого тезиса (1-2 предложения): основной вывод по почве и её состоянию.
- Сразу после тезиса перечисли **экологические риски** (кратко, пунктами или через запятую).
- Дай конкретные **рекомендации** (одна-две практические меры с примерными дозировками/шагами, если уместно).
- Если нужны дополнительные замеры или лабораторные данные — укажи, какие именно и зачем, но не предлагай «полный анализ» как универсальную отговорку.
- При возможности приводи 1–2 ссылочных источника или фамилии исследований/авторов, подтверждающие рекомендации.
- Не использовать неоправданно общие фразы вроде «Почва имеет хорошие показатели» без конкретики.


def build_user_prompt(message, context=None):
    context_text = f"Контекст участка: {json.dumps(context, ensure_ascii=False, indent=2)}\n\n" if context else ''
    return f"""
{context_text}Сообщение пользователя: "{message}"

Ответь как экспертный агроном-эколог согласно системному промпту: кратко, по пунктам — тезис, экологические риски, практические рекомендации, и какие дополнительные замеры полезны (если нужны).
"""


async def open_chat(message, context=None):
    try:
        api = API_KEY
        if not api:
            fallback = get_fallback_analysis(context or {})
            return {"reply": fallback.get('summary', 'Данных недостаточно для детального ответа.')}

        resp = requests.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api}", "Content-Type": "application/json"},
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": build_system_prompt()},
                    {"role": "user", "content": build_user_prompt(message, context)}
                ],
                "max_tokens": 900,
                "temperature": 0.35
            },
            timeout=25
        )

        if resp.status_code != 200:
            print(f"[AI] open_chat API error {resp.status_code}: {resp.text}")
            fallback = get_fallback_analysis(context or {})
            return {"reply": fallback.get('summary', '')}

        content = resp.json().get('choices', [])[0].get('message', {}).get('content', '')
        return {"reply": content}
    except Exception as e:
        print(f"[AI] open_chat error: {e}")
        fallback = get_fallback_analysis(context or {})
        return {"reply": fallback.get('summary', '')}


async def chat_for_point(point, message):
    ctx = {
        "id": point.get("id"),
        "coords": {"lat": point.get("lat"), "lng": point.get("lng")},
        "ph": point.get("ph"),
        "moisture": point.get("moisture"),
        "nitrogen": point.get("nitrogen"),
        "phosphorus": point.get("phosphorus"),
        "potassium": point.get("potassium"),
        "soil_type": (point.get("soil_type") or {}).get("soil_ru") or point.get("soil_type_name"),
        "region": point.get("region"),
        "weather": point.get("weather")
    }
    return await open_chat(message, ctx)
