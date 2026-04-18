import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

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

# app.include_router(main_router, prefix="/api")
# app.include_router(calc_router, prefix="/api")
app.include_router(health_router, prefix="/api")
# app.include_router(points_router, prefix="/api")
# app.include_router(horizons_router, prefix="/api")
# app.include_router(dem_router, prefix="/api/dem")

@app.get("/")
def root():
    with open("frontend/index.html", encoding="utf-8") as f:
        return HTMLResponse(f.read())

static_path = os.path.join(os.path.dirname(__file__), "frontend")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")
