from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Threshold

DEFAULT_SSIM_MIN = 0.85
DEFAULT_MATCH_RATIO_MIN = 0.20
DEFAULT_INLIERS_MIN = 20
DEFAULT_HOMOGRAPHY_INLIER_RATIO_MIN = 0.40


async def get_active(session: AsyncSession) -> Threshold:
    result = await session.execute(
        select(Threshold).where(Threshold.is_active.is_(True)).limit(1)
    )
    active = result.scalar_one_or_none()

    if active is not None:
        return active

    # If no threshold exists, create one with defaults
    active = Threshold(
        ssim_min=DEFAULT_SSIM_MIN,
        match_ratio_min=DEFAULT_MATCH_RATIO_MIN,
        inliers_min=DEFAULT_INLIERS_MIN,
        homography_inlier_ratio_min=DEFAULT_HOMOGRAPHY_INLIER_RATIO_MIN,
        is_active=True,
    )
    session.add(active)
    await session.commit()
    await session.refresh(active)
    return active
