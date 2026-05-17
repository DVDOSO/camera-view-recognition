from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.services.storage import ensure_dirs
from app.routers import cameras, images, generate, metrics


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_dirs()
    yield


app = FastAPI(title="Camera View Recognition", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/storage", StaticFiles(directory=str(settings.storage_dir)), name="storage")


@app.get("/healthz", tags=["health"])
async def healthz():
    return {"status": "ok"}


app.include_router(cameras.router)
app.include_router(images.router)
app.include_router(generate.router)
app.include_router(metrics.router)
