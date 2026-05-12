---
name: video-person-analysis
description: Analyze fight or incident videos with ffmpeg, video-mcp-local, bundled `scripts/yolo-cli` over YOLO track JSON when available, and the evidentai CLI, then generate `analysis/candidate_discovery.json`, `analysis/event_windows.json`, persons.personinfo.json, risk.timeline.json, persons.relation.json, and summary.md. Use when the user wants structured person extraction, role labeling, avatar capture, behavior timelines, relation graphs, or a case-focused video summary.
metadata:
  pattern: pipeline-tool-wrapper-generator-reviewer
  output-format: json
---

Use this skill for videos where the goal is to extract people and produce structured JSON for downstream case analysis.

This skill is intentionally composed from four patterns:

- `pipeline`: the case workflow must run in order
- `tool-wrapper`: tool choice and MCP usage live in references, not in ad hoc prompting
- `generator`: the output set is fixed and repeatable
- `reviewer`: completion is blocked until the final JSON passes schema and checklist review

Treat `reference/persons.personinfo.schema.json` as the final output contract.

Use this operating mode:

- for a new case build, run the full pipeline
- for a repair task, resume from the earliest broken artifact instead of rerunning everything after it

Load extra files only when needed:

- Load `references/tool-routing.md` before choosing tools or deciding sampling strategy.
- Load `references/video-mcp-local.md` before calling `analyze_image` or `analyze_video`.
- Load `references/candidate-discovery.md` before writing `analysis/candidate_discovery.json`.
- Load `references/event-window-review.md` before reviewing conflict windows or writing `analysis/event_windows.json`.
- Load `references/field-mapping.md` before writing any person fields.
- Load `references/cli-derivations.md` before deriving downstream JSON files.
- Load `references/evidentai-cli.md` only if command details or output shapes are needed.
- Load `references/summary-writing.md` before writing `summary.md`.
- Load `references/review-checklist.md` before returning final JSON.
- Use `assets/output-example.json` only as a shape example, not as a source of facts.
- Use `assets/summary-template.md` as the required summary structure.

Run this workflow in order. Do not skip a step if the next step depends on it.

Hard gates:

- do not write `analysis/event_windows.json` until evidence extraction is complete enough to cover all likely conflict windows
- do not write `analysis/event_windows.json` until `analysis/candidate_discovery.json` exists
- every high-priority candidate span in `analysis/candidate_discovery.json` must be covered by `analysis/event_windows.json` or explicitly downgraded or excluded in `analysis/candidate_discovery.json`; do not rely on `summary.md` for this closure
- if `start_boundary_review.selected_start` is earlier than the first event window start, the gap must be explicitly downgraded or excluded in `analysis/candidate_discovery.json`; otherwise the result fails review
- `covered_by_event_windows` for a high-priority candidate requires interval coverage by the referenced event windows; do not count a partial overlap as coverage
- an event window cannot close a candidate span unless its `clip_path` filename or `.clip.json` sidecar source times align with `source_start_time` and `source_end_time`
- do not write `persons.personinfo.json` until `analysis/event_windows.json` exists and identity review is complete enough to support stable person records
- every `participant_refs` value in `analysis/event_windows.json` must be mapped to a stable person id, represented by an unknown or group placeholder person, or explicitly excluded with a reason before `persons.personinfo.json` is finalized
- do not write fight-related `behavior.action` from image-only evidence
- do not drop weak but visible suspicious interactions merely because the force direction or identity is uncertain; write conservative behavior wording instead
- do not assign `attacker` or `victim` without video evidence from at least one reviewed clip
- do not write behavior times until clip-relative observations have been mapped back to source-video time
- do not derive `risk.timeline.json` or `persons.relation.json` until `persons.personinfo.json` is validated
- do not return a completed case result until the review checklist has been applied

## Step 1: Inspect the Video

Confirm the video basics first:

- duration
- frame rate
- resolution
- whether there are cuts, multiple segments, or major viewpoint changes

If the user provided multiple videos, treat them as one case only if they clearly describe the same event.

Checkpoint for Step 1:

