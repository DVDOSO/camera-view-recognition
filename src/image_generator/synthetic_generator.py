from __future__ import annotations

import random
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Dict, List, Tuple

import cv2
import numpy as np


class Label(str, Enum):
    NORMAL = "NORMAL"
    OBSTRUCTED = "OBSTRUCTED"
    MOVED = "MOVED"


@dataclass
class GeneratedSample:
    """One generated image plus the metadata describing how it was produced."""
    image: np.ndarray
    label: Label
    transform: str
    params: Dict = field(default_factory=dict)

    def to_metadata(self) -> Dict:
        """Serializable metadata (excludes the image array itself)."""
        return {
            "label": self.label.value,
            "transform": self.transform,
            "params": self.params,
        }


Transform = Callable[[np.ndarray, random.Random], Tuple[np.ndarray, Dict]]


# Solid rectangle covering 60-90% of the frame — simulates tape/cardboard over lens.
def large_cover(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    out = image.copy()
    h, w = image.shape[:2]
    rect_w = rng.randint(int(w * 0.60), w)
    rect_h = rng.randint(int(h * 0.60), h)
    x = rng.randint(0, w - rect_w)
    y = rng.randint(0, h - rect_h)
    color_choices = [(10, 10, 10), (40, 40, 40), (200, 200, 200), (30, 20, 10)]
    color = rng.choice(color_choices)
    out[y:y + rect_h, x:x + rect_w] = color
    return out, {"x": x, "y": y, "w": rect_w, "h": rect_h, "color": color}


# Multiple overlapping solid rectangles covering the majority of the frame.
def multi_block(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    out = image.copy()
    h, w = image.shape[:2]
    n_blocks = rng.randint(4, 8)
    color_choices = [(10, 10, 10), (50, 50, 50), (180, 180, 180), (20, 30, 40)]
    blocks = []
    for _ in range(n_blocks):
        bw = rng.randint(int(w * 0.30), int(w * 0.70))
        bh = rng.randint(int(h * 0.30), int(h * 0.70))
        x = rng.randint(0, w - bw)
        y = rng.randint(0, h - bh)
        color = rng.choice(color_choices)
        out[y:y + bh, x:x + bw] = color
        blocks.append({"x": x, "y": y, "w": bw, "h": bh, "color": color})
    return out, {"blocks": blocks}


# Simulate camera fully covered: nearly black frame with mild sensor noise.
def full_blackout(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    out = np.full_like(image, fill_value=rng.randint(0, 15))
    noise_flat = [rng.randint(-5, 4) for _ in range(image.size)]
    noise = np.array(noise_flat, dtype=np.int16).reshape(image.shape)
    out = np.clip(out.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return out, {}


# Simulate camera pointed at bright light source or fully covered with white material.
def full_whiteout(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    out = np.full_like(image, fill_value=rng.randint(240, 255))
    return out, {}


# Simulate camera knocked hard: shift frame by 30–60% in a random direction.
def large_translation(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    h, w = image.shape[:2]
    dx = rng.randint(int(w * 0.30), int(w * 0.60)) * rng.choice([-1, 1])
    dy = rng.randint(int(h * 0.30), int(h * 0.60)) * rng.choice([-1, 1])
    M = np.float32([[1, 0, dx], [0, 1, dy]])
    out = cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
    return out, {"dx": int(dx), "dy": int(dy)}


# Simulate camera severely tilted: rotate 25-75 degrees.
def large_rotation(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    h, w = image.shape[:2]
    angle = rng.uniform(25.0, 75.0) * rng.choice([-1, 1])
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, scale=1.0)
    out = cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
    return out, {"angle": round(angle, 2)}


# Simulate camera drastically repositioned: zoom in (1.6-2.5x) or out (0.2-0.5x).
def extreme_zoom(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    h, w = image.shape[:2]
    factor = rng.choice([
        rng.uniform(1.6, 2.5),
        rng.uniform(0.2, 0.5),
    ])
    M = cv2.getRotationMatrix2D((w / 2, h / 2), 0, scale=factor)
    out = cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
    return out, {"factor": round(factor, 3)}


# Simulate camera repositioned at new angle: heavy perspective warp (30-50% corner jitter).
def large_perspective(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    h, w = image.shape[:2]
    jx = int(w * 0.40)
    jy = int(h * 0.40)
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([
        [rng.randint(0, jx),           rng.randint(0, jy)],
        [w - rng.randint(0, jx),       rng.randint(0, jy)],
        [w - rng.randint(0, jx),       h - rng.randint(0, jy)],
        [rng.randint(0, jx),           h - rng.randint(0, jy)],
    ])
    H = cv2.getPerspectiveTransform(src, dst)
    out = cv2.warpPerspective(image, H, (w, h), borderMode=cv2.BORDER_REPLICATE)
    return out, {"corners": dst.tolist()}


# Simulate grease/smudge: blurred translucent ellipse blended over the image.
def translucent_smudge(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    h, w = image.shape[:2]
    cx = rng.randint(int(w * 0.2), int(w * 0.8))
    cy = rng.randint(int(h * 0.2), int(h * 0.8))
    rx = rng.randint(int(w * 0.10), int(w * 0.30))
    ry = rng.randint(int(h * 0.10), int(h * 0.30))
    angle = rng.randint(0, 180)
    alpha = rng.uniform(0.4, 0.7)
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.ellipse(mask, (cx, cy), (rx, ry), angle, 0, 360, 255, thickness=-1)
    mask = cv2.GaussianBlur(mask, (61, 61), 0)
    smudge_layer = np.full_like(image, fill_value=200)
    mask_3c = np.stack([mask, mask, mask], axis=-1).astype(np.float32) / 255.0
    out = (image.astype(np.float32) * (1 - mask_3c * alpha) +
           smudge_layer.astype(np.float32) * (mask_3c * alpha))
    return out.astype(np.uint8), {
        "cx": cx, "cy": cy, "rx": rx, "ry": ry,
        "angle": angle, "alpha": round(alpha, 3),
    }


# Simulate a small piece of tape: tiny rectangle covering 3–8% of the frame.
def subtle_tape(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    out = image.copy()
    h, w = image.shape[:2]
    rect_w = rng.randint(int(w * 0.05), int(w * 0.15))
    rect_h = rng.randint(int(h * 0.03), int(h * 0.10))
    x = rng.randint(0, w - rect_w)
    y = rng.randint(0, h - rect_h)
    color_choices = [(20, 20, 20), (128, 128, 128), (180, 200, 210), (60, 40, 30)]
    color = rng.choice(color_choices)
    out[y:y + rect_h, x:x + rect_w] = color
    return out, {"x": x, "y": y, "w": rect_w, "h": rect_h, "color": color}


# Simulate a gentle camera nudge: shift frame by 2-5%.
def minor_shift(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    h, w = image.shape[:2]
    dx = rng.randint(int(w * 0.02), int(w * 0.05)) * rng.choice([-1, 1])
    dy = rng.randint(int(h * 0.02), int(h * 0.05)) * rng.choice([-1, 1])
    M = np.float32([[1, 0, dx], [0, 1, dy]])
    out = cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
    return out, {"dx": int(dx), "dy": int(dy)}


# Simulate a very slight camera tilt: rotate 0.5-3 degrees.
def minor_tilt(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    h, w = image.shape[:2]
    angle = rng.uniform(0.5, 3.0) * rng.choice([-1, 1])
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, scale=1.0)
    out = cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
    return out, {"angle": round(angle, 2)}


# Simulate slight camera movement: zoom 0.97-1.03x.
def minor_zoom(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    h, w = image.shape[:2]
    factor = rng.uniform(0.97, 1.03)
    M = cv2.getRotationMatrix2D((w / 2, h / 2), 0, scale=factor)
    out = cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
    return out, {"factor": round(factor, 3)}


# Simulate time-of-day lighting changes.
def brightness_contrast(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    alpha = rng.uniform(0.65, 1.35)
    beta = rng.uniform(-40.0, 40.0)
    out = np.clip(image.astype(np.float32) * alpha + beta, 0, 255).astype(np.uint8)
    return out, {"alpha": round(alpha, 3), "beta": round(beta, 2)}


# Simulate low-light sensor noise: additive Gaussian noise.
def sensor_noise(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    sigma = rng.uniform(5.0, 20.0)
    noise_flat = [rng.gauss(0, sigma) for _ in range(image.size)]
    noise = np.array(noise_flat, dtype=np.float32).reshape(image.shape)
    out = np.clip(image.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    return out, {"sigma": round(sigma, 2)}


# Simulate slight focus drift: mild Gaussian blur applied uniformly.
def focus_drift(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    k = rng.choice([3, 5, 7])
    out = cv2.GaussianBlur(image, (k, k), 0)
    return out, {"kernel": k}


# No-op: returns the base image unchanged. Anchors the NORMAL class.
def identity(image: np.ndarray, rng: random.Random) -> Tuple[np.ndarray, Dict]:
    return image.copy(), {}


OBSTRUCTION_TRANSFORMS: Dict[str, Transform] = {
    "large_cover": large_cover,
    "multi_block": multi_block,
    "full_blackout": full_blackout,
    "full_whiteout": full_whiteout,
}

MOVEMENT_TRANSFORMS: Dict[str, Transform] = {
    "large_translation": large_translation,
    "large_rotation": large_rotation,
    "extreme_zoom": extreme_zoom,
    "large_perspective": large_perspective,
}

NORMAL_TRANSFORMS: Dict[str, Transform] = {
    "brightness_contrast": brightness_contrast,
    "sensor_noise": sensor_noise,
    "focus_drift": focus_drift,
    "identity": identity,
    "translucent_smudge": translucent_smudge,
    "subtle_tape": subtle_tape,
    "minor_shift": minor_shift,
    "minor_tilt": minor_tilt,
    "minor_zoom": minor_zoom,
}

TRANSFORMS_BY_LABEL: Dict[Label, Dict[str, Transform]] = {
    Label.OBSTRUCTED: OBSTRUCTION_TRANSFORMS,
    Label.MOVED: MOVEMENT_TRANSFORMS,
    Label.NORMAL: NORMAL_TRANSFORMS,
}


DEFAULT_MIX: Dict[Label, float] = {
    Label.OBSTRUCTED: 0.45,
    Label.MOVED: 0.35,
    Label.NORMAL: 0.20,
}


def apply_transform(
    image: np.ndarray,
    label: Label,
    transform_name: str,
    rng: random.Random,
) -> GeneratedSample:
    """Apply a single named transform. Useful for tests and the API."""
    transforms = TRANSFORMS_BY_LABEL[label]
    if transform_name not in transforms:
        raise ValueError(
            f"Transform '{transform_name}' is not registered under label {label.value}"
        )
    fn = transforms[transform_name]
    modified, params = fn(image, rng)
    return GeneratedSample(
        image=modified,
        label=label,
        transform=transform_name,
        params=params,
    )


def generate_batch(
    base_image: np.ndarray,
    n: int,
    mix: Dict[Label, float] = None,
    seed: int = 0,
) -> List[GeneratedSample]:
    if base_image is None:
        raise ValueError("base_image is None — did cv2.imread fail to read the path?")
    if n <= 0:
        raise ValueError(f"n must be positive, got {n}")

    mix = mix or DEFAULT_MIX
    total = sum(mix.values())
    if not (0.999 <= total <= 1.001):
        raise ValueError(f"mix must sum to 1.0, got {total}")

    rng = random.Random(seed)
    samples: List[GeneratedSample] = []

    counts: Dict[Label, int] = {label: int(n * frac) for label, frac in mix.items()}
    remainder = n - sum(counts.values())
    for label in list(mix.keys())[:remainder]:
        counts[label] += 1

    for label, count in counts.items():
        transforms = TRANSFORMS_BY_LABEL[label]
        transform_names = list(transforms.keys())
        for _ in range(count):
            name = rng.choice(transform_names)
            samples.append(apply_transform(base_image, label, name, rng))

    rng.shuffle(samples)
    return samples
