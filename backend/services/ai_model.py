import os
import httpx
import base64

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

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
