# Spec 03 · Well-Known Endpoint

> 依赖：02-database
> 产出：3 条符合 RFC 8615 风格的 well-known 协议路由，让官方 `npx skills` CLI 能发现和下载 owned skill。

---

## 目标

严格按照 [vercel-labs/skills 的 well-known 协议](https://github.com/vercel-labs/skills/blob/main/src/providers/wellknown.ts) 实现三条路由：

1. `GET /.well-known/agent-skills/index.json` → skill 列表索引
2. `GET /.well-known/agent-skills/:name/SKILL.md` → 具体 skill 的主文件
3. `GET /.well-known/agent-skills/:name/*` → skill 下的其他文件

**只服务 `type='owned' AND visibility='public'` 的 skill。** referenced skill 和 internal skill 在这个协议里完全不暴露。

## 为什么这条路由这么重要

这是 SkillHub 和官方 `npx skills` CLI 的**唯一契约**。一旦协议不匹配，用户执行 `npx skills add http://localhost:3333` 就会失败。

**这个 spec 里的每一个字段名、每一个响应格式，都必须严格对齐官方 CLI 的期待。**

## 协议契约（权威来源）

来自 vercel-labs/skills 的 `WellKnownIndex` / `WellKnownSkillEntry` 定义：

### Index 响应格式

```json
{
  "skills": [
    {
      "name": "frontend-design",
      "description": "Create distinctive, production-grade frontend interfaces",
      "files": ["SKILL.md", "reference/tokens.md"]
    },
    {
      "name": "project-mental-map",
      "description": "帮助快速建立项目 mental map",
      "files": ["SKILL.md"]
    }
  ]
}
```

**严格要求：**

- 顶层必须是 `{ skills: [...] }`，不能是裸数组
- 每个 entry 必须有 `name`、`description`、`files` 三个字段
- `files` 是字符串数组，**必须包含 `SKILL.md`**（大小写敏感，就是 `SKILL.md`）
- `files` 里的路径不能以 `/` 开头，不能包含 `..`
- `name` 必须符合 `^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$`（或单字符）

### SKILL.md 响应

- Content-Type: `text/markdown; charset=utf-8`
- Body: 原始 Markdown 内容，包含 YAML frontmatter
- frontmatter 必须有 `name` 和 `description`

### 其他文件响应

- Content-Type: 按文件扩展猜（`.md` → `text/markdown`，`.json` → `application/json`，默认 `text/plain`）
- Body: 原始文件内容

## 代码组织

```
apps/api/src/
├── db/
│   ├── schema.ts          # 已有
│   └── index.ts           # 已有
├── services/
│   └── skill-service.ts   # 新增：skill 查询逻辑
├── routes/
│   └── wellknown.ts       # 新增：well-known 路由
├── lib/
│   └── content-type.ts    # 新增：扩展名到 MIME 的映射
└── index.ts               # 修改：挂载路由
```

## 详细实现

### `lib/content-type.ts`

```ts
const MIME_MAP: Record<string, string> = {
  md: 'text/markdown; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  yaml: 'text/yaml; charset=utf-8',
  yml: 'text/yaml; charset=utf-8',
};

export function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME_MAP[ext] ?? 'text/plain; charset=utf-8';
}
```

### `services/skill-service.ts`

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { skills, skillFiles } from '../db/schema.ts';

/**
 * 列出所有 owned + public 的 skill，用于 well-known index。
 */
export async function listPublicOwnedSkills() {
  return db
    .select({
      id: skills.id,
      slug: skills.slug,
      name: skills.name,
      description: skills.description,
    })
    .from(skills)
    .where(and(eq(skills.type, 'owned'), eq(skills.visibility, 'public')));
}

/**
 * 获取某个 owned + public skill 的所有文件路径。
 */
export async function listSkillFilePaths(skillId: string): Promise<string[]> {
  const rows = await db
    .select({ path: skillFiles.path })
    .from(skillFiles)
    .where(eq(skillFiles.skillId, skillId));
  return rows.map((r) => r.path);
}

/**
 * 通过 slug 找到 public owned skill，返回 null 如果不存在或不符合条件。
 */
export async function findPublicOwnedSkillBySlug(slug: string) {
  const rows = await db
    .select()
    .from(skills)
    .where(
      and(
        eq(skills.slug, slug),
        eq(skills.type, 'owned'),
        eq(skills.visibility, 'public'),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 获取某个 skill 下指定路径的文件内容。
 */
export async function getSkillFileContent(
  skillId: string,
  path: string,
): Promise<string | null> {
  const rows = await db
    .select({ content: skillFiles.content })
    .from(skillFiles)
    .where(and(eq(skillFiles.skillId, skillId), eq(skillFiles.path, path)))
    .limit(1);
  return rows[0]?.content ?? null;
}
```

### `routes/wellknown.ts`

```ts
import { Hono } from 'hono';
import {
  listPublicOwnedSkills,
  listSkillFilePaths,
  findPublicOwnedSkillBySlug,
  getSkillFileContent,
} from '../services/skill-service.ts';
import { mimeFromPath } from '../lib/content-type.ts';

export const wellknownRoute = new Hono();

// ───────────────────────────────────────────────
// GET /.well-known/agent-skills/index.json
// ───────────────────────────────────────────────
wellknownRoute.get('/agent-skills/index.json', async (c) => {
  const skills = await listPublicOwnedSkills();

  const entries = await Promise.all(
    skills.map(async (s) => ({
      name: s.slug, // 注意：协议用 name，我们用 slug 充当
      description: s.description,
      files: await listSkillFilePaths(s.id),
    })),
  );

  // 过滤掉不含 SKILL.md 的（理论上不会发生，但防御性编程）
  const valid = entries.filter((e) =>
    e.files.some((f) => f.toLowerCase() === 'skill.md'),
  );

  return c.json({ skills: valid });
});

// ───────────────────────────────────────────────
// GET /.well-known/agent-skills/:name/SKILL.md
// GET /.well-known/agent-skills/:name/*
// 用同一个 handler 处理
// ───────────────────────────────────────────────
wellknownRoute.get('/agent-skills/:name/*', async (c) => {
  const name = c.req.param('name');
  const fullPath = c.req.path;
  // 提取 :name 之后的路径
  const prefix = `/agent-skills/${name}/`;
  const idx = fullPath.indexOf(prefix);
  if (idx < 0) return c.notFound();
  const filePath = fullPath.slice(idx + prefix.length);

  // 安全校验：禁止 .. 和绝对路径
  if (filePath.includes('..') || filePath.startsWith('/')) {
    return c.text('Invalid path', 400);
  }

  if (!filePath) {
    return c.text('File path required', 400);
  }

  const skill = await findPublicOwnedSkillBySlug(name);
  if (!skill) return c.notFound();

  const content = await getSkillFileContent(skill.id, filePath);
  if (content === null) return c.notFound();

  c.header('Content-Type', mimeFromPath(filePath));
  return c.body(content);
});
```

### 修改 `apps/api/src/index.ts`

```ts
import { Hono } from 'hono';
import { wellknownRoute } from './routes/wellknown.ts';

const app = new Hono();

app.get('/healthz', (c) => c.json({ ok: true, service: 'skillhub-api' }));

// 挂载 well-known 路由到 /.well-known 前缀
app.route('/.well-known', wellknownRoute);

const port = Number(Bun.env.PORT ?? 3333);
export default { port, fetch: app.fetch };
console.log(`[skillhub-api] listening on http://localhost:${port}`);
```

## 测试

文件位置：`apps/api/src/routes/wellknown.test.ts`

测试用 Bun test。用一个独立的测试数据库 schema（或使用 testcontainers），不要污染开发库。

必须覆盖的场景：

```ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

describe('well-known endpoint', () => {
  // Setup: 插入测试数据
  // - 1 个 owned + public skill (slug='test-owned-public', 带 SKILL.md + extra.md)
  // - 1 个 owned + internal skill (slug='test-owned-internal')
  // - 1 个 referenced skill (slug='test-ref')

  it('index.json 只包含 owned + public 的 skill', async () => {
    // 期望：返回的 skills 数组长度为 1，name 是 'test-owned-public'
  });

  it('index.json 的 entry 包含完整 files 列表', async () => {
    // 期望：entry.files 包含 'SKILL.md' 和 'extra.md'
  });

  it('SKILL.md 能正确返回', async () => {
    // GET /.well-known/agent-skills/test-owned-public/SKILL.md
    // 期望：200, Content-Type: text/markdown
  });

  it('extra.md 能正确返回', async () => {
    // GET /.well-known/agent-skills/test-owned-public/extra.md
    // 期望：200, Content-Type: text/markdown
  });

  it('访问 internal skill 返回 404', async () => {
    // GET /.well-known/agent-skills/test-owned-internal/SKILL.md
    // 期望：404
  });

  it('访问 referenced skill 返回 404', async () => {
    // GET /.well-known/agent-skills/test-ref/SKILL.md
    // 期望：404
  });

  it('路径穿越被拒绝', async () => {
    // GET /.well-known/agent-skills/test-owned-public/..%2fevil
    // 期望：400 或 404（两者都算通过）
  });

  it('不存在的 skill 返回 404', async () => {
    // GET /.well-known/agent-skills/nonexistent/SKILL.md
    // 期望：404
  });
});
```

## 验收标准

**自动化：**

- [ ] `pnpm --filter @mozia/skillhub-api test` 全部通过
- [ ] 测试覆盖上面列的 8 个场景

**手动（需要先完成 06-seed 才能跑）：**

- [ ] `curl http://localhost:3333/.well-known/agent-skills/index.json` 返回合法 JSON，包含 5 个 owned skill
- [ ] `curl http://localhost:3333/.well-known/agent-skills/<某个 owned slug>/SKILL.md` 返回 Markdown 内容，第一行是 `---`（frontmatter 开始）
- [ ] 用官方 CLI 验证（在任意目录）：
  ```bash
  npx skills add http://localhost:3333 --list
  # 应该列出 5 个 owned skill
  npx skills add http://localhost:3333 --skill <某个 owned slug>
  # 应该在 ~/.claude/skills/<slug>/ 下看到 SKILL.md
  ```

## 协议合规性测试

在本 spec 里增加一个额外测试：**把响应格式和 vercel-labs/skills 源码中的验证逻辑对比**。

源码中的 `isValidSkillEntry` 函数（`src/providers/wellknown.ts:174-205`）的要求：

1. name 是非空字符串
2. description 是非空字符串
3. files 是非空数组
4. 每个 file 是字符串，不以 `/` 或 `\` 开头，不包含 `..`
5. files 包含 `SKILL.md`（大小写不敏感判断，但我们实际存的就用 `SKILL.md`）

本 spec 的测试里增加一个 `协议合规性` 测试，把 index.json 的响应喂给一个 mini 版 `isValidSkillEntry`：

```ts
function isValidSkillEntry(entry: unknown): boolean {
  // 照搬 vercel-labs/skills/src/providers/wellknown.ts 的逻辑
  // ...
}

it('index.json 的每个 entry 都通过协议合规性校验', async () => {
  const res = await fetch('http://localhost:3333/.well-known/agent-skills/index.json');
  const body = await res.json();
  for (const entry of body.skills) {
    expect(isValidSkillEntry(entry)).toBe(true);
  }
});
```

## 反例

- 不要在这个 spec 实现业务 API（是 04 的事）
- 不要加 CORS（well-known 协议不需要，同源不会跨域）
- 不要做任何 caching headers（Phase 0 直接查 DB，Phase 1 再说）
- 不要把 referenced skill 也塞进 index.json。referenced skill 的内容不在我们这里，塞进去 CLI 下载会失败。
- 不要做 `.well-known/skills/index.json` 的 fallback 路由（官方 CLI 会自动 fallback，我们不需要同时暴露两条）
