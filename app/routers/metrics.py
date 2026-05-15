from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import HumanLabel, Image, Threshold
from app.schemas import MetricsOut, ThresholdOut

router = APIRouter(tags=["metrics"])


def _effective_label(image: Image) -> Optional[HumanLabel]:
    return image.human_label or image.synthetic_label


def _is_positive(label: HumanLabel) -> bool:
    return label in (HumanLabel.OBSTRUCTED, HumanLabel.MOVED)


# Return summary of metrics
@router.get("/metrics", response_model=MetricsOut)
async def metrics(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Image))
    images = result.scalars().all()

    tp = fp = tn = fn = 0
    total_labeled = 0

    for img in images:
        label = _effective_label(img)
        if label is None or label == HumanLabel.OTHER:
            continue
        total_labeled += 1
        actual_positive = _is_positive(label)
        predicted_positive = img.script_decision

        if actual_positive and predicted_positive:
            tp += 1
        elif actual_positive and not predicted_positive:
            fn += 1
        elif not actual_positive and predicted_positive:
            fp += 1
        else:
            tn += 1

    precision = tp / (tp + fp) if (tp + fp) else None
    recall = tp / (tp + fn) if (tp + fn) else None
    f1 = (
        (2 * precision * recall) / (precision + recall)
        if (precision is not None and recall is not None and (precision + recall) > 0)
        else None
    )

    return MetricsOut(
        total_labeled=total_labeled,
        true_positives=tp,
        false_positives=fp,
        true_negatives=tn,
        false_negatives=fn,
        precision=precision,
        recall=recall,
        f1=f1,
    )


# Return history of thresholds
@router.get("/thresholds", response_model=list[ThresholdOut])
async def list_thresholds(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(Threshold).order_by(Threshold.created_at.desc())
    )
    return result.scalars().all()
