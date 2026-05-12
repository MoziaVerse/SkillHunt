# Metax/Muxi GPU Server Guide

Use this guide for MoziaDL servers with Metax/Muxi/Mars GPU hardware or software stacks.

## Trigger Clues

- Hardware: C500, C550, C588, Mars X201-A, 沐曦, 曦云, Metax, MACA, MXC, HPCC.
- Tools/devices: `ht-smi`, `mx-smi`, `/dev/dri`, `/dev/mem`, `/dev/infiniband`, `/dev/mxcd`.
- Images: `vllm-mars`, `vllm-metax`, `sglang`, `maca`, `hpcc`.
- Workloads: W8A8/BF16 LLM inference, vLLM, SGLang, ModelScope model downloads.

Always combine this guide with:

- `../../secure-ssh.md` for SSH safety rules.
- `../../remote-workflows.md` for remote workspace, tmux, file transfer, and reporting patterns.

## Reference Map

- `llm-inference-deploy-guide.md`: general vLLM/Mars/MACA inference workflow, ModelScope downloads, Qwen smoke tests, MiniMax/Qwen/GLM/Kimi service templates.
- `llm-deploy-deepseek-glm-kimi.md`: larger-model notes for DeepSeek, GLM 4.7, and Kimi K2 with SGLang/vLLM and multi-node planning.

## Baseline Remote Workflow

1. Resolve the rental and refresh SSH details with `moziadl`.
2. Run a read-only SSH probe before any mutation. Do not trust `moziadl rental list` alone for GPU information; that output can omit accelerator fields.
3. Create a scoped workspace:

```bash
TASK=qwen3-06b-infer
mkdir -p ~/moziadl-work/$TASK/{logs,src,models,outputs,checkpoints}
```

4. Probe host GPU state:

```bash
ht-smi | sed -n '1,40p'
docker ps
docker images | sed -n '1,20p'
```

5. Prefer `tmux` for downloads and inference runs, writing logs to:

```text
~/moziadl-work/<task>/logs/run.log
```

## Critical Mars/Muxi Container Rule

For LLM inference on Muxi/Mars/HPCC, do not start with host Python virtual environments. The host may lack `python3-venv` or the correct accelerator runtime. Start from the existing Docker image shown by `docker images`, mount the workspace, and run the image's Python environment.

On Mars X201-A with the HPCC `vllm-mars` image, passing only `/dev/dri`, `/dev/infiniband`, `/dev/mem`, and `--group-add video` may let `ht-smi` see GPUs while PyTorch still fails with:

```text
CUDA driver initialization failed, you might not have a CUDA gpu.
```

For smoke tests and single-node inference, use `--privileged` unless a stricter site-specific runtime is known to work:

```bash
docker run --rm --privileged --network=host --shm-size 32g --ulimit memlock=-1 \
  -v "$WORK:/workspace" \
  "$IMAGE" bash -lc 'python - <<PY
import torch
print(torch.__version__)
print(torch.cuda.is_available())
print(torch.cuda.device_count())
print(torch.cuda.get_device_name(0))
PY'
```

Expected successful probe on the tested Mars stack:

```text
torch 2.8.0+mars3.3.0.3
cuda available True
cuda count 8
device0 Mars 01-A
```

## Successful Smoke Test: Qwen3-0.6B From ModelScope

Validated on 2026-04-22 with:

- Host GPU: 8x Mars X201-A
- Host tool: `ht-smi 2.2.6`
- Container image: `sw-harbor-lt.mxcr.io/ai-release/hpcc/vllm-mars:0.14.0-hpcc.ai3.3.0.401-torch2.8-py310-ubuntu22.04-amd64`
- Container torch: `2.8.0+mars3.3.0.3`
- Model: `Qwen/Qwen3-0.6B`
- Download source: ModelScope

Important details:

- The image did not include `modelscope` initially. Install it inside the ephemeral container with `/opt/conda/bin/python -m pip install modelscope`.
- Use `/opt/conda/bin/python`; plain `python3` may resolve to `/usr/bin/python3` without `pip`.
- `snapshot_download("Qwen/Qwen3-0.6B", cache_dir="/workspace/models")` created `/workspace/models/Qwen/Qwen3-0___6B`.
- A direct Transformers generation on `cuda:0` succeeded.

Observed inference output:

```text
我是火星GPU上的一个AI助手，正在运行。
```

Output artifact:

```text
~/moziadl-work/qwen3-06b-infer/outputs/inference.json
```

See `llm-inference-deploy-guide.md` for a reusable script.
