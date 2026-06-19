import json
import os
from typing import Any, Dict, List, Optional

import requests

API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"


def call_deepseek(
    prompt: str,
    *,
    max_tokens: int = 500,
    temperature: float = 0.3,
    timeout: int = 15,
    required_fields: Optional[List[str]] = None,
    fallback: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Send a prompt to the DeepSeek chat API and parse JSON from the response.

    Parameters
    ----------
    prompt : str
        The user message to send.
    max_tokens : int
        Maximum tokens in the response.
    temperature : float
        Sampling temperature.
    timeout : int
        Request timeout in seconds.
    required_fields : list[str] | None
        If set, the parsed JSON must contain all these keys.
    fallback : dict | None
        Returned when the API call fails or the response can't be parsed.

    Returns
    -------
    dict
        Parsed JSON from the AI response, or *fallback* on any error.
    """
    if fallback is None:
        fallback = {}

    if not API_KEY:
        print("[DEEPSEEK] No API key configured")
        return fallback

    try:
        response = requests.post(
            DEEPSEEK_API_URL,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            timeout=timeout,
        )

        if response.status_code != 200:
            print(f"[DEEPSEEK] API error: {response.status_code}")
            return fallback

        text = response.json()["choices"][0]["message"]["content"]
        result = _parse_json_response(text)

        if result is None:
            print("[DEEPSEEK] Failed to parse JSON from response")
            return fallback

        if required_fields and not all(k in result for k in required_fields):
            print(f"[DEEPSEEK] Missing required fields: {required_fields}")
            return fallback

        return result

    except Exception as e:
        print(f"[DEEPSEEK] Request error: {e}")
        return fallback


def _parse_json_response(text: str) -> Optional[Dict[str, Any]]:
    """Try to extract a JSON object from raw AI text."""
    # Direct parse
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        pass

    # Try markdown code block
    if "```json" in text:
        try:
            json_str = text.split("```json")[1].split("```")[0].strip()
            return json.loads(json_str)
        except (json.JSONDecodeError, ValueError, IndexError):
            pass

    if "```" in text:
        try:
            json_str = text.split("```")[1].split("```")[0].strip()
            return json.loads(json_str)
        except (json.JSONDecodeError, ValueError, IndexError):
            pass

    return None
