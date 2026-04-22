# Spec 06 · Seed & Import

> 依赖：02-database（schema）、03-wellknown-endpoint（验证）、04-business-api（验证）
> 产出：两个导入脚本 + 一份元数据文件，把 5 个 owned skill（来自 Zeo 本地目录）和 4 个 referenced skill（元数据写死）录入 DB。

---

## 目标

**把两种不同来源的 skill 用两个不同脚本录入 DB。**

- `scripts/import-owned.ts`：扫描一个本地目录，把其中每个子目录（如果含 SKILL.md）作为一个 owned skill 导入
- `scripts/seed-referenced.ts`：读 `scripts/referenced-skills.json` 里预定义的元数据，录入 referenced skill

两个脚本独立，各司其职。

## 设计决策

### 为什么不用一个大脚本

owned 和 referenced 的数据完全不同一套：

- owned：要读文件、解析 frontmatter、存完整文件内容
- referenced：元数据 JSON 里写死，一次性 insert

合在一起只会让参数变复杂。**用两个脚本，职责清晰。**

### 为什么 owned 从本地目录导入

Zeo 本地 `/mnt/skills/user/` 已经有封装好的 skill，直接扫目录最快。未来 Phase 1 加上"从 git repo 导入"只是加一个新脚本，不改现有逻辑。

### 幂等性

两个脚本都必须**幂等**：

- 如果 DB 里已经有同 slug 的 skill，执行"更新"而不是"报错"或"重复插入"
- 实现方式：按 slug upsert

---

## 脚本 1：`scripts/import-owned.ts`

### 用法

```bash
# 扫描指定目录，每个子目录（含 SKILL.md）都视为一个 owned skill
pnpm --filter @mozia/skillhub-api exec bun ../../scripts/import-owned.ts \
  --dir /mnt/skills/user \
  --visibility public

# 把某个 skill 标记为 internal
pnpm --filter @mozia/skillhub-api exec bun ../../scripts/import-owned.ts \
  --dir /path/to/single-skill \
  --single \
  --visibility internal

# 带 tags
pnpm --filter @mozia/skillhub-api exec bun ../../scripts/import-owned.ts \
  --dir /mnt/skills/user/project-mental-map \
  --single \
  --tags project,onboarding
```

参数：

| 参数 | 说明 | 默认 |
|---|---|---|
| `--dir <path>` | 要扫描的目录（必需） | - |
| `--single` | 把 `--dir` 本身当作一个 skill 目录（而不是扫子目录） | false |
| `--visibility public\|internal` | 可见性 | `public` |
| `--tags a,b,c` | 逗号分隔的 tag 列表 | `[]` |
| `--dry-run` | 只解析不入库 | false |

### 扫描规则

```
模式 A（默认）：--dir 是一个父目录
  /mnt/skills/user/
    ├── project-mental-map/    ← 子目录1
    │   └── SKILL.md
    ├── another-skill/         ← 子目录2
    │   ├── SKILL.md
    │   └── reference/
    │       └── foo.md
    └── README.md              ← 忽略（非目录）

模式 B（--single）：--dir 本身是一个 skill 目录
  /path/to/single-skill/
    ├── SKILL.md
    └── ...
```

### 解析 SKILL.md

```ts
import matter from 'gray-matter';

const content = await Bun.file(skillMdPath).text();
const parsed = matter(content);

// 校验 frontmatter
if (!parsed.data.name || typeof parsed.data.name !== 'string') {
  throw new Error(`Missing 'name' in frontmatter: ${skillMdPath}`);
}
if (!parsed.data.description || typeof parsed.data.description !== 'string') {
  throw new Error(`Missing 'description' in frontmatter: ${skillMdPath}`);
}

// slug 规则：frontmatter.name 必须满足 skill name 正则
// ^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$
const slug = parsed.data.name;
if (!/^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/.test(slug) && slug.length !== 1) {
  throw new Error(`Invalid slug '${slug}' in ${skillMdPath}`);
}
```

### 扫描其他文件

一个 owned skill 目录可能包含多个文件（例如 `reference/` 目录、`templates/` 目录）：

```ts
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

async function walkFiles(
  root: string,
  prefix = '',
): Promise<Array<{ relativePath: string; absolutePath: string }>> {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...(await walkFiles(root, rel)));
    } else if (entry.isFile()) {
      // 忽略特定文件
      if (entry.name.startsWith('.')) continue; // .DS_Store 等
      results.push({ relativePath: rel, absolutePath: join(root, rel) });
    }
  }
  return results;
}
```

**安全校验**：

