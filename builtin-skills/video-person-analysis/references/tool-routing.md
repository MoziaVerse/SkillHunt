# Tool Routing

Use this file before deciding how to analyze the video.

## Tool Roles

### `ffmpeg`

Use for:

- reading video metadata
- extracting keyframes
- sampling frames by time
- cutting short clips around events
- exporting avatar images
- composing side-by-side comparison images

Use first when you need deterministic frame or clip extraction.

Default extraction settings:

- overview frames: every 2 seconds
- start-boundary clips: smallest preceding clips needed when the earliest conflict window is already ongoing
- conflict-window frames: every 0.5 seconds
- contact or fall windows: every 0.2 seconds
- event-review clips: 6 to 8 seconds by default
- follow-up clarification clips: 4 seconds
- avatar candidates: 3 frames per main person

Source-time rule:

- every extracted clip must preserve a recorded `source_start_time`
- exact event timestamps come from source-video timing plus clip offset, not from MCP wording alone
- clip sidecars use the fixed suffix `.clip.json`
- prefer `scripts/extract-analysis-clip` over manual clip extraction when preparing MCP inputs

### `scripts/yolo-cli`

Use for:

- candidate person discovery from existing YOLO tracking JSON
- coarse counting
- rough temporal presence
- rough track continuity
- candidate interaction windows and clip suggestions

Important boundary:

- `scripts/yolo-cli` reads existing detection or tracking JSON
- it is not the source video detector itself
- if no upstream YOLO JSON exists, continue with `ffmpeg` evidence extraction and MCP-based review

Bundled path:

- `scripts/yolo-cli`

Portability note:

- this wrapper uses vendored `yolo-cli` source and vendored Python dependencies inside the skill
- it does not depend on a fixed external checkout path

### EvidentAI CLI

Use for:

- validating `persons.personinfo.json`
- deriving `risk.timeline.json`
- deriving `persons.relation.json`
- generating both derived files in one pass

Bundled path:

- `scripts/evidentai`

Use after the person extraction result has been written.

### `scripts/validate-analysis-coverage`

Use before deriving downstream files or returning final output.

It validates:

- `start_boundary_review.selected_start` does not leave an unexplained gap before the first event window
- high-priority candidates marked `covered_by_event_windows` are interval-covered by referenced event windows
- event window `clip_path` filename or `.clip.json` sidecar times align with `source_start_time` and `source_end_time`

### `video-mcp-local.analyze_image`

Use for:

- appearance refinement on representative frames
- clothing and accessory recognition
- choosing avatar candidates
- comparing candidate same-person frames

Best when the question is frame-specific and identity-facing.

Hard boundary:

- do not use `analyze_image` to decide approach order, contact, pursuit, blocking, intervention, falling, or role
- if more than one frame must be compared, first build a side-by-side composite image with `ffmpeg`, then send that composite to `analyze_image`

### `video-mcp-local.analyze_video`

Use for:

- continuity across time
- multi-person interaction understanding
- event segmentation
- approach order
- contact, pursuit, blocking, intervention, retreat, and falling
- conservative role tendency from visible sequences

Best when the question depends on motion and temporal order.

Important boundary:

- prefer short clips over full original videos
- use only after `ffmpeg` has extracted a relevant clip
- keep clips within the local MCP size limit
- treat any time returned by `analyze_video` as clip-relative unless independently anchored by `ffmpeg`
- prefer 6 to 8 second clips for event-window review
- prefer 4 second clips only for follow-up clarification after the event window is already known
- ask one primary question per `analyze_video` call to reduce timeout risk

## Recommended Flow

