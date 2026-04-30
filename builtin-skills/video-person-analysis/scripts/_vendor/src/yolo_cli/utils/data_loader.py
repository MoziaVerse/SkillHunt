"""Data loading utilities."""

import json
from pathlib import Path
from typing import Optional

from ..models.video_data import VideoData


def load_video_data(json_path: Path) -> Optional[VideoData]:
    """Load video data from JSON file."""
    if not json_path.exists():
        return None

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Handle different JSON formats
        if "video_info" in data and "frames" in data:
            return VideoData.model_validate(data)
        elif isinstance(data, list) and len(data) > 0:
            # Assume it's a list of frames
            return VideoData.model_validate({
                "video_info": {"fps": 30, "width": 1920, "height": 1080},
                "frames": data
            })
        else:
            return None

    except Exception:
        return None
