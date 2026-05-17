from pathlib import Path
from dataclasses import dataclass
from app.services.image_compare import compare_images


@dataclass
class ComparisonResult:
    ssim_score: float
    match_ratio: float
    inliers: int
    homography_inlier_ratio: float
    script_decision: bool
    base_image_path: str


def compare(
    captured_path: str | Path,
    base_image_paths: list[str],
    ssim_min: float = 0.85,
    match_ratio_min: float = 0.20,
    inliers_min: int = 20,
    homography_inlier_ratio_min: float = 0.40,
) -> ComparisonResult:
    if not base_image_paths:
        raise ValueError("at least one base image path required")

    best: ComparisonResult | None = None

    for base_path in base_image_paths:
        try:
            result = compare_images(
                reference_path=base_path,
                candidate_path=str(captured_path),
                ssim_threshold=ssim_min,
                match_ratio_threshold=match_ratio_min,
                homography_inliers_threshold=inliers_min,
                homography_inlier_ratio_threshold=homography_inlier_ratio_min,
            )
        except FileNotFoundError:
            continue

        candidate = ComparisonResult(
            ssim_score=result.ssim_score,
            match_ratio=result.match_ratio,
            inliers=result.homography_inliers,
            homography_inlier_ratio=result.homography_inlier_ratio,
            script_decision=not result.similar,
            base_image_path=str(base_path),
        )

        if best is None or candidate.ssim_score > best.ssim_score:
            best = candidate

    if best is None:
        raise FileNotFoundError("none of the base images could be read")

    return best
