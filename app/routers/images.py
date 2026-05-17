import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models import Image
from app.schemas import ImageOut, LabelUpdate
from app.services import storage
from app.services.comparison import compare
from app.services.thresholds import get_active

router = APIRouter(prefix="/images", tags=["images"])


@router.get("", response_model=list[ImageOut])
async def list_all_images(
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Image).order_by(Image.timestamp.desc()).offset(offset).limit(limit)
    )
    return result.scalars().all()


@router.get("/{camera_id}", response_model=list[ImageOut])
async def list_images_for_camera(
    camera_id: uuid.UUID,
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Image)
        .where(Image.camera_id == camera_id)
        .order_by(Image.timestamp.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/compare", response_model=ImageOut, status_code=status.HTTP_201_CREATED)
async def compare_image(
    camera_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    from app.models import Camera
    camera = await session.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "camera not found")
    if not camera.base_image_paths:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "camera has no base images registered")

    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "uploaded file is empty")

    captured_path = storage.save_bytes(data, settings.captures_dir)

    thresholds = await get_active(session)
    try:
        result = compare(
            captured_path=captured_path,
            base_image_paths=camera.base_image_paths,
            ssim_min=thresholds.ssim_min,
            match_ratio_min=thresholds.match_ratio_min,
            inliers_min=thresholds.inliers_min,
            homography_inlier_ratio_min=thresholds.homography_inlier_min,
        )
    except FileNotFoundError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    image = Image(
        camera_id=camera_id,
        image_path=str(captured_path),
        base_image_path=result.base_image_path,
        ssim_score=result.ssim_score,
        match_ratio=result.match_ratio,
        inliers=result.inliers,
        homography_inlier_ratio=result.homography_inlier_ratio,
        script_decision=result.script_decision,
    )
    session.add(image)
    await session.commit()
    await session.refresh(image)
    return image


@router.patch("/{image_id}/label", response_model=ImageOut)
async def label_image(
    image_id: uuid.UUID,
    payload: LabelUpdate,
    session: AsyncSession = Depends(get_session),
):
    image = await session.get(Image, image_id)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "image not found")
    image.human_label = payload.human_label
    await session.commit()
    await session.refresh(image)
    return image


@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(image_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    image = await session.get(Image, image_id)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "image not found")
    await session.delete(image)
    await session.commit()
