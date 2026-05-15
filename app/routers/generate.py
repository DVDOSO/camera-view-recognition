import random
import uuid

import cv2
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models import Camera, HumanLabel, Image
from app.schemas import GenerateBatchRequest, GenerateBatchResponse
from app.services import storage
from app.services.comparison import compare
from app.services.thresholds import get_active
from app.services.synthetic.synthetic_generator import Label as SynthLabel, generate_batch

router = APIRouter(prefix="/generate", tags=["generate"])

_SYNTH_TO_HUMAN = {
    SynthLabel.NORMAL: HumanLabel.NORMAL,
    SynthLabel.OBSTRUCTED: HumanLabel.OBSTRUCTED,
    SynthLabel.MOVED: HumanLabel.MOVED,
}


@router.post("", response_model=GenerateBatchResponse, status_code=status.HTTP_201_CREATED)
async def generate_synthetic_batch(
    payload: GenerateBatchRequest,
    session: AsyncSession = Depends(get_session),
):
    camera = await session.get(Camera, payload.camera_id)
    if camera is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "camera not found")
    if not camera.base_image_paths:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "camera has no base images registered")

    rng = random.Random(payload.seed)
    base_path = rng.choice(camera.base_image_paths)
    base_img = cv2.imread(base_path)
    if base_img is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"could not read base image: {base_path}")

    samples = generate_batch(base_img, n=payload.n, seed=payload.seed)
    thresholds = await get_active(session)

    created_ids: list[uuid.UUID] = []
    for sample in samples:
        captured_path = storage.save_array(sample.image, settings.captures_dir)

        result = compare(
            captured_path=captured_path,
            base_image_paths=camera.base_image_paths,
            ssim_min=thresholds.ssim_min,
            match_ratio_min=thresholds.match_ratio_min,
            inliers_min=thresholds.inliers_min,
        )

        image = Image(
            camera_id=camera.camera_id,
            image_path=str(captured_path),
            base_image_path=result.base_image_path,
            ssim_score=result.ssim_score,
            match_ratio=result.match_ratio,
            inliers=result.inliers,
            script_decision=result.script_decision,
            synthetic_label=_SYNTH_TO_HUMAN[sample.label],
            synthetic_transform=sample.transform,
            synthetic_params=sample.params,
        )
        session.add(image)
        await session.flush()
        created_ids.append(image.image_id)

    await session.commit()
    return GenerateBatchResponse(generated=len(created_ids), image_ids=created_ids)
