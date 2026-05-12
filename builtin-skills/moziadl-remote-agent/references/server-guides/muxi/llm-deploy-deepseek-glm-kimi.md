# DeepSeek, GLM 4.7, and Kimi K2 Deployment Notes on Muxi

This document is a cleaned operational summary of the original DeepSeek/GLM/Kimi PDF notes. It focuses on model planning, container setup, environment variables, and launch templates. Always adapt model paths, host IPs, network devices, node counts, GPU order, ports, and image tags to the actual server.

For small smoke tests and ModelScope/Qwen direct inference, use `llm-inference-deploy-guide.md` first.

## 1. Capacity Planning

Rough memory estimates:

- BF16/FP16 weights: `parameter_count * 2 bytes * 1.2`
- INT8/W8A8 weights: `parameter_count * 1.1 bytes`
- KV cache: `num_hidden_layers * head_dim * seq_len * batch_size * 2 * precision_bytes`

The original notes list these typical requirements:

| Model | Precision | Typical GPUs | Typical nodes |
| --- | --- | ---: | ---: |
| DeepSeek-V3.2-W8A8 | W8A8 | 16 | 2 |
| Kimi-K2-W8A8 | W8A8 | 24 or 32 | 3 or 4 |
| GLM4.7-W8A8 | W8A8 | 8 | 1 |

Treat these as starting points, not guarantees. Context length, batch size, prefix cache, speculative decoding, and parallel strategy can change requirements.

## 2. Base Container Setup

Use the image family required by the target model:

| Model family | Framework | Image family |
| --- | --- | --- |
| DeepSeek-V3.2-W8A8 | SGLang | `pub-registry1.metax-tech.com/ai-opentest/release/maca/sglang:0.5.6-maca.ai3.3-torch2.6-py310-ubuntu22.04-amd64` |
| Kimi-K2-W8A8 | SGLang | `pub-registry1.metax-tech.com/ai-opentest/release/maca/sglang:0.5.1-maca.ai3.2-torch2.6-py310-ubuntu22.04-amd64` |
| GLM4.7-W8A8 | vLLM | project-specific temporary image from the deployment provider |

Generic container launch:

```bash
docker run -it \
  --device=/dev/dri \
  --device=/dev/mxcd \
  --device=/dev/infiniband \
  --device=/dev/mem \
  --privileged=true \
  --group-add video \
  --name "$CONTAINER_NAME" \
  --network=host \
  --security-opt seccomp=unconfined \
  --security-opt apparmor=unconfined \
  --shm-size 100g \
  --ulimit memlock=-1 \
  -v /usr/local:/usr/local \
  -v /models:/models \
  "$IMAGE" /bin/bash
```

Notes:

- `--security-opt seccomp=unconfined` is required by the source notes to avoid thread permission errors.
- `--privileged=true` is often necessary for Muxi/Mars accelerator access. Confirm with a short PyTorch probe before launching a long service.
- Use the same image across all nodes in multi-node runs.
- Mount model/data paths explicitly; do not rely on ad hoc home-directory paths.

## 3. Network and GPU Topology

For multi-node deployments:

1. Run `ifconfig -a` or `ip addr` on every node.
2. Pick the compute-network interface, not the public SSH interface.
3. Run `ibstat` to identify IB HCAs if InfiniBand is used.
4. Run `mx-smi topo -m` or the site equivalent to understand GPU interconnect order.

Common environment variables:

```bash
export GLOO_SOCKET_IFNAME=<compute-interface>
export MCCL_SOCKET_IFNAME=<compute-interface>
export MCCL_IB_HCA=mlx5_0,mlx5_1
```

If GPU topology is not in natural order, set the visible device order explicitly:

```bash
export MACA_VISIBLE_DEVICE=7,5,1,3,4,0,6,2
```

For C588 examples, the source notes use:

```bash
export CUDA_VISIBLE_DEVICES=0,1,2,3,6,5,4,7,10,11,8,9,14,13,12,15
export MACA_VISIBLE_DEVICES=0,1,2,3,6,5,4,7,10,11,8,9,14,13,12,15
```

## 4. Common Runtime Environment

Set these before launching SGLang/vLLM unless the image documentation says otherwise:

```bash
ulimit -n 65536
export MACA_SMALL_PAGESIZE_ENABLE=1
export TRITON_ENABLE_MACA_OPT_MOVE_DOT_OPERANDS_OUT_LOOP=1
export TRITON_ENABLE_MACA_CHAIN_DOT_OPT=1
export PYTORCH_ENABLE_PG_HIGH_PRIORITY_STREAM=1
export MACA_QUEUE_SCHEDULE_POLICY=1
```

For vLLM MoE/GLM-style runs:

```bash
export VLLM_DISABLE_SHARED_EXPERTS_STREAM=1
export PYTORCH_CUDA_ALLOC_CONF="max_split_size_mb:128,garbage_collection_threshold:0.6,expandable_segments:True"
export DISABLE_MAP2XPU=1
export MACA_VLLM_ENABLE_MCTLASS_PYTHON_API=1
export MACA_VLLM_ENABLE_MCTLASS_FUSED_MOE=1
```

## 5. DeepSeek-V3.2-W8A8 With SGLang

Model source:

```text
https://modelscope.cn/models/metax-tech/DeepSeek-V3.2-W8A8
```

Two-node 16-GPU template:

```bash
MODEL_PATH=/models/DeepSeek-V3.2-W8A8
MASTER_ADDR=<node0-compute-ip>:5555
NNODES=2

# Node 0
python3 -m sglang.launch_server \
  --model-path "$MODEL_PATH" \
  --dist-init-addr "$MASTER_ADDR" \
  --nnodes "$NNODES" \
  --node-rank 0 \
  --trust-remote-code \
  --tp 16 \
  --dp 8 \
  --enable-dp-attention \
  --enable-dp-lm-head \
  --mem-fraction-static 0.88 \
  --disable-radix-cache \
  --disable-chunked-prefix-cache

# Node 1
python3 -m sglang.launch_server \
  --model-path "$MODEL_PATH" \
  --dist-init-addr "$MASTER_ADDR" \
  --nnodes "$NNODES" \
  --node-rank 1 \
  --trust-remote-code \
  --tp 16 \
  --dp 8 \
  --enable-dp-attention \
  --enable-dp-lm-head \
  --mem-fraction-static 0.88 \
  --disable-radix-cache \
  --disable-chunked-prefix-cache
```

MTP variant:

```bash
python3 -m sglang.launch_server \
  --model-path "$MODEL_PATH" \
  --dist-init-addr "$MASTER_ADDR" \
  --nnodes "$NNODES" \
  --node-rank <rank> \
  --trust-remote-code \
  --tp 16 \
  --dp 8 \
  --enable-dp-attention \
  --enable-dp-lm-head \
  --mem-fraction-static 0.88 \
  --disable-radix-cache \
  --disable-chunked-prefix-cache \
  --speculative-algorithm NEXTN \
  --speculative-num-steps 2 \
  --speculative-eagle-topk 1 \
  --speculative-num-draft-tokens 3 \
  --quantization w8a8_int8
```

## 6. Kimi-K2-W8A8 With SGLang

The original notes describe quantizing Kimi-K2-Instruct BF16 into W8A8.

Input model:

```text
https://www.modelscope.cn/models/unsloth/Kimi-K2-Instruct-BF16/
```

Quantization plan:

1. Download the BF16 model from ModelScope.
2. Prepare a W8A8 output directory, for example `/workspace/Kimi-K2-Instruct-W8A8`.
3. Run the provided quantization script in a GPU-enabled container.
4. After quantization, ensure `bos_token_id` and `eos_token_id` in output `config.json` match the BF16 source model.

Three-node PP/TP/EP template:

```bash
MODEL_PATH=/models/Kimi-K2-Instruct-W8A8
MASTER_ADDR=<node0-compute-ip>:5000
NNODES=3

python3 -m sglang.launch_server \
  --model-path "$MODEL_PATH" \
  --dist-init-addr "$MASTER_ADDR" \
  --nnodes "$NNODES" \
  --node-rank <0|1|2> \
  --trust-remote-code \
  --attention-backend flashinfer \
  --tp 8 \
  --pp 3 \
  --quantization w8a8_int8 \
  --disable-chunked-prefix-cache
```

Four-node TP/DP/EP template:

```bash
MODEL_PATH=/models/Kimi-K2-Instruct-W8A8
MASTER_ADDR=<node0-compute-ip>:5000
NNODES=4

python3 -m sglang.launch_server \
  --model-path "$MODEL_PATH" \
  --dist-init-addr "$MASTER_ADDR" \
  --nnodes "$NNODES" \
  --node-rank <0|1|2|3> \
  --trust-remote-code \
  --attention-backend flashinfer \
  --tp 4 \
  --dp 8 \
  --quantization w8a8_int8 \
  --disable-chunked-prefix-cache
```

## 7. GLM4.7-W8A8 With vLLM

The source notes indicate GLM4.7 uses vLLM and requires a project-specific temporary image. Confirm the image tag before deployment.

Single-node 8-GPU style template:

```bash
MODEL_PATH=/models/GLM4.7-W8A8

ulimit -n 65536
export MACA_SMALL_PAGESIZE_ENABLE=1
export VLLM_DISABLE_SHARED_EXPERTS_STREAM=1
export PYTORCH_CUDA_ALLOC_CONF="max_split_size_mb:128,garbage_collection_threshold:0.6,expandable_segments:True"
export DISABLE_MAP2XPU=1
export MACA_VLLM_ENABLE_MCTLASS_PYTHON_API=1
export MACA_VLLM_ENABLE_MCTLASS_FUSED_MOE=1

vllm serve "$MODEL_PATH" \
  --trust-remote-code \
  -tp 8 \
  --max-model-len 5140 \
  --max-num-seqs 64 \
  --gpu-memory-utilization 0.9 \
  --no-async-scheduling \
  --no-enable-prefix-caching
```

If using speculative decoding:

```bash
--speculative_config '{"method": "mtp", "num_speculative_tokens": 1}'
```

## 8. Service Testing

For OpenAI-compatible endpoints:

```bash
curl -s http://127.0.0.1:<port>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "<served-model-name-or-path>",
    "messages": [{"role": "user", "content": "介绍一下上海这座城市。"}],
    "temperature": 0.0,
    "max_completion_tokens": 256
  }'
```

For vLLM benchmark checks:

```bash
vllm bench serve \
  --model "$MODEL_PATH" \
  --dataset-name random \
  --random-input-len 256 \
  --random-output-len 256 \
  --num-prompts 5 \
  --max-concurrency 1 \
  --ignore-eos \
  --port <port> \
  --trust-remote-code \
  --metric-percentiles 95,99
```

## 9. Failure Checklist

- Confirm all nodes use the same image and model files.
- Confirm `--security-opt seccomp=unconfined` and `--ulimit memlock=-1`.
- Confirm `torch.cuda.is_available()` inside the container before launching services.
- Confirm compute NIC names and IB HCA names.
- Confirm `--node-rank` is unique per node and `--dist-init-addr` points to node 0.
- Reduce context length or batch settings before assuming model/image incompatibility.
