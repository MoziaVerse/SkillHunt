"""Bounding box and geometry utility functions."""

import math
from typing import Tuple


def calculate_distance(
    center1: Tuple[float, float],
    center2: Tuple[float, float]
) -> float:
    """Calculate Euclidean distance between two center points."""
    dx = center2[0] - center1[0]
    dy = center2[1] - center1[1]
    return math.sqrt(dx * dx + dy * dy)


def calculate_iou(
    bbox1: list,
    bbox2: list
) -> float:
    """Calculate Intersection over Union (IoU) between two bounding boxes."""
    x1_min, y1_min, x1_max, y1_max = bbox1
    x2_min, y2_min, x2_max, y2_max = bbox2

    # Calculate intersection
    inter_x_min = max(x1_min, x2_min)
    inter_y_min = max(y1_min, y2_min)
    inter_x_max = min(x1_max, x2_max)
    inter_y_max = min(y1_max, y2_max)

    if inter_x_max < inter_x_min or inter_y_max < inter_y_min:
        return 0.0

    inter_area = (inter_x_max - inter_x_min) * (inter_y_max - inter_y_min)

    # Calculate union
    bbox1_area = (x1_max - x1_min) * (y1_max - y1_min)
    bbox2_area = (x2_max - x2_min) * (y2_max - y2_min)
    union_area = bbox1_area + bbox2_area - inter_area

    if union_area == 0:
        return 0.0

    return inter_area / union_area


def point_in_rect(
    point: Tuple[float, float],
    rect: Tuple[int, int, int, int]
) -> bool:
    """Check if a point is inside a rectangle."""
    x, y = point
    x1, y1, x2, y2 = rect
    return x1 <= x <= x2 and y1 <= y <= y2


def get_region_from_name(
    region_name: str,
    width: int,
    height: int
) -> Tuple[int, int, int, int]:
    """Get region coordinates from predefined region name."""
    third_w = width // 3
    third_h = height // 3

    regions = {
        "left": (0, 0, third_w, height),
        "center": (third_w, 0, 2 * third_w, height),
        "right": (2 * third_w, 0, width, height),
        "top": (0, 0, width, third_h),
        "bottom": (0, 2 * third_h, width, height),
        "top-left": (0, 0, third_w, third_h),
        "top-center": (third_w, 0, 2 * third_w, third_h),
        "top-right": (2 * third_w, 0, width, third_h),
        "center-left": (0, third_h, third_w, 2 * third_h),
        "center-center": (third_w, third_h, 2 * third_w, 2 * third_h),
        "center-right": (2 * third_w, third_h, width, 2 * third_h),
        "bottom-left": (0, 2 * third_h, third_w, height),
        "bottom-center": (third_w, 2 * third_h, 2 * third_w, height),
        "bottom-right": (2 * third_w, 2 * third_h, width, height),
    }

    return regions.get(region_name, (0, 0, width, height))
