# Spec 04 · Business API

> 依赖：02-database
> 产出：给前端用的业务 API，包括列表、详情、标签，全部带 Zod 校验和 Bun test 测试。

---

## 目标

实现前端需要的业务 API。这组路由和 well-known 路由完全独立——well-known 是"给 CLI 看"，business API 是"给前端看"。

## 路由总览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/skills` | 列出所有 skill（支持查询参数过滤） |
| GET | `/api/skills/:slug` | 单个 skill 详情 |
| GET | `/api/tags` | 所有用过的 tag（前端筛选用） |

三条路由。Phase 0 不做更多。

## 关键设计：列表同时返回 owned 和 referenced

前端列表页需要一次性拿到两种 skill 的数据，但两种 skill 的字段不完全一样。API 返回一个 union type，前端按 `type` 字段分支渲染。

## 代码组织

```
apps/api/src/
├── routes/
│   ├── wellknown.ts       # 已有
│   └── api.ts             # 新增：业务 API 路由
├── services/
│   └── skill-service.ts   # 扩展：加入列表 / 详情查询
├── lib/
│   └── dto.ts             # 新增：Zod schema 定义
└── index.ts               # 修改：挂载 /api 路由
```

## 详细实现

### `lib/dto.ts`

```ts
import { z } from 'zod';

// ─── 查询参数 ─────────────────────────────────

export const listSkillsQuerySchema = z.object({
  // 'owned' | 'referenced' | 'all'（默认 all）
  type: z.enum(['owned', 'referenced', 'all']).optional().default('all'),

  // 文本搜索，匹配 name 和 description
  q: z.string().trim().min(1).max(200).optional(),

  // 标签过滤，支持多个（`?tag=x&tag=y`）
  tag: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),

  // 是否包含 internal（默认 false，Phase 0 本机跑可以手动传 true 查看全部）
  includeInternal: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
});

// ─── 响应：skill 列表项 ──────────────────────

const baseSkillDto = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string(), // ISO
  updatedAt: z.string(), // ISO
});

export const ownedSkillListItemSchema = baseSkillDto.extend({
  type: z.literal('owned'),
  visibility: z.enum(['public', 'internal']),
});

export const referencedSkillListItemSchema = baseSkillDto.extend({
  type: z.literal('referenced'),
  sourceRepo: z.string(),
  sourceSkillName: z.string(),
});

export const skillListItemSchema = z.discriminatedUnion('type', [
  ownedSkillListItemSchema,
  referencedSkillListItemSchema,
]);

export type SkillListItem = z.infer<typeof skillListItemSchema>;

// ─── 响应：skill 详情 ────────────────────────

export const ownedSkillDetailSchema = ownedSkillListItemSchema.extend({
  skillMdContent: z.string(), // 原始 SKILL.md 内容
  files: z.array(z.string()), // 文件路径列表，不含内容
  installCommand: z.string(), // 本 registry 的安装命令
});

export const referencedSkillDetailSchema = referencedSkillListItemSchema.extend(
  {
    sourceInstallCommand: z.string(), // 原始安装命令
    sourceUrl: z.string().nullable(), // 原始仓库链接
  },
);

export const skillDetailSchema = z.discriminatedUnion('type', [
  ownedSkillDetailSchema,
  referencedSkillDetailSchema,
]);

export type SkillDetail = z.infer<typeof skillDetailSchema>;
```

### 扩展 `services/skill-service.ts`

在原有基础上追加：