- 每个文件的相对路径不能以 `/` 或 `\` 开头
- 不能包含 `..`
- 单个文件大小 ≤ 1MB（超过报错跳过，Phase 0 不支持大文件）
- 整个 skill 必须至少有一个 `SKILL.md`（大小写敏感）

### Upsert 逻辑

```ts
import { db, skills, skillFiles } from '../apps/api/src/db/index';
import { eq } from 'drizzle-orm';

// 1. 查是否存在
const existing = await db
  .select()
  .from(skills)
  .where(eq(skills.slug, slug))
  .limit(1);

// 2. 如果存在且 type 不是 owned，报错（避免把 referenced 覆盖成 owned）
if (existing[0] && existing[0].type !== 'owned') {
  throw new Error(
    `slug '${slug}' already exists as ${existing[0].type}. Refusing to overwrite.`,
  );
}

// 3. Upsert 主记录
const [skillRow] = await db
  .insert(skills)
  .values({
    slug,
    name: parsed.data.name,
    description: parsed.data.description,
    type: 'owned',
    visibility: args.visibility,
    tags: args.tags,
    frontmatter: parsed.data,
  })
  .onConflictDoUpdate({
    target: skills.slug,
    set: {
      name: parsed.data.name,
      description: parsed.data.description,
      visibility: args.visibility,
      tags: args.tags,
      frontmatter: parsed.data,
      updatedAt: new Date(),
    },
  })
  .returning();

// 4. 删除旧文件，重新插入（简单可靠的全量替换）
await db.delete(skillFiles).where(eq(skillFiles.skillId, skillRow.id));

for (const file of files) {
  await db.insert(skillFiles).values({
    skillId: skillRow.id,
    path: file.relativePath,
    content: await Bun.file(file.absolutePath).text(),
  });
}
```

### 日志要求

```
[import-owned] scanning /mnt/skills/user
[import-owned]   found skill: project-mental-map (5 files)
[import-owned]   found skill: another-skill (1 file)
[import-owned] upserting 2 skills...
[import-owned]   ✓ project-mental-map (created)
[import-owned]   ✓ another-skill (updated)
[import-owned] done (2 skills, 6 files)
```

---

## 脚本 2：`scripts/seed-referenced.ts`

### 输入：`scripts/referenced-skills.json`

```json
[
  {
    "slug": "frontend-design",
    "name": "frontend-design",
    "description": "Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications.",
    "tags": ["frontend", "design", "ui"],
    "sourceRepo": "anthropics/skills",
    "sourceSkillName": "frontend-design",
    "sourceInstallCommand": "npx skills add anthropics/skills --skill frontend-design",
    "sourceUrl": "https://github.com/anthropics/skills/tree/main/frontend-design"
  },
  {
    "slug": "skill-creator",
    "name": "skill-creator",
    "description": "Create new skills, modify and improve existing skills, and measure skill performance.",
    "tags": ["meta", "tooling"],
    "sourceRepo": "anthropics/skills",
    "sourceSkillName": "skill-creator",
    "sourceInstallCommand": "npx skills add anthropics/skills --skill skill-creator",
    "sourceUrl": "https://github.com/anthropics/skills/tree/main/skill-creator"
  },
  {
    "slug": "web-design-guidelines",
    "name": "web-design-guidelines",
    "description": "Vercel's web design guidelines for agents building web interfaces.",
    "tags": ["frontend", "design", "vercel"],
    "sourceRepo": "vercel-labs/agent-skills",
    "sourceSkillName": "web-design-guidelines",
    "sourceInstallCommand": "npx skills add vercel-labs/agent-skills --skill web-design-guidelines",
    "sourceUrl": "https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines"
  },
  {
    "slug": "brainstorming",
    "name": "brainstorming",
    "description": "Collaborative brainstorming techniques for agents to explore problem spaces.",
    "tags": ["thinking", "planning"],
    "sourceRepo": "obra/superpowers",
    "sourceSkillName": "brainstorming",
    "sourceInstallCommand": "npx skills add obra/superpowers --skill brainstorming",
    "sourceUrl": "https://github.com/obra/superpowers/tree/main/skills/brainstorming"
  }
]
```

> **注**：description 用英文还是中文一致性问题——这 4 个都是英文 skill，description 保留原文（英文）。未来 Zeo 自己的 owned skill 可以用中文 description。前端展示时不做翻译。

### 脚本逻辑

```ts
// scripts/seed-referenced.ts
import { readFile } from 'node:fs/promises';
import { db, skills } from '../apps/api/src/db/index';
import { eq } from 'drizzle-orm';

const json = JSON.parse(
  await readFile(new URL('./referenced-skills.json', import.meta.url), 'utf8'),
) as Array<{
  slug: string;
  name: string;
  description: string;
  tags: string[];
  sourceRepo: string;
  sourceSkillName: string;
  sourceInstallCommand: string;
  sourceUrl: string | null;
}>;

