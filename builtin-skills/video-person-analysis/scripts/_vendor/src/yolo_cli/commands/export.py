"""Export command implementation."""

import os
from pathlib import Path
from typing import List, Dict, Any, Optional

from ..models.video_data import VideoData
from ..utils.time_utils import frames_to_seconds, seconds_to_timestamp


class ExportCommand:
    """Export FFmpeg commands for video clipping."""

    def __init__(self, data: VideoData):
        self.data = data

    def clip_command(
        self,
        video_input: Optional[str] = None,
        id: Optional[int] = None,
        start_frame: Optional[int] = None,
        end_frame: Optional[int] = None,
        padding: float = 2.0,
        output: Optional[str] = None,
        quality: str = "default",
    ) -> Dict[str, Any]:
        """Generate FFmpeg clip command."""
        # Determine time range
        if id is not None:
            # Find ID's time range
            id_range = self._find_id_range(id)
            if id_range is None:
                return {"error": f"ID {id} not found"}
            start_frame = id_range[0]
            end_frame = id_range[1]
        elif start_frame is None or end_frame is None:
            return {"error": "Must specify either id or both start_frame and end_frame"}

        # Apply padding
        start_seconds = frames_to_seconds(start_frame, self.data.video_info.fps)
        end_seconds = frames_to_seconds(end_frame, self.data.video_info.fps)

        padded_start = max(0, start_seconds - padding)
        padded_end = max(0, end_seconds + padding)

        # Determine video input
        if video_input is None:
            video_input = "video.mp4"  # Default

        # Determine output filename
        if output is None:
            if id is not None:
                output = f"clip_id{id}_{seconds_to_timestamp(padded_start).replace(':', '-')}_to_{seconds_to_timestamp(padded_end).replace(':', '-')}.mp4"
            else:
                output = f"clip_{start_frame}-{end_frame}.mp4"

        # Generate command based on quality
        if quality == "high":
            cmd = self._high_quality_command(video_input, padded_start, padded_end, output)
        else:
            cmd = self._fast_command(video_input, padded_start, padded_end, output)

        return {
            "commands": [cmd],
            "metadata": {
                "id": id,
                "start_frame": start_frame,
                "end_frame": end_frame,
                "start_seconds": round(start_seconds, 3),
                "end_seconds": round(end_seconds, 3),
                "padded_start": round(padded_start, 3),
                "padded_end": round(padded_end, 3),
                "padding_seconds": padding,
                "output_file": output,
                "quality": quality,
            },
        }

    def _find_id_range(self, id: int) -> Optional[tuple]:
        """Find first and last frame for an ID."""
        first_frame = None
        last_frame = None

        for frame in self.data.frames:
            for det in frame.detections:
                if det.id == id:
                    if first_frame is None or frame.frame_number < first_frame:
                        first_frame = frame.frame_number
                    if last_frame is None or frame.frame_number > last_frame:
                        last_frame = frame.frame_number

        if first_frame is None:
            return None

        return (first_frame, last_frame)

    def _fast_command(self, video_input: str, start: float, end: float, output: str) -> str:
        """Generate fast copy command."""
        start_ts = seconds_to_timestamp(start)
        end_ts = seconds_to_timestamp(end)
        return f"ffmpeg -i {video_input} -ss {start_ts} -to {end_ts} -c copy {output}"

    def _high_quality_command(self, video_input: str, start: float, end: float, output: str) -> str:
        """Generate high quality re-encode command."""
        start_ts = seconds_to_timestamp(start)
        end_ts = seconds_to_timestamp(end)
        return f"ffmpeg -i {video_input} -ss {start_ts} -to {end_ts} -c:v libx264 -crf 18 -preset slow -c:a aac -b:a 192k {output}"
