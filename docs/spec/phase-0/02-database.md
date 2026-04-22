# Spec 02 · Database Schema

> 依赖：01-scaffold
> 产出：Drizzle schema、migration 脚本、DB 连接模块。执行 `pnpm db:migrate` 后数据库 ready。

---

## 目标

定义 SkillHub 的核心数据模型，建好表，不写业务查询。只提供"DB 连接 + schema 导出"两样东西。

## 核心数据模型

### 设计原则

两种 skill 用**一张表**存，`type` 字段做 discriminator：

- `type='owned'`：内容存在 `skill_files` 表里，我们可以完整 serve
- `type='referenced'`：内容不存，只记元数据 + 原始来源

一张表 + 一个字段，胜过两张表 join。前端和 API 层处理 discriminated union。

### ER 图（文字版）

```
skills (1) ──────── (N) skill_files
    │
    └── (1, 仅 referenced 用) 外部 GitHub 仓库引用
```

## Drizzle Schema

文件位置：`apps/api/src/db/schema.ts`

```ts
import {
  pgSchema,
  text,
  timestamp,
  uuid,
  pgEnum,
  uniqueIndex,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 独立 schema，与 matrix 的表完全隔离
export const skillhubSchema = pgSchema('skillhub');

// ─── 枚举定义 ─────────────────────────────────────

export const skillTypeEnum = skillhubSchema.enum('skill_type', [
  'owned',
  'referenced',
]);

export const visibilityEnum = skillhubSchema.enum('visibility', [
  'public',
  'internal',
]);

// ─── skills 主表 ──────────────────────────────────

export const skills = skillhubSchema.table(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // 用于 URL 和 CLI 安装的唯一标识
    // 例：'frontend-design', 'project-mental-map'
    // 规则：lowercase, 1-64 字符, 只允许 [a-z0-9-]
    slug: text('slug').notNull(),

    // 来自 SKILL.md 的 frontmatter，展示用
    name: text('name').notNull(),
    description: text('description').notNull(),

    // 类型 discriminator
    type: skillTypeEnum('type').notNull(),

    // 可见性（仅 owned 有效，referenced 永远视为 public）
    visibility: visibilityEnum('visibility').notNull().default('public'),

    // 标签，前端过滤用
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),

    // ─── referenced 专用字段 ───
    // type='owned' 时全部为 null
    // 示例：'anthropics/skills'
    sourceRepo: text('source_repo'),
    // 示例：'frontend-design'
    sourceSkillName: text('source_skill_name'),
    // 展示在详情页的安装命令
    // 示例：'npx skills add anthropics/skills --skill frontend-design'
    sourceInstallCommand: text('source_install_command'),
    // 原始 GitHub 链接（可选，详情页"查看源码"按钮用）
    sourceUrl: text('source_url'),

    // ─── owned 专用字段 ───
    // type='referenced' 时为 null
    // 原始 SKILL.md 的 frontmatter，完整存下来，便于未来恢复
    frontmatter: jsonb('frontmatter').$type<Record<string, unknown>>(),

    // 时间戳
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('skills_slug_idx').on(t.slug),
    typeIdx: index('skills_type_idx').on(t.type),
    visibilityIdx: index('skills_visibility_idx').on(t.visibility),
  }),
);

// ─── skill_files 表 ──────────────────────────────
// 只有 type='owned' 的 skill 会有文件记录
// 每个 owned skill 至少要有一条 path='SKILL.md' 的记录

export const skillFiles = skillhubSchema.table(
  'skill_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),

    // 相对路径，例如 'SKILL.md', 'templates/foo.md'
    // 约束：不允许 '..'，不能以 '/' 开头，长度 <= 512
    path: text('path').notNull(),

    // 完整文件内容。超过 1MB 的 skill 本 phase 不支持，报错拒绝。
    content: text('content').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // 同一 skill 下 path 唯一
    skillPathIdx: uniqueIndex('skill_files_skill_path_idx').on(
      t.skillId,
      t.path,
    ),
  }),
);

// ─── 类型导出 ──────────────────────────────────

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type SkillFile = typeof skillFiles.$inferSelect;
export type NewSkillFile = typeof skillFiles.$inferInsert;
```

## 数据完整性约束

Drizzle schema 层面表达不了的约束，通过**业务校验**和**DB check constraint** 保证：

