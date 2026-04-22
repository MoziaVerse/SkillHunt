# Spec 05 · Frontend

> 依赖：04-business-api
> 产出：React 前端，包含列表、详情、Docs 三类页面，视觉参照 skills.sh 的排行榜布局。

---

## 目标

做一个"看起来像 skills.sh、但诚实地展示我们实际有的数据"的前端。

**设计策略（决策 3 方案 A）：保留排行榜式布局，但数据列用真实信息替换——**

| skills.sh 的列 | 我们的列 | 为什么 |
|---|---|---|
| # 排名 | # 序号（静态） | 没有 install 数据，但保留编号视觉 |
| Skill name | Skill name | 一致 |
| owner/repo | 来源标识 | owned → "mozia-official"；referenced → "anthropics/skills" |
| Installs | 最近更新 | 用真实的 updatedAt 替换假造的 installs |

这样每一列都承载**真实信息**，视觉一致，不存在"假数据"问题。

## 页面范围

三类页面：

1. **主列表页** `/` — 排行榜布局 + 搜索 + tag 筛选
2. **详情页** `/skills/:slug` — 展示元数据 + 安装命令 + SKILL.md 预览（owned）或跳转说明（referenced）
3. **Docs 页** `/docs`、`/docs/what-is-a-skill`、`/docs/how-to-install`、`/docs/how-to-publish` — 静态文档

顶部导航：`SkillHub | Docs` （Phase 0 暂不做 Official / Audits）

## 技术约束

- React 19 + React Router 7（已在 01 装好）
- 组件库：shadcn/ui（本 spec 按需安装）
- 样式：Tailwind CSS v4
- 状态：Zustand（简单场景直接 fetch + useState 也行，不要过度工程化）
- 代码高亮：`shiki` 或 `@shikijs/react`（用于详情页 SKILL.md 和安装命令展示）
- Markdown 渲染：`react-markdown` + `remark-gfm`

## 目录结构

```
apps/web/src/
├── main.tsx
├── App.tsx                    # Router 外壳
├── index.css
├── routes/
│   ├── layout.tsx             # 顶部导航 + outlet
│   ├── skills-list.tsx        # /
│   ├── skill-detail.tsx       # /skills/:slug
│   └── docs/
│       ├── layout.tsx
│       ├── index.tsx          # /docs
│       ├── what-is-a-skill.tsx
│       ├── how-to-install.tsx
│       └── how-to-publish.tsx
├── components/
│   ├── skill-row.tsx          # 列表里的一行
│   ├── skill-search.tsx       # 搜索输入框
│   ├── tag-filter.tsx         # 标签过滤器
│   ├── install-command.tsx    # 代码块 + 复制按钮
│   ├── source-badge.tsx       # "mozia-official" / "anthropics/skills" 标识
│   ├── visibility-badge.tsx   # "internal" 标记
│   └── markdown-view.tsx      # SKILL.md 渲染
├── lib/
│   ├── api-client.ts          # fetch wrapper
│   └── format.ts              # 时间格式化等工具
├── types/
│   └── api.ts                 # 从 backend dto 抄过来的类型
└── hooks/
    └── use-skills.ts          # 列表数据 hook
```

## 关键组件设计

### 1. 列表页（`/`）

**视觉参照 skills.sh 首页**，但做以下调整：

```
┌──────────────────────────────────────────────────────────────┐
│  SkillHub                                        [Docs]      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ███ SkillHub                                                │
│                                                              │
│  The mozia agent skills directory                            │
│                                                              │
│  $ npx skills add http://localhost:3333 <skill>              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [ 搜索...        ]   [ 全部 ] [ 自有 ] [ 引用 ]  标签: ...    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  #   Skill                              Source         更新  │
│  ─── ──────────────────────────────── ─────────────── ────── │
│  1   frontend-design                    anthropics     2d    │
│      Create distinctive production...                        │
│                                                              │
│  2   project-mental-map    [internal]   mozia-official 3d    │
│      帮助快速建立项目 mental map                             │
│                                                              │
│  3   skill-creator                      anthropics     5d    │
│      Create new skills, modify...                            │
│  ...                                                         │
└──────────────────────────────────────────────────────────────┘
```

**关键行为：**

