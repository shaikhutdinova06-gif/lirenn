from fastapi import Request, HTTPException
from backend.services.auth import get_current_user


def require_auth(request: Request) -> dict:
    """Extract and validate Bearer token from request, returning the user dict.

    Raises HTTPException 401 if the token is missing or invalid.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")

    token = auth_header.replace("Bearer ", "")
    user = get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user


def get_client_ip(request: Request) -> str:
    """Extract the real client IP from proxy headers or the connection."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    return request.client.host if request.client else "unknown"