1. Use `ffmpeg` to inspect the video and extract frames or clips.
2. If YOLO tracking JSON exists, use `scripts/yolo-cli` to find candidate people, rough track spans, and likely interaction windows.
3. Write `analysis/candidate_discovery.json` using low-cost signals before escalating to MCP-heavy review.
4. Use `video-mcp-local.analyze_video` on reviewed event clips to decide what happened in time order.
5. If the earliest reviewed conflict clip is already ongoing, confirm the conflict start boundary before writing final event windows.
6. Write `analysis/event_windows.json`, closing every high-priority candidate span through coverage, downgrade, or exclusion.
7. Use `video-mcp-local.analyze_image` to refine appearance, compare representative frames, and choose avatars.
8. Bind reviewed event participants to stable person ids, unknown placeholders, or group placeholders.
9. Write `persons.personinfo.json`.
10. Run `scripts/evidentai validate -i persons.personinfo.json` and `scripts/validate-analysis-coverage --case-dir .`.
11. Use the EvidentAI CLI to derive final downstream files.
12. If there is conflict between tools, prefer the interpretation best supported by reviewed video evidence.

## Decision Rules

- If you need exact timestamps, start with `ffmpeg`.
- If you need to know what happened over time, start with `video-mcp-local.analyze_video`.
- If you are writing `behavior.time`, use source-video absolute time, not raw clip-relative time.
- If upstream YOLO JSON exists and you need rough candidate people or spans, start with `scripts/yolo-cli`.
- If you need to know whether two candidate appearances are the same person, start with `video-mcp-local.analyze_image`.
- If contact, pursuit, initiation, blocking, or sequence is ambiguous in still frames, you must defer to `video-mcp-local.analyze_video`.
- If the first reviewed conflict clip starts with someone already down, kneeling, surrounded, pulling, pressing, blocking, or contesting an object, use the smallest preceding clips needed to confirm the start boundary before declaring the event start.
- If an `analyze_video` call times out, retry with a shorter clip or a narrower question before retrying the same prompt.
- If a frame is too blurred for appearance, use another frame from the same track instead of guessing.
- If two frames need to be compared in one MCP call, compose them into one comparison image before calling `analyze_image`.
- If a clip is too large for `analyze_video`, shorten it before reducing resolution.
- If the final person JSON is ready, use the EvidentAI CLI instead of manually building timeline or relation JSON.

## `scripts/yolo-cli` Sequence

Use this order when track JSON exists:

1. `scripts/yolo-cli summary tracks.json`
2. `scripts/yolo-cli list tracks.json --class person --sort duration`
3. `scripts/yolo-cli list tracks.json --class person --min-frames 60 --sort duration` if transient ids are noisy
4. `scripts/yolo-cli analyze tracks.json interaction --threshold 100 --min-duration 0.5`
5. `scripts/yolo-cli analyze tracks.json trace --id <ID>` for each likely main person
6. `scripts/yolo-cli export tracks.json clip-command --start-frame <A> --end-frame <B> --padding 1 --video-input raw_data/video.mp4`

## Default Collaboration Pattern

- `ffmpeg` answers: which frame or clip should be examined
- `ffmpeg` also answers: where that clip sits on the source-video timeline
- `scripts/yolo-cli` answers: which ids or spans are worth attention when track JSON exists
- `video-mcp-local.analyze_video` answers: what happened over time and which event windows support downstream behaviors
- `video-mcp-local.analyze_image` answers: who this likely is by appearance
- event understanding comes before final identity binding

## Conservative Conflict Resolution

When tools disagree:

1. Prefer directly observable reviewed video evidence.
2. Prefer temporal continuity over a single noisy frame.
3. Prefer omission or weaker wording over speculative classification.
4. Prefer one stable person record over multiple weak duplicates.

## Final Convergence Rules

- final identity requires both appearance review and continuity review
- `scripts/yolo-cli` can suggest candidates but cannot finalize identity
- `video-mcp-local.analyze_image` is primary for appearance consistency only
- `video-mcp-local.analyze_video` is primary for action order and behavior attribution
- exact timestamps come from `ffmpeg`-derived frames or clips, not from MCP wording
- final roles are derived from confirmed behaviors in reviewed clips, not from proximity alone
- if evidence is mixed, choose the more conservative merge, attribution, or role
- clip-relative timing must be mapped back with `source_start_time` before it becomes `persons.personinfo.json` timing
