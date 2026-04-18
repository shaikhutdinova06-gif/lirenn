import os
import httpx

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

async def deepseek_classify(image):
    return "soil"  # временно заглушка

async def deepseek_analyze(prompt):
    url = "https://api.deepseek.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": prompt}]
    }
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=data, headers=headers)
        return res.json()
