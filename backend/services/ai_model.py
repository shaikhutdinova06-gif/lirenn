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
