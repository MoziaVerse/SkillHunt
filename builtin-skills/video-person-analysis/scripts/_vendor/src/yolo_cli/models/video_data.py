"""Core data models for YOLO video analysis."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class Detection(BaseModel):
    """A single object detection in a frame."""

    id: int = Field(..., description="Unique object ID")
    class_name: str = Field(..., alias="class", description="Object class name")
    confidence: float = Field(..., ge=0, le=1, description="Detection confidence")
    bbox: List[int] = Field(..., min_length=4, max_length=4, description="Bounding box [x1, y1, x2, y2]")

    @field_validator("bbox")
    @classmethod
    def validate_bbox(cls, v: List[int]) -> List[int]:
        """Validate bbox coordinates."""
        if v[0] >= v[2] or v[1] >= v[3]:
            raise ValueError(f"Invalid bbox: x1 must be < x2 and y1 must be < y2, got {v}")
        return v

    @property
    def center(self) -> tuple[float, float]:
        """Calculate center point of bbox."""
        return ((self.bbox[0] + self.bbox[2]) / 2, (self.bbox[1] + self.bbox[3]) / 2)

    @property
    def area(self) -> int:
        """Calculate bbox area."""
        return (self.bbox[2] - self.bbox[0]) * (self.bbox[3] - self.bbox[1])


class FrameData(BaseModel):
    """Data for a single video frame."""

    frame_number: int = Field(..., ge=1, description="Frame number (1-based)")
    timestamp: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}:\d{2}(\.\d{3})?$", description="Timestamp in HH:MM:SS.mmm format")
    detections: List[Detection] = Field(default_factory=list, description="List of detections in this frame")


class VideoInfo(BaseModel):
    """Video metadata."""

    fps: int = Field(..., gt=0, description="Frames per second")
    width: int = Field(..., gt=0, description="Video width in pixels")
    height: int = Field(..., gt=0, description="Video height in pixels")
    duration_seconds: Optional[float] = Field(None, ge=0, description="Video duration in seconds")
    total_frames: Optional[int] = Field(None, ge=0, description="Total number of frames")


class VideoData(BaseModel):
    """Complete video analysis data."""

    video_info: VideoInfo
    frames: List[FrameData] = Field(default_factory=list, description="List of frame data")

    @field_validator("frames")
    @classmethod
    def validate_frames(cls, v: List[FrameData]) -> List[FrameData]:
        """Validate frames are sorted and have unique numbers."""
        if v:
            numbers = [f.frame_number for f in v]
            if numbers != sorted(set(numbers)):
                raise ValueError("Frames must be sorted with unique frame numbers")
        return v

    @property
    def total_frames(self) -> int:
        """Get total number of frames."""
        return self.video_info.total_frames or len(self.frames)

    @property
    def duration_seconds(self) -> float:
        """Get video duration in seconds."""
        if self.video_info.duration_seconds:
            return self.video_info.duration_seconds
        return self.total_frames / self.video_info.fps
