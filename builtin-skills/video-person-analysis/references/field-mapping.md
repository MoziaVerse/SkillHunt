# Field Mapping

Use this file when converting video observations into `persons.personinfo` JSON fields.

## Top Level

- `version`: use a simple non-empty string such as `v1`
- `persons`: array of person records, must not be empty

## Source Priority

Use evidence in this order:

1. reviewed event windows from `analysis/event_windows.json`
2. deterministic clip timing from `ffmpeg` sidecars
3. image-based appearance checks for identity-facing fields

Conflict-related `behaviors` and non-witness roles must come from reviewed event windows, not from image-only evidence.

Use `analysis/candidate_discovery.json` to verify high-priority candidate spans are closed before trusting that event windows are complete.

## Person Fields

### `id`

- Must match `^p_[A-Za-z0-9_]+$`
- Must stay stable across the whole video
- Prefer readable ids such as `p_black_jacket_1`, `p_white_shirt_1`, `p_bystander_1`

Unknown or group placeholders are allowed when they prevent losing a visible relevant participant:

- `p_unknown_scooter_1`
- `p_unknown_dark_jacket_1`
- `p_group_bystanders_1`

Use placeholders only when the participant appears in `participant_refs` or is otherwise visibly relevant to a suspicious event window.

### `name`

If the real name is unknown, use a stable placeholder.

Good examples:

- `黑衣男子`
- `白衣女子`
- `人物1`
- `蓝衣围观者`

Bad examples:

- `嫌疑人`
- `受害人`
- `张三`

Do not embed legal conclusions in `name`.

### `role`

Allowed values only:

- `attacker`
- `victim`
- `witness`

Assign last, based on visible conduct in reviewed video clips, not assumptions.

High-recall rule for conflict detection:

- when visible conduct suggests possible conflict but the exact role is not fully certain, keep the relevant behavior and use the least committal supported role
- prefer `witness` over dropping a person record when the person is clearly involved in a suspicious interaction but attacker/victim cannot yet be separated
- do not force `attacker` or `victim` unless a reviewed clip clearly supports that direction
- unknown or group placeholder persons should normally remain `witness` unless reviewed video strongly supports another role

### `gender`

- Optional
- Use only when visually supported
- Allowed values: `male`, `female`
- Omit if uncertain

### `appearance`

Write a short visible-trait summary.

Prefer:

- clothing color
- upper and lower garment type
- hair style
- hat or helmet
- backpack, handbag, shoulder bag
- body build
- other stable visible markers

Example:

`黑色短袖上衣，深色长裤，短发，背黑色斜挎包`

Avoid:

- personality traits
- legal labels
- injuries not clearly visible

### `avatar`

- Must be a project-relative path
- Use one clear representative frame per person
- Prefer the most recognizable frame, not necessarily frontal if the side view is more stable

Example:

`outputs/avatars/p_black_jacket_1.jpg`

## Behavior Fields

### `time`

- Required
- Number in seconds from the start of the video
- Must use source-video absolute time, not clip-relative time

### `endTime`

- Optional
- Use for actions that span a time range
- Must be greater than or equal to `time`
- If derived from a clip, convert it back to source-video absolute time before writing

### `action`

Describe only visible behavior in natural Chinese.

`action` is for human-readable description.
Use person `name` values in the sentence, not person ids.
Do not write `p_xxx` style ids, tracking labels, or detector labels inside `action`.
Machine-readable linking belongs in `personIds`, not in `action`.

Strong conflict verbs require reviewed video support:

- `推搡`
- `挥拳`
- `踢踹`
- `拉扯`
- `围堵`
- `追赶`
- `劝阻`
- `跌倒`

Conservative verbs for ambiguous reviewed windows:

- `快速靠近`
- `持续贴近`
- `发生肢体接触`
- `疑似推搡`
- `相互拉扯`
- `追逐至画面边缘`
- `围堵并阻拦去向`
- `接触后后退`

Weak static wording for image-only evidence:

- `出现在画面中`
- `位于冲突附近`
- `与他人近距离站立`
- `站在一旁观察`

Good examples:

- `靠近白衣男子并发生推搡`
- `追赶黑裤男子至画面右侧`
- `站在一旁观察并尝试劝阻`

Avoid:

- `靠近 p_white_shirt_1 并发生推搡`
- `追赶 p_black_pants_1 至画面右侧`
- `推搡 p_grey_shirt_attacker`
- `实施故意伤害`
- `明显挑衅`
- `主观上具有攻击意图`

Hard rule for `action`:

- if the wording implies conflict sequence, contact, pursuit, blocking, intervention, or fall causality, it must be traceable to `analysis/event_windows.json`
- if only image evidence exists, do not write fight logic from that frame alone

High-recall rule for `action`:

- if the reviewed video suggests a possible fight-related interaction, prefer writing a conservative observable action instead of omitting it
- event windows with `behavior_support = "weak"` can still produce behavior records when the interaction is visible and useful for risk review
- when force direction is unclear, use neutral wording such as `发生肢体接触`, `相互拉扯`, `持续贴近并移动`
- when one side is likely acting but not fully certain, use guarded wording such as `疑似推搡`, not legal or mental-state language
- weak behavior wording examples include `靠近冲突区域`, `发生短暂接触`, `被多人围拢`, `疑似推搡`, `位于冲突中心附近`, and `与他人持续贴近移动`
- omission is still correct for pure guesswork, but not for visible suspicious interaction

### `personIds`

- List only other involved persons
- Every id must already exist in `persons`
- Avoid self-reference unless the downstream system explicitly needs it

High-recall rule for `personIds`:

- if a suspicious interaction is visible, include all clearly involved counterpart persons in `personIds`
- do not leave `personIds` empty for visible conflict-related behavior just because the exact aggressor is uncertain
- if the counterpart cannot be identified reliably, create an unknown or group placeholder person and link to that placeholder

## Record Ownership

Each behavior belongs to the acting subject person.

Example:

If `p_black_jacket_1` named `黑衣男子` pushes `p_white_shirt_1` named `白衣男子`, store this behavior under `p_black_jacket_1`, with:

- `action`: `推搡白衣男子`
- `personIds`: [`p_white_shirt_1`]

Do not place the same action under the wrong subject.

High-recall ownership fallback:

- if the acting subject is truly unclear in a mutual struggle, prefer recording separate conservative behaviors under each clearly involved person rather than dropping the interaction entirely
- in that case, keep wording neutral, for example `与白衣男子发生拉扯` and `与黑衣男子发生拉扯`

## Participant Ref Closure

Before finalizing `persons.personinfo.json`, collect every `participant_refs` value from `analysis/event_windows.json`.

Each participant ref must be handled in one of these ways:

- mapped to a stable person record
- represented by an unknown or group placeholder record
- explicitly excluded with a written reason in the event window or a mapping note

Do not allow a participant ref to disappear silently between `event_windows.json` and `persons.personinfo.json`.
