# Safety Checklist

Use this checklist as the Reviewer layer for MoziaDL remote server work.

Load `secure-ssh.md` before applying this checklist to any SSH task.

## Pre-Flight

Before any mutating SSH command, confirm:

- `moziadl whoami --json` succeeded or login was completed.
- The target rental was resolved from an explicit `rental-id`, or the user selected one from active rentals.
- SSH details came from a fresh `moziadl rental ssh --rental-id <rental-id> --json` call.
- The raw SSH JSON was not written to files, logs, final answers, shell scripts, or issue comments.
- A read-only probe succeeded.
- The remote workspace path is known.
- The remote log path is known.
- The command plan will not embed passwords or tokens.

## Credential Rules

Never include these values in final answers, committed files, remote scripts, logs, screenshots, or comments:

- SSH passwords
- MoziaDL access tokens
- MoziaDL refresh tokens
- `~/.moziadl/config.json`
- Raw `moziadl rental ssh --json` output

For password-based SSH automation:

- Prefer the agent environment's secure interactive or PTY handling.
- If `sshpass` or expect-style automation is necessary, pass secrets through the safest available runtime channel.
- Do not write passwords into shell history, reusable scripts, process logs, or project files.

## Remote Mutation Guardrails

Before running a mutating command, ensure the command is scoped to the task workspace whenever possible:

```text
~/moziadl-work/<task-name>
```

Be especially careful with:

- recursive delete commands
- package manager changes at system scope
- firewall, SSH, or user account changes
- commands that expose environment variables
- commands that can overwrite model checkpoints or datasets
- commands that run for a long time without logging

## Post-Flight

Before reporting completion, check:

- The `tmux` session state if a long-running task was started.
- The latest meaningful log lines.
- The expected output, checkpoint, or artifact path.
- Whether any command failed or was skipped.
- Whether credentials were redacted from all user-facing output.

## Report Format

Report only operational facts:

- Target rental/server label
- Work performed
- Current status
- Remote workspace path
- Log path
- Output or checkpoint path, if created
- Next useful command without embedded secrets

Do not paste full logs unless the user asks for them.
