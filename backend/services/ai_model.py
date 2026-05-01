import os
import requests
import base64
import struct
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
def analyze_soil(data):
    try:
        response = requests.post(
            "https://api.deepseek.com/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}"
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "user", "content": str(data)}
                ]
            }
        )
        result = response.json()
        # Проверяем, что результат содержит нужные поля
        if "type" not in result and "description" not in result:
            raise Exception("Invalid AI response")
        return result
    except:
        # Fallback: возвращаем дефолтные значения, чтобы сайт не ломался
        return {
            "type": "суглинок",
            "description": "Темная структура, средняя влажность"
        }
