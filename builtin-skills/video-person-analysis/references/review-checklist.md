# Review Checklist

Use this checklist immediately before returning the final JSON.

## Artifact Checks

- `analysis/candidate_discovery.json` exists before `analysis/event_windows.json`
- `analysis/event_windows.json` exists before `persons.personinfo.json`
- every high-priority candidate span in `analysis/candidate_discovery.json` is covered by event windows, downgraded, or excluded with a reason
- every reviewed event window has `clip_path`, `source_start_time`, `question`, `video_observation`, and `uncertainty`
- every reviewed event window has `behavior_support` set to `strong`, `weak`, or `none`
- every reviewed event window has `risk_relevance` set to `high`, `medium`, or `low`
- every conflict-supporting event window is backed by a reviewed clip, not a still frame alone
- if the earliest conflict window starts with an already-ongoing state, `analysis/candidate_discovery.json` explains the selected start boundary and why earlier time was not included
- no span immediately before the selected start boundary is marked `confidence: "high"` and `review_action: "sampled_frames_only"` unless the boundary review explains why earlier activity is ordinary or not conflict-relevant
- if `start_boundary_review.selected_start` is earlier than the first event window start, the gap is explicitly covered by downgraded or excluded spans in `analysis/candidate_discovery.json`
- every high-priority candidate marked `covered_by_event_windows` is fully covered by the union of its referenced event windows
- no high-priority candidate is treated as closed by partial overlap, such as `60-85` being closed only by `80-95`
- every event window's `source_start_time` and `source_end_time` match its `.clip.json` sidecar or time-coded `clip_path` filename
- `scripts/validate-analysis-coverage --case-dir .` passes before deriving or returning final outputs

## Schema Checks

- Top-level object contains `version` and `persons`
- `version` is a non-empty string
- `persons` is a non-empty array
- No unsupported top-level fields exist

## Person Checks

- Every person has `id`, `name`, and `role`
- Every `id` matches `^p_[A-Za-z0-9_]+$`
- Every `id` is unique
- `role` is one of `attacker`, `victim`, `witness`
- `gender`, if present, is one of `male`, `female`
- `appearance`, if present, is based on visible traits only
- `avatar`, if present, is a project-relative path
- No unsupported person fields exist

## Behavior Checks

- `behaviors`, if present, is an array
- Each behavior has `time`, `action`, and `personIds`
- `time` is a number and is not negative
- `endTime`, if present, is a number and `endTime >= time`
- `action` is concrete and observational
- `action` uses person names or natural references, not `p_xxx` ids or detector labels
- Every `personIds` item exists in the same document
- `personIds` contains unique values
- Behaviors for each person are sorted by time ascending
- every `time` and `endTime` is in source-video absolute time, not merely clip-relative time
- visible conflict-related interactions are not omitted merely because the exact force direction is uncertain
- ambiguous fight-related behavior uses conservative observable wording rather than legal or speculative wording
- suspicious contact, chasing, blocking, or pulling events that can support `risk.timeline.json` are retained when visibly supported
- every conflict-related `behavior.action` can be traced back to at least one reviewed event window
- every `behavior_support = "strong"` event window has downstream behavior unless explicitly justified
- every `behavior_support = "weak"` event window is either represented by conservative downstream behavior or explicitly omitted with a reason
- if only image evidence exists, behavior wording stays weak and static rather than asserting fight logic

## Business Logic Checks

- The same visible person is not duplicated under multiple ids without good evidence
- Roles are conservative and supported by visible actions
- Actions are attached to the correct acting subject
- Names do not embed unsupported legal conclusions
- The output does not contain invented facts
- the document is optimized to avoid missing visibly suspicious conflict behavior, even when some actions must be written conservatively
- if `attacker` and `victim` cannot be separated confidently, the behaviors remain and roles may stay at `witness`
- conservative recall is preferred over aggressive omission for fight-related visible interactions
- if clip analysis was used, the clip source offset was preserved and applied before final behavior times were written
- `attacker` and `victim` labels appear only when reviewed video evidence supports them
- every `participant_refs` value in `analysis/event_windows.json` is mapped to a stable person, mapped to an unknown or group placeholder, or explicitly excluded with a reason
- no discovered relevant participant disappears silently between event windows and person records
- `summary.md` does not mention an unstructured time span as reviewed, cleared, or conflict-free unless that span is traceable to `analysis/candidate_discovery.json` or `analysis/event_windows.json`

## Derived Output Checks

- `persons.personinfo.json` passes CLI `validate`
- `risk.timeline.json` is derived from the validated person info file, not hand-authored
- `persons.relation.json` is derived from the validated person info file, not hand-authored
- If both derived files are needed, prefer CLI `generate`
- If `--video-path` is available and relevant, pass it when generating timeline output
- every MCP-analysis clip has a matching `.clip.json` sidecar when the clip is not the original source video
- coverage validation passes after final edits to `analysis/candidate_discovery.json` and `analysis/event_windows.json`

## Summary Checks

- `summary.md` exists
- `summary.md` follows `assets/summary-template.md`
- `summary.md` only describes case-related video content
- `summary.md` is consistent with `analysis/candidate_discovery.json`, `analysis/event_windows.json`, `persons.personinfo.json`, `risk.timeline.json`, and `persons.relation.json`
- `summary.md` does not invent names, motives, or off-camera events

Do not return the result until all checklist items pass or the remaining uncertainty is handled by cautious wording. For visible suspicious interaction, prefer cautious wording over omission.
