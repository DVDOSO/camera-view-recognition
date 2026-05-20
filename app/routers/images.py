import io
import uuid

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
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
            homography_inlier_ratio_min=thresholds.homography_inlier_ratio_min,
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


@router.get("/{image_id}/annotated")
async def get_annotated_image(image_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    image = await session.get(Image, image_id)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "image not found")

    ref_bgr = cv2.imread(image.base_image_path)
    cap_bgr = cv2.imread(image.image_path)
    if ref_bgr is None or cap_bgr is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "image files not found on disk")

    cap_bgr = cv2.resize(cap_bgr, (ref_bgr.shape[1], ref_bgr.shape[0]))

    max_h = 440
    if ref_bgr.shape[0] > max_h:
        scale = max_h / ref_bgr.shape[0]
        new_w = int(ref_bgr.shape[1] * scale)
        ref_bgr = cv2.resize(ref_bgr, (new_w, max_h))
        cap_bgr = cv2.resize(cap_bgr, (new_w, max_h))

    ref_gray = cv2.cvtColor(ref_bgr, cv2.COLOR_BGR2GRAY)
    cap_gray = cv2.cvtColor(cap_bgr, cv2.COLOR_BGR2GRAY)

    orb = cv2.ORB_create(nfeatures=600)
    kp1, des1 = orb.detectAndCompute(ref_gray, None)
    kp2, des2 = orb.detectAndCompute(cap_gray, None)

    annotated = None
    if des1 is not None and des2 is not None and len(kp1) >= 2 and len(kp2) >= 2:
        bf = cv2.BFMatcher(cv2.NORM_HAMMING)
        knn = bf.knnMatch(des1, des2, k=2)
        good = [m for pair in knn if len(pair) == 2 for m, n in [pair] if m.distance < 0.75 * n.distance]

        inlier_pairs: set = set()
        if len(good) >= 4:
            src_pts = np.float32([kp1[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
            dst_pts = np.float32([kp2[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
            _, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
            if mask is not None:
                inlier_pairs = {(good[i].queryIdx, good[i].trainIdx) for i, f in enumerate(mask.ravel()) if f}

        display = sorted(good, key=lambda m: m.distance)[:80]
        draw_mask = [1 if (m.queryIdx, m.trainIdx) in inlier_pairs else 0 for m in display] or None

        annotated = cv2.drawMatches(
            ref_bgr, kp1, cap_bgr, kp2, display, None,
            matchColor=(50, 205, 50),
            singlePointColor=(150, 150, 150),
            matchesMask=draw_mask,
            flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS,
        )

    if annotated is None:
        annotated = np.hstack([ref_bgr, cap_bgr])

    font, scale_f, thick = cv2.FONT_HERSHEY_SIMPLEX, 0.65, 2
    for text, x in [("Reference", 10), ("Captured", ref_bgr.shape[1] + 10)]:
        cv2.putText(annotated, text, (x, 24), font, scale_f, (255, 255, 255), thick)
        cv2.putText(annotated, text, (x, 24), font, scale_f, (30, 30, 30), 1)

    _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return StreamingResponse(io.BytesIO(buf.tobytes()), media_type="image/jpeg")


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
