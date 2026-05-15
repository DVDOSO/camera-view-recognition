from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.services.storage import ensure_dirs


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_dirs()
    yield


app = FastAPI(title="Camera View Recognition", lifespan=lifespan)


@app.get("/healthz", tags=["health"])
async def healthz():
    return {"status": "ok"}