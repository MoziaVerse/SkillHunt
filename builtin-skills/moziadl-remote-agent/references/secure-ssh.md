# Secure SSH Rules

Use these rules whenever an agent connects to a MoziaDL rented server over SSH.

## Connection Source

Only use SSH details returned by:

```bash
moziadl rental ssh --rental-id <rental-id> --json
```

Do not reuse SSH details copied from chat history, old logs, screenshots, shell history, or cached files. Refresh SSH details before each new task.

## Host Verification

Before running mutating commands, perform a read-only probe:

```bash
ssh <username>@<host> -p <port> 'bash -lc "hostname && whoami && uname -a"'
```

If SSH reports a changed host key or a host identification warning, stop and ask the user to verify the server. Do not bypass host key warnings automatically.

For first-time connections, accept a new host key only when the host and port came from a fresh MoziaDL CLI response.

## Credential Handling

Treat SSH credentials as secrets.

Never put passwords or tokens in:

- final answers
- project files
- reusable scripts
- remote scripts
- logs
- screenshots
- command examples returned to the user
- shell history

Prefer interactive SSH or the agent runtime's secure secret handling. If password automation is unavoidable, pass the password through the safest available runtime channel and keep it out of script files and persisted logs.

## Command Safety

Prefer this shape for remote commands:

```bash
ssh <username>@<host> -p <port> 'bash -lc "set -euo pipefail; <command>"'
```

Use `set -euo pipefail` for scripts where early failure should stop the task.

Scope mutating work to:

```text
~/moziadl-work/<task-name>
```

Do not run broad commands from `/`, `$HOME`, or unknown directories.

## Prohibited Defaults

Do not run these unless the user explicitly asked for them and the target path or service is unambiguous:

- `rm -rf` outside the task workspace
- disk formatting or partition changes
- firewall, SSH daemon, or user account changes
- system reboot or shutdown
- package removal at system scope
- commands that expose environment variables or secrets
- recursive ownership or permission changes outside the task workspace
- overwriting datasets, model checkpoints, or production artifacts

## File Transfer

Use `scp` or `rsync` with explicit paths.

Upload only files needed for the task. Download only expected artifacts or logs. Do not copy full home directories, credential directories, browser profiles, SSH key folders, or unrelated datasets.

Avoid transferring:

- `~/.ssh`
- `~/.moziadl`
- `.env` files unless the user explicitly requests and approves it
- API keys, tokens, private keys, or credential stores

## Long-Running Work

Run long tasks in `tmux` and write logs to the task workspace:

```text
~/moziadl-work/<task-name>/logs/run.log
```

Before reporting that a task is running or complete, check:

- the `tmux` session state
- the latest log lines
- expected output or checkpoint paths
- disk space if outputs are large

## Reporting Rules

Report operational facts only:

- rental id or server label
- workspace path
- log path
- command summary with secrets redacted
- task state
- output/checkpoint path

Do not include raw SSH JSON, passwords, tokens, or full connection strings that embed secrets.
