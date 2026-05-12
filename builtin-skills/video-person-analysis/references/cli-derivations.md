# CLI Derivations

Use this file after `persons.personinfo.json` has been written.

The EvidentAI CLI is responsible for validating and deriving downstream files from the person info document.

Bundled path in this skill:

- `scripts/evidentai`

## CLI Responsibilities

### `validate`

Use to validate `persons.personinfo.json` before deriving any downstream files.

Checks include:

- input is valid JSON
- `version` exists
- `persons` is non-empty
- person ids exist, match `p_xxx`, and are unique
- `name` is not empty or a placeholder name rejected by the CLI
- `role` is one of `attacker`, `victim`, `witness`
- `time <= endTime`
- every `behavior.personIds` reference exists

### `timeline`

Generates `risk.timeline.json` from `persons.personinfo.json`.

Behavior:

- iterates through each person's `behaviors`
- creates a segment when a behavior has `personIds`
- outputs fields including `startTime`, `endTime`, `description`, and `personIds`
- writes `risk.timeline.json`

Recall implication:

- `risk.timeline.json` can only retain suspicious interaction if the source `behaviors` and `personIds` were preserved in `persons.personinfo.json`
- when fight detection should avoid misses, bias `persons.personinfo.json` toward keeping visible suspicious interaction with conservative wording

### `relation`

Generates `persons.relation.json` from `persons.personinfo.json`.

Behavior:

- creates relation edges from behavior `personIds`
- uses behavior `action` as edge `label`
- preserves existing manual edges if a relation file already exists
- fills default layout coordinates for new persons

### `generate`

Runs:

1. `timeline`
2. `relation`

Use this as the default derivation command when both downstream files are needed.

## Recommended Command Pattern

Prefer this sequence:

1. write `persons.personinfo.json`
2. run `scripts/evidentai validate -i persons.personinfo.json`
3. run `scripts/evidentai generate -i persons.personinfo.json -f`

If a video path should be recorded in timeline output, use:

- `scripts/evidentai generate -i persons.personinfo.json -v raw_data/video.mp4 -f`

If only one derived file is needed, run `timeline` or `relation` directly.

## Expected File Flow

`persons.personinfo.json` -> `validate` -> `generate` -> `risk.timeline.json` + `persons.relation.json`

## Parameters

Supported CLI flags:

- `-i`, `--input`: required input file
- `-o`, `--output`: output file
- `-v`, `--video-path`: video path written into timeline output
- `-f`, `--force`: overwrite output file without prompting

## Agent Rules

- Do not hand-author `risk.timeline.json` or `persons.relation.json` when the CLI is available.
- Use the CLI-derived outputs as the final source of truth for timeline and relation data.
- If validation fails, fix `persons.personinfo.json` first instead of bypassing the validator.
- If `relation` merges with an existing manual file, do not assume the generated output is purely machine-created.
