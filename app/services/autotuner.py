from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import HumanLabel, Image, Threshold


# Tuning configuration
MIN_LABELED_SAMPLES = 30
F1_FLOOR = 0.5

SSIM_RANGE = [round(0.70 + 0.025 * i, 3) for i in range(11)]        # 0.70 -> 0.95
MATCH_RATIO_RANGE = [round(0.10 + 0.05 * i, 3) for i in range(9)]   # 0.10 -> 0.50
INLIERS_RANGE = list(range(5, 55, 5))                               # 5 -> 50
INLIER_RATIO_RANGE = [round(0.20 + 0.05 * i, 3) for i in range(9)]  # 0.20 -> 0.60


@dataclass
class TuningResult:
    new_threshold_id: Optional[str]
    activated: bool
    ssim_min: float
    match_ratio_min: float
    inliers_min: int
    homography_inlier_ratio_min: float
    f1: float
    precision: float
    recall: float
    eval_sample_count: int
    reason: Optional[str] = None


def _effective_label(image: Image) -> Optional[HumanLabel]:
    return image.human_label or image.synthetic_label


def _is_positive(label: HumanLabel) -> bool:
    return label in (HumanLabel.OBSTRUCTED, HumanLabel.MOVED)


def _score_thresholds(
    samples: list[tuple[float, float, int, float, bool]],
    ssim_min: float,
    match_ratio_min: float,
    inliers_min: int,
    inlier_ratio_min: float,
) -> tuple[float, float, float]:
    tp = fp = fn = 0
    for ssim_score, match_ratio, inliers, inlier_ratio, actual_positive in samples:
        ssim_passes = ssim_score >= ssim_min
        orb_passes = (
            match_ratio >= match_ratio_min
            and inliers >= inliers_min
            and inlier_ratio >= inlier_ratio_min
        )
        predicted_positive = not (ssim_passes and orb_passes)

        if actual_positive and predicted_positive:
            tp += 1
        elif actual_positive and not predicted_positive:
            fn += 1
        elif not actual_positive and predicted_positive:
            fp += 1

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) else 0.0
    return precision, recall, f1


async def tune(session: AsyncSession) -> TuningResult:
    # Sweep threshold combinations against labeled data, pick the best F1

    # Pull all labeled images into a compact tuple representation
    result = await session.execute(select(Image))
    images = result.scalars().all()

    samples: list[tuple[float, float, int, bool]] = []
    for img in images:
        label = _effective_label(img)
        if label is None or label == HumanLabel.OTHER:
            continue
        samples.append((
            img.ssim_score,
            img.match_ratio,
            img.inliers,
            img.homography_inlier_ratio,
            _is_positive(label),
        ))

    if len(samples) < MIN_LABELED_SAMPLES:
        raise ValueError(
            f"need at least {MIN_LABELED_SAMPLES} labeled samples to tune, "
            f"have {len(samples)}"
        )

    # Grid search
    best_f1 = -1.0
    best = (0.85, 0.20, 20, 0.40, 0.0, 0.0, 0.0)  # fallback

    for ssim_min in SSIM_RANGE:
        for match_ratio_min in MATCH_RATIO_RANGE:
            for inliers_min in INLIERS_RANGE:
                for inlier_ratio_min in INLIER_RATIO_RANGE:
                    precision, recall, f1 = _score_thresholds(
                        samples, ssim_min, match_ratio_min, inliers_min, inlier_ratio_min
                    )
                    if f1 > best_f1:
                        best_f1 = f1
                        best = (ssim_min, match_ratio_min, inliers_min, inlier_ratio_min, precision, recall, f1)

    ssim_min, match_ratio_min, inliers_min, inlier_ratio_min, precision, recall, f1 = best

    # Decide whether to activate. Always log the attempt either way
    activate = f1 >= F1_FLOOR
    reason = None if activate else f"best f1 {f1:.3f} below floor {F1_FLOOR}"

    if activate:
        # Deactivate every other row, then commit so our new row stays active
        await session.execute(
            update(Threshold)
            .where(Threshold.is_active.is_(True))
            .values(is_active=False)
        )

    new_row = Threshold(
        ssim_min=ssim_min,
        match_ratio_min=match_ratio_min,
        inliers_min=inliers_min,
        homography_inlier_ratio_min = inlier_ratio_min,
        f1=f1,
        precision=precision,
        recall=recall,
        eval_sample_count=len(samples),
        is_active=activate,
    )
    session.add(new_row)

    await session.commit()
    await session.refresh(new_row)

    return TuningResult(
        new_threshold_id=str(new_row.threshold_id),
        activated=activate,
        ssim_min=ssim_min,
        match_ratio_min=match_ratio_min,
        inliers_min=inliers_min,
        homography_inlier_ratio_min = inlier_ratio_min,
        f1=f1,
        precision=precision,
        recall=recall,
        eval_sample_count=len(samples),
        reason=reason,
    )
