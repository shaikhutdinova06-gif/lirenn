import sys
sys.path.append('/app')

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os

print("🔥 STARTED")

from backend.api.routes import router as main_router
from backend.api.calculator import router as calc_router
from backend.api.health import router as health_router
from backend.api.points import router as points_router
from backend.api.horizons import router as horizons_router
from backend.routes.dem import router as dem_router

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="LIREN API",
    docs_url=None,
    redoc_url=None
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdn.plot.ly; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https:; connect-src 'self' https://unpkg.com;"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    return response

# Trusted host middleware - only allow requests from specific domain
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["liren-androsova6565.amvera.io", "localhost"]
)

# CORS - restrict to specific origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://liren-androsova6565.amvera.io", "http://localhost"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=True,
)

app.include_router(main_router, prefix="/api")
app.include_router(calc_router, prefix="/api")
app.include_router(health_router, prefix="/api")
app.include_router(points_router, prefix="/api")
app.include_router(horizons_router, prefix="/api")
app.include_router(dem_router, prefix="/api/dem")

@app.get("/")
@limiter.limit("100/minute")
def root(request: Request):
    frontend_path = os.path.join(os.path.dirname(__file__), "frontend")
    index_file = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_file):
        with open(index_file, encoding="utf-8") as f:
            return HTMLResponse(f.read())
    return {"status": "OK"}

if os.path.exists("frontend"):
    app.mount("/static", StaticFiles(directory="frontend"), name="static")