- you know the source video duration, frame rate, and resolution
- you know whether the event is likely continuous or split across cuts
- you know whether one timeline or multiple segments will need to be analyzed

## Step 2: Extract Evidence

Create analyzable evidence from the source video:

- keyframes for scene overview
- denser sampled frames around conflict or contact
- short clips around important interactions
- candidate avatar frames for each main person

Use `ffmpeg` to prepare MCP-sized evidence:

- prefer still frames for appearance questions
- prefer short clips for temporal questions
- do not send the full original video to `analyze_video` when a short clip will answer the question
- if a clip is too large for `video-mcp-local`, shorten it or reduce resolution before analysis
- every extracted clip used for MCP analysis must preserve its source-video start time
- use 6 to 8 second clips for conflict-window review whenever the event boundary can fit
- if the window is longer than 8 seconds, split it into overlapping reviewed clips instead of falling back to still frames

Default extraction parameters unless the case requires otherwise:

- scene-overview frames: sample every 2 seconds across the whole video
- conflict-density frames: sample every 0.5 seconds in candidate conflict windows
- critical-contact frames: sample every 0.2 seconds around visible contact, chasing, or falling
- event-review clips: prefer 6 to 8 seconds so the lead-in and separation are both visible
- follow-up clarification clips: 4 seconds when only one narrow temporal question remains
- avatar candidates: export 3 frames per main person, preferring clear upper-body views with minimal blur

Default clip adjustment order:

1. shorten duration
2. reduce frame rate if needed
3. reduce resolution if needed

If a same-person check needs more than one frame, first use `ffmpeg` to compose a side-by-side comparison image and then send that composite image to `analyze_image`.

Required clip metadata for every extracted analysis clip:

- `source_video_path`
- `clip_path`
- `source_start_time`
- `source_end_time`
- `clip_duration`
- `source_start_frame` when available
- `notes`

Fixed naming rule:

- if the clip is `analysis/conflict_clip.mp4`, the metadata sidecar must be `analysis/conflict_clip.clip.json`
- use the same basename for the clip and its sidecar

Recommended sidecar example:

```json
{
  "source_video_path": "raw_data/video.mp4",
  "clip_path": "analysis/conflict_clip.mp4",
  "source_start_time": 96.4,
  "source_end_time": 104.4,
  "clip_duration": 8.0,
  "source_start_frame": 2892,
  "notes": "main conflict window"
}
```

Never create a clip for MCP analysis without also preserving its source start time.

Preferred extraction helper:

- use `scripts/extract-analysis-clip` to generate both the clip and its `.clip.json` sidecar in one step

Prefer higher sampling density during these moments:

- approach or confrontation
- physical contact
- chasing or blocking
- falling or retreating
- separation after conflict

Checkpoint for Step 2:

- every MCP-bound clip has a matching `.clip.json` sidecar
- every planned MCP call has the smallest frame or clip that can answer the question
- likely conflict windows have at least one review-ready 6 to 8 second clip, or overlapping clips when the window is longer
- evidence is organized enough to support event review, person continuity, and later absolute-time mapping

## Step 3: Candidate Discovery Ledger

Before writing event windows, write `analysis/candidate_discovery.json`.

Load `references/candidate-discovery.md`.

Goal:

- document how the long video was narrowed down without requiring full-video MCP review
- preserve the low-cost discovery signals used across the whole video
- list candidate spans with priority and planned review action
- list excluded or low-priority spans with an evidence-based reason and confidence
- force closure for every high-priority candidate span

Required candidate sources to consider:

- YOLO interaction or proximity spans when upstream track JSON exists
- scene-overview frames
- motion or crowd-density changes
- visible object or weapon-like cues
- gathering, confrontation, rapid approach, pursuit, blocking, falling, retreat, separation
- manual frame review or spot checks when automated signals are unavailable

Conflict start boundary rule:

