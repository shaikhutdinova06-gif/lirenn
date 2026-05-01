import os
import requests
API_KEY = os.getenv("DEEPSEEK_API_KEY")
def classify_image(image):
    return "soil"  # заглушка (можно заменить на реальный вызов)
async def deepseek_classify(image):
    return "soil"  # заглушка для классификации
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
