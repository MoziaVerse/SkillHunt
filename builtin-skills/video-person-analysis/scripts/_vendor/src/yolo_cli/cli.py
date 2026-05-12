"""Main CLI entry point for YOLO-CLI."""

import sys
import json
from pathlib import Path
import argparse

from .models.video_data import VideoData
from .utils.data_loader import load_video_data
from .commands.summary import SummaryCommand
from .commands.list import ListCommand
from .commands.analyze import AnalyzeCommand
from .commands.export import ExportCommand
from .commands.dump import DumpCommand
from .commands.visualize import VisualizeCommand


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="YOLO-CLI: Lightweight visual semantic middleware for AI Agents",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    subparsers = parser.add_subparsers(dest="command", help="Analysis commands")
    subparsers.required = True

    def add_json_arg(p):
        p.add_argument("json_file", type=Path, help="Path to YOLO detection JSON file")

    # summary command
    p_summary = subparsers.add_parser("summary", help="Get video summary")
    add_json_arg(p_summary)
    p_summary.set_defaults(func=cmd_summary)

    # list command
    p_list = subparsers.add_parser("list", help="List and filter objects")
    add_json_arg(p_list)
    p_list.add_argument("--min-conf", type=float, default=0.0, help="Minimum confidence")
    p_list.add_argument("--min-frames", type=int, default=0, help="Minimum duration in frames")
    p_list.add_argument("--class", dest="class_name", type=str, help="Filter by class")
    p_list.add_argument("--id", type=int, help="Filter by ID")
    p_list.add_argument("--dominant-only", action="store_true", help="Show only dominant objects")
    p_list.add_argument("--sort", type=str, default="duration", choices=["duration", "confidence", "start-frame"], help="Sort by")
    p_list.add_argument("--limit", type=int, help="Limit results")
    p_list.set_defaults(func=cmd_list)

    # analyze command
    p_analyze = subparsers.add_parser("analyze", help="Analyze interactions, regions, traces")
    add_json_arg(p_analyze)
    analyze_subparsers = p_analyze.add_subparsers(dest="subcommand", help="Analysis type")
    analyze_subparsers.required = True

    # analyze interaction
    p_interaction = analyze_subparsers.add_parser("interaction", help="Detect interactions")
    p_interaction.add_argument("--threshold", type=float, default=50.0, help="Distance threshold (pixels)")
    p_interaction.add_argument("--start-frame", type=int, help="Start frame")
    p_interaction.add_argument("--end-frame", type=int, help="End frame")
    p_interaction.add_argument("--metric", type=str, default="distance", choices=["distance", "iou"], help="Metric")
    p_interaction.add_argument("--min-duration", type=float, help="Minimum duration (seconds)")
    p_interaction.set_defaults(func=cmd_analyze_interaction)

    # analyze region
    p_region = analyze_subparsers.add_parser("region", help="Detect region intrusions")
    p_region.add_argument("--zone", type=str, required=True, help="Region (x1,y1,x2,y2) or name (left, center, right, etc.)")
    p_region.add_argument("--class", dest="class_name", type=str, help="Filter by class")
    p_region.add_argument("--min-duration", type=float, help="Minimum duration (seconds)")
    p_region.set_defaults(func=cmd_analyze_region)

    # analyze trace
    p_trace = analyze_subparsers.add_parser("trace", help="Analyze semantic trace")
    p_trace.add_argument("--id", type=int, required=True, help="Object ID to trace")
    p_trace.add_argument("--granularity", type=int, default=3, choices=[3, 5], help="Grid size")
    p_trace.add_argument("--include-speed", action="store_true", help="Include speed analysis")
    p_trace.set_defaults(func=cmd_analyze_trace)

    # export command
    p_export = subparsers.add_parser("export", help="Export FFmpeg commands")
    add_json_arg(p_export)
    export_subparsers = p_export.add_subparsers(dest="subcommand", help="Export type")
    export_subparsers.required = True

    # export clip-command
    p_clip = export_subparsers.add_parser("clip-command", help="Generate clip command")
    p_clip.add_argument("--video-input", type=str, help="Input video file")
    p_clip.add_argument("--id", type=int, help="Object ID")
    p_clip.add_argument("--start-frame", type=int, help="Start frame")
    p_clip.add_argument("--end-frame", type=int, help="End frame")
    p_clip.add_argument("--padding", type=float, default=2.0, help="Padding seconds")
    p_clip.add_argument("--output", type=str, help="Output filename")
    p_clip.add_argument("--quality", type=str, default="default", choices=["default", "high"], help="Quality")
    p_clip.set_defaults(func=cmd_export_clip)

    # dump command (P2)
    p_dump = subparsers.add_parser("dump", help="Dump raw data")
    dump_subparsers = p_dump.add_subparsers(dest="subcommand", help="Dump type")
    dump_subparsers.required = True

    # dump frame
    p_dump_frame = dump_subparsers.add_parser("frame", help="Dump raw frame data")
    p_dump_frame.add_argument("json_file", type=Path, help="Path to YOLO detection JSON file")
    p_dump_frame.add_argument("--frame", type=int, help="Single frame number (1-based)")
    p_dump_frame.add_argument("--timestamp", type=str, help="Timestamp (HH:MM:SS.mmm or MM:SS.mmm)")
    p_dump_frame.add_argument("--start-frame", type=int, help="Start of range")
    p_dump_frame.add_argument("--end-frame", type=int, help="End of range")
    p_dump_frame.add_argument("--id", type=int, help="Filter by track ID")
    p_dump_frame.add_argument("--class", dest="class_name", type=str, help="Filter by class")
    p_dump_frame.add_argument("--min-conf", type=float, help="Minimum confidence")
    p_dump_frame.add_argument("--fields", type=str, help="Comma-separated fields to include")
    p_dump_frame.set_defaults(func=cmd_dump_frame)

    # visualize command (P2)
    p_visualize = subparsers.add_parser("visualize", help="Generate annotated images")
    p_visualize_subparsers = p_visualize.add_subparsers(dest="subcommand", help="Visualize type")
    p_visualize_subparsers.required = True

    # visualize frame
    p_viz_frame = p_visualize_subparsers.add_parser("frame", help="Visualize single frame with bounding boxes")
    p_viz_frame.add_argument("json_file", type=Path, help="Path to YOLO detection JSON file")
    p_viz_frame.add_argument("--frame", type=int, required=True, help="Frame number to visualize (1-based)")
    p_viz_frame.add_argument("--video-input", type=str, required=True, help="Input video file path")
    p_viz_frame.add_argument("--output", type=str, help="Output image path (default: frame_{N}.jpg)")
    p_viz_frame.add_argument("--id", type=int, help="Only show specific track ID")
    p_viz_frame.add_argument("--class", dest="class_name", type=str, help="Only show specific class")
    p_viz_frame.add_argument("--min-conf", type=float, help="Minimum confidence")
    p_viz_frame.add_argument("--box-color", type=str, default="green", help="Box color")
    p_viz_frame.add_argument("--box-thickness", type=int, default=2, help="Box line thickness")
    p_viz_frame.add_argument("--label-font-size", type=float, default=0.5, help="Label font size")
    p_viz_frame.add_argument("--label-color", type=str, default="white", help="Label text color")
    p_viz_frame.add_argument("--color-by-confidence", action="store_true", help="Color boxes by confidence")
    p_viz_frame.add_argument("--show-trace", action="store_true", help="Show trajectory trace")
    p_viz_frame.add_argument("--trace-length", type=int, default=10, help="Trace back N frames")
    p_viz_frame.add_argument("--quality", type=int, default=95, help="JPEG quality (1-100)")
    p_viz_frame.set_defaults(func=cmd_visualize_frame)

    args = parser.parse_args()

    # Get json_file path (handle both direct and subcommand cases)
    json_file = getattr(args, 'json_file', None)
    if json_file is None:
        print(f"Error: No JSON file specified", file=sys.stderr)
        sys.exit(1)

    # Load data
    data = load_video_data(json_file)
    if data is None:
        print(f"Error: Failed to load {json_file}", file=sys.stderr)
        sys.exit(1)

    # Execute command
    try:
        result = args.func(args, data)
        if result is not None:
            print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_summary(args, data: VideoData):
    """Handle summary command."""
    cmd = SummaryCommand(data)
    return cmd.execute()


