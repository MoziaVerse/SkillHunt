---
name: project-mental-map
description: 帮助快速建立一个陌生代码仓库的 mental map
---

# Project Mental Map

## When to Use

当你第一次进入一个陌生的代码仓库,需要在 15 分钟内理解它的整体结构、
入口、核心模块、数据流、构建方式时,使用这个 skill。

## How it Works

1. 先跑 `git ls-files` 拿到全量文件清单
2. 从 `package.json` / `pyproject.toml` / `go.mod` 定位入口和依赖
3. 找到 `README` / `docs` 目录,提取高层描述
4. 画出目录树的前两层,标注每个目录的职责
5. 定位 main entry,跟踪 import 到第一层核心模块
6. 输出一份 200-400 字的 mental map 文档
