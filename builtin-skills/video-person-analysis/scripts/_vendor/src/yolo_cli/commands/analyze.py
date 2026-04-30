"""Analyze command implementation (interaction, region, trace)."""

import math
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict, Counter

from ..models.video_data import VideoData
from ..utils.time_utils import frames_to_seconds, seconds_to_timestamp
from ..utils.bbox_utils import calculate_distance, calculate_iou, point_in_rect, get_region_from_name


class AnalyzeCommand:
    """Analyze interactions, regions, and traces for AI Agents."""

    def __init__(self, data: VideoData):
        self.data = data

    def interaction(
        self,
        threshold: float = 50.0,
        start_frame: Optional[int] = None,
        end_frame: Optional[int] = None,
        metric: str = "distance",
        min_duration: Optional[float] = None,
        gap_tolerance: int = 5,
    ) -> List[Dict[str, Any]]:
        """Detect interactions between objects."""
        events = []

        # Track active interactions
        active_interactions = {}  # (id1, id2) -> event_data

        for frame in self.data.frames:
            # Apply frame range filter
            if start_frame and frame.frame_number < start_frame:
                continue
            if end_frame and frame.frame_number > end_frame:
                break

            detections = frame.detections

            # Check all pairs
            for i in range(len(detections)):
                for j in range(i + 1, len(detections)):
                    id1, id2 = detections[i].id, detections[j].id
                    pair = tuple(sorted((id1, id2)))

                    # Calculate metric
                    if metric == "distance":
                        value = calculate_distance(detections[i].center, detections[j].center)
                        is_interacting = value < threshold
                    elif metric == "iou":
                        value = calculate_iou(detections[i].bbox, detections[j].bbox)
                        is_interacting = value > threshold
                    else:
                        continue

                    if is_interacting:
                        if pair not in active_interactions:
                            # Start new event
                            active_interactions[pair] = {
                                "ids": [id1, id2],
                                "start_frame": frame.frame_number,
                                "end_frame": frame.frame_number,
                                "min_dist": float("inf"),
                                "avg_dist": 0.0,
                                "max_iou": 0.0,
                                "distances": [],
                                "ious": [],
                                "frame_count": 0,
                            }

                        # Update event
                        event = active_interactions[pair]
                        event["end_frame"] = frame.frame_number

                        if metric == "distance":
                            event["min_dist"] = min(event["min_dist"], value)
                            event["distances"].append(value)
                        elif metric == "iou":
                            event["max_iou"] = max(event["max_iou"], value)
                            event["ious"].append(value)

                        event["frame_count"] += 1

        # Merge events with gaps and filter by duration
        for pair, event in active_interactions.items():
            # Calculate duration
            duration_frames = event["end_frame"] - event["start_frame"] + 1
            duration_seconds = frames_to_seconds(duration_frames, self.data.video_info.fps)

            # Filter by min duration
            if min_duration and duration_seconds < min_duration:
                continue

            # Calculate averages
            if event["distances"]:
                event["avg_dist"] = round(sum(event["distances"]) / len(event["distances"]), 1)
            if event["ious"]:
                event["avg_iou"] = round(sum(event["ious"]) / len(event["ious"]), 3)

            # Determine severity
            severity = "proximity"
            if metric == "distance" and event["min_dist"] < 50:
                severity = "contact"
            elif metric == "iou" and event.get("max_iou", 0) > 0.1:
                severity = "collision"

            # Build result
            result = {
                "ids": event["ids"],
                "frame_range": [event["start_frame"], event["end_frame"]],
                "start_time": seconds_to_timestamp(frames_to_seconds(event["start_frame"], self.data.video_info.fps)),
                "end_time": seconds_to_timestamp(frames_to_seconds(event["end_frame"], self.data.video_info.fps)),
                "duration_frames": duration_frames,
                "duration_seconds": round(duration_seconds, 1),
            }

            if metric == "distance":
                result["min_dist"] = event["min_dist"]
                result["avg_dist"] = event["avg_dist"]
                result["severity"] = severity

            if metric == "iou":
                result["max_iou"] = event.get("max_iou", 0.0)
                result["avg_iou"] = event.get("avg_iou", 0.0)
                result["severity"] = severity

            events.append(result)

        return events

    def region(
        self,
        zone: Tuple[int, int, int, int],
        class_filter: Optional[str] = None,
        min_duration: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Detect objects entering a region."""
        # Parse zone
        if isinstance(zone, str):
            zone = get_region_from_name(zone, self.data.video_info.width, self.data.video_info.height)

        # Track region events
        active_in_region = {}  # id -> event_data
        completed_events = []

        for frame in self.data.frames:
            for det in frame.detections:
                # Apply class filter
                if class_filter and det.class_name != class_filter:
                    continue

                # Check if in region
                in_region = point_in_rect(det.center, zone)

                if in_region:
                    if det.id not in active_in_region:
                        # Enter region
                        active_in_region[det.id] = {
                            "id": det.id,
                            "class": det.class_name,
                            "enter_frame": frame.frame_number,
                            "exit_frame": None,
                            "in_region": True,
                        }
                    else:
                        # Still in region
                        active_in_region[det.id]["in_region"] = True
                else:
                    if det.id in active_in_region and active_in_region[det.id]["in_region"]:
                        # Exit region
                        active_in_region[det.id]["exit_frame"] = frame.frame_number - 1
                        active_in_region[det.id]["in_region"] = False

                        # Complete event
                        event = active_in_region[det.id]
                        completed_events.append(event)

        # Handle objects still in region at end
        for event_data in active_in_region.values():
            if event_data["in_region"] and event_data["exit_frame"] is None:
                event_data["exit_frame"] = self.data.frames[-1].frame_number if self.data.frames else 0
                completed_events.append(event_data)

        # Build results
        results = []
        for event in completed_events:
            duration_frames = event["exit_frame"] - event["enter_frame"] + 1
            duration_seconds = frames_to_seconds(duration_frames, self.data.video_info.fps)

            # Filter by min duration
            if min_duration and duration_seconds < min_duration:
                continue

            # Determine severity
            severity = "pass_through"
            if duration_seconds >= 10:
                severity = "loiter"
            elif duration_seconds >= 2:
                severity = "linger"

            results.append({
                "id": event["id"],
                "class": event["class"],
                "enter_frame": event["enter_frame"],
                "exit_frame": event["exit_frame"],
                "enter_time": seconds_to_timestamp(frames_to_seconds(event["enter_frame"], self.data.video_info.fps)),
                "exit_time": seconds_to_timestamp(frames_to_seconds(event["exit_frame"], self.data.video_info.fps)),
                "duration_frames": duration_frames,
                "duration_seconds": round(duration_seconds, 1),
                "severity": severity,
                "description": f"ID {event['id']} entered zone at {seconds_to_timestamp(frames_to_seconds(event['enter_frame'], self.data.video_info.fps))}, stayed for {round(duration_seconds, 1)} seconds, exited at {seconds_to_timestamp(frames_to_seconds(event['exit_frame'], self.data.video_info.fps))}",
                "region": {"x1": zone[0], "y1": zone[1], "x2": zone[2], "y2": zone[3]},
            })

        return results

    def trace(
        self,
        id: int,
        granularity: int = 3,
        include_speed: bool = False,
    ) -> Dict[str, Any]:
        """Analyze semantic trace of an object."""
        # Collect trajectory points
        trajectory = []

        for frame in self.data.frames:
            for det in frame.detections:
                if det.id == id:
                    trajectory.append({
                        "frame": frame.frame_number,
                        "center": det.center,
                        "bbox": det.bbox,
                    })

        if not trajectory:
            return {"error": f"ID {id} not found"}

        # Determine entry/exit points
        first_point = trajectory[0]["center"]
        last_point = trajectory[-1]["center"]

        width, height = self.data.video_info.width, self.data.video_info.height
        entry_point = self._get_position_name(first_point, width, height)
        exit_point = self._get_position_name(last_point, width, height)

        # Build semantic path
        semantic_path = self._build_semantic_path(trajectory, width, height, granularity)

        # Find main region
        main_region = self._find_main_region(trajectory, width, height, granularity)

        # Analyze movement
        movement_summary = "Insufficient data"
        state_segments = []
        anomalies = []

        if include_speed and len(trajectory) > 1:
            movement_summary, state_segments = self._analyze_movement(trajectory)

        return {
            "id": id,
            "entry_point": entry_point,
            "exit_point": exit_point,
            "main_region": main_region["name"],
            "main_region_ratio": round(main_region["ratio"], 2),
            "semantic_path": semantic_path,
            "movement_summary": movement_summary,
            "state_segments": state_segments,
            "anomalies": anomalies,
        }

    def _get_position_name(self, center, width, height) -> str:
        """Get position name from center point."""
        cx, cy = center

        if cx < width / 6:
            return "left"
        elif cx > 5 * width / 6:
            return "right"
        elif cy < height / 6:
            return "top"
        elif cy > 5 * height / 6:
            return "bottom"
        else:
            return "inside"

    def _build_semantic_path(self, trajectory, width, height, granularity) -> List[str]:
        """Build semantic path from trajectory."""
        if granularity == 3:
            grid_w = ["left", "center", "right"]
            grid_h = ["top", "center", "bottom"]
        else:
            grid_w = ["left", "center-left", "center", "center-right", "right"]
            grid_h = ["top", "top-center", "center", "bottom-center", "bottom"]

        path = []
        prev_region = None

        for point in trajectory:
            cx, cy = point["center"]

            x_idx = min(int(cx / (width / granularity)), granularity - 1)
            y_idx = min(int(cy / (height / granularity)), granularity - 1)

            region = f"{grid_h[y_idx]}-{grid_w[x_idx]}"

            if region != prev_region:
                if not path:
                    path.append(f"Entered {region.replace('-', ' ').title()}")
                else:
                    path.append(f"Moved to {region.replace('-', ' ').title()}")
                prev_region = region

        return path

    def _find_main_region(self, trajectory, width, height, granularity) -> Dict[str, Any]:
        """Find where object spent most time."""
        region_counts = Counter()

        for point in trajectory:
            cx, cy = point["center"]
            x_idx = min(int(cx / (width / granularity)), granularity - 1)
            y_idx = min(int(cy / (height / granularity)), granularity - 1)
            region = f"{y_idx}-{x_idx}"
            region_counts[region] += 1

        if not region_counts:
            return {"name": "unknown", "ratio": 0.0}

        main_region_idx, count = region_counts.most_common(1)[0]
        ratio = count / len(trajectory)

        if granularity == 3:
            grid_w = ["left", "center", "right"]
            grid_h = ["top", "center", "bottom"]
        else:
            grid_w = ["left", "center-left", "center", "center-right", "right"]
            grid_h = ["top", "top-center", "center", "bottom-center", "bottom"]

        y_idx, x_idx = map(int, main_region_idx.split("-"))
        region_name = f"{grid_h[y_idx]}-{grid_w[x_idx]}"

        return {"name": region_name, "ratio": ratio}

    def _analyze_movement(self, trajectory) -> Tuple[str, List[Dict[str, Any]]]:
        """Analyze movement patterns."""
        pixel_meter_ratio = 100

        speeds = []
        for i in range(1, len(trajectory)):
            prev = trajectory[i - 1]
            curr = trajectory[i]

            frame_diff = curr["frame"] - prev["frame"]
            if frame_diff == 0:
                continue

            distance = calculate_distance(prev["center"], curr["center"])
            speed = (distance / pixel_meter_ratio) / (frame_diff / self.data.video_info.fps)
            speeds.append(speed)

        if not speeds:
            return "Unknown", []

        avg_speed = sum(speeds) / len(speeds)

        # Classify states
        state_segments = []
        current_state = None
        state_start = 0

        for i, speed in enumerate(speeds):
            if speed < 0.5:
                state = "static"
            elif speed < 2.0:
                state = "walking"
            else:
                state = "running"

            if state != current_state:
                if current_state is not None:
                    state_segments.append({
                        "state": current_state,
                        "start_frame": trajectory[state_start]["frame"],
                        "end_frame": trajectory[i]["frame"],
                    })
                current_state = state
                state_start = i

        if current_state is not None:
            state_segments.append({
                "state": current_state,
                "start_frame": trajectory[state_start]["frame"],
                "end_frame": trajectory[-1]["frame"],
            })

        # Build summary
        state_counts = defaultdict(int)
        for seg in state_segments:
            duration_frames = seg["end_frame"] - seg["start_frame"] + 1
            state_counts[seg["state"]] += duration_frames

        total_frames = sum(state_counts.values())
        if total_frames == 0:
            return "Unknown", []

        summary_parts = []
        for state in ["static", "walking", "running"]:
            if state in state_counts:
                ratio = state_counts[state] / total_frames
                summary_parts.append(f"{state} {ratio * 100:.0f}%")

        return "Mostly " + ", ".join(summary_parts), state_segments
