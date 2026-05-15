import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Camera
from app.schemas import CameraCreate, CameraOut, CameraUpdate

router = APIRouter(prefix="/cameras", tags=["cameras"])


@router.get("", response_model=list[CameraOut])
async def list_cameras(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Camera).order_by(Camera.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=CameraOut, status_code=status.HTTP_201_CREATED)
async def create_camera(payload: CameraCreate, session: AsyncSession = Depends(get_session)):
    camera = Camera(name=payload.name, base_image_paths=payload.base_image_paths)
    session.add(camera)
    await session.commit()
    await session.refresh(camera)
    return camera


@router.patch("/{camera_id}", response_model=CameraOut)
async def update_camera(
    camera_id: uuid.UUID,
    payload: CameraUpdate,
    session: AsyncSession = Depends(get_session),
):
    camera = await session.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "camera not found")
    if payload.name is not None:
        camera.name = payload.name
    if payload.base_image_paths is not None:
        camera.base_image_paths = payload.base_image_paths
    await session.commit()
    await session.refresh(camera)
    return camera


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_camera(camera_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    camera = await session.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "camera not found")
    await session.delete(camera)
    await session.commit()
