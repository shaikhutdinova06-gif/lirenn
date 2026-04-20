import os
import httpx
import base64

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def analyze_image_gemini(image):
    """
    Анализ изображения с Google Gemini
    """
    if not GEMINI_API_KEY:
        return "GEMINI_API_KEY не настроен"
    
    try:
        # Декодируем base64 изображение если нужно
        if image.startswith("data:image"):
            image_data = image.split(",")[1]
        else:
            image_data = image
        
        url = f"https://generativelanguage.googleapis.com/v1/models/gemini-pro-vision:generateContent?key={GEMINI_API_KEY}"
        
        payload = {
            "contents": [{
                "parts": [
                    {"text": "Это почва? Определи тип, цвет, структуру, плотность, особенности. Ответь в формате JSON с полями: soil_type, color, structure, density, features"},
                    {"inline_data": {
                        "mime_type": "image/jpeg",
                        "data": image_data
                    }}
                ]
            }]
        }
        
        response = httpx.post(url, json=payload, timeout=30.0)
        result = response.json()
        
        if "candidates" in result and len(result["candidates"]) > 0:
            return result["candidates"][0]["content"]["parts"][0]["text"]
        else:
            return "Ошибка Gemini API"
            
    except Exception as e:
        return f"Ошибка: {str(e)}"

def call_deepseek(messages):
    """
    Общая функция для вызова DeepSeek с контекстом
    """
    if not DEEPSEEK_API_KEY:
        return "AI API ключ не настроен"
    
    try:
        url = "https://api.deepseek.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "deepseek-chat",
            "messages": messages,
            "temperature": 0.3
        }
        
        response = httpx.post(url, headers=headers, json=payload, timeout=30.0)
        if response.status_code != 200:
            return f"Ошибка API: {response.text}"
        
        return response.json()["choices"][0]["message"]["content"]
        
    except Exception as e:
        return f"Ошибка: {str(e)}"

async def deepseek_classify(image):
    """
    Классификация изображения: почва или не почва
    Возвращает: "soil" или "not_soil"
    """
    if not DEEPSEEK_API_KEY:
        # Если нет API ключа, используем базовую эвристику
        return "soil"
    
    try:
        # Декодируем base64 изображение если нужно
        if image.startswith("data:image"):
            image_data = image.split(",")[1]
        else:
            image_data = image
        
        url = "https://api.deepseek.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        
        prompt = """Проанализируй это изображение и определи: содержит ли оно образец почвы?
Почва - это: профиль почвы, разрез почвы, поверхность участка с грунтом, образец почвы в контейнере.
НЕ почва - это: растения, инструменты, строительные материалы, животные, люди, любые другие объекты.
Ответь ТОЛЬКО одним словом: soil или not_soil"""
        
        data = {
            "model": "deepseek-chat",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
                    ]
                }
            ],
            "max_tokens": 10
        }
        
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=data, headers=headers, timeout=30.0)
            result = res.json()
            
            if "choices" in result and len(result["choices"]) > 0:
                response = result["choices"][0]["message"]["content"].strip().lower()
                if "soil" in response and "not" not in response:
                    return "soil"
                else:
                    return "not_soil"
            
            return "soil"  # По умолчанию считаем почвой при ошибке
            
    except Exception as e:
        print(f"Error in deepseek_classify: {e}")
        return "soil"  # При ошибке считаем почвой

async def deepseek_analyze(prompt):
    """
    Анализ с помощью DeepSeek
    Возвращает: результат анализа в формате JSON
    """
    if not DEEPSEEK_API_KEY:
        return {"error": "DEEPSEEK_API_KEY не установлен"}
    
    try:
        url = "https://api.deepseek.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        data = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1000
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=data, headers=headers, timeout=30.0)
            result = res.json()
            
            if "choices" in result and len(result["choices"]) > 0:
                return {
                    "analysis": result["choices"][0]["message"]["content"],
                    "raw": result
                }
            else:
                return {"error": "Неверный формат ответа от DeepSeek"}
                
    except Exception as e:
        print(f"Error in deepseek_analyze: {e}")
        return {"error": str(e)}
