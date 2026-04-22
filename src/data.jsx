// Seed data — 9 skills per spec: 5 owned (mozia-official) + 4 referenced (anthropics/skills)
// Dates are relative to a fixed "now" so the "Xd ago" strings are stable.

const NOW = new Date('2026-04-22T10:00:00Z').getTime();
const d = (daysAgo) => new Date(NOW - daysAgo * 86400000).toISOString();

const SKILLS = [
  // ──────────────── OWNED ────────────────
  {
    slug: 'project-mental-map',
    name: 'project-mental-map',
    description: '帮助快速建立一个陌生代码仓库的 mental map:目录、入口、核心模块、数据流。',
    type: 'owned',
    visibility: 'public',
    tags: ['project', 'onboarding', 'codebase'],
    createdAt: d(42),
    updatedAt: d(3),
    skillMd: `---
name: project-mental-map
description: 帮助快速建立一个陌生代码仓库的 mental map
---

# Project Mental Map

## When to Use

当你第一次进入一个陌生的代码仓库,需要在 15 分钟内理解它的整体结构、
入口、核心模块、数据流、构建方式时,使用这个 skill。

## How it Works

1. 先跑 \`git ls-files\` 拿到全量文件清单
2. 从 package.json / pyproject.toml / go.mod 定位入口和依赖
3. 找到 README / docs 目录,提取高层描述
4. 画出目录树的前两层,标注每个目录的职责
5. 定位 main entry,跟踪 import 到第一层核心模块
6. 输出一份 200-400 字的 mental map 文档

## Output Format

\`\`\`
# {Repo Name}

## Stack
- Runtime:
- Framework:
- Key deps:

## Entry Points
- Main: path/to/file
- CLI: path/to/cli

## Core Modules
- module-a — 职责
- module-b — 职责

## Data Flow
...
\`\`\`
`,
    files: ['SKILL.md', 'reference/walkthrough-example.md', 'templates/mental-map.md'],
  },
  {
    slug: 'review-prd',
    name: 'review-prd',
    description: '审阅产品需求文档:找矛盾、找空洞、找隐含假设,输出具体的追问列表。',
    type: 'owned',
    visibility: 'public',
    tags: ['prd', 'product', 'review'],
    createdAt: d(60),
    updatedAt: d(7),
    skillMd: `---
name: review-prd
description: 审阅产品需求文档,输出追问列表
---

# Review PRD

## When to Use

当用户把一份 PRD、RFC 或功能描述丢给你,希望你从 PM/Tech Lead 的角度
找问题时使用。不要只是总结——要**挑刺**。

## The Three Passes

### Pass 1: 矛盾
扫一遍全文,标出自相矛盾、前后不一的地方。例如"MVP 要支持所有浏览器"
+ "只需要 Chrome 优先"。

### Pass 2: 空洞
找出"说了但没说清"的点。例如"异常情况要优雅处理",具体是哪些异常?

### Pass 3: 隐含假设
列出文档没写、但实现时会撞到的假设。例如默认用户已登录?
默认数据量 < 1000 条?

## Output

输出一份**追问清单**,每条追问附:
- 原文引用(短句)
- 追问内容
- 为什么这个问题重要(1 句话)
`,
    files: ['SKILL.md', 'reference/checklist.md'],
  },
  {
    slug: 'postgres-schema-reviewer',
    name: 'postgres-schema-reviewer',
    description: '检查 Drizzle / SQL schema 的索引、约束、命名、范式问题,给出 diff 建议。',
    type: 'owned',
    visibility: 'public',
    tags: ['database', 'postgres', 'review'],
    createdAt: d(30),
    updatedAt: d(5),
    skillMd: `---
name: postgres-schema-reviewer
description: 审查 Postgres / Drizzle schema
---

# Postgres Schema Reviewer

## When to Use

当有人提交了 Drizzle schema 或 SQL migration,需要 review 索引、约束、
命名、潜在的 lock 问题时。

## Checklist

### Indexes
- 所有外键是否有索引?
- 所有 ORDER BY / WHERE 字段是否有索引?
- 是否有冗余索引?(单列 + 该列开头的复合索引)

### Constraints
- CHECK constraints 是否齐全?
- NOT NULL 是否该有都有?
- CASCADE 是否符合业务预期?

### Naming
- 表名复数 or 单数(项目内保持一致)?
- 索引名 \`tbl_col_idx\` 约定?

### Migration Safety
- 是否有全表扫描?
- 是否有长 lock?
- 是否需要 \`CONCURRENTLY\`?
`,
    files: ['SKILL.md', 'reference/drizzle-patterns.md', 'reference/lock-table.md'],
  },
  {
    slug: 'internal-rfc-writer',
    name: 'internal-rfc-writer',
    description: '按 Mozia 内部 RFC 模板起草设计文档:问题、选型、决策、权衡、rollback 计划。',
    type: 'owned',
    visibility: 'internal',
    tags: ['writing', 'rfc', 'architecture'],
    createdAt: d(20),
    updatedAt: d(1),
    skillMd: `---
name: internal-rfc-writer
description: 按内部 RFC 模板起草设计文档
visibility: internal
---

# Internal RFC Writer

## When to Use

起草一份内部 RFC / 设计文档。这个 skill 只对 Mozia 成员开放,
因为模板包含内部链接和术语。

## Template

见 templates/rfc.md。关键章节:
1. Context / 背景
2. Goals & Non-goals
3. Options Considered
4. Decision
5. Tradeoffs
6. Rollback Plan
7. Open Questions

## Style Rules

- 不用市场语言("赋能"、"闭环"、"抓手")
- 每个 Option 至少列一个反方论点
- Decision 一定要给理由,不要只说"选 A"
`,
    files: ['SKILL.md', 'templates/rfc.md', 'reference/example-completed-rfc.md'],
  },
  {
    slug: 'commit-message-cn',
    name: 'commit-message-cn',
    description: '从 git diff 生成符合团队规范的中英混排 commit message,含 scope 和 breaking flag。',
    type: 'owned',
    visibility: 'public',
    tags: ['git', 'writing'],
    createdAt: d(15),
    updatedAt: d(10),
    skillMd: `---
name: commit-message-cn
description: 生成符合团队规范的 commit message
---

# Commit Message (CN)

## Format

\`\`\`
<type>(<scope>): <中文描述>

<可选 body,分点,英文技术名词保留>

BREAKING CHANGE: <可选>
\`\`\`

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
`,
    files: ['SKILL.md'],
  },

  // ──────────────── REFERENCED ────────────────
  {
    slug: 'frontend-design',
    name: 'frontend-design',
    description: 'Create distinctive, production-grade frontend interfaces with strong aesthetic opinions.',
    type: 'referenced',
    tags: ['frontend', 'design', 'ui'],
    sourceRepo: 'anthropics/skills',
    sourceSkillName: 'frontend-design',
    sourceInstallCommand: 'npx skills add anthropics/skills --skill frontend-design',
    sourceUrl: 'https://github.com/anthropics/skills/tree/main/frontend-design',
    createdAt: d(90),
    updatedAt: d(2),
  },
  {
    slug: 'skill-creator',
    name: 'skill-creator',
    description: 'Create new skills, modify existing skills, and package them for distribution.',
    type: 'referenced',
    tags: ['meta', 'tooling'],
    sourceRepo: 'anthropics/skills',
    sourceSkillName: 'skill-creator',
    sourceInstallCommand: 'npx skills add anthropics/skills --skill skill-creator',
    sourceUrl: 'https://github.com/anthropics/skills/tree/main/skill-creator',
    createdAt: d(120),
    updatedAt: d(14),
  },
  {
    slug: 'web-design-guidelines',
    name: 'web-design-guidelines',
    description: 'Apply Anthropic web design principles: typography, spacing, hierarchy, and restraint.',
    type: 'referenced',
    tags: ['design', 'web', 'guidelines'],
    sourceRepo: 'anthropics/skills',
    sourceSkillName: 'web-design-guidelines',
    sourceInstallCommand: 'npx skills add anthropics/skills --skill web-design-guidelines',
    sourceUrl: 'https://github.com/anthropics/skills/tree/main/web-design-guidelines',
    createdAt: d(75),
    updatedAt: d(9),
  },
  {
    slug: 'brainstorming',
    name: 'brainstorming',
    description: 'Structured divergent thinking: generate many options, then converge with explicit criteria.',
    type: 'referenced',
    tags: ['thinking', 'product'],
    sourceRepo: 'anthropics/skills',
    sourceSkillName: 'brainstorming',
    sourceInstallCommand: 'npx skills add anthropics/skills --skill brainstorming',
    sourceUrl: 'https://github.com/anthropics/skills/tree/main/brainstorming',
    createdAt: d(100),
    updatedAt: d(21),
  },
];

const ALL_TAGS = Array.from(new Set(SKILLS.flatMap((s) => s.tags))).sort();

// Relative time formatter — mimics the "2d / 3w / 5mo" spec behavior.
function formatRelative(iso) {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, NOW - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 8) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

Object.assign(window, { SKILLS, ALL_TAGS, formatRelative });
