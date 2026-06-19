import sys
sys.path.append('/app')
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
import os
from backend.api.routes import router

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "https://liren-androsova6565.amvera.io,http://localhost,http://localhost:8000"
).split(",")

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
        "img-src 'self' data: https://*.tile.openstreetmap.org https://gibs.earthdata.nasa.gov https://server.arcgisonline.com https://services.sentinel-hub.com; "
        "connect-src 'self' https://nominatim.openstreetmap.org https://gibs.earthdata.nasa.gov https://api.deepseek.com https://services.sentinel-hub.com;"
    )
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self)"
    if request.url.path.startswith("/static"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["liren-androsova6565.amvera.io", "localhost", "127.0.0.1"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router, prefix="/api")

@app.get("/")
def root():
    with open("frontend/index.html", encoding="utf-8") as f:
        return HTMLResponse(f.read())

app.mount("/static", StaticFiles(directory="frontend"), name="static")
