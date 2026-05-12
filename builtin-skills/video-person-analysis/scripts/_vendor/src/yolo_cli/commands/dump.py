"""Dump command for P2: Export raw frame data."""

from typing import Any, Dict, List, Optional, Sequence
from ..models.video_data import VideoData


class DumpCommand:
    """Handle dump operations for raw frame data export."""

    def __init__(self, data: VideoData):
        """Initialize with video data.

        Args:
            data: Video data instance
        """
        self.data = data

    def frame(
        self,
        frame_number: Optional[int] = None,
        timestamp: Optional[str] = None,
        start_frame: Optional[int] = None,
        end_frame: Optional[int] = None,
        id_filter: Optional[Sequence[int]] = None,
        class_filter: Optional[str] = None,
        min_conf: Optional[float] = None,
        fields: Optional[Sequence[str]] = None,
    ) -> Dict[str, Any]:
        """Dump raw frame data with optional filtering.

        Args:
            frame_number: Single frame number to dump
            timestamp: Timestamp to find frame (format: "HH:MM:SS.mmm")
            start_frame: Start of range (exclusive with frame_number)
            end_frame: End of range
            id_filter: Only include specific track IDs
            class_filter: Only include specific class
            min_conf: Only include detections above this confidence
            fields: Specific fields to include (default: all)

        Returns:
            Dictionary with frame data
        """
        # Determine query mode
        if frame_number is not None:
            return self._dump_single_frame(
                frame_number,
                id_filter=id_filter,
                class_filter=class_filter,
                min_conf=min_conf,
                fields=fields,
            )
        elif start_frame is not None and end_frame is not None:
            return self._dump_frame_range(
                start_frame,
                end_frame,
                id_filter=id_filter,
                class_filter=class_filter,
                min_conf=min_conf,
                fields=fields,
            )
        elif timestamp is not None:
            frame_num = self._timestamp_to_frame(timestamp)
            return self._dump_single_frame(
                frame_num,
                id_filter=id_filter,
                class_filter=class_filter,
                min_conf=min_conf,
                fields=fields,
                queried_timestamp=timestamp,
            )
        else:
            raise ValueError("Must specify either frame_number, timestamp, or frame range (start_frame + end_frame)")

    def _dump_single_frame(
        self,
        frame_number: int,
        id_filter: Optional[Sequence[int]] = None,
        class_filter: Optional[str] = None,
        min_conf: Optional[float] = None,
        fields: Optional[Sequence[str]] = None,
        queried_timestamp: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Dump a single frame's data.

        Args:
            frame_number: Frame number to dump (1-based)
            id_filter: Only include specific track IDs
            class_filter: Only include specific class
            min_conf: Minimum confidence threshold
            fields: Specific fields to include
            queried_timestamp: Original timestamp if queried by time

        Returns:
            Frame data dictionary
        """
        # Convert to 0-based index
        idx = frame_number - 1

        # Validate frame number
        if idx < 0 or idx >= self.data.total_frames:
            raise ValueError(
                f"Frame {frame_number} not found. Total frames: {self.data.total_frames}"
            )

        # Get frame data
        frame_data = self.data.frames[idx]

        # Build detection list with filters
        detections = []
        for det in frame_data.detections:
            # Apply filters
            if id_filter is not None and det.id not in id_filter:
                continue
            if class_filter is not None and det.class_name != class_filter:
                continue
            if min_conf is not None and det.confidence < min_conf:
                continue

            # Build detection dict
            det_dict = {
                "id": det.id,
                "class": det.class_name,
                "confidence": det.confidence,
                "bbox": det.bbox,
            }

            # Add center point (enhanced field)
            cx, cy = det.center
            det_dict["center"] = [round(cx, 2), round(cy, 2)]

            # Filter fields if specified
            if fields is not None:
                det_dict = {k: v for k, v in det_dict.items() if k in fields}

            detections.append(det_dict)

        # Build response
        result: Dict[str, Any] = {
            "frame_number": frame_number,
            "timestamp": frame_data.timestamp,
            "detection_count": len(detections),
            "detections": detections,
        }

        # Add filter status
        if any([id_filter, class_filter, min_conf]):
            result["filtered"] = True

        # Add queried timestamp if applicable
        if queried_timestamp is not None:
            result["queried_timestamp"] = queried_timestamp
            result["matched_frame"] = frame_number

        return result

    def _dump_frame_range(
        self,
        start_frame: int,
        end_frame: int,
        id_filter: Optional[Sequence[int]] = None,
        class_filter: Optional[str] = None,
        min_conf: Optional[float] = None,
        fields: Optional[Sequence[str]] = None,
    ) -> Dict[str, Any]:
        """Dump a range of frames.

        Args:
            start_frame: Start frame number (1-based, inclusive)
            end_frame: End frame number (1-based, inclusive)
            id_filter: Only include specific track IDs
            class_filter: Only include specific class
            min_conf: Minimum confidence threshold
            fields: Specific fields to include

        Returns:
            Frame range data dictionary
        """
        if start_frame > end_frame:
            raise ValueError(f"start_frame ({start_frame}) must be <= end_frame ({end_frame})")

        if start_frame < 1:
            raise ValueError(f"start_frame must be >= 1, got {start_frame}")

        # Clamp to valid range
        end_frame = min(end_frame, self.data.total_frames)
        start_frame = max(start_frame, 1)

        frames = []
        for frame_num in range(start_frame, end_frame + 1):
            frame_data = self._dump_single_frame(
                frame_num,
                id_filter=id_filter,
                class_filter=class_filter,
                min_conf=min_conf,
                fields=fields,
            )
            frames.append(frame_data)

        return {
            "frame_range": [start_frame, end_frame],
            "frame_count": len(frames),
            "frames": frames,
        }

    def _timestamp_to_frame(self, timestamp: str) -> int:
        """Convert timestamp to frame number.

        Args:
            timestamp: Timestamp in format "HH:MM:SS.mmm" or "MM:SS.mmm"

        Returns:
            Frame number (1-based)

        Raises:
            ValueError: If timestamp format is invalid
        """
        try:
            parts = timestamp.split(":")
            if len(parts) == 3:
                # HH:MM:SS.mmm
                h, m, s_ms = parts
                s, ms = s_ms.split(".")
                total_seconds = int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000
            elif len(parts) == 2:
                # MM:SS.mmm
                m, s_ms = parts
                s, ms = s_ms.split(".")
                total_seconds = int(m) * 60 + int(s) + int(ms) / 1000
            else:
                raise ValueError("Invalid timestamp format")

            frame_num = int(total_seconds * self.data.video_info.fps) + 1
            return max(1, min(frame_num, self.data.total_frames))
        except (ValueError, IndexError) as e:
            raise ValueError(f"Invalid timestamp format '{timestamp}': {e}")