def cmd_list(args, data: VideoData):
    """Handle list command."""
    cmd = ListCommand(data)

    ids = [args.id] if args.id else None

    return cmd.execute(
        min_conf=args.min_conf,
        min_frames=args.min_frames,
        class_filter=args.class_name,
        ids=ids,
        dominant_only=args.dominant_only,
        sort_by=args.sort,
        limit=args.limit,
    )


def cmd_analyze_interaction(args, data: VideoData):
    """Handle analyze interaction command."""
    cmd = AnalyzeCommand(data)
    return cmd.interaction(
        threshold=args.threshold,
        start_frame=getattr(args, 'start_frame', None),
        end_frame=getattr(args, 'end_frame', None),
        metric=args.metric,
        min_duration=getattr(args, 'min_duration', None),
    )


def cmd_analyze_region(args, data: VideoData):
    """Handle analyze region command."""
    cmd = AnalyzeCommand(data)

    # Parse zone
    zone_str = args.zone
    if "," in zone_str:
        zone = tuple(map(int, zone_str.split(",")))
    else:
        zone = zone_str  # Region name

    return cmd.region(
        zone=zone,
        class_filter=getattr(args, 'class_name', None),
        min_duration=getattr(args, 'min_duration', None),
    )


def cmd_analyze_trace(args, data: VideoData):
    """Handle analyze trace command."""
    cmd = AnalyzeCommand(data)
    return cmd.trace(
        id=args.id,
        granularity=args.granularity,
        include_speed=args.include_speed,
    )


