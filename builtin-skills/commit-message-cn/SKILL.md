---
name: commit-message-cn
description: 生成符合团队规范的 commit message
---

# Commit Message (CN)

## Format

```text
<type>(<scope>): <中文描述>

<可选 body,分点,英文技术名词保留>

BREAKING CHANGE: <可选>
```

## Types

- feat: 新功能
- fix: bug 修复
- refactor: 重构(不改外部行为)
- perf: 性能优化
- docs: 文档
- chore: 杂项
- test: 测试

## Rules

1. 标题行 <= 50 字符(中文按 2 字符计)
2. scope 用 kebab-case
3. 如果改动涉及 DB schema、公开 API、配置格式,必须标 BREAKING CHANGE
