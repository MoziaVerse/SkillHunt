# Candidate Discovery

Use this file after initial evidence extraction and before writing `analysis/event_windows.json`.

The goal is high recall without requiring full-video MCP review. Use low-cost signals to narrow long videos, then force closure for high-priority candidate spans.

## Required Artifact

Write `analysis/candidate_discovery.json`.

Recommended top-level shape:

```json
{
  "version": "v1",
  "source_video_path": "raw_data/video.mp4",
  "source_video_duration": 566.92,
  "discovery_methods": [
    {
      "method": "overview_frames_2s",
      "scope": "0-566.92",
      "notes": "sampled overview frames across the full video"
    }
  ],
  "candidate_spans": [
    {
      "id": "cand_001",
      "start": 150,
      "end": 240,
      "reason": "dense gathering, rapid approach, visible pushing risk, crowd movement around gate",
      "signals": ["gathering", "rapid_approach", "physical_contact_risk"],
      "priority": "high",
      "review_action": "analyze_video_clips",
      "closure": "pending",
      "event_window_ids": [],
      "closure_reason": null
    }
  ],
  "excluded_spans": [
    {
      "start": 240,
      "end": 566.92,
      "reason": "overview frames show discussion and dispersal, no visible pursuit, fall, blocking, or pushing cues in sampled checks",
      "confidence": "medium",
      "review_action": "sampled_frames_only"
    }
  ],
  "open_questions": [
    "whether the conflict fully ends before 240s"
  ]
}
```

## Low-Cost Signals

Use any available low-cost signal before MCP-heavy review:

- upstream YOLO interaction or proximity spans
- overview frames sampled across the full video
- dense frame review only inside suspicious spans
- motion changes or sudden crowd movement
- crowd density changes
- visible object or weapon-like cues
- gathering, confrontation, rapid approach, pursuit, blocking, falling, retreat, or separation
- manual spot checks when automated signals are absent

Do not use this artifact as a claim that every second was reviewed by MCP. It is a ledger explaining how candidate spans were found and why lower-priority spans were not escalated.

## Conflict Start Boundary

This is a high-recall guardrail for long videos where the first obvious frame may not be the true beginning.

When the earliest suspicious or high-priority span already shows an ongoing state, do not treat that timestamp as the conflict start by default.

Ongoing-state cues include:

- a person is already on the ground, kneeling, being held, or being surrounded
- two or more people are already in close contact, pulling, pressing, blocking, chasing, or restraining
- an object is already being pulled, seized, guarded, or contested
- the clip wording would naturally say "already", "仍", "已", "正在", or "continued"

Use the nearest earlier low-cost evidence first, then review only the smallest preceding clips needed to decide whether the lead-in contains approach, gathering, blocking, pulling, falling, object contest, or other conflict setup.

Expand backward only while earlier evidence continues to show suspicious setup cues. Stop once the preceding checks show ordinary movement or no conflict-relevant change.

Record the selected start boundary in `analysis/candidate_discovery.json`. If useful, use a lightweight field such as:

```json
{
  "start_boundary_review": {
    "trigger": "earliest reviewed clip already shows a person kneeling and an object being pulled",
    "selected_start": 32,
    "why_not_earlier": "preceding checks show ordinary movement and no clear approach, gathering, blocking, pulling, or contact",
    "evidence_used": ["overview_frames", "dense_frames", "short_lead_in_clip"],
    "gap_explanations": [
      {
        "start": 32,
        "end": 40,
        "closure": "downgraded",
        "reason": "dense frames show ordinary movement before the confrontation setup begins"
      }
    ]
  }
}
```

Do not mark the time range immediately before the selected start as `excluded` with `confidence: "high"` unless the boundary review explains why earlier activity is ordinary or not conflict-relevant.

If `start_boundary_review.selected_start` is earlier than the first `analysis/event_windows.json` window start, the gap between those two times must be explicitly represented as downgraded or excluded. Use `excluded_spans`, a downgraded/excluded `candidate_spans` entry, or `start_boundary_review.gap_explanations`. Otherwise the result must fail review.

## Candidate Span Fields

Every `candidate_spans` item must include:

- `id`: stable id such as `cand_001`
- `start`: source-video absolute seconds
- `end`: source-video absolute seconds
- `reason`: why this span is suspicious or relevant
- `signals`: array of low-cost evidence cues
- `priority`: `high`, `medium`, or `low`
- `review_action`: `analyze_video_clips`, `dense_frame_review`, `sampled_frames_only`, `downgraded`, or `excluded`
- `closure`: `pending`, `covered_by_event_windows`, `downgraded`, or `excluded`
- `event_window_ids`: event window ids that cover the span when closure is `covered_by_event_windows`
- `closure_reason`: required when closure is `downgraded` or `excluded`

## Closure Rules

- Every `high` candidate span must be closed before final output.
- `covered_by_event_windows` means the referenced reviewed event windows cover the full candidate interval.
- Partial overlap is not coverage. A high-priority candidate such as `60-85` is not closed by an event window covering only `80-95`.
- If only part of a candidate span remains relevant, split the candidate or document the irrelevant subspan as downgraded or excluded before marking the relevant part covered.
- `downgraded` means later evidence showed the span is less relevant; explain the evidence.
- `excluded` means the span was ruled out by low-cost review; explain the evidence and confidence.
- Do not leave `high` spans as `pending`.
- Do not mention in `summary.md` that a time range has no further conflict unless that time range is represented in `candidate_discovery.json` as covered, downgraded, or excluded.

Before final output, run:

```bash
scripts/validate-analysis-coverage --case-dir .
```

If it reports uncovered high-priority candidate gaps, repair `candidate_discovery.json` and `analysis/event_windows.json` before continuing.

## High-Recall Bias

When unsure whether a span is relevant:

- prefer adding it as `medium` or `high` rather than omitting it
- prefer `dense_frame_review` before dismissing it
- prefer conservative closure reasons over silence
- preserve cues such as `多人围拢`, `快速靠近`, `短暂接触`, `疑似推搡`, `追赶`, `阻拦`, `倒地`, or `持物`

The purpose is not to prove the span contains a fight; the purpose is to prevent discovered suspicious spans from disappearing later in the workflow.