```ts
import { and, or, eq, ilike, sql, inArray } from 'drizzle-orm';

// ... 前面已有的函数保留 ...

// ─── 列表查询 ───────────────────────────────

export interface ListSkillsOptions {
  type: 'owned' | 'referenced' | 'all';
  q?: string;
  tags: string[];
  includeInternal: boolean;
}

export async function listSkillsForApi(opts: ListSkillsOptions) {
  const conditions = [];

  if (opts.type !== 'all') {
    conditions.push(eq(skills.type, opts.type));
  }

  if (!opts.includeInternal) {
    // 非 internal 意思是：visibility=public，或 type=referenced（referenced 永远视为 public）
    conditions.push(
      or(
        eq(skills.visibility, 'public'),
        eq(skills.type, 'referenced'),
      )!,
    );
  }

  if (opts.q) {
    const pattern = `%${opts.q}%`;
    conditions.push(
      or(ilike(skills.name, pattern), ilike(skills.description, pattern))!,
    );
  }

  if (opts.tags.length > 0) {
    // tags 是 text[]，用 && 判断交集非空
    conditions.push(sql`${skills.tags} && ${opts.tags}`);
  }

  const rows = await db
    .select()
    .from(skills)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${skills.updatedAt} DESC`);

  return rows;
}

// ─── 详情查询 ───────────────────────────────

export async function findSkillBySlug(slug: string) {
  const rows = await db
    .select()
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSkillFilesWithContent(skillId: string) {
  return db
    .select({
      path: skillFiles.path,
      content: skillFiles.content,
    })
    .from(skillFiles)
    .where(eq(skillFiles.skillId, skillId));
}

// ─── 所有 tag ───────────────────────────────

export async function listAllTags(): Promise<string[]> {
  // 对整个 text[] 做 unnest + distinct
  const rows = await db.execute<{ tag: string }>(
    sql`SELECT DISTINCT unnest(tags) AS tag FROM ${skills} WHERE cardinality(tags) > 0 ORDER BY tag`,
  );
  return rows.map((r) => r.tag);
}
```

### `routes/api.ts`

```ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  listSkillsForApi,
  findSkillBySlug,
  listSkillFilesWithContent,
  listAllTags,
} from '../services/skill-service.ts';
import {
  listSkillsQuerySchema,
  type SkillListItem,
  type SkillDetail,
} from '../lib/dto.ts';

export const apiRoute = new Hono();

// ───────────────────────────────────────────────
// GET /api/skills
// ───────────────────────────────────────────────
apiRoute.get(
  '/skills',
  zValidator('query', listSkillsQuerySchema),
  async (c) => {
    const q = c.req.valid('query');
    const rows = await listSkillsForApi(q);

    const items: SkillListItem[] = rows.map((r) => {
      const base = {
        slug: r.slug,
        name: r.name,
        description: r.description,
        tags: r.tags,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };

      if (r.type === 'owned') {
        return {
          ...base,
          type: 'owned' as const,
          visibility: r.visibility,
        };
      } else {
        return {
          ...base,
          type: 'referenced' as const,
          sourceRepo: r.sourceRepo!,
          sourceSkillName: r.sourceSkillName!,
        };
      }
    });

    return c.json({ items, total: items.length });
  },
);

// ───────────────────────────────────────────────
// GET /api/skills/:slug
// ───────────────────────────────────────────────
apiRoute.get('/skills/:slug', async (c) => {
  const slug = c.req.param('slug');
  const skill = await findSkillBySlug(slug);

  if (!skill) {
    return c.json({ error: 'Not Found' }, 404);
  }

  const base = {
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    tags: skill.tags,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
  };

  if (skill.type === 'owned') {
    // internal skill 在详情页是否可见？Phase 0 本机跑，直接可见。
    // Phase 1 加鉴权时在这里加条件。

    const files = await listSkillFilesWithContent(skill.id);
    const skillMd = files.find((f) => f.path === 'SKILL.md');
    if (!skillMd) {
      return c.json({ error: 'Skill data corrupted' }, 500);
    }

    // 本地 registry 的安装命令
    const origin = new URL(c.req.url).origin;
    const installCommand = `npx skills add ${origin} --skill ${skill.slug}`;

    const detail: SkillDetail = {
      ...base,
      type: 'owned',
      visibility: skill.visibility,
      skillMdContent: skillMd.content,
      files: files.map((f) => f.path),
      installCommand,
    };
    return c.json(detail);
  } else {
    const detail: SkillDetail = {
      ...base,
      type: 'referenced',
      sourceRepo: skill.sourceRepo!,
      sourceSkillName: skill.sourceSkillName!,
      sourceInstallCommand: skill.sourceInstallCommand!,
      sourceUrl: skill.sourceUrl,
    };
    return c.json(detail);
  }
});

