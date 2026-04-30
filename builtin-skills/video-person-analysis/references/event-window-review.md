# Event Window Review

Use this file after evidence extraction and before final identity binding.

The purpose of this step is to force the workflow into a video-first mode:

- first decide what happened
- then decide who each participant is
- then write behaviors
- finally assign roles

## Required Artifact

Write `analysis/event_windows.json` before `persons.personinfo.json`.

Recommended top-level shape:

```json
{
  "version": "v1",
  "windows": [
    {
      "id": "ew_001",
      "clip_path": "analysis/event_001.mp4",
      "source_start_time": 96.4,
      "source_end_time": 104.4,
      "question": "这个片段中是否出现接触、追逐或阻拦，先后顺序如何",
      "video_observation": "画面开始后黑衣人与白衣人持续靠近，约2秒后发生肢体接触，随后两人贴近并向右移动。",
      "uncertainty": "无法仅凭该片段确认是谁先出手，也无法确认接触力度。",
      "participants": [
        "person_a",
        "person_b"
      ],
      "behavior_support": "weak",
      "risk_relevance": "medium"
    }
  ]
}
```

Field intent:

- `clip_path`: reviewed clip file used for `analyze_video`
- `source_start_time`: clip start in source-video absolute seconds
- `source_end_time`: clip end in source-video absolute seconds
- `question`: the narrow question asked of the video clip
- `video_observation`: time-order observational summary derived from video
- `uncertainty`: what remains unclear after reviewing the clip
- `participants`: temporary participant handles before final identity binding
- `behavior_support`: `strong`, `weak`, or `none`
- `risk_relevance`: `high`, `medium`, or `low`

Compatibility note:

- older outputs may contain `supports_behavior`; new outputs should use `behavior_support`
- if both are present, `behavior_support` is the source of truth

## Discovery Rules

Find candidate windows from the strongest available signals:

1. upstream YOLO interaction spans when they exist
2. dense frame review around approach, contact, chase, fall, retreat, and separation
3. manual video inspection when neither of the first two is enough

Use `analysis/candidate_discovery.json` as the candidate source of truth:

- every high-priority candidate span must be covered by event windows, downgraded, or excluded
- do not silently shorten a high-priority candidate span; if only part is reviewed, explain the unreviewed tail in `candidate_discovery.json`
- high-priority `covered_by_event_windows` requires interval coverage by the referenced windows, not just overlap
- if a candidate is `60-85`, event windows that only cover `80-95` leave `60-80` open and must fail review unless `60-80` is separately downgraded or excluded
- if a span is described later in `summary.md`, it must be traceable to this discovery ledger or to event windows

When a candidate window is found:

- expand the clip to include lead-in and aftermath
- prefer 6 to 8 seconds
- if the event exceeds 8 seconds, split it into overlapping windows rather than compressing the whole sequence into one prompt

Conflict start boundary:

- inspect the first reviewed conflict window for already-ongoing cues
- already-ongoing cues include "person already on the ground", "already kneeling", "already pulling or pressing", "already surrounded", "continued conflict", or a contested object already in someone's hands
- if the first reviewed window starts with these cues, do not treat that window as the event start
- return to `analysis/candidate_discovery.json`, confirm the conflict start boundary, and review only the smallest preceding clips needed to decide where ordinary activity turns into conflict setup
- do not let an excluded span immediately before the first conflict window rely only on overview frames when the first conflict window is already ongoing
- if the selected start boundary is earlier than the first event window, the gap must be explicitly downgraded or excluded in `candidate_discovery.json`

## Time Anchor Rules

- one event window may only claim the source-time interval actually reviewed in its clip
- `source_start_time` and `source_end_time` must match the clip `.clip.json` sidecar when present
- if the clip filename encodes times such as `clip_080_088.mp4`, those times must also match `source_start_time` and `source_end_time`
- if a wider event needs multiple clips, split it into multiple event windows or use reviewed windows whose clips actually cover the full interval
- an event window with mismatched clip filename or sidecar time cannot close a candidate span

## Video-First Rules

- use `analyze_video` for action order, contact, pursuit, blocking, intervention, falling, and role tendency
- use `analyze_image` only to stabilize appearance or compare likely same-person frames
- do not decide whether a person attacked, blocked, chased, or intervened from a still frame alone
- if the clip is inconclusive, preserve uncertainty and keep the wording weak

## Prompting Rules

- ask one primary question per clip
- keep the question tied to visible sequence, not identity, motive, or law
- if the first answer is too broad, re-run a narrower clip instead of asking for more detail in the same prompt
- prefer fixed-format answers so later behavior writing can compare results across windows

Recommended questioning sequence for one event window:

1. ask a baseline sequence question
2. if needed, ask exactly one clarification question:
   - whether contact occurs
   - who approaches first
   - whether movement is pursuit or blocking
   - whether a specific person is intervening or joining
   - whether the fall happens before or after contact
3. ask a role-tendency question only after the baseline and clarification answers are stable

Recommended answer shape inside `video_observation` drafting:

- first sentence: one-line event summary
- second sentence: the clearest time-order evidence
- third sentence: explicit uncertainty or visual limitation

Good questions:

- `这个片段里谁先靠近谁，之后是否出现接触？`
- `人物A在该片段中更像是在追赶、阻拦，还是只是近距离移动？`
- `跌倒发生在接触之前还是之后？`
- `蓝衣人更像是在劝阻分开，还是参与冲突？`

Avoid:

- `把这个片段里所有人的身份、动作、角色和关系一次性全部说明`
- `给出整段视频的完整时间轴`
- `仅根据这一帧判断谁在打谁`
- `只问“谁是攻击者”，但前面还没有确认接触和先后顺序`

## Downstream Rules

- `persons.personinfo.json` may summarize conflict-related behaviors that are supported by one or more event windows with `behavior_support = "strong"` or `behavior_support = "weak"`
- `strong` normally means the window should produce downstream behavior
- `weak` means the window may produce downstream behavior using conservative wording when the interaction is visibly suspicious or useful for risk review
- `none` normally means do not produce downstream conflict behavior
- if a downstream behavior cannot be traced back to an event window, remove or weaken it
- every `participant_refs` value in event windows must be mapped to a person id, mapped to an unknown or group placeholder, or explicitly excluded with a reason before final output
- `attacker` and `victim` are assigned after event windows have been mapped to stable person ids