- 整行可点击，跳到详情页
- `[internal]` badge 仅 owned + internal 时显示
- Source 列：`owned` 显示 `mozia-official`，`referenced` 显示 `sourceRepo`
- 更新时间用 `date-fns` 或手写 "2d / 3w / 5mo" 相对时间
- 序号 `#` 就是列表顺序（按 updatedAt DESC），不要造假排名

**数据获取：**

```ts
// hooks/use-skills.ts
import { useEffect, useState } from 'react';
import { apiClient } from '../lib/api-client';
import type { SkillListItem } from '../types/api';

export function useSkills(params: {
  type: 'all' | 'owned' | 'referenced';
  q?: string;
  tag?: string[];
}) {
  const [items, setItems] = useState<SkillListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    apiClient
      .listSkills(params)
      .then((r) => {
        setItems(r.items);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [params.type, params.q, params.tag?.join(',')]);

  return { items, loading, error };
}
```

### 2. 详情页（`/skills/:slug`）

两种形态：

**Owned skill 详情：**

```
┌────────────────────────────────────────────────────────────┐
│  ← SkillHub                                     [Docs]    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  project-mental-map                          [mozia]       │
│  帮助快速建立项目 mental map                                │
│                                                            │
│  标签: #project #onboarding                                 │
│  更新: 3 days ago                                          │
│                                                            │
│  ─────────────────────────────────────────────────────     │
│  安装                                                       │
│  $ npx skills add http://localhost:3333 --skill project-... │
│                                                    [复制]   │
│  ─────────────────────────────────────────────────────     │
│                                                            │
│  SKILL.md 内容                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ # Project Mental Map                                  │ │
│  │                                                       │ │
│  │ ## When to Use                                        │ │
│  │ ...                                                   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  文件列表: SKILL.md, reference/xxx.md (仅 files 数组)       │
└────────────────────────────────────────────────────────────┘
```

**Referenced skill 详情：**

```
┌────────────────────────────────────────────────────────────┐
│  ← SkillHub                                     [Docs]    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  frontend-design                        [anthropics/skills]│
│  Create distinctive, production-grade frontend interfaces  │
│                                                            │
│  标签: #frontend #design                                    │
│  更新: 2 days ago                                          │
│                                                            │
│  ─────────────────────────────────────────────────────     │
│  这个 skill 由 anthropics 维护。安装请使用：                │
│  $ npx skills add anthropics/skills --skill frontend-design│
│                                                    [复制]   │
│  ─────────────────────────────────────────────────────     │
│                                                            │
│  [ 查看源代码 → github.com/anthropics/skills ]             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

注意：referenced skill **不展示内容预览**。因为我们没有内容。只给元数据 + 安装命令 + 跳转链接。

### 3. Docs 页

三篇静态文档，内容由 CC 按以下要点生成：

**`/docs/what-is-a-skill`**

- 什么是 Agent Skill（2-3 段）
- Skill 和 MCP、Agent 的区别（小表格）
- SkillHub 的定位（2 段）
- 引用：[agentskills.io](https://agentskills.io)、[vercel-labs/skills](https://github.com/vercel-labs/skills)

**`/docs/how-to-install`**

- 前置依赖（Node / npx）
- 基础命令（从 SkillHub 装、从 GitHub 装）
- 不同 agent 的路径差异（列 Claude Code / Codex / Cursor / OpenCode 四个例子）
- 装完之后怎么确认生效

**`/docs/how-to-publish`**

- Phase 0 说明："目前通过内部脚本录入，外部发布 Phase 1 开放"
- 先写一段占位，告诉用户怎么联系维护者提交 skill

**注意**：Docs 内容用 React 组件直接写（tsx 里写 JSX + Tailwind），不用 MDX，不要引入 MDX 依赖。Phase 0 三篇文档静态就够。

## API Client

文件：`apps/web/src/lib/api-client.ts`

```ts
import type {
  SkillListItem,
  SkillDetail,
} from '../types/api';

