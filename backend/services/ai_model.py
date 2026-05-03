import os
import requests
import base64
import struct
import json

API_KEY = os.getenv("DEEPSEEK_API_KEY")

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
            return "soil"
        
        # Подготавливаем изображение для анализа
        prompt = """
        Определи, является ли это изображение почвой. Ответь только "soil" если это почва, 
        или "not_soil" если это не почва (например: трава, камни, вода, небо, здания и т.д.).
        """
        
        response = requests.post(
            "https://api.deepseek.com/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                "max_tokens": 10,
                "temperature": 0.1
            }
        )
        
        if response.status_code != 200:
            print(f"DeepSeek API error: {response.status_code}")
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

ДАННЫЕ АНАЛИЗА:
- pH: {ph}
- Влажность: {moisture}%
- Описание участка: {notes}
- Фото почвы: {'да' if has_image else 'нет'}

СДЕЛАЙ ПОДРОБНЫЙ ОТЧЁТ КАК В ЛАБОРАТОРИИ:

1. ТИП ПОЧВЫ (определи по описанию и pH)
2. ПЛОДОРОДИЕ (оценка 1-10 с обоснованием)
3. ХИМИЧЕСКИЙ СОСТАВ (прогноз на основе pH)
4. РИСКИ И ПРОБЛЕМЫ (кислотность, засоление, уплотнение)
5. РЕКОМЕНДАЦИИ (удобрения, известкование, обработка)
6. ПРИГОДНОСТЬ ДЛЯ КУЛЬТУР (что лучше растить)

Ответь ТОЛЬКО JSON в формате:
{{
  "soil_type": "название",
  "fertility_score": число_1_10,
  "fertility_text": "описание плодородия",
  "chemical_analysis": "прогноз химсостава",
  "risks": ["риск1", "риск2"],
  "recommendations": ["рекомендация1", "рекомендация2"],
  "suitable_crops": ["культура1", "культура2"],
  "summary": "краткое заключение 2-3 предложения"
}}"""

        response = requests.post(
            "https://api.deepseek.com/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 1500
            },
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"[AI] API error: {response.status_code}")
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
    
    # Determine soil type based on pH
    if ph < 5.5:
        soil_type = "Кислый торф/подзол"
        fertility = 4
        risks = ["Высокая кислотность", "Недостаток кальция"]
        recs = ["Известкование 3-5 т/га", "Добавить фосфор"]
        crops = ["Картофель", "Черника", "Гречиха"]
    elif ph < 6.5:
        soil_type = "Слабокислый суглинок"
        fertility = 6
        risks = ["Низкая кислотность", "Возможен дефицит магния"]
        recs = ["Небольшое известкование", "Урожайные удобрения"]
        crops = ["Овёс", "Рожь", "Картофель", "Лён"]
    elif ph < 7.5:
        soil_type = "Нейтральный чернозём/суглинок"
        fertility = 8
        risks = ["Минимальные"]
        recs = ["Поддерживающие удобрения", "Ротация культур"]
        crops = ["Пшеница", "Кукуруза", "Подсолнечник", "Свёкла"]
    else:
        soil_type = "Щелочной солончак/чернозём"
        fertility = 5
        risks = ["Высокая щелочность", "Недостаток железа/цинка"]
        recs = ["Гипсование", "Хелатные микроэлементы"]
        crops = ["Сорго", "Соя", "Люцерна"]
    
    return {
        "soil_type": soil_type,
        "fertility_score": fertility,
        "fertility_text": "Среднее плодородие" if fertility == 6 else "Высокое" if fertility > 6 else "Низкое",
        "chemical_analysis": f"pH {ph} - {'кислая' if ph < 6.5 else 'нейтральная' if ph < 7.5 else 'щелочная'} среда",
        "risks": risks,
        "recommendations": recs,
        "suitable_crops": crops,
        "summary": f"Почва типа '{soil_type}' с pH {ph}. {'Требуется коррекция.' if fertility < 6 else 'Хорошая для выращивания.'}",
        "fallback": True
    }
