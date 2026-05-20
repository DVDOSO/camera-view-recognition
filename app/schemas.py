import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models import HumanLabel


# --- Camera ---

class CameraCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    base_image_paths: list[str] = Field(default_factory=list)


class CameraUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    base_image_paths: Optional[list[str]] = None


class CameraOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    camera_id: uuid.UUID
    name: str
    base_image_paths: list[str]
    created_at: datetime


# --- Image ---

class ImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    image_id: uuid.UUID
    camera_id: uuid.UUID
    image_path: str
    base_image_path: str
    ssim_score: float
    match_ratio: float
    inliers: int
    homography_inlier_ratio: float
    script_decision: bool
    human_label: Optional[HumanLabel]
    synthetic_label: Optional[HumanLabel]
    synthetic_transform: Optional[str]
    timestamp: datetime


class LabelUpdate(BaseModel):
    human_label: HumanLabel


# --- Threshold ---

class ThresholdOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    threshold_id: uuid.UUID
    ssim_min: float
    match_ratio_min: float
    inliers_min: int
    f1: Optional[float]
    precision: Optional[float]
    recall: Optional[float]
    eval_sample_count: Optional[int]
    is_active: bool
    created_at: datetime


# --- Generation ---

class GenerateBatchRequest(BaseModel):
    camera_id: uuid.UUID
    n: int = Field(ge=1, le=1000)
    seed: int = 0


class GenerateBatchResponse(BaseModel):
    generated: int
    image_ids: list[uuid.UUID]


# --- Metrics ---

class MetricsOut(BaseModel):
    total_labeled: int
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int
    precision: Optional[float]
    recall: Optional[float]
    f1: Optional[float]