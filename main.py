from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

from backend.api.routes import router as main_router
from backend.api.calculator import router as calc_router
from backend.api.health import router as health_router

app = FastAPI(title="LIREN")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(main_router, prefix="/api")
app.include_router(calc_router, prefix="/api")
app.include_router(health_router, prefix="/api")

@app.get("/")
def root():
    with open("frontend/index.html", encoding="utf-8") as f:
        return HTMLResponse(f.read())

app.mount("/static", StaticFiles(directory="frontend"), name="static")
