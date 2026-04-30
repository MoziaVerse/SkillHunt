# Muxi/Mars LLM Inference Deployment Guide

This guide collects executable patterns for single-node LLM inference on Metax/Muxi/Mars servers. It replaces PDF/OCR fragments with command templates that agents can adapt.

Use `README.md` first for trigger clues, SSH safety requirements, and the Mars X201-A Qwen3-0.6B success note.

## 1. Pre-Flight

Run on the host:

```bash
ht-smi | sed -n '1,40p'
docker ps
docker images | sed -n '1,20p'
df -h ~
```

Required interpretation rules:

- `moziadl rental list` may only show CPU and memory. Do not conclude that the server has no GPU.
- `ht-smi` or `mx-smi` output is authoritative for Muxi/Mars accelerators.
- `docker images` is the source of truth for which accelerator runtime is already installed.
- If a suitable `vllm-mars`, `vllm-metax`, `maca`, `hpcc`, or `sglang` image exists, use Docker first.

Create a scoped workspace:

```bash
TASK=qwen3-06b-infer
WORK="$HOME/moziadl-work/$TASK"
mkdir -p "$WORK"/{logs,src,models,outputs,checkpoints}
```

Choose the image that already exists locally when possible. Example Mars image:

```bash
IMAGE='sw-harbor-lt.mxcr.io/ai-release/hpcc/vllm-mars:0.14.0-hpcc.ai3.3.0.401-torch2.8-py310-ubuntu22.04-amd64'
```

## 1.1 Model ID Resolution

User-facing model names are often approximate. Before downloading, resolve the exact ModelScope repo id.

Examples:

- `qwen3 0.6b` usually maps to `Qwen/Qwen3-0.6B`.
- `qwen3.5 0.8b` must be verified. Do not silently substitute a different model family or size.
- If multiple ModelScope repos match, ask the user to choose or pick the smallest official Qwen repo only after stating the assumption.

Resolution procedure:

1. Prefer an explicit ModelScope URL or repo id from the user.
2. If only a natural-language name is provided, search/verify the repo id before starting a long download.
3. Record the chosen `model_id` in `logs/run.log` and final output JSON.
4. Use ModelScope first for Qwen/GLM/Kimi/MiniMax on China-hosted servers.

## 2. Container Launch Patterns

### Mars/HPCC Smoke-Test Container

Use this when the host shows Mars GPUs and `vllm-mars`/HPCC images.

```bash
docker run --rm --privileged --network=host --shm-size 32g --ulimit memlock=-1 \
  -v "$WORK:/workspace" \
  "$IMAGE" bash -lc 'set -e; /opt/conda/bin/python - <<PY
import torch
print("torch", torch.__version__)
print("cuda available", torch.cuda.is_available())
print("cuda count", torch.cuda.device_count())
print("device0", torch.cuda.get_device_name(0) if torch.cuda.device_count() else "none")
PY'
```

Why `--privileged`: on the tested Mars X201-A server, narrower device mounts allowed `ht-smi` to see GPUs but PyTorch failed CUDA initialization. `--privileged` made `torch.cuda.is_available()` return `True`.

### MACA/vLLM Service Container

Use this for documented MACA images such as `vllm-metax`.

```bash
docker run -itd \
  --device=/dev/mxcd \
  --device=/dev/dri \
  --group-add video \
  --device=/dev/infiniband \
  --device=/dev/mem \
  --network=host \
  --security-opt seccomp=unconfined \
  --security-opt apparmor=unconfined \
  --shm-size 100g \
  --ulimit memlock=-1 \
  -v /models:/models \
  --name <container-name> \
  <image> /bin/bash
```

If PyTorch cannot initialize the accelerator, try the Mars/HPCC `--privileged` pattern for a short probe before spending time on model setup.

## 3. ModelScope Download and Direct Transformers Smoke Test

This is the recommended first proof-of-life for a new server because it avoids vLLM server complexity.

Create `src/run_qwen3_modelscope.sh` inside the task workspace:

