import os
import requests
API_KEY = os.getenv("DEEPSEEK_API_KEY")
def classify_image(image):
    return "soil"  # заглушка (можно заменить на реальный вызов)
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
        return response.json()
    except:
        return {"error": "AI failed"}