const BASE = '/api'; // vite proxy 已处理，部署后改成绝对 URL

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  async listSkills(params: {
    type?: 'all' | 'owned' | 'referenced';
    q?: string;
    tag?: string[];
    includeInternal?: boolean;
  }): Promise<{ items: SkillListItem[]; total: number }> {
    const usp = new URLSearchParams();
    if (params.type) usp.set('type', params.type);
    if (params.q) usp.set('q', params.q);
    if (params.tag) for (const t of params.tag) usp.append('tag', t);
    if (params.includeInternal) usp.set('includeInternal', 'true');
    const qs = usp.toString();
    return request(`/skills${qs ? `?${qs}` : ''}`);
  },

  async getSkill(slug: string): Promise<SkillDetail> {
    return request(`/skills/${encodeURIComponent(slug)}`);
  },

  async listTags(): Promise<{ tags: string[] }> {
    return request('/tags');
  },
};
```

## Router 配置

文件：`apps/web/src/App.tsx`

```tsx
import { createBrowserRouter, RouterProvider } from 'react-router';
import Layout from './routes/layout';
import SkillsList from './routes/skills-list';
import SkillDetail from './routes/skill-detail';
import DocsLayout from './routes/docs/layout';
import DocsIndex from './routes/docs/index';
import WhatIsASkill from './routes/docs/what-is-a-skill';
import HowToInstall from './routes/docs/how-to-install';
import HowToPublish from './routes/docs/how-to-publish';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <SkillsList /> },
      { path: 'skills/:slug', element: <SkillDetail /> },
      {
        path: 'docs',
        element: <DocsLayout />,
        children: [
          { index: true, element: <DocsIndex /> },
          { path: 'what-is-a-skill', element: <WhatIsASkill /> },
          { path: 'how-to-install', element: <HowToInstall /> },
          { path: 'how-to-publish', element: <HowToPublish /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
```

## shadcn/ui 组件安装

本 spec 需要以下组件，按 shadcn 文档装（`pnpm dlx shadcn@latest add ...`）：

- `button`
- `input`
- `badge`
- `toggle-group` 或 `tabs`（用于 "全部/自有/引用" 切换）
- `separator`

不要装更多。

## 视觉设计硬约束

- **字体**：优先级 `JetBrains Mono, 'SF Mono', Menlo` 给代码块；`Inter, system-ui, 'PingFang SC'` 给正文
- **配色**：参考 skills.sh 的"偏黑白 + 强对比"风格，**不要**用彩色系。Tailwind `neutral` 色系为主。
- **密度**：列表页一屏能看到 ≥8 行（对标 skills.sh 的紧凑排版）
- **响应式**：PC 优先，移动端能看不崩就行（Phase 0 不做移动端优化）

## 依赖追加

```json
{
  "dependencies": {
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "shiki": "^1.24.0",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.460.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0"
  }
}
```

## 测试

前端本 phase **不做单元测试**。原因：

- Phase 0 前端都是展示逻辑，测试 ROI 低
- 07-e2e-smoke-test 会用 Playwright 做冒烟覆盖关键路径

typecheck 必须通过（`pnpm --filter @mozia/skillhub-web typecheck`）。

## 验收标准

- [ ] `pnpm dev` 同时启动 api + web，无报错
- [ ] 访问 http://localhost:5173 能看到列表页，展示 9 个 skill（5 owned + 4 referenced）
- [ ] 列表页搜索能工作
- [ ] 列表页类型切换（全部/自有/引用）能工作
- [ ] 点击任意 owned skill 进详情页，看到 SKILL.md 渲染 + 本地安装命令 + 复制按钮
- [ ] 点击任意 referenced skill 进详情页，看到原始安装命令 + 来源跳转
- [ ] Docs 三篇文档可访问
- [ ] `pnpm --filter @mozia/skillhub-web typecheck` 通过

## 反例

- 不要用 Next.js / Remix / TanStack Router（坚持 React Router 7，对齐 matrix）
- 不要引入 React Query / SWR（Phase 0 数据少，手动 useEffect + fetch 够用）
- 不要做深色模式切换（Phase 1 再说）
- 不要做登录/发布按钮（Phase 1）
- 不要做动画和过渡效果（Phase 0 的 UI 是功能态，不是成品态）
- 不要用 Chakra / MUI / Ant Design（shadcn 对齐 matrix）
- 不要把 SKILL.md 渲染做得太炫（基础 react-markdown + code highlight 就够）
- 不要给 referenced skill 显示"文件列表"（我们没数据）
