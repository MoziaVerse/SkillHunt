"""List command implementation."""

from typing import List, Dict, Any, Optional
from collections import defaultdict

from ..models.video_data import VideoData
from ..utils.time_utils import frames_to_seconds, format_duration


class ListCommand:
    """List and filter objects for AI Agents."""

    def __init__(self, data: VideoData):
        self.data = data

    def execute(
        self,
        min_conf: Optional[float] = None,
        min_frames: Optional[int] = None,
        class_filter: Optional[str] = None,
        ids: Optional[List[int]] = None,
        dominant_only: bool = False,
        sort_by: str = "duration",
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Execute list command and return filtered objects."""
        # Default values
        min_conf = min_conf if min_conf is not None else 0.0
        min_frames = min_frames if min_frames is not None else 0

        # Get all object info
        objects = self._get_all_objects()

        # Apply filters
        filtered = []

        for obj in objects:
            # Skip if below min confidence
            if obj["avg_conf"] < min_conf:
                continue

            # Skip if below min frames
            if obj["duration_frames"] < min_frames:
                continue

            # Skip if class doesn't match
            if class_filter and obj["class"] != class_filter:
                continue

            # Skip if ID not in list
            if ids and obj["id"] not in ids:
                continue

            # Skip if not dominant
            if dominant_only:
                dominant_threshold = int(5 * self.data.video_info.fps)  # 5 seconds
                if obj["duration_frames"] < dominant_threshold:
                    continue

            filtered.append(obj)

        # Sort
        if sort_by == "duration":
            filtered.sort(key=lambda x: x["duration_frames"], reverse=True)
        elif sort_by == "confidence":
            filtered.sort(key=lambda x: x["avg_conf"], reverse=True)
        elif sort_by == "start-frame":
            filtered.sort(key=lambda x: x["start_frame"])

        # Limit
        if limit and limit > 0:
            filtered = filtered[:limit]

        return filtered

    def _get_all_objects(self) -> List[Dict[str, Any]]:
        """Extract information for all objects."""
        id_data = defaultdict(lambda: {
            "class": None,
            "confidences": [],
            "first_frame": None,
            "last_frame": None,
        })

        # Collect data
        for frame in self.data.frames:
            for det in frame.detections:
                data = id_data[det.id]

                if data["class"] is None:
                    data["class"] = det.class_name
                # Track most common class (in case it changes)
                # For now, just use first seen class

                data["confidences"].append(det.confidence)

                if data["first_frame"] is None or frame.frame_number < data["first_frame"]:
                    data["first_frame"] = frame.frame_number

                if data["last_frame"] is None or frame.frame_number > data["last_frame"]:
                    data["last_frame"] = frame.frame_number

        # Build result
        result = []

        for id_, data in id_data.items():
            duration_frames = data["last_frame"] - data["first_frame"] + 1
            duration_seconds = frames_to_seconds(duration_frames, self.data.video_info.fps)

            result.append({
                "id": id_,
                "class": data["class"],
                "start_frame": data["first_frame"],
                "end_frame": data["last_frame"],
                "duration_frames": duration_frames,
                "duration": format_duration(duration_seconds),
                "avg_conf": round(sum(data["confidences"]) / len(data["confidences"]), 3) if data["confidences"] else 0.0,
            })

        return result