- if the earliest suspicious or high-priority candidate begins with an already ongoing conflict state, confirm the conflict start boundary before finalizing `analysis/candidate_discovery.json`
- ongoing-state cues include a person already on the ground or kneeling, people already in close contact, visible pulling or pressing, blocking, chasing, restraining, or an object already being contested
- do not use a fixed backward window as the start by default; expand backward only while earlier evidence continues to show conflict setup cues
- use the nearest earlier low-cost evidence first, then review only the smallest preceding clips needed to choose the boundary
- the range immediately before the selected boundary may not be marked as a high-confidence exclusion unless the boundary review explains why earlier activity is ordinary or not conflict-relevant

`analysis/candidate_discovery.json` must include:

- `source_video_path`
- `source_video_duration`
- `discovery_methods`
- `candidate_spans`
- `excluded_spans`
- `open_questions`

Each `candidate_spans` entry must include:

- `start`
- `end`
- `reason`
- `priority`: `high`, `medium`, or `low`
- `review_action`: for example `analyze_video_clips`, `dense_frame_review`, `sampled_frames_only`, or `downgraded`
- `closure`: `pending`, `covered_by_event_windows`, `downgraded`, or `excluded`
- `event_window_ids`: required when closure is `covered_by_event_windows`
- `closure_reason`: required when closure is `downgraded` or `excluded`

Hard closure rule:

- all high-priority candidate spans must be closed before final output
- a high-priority candidate span is closed only if it is covered by one or more event windows, or if `candidate_discovery.json` explicitly downgrades or excludes it with a reason
- if an agent writes in `summary.md` that a later span has no conflict, that span must also appear as covered, downgraded, or excluded in `candidate_discovery.json`

Checkpoint for Step 3:

- `analysis/candidate_discovery.json` exists
- high-priority candidate spans are not left open
- long non-reviewed sections are explained by low-cost signals, not silently ignored
- candidate discovery is used to decide event-window coverage, not merely as narrative context

## Step 4: Event Window Review

Before identifying final person records, review the event as video first and identity second.

Load `references/event-window-review.md`.

Goal:

- find every likely conflict-related or investigatively relevant window
- review each window with `analyze_video` on a 6 to 8 second clip whenever practical
- determine what happened in time order before deciding who each person is
- preserve uncertainty explicitly when the video is unclear

Required intermediate artifact:

- write `analysis/event_windows.json` before `persons.personinfo.json`
- cover every high-priority candidate span from `analysis/candidate_discovery.json`, unless that span has been explicitly downgraded or excluded there
- every reviewed window must include:
  - `clip_path`
  - `source_start_time`
  - `source_end_time`
  - `relative_start`
  - `relative_end`
  - `event_type`
  - `question`
  - `video_observation`
  - `uncertainty`
  - `source_basis`
  - `participants`
  - `participant_refs`
  - `behavior_support`
  - `risk_relevance`
  - `supports_role`
  - `dedupe_key`

Preferred window discovery order:

1. use `scripts/yolo-cli analyze ... interaction` when track JSON exists
2. use scene-overview frames plus dense `ffmpeg` sampling to locate approach, contact, chase, fall, and separation windows
3. expand each candidate window so the reviewed clip includes lead-in and aftermath, not only the moment of contact
4. if the first reviewed conflict clip begins with an already ongoing state, return to Step 3 and confirm the conflict start boundary before continuing

Video-first rules:

- event order, approach direction, contact, pursuit, blocking, intervention, retreat, falling, and role tendency must come from `analyze_video`
- `analyze_image` must not be used to decide whether a fight-related action occurred
- if a still frame suggests conflict but no reviewed clip supports it, keep the wording weak and do not convert it into a fight conclusion
- if a reviewed clip is too dense, split it into narrower overlapping clips and keep the results together under the same event window

Stopping rules for one event window:

- each window may use at most:
  - 1 baseline question
  - 1 clarification question
  - 1 role-tendency question
- if the answer is still unclear after that limit, downgrade the window to explicit uncertainty
- do not keep asking adjacent variations of the same question after the stop limit

Checkpoint for Step 4:

- `analysis/event_windows.json` exists
- every high-priority candidate span is covered by event windows or closed in `analysis/candidate_discovery.json`
- every likely conflict window has been reviewed by video, not only by still frames
- event descriptions are written before final identity binding
- uncertainty is explicit where the clip does not support a strong conclusion
- every window obeys the maximum question count rule

