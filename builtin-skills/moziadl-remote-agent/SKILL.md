---
name: moziadl-remote-agent
description: Tool Wrapper and Pipeline for using MoziaDL CLI to let an AI agent log in, inspect active rented servers, retrieve SSH details for a target rental, and operate on the remote server. Use when the user asks an agent to prepare server environments, install dependencies, run model training or fine-tuning, manage remote files, inspect logs, deploy scripts, or perform other SSH-based work on MoziaDL rented servers.
---

# MoziaDL Remote Agent

This skill wraps the `moziadl` CLI and runs a strict SSH operation pipeline for MoziaDL rented servers.

Use it as:

- `Tool Wrapper`: treat `moziadl` as the source of truth for identity, rentals, and SSH credentials.
- `Pipeline`: do not skip login, target resolution, SSH retrieval, probe, execution, and reporting.
- `Reviewer`: apply `references/safety-checklist.md` before and after remote work.

## Pipeline

Run these steps in order:

1. Check whether the CLI is installed:
   ```bash
   command -v moziadl
   ```
2. If `moziadl` is missing, install it before doing anything else:
   ```bash
   npm install -g @moziaverse/moziadl
   ```
3. Verify the installed CLI:
   ```bash
   moziadl --version
   moziadl whoami --json
   ```
4. If login is required:
   ```bash
   moziadl login
   ```
5. Resolve the target rental:
   - Use an explicit `rental-id` first.
   - If only a server name or server id is present, compare it against active rentals.
   - If no target is provided, list active rentals and ask the user to choose one.
   - Do not infer GPU/accelerator availability from `moziadl rental list` CPU/memory fields. Rental list metadata can omit GPU details.
   ```bash
   moziadl rental list --status active --json
   ```
6. Fetch SSH details:
   ```bash
   moziadl rental ssh --rental-id <rental-id> --json
   ```
7. Load `references/secure-ssh.md` and follow the SSH safety rules.
8. Load `references/safety-checklist.md` and apply the pre-flight checklist.
9. Load `references/remote-workflows.md` for SSH probes, workspaces, `tmux`, file transfer, environment setup, and long-running jobs.
10. Run a hardware/runtime probe after SSH and before planning environment setup:
   ```bash
   command -v ht-smi >/dev/null && ht-smi | sed -n '1,40p' || true
   command -v mx-smi >/dev/null && mx-smi || true
   command -v nvidia-smi >/dev/null && nvidia-smi || true
   docker ps
   docker images | sed -n '1,20p'
   ```
11. Execute the requested remote task.
12. Apply the post-flight checklist before reporting completion.

## Server Guides

Use `references/server-guides/` for server-type-specific guidance. Load the matching guide before planning commands for a specialized server or accelerator.

For any LLM inference, model deployment, GPU, accelerator, Docker image, Qwen, DeepSeek, GLM, Kimi, MiniMax, Metax/Muxi/Mars/HPCC, C500, C550, C588, MACA, `ht-smi`, `mx-smi`, `vllm-mars`, `vllm-metax`, or SGLang task, first load:

- `references/server-guides/muxi/README.md`

Then choose the concrete workflow from:

- `references/server-guides/muxi/llm-inference-deploy-guide.md` for single-node inference, ModelScope downloads, Qwen smoke tests, and vLLM templates.
- `references/server-guides/muxi/llm-deploy-deepseek-glm-kimi.md` for larger DeepSeek, GLM, and Kimi deployments.

## Hard Gates

- Do not SSH before the target rental is resolved.
- Do not run mutating remote commands before a read-only SSH probe succeeds.
- Do not call a rental "CPU-only" from `moziadl rental list`; prove hardware with SSH probes such as `ht-smi`, `mx-smi`, `nvidia-smi`, `/dev/dri`, and Docker image inspection.
- For Muxi/Mars/HPCC/MACA LLM inference, do not create a host Python venv or install GPU packages on the host by default. Use the existing accelerator Docker image and a workspace-mounted script.
- For China-hosted Qwen/GLM/Kimi/MiniMax model downloads, prefer ModelScope before Hugging Face unless the user explicitly asks otherwise.
- Do not start long-running work before a workspace and log path exist.
- Do not report completion before checking task state, logs, and expected output paths.
- Do not expose SSH passwords, access tokens, refresh tokens, `~/.moziadl/config.json`, or raw `moziadl rental ssh --json` output.

## Failure Handling

If `moziadl` is missing, install it with `npm install -g @moziaverse/moziadl`, then verify with `moziadl --version` and `moziadl whoami --json`. If global installation is not appropriate and you are working inside the MoziaDL repo, use the repository CLI entrypoint instead.

If login fails or device authorization expires, rerun `moziadl login`.

If SSH fails, verify the rental is active, the SSH details are fresh, the server accepts password login, and the agent environment supports interactive SSH or secure password automation.