for (const entry of json) {
  // 若已存在且 type 不是 referenced，拒绝覆盖
  const existing = await db
    .select()
    .from(skills)
    .where(eq(skills.slug, entry.slug))
    .limit(1);
  if (existing[0] && existing[0].type !== 'referenced') {
    console.warn(
      `[seed-referenced] skip '${entry.slug}': already exists as ${existing[0].type}`,
    );
    continue;
  }

  await db
    .insert(skills)
    .values({
      slug: entry.slug,
      name: entry.name,
      description: entry.description,
      type: 'referenced',
      visibility: 'public', // referenced 永远是 public
      tags: entry.tags,
      sourceRepo: entry.sourceRepo,
      sourceSkillName: entry.sourceSkillName,
      sourceInstallCommand: entry.sourceInstallCommand,
      sourceUrl: entry.sourceUrl,
    })
    .onConflictDoUpdate({
      target: skills.slug,
      set: {
        name: entry.name,
        description: entry.description,
        tags: entry.tags,
        sourceRepo: entry.sourceRepo,
        sourceSkillName: entry.sourceSkillName,
        sourceInstallCommand: entry.sourceInstallCommand,
        sourceUrl: entry.sourceUrl,
        updatedAt: new Date(),
      },
    });

  console.log(`[seed-referenced] ✓ ${entry.slug}`);
}

console.log('[seed-referenced] done');
```

---

## package.json 追加

根 `package.json`：

```json
{
  "scripts": {
    "seed:owned": "bun scripts/import-owned.ts",
    "seed:referenced": "bun scripts/seed-referenced.ts",
    "seed:all": "pnpm seed:referenced && echo '--- now run seed:owned manually with --dir path ---'"
  }
}
```

`apps/api/package.json` 追加依赖：

```json
{
  "dependencies": {
    "gray-matter": "^4.0.3"
  }
}
```

## 测试

文件：`scripts/import-owned.test.ts`

```ts
describe('import-owned', () => {
  beforeEach(async () => {
    // 清库
  });

  it('扫描目录，发现 SKILL.md 的子目录', async () => {
    // 建临时目录，放 2 个 skill 子目录 + 1 个无 SKILL.md 的子目录
    // 调用扫描函数，期望找到 2 个
  });

  it('拒绝 frontmatter 缺少 name 或 description', async () => {});

  it('拒绝非法 slug', async () => {});

  it('拒绝 path 包含 ".." 的文件', async () => {});

  it('第二次执行相同 dir 是 upsert', async () => {
    // 运行两次，DB 里仍然只有 1 条 skills 记录
    // 但 updatedAt 更新了
  });

  it('拒绝把 referenced slug 改成 owned', async () => {
    // 先 seed 一个 referenced 'frontend-design'
    // 再 import 一个 slug 也叫 frontend-design 的 owned，应该报错
  });

  it('--dry-run 不写入 DB', async () => {});
});
```

文件：`scripts/seed-referenced.test.ts`

```ts
describe('seed-referenced', () => {
  it('批量录入 4 个 referenced skill', async () => {});
  it('幂等：重复执行结果一致', async () => {});
  it('拒绝把 owned slug 改成 referenced', async () => {});
});
```

## 验收标准

- [ ] 两个脚本的单元测试全部通过
- [ ] `pnpm seed:referenced` 成功，`SELECT * FROM skillhub.skills WHERE type='referenced'` 看到 4 条
- [ ] `pnpm seed:owned -- --dir /mnt/skills/user` 成功（或用 Zeo 指定的路径），看到 5 条 owned skill
- [ ] 完成后总数：`SELECT COUNT(*) FROM skillhub.skills` = 9
- [ ] 访问 http://localhost:3333/api/skills 返回 9 个 item
- [ ] 访问 http://localhost:3333/.well-known/agent-skills/index.json 返回 5 个（只 owned+public）
- [ ] 每个 owned skill 在 skill_files 表里至少有一条 path='SKILL.md' 的记录

## 反例

- 不要做"从 GitHub URL 导入 owned skill"的功能（Phase 1 的事）
- 不要做交互式 CLI（`inquirer` / `prompts`）。Phase 0 用命令行参数就够。
- 不要引入 `commander` / `yargs`，简单解析 `process.argv` 即可（Bun 支持 `Bun.argv`）
- 不要让脚本默认 import 到 `internal` visibility——默认必须是 `public`（Phase 0 手动覆盖为 internal 需要显式参数）
- 不要在脚本里连接除了 `DATABASE_URL` 之外的任何数据源（Phase 0 不联网，referenced 元数据就在 JSON 里）
