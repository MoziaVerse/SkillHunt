# SkillHub · Phase 0 · Overview

> 本文档是 Phase 0 的总纲。所有子 spec 遵循本文定义的目标、架构和约束。
>
> 交付物：一个本机可跑的 SkillHub，包含后端（well-known + 业务 API）、前端（列表 + 详情 + Docs）、5 个自有 skill + 4 个引用 skill，并通过官方 `npx skills` CLI 冒烟验收。

---

## 一、Phase 0 的目标

**本机跑通一个 mini 版 skills.sh**：

1. 前端页面 `http://localhost:5173` 展示 skill 列表（排行榜布局，列内容做合理替换）、详情页、Docs
2. 官方 `npx skills` CLI 能从 `http://localhost:3333` 发现并安装自有 skill
3. 列表里同时展示两种类型：**owned（自有，内容托管在我们 DB）** 和 **referenced（引用，内容在 GitHub）**

验收命令：

```bash
# [1] 前端可用
open http://localhost:5173

# [2] CLI 可用（只对 owned 生效）
npx skills add http://localhost:3333 --list
npx skills add http://localhost:3333 --skill <某个 owned skill 名字>

# [3] referenced skill 从详情页复制原始命令可装
# 例如从详情页复制：
npx skills add anthropics/skills --skill frontend-design
```

## 二、关键架构决策

### 决策 1：两种 skill 类型共存

| 类型 | 示例 | 内容存储 | 分发协议 |
|---|---|---|---|
| `owned` | 你们封装的 5 个 skill | 我们的 DB | well-known endpoint 直接 serve |
| `referenced` | anthropics/skills/frontend-design | GitHub | 详情页展示原始 `npx skills add <origin>` |

这是 discriminated union。Schema、API、前端三层都按此模型组织。

### 决策 2：visibility 字段

每个 owned skill 有 `visibility` 字段：

- `public`：well-known endpoint 会暴露
- `internal`：well-known endpoint 不暴露（但前端列表会展示"内部"标记）

Phase 0 本机跑不做鉴权，但字段就位。Phase 1 加鉴权时不改 schema。

`referenced` skill 没有 visibility 概念（它本来就是公开的）。

### 决策 3：协议 vs 业务 API 分离

后端有两组完全独立的路由，职责清晰：

- `/.well-known/agent-skills/*`：协议路由，给官方 CLI 用，严格符合 RFC 8615 风格的 well-known 协议
- `/api/*`：业务路由，给我们前端用，可以随便设计

这两组路由共享数据库，但不共享业务逻辑。

### 决策 4：Monorepo 结构

仓库采用 pnpm workspace monorepo（对齐 mclaw 的做法）：

```
mozia-skillhub/
├── apps/
│   ├── api/    # Bun + Hono（端口 3333）
│   └── web/    # Bun + React（端口 5173）
├── packages/
│   └── shared/ # 共享 types、zod schema
├── scripts/
│   └── import-skills.ts  # 从本地目录 / 元数据文件录入 skill
├── docs/       # 静态文档（Phase 0 先写 3 篇）
└── pnpm-workspace.yaml
```

## 三、技术栈

**严格对齐 matrix + mclaw 的技术栈**。不引入新依赖。

| 层 | 选型 | 理由 |
|---|---|---|
| 包管理 | pnpm（workspace） | 对齐 mclaw |
| Runtime | Bun | 对齐 matrix |
| 后端框架 | Hono | 对齐 matrix |
| ORM | Drizzle | 对齐 matrix |
| DB | PostgreSQL 16+ | 对齐 matrix |
| DTO 校验 | Zod | 对齐 matrix |
| 前端构建 | Vite 7 | 对齐 matrix 前端 |
| 前端框架 | React 19 | 对齐 matrix 前端 |
| 路由 | React Router 7 | 对齐 matrix 前端 |
| 组件库 | shadcn/ui | 对齐 matrix 前端 |
| 状态管理 | Zustand | 对齐 matrix 前端 |
| 样式 | Tailwind CSS v4 | 对齐 matrix 前端 |
| frontmatter 解析 | `gray-matter` | 社区通用 |
| 测试 | Bun test | 对齐 matrix |
| Lint/Format | Biome | 对齐 matrix |