def cmd_export_clip(args, data: VideoData):
    """Handle export clip-command."""
    cmd = ExportCommand(data)
    return cmd.clip_command(
        video_input=getattr(args, 'video_input', None),
        id=getattr(args, 'id', None),
        start_frame=getattr(args, 'start_frame', None),
        end_frame=getattr(args, 'end_frame', None),
        padding=args.padding,
        output=getattr(args, 'output', None),
        quality=args.quality,
    )


def cmd_dump_frame(args, data: VideoData):
    """Handle dump frame command."""
    cmd = DumpCommand(data)

    # Parse fields if provided
    fields = None
    if hasattr(args, 'fields') and args.fields:
        fields = [f.strip() for f in args.fields.split(",")]

    # Parse ID filter
    id_filter = None
    if hasattr(args, 'id') and args.id is not None:
        id_filter = [args.id]

    return cmd.frame(
        frame_number=getattr(args, 'frame', None),
        timestamp=getattr(args, 'timestamp', None),
        start_frame=getattr(args, 'start_frame', None),
        end_frame=getattr(args, 'end_frame', None),
        id_filter=id_filter,
        class_filter=getattr(args, 'class_name', None),
        min_conf=getattr(args, 'min_conf', None),
        fields=fields,
    )


def cmd_visualize_frame(args, data: VideoData):
    """Handle visualize frame command."""
    cmd = VisualizeCommand(data)

    # Parse ID filter
    id_filter = None
    if hasattr(args, 'id') and args.id is not None:
        id_filter = [args.id]

    return cmd.frame(
        frame_number=args.frame,
        video_input=args.video_input,
        output_path=getattr(args, 'output', None),
        id_filter=id_filter,
        class_filter=getattr(args, 'class_name', None),
        min_conf=getattr(args, 'min_conf', None),
        box_color=args.box_color,
        box_thickness=args.box_thickness,
        label_font_size=args.label_font_size,
        label_color=args.label_color,
        color_by_confidence=args.color_by_confidence,
        show_trace=args.show_trace,
        trace_length=args.trace_length,
        quality=args.quality,
    )


if __name__ == "__main__":
    main()