// ───────────────────────────────────────────────
// GET /api/tags
// ───────────────────────────────────────────────
apiRoute.get('/tags', async (c) => {
  const tags = await listAllTags();
  return c.json({ tags });
});
```

### 修改 `apps/api/src/index.ts`

在挂载 wellknown 后追加：

```ts
import { apiRoute } from './routes/api.ts';

app.route('/api', apiRoute);
```

### 依赖追加

`apps/api/package.json`：

```json
{
  "dependencies": {
    "zod": "^3.23.0",
    "@hono/zod-validator": "^0.4.0"
  }
}
```

## 测试

文件位置：`apps/api/src/routes/api.test.ts`

覆盖场景：

```ts
describe('business API', () => {
  // Setup: 插入 3 个测试 skill
  // - owned + public: 'test-owned-pub'
  // - owned + internal: 'test-owned-int'
  // - referenced: 'test-ref'

  describe('GET /api/skills', () => {
    it('默认返回所有非 internal 的 skill', async () => {
      // 期望：items 长度 = 2 (test-owned-pub + test-ref)，不含 test-owned-int
    });

    it('includeInternal=true 能看到 internal', async () => {
      // 期望：items 长度 = 3
    });

    it('type=owned 只返回 owned', async () => {
      // 期望：items 全部 type === 'owned'
    });

    it('type=referenced 只返回 referenced', async () => {
      // 期望：items 全部 type === 'referenced'
    });

    it('q 参数按 name / description 模糊匹配', async () => {
      // 插入一个 name 含 'magical' 的 skill，查 q=magical 能返回
    });

    it('tag 参数按 tags 过滤', async () => {
      // 插入两个 skill，tag 分别是 ['design'] 和 ['writing']
      // 查 tag=design 只返回第一个
    });

    it('返回按 updatedAt DESC 排序', async () => {
      // 验证排序
    });

    it('响应 schema 是 discriminated union', async () => {
      // owned 返回的 item 有 visibility 字段但没有 sourceRepo
      // referenced 相反
    });
  });

  describe('GET /api/skills/:slug', () => {
    it('owned skill 返回 skillMdContent 和 installCommand', async () => {
      // 期望：detail.type === 'owned'，含 skillMdContent 非空
      // installCommand 形如 'npx skills add http://localhost:... --skill xxx'
    });

    it('referenced skill 返回 sourceInstallCommand', async () => {
      // 期望：detail.type === 'referenced'
    });

    it('不存在的 slug 返回 404', async () => {});
  });

  describe('GET /api/tags', () => {
    it('返回所有 tag 的 distinct 集合', async () => {});
  });
});
```

## 验收标准

- [ ] `pnpm --filter @mozia/skillhub-api test` 全部通过
- [ ] 手动测试（需要先完成 06-seed）：
  ```bash
  curl 'http://localhost:3333/api/skills' | jq
  # 应返回 items 数组，含 owned 和 referenced 两种
  curl 'http://localhost:3333/api/skills?type=referenced' | jq
  # 只返回 referenced
  curl 'http://localhost:3333/api/skills/<某个 slug>' | jq
  # 返回详情
  curl 'http://localhost:3333/api/tags' | jq
  # 返回所有 tag
  ```
- [ ] 响应 JSON 能通过 `skillListItemSchema.parse()` 校验

## 反例

- 不要实现 POST/PUT/DELETE（Phase 0 只读）
- 不要做分页（9 个 skill 不需要）
- 不要在 API 里返回 SKILL.md 的完整内容给**列表**（只有详情页才返回）
- 不要加鉴权（Phase 0 本机跑）
- 不要做 rate limit
- 不要实现 `/api/install-events` 或类似的遥测端点（Phase 1）
