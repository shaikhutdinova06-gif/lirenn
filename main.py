import sys
sys.path.append('/app')
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
import os
from backend.api.routes import router
app = FastAPI()
print("🔥 STARTED")
# =========================
# SECURITY HEADERS (FIXED)
# =========================
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # ❗ CSP ПОПРАВЛЕН
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdn.plot.ly; "
        "style-src 'self' 'unsafe-inline' https://unpkg.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https:;"
    )
    return response
# =========================
# TRUSTED HOST (FIX)
# =========================
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # временно так
)
# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# =========================
# API
# =========================
app.include_router(router, prefix="/api")
# =========================
# FRONTEND PATH FIX
# =========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
# =========================
# STATIC (ВАЖНО)
# =========================
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
# =========================
# ROOT (FIX)
# =========================
@app.get("/", response_class=HTMLResponse)
def root():
    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_file):
        with open(index_file, encoding="utf-8") as f:
            return f.read()
    return "<h1>Frontend not found</h1>"
