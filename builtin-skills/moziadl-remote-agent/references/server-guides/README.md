# Server Guides

This directory stores server-type-specific guidance for MoziaDL remote work.

Use this directory when the target server has specialized hardware, drivers, runtime stacks, or deployment conventions.

Current guides:

- `muxi/` - Metax/Muxi GPU servers, including C500, C550, C588, MACA, `mx-smi`, `vllm-metax`, SGLang, and LLM inference deployment.

When adding a new server type, create a new folder with:

- `README.md` for when to use the guide and which references to load
- focused reference files for deployment, diagnostics, tuning, or troubleshooting
