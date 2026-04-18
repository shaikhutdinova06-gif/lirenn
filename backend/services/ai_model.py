import os
import requests

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

def deepseek_call(prompt):
    try:
        res = requests.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
        )
        data = res.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        return f"AI error: {str(e)}"

def classify_image():
    return deepseek_call("""
Ты модель классификации.
Ответь строго:
soil или not_soil
Без объяснений.
""")

def analyze_soil(data):
    return deepseek_call(f"""
Дано:
pH: {data.get("ph")}
влажность: {data.get("moisture")}
Сделай ТОЛЬКО структурированное описание:
- тип почвы
- цвет
- структура
- горизонт
БЕЗ рекомендаций.
""")
