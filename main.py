import sys
sys.path.append('/app')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import os

print("🔥 STARTED")

from backend.api.routes import router as main_router
from backend.api.calculator import router as calc_router
from backend.api.health import router as health_router
from backend.api.points import router as points_router
from backend.api.horizons import router as horizons_router
from backend.routes.dem import router as dem_router

app = FastAPI(title="LIREN API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(main_router, prefix="/api")
app.include_router(calc_router, prefix="/api")
app.include_router(health_router, prefix="/api")
app.include_router(points_router, prefix="/api")
app.include_router(horizons_router, prefix="/api")
app.include_router(dem_router, prefix="/api/dem")

@app.get("/")
def root():
    frontend_path = os.path.join(os.path.dirname(__file__), "frontend")
    index_file = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_file):
        with open(index_file, encoding="utf-8") as f:
            return HTMLResponse(f.read())
    return {"status": "OK"}

if os.path.exists("frontend"):
    app.mount("/static", StaticFiles(directory="frontend"), name="static")
