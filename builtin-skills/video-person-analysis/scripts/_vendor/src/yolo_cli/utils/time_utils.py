"""Time-related utility functions."""

from typing import Optional


def frames_to_seconds(frame_number: int, fps: int) -> float:
    """Convert frame number to seconds."""
    return frame_number / fps


def seconds_to_timestamp(seconds: float) -> str:
    """Convert seconds to HH:MM:SS.mmm format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"


def timestamp_to_frame(timestamp: str, fps: int) -> int:
    """Convert HH:MM:SS.mmm timestamp to frame number."""
    h, m, s_ms = timestamp.split(":")
    s, ms = s_ms.split(".")
    total_seconds = int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000
    return int(total_seconds * fps)


def format_duration(seconds: float) -> str:
    """Format duration in seconds to HH:MM:SS or MM:SS format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)

    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"
