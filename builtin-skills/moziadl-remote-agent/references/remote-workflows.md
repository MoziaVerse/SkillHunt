# Remote Workflows

## Standard SSH Probe

After fetching SSH details, run a minimal probe before making changes:

```bash
ssh <username>@<host> -p <port> 'bash -lc "set -e; hostname; whoami; pwd; uname -a; df -h ~"'
```

For GPU workloads, also check:

```bash
ssh <username>@<host> -p <port> 'bash -lc "command -v ht-smi >/dev/null && ht-smi | sed -n '\''1,40p'\'' || true; command -v mx-smi >/dev/null && mx-smi || true; command -v nvidia-smi >/dev/null && nvidia-smi || true; ls -l /dev/dri /dev/mem /dev/infiniband 2>/dev/null || true; docker ps; docker images | sed -n '\''1,20p'\''; python3 --version || true"'
```

Do not decide that a server is CPU-only from rental metadata. Prove accelerator availability on the remote host with the commands above.

## Workspace Layout

Create one workspace per task:

```bash
TASK_NAME=<short-task-name>
ssh <username>@<host> -p <port> "bash -lc 'mkdir -p ~/moziadl-work/$TASK_NAME/{logs,src,data,outputs,checkpoints}'"
```

Use these paths consistently:

- `~/moziadl-work/<task-name>/src` for code
- `~/moziadl-work/<task-name>/data` for datasets
- `~/moziadl-work/<task-name>/outputs` for final artifacts
- `~/moziadl-work/<task-name>/checkpoints` for model checkpoints
- `~/moziadl-work/<task-name>/logs/run.log` for main logs

## Long-Running Tasks

Run training, fine-tuning, dataset preprocessing, or package builds inside `tmux`.

```bash
SESSION=moziadl-<task-name>
ssh <username>@<host> -p <port> "bash -lc 'tmux new-session -d -s $SESSION \"cd ~/moziadl-work/<task-name> && bash run.sh 2>&1 | tee logs/run.log\"'"
```

Check status:

```bash
ssh <username>@<host> -p <port> "bash -lc 'tmux has-session -t moziadl-<task-name> 2>/dev/null && echo running || echo stopped; tail -n 80 ~/moziadl-work/<task-name>/logs/run.log 2>/dev/null || true'"
```

Attach only when interactive debugging is necessary:

```bash
ssh <username>@<host> -p <port> -t 'tmux attach -t moziadl-<task-name>'
```

## Environment Preparation

Prefer isolated environments. Use what the server already has when possible.

For accelerator or LLM inference tasks on Muxi/Mars/HPCC/MACA servers, prefer Docker over host Python environments:

- Use the preinstalled accelerator image if one exists in `docker images`.
- Mount the task workspace into the container.
- Run Python from the image's intended environment, commonly `/opt/conda/bin/python`.
- Install lightweight Python helpers such as `modelscope` inside the ephemeral container when missing.
- Avoid host-level `python3 -m venv`, `apt install`, or GPU package installation unless Docker is unavailable or the user explicitly asks for host setup.

Host venv is acceptable for CPU-only scripts or non-accelerator tooling:

```bash
ssh <username>@<host> -p <port> "bash -lc 'cd ~/moziadl-work/<task-name> && python3 -m venv .venv && . .venv/bin/activate && python -m pip install -U pip wheel setuptools'"
```

Before installing heavy GPU packages, inspect CUDA and driver versions. Do not assume a CUDA version from the model package name.

Keep install logs:

```bash
ssh <username>@<host> -p <port> "bash -lc 'cd ~/moziadl-work/<task-name> && . .venv/bin/activate && pip install -r requirements.txt 2>&1 | tee logs/install.log'"
```

## File Transfer

Use `scp` or `rsync` for files. Keep secrets out of command strings when possible.

Upload:

```bash
scp -P <port> <local-path> <username>@<host>:~/moziadl-work/<task-name>/src/
```

Download:

```bash
scp -P <port> <username>@<host>:~/moziadl-work/<task-name>/outputs/<artifact> <local-destination>
```

For password-based SSH automation, prefer the agent environment's secure secret handling. If `sshpass` is necessary, avoid writing passwords into scripts, shell history, or logs.

## Reporting

Report concise operational facts:

- Connection target by rental id or server name, not by password
- Commands or scripts executed, with secrets redacted
- Workspace, log, output, and checkpoint paths
- Whether the remote `tmux` session is running
- The latest meaningful log lines, excluding secrets

Do not paste full training logs unless the user asks for them.
