# video-mcp-local

Use this file before calling the local vision MCP configured as `video-mcp-local`.

This MCP currently exposes exactly two tools:

- `analyze_image`
- `analyze_video`

Both tools return text, not structured JSON. Treat the result as evidence to interpret, not as final schema output.

## Tool Interfaces

### `analyze_image`

Parameters:

- `image_source`: local image path or remote URL
- `prompt`: analysis request

Best for:

- appearance refinement on representative frames
- clothing, accessories, and visible-trait summaries
- comparing candidate avatar frames
- checking whether two representative frames likely show the same person

Local constraints:

- supported local formats: `jpg`, `jpeg`, `png`
- local file size limit: 5MB

Hard boundary:

- do not use `analyze_image` to determine contact, pursuit, blocking, intervention, retreat, falling, or role
- if a still frame suggests conflict, treat it only as a cue to extract a review clip for `analyze_video`

### `analyze_video`

Parameters:

- `video_source`: local video path or remote URL
- `prompt`: analysis request

Best for:

- short-clip interaction understanding
- continuity across time
- approach, pursuit, blocking, contact, retreat, and separation
- conservative role tendency from visible sequences
- event segmentation for conflict windows

Local constraints:

- recommended local formats: `mp4`, `mov`, `m4v`
- local file size limit: 8MB

Operational guidance to reduce timeout risk:

- prefer 6 to 8 second clips for first-pass event-window review
- use 4 second clips when only one narrow clarification question remains
- if the event boundary cannot be understood in 8 seconds, split it into overlapping windows
- prefer one question dimension per call
- avoid asking for full person roster, full timeline, role judgment, bystander analysis, and outcome summary in one request
- dense multi-person clips and long enumerated prompts are more likely to time out
- follow the per-window stop rule: at most 1 baseline + 1 clarification + 1 role check

## Standard Usage Rules

- Use `analyze_image` for identity and appearance questions only.
- Use `analyze_video` for timing, sequence, interaction, behavior, and role-tendency questions.
- Prefer short clips over full videos.
- Prefer cropped or sampled evidence over large raw inputs.
- If a clip exceeds the size limit, shorten duration first, then reduce resolution if needed.
- If a frame is blurred, choose another frame from the same track instead of guessing.
- If MCP output is uncertain, preserve that uncertainty in the final record.
- Treat any time mentioned by `analyze_video` as clip-relative unless you explicitly provide and apply a source-video offset.
- Start with the shortest clip that still preserves lead-in and aftermath for the event being judged.
- Split complex analysis into multiple calls rather than one comprehensive call.

## Anti-Timeout Rules

- default first-pass event-window clip length: 6 to 8 seconds
- default clarification clip length: 4 seconds
- if the clip is longer than 8 seconds, split it into overlapping windows before calling `analyze_video`
- ask at most one primary task per call
- allow at most two tightly related subquestions per call only when they belong to the same stage
- do not ask for a full second-by-second timeline in one call
- do not ask for exact source-video timestamps in one call
- do not ask for identity, action order, role judgment, and bystander behavior all at once
- do not exceed the same-window policy of 1 baseline + 1 clarification + 1 role check

## Prompt Design Rules

Design `analyze_video` prompts as narrow decision tasks, not open-ended scene summaries.

Rules:

- ask one primary question per call
- define the clip time range in the prompt, but require the answer to stay clip-relative
- ask about visible sequence only, not motive, identity, or legal meaning
- when possible, point to temporary labels such as `人物A`, `人物B`, `蓝衣人`, `黑衣人`
- require uncertainty to be stated explicitly instead of guessed away
- prefer a fixed answer structure so later steps can read the result consistently
- record which stage the answer belongs to so `source_basis` can be populated as `baseline`, `clarification`, or `role_check`

Recommended answer format for most `analyze_video` calls:

```text
结论：
- [一句话回答当前问题]

依据：
- [按片段相对时间描述1到3个关键可见动作]

不确定点：
- [看不清、遮挡、镜头抖动、画面外等限制]
```

If timing matters, extend the `依据` lines with clip-relative wording such as `约在片段开始后1至2秒`.

### Preferred Question Types

Good single-purpose calls:

- who approaches first in this clip
- does visible physical contact occur in this clip
- does the blue-shirt person appear to intervene or attack
- what happens after the person falls
- does this clip show pursuit, blocking, or only close movement

High-risk timeout calls to avoid:

- list all participants, all clothing details, all actions, all role judgments, all bystander reactions, and how the conflict ends
- produce a complete timeline for the whole clip with per-second detail
- identify every person and explain all relationships in one response

## Recommended Workflow

