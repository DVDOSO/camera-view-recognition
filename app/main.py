from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.services.storage import ensure_dirs
from app.routers import cameras, images, generate, metrics


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_dirs()
    yield


app = FastAPI(title="Camera View Recognition", lifespan=lifespan)


@app.get("/healthz", tags=["health"])
async def healthz():
    return {"status": "ok"}


app.include_router(cameras.router)
app.include_router(images.router)
app.include_router(generate.router)
app.include_router(metrics.router)