```bash
cat > "$WORK/src/run_qwen3_modelscope.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
cd /workspace

export PATH=/opt/conda/bin:$PATH
export PYTHON=/opt/conda/bin/python
export PIP=/opt/conda/bin/pip
export PYTHONUNBUFFERED=1
export PIP_DISABLE_PIP_VERSION_CHECK=1
export MODELSCOPE_CACHE=/workspace/models/modelscope-cache
export HF_HOME=/workspace/models/hf-home
export TRANSFORMERS_CACHE=/workspace/models/transformers-cache

$PYTHON - <<'PY'
import importlib.util
import subprocess
import sys

if importlib.util.find_spec("modelscope") is None:
    print("Installing modelscope...", flush=True)
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "modelscope"])
else:
    print("modelscope already installed", flush=True)
PY

$PYTHON - <<'PY'
import json
from pathlib import Path

import torch
from modelscope import snapshot_download
from transformers import AutoModelForCausalLM, AutoTokenizer

model_id = "Qwen/Qwen3-0.6B"
print(f"Downloading {model_id} from ModelScope...", flush=True)
model_dir = snapshot_download(model_id, cache_dir="/workspace/models")
print(f"Model directory: {model_dir}", flush=True)
print(f"Torch: {torch.__version__}", flush=True)
print(f"CUDA available: {torch.cuda.is_available()}", flush=True)
print(f"CUDA devices: {torch.cuda.device_count()}", flush=True)
if not torch.cuda.is_available():
    raise SystemExit("CUDA is not available inside container")

tokenizer = AutoTokenizer.from_pretrained(model_dir, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    model_dir,
    torch_dtype="auto",
    trust_remote_code=True,
).to("cuda:0")
model.eval()

messages = [
    {"role": "user", "content": "用一句话介绍一下你自己，并说明你正在 Mars GPU 上运行。"}
]
text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
    enable_thinking=False,
)
inputs = tokenizer([text], return_tensors="pt").to(model.device)
with torch.no_grad():
    output_ids = model.generate(
        **inputs,
        max_new_tokens=128,
        do_sample=False,
    )

new_tokens = output_ids[0][inputs.input_ids.shape[-1]:]
answer = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
print("=== INFERENCE OUTPUT ===", flush=True)
print(answer, flush=True)

Path("/workspace/outputs/inference.json").write_text(
    json.dumps(
        {"model_id": model_id, "model_dir": model_dir, "answer": answer},
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
print("Saved /workspace/outputs/inference.json", flush=True)
PY
SCRIPT
chmod +x "$WORK/src/run_qwen3_modelscope.sh"
```

Run it in `tmux`:

```bash
cat > "$WORK/src/docker_run_qwen3.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
WORK="$HOME/moziadl-work/qwen3-06b-infer"
IMAGE='sw-harbor-lt.mxcr.io/ai-release/hpcc/vllm-mars:0.14.0-hpcc.ai3.3.0.401-torch2.8-py310-ubuntu22.04-amd64'

docker run --rm --privileged --network=host --shm-size 32g --ulimit memlock=-1 \
  -v "$WORK:/workspace" \
  "$IMAGE" \
  bash /workspace/src/run_qwen3_modelscope.sh
SCRIPT
chmod +x "$WORK/src/docker_run_qwen3.sh"

tmux new-session -d -s moziadl-qwen3-06b \
  "cd '$WORK' && bash src/docker_run_qwen3.sh 2>&1 | tee logs/run.log"
```

Check status:

```bash
tmux has-session -t moziadl-qwen3-06b 2>/dev/null && echo running || echo stopped
tail -n 120 "$WORK/logs/run.log"
cat "$WORK/outputs/inference.json" 2>/dev/null || true
```

Successful output example:

```json
{
  "model_id": "Qwen/Qwen3-0.6B",
  "model_dir": "/workspace/models/Qwen/Qwen3-0___6B",
  "answer": "我是火星GPU上的一个AI助手，正在运行。"
}
```

## 4. vLLM Service Templates

Use these only after a direct model load or a small smoke test has proven the container can see GPUs.

### MiniMax-M2.5 W8A8

Model source:

```text
https://modelscope.cn/models/metax-tech/MiniMax-M2.5-W8A8
```

Container notes:

- Use a `vllm-metax` image matching the deployed MACA stack.
- Mount the model directory into `/models`.

Server:

```bash
export MACA_GRAPH_LAUNCH_MODE=5
export MACA_SMALL_PAGESIZE_ENABLE=1
export MACA_DIRECT_DISPATCH=1
export MACA_VLLM_ENABLE_MCTIASS_FUSED_MOE=1
export MACA_VLLM_ENABLE_MCTIASS_PYTHON_API=1

vllm serve /models/MiniMax-M2.5-W8A8 \
  -tp 8 \
  --trust-remote-code \
  --max_num_batched_tokens 16384 \
  --swap-space 16 \
  --port 8010 \
  --tool-call-parser minimax_m2 \
  --reasoning-parser minimax_m2_append_think \
  --enable-auto-tool-choice \
  --gpu-memory-utilization 0.9 \
  --no-enable-prefix-caching
```

Client:

```bash
curl -s http://127.0.0.1:8010/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "/models/MiniMax-M2.5-W8A8",
    "messages": [{"role": "user", "content": "介绍一下上海这座城市。"}],
    "temperature": 0.0,
    "max_completion_tokens": 512
  }'
```

### Qwen3.5 Series

Image example:

```text
pub-registry1.metax-tech.com/ai-opentest/master/maca/vllm-metax:0.15.0-maca.ai20260227-177-torch2.8-py312-ubuntu22.04-amd64
```

Model notes:

- `Qwen3.5-397B-A17B-W8A8`: ModelScope `metax-tech/Qwen3.5-397B-A17B-W8A8`.
- 122B/35B/27B variants can use BF16 models from ModelScope when supported by the image.
- On 8-card C550 examples, use `tp=8` for large 397B/122B variants and `tp=2` for 35B/27B variants. Adjust to actual model size and GPU count.

Server template:

```bash
export MACA_SMALL_PAGESIZE_ENABLE=1
export MACA_VLLM_ENABLE_MCTLASS_FUSED_MOE=1
export MACA_VLLM_ENABLE_MCTLASS_PYTHON_API=1
export MACA_DIRECT_DISPATCH=1

vllm serve /models/Qwen/Qwen3_5_W8A8 \
  --tp 8 \
  --trust-remote-code \
  --max-model-len 32768 \
  --max_num_batched_tokens 8192 \
  --no-async-scheduling \
  --port 8010 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --gpu-memory-utilization 0.89 \
  --max-num-seqs 128 \
  --no-enable-prefix-caching
```

### GLM5 W8A8

Model source:

```text
https://modelscope.cn/models/metax-tech/GLM-5-W8A8
```

Single-node C588-style template:

```bash
ulimit -n 65536
export CUDA_VISIBLE_DEVICES=0,1,2,3,6,5,4,7,10,11,8,9,14,13,12,15
export MACA_VISIBLE_DEVICES=0,1,2,3,6,5,4,7,10,11,8,9,14,13,12,15
export MACA_SMALL_PAGESIZE_ENABLE=1
export VLLM_DISABLE_SHARED_EXPERTS_STREAM=1
export PYTORCH_CUDA_ALLOC_CONF="max_split_size_mb:128,garbage_collection_threshold:0.6,expandable_segments:True"
export DISABLE_MAP2XPU=1
export MACA_VLLM_ENABLE_MCTLASS_PYTHON_API=1
export MACA_VLLM_ENABLE_MCTLASS_FUSED_MOE=1

vllm serve "$MODEL_PATH" \
  --trust-remote-code \
  -tp 4 -dp 4 \
  --max-model-len 5140 \
  --max-num-seqs 64 \
  --gpu-memory-utilization 0.9 \
  --speculative_config '{"method": "mtp", "num_speculative_tokens": 1}' \
  --no-async-scheduling \
  --no-enable-prefix-caching
```

For C500/C550 multi-node deployments, set `GLOO_SOCKET_IFNAME`, `MCCL_SOCKET_IFNAME`, `MCCL_IB_HCA`, `--master-addr`, `--nnodes`, and `--node-rank` based on actual host networking.

### Kimi-K2.5

Model source:

```text
https://modelscope.cn/models/moonshotai/Kimi-K2.5
```

Template:

```bash
export CUDA_VISIBLE_DEVICES=0,1,2,3,6,5,4,7,10,9,8,11,14,15,12,13
export RAY_EXPERIMENTAL_NOSET_CUDA_VISIBLE_DEVICES=1
export MACA_DIRECT_DISPATCH=1

vllm serve /model/Kimi-K2.5 \
  -tp 16 \
  --trust-remote-code \
  --distributed-executor-backend ray \
  --max-model-len 8192 \
  --swap-space 16 \
  --gpu-memory-utilization 0.90 \
  --port 9000 \
  --no-enable-prefix-caching \
  --tool-call-parser kimi_k2 \
  --reasoning-parser kimi_k2 \
  --mm-processor-cache-gb 32
```

## 5. Benchmarks

For text-only services:

```bash
vllm bench serve \
  --model "$MODEL_PATH" \
  --dataset-name random \
  --random-input-len 256 \
  --random-output-len 256 \
  --num-prompts 5 \
  --max-concurrency 1 \
  --ignore-eos \
  --port 8010 \
  --trust-remote-code \
  --metric-percentiles 95,99
```

For multimodal Qwen variants, align `--random-mm-limit-mm-per-prompt` with the server's `--limit-mm-per-prompt`.

## 6. Common Failures

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `ht-smi` sees GPUs but `torch.cuda.is_available()` is false | Container device/runtime permissions incomplete | Try the `--privileged` smoke-test pattern. |
| `/usr/bin/python3: No module named pip` | Wrong Python selected inside image | Use `/opt/conda/bin/python` and `/opt/conda/bin/pip`. |
| ModelScope not installed | Minimal image does not include it | Install with `/opt/conda/bin/python -m pip install modelscope` in ephemeral container. |
| Download hangs through Hugging Face | Network path is slow/unavailable | Prefer ModelScope for China-hosted models. |
| vLLM starts but OOMs | `tp`, `max-model-len`, or KV cache too aggressive | Reduce context, `max-num-seqs`, or raise GPU count / lower `gpu-memory-utilization`. |