## Step 5: Detect and Track Persons

Use the appropriate tool mix from `references/tool-routing.md`.
Load `references/video-mcp-local.md` before using `analyze_image` or `analyze_video`.

Goal:

- identify the main persons involved
- keep a stable identity for each person across time
- bind reviewed event participants back to stable person records
- preserve weakly identified participants with unknown or group placeholders when they appear in reviewed windows
- avoid splitting one person into multiple ids unless the evidence is clear

If identity continuity is weak because of blur, occlusion, or camera shake, prefer conservative merging over speculative duplication.

Tool responsibilities in this step:

- use `scripts/yolo-cli` only when an upstream YOLO detection or tracking JSON already exists
- use `analyze_image` only for frame-level appearance refinement, avatar comparison, and conservative same-person checks
- use `analyze_video` only when continuity across time still needs to be resolved from motion
- do not treat MCP output as final structured truth; convert it into cautious observations before writing JSON
- do not let `analyze_video` determine final source-video timestamps by itself
- do not revise event order here unless new video evidence requires returning to Step 4

Preferred `scripts/yolo-cli` sequence when track JSON exists:

1. run `scripts/yolo-cli summary input.json` to understand scene density, dominant ids, and peak time
2. run `scripts/yolo-cli list input.json --class person --sort duration` to find long-lived person ids
3. if there are many transient ids, rerun with `--min-frames` to suppress flicker noise
4. run `scripts/yolo-cli analyze input.json interaction --threshold 100` to find candidate proximity or contact windows
5. run `scripts/yolo-cli analyze input.json trace --id <ID>` for each likely main person when continuity or entry/exit direction matters
6. run `scripts/yolo-cli export input.json clip-command --start-frame <A> --end-frame <B> --padding 1 --video-input raw_data/video.mp4` to generate clip extraction commands for the windows worth sending to `analyze_video`

Final convergence rules for this step:

- final person ids are assigned only after both appearance consistency and temporal continuity have been reviewed
- if appearance suggests the same person but continuity is weak, keep one record only when the merge is still the more conservative choice
- if continuity suggests one track but appearance clearly differs, split into separate person records
- `scripts/yolo-cli` may nominate candidate ids and spans, but it never decides final identity by itself
- event understanding remains anchored to Step 4 outputs; this step binds identities to those events
- `participant_refs` should preserve stable cross-window handles before final person ids are assigned
- every `participant_refs` value must resolve to a stable person id, an unknown or group placeholder id, or a written exclusion reason
- use placeholders such as `p_unknown_scooter_1`, `p_unknown_dark_jacket_1`, or `p_group_bystanders_1` when a participant is visible and relevant but cannot be identified reliably
- no fight-related role or behavior may be introduced here unless it is already supported by a reviewed event window

Checkpoint for Step 5:

- likely main persons are stable enough to assign one record per visible person
- candidate duplicates have been conservatively merged or split
- reviewed event participants can be mapped onto stable person ids
- no discovered relevant `participant_refs` value disappears silently between `event_windows.json` and `persons.personinfo.json`
- no final identity, event order, role, or timestamp depends only on detector output or unanchored MCP wording

## Step 6: Build Person Records

Before writing fields, load `references/field-mapping.md`.

For each person, fill only schema-supported fields:

- `id`
- `name`
- `role`
- `gender`
- `appearance`
- `avatar`
- `behaviors`

Rules:

- `id` must match `^p_[A-Za-z0-9_]+$`
- `name` may be a stable placeholder if the real name is unknown
- `gender` is optional and should be omitted when uncertain
- `appearance` must describe visible traits only
- `avatar` must be a project-relative path
- `appearance` and `avatar` may use image evidence
- `role` and conflict-related `behaviors` must wait until the reviewed event windows have been mapped to people
- unknown or group placeholder persons are allowed when they prevent losing a visible relevant participant; keep their role as `witness` unless reviewed video strongly supports another role

Checkpoint for Step 6:

- every person record is schema-compatible
- placeholder naming is stable and descriptive enough for downstream behavior text
- avatar paths are valid project-relative paths
- image evidence is used only for identity-facing fields, not for conflict conclusions
- every visible relevant event participant is represented by a person record, placeholder record, or explicit exclusion reason

## Step 7: Write Behaviors From Event Windows

Write behaviors from the viewpoint of the acting subject person, but only after mapping `analysis/event_windows.json` participants to stable person ids.

For each behavior:

- `time` is required and measured in seconds from video start
- `endTime` is optional but should be included for spans
- `action` must describe observable conduct in natural Chinese and should use person names rather than `p_xxx` ids
- `personIds` should list other involved persons that already exist in the document

Do not write legal conclusions, motives, or injuries unless directly visible and relevant to the schema field.
Keep ids in `personIds`; keep `action` human-readable.

Hard behavior rules:

- every fight-related `behavior.action` must map back to at least one reviewed clip in `analysis/event_windows.json`
- event windows with `behavior_support = "strong"` should normally produce one or more downstream behaviors
- event windows with `behavior_support = "weak"` may produce downstream behaviors and should be kept with conservative wording when the interaction is visibly suspicious or useful for risk review
- only event windows with `behavior_support = "none"` should normally be omitted from downstream behaviors
- if only image evidence exists, use only weak static wording such as `出现在画面中`, `位于冲突附近`, or `与他人近距离站立`
- do not infer push, strike, chase, block, intervene, fall cause, or attack from a still frame alone

High-recall rule for downstream timeline generation:

- if a visible interaction could reasonably support fight-risk review, prefer keeping it in `behaviors` with conservative wording rather than omitting it
- weak interactions may use wording such as `靠近冲突区域`, `发生短暂接触`, `被多人围拢`, `疑似推搡`, `持续贴近并移动`, or `位于冲突中心附近`
- when exact aggressor direction is unclear, use neutral observable wording such as `发生肢体接触`, `相互拉扯`, or `持续贴近并移动`
- ensure clearly involved counterpart persons appear in `personIds`, because `risk.timeline.json` is derived from these linked behaviors

Time-mapping rule for behavior writing:

- if a behavior was inferred from a clip, convert clip-relative time to source-video absolute time before writing `time` or `endTime`
- use `absolute_time = clip.source_start_time + relative_time`
- if exact sub-second timing is unclear, use cautious rounded values, but still in the source-video timebase
- never write raw clip-relative time into `persons.personinfo.json` unless the clip itself is the source video

Adjacent-window merge rule:

- if neighboring event windows have the same `participant_refs` or final person ids, the same `event_type` or continuous action chain, and overlapping or near-overlapping time spans, merge them into one main downstream behavior
- use `dedupe_key` plus time overlap to suppress duplicate behavior entries
- keep the clearest and best-supported window as the main evidence source, and treat the others as supporting evidence rather than separate behaviors

Checkpoint for Step 7:

- every kept conflict-relevant interaction is attached to at least one person record
- every fight-related behavior is traceable to a reviewed event window
- every weak but visible suspicious event is either represented by conservative behavior wording or explicitly omitted with a reason
- overlapping windows do not create duplicate downstream behaviors for the same event chain
- `personIds` preserve visible counterparts needed for downstream timeline derivation
- `time` and `endTime` are in source-video absolute time

## Step 8: Assign Roles Conservatively

Use only these role values:

- `attacker`
- `victim`
- `witness`

Assign roles last, after the event sequence, person continuity, and behavior attribution are already stable.

Guidance:

- `attacker`: initiates or continues visible aggressive contact in reviewed video evidence
- `victim`: mainly receives aggression, is chased, struck, pushed, or cornered in reviewed video evidence
- `witness`: nearby observer, companion, or uninvolved bystander without clear aggressive participation

If the role is unclear, choose the least committal role the evidence supports and keep the behaviors factual.

Role-evidence rules:

- `attacker` or `victim` must be supported by at least one reviewed video clip with `supports_role = true`
- if reviewed clips support suspicious interaction but not directionality, keep the behaviors and downgrade the role
- prefer `witness` plus concrete suspicious behaviors over deleting a visible interaction

