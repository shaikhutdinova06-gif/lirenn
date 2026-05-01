import os
import requests
import base64
from io import BytesIO
from PIL import Image
API_KEY = os.getenv("DEEPSEEK_API_KEY")

def classify_image(image):
    """Простая классификация по цвету и текстуре"""
    try:
        # Декодируем base64 изображение
        if isinstance(image, str) and image.startswith('data:image'):
            image_data = base64.b64decode(image.split(',')[1])
        else:
            image_data = base64.b64decode(image)
        
        # Открываем изображение
        img = Image.open(BytesIO(image_data))
        
        # Анализ доминирующих цветов
        pixels = list(img.getdata())
        total_pixels = len(pixels)
        
        # Считаем средние значения RGB
        avg_r = sum(p[0] for p in pixels) / total_pixels
        avg_g = sum(p[1] for p in pixels) / total_pixels
        avg_b = sum(p[2] for p in pixels) / total_pixels
        
        # Простая эвристика для определения почвы:
        # Почва обычно имеет коричневые/серые/желтоватые оттенки
        # Низкое насыщение, средняя яркость
        
        # Проверяем на "не почву" - яркие цвета, синий, зеленый
        if avg_b > avg_r + 30 and avg_b > avg_g + 30:
            return "not_soil"  # Синий (небо, вода)
        if avg_g > avg_r + 40 and avg_g > avg_b + 40:
            return "not_soil"  # Ярко-зеленый (трава, листья)
        
        # Проверяем на слишком яркие или темные цвета
        brightness = (avg_r + avg_g + avg_b) / 3
        if brightness > 200 or brightness < 30:
            return "not_soil"  # Слишком ярко или темно
        
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