### Check constraints（在 migration SQL 里手写）

```sql
-- owned skill 必须有 frontmatter
ALTER TABLE skillhub.skills
  ADD CONSTRAINT skills_owned_has_frontmatter CHECK (
    type <> 'owned' OR frontmatter IS NOT NULL
  );

-- referenced skill 必须有完整的 source_* 字段
ALTER TABLE skillhub.skills
  ADD CONSTRAINT skills_referenced_has_source CHECK (
    type <> 'referenced' OR (
      source_repo IS NOT NULL
      AND source_skill_name IS NOT NULL
      AND source_install_command IS NOT NULL
    )
  );

-- slug 格式校验
ALTER TABLE skillhub.skills
  ADD CONSTRAINT skills_slug_format CHECK (
    slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$' OR length(slug) = 1
  );

-- skill_files.path 校验（不允许路径穿越）
ALTER TABLE skillhub.skill_files
  ADD CONSTRAINT skill_files_path_safe CHECK (
    path !~ '\.\.' AND path !~ '^/' AND length(path) <= 512
  );
```

### updatedAt 触发器

```sql
CREATE OR REPLACE FUNCTION skillhub.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER skills_touch_updated_at
  BEFORE UPDATE ON skillhub.skills
  FOR EACH ROW
  EXECUTE FUNCTION skillhub.touch_updated_at();
```

## DB 连接模块

文件位置：`apps/api/src/db/index.ts`

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

const connectionString = Bun.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const queryClient = postgres(connectionString, {
  max: 10,
});

export const db = drizzle(queryClient, { schema });
export * from './schema.ts';
```

## Drizzle 配置

文件位置：`apps/api/drizzle.config.ts`

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['skillhub'],
  dbCredentials: {
    url: Bun.env.DATABASE_URL!,
  },
} satisfies Config;
```

## package.json 追加 scripts

`apps/api/package.json` 的 `scripts` 部分新增：

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "bun run src/db/migrate.ts",
  "db:studio": "drizzle-kit studio"
}
```

依赖追加：

```json
{
  "dependencies": {
    "drizzle-orm": "^0.35.0",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.27.0"
  }
}
```

## Migration 入口

文件位置：`apps/api/src/db/migrate.ts`

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = Bun.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

console.log('[migrate] running migrations...');
await migrate(db, { migrationsFolder: './drizzle' });
console.log('[migrate] done');

await client.end();
```

## 执行顺序（给执行 CC 看）

```bash
# 1. 确保本机 Postgres 跑在 36915
# 2. 手动创建 DB（一次性）
psql postgres://postgres:postgres@localhost:36915/postgres \
  -c "CREATE DATABASE mozia_skillhub;"

# 3. 生成 migration
cd apps/api
pnpm db:generate

# 4. 手动把 check constraints 和 trigger 加到生成的 migration SQL 里
# （drizzle-kit 不会自动生成这些，需要追加到最新 migration 末尾）

# 5. 执行
pnpm db:migrate
```

## 验收标准

- [ ] 在 Postgres 里 `\dt skillhub.*` 能看到 `skills` 和 `skill_files` 两张表
- [ ] `\d skillhub.skills` 显示所有字段 + 索引 + check constraints
- [ ] 插入一条 `type='owned'` 但 `frontmatter=NULL` 的记录，DB 报 constraint 违反
- [ ] 插入一条 `type='referenced'` 但 `source_repo=NULL` 的记录，DB 报 constraint 违反
- [ ] 插入一条 `slug='Invalid Slug'` 的记录，DB 报 constraint 违反
- [ ] 插入一条 `skill_files.path='../etc/passwd'` 的记录，DB 报 constraint 违反
- [ ] UPDATE 一条 skill 后，`updated_at` 自动变化

## 反例

- 不要在这个 spec 写任何 INSERT（seed 是 06 的事）
- 不要在这个 spec 写 API 路由
- 不要设计得太"完美"。以下东西 **Phase 0 故意不做**：
  - 不做 skill_versions 表（版本快照是 Phase 1）
  - 不做 install_events 表（遥测是 Phase 1）
  - 不做 publishers / orgs 表（发布者系统是 Phase 1）
  - 不做 tags 独立表（用 `text[]` 字段足够）
  - 不做全文索引（Phase 1 看流量再加）
