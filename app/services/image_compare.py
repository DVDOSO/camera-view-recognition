import argparse
import sys
from dataclasses import dataclass, asdict

import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim


@dataclass
class ComparisonResult:
    similar: bool
    final_reason: str

    ssim_score: float
    ssim_similar: bool

    ref_keypoints: int
    cand_keypoints: int
    good_matches: int
    match_ratio: float

    homography_found: bool
    homography_inliers: int
    homography_inlier_ratio: float
    orb_similar: bool


def load_grayscale(path: str) -> np.ndarray:
    image = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise FileNotFoundError(f"Could not read image: {path}")
    return image


def resize_to_match(reference: np.ndarray, candidate: np.ndarray) -> np.ndarray:
    return cv2.resize(candidate, (reference.shape[1], reference.shape[0]))


def compute_ssim(reference: np.ndarray, candidate: np.ndarray) -> float:
    score, _ = ssim(reference, candidate, full=True)
    return float(score)


def compute_orb_homography(
    reference: np.ndarray,
    candidate: np.ndarray,
    orb_features: int = 1500,
    ratio_test_threshold: float = 0.75,
):
    orb = cv2.ORB_create(nfeatures=orb_features)

    kp1, des1 = orb.detectAndCompute(reference, None)
    kp2, des2 = orb.detectAndCompute(candidate, None)

    ref_keypoints = 0 if kp1 is None else len(kp1)
    cand_keypoints = 0 if kp2 is None else len(kp2)

    if des1 is None or des2 is None or ref_keypoints == 0 or cand_keypoints == 0:
        return {
            "ref_keypoints": ref_keypoints,
            "cand_keypoints": cand_keypoints,
            "good_matches": 0,
            "match_ratio": 0.0,
            "homography_found": False,
            "homography_inliers": 0,
            "homography_inlier_ratio": 0.0,
        }

    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    knn_matches = bf.knnMatch(des1, des2, k=2)

    good_matches = []
    for pair in knn_matches:
        if len(pair) < 2:
            continue
        m, n = pair
        if m.distance < ratio_test_threshold * n.distance:
            good_matches.append(m)

    min_keypoints = max(1, min(ref_keypoints, cand_keypoints))
    match_ratio = len(good_matches) / min_keypoints

    if len(good_matches) < 4:
        return {
            "ref_keypoints": ref_keypoints,
            "cand_keypoints": cand_keypoints,
            "good_matches": len(good_matches),
            "match_ratio": float(match_ratio),
            "homography_found": False,
            "homography_inliers": 0,
            "homography_inlier_ratio": 0.0,
        }

    src_pts = np.float32(
        [kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
    dst_pts = np.float32(
        [kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

    H, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)

    if H is None or mask is None:
        return {
            "ref_keypoints": ref_keypoints,
            "cand_keypoints": cand_keypoints,
            "good_matches": len(good_matches),
            "match_ratio": float(match_ratio),
            "homography_found": False,
            "homography_inliers": 0,
            "homography_inlier_ratio": 0.0,
        }

    homography_inliers = int(mask.sum())
    homography_inlier_ratio = homography_inliers / max(1, len(good_matches))

    return {
        "ref_keypoints": ref_keypoints,
        "cand_keypoints": cand_keypoints,
        "good_matches": len(good_matches),
        "match_ratio": float(match_ratio),
        "homography_found": True,
        "homography_inliers": homography_inliers,
        "homography_inlier_ratio": float(homography_inlier_ratio),
    }


def compare_images(
    reference_path: str,
    candidate_path: str,
    ssim_threshold: float = 0.85,
    match_ratio_threshold: float = 0.20,
    homography_inliers_threshold: int = 20,
    homography_inlier_ratio_threshold: float = 0.40,
) -> ComparisonResult:
    reference = load_grayscale(reference_path)
    candidate = load_grayscale(candidate_path)
    candidate = resize_to_match(reference, candidate)

    ssim_score = compute_ssim(reference, candidate)
    ssim_similar = ssim_score >= ssim_threshold

    orb_data = compute_orb_homography(reference, candidate)

    orb_similar = (
        orb_data["match_ratio"] >= match_ratio_threshold
        and orb_data["homography_found"]
        and orb_data["homography_inliers"] >= homography_inliers_threshold
        and orb_data["homography_inlier_ratio"] >= homography_inlier_ratio_threshold
    )

    # Conservative decision:
    # - similar if either SSIM is strong OR ORB/homography is strong
    similar = ssim_similar or orb_similar

    if similar:
        if orb_similar and not ssim_similar:
            reason = "Similar: scene geometry still matches even though pixel similarity is lower"
        elif ssim_similar and not orb_similar:
            reason = "Similar: overall image structure is close even though feature matching is weaker"
        else:
            reason = "Similar: both structural similarity and feature geometry look consistent"
    else:
        reason = "Not similar: both structural similarity and feature geometry are below threshold"

    return ComparisonResult(
        similar=similar,
        final_reason=reason,
        ssim_score=ssim_score,
        ssim_similar=ssim_similar,
        ref_keypoints=orb_data["ref_keypoints"],
        cand_keypoints=orb_data["cand_keypoints"],
        good_matches=orb_data["good_matches"],
        match_ratio=orb_data["match_ratio"],
        homography_found=orb_data["homography_found"],
        homography_inliers=orb_data["homography_inliers"],
        homography_inlier_ratio=orb_data["homography_inlier_ratio"],
        orb_similar=orb_similar,
    )


def print_result(result: ComparisonResult, debug=False) -> None:
    print("similar" if result.similar else "not similar")
    print(result.final_reason)

    if debug:
        print("DEBUG")
        print("-----")
        print(f"ssim_score: {result.ssim_score:.4f}")
        print(f"ssim_similar: {result.ssim_similar}")
        print(f"ref_keypoints: {result.ref_keypoints}")
        print(f"cand_keypoints: {result.cand_keypoints}")
        print(f"good_matches: {result.good_matches}")
        print(f"match_ratio: {result.match_ratio:.4f}")
        print(f"homography_found: {result.homography_found}")
        print(f"homography_inliers: {result.homography_inliers}")
        print(f"homography_inlier_ratio: {result.homography_inlier_ratio:.4f}")
        print(f"orb_similar: {result.orb_similar}")

    print("------")


def main():
    parser = argparse.ArgumentParser(
        description="Compare two images using SSIM plus ORB/homography."
    )
    parser.add_argument("reference", help="Path to the reference image")
    parser.add_argument("candidate", help="Path to the candidate image")
    parser.add_argument("--ssim-threshold", type=float, default=0.85)
    parser.add_argument("--match-ratio-threshold", type=float, default=0.20)
    parser.add_argument("--homography-inliers-threshold", type=int, default=20)
    parser.add_argument("--homography-inlier-ratio-threshold",
                        type=float, default=0.40)
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print result as a plain dict-like structure",
    )

    args = parser.parse_args()

    try:
        result = compare_images(
            reference_path=args.reference,
            candidate_path=args.candidate,
            ssim_threshold=args.ssim_threshold,
            match_ratio_threshold=args.match_ratio_threshold,
            homography_inliers_threshold=args.homography_inliers_threshold,
            homography_inlier_ratio_threshold=args.homography_inlier_ratio_threshold,
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(asdict(result))
    else:
        print_result(result)


if __name__ == "__main__":
    main()