1. Use `ffmpeg` to extract representative frames and short clips.
2. If YOLO track JSON exists, use the bundled `scripts/yolo-cli` to narrow candidate people, spans, and interactions.
3. Use `analyze_video` on 6 to 8 second clips to determine what happened in each candidate event window.
4. Write `analysis/event_windows.json`.
5. Use `analyze_image` on representative frames to stabilize appearance and avatar selection.
6. Convert only well-supported findings into `persons.personinfo.json`.

Recommended `analyze_video` call order:

1. ask a sequence-baseline question on a 6 to 8 second clip
2. ask one narrower follow-up question for contact, pursuit, blocking, fall order, or intervention if needed
3. ask one role-tendency question only after the action order is mostly clear
4. if needed, ask about the next adjacent clip window rather than expanding the current prompt

Per-window stop rule:

1. baseline question: maximum 1
2. clarification question: maximum 1
3. role-tendency question: maximum 1
4. if uncertainty still remains, stop and preserve uncertainty instead of continuing to ask variants

Timeout fallback strategy:

1. shorten clip duration
2. split into overlapping windows
3. simplify the question to one task
4. remove long numbered lists from the prompt
5. downgrade from full sequence analysis to a narrower event question

## Prompt Templates

The templates below are ordered from safest to most inferential. Use the earliest template that can answer the current question.

### Single-Frame Appearance

Use with `analyze_image` when filling `appearance` or choosing a placeholder name:

```text
This frame comes from a fight-incident video analysis workflow. Describe only the clearly visible traits of the main person in the frame for identity tracking. Focus on clothing color and type, hair, bag, hat, body build, and other stable markers. Do not guess age, real name, occupation, injuries, motive, role in the conflict, or legal conclusions. If any detail is unclear, say it is unclear.
```

### Composite Same-Person Check

Use with `analyze_image` after first composing a side-by-side comparison image with `ffmpeg`:

```text
This image is a side-by-side comparison built from representative frames in the same incident video. Compare the main person on the left and the main person on the right and judge conservatively whether they are more likely the same person, more likely different people, or uncertain. Base the answer only on visible clothing, accessories, hair, body build, and stable markers. Do not rely on speculation. End with one of: same person likely / different person likely / uncertain.
```

### Sequence Baseline

Use with `analyze_video` first on a 6 to 8 second clip:

```text
This short clip comes from a fight-incident video. The clip covers source-video time range [SOURCE_START, SOURCE_END]. Refer to moments only relative to the clip start. This is a baseline question. Answer using exactly this format:

结论：
- 用一句话概括这段片段里发生了什么，只写可见动作顺序。

依据：
- 按时间顺序列出最多3条关键可见动作，可使用“约在片段开始后X秒”这类相对时间表达。

不确定点：
- 列出看不清、遮挡、画面外、镜头抖动等限制。

Focus only on approach order, contact, separation, retreat, falling, or intervention. Do not infer identity, motive, or legal conclusions.
```

### Sequence Baseline With Temporary Labels

Use when multiple people are present and you want to anchor labels before narrower follow-up questions:

```text
This short clip comes from a fight-incident video. For this call only, refer to the most relevant visible people as 人物A, 人物B, 人物C based on their position at the clip start. The clip covers source-video time range [SOURCE_START, SOURCE_END]. This is a baseline question. Answer using exactly this format:

结论：
- 用一句话概括人物A、人物B、人物C之间的可见互动顺序。

依据：
- 按时间顺序列出最多3条关键动作依据。

不确定点：
- 列出人物标记可能变化、遮挡或离开画面的限制。

Do not infer real identity or legal role.
```

### Contact Confirmation

Use when you only need to know whether contact occurred:

```text
This short clip comes from a fight-incident video. The clip covers source-video time range [SOURCE_START, SOURCE_END]. This is a clarification question. Answer only whether visible physical contact occurs. Use exactly this format:

结论：
- 是否出现可见肢体接触；若有，说明涉及哪些临时标记人物。

依据：
- 列出1到2条可见动作依据，使用片段相对时间。

不确定点：
- 若看不清接触细节或力度，明确写出。

Do not infer who is legally responsible. Do not expand into a full scene summary.
```

### Initiation Or Direction Check

Use after contact is already confirmed but directionality remains unclear:

```text
This short clip comes from a fight-incident video. Focus only on who appears to approach first or initiate visible aggressive movement. The clip covers source-video time range [SOURCE_START, SOURCE_END]. This is a clarification question. Use exactly this format:

结论：
- 谁更像是先靠近、先做出攻击性移动，或结论不清楚。

依据：
- 列出最多3条按时间顺序的可见动作依据。

不确定点：
- 若镜头遮挡、动作重叠或无法分辨先后，请明确写出。

Do not infer identity, motive, or legal conclusions. If the clip is insufficient, say the initiation direction is unclear.
```

### Pursuit Vs Close Movement Check

Use when you need to distinguish `追赶` from `近距离同向移动`:

```text
This short clip comes from a fight-incident video. Focus only on whether the movement pattern in this clip is better described as pursuit, blocking, or merely close movement. The clip covers source-video time range [SOURCE_START, SOURCE_END]. This is a clarification question. Use exactly this format:

结论：
- 更接近追赶 / 阻拦 / 仅近距离移动 / 无法确认。

依据：
- 列出最多3条按时间顺序的动作依据。

不确定点：
- 写出为什么无法更强判断。

Do not infer identity or legal role.
```

### Intervention Vs Participation Check

Use for a known bystander-colored or positionally known person:

```text
This short clip comes from a fight-incident video. Focus only on [TARGET_PERSON_LABEL]. Judge conservatively whether this person appears to intervene, separate others, block movement, join the conflict, or only observe. The clip covers source-video time range [SOURCE_START, SOURCE_END]. This is a clarification question. Use exactly this format:

结论：
- 更接近劝阻分开 / 阻拦 / 参与冲突 / 仅观察 / 无法确认。

依据：
- 列出最多3条与该人物直接相关的可见动作依据。

不确定点：
- 写出看不清、遮挡或动作目的无法确认的原因。

Do not infer motive or legal conclusions.
```

### Fall Order Check

Use when the clip includes a fall and you need order rather than blame:

```text
This short clip comes from a fight-incident video. Focus only on the order between visible contact and the fall. The clip covers source-video time range [SOURCE_START, SOURCE_END]. This is a clarification question. Use exactly this format:

结论：
- 跌倒发生在接触之前 / 之后 / 无明显接触也跌倒 / 无法确认。

依据：
- 列出最多3条按时间顺序的动作依据。

不确定点：
- 若看不清脚下、遮挡严重或跌倒原因无法判断，请明确写出。

Do not infer intent or causation beyond what is directly visible.
```

### Role Tendency Final Check

Use only after sequence, contact, and directionality are already mostly understood:

```text
This short clip comes from a fight-incident video analysis workflow. Based only on visible actions in this clip, assess conservatively whether [PERSON_A_LABEL] appears more like the aggressor, [PERSON_B_LABEL] appears more like the recipient, whether either person is only observing, or whether role direction remains unclear. The clip covers source-video time range [SOURCE_START, SOURCE_END]. This is a role check. Use exactly this format:

结论：
- 角色倾向判断，或明确写“角色方向不清楚”。

依据：
- 列出最多3条可见动作依据，使用片段相对时间。

不确定点：
- 写出为什么不能把结论说得更强。

Do not make legal conclusions. If the clip is insufficient, keep the answer conservative.
```

### Minimal Event Question

Use with `analyze_video` for first-pass probing when timeout risk is high:

```text
This short clip comes from a fight-incident video. Answer only this question: does visible physical contact occur in this clip, and if so, who appears involved? This is a baseline question. Use exactly this format:

结论：
- 是 / 否 / 无法确认，并说明涉及哪些临时标记人物。

依据：
- 最多2条可见动作依据。

不确定点：
- 若看不清，明确写出原因。
```

## Prompt Selection Ladder

Choose prompts in this order:

1. `Sequence Baseline` or `Sequence Baseline With Temporary Labels`
2. one narrow clarification template:
   - `Contact Confirmation`
   - `Initiation Or Direction Check`
   - `Pursuit Vs Close Movement Check`
   - `Intervention Vs Participation Check`
   - `Fall Order Check`
3. `Role Tendency Final Check` only if the previous answers already support a stable event description

Do not skip directly to a role question when sequence and contact are still unclear.
Do not ask more than one clarification template for the same window unless you explicitly abandon the earlier clarification result and keep only one clarification output.

## Prohibited Uses

- Do not ask the MCP to guess real names.
- Do not ask the MCP to infer off-camera events.
- Do not ask the MCP to infer motive or intent unless it is directly visible, which is rare.
- Do not ask the MCP for legal conclusions.
- Do not ask `analyze_image` to decide fight logic from a still frame.
- Do not ask `analyze_video` to identify all people, explain all actions, and assign final roles in one prompt.
- Do not ask for a complete event timeline if a narrow decision question would answer the current need.
- Do not continue asking same-window prompt variants after the stop rule has been reached.
- Do not copy MCP wording directly into final JSON if it contains speculation.

## Final Interpretation Rules

- use `analyze_image` output to support `appearance`, placeholder naming, avatar choice, and same-person checks
- use `analyze_video` output to support `analysis/event_windows.json`, behavior wording, interaction spans, and conservative role review
- do not let either MCP tool assign final ids or final roles on its own
- if MCP wording and deterministic timing disagree, keep `ffmpeg` timing and rewrite the behavior text conservatively
- do not copy clip-relative timestamps from MCP directly into `persons.personinfo.json`; convert them with the clip source offset first
- if a complex `analyze_video` call times out, do not retry the same large prompt first; shorten the clip or narrow the question before retrying
