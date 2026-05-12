# Summary Writing

Use this file when writing `summary.md`.

The summary is a case-focused narrative for investigators. It must be consistent with the generated JSON files and only describe case-relevant video content.

## Required Goal

Write a concise Markdown summary that explains:

- what happened in the video
- who the key persons are
- how the interaction developed over time
- what case-related facts are observable from the footage
- what uncertainties remain for later investigation

## Content Boundaries

Only include content relevant to the case.

Include:

- confrontation, contact, pursuit, blocking, retreat, falling, or intervention
- who appears to initiate or receive actions
- notable scene context that affects interpretation of the incident
- major ambiguities caused by blur, occlusion, camera shake, or off-frame movement

Do not include:

- unrelated environment description
- aesthetic details unrelated to the case
- unsupported legal characterization
- motive, intent, or background relationship unless directly visible
- events that happen off camera
- subjective rhetorical wording

High-recall summary rule:

- if the video contains visible suspicious conflict-related interaction, keep it in the summary even when the exact aggressor direction is uncertain
- prefer cautious observable wording over omission when the interaction can support fight-risk review
- if `attacker` and `victim` cannot be separated confidently, summarize the interaction neutrally and keep uncertainty explicit

## Writing Rules

- Write in Chinese.
- Use short factual paragraphs or short bullet lists.
- Keep wording observational and neutral.
- If something is uncertain, say it is unclear.
- Keep names aligned with `persons.personinfo.json`.
- Keep actions aligned with `behaviors` and derived timeline segments.
- Prioritize investigation value over narrative completeness.
- Prefer time-order description.
- Use terms such as `可见`, `显示`, `画面中`, `无法确认`, `未见明显` to keep the wording evidentiary.
- When recall matters more than precision, prefer wording such as `发生肢体接触`, `相互拉扯`, `持续贴近并移动`, `疑似推搡`, `存在追逐或阻拦迹象`.
- Do not upgrade uncertain interaction into legal or strongly directional language.
- Keep summary recall aligned with `risk.timeline.json`: if a suspicious linked behavior is retained in JSON, it should not disappear from the summary.

## Required Sections

Follow `assets/summary-template.md` exactly.

Every generated `summary.md` must contain:

- 视频基本情况
- 案件相关人员
- 案件经过摘要
- 案件相关关键行为梳理
- 研判要点
- 不确定点与视频局限

## Quality Bar

Before returning `summary.md`, verify:

- it does not contradict any generated JSON
- it focuses on the case rather than the whole scene
- it does not add facts absent from the video
- it is readable by an investigator without needing the raw JSON first
- it highlights investigative value, not literary summary
- it does not omit visible suspicious conflict behavior that was retained in `persons.personinfo.json` or `risk.timeline.json`
- when uncertainty exists, it uses cautious wording instead of deleting the event from the narrative