Checkpoint for Step 8:

- role labels do not overstate certainty
- suspicious conflict behavior is preserved even when exact aggressor direction is unclear
- no `attacker` or `victim` label exists without reviewed video support

## Step 9: Validate `persons.personinfo.json`

Load `references/review-checklist.md` and verify the final result against both the checklist and `reference/persons.personinfo.schema.json`.

Minimum checks:

- top-level shape is valid
- `persons` is non-empty
- every person id is unique
- every `behavior.personIds` entry refers to an existing person id
- `endTime >= time`
- behaviors are sorted by ascending time
- no fields outside the schema are returned

If the local CLI is available, run its `validate` command on the generated `persons.personinfo.json` before moving on.

The bundled CLI copy for this skill is `scripts/evidentai`.

Also run the bundled coverage validator before deriving downstream files:

```bash
scripts/validate-analysis-coverage --case-dir .
```

Checkpoint for Step 9:

- schema validation passes
- candidate/event coverage validation passes
- checklist review passes
- if a validation or review issue fails, return to the earliest affected step and repair there

## Step 10: Derive Timeline and Relation Files

Load `references/cli-derivations.md`.

After `persons.personinfo.json` is complete, derive:

- `risk.timeline.json`
- `persons.relation.json`

Preferred CLI flow:

1. Run `scripts/evidentai validate -i persons.personinfo.json`
2. Run `scripts/validate-analysis-coverage --case-dir .`
3. Run `scripts/evidentai generate -i persons.personinfo.json -f` to produce both downstream files

If the user needs explicit control, the CLI may also be used as:

- `scripts/evidentai timeline` to generate only `risk.timeline.json`
- `scripts/evidentai relation` to generate only `persons.relation.json`

Use the CLI as the source of truth for derived files rather than manually inventing those structures.

Checkpoint for Step 10:

- derived files come from the CLI, not manual reconstruction
- derived content still matches the final validated `persons.personinfo.json`

## Step 11: Write `summary.md`

Load `references/summary-writing.md` and use `assets/summary-template.md`.

`summary.md` is required.

The summary must:

- describe only case-related content visible in the video
- focus on the event process, key persons, interactions, and relevant scene context
- stay consistent with `analysis/candidate_discovery.json`, `analysis/event_windows.json`, `persons.personinfo.json`, `risk.timeline.json`, and `persons.relation.json`
- avoid unrelated background details
- avoid legal conclusions not directly supported by the video
- avoid speculation about motive, identity, or off-camera events

If the evidence is incomplete, say what is unclear instead of guessing.

Checkpoint for Step 11:

- `summary.md` matches the final JSON outputs
- any time span described in `summary.md` is traceable to `analysis/candidate_discovery.json`, `analysis/event_windows.json`, or downstream JSON
- summary wording preserves high-recall suspicious interactions that were intentionally kept in `behaviors`
- summary does not introduce new facts absent from the structured outputs

## Output Rules

Default expected outputs for a completed case directory are:

- `analysis/candidate_discovery.json`
- `analysis/event_windows.json`
- `persons.personinfo.json`
- `risk.timeline.json`
- `persons.relation.json`
- `summary.md`

If the user asks for final outputs, include `summary.md` together with the structured JSON files unless they explicitly request otherwise.

If the user asks for analysis plus JSON, use this order:

1. Brief summary of the event and main persons
2. Major ambiguities or weak-evidence points
3. `analysis/candidate_discovery.json`
4. `analysis/event_windows.json`
5. `persons.personinfo.json`
6. `risk.timeline.json`
7. `persons.relation.json`
8. `summary.md`

Never fabricate:

- real names
- relationships
- intent
- off-camera events
- unsupported injuries

Prefer omission over guessing.

Failure handling:

- if `analyze_video` times out, narrow the question or shorten the clip before retrying
- if timing is unclear, refine with `ffmpeg` evidence rather than asking MCP for exact source timestamps
- if the current artifact looks wrong, repair the earliest upstream artifact instead of patching only the downstream file
