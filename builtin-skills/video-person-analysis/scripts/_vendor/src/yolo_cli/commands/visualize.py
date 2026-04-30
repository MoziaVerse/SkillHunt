"""Visualize command for P2: Generate annotated images."""

import sys
from typing import Any, Dict, List, Optional, Sequence, Tuple
from pathlib import Path

from ..models.video_data import VideoData


class VisualizeCommand:
    """Handle visualize operations for generating annotated images."""

    def __init__(self, data: VideoData):
        """Initialize with video data.

        Args:
            data: Video data instance
        """
        self.data = data
        self._check_opencv()

    def _check_opencv(self):
        """Check if OpenCV is available."""
        try:
            import cv2
            self.cv2 = cv2
        except ImportError:
            raise RuntimeError(
                "OpenCV (opencv-python) is required for visualize command. "
                "Install it with: pip install 'yolo-cli[visualize]'"
            )

    def frame(
        self,
        frame_number: int,
        video_input: str,
        output_path: Optional[str] = None,
        id_filter: Optional[Sequence[int]] = None,
        class_filter: Optional[str] = None,
        min_conf: Optional[float] = None,
        box_color: str = "green",
        box_thickness: int = 2,
        label_font_size: float = 0.5,
        label_color: str = "white",
        color_by_confidence: bool = False,
        show_trace: bool = False,
        trace_length: int = 10,
        quality: int = 95,
    ) -> Dict[str, Any]:
        """Visualize a single frame with bounding boxes.

        Args:
            frame_number: Frame number to visualize (1-based)
            video_input: Path to input video file
            output_path: Path to save output image (default: frame_{frame_number}.jpg)
            id_filter: Only show specific track IDs
            class_filter: Only show specific class
            min_conf: Only show detections above this confidence
            box_color: Box color name or BGR tuple (e.g., "green", "red", or [0,255,0])
            box_thickness: Box line thickness
            label_font_size: Font size for labels
            label_color: Label text color
            color_by_confidence: Color boxes by confidence (green=high, yellow=med, red=low)
            show_trace: Show trajectory trace line
            trace_length: Number of frames to trace back
            quality: JPEG quality (1-100)

        Returns:
            Result dictionary with file info
        """
        import numpy as np

        # Validate frame number
        idx = frame_number - 1
        if idx < 0 or idx >= self.data.total_frames:
            raise ValueError(
                f"Frame {frame_number} not found. Total frames: {self.data.total_frames}"
            )

        # Get frame data
        frame_data = self.data.frames[idx]

        # Extract frame from video
        cap = self.cv2.VideoCapture(video_input)
        if not cap.isOpened():
            raise ValueError(f"Failed to open video file: {video_input}")

        try:
            # Seek to frame (0-based)
            cap.set(self.cv2.CAP_PROP_POS_FRAMES, idx)
            ret, image = cap.read()
            if not ret:
                raise ValueError(f"Failed to extract frame {frame_number} from video")

            # Draw detections
            detections_drawn = 0

            # Build trace data if needed
            trace_data = None
            if show_trace:
                trace_data = self._get_trace_data(frame_number, trace_length, id_filter, class_filter, min_conf)

            for det in frame_data.detections:
                # Apply filters
                if id_filter is not None and det.id not in id_filter:
                    continue
                if class_filter is not None and det.class_name != class_filter:
                    continue
                if min_conf is not None and det.confidence < min_conf:
                    continue

                # Get color
                if color_by_confidence:
                    color = self._get_confidence_color(det.confidence)
                else:
                    color = self._parse_color(box_color)

                # Draw bbox
                x1, y1, x2, y2 = det.bbox
                self.cv2.rectangle(image, (x1, y1), (x2, y2), color, box_thickness)

                # Draw label
                label_text = f"ID {det.id}: {det.class_name} ({det.confidence:.2f})"
                label_color_rgb = self._parse_color(label_color)

                # Get label size
                (text_width, text_height), baseline = self.cv2.getTextSize(
                    label_text,
                    self.cv2.FONT_HERSHEY_SIMPLEX,
                    label_font_size,
                    1,
                )

                # Draw label background
                label_y = max(y1, text_height + 10)
                self.cv2.rectangle(
                    image,
                    (x1, label_y - text_height - baseline - 5),
                    (x1 + text_width + 5, label_y),
                    color,
                    -1,
                )

                # Draw label text
                self.cv2.putText(
                    image,
                    label_text,
                    (x1 + 2, label_y - baseline - 2),
                    self.cv2.FONT_HERSHEY_SIMPLEX,
                    label_font_size,
                    label_color_rgb,
                    1,
                )

                detections_drawn += 1

            # Draw trace if requested
            if trace_data:
                for obj_id, points in trace_data.items():
                    if len(points) > 1:
                        for i in range(len(points) - 1):
                            self.cv2.line(image, points[i], points[i + 1], (0, 255, 255), 2)

            # Generate output path
            if output_path is None:
                output_path = f"frame_{frame_number}.jpg"

            # Save image
            self.cv2.imwrite(output_path, image, [self.cv2.IMWRITE_JPEG_QUALITY, quality])

            # Get file size
            file_size = Path(output_path).stat().st_size

            return {
                "output_file": output_path,
                "frame_number": frame_number,
                "resolution": f"{image.shape[1]}x{image.shape[0]}",
                "detections_drawn": detections_drawn,
                "file_size": f"{file_size / 1024:.1f} KB",
                "trace_shown": show_trace,
            }

        finally:
            cap.release()

    def _get_trace_data(
        self,
        current_frame: int,
        trace_length: int,
        id_filter: Optional[Sequence[int]] = None,
        class_filter: Optional[str] = None,
        min_conf: Optional[float] = None,
    ) -> Dict[int, List[Tuple[int, int]]]:
        """Get trace data for visualization.

        Args:
            current_frame: Current frame number (1-based)
            trace_length: Number of frames to trace back
            id_filter: Only include specific IDs
            class_filter: Only include specific class
            min_conf: Minimum confidence

        Returns:
            Dictionary mapping ID to list of center points
        """
        trace_data = {}
        start_frame = max(1, current_frame - trace_length)

        # Collect center points for each object
        for frame_num in range(start_frame, current_frame + 1):
            idx = frame_num - 1
            if idx >= len(self.data.frames):
                continue

            frame = self.data.frames[idx]
            for det in frame.detections:
                # Apply filters
                if id_filter is not None and det.id not in id_filter:
                    continue
                if class_filter is not None and det.class_name != class_filter:
                    continue
                if min_conf is not None and det.confidence < min_conf:
                    continue

                # Add center point
                if det.id not in trace_data:
                    trace_data[det.id] = []
                trace_data[det.id].append(tuple(int(c) for c in det.center))

        return trace_data

    def _parse_color(self, color: str) -> Tuple[int, int, int]:
        """Parse color name to BGR tuple.

        Args:
            color: Color name or BGR tuple

        Returns:
            BGR tuple
        """
        color_map = {
            "red": (0, 0, 255),
            "green": (0, 255, 0),
            "blue": (255, 0, 0),
            "white": (255, 255, 255),
            "black": (0, 0, 0),
            "yellow": (0, 255, 255),
            "cyan": (255, 255, 0),
            "magenta": (255, 0, 255),
        }

        if isinstance(color, tuple):
            return color
        if isinstance(color, list):
            return tuple(color)
        if color.lower() in color_map:
            return color_map[color.lower()]

        # Try to parse as "R,G,B" string
        try:
            return tuple(int(c.strip()) for c in color.split(","))
        except (ValueError, AttributeError):
            raise ValueError(f"Unknown color: {color}")

    def _get_confidence_color(self, confidence: float) -> Tuple[int, int, int]:
        """Get color based on confidence level.

        Args:
            confidence: Confidence value (0-1)

        Returns:
            BGR color tuple
        """
        if confidence >= 0.8:
            return (0, 255, 0)  # Green
        elif confidence >= 0.5:
            return (0, 255, 255)  # Yellow
        else:
            return (0, 0, 255)  # Red
