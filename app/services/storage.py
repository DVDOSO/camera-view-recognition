import uuid
from pathlib import Path

import cv2
import numpy as np

from app.config import settings


def ensure_dirs() -> None:
    for d in (settings.base_dir, settings.captures_dir, settings.annotated_dir):
        d.mkdir(parents=True, exist_ok=True)


def save_bytes(data: bytes, subdir: Path) -> Path:
    path = subdir / f"{uuid.uuid4().hex}.png"
    path.write_bytes(data)
    return path


def save_array(image: np.ndarray, subdir: Path) -> Path:
    path = subdir / f"{uuid.uuid4().hex}.png"
    ok = cv2.imwrite(str(path), image)
    if not ok:
        raise IOError(f"cv2.imwrite failed for {path}")
    return path
