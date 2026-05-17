import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    ARRAY, Boolean, DateTime, Enum as SqlEnum,
    Float, ForeignKey, Integer, String, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class HumanLabel(str, enum.Enum):
    NORMAL = "NORMAL"
    OBSTRUCTED = "OBSTRUCTED"
    MOVED = "MOVED"
    OTHER = "OTHER"


class Camera(Base):
    __tablename__ = "cameras"

    camera_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    base_image_paths: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    images: Mapped[list["Image"]] = relationship(back_populates="camera", cascade="all, delete-orphan")


class Image(Base):
    __tablename__ = "images"

    image_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    camera_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cameras.camera_id", ondelete="CASCADE"), index=True)
    image_path: Mapped[str] = mapped_column(String(1024))
    base_image_path: Mapped[str] = mapped_column(String(1024))
    annotated_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    ssim_score: Mapped[float] = mapped_column(Float)
    match_ratio: Mapped[float] = mapped_column(Float)
    inliers: Mapped[int] = mapped_column(Integer)
    homography_inlier_ratio: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    script_decision: Mapped[bool] = mapped_column(Boolean)

    human_label: Mapped[Optional[HumanLabel]] = mapped_column(SqlEnum(HumanLabel, name="human_label_enum"), nullable=True)
    synthetic_label: Mapped[Optional[HumanLabel]] = mapped_column(SqlEnum(HumanLabel, name="human_label_enum"), nullable=True)
    synthetic_transform: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    synthetic_params: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    camera: Mapped["Camera"] = relationship(back_populates="images")


class Threshold(Base):
    __tablename__ = "thresholds"

    threshold_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ssim_min: Mapped[float] = mapped_column(Float)
    match_ratio_min: Mapped[float] = mapped_column(Float)
    inliers_min: Mapped[int] = mapped_column(Integer)
    homography_inlier_ratio_min: Mapped[float] = mapped_column(Float, default=0.40, server_default="0.40")

    f1: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    precision: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recall: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    eval_sample_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
