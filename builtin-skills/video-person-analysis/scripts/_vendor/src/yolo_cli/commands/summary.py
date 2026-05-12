"""Summary command implementation."""

from typing import Dict, Any, List, Optional
from collections import Counter, defaultdict

from ..models.video_data import VideoData
from ..utils.time_utils import frames_to_seconds, seconds_to_timestamp, format_duration


class SummaryCommand:
    """Generate video summary for AI Agents."""

    def __init__(self, data: VideoData):
        self.data = data

    def execute(self) -> Dict[str, Any]:
        """Execute summary command and return JSON output."""
        return {
            "duration": format_duration(self.data.duration_seconds),
            "total_frames": self.total_frames,
            "peak_timestamp": self.peak_timestamp,
            "dominant_ids_count": self.dominant_ids_count,
            "unique_ids_count": self.unique_ids_count,
            "scene_state": self.scene_state,
            "movement_pattern": self.movement_pattern,
            "interaction_count": self.interaction_count,
            "active_regions": self.active_regions,
            "entry_exit_points": self.entry_exit_points,
            "spatial_density": self.spatial_density,
            "data_quality": self.data_quality,
        }

    @property
    def total_frames(self) -> int:
        """Get total frame count."""
        return len(self.data.frames)

    @property
    def unique_ids_count(self) -> int:
        """Count unique object IDs."""
        ids = set()
        for frame in self.data.frames:
            ids.update(d.id for d in frame.detections)
        return len(ids)

    @property
    def dominant_ids_count(self) -> int:
        """Count dominant objects (appear for > 5 seconds)."""
        dominant_threshold_frames = int(5 * self.data.video_info.fps)
        id_durations = self._calculate_id_durations()
        return sum(1 for duration in id_durations.values() if duration >= dominant_threshold_frames)

    @property
    def peak_timestamp(self) -> Optional[str]:
        """Find timestamp with most activity."""
        if not self.data.frames:
            return None

        max_frame = max(self.data.frames, key=lambda f: len(f.detections))
        if len(max_frame.detections) == 0:
            return None

        frame_time = frames_to_seconds(max_frame.frame_number, self.data.video_info.fps)
        return seconds_to_timestamp(frame_time)

    @property
    def scene_state(self) -> str:
        """Determine scene state: static, flowing, or chaotic."""
        avg_speed = self._calculate_average_speed()

        if avg_speed < 0.5:
            return "static"
        elif avg_speed < 2.0:
            return "flowing"
        else:
            return "chaotic"

    @property
    def movement_pattern(self) -> str:
        """Detect movement pattern."""
        running_ratio = self._calculate_running_ratio()

        if running_ratio > 0.3:
            return "running_detected"
        elif self._calculate_average_speed() < 0.5:
            return "static"
        else:
            return "walking"

    @property
    def interaction_count(self) -> int:
        """Count interaction events (objects close together)."""
        threshold = 100  # pixels
        count = 0

        for frame in self.data.frames:
            detections = frame.detections
            for i in range(len(detections)):
                for j in range(i + 1, len(detections)):
                    dist = self._calculate_distance(
                        detections[i].center,
                        detections[j].center
                    )
                    if dist < threshold:
                        count += 1
                        break

        return count

    @property
    def active_regions(self) -> List[str]:
        """Find most active regions (3x3 grid)."""
        region_counts = Counter()

        for frame in self.data.frames:
            for detection in frame.detections:
                cx, cy = detection.center
                width, height = self.data.video_info.width, self.data.video_info.height

                third_w = width / 3
                third_h = height / 3

                x_idx = int(cx // third_w)
                y_idx = int(cy // third_h)

                x_labels = ["left", "center", "right"]
                y_labels = ["top", "center", "bottom"]

                if 0 <= x_idx < 3 and 0 <= y_idx < 3:
                    region = f"{y_labels[y_idx]}-{x_labels[x_idx]}"
                    region_counts[region] += 1

        # Return top 2 regions
        top_regions = [r for r, _ in region_counts.most_common(2)]
        return top_regions

    @property
    def entry_exit_points(self) -> Dict[str, Optional[str]]:
        """Detect main entry and exit points."""
        first_appearances = {}
        last_appearances = {}

        for frame in self.data.frames:
            for detection in frame.detections:
                if detection.id not in first_appearances:
                    first_appearances[detection.id] = detection.center
                last_appearances[detection.id] = detection.center

        if not first_appearances:
            return {"entry": None, "exit": None}

        # Find most common entry/exit positions
        width, height = self.data.video_info.width, self.data.video_info.height

        def get_position_name(center):
            cx, cy = center
            if cx < width / 3:
                return "left"
            elif cx > 2 * width / 3:
                return "right"
            elif cy < height / 3:
                return "top"
            elif cy > 2 * height / 3:
                return "bottom"
            else:
                return "inside"

        entry_points = [get_position_name(c) for c in first_appearances.values()]
        exit_points = [get_position_name(c) for c in last_appearances.values()]

        entry_counter = Counter(entry_points)
        exit_counter = Counter(exit_points)

        return {
            "entry": entry_counter.most_common(1)[0][0] if entry_counter else None,
            "exit": exit_counter.most_common(1)[0][0] if exit_counter else None,
        }

    @property
    def spatial_density(self) -> str:
        """Calculate spatial density: sparse, moderate, crowded."""
        if not self.data.frames:
            return "empty"

        total_detections = sum(len(f.detections) for f in self.data.frames)
        avg_detections = total_detections / len(self.data.frames)

        video_area = self.data.video_info.width * self.data.video_info.height
        density_per_megapixel = (avg_detections * 1_000_000) / video_area

        if density_per_megapixel < 1:
            return "sparse"
        elif density_per_megapixel < 5:
            return "moderate"
        else:
            return "crowded"

    @property
    def data_quality(self) -> Dict[str, Any]:
        """Assess data quality."""
        if not self.data.frames:
            return {
                "avg_confidence": 0.0,
                "low_conf_ratio": 0.0,
                "missing_frames": 0,
            }

        # Calculate average confidence
        all_confidences = []
        low_conf_count = 0

        for frame in self.data.frames:
            for det in frame.detections:
                all_confidences.append(det.confidence)
                if det.confidence < 0.5:
                    low_conf_count += 1

        avg_conf = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0
        low_conf_ratio = low_conf_count / len(all_confidences) if all_confidences else 0.0

        # Check for missing frames
        missing_frames = 0
        if len(self.data.frames) > 1:
            for i in range(1, len(self.data.frames)):
                expected = self.data.frames[i - 1].frame_number + 1
                actual = self.data.frames[i].frame_number
                missing_frames += max(0, actual - expected - 1)

        return {
            "avg_confidence": round(avg_conf, 3),
            "low_conf_ratio": round(low_conf_ratio, 3),
            "missing_frames": missing_frames,
        }

    def _calculate_id_durations(self) -> Dict[int, int]:
        """Calculate duration in frames for each ID."""
        id_first_frame = {}
        id_last_frame = {}

        for frame in self.data.frames:
            for det in frame.detections:
                if det.id not in id_first_frame:
                    id_first_frame[det.id] = frame.frame_number
                id_last_frame[det.id] = frame.frame_number

        durations = {}
        for id_ in id_first_frame:
            durations[id_] = id_last_frame[id_] - id_first_frame[id_] + 1

        return durations

    def _calculate_average_speed(self) -> float:
        """Calculate average speed in m/s (approximate)."""
        # For static detection, calculate total displacement over time
        # rather than per-frame jitter
        pixel_meter_ratio = 100

        id_first_center = {}
        id_last_center = {}
        id_first_frame = {}
        id_last_frame = {}

        for frame in self.data.frames:
            for det in frame.detections:
                if det.id not in id_first_center:
                    id_first_center[det.id] = det.center
                    id_first_frame[det.id] = frame.frame_number
                id_last_center[det.id] = det.center
                id_last_frame[det.id] = frame.frame_number

        # Calculate average speed based on total displacement
        total_speed = 0
        count = 0

        for id_ in id_first_center:
            if id_ in id_last_center:
                distance = self._calculate_distance(id_first_center[id_], id_last_center[id_])
                frame_diff = id_last_frame[id_] - id_first_frame[id_]

                if frame_diff > 0:
                    speed = (distance / pixel_meter_ratio) / (frame_diff / self.data.video_info.fps)
                    total_speed += speed
                    count += 1

        return total_speed / count if count > 0 else 0.0

    def _calculate_running_ratio(self) -> float:
        """Calculate ratio of time objects are running (> 2 m/s)."""
        pixel_meter_ratio = 100
        id_prev_center = {}
        id_prev_frame = {}

        running_frames = 0
        total_frames = 0

        for frame in self.data.frames:
            for det in frame.detections:
                if det.id in id_prev_center:
                    prev_center = id_prev_center[det.id]
                    prev_frame = id_prev_frame[det.id]
                    frame_diff = frame.frame_number - prev_frame

                    if frame_diff > 0:
                        distance = self._calculate_distance(prev_center, det.center)
                        speed = (distance / pixel_meter_ratio) / (frame_diff / self.data.video_info.fps)

                        total_frames += 1
                        if speed > 2.0:
                            running_frames += 1

                id_prev_center[det.id] = det.center
                id_prev_frame[det.id] = frame.frame_number

        return running_frames / total_frames if total_frames > 0 else 0.0

    def _calculate_distance(
        self,
        center1: tuple,
        center2: tuple
    ) -> float:
        """Calculate distance between two centers."""
        import math
        dx = center2[0] - center1[0]
        dy = center2[1] - center1[1]
        return math.sqrt(dx * dx + dy * dy)