## 四、Phase 0 明确不做的事

明确列出来以防 scope creep：

- ❌ 部署到 `skillhub.mzsjai.com`（Phase 1）
- ❌ mozia-sso 登录（Phase 1）
- ❌ GitHub 爬虫 / indexer（Phase 1）
- ❌ 安装量遥测上报（Phase 1）
- ❌ 用户发布流程（Phase 1）
- ❌ 私有 skill 鉴权（Phase 2）
- ❌ AI 审计（Phase 2）
- ❌ CLI fork（暂不需要）
- ❌ 从三板块提取 skill 内容（用你现有的 5 个 skill）

## 五、任务依赖图

```
01-scaffold（骨架）
    ↓
02-database（schema）
    ↓
    ├── 03-wellknown-endpoint（CLI 对接）
    └── 04-business-api（前端对接）
    ↓
05-frontend（UI）
    ↓
06-seed-import（录入 9 个 skill）
    ↓
07-e2e-smoke-test（验收）
```

03 和 04 逻辑上独立，可并行但建议串行（两者都依赖 02 的 schema）。

## 六、交付物清单

Phase 0 完成时，以下全部就位：

1. `MoziaVerse/mozia-skillhub` 仓库（private），含 monorepo 骨架
2. Drizzle migration 脚本 + seed 数据
3. 后端 `apps/api`：well-known endpoint + 业务 API，能跑在 3333 端口
4. 前端 `apps/web`：列表 + 详情 + Docs 三类页面，能跑在 5173 端口
5. `scripts/import-skills.ts`：从本地目录导入 owned skill + 从元数据文件录入 referenced skill
6. 9 个 skill 已录入（5 owned 来自你本地 `/mnt/skills/user/`，4 referenced：frontend-design / skill-creator / web-design-guidelines / brainstorming）
7. 所有路由 + 导入脚本均有 Bun test 测试
8. `README.md` 写清楚启动方式
9. 冒烟测试脚本 + 执行记录（截图或 asciinema）

## 七、执行工作流

每个 spec（01~07）是一次 CC 执行单元：

1. Zeo 把对应 spec 丢给 Claude Code
2. Claude Code 实现后自测通过
3. Zeo 跑 Codex review
4. Codex 通过 → 进入下一个 spec
5. Codex 有意见 → Claude Code 修改 → 重新 review
6. 所有 spec 完成后执行 07 冒烟测试，全部通过才算 Phase 0 完成

## 八、命名约定

- 仓库名：`mozia-skillhub`
- npm package scope：`@mozia/skillhub-*`（目前只内部用，不发布）
- 域名（Phase 1 用）：`skillhub.mzsjai.com`
- 数据库名：`mozia_skillhub`
- 数据库 schema：`skillhub`（PostgreSQL schema，与 matrix 的表隔离）

## 九、Phase 0 不要优化的事

这些地方**有意保持简陋**，不要在 Phase 0 钻研：

- 不做 skill 内容的全文搜索（Phase 0 用 ILIKE 足够）
- 不做列表的服务端分页（Phase 0 总共 9 个 skill，前端一次性拉完）
- 不做缓存（well-known endpoint 直接查 DB）
- 不做 rate limit
- 不做 CSP / CORS 精细化（开发环境允许全部）
- 不做埋点、监控、日志聚合
- 不做 i18n（Phase 0 全中文，Phase 1 再考虑）

**Phase 0 的哲学：用最少的代码跑通最完整的协议 + 最完整的数据模型。剩下都 Phase 1 再说。**
