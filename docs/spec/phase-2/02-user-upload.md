# Phase 2 · Spec 02 · User Upload + Author Namespace

> 依赖：01-visibility-cleanup（visibility 已是 public/private）
> 产出：mozia-sso 登录用户能在前端发布 owned skill；slug 改为 `<owner>/<skill>` 命名空间；前端有 `/publish` 表单和 `/u/:owner` 作者页；已有数据迁移到 `mozia/<old-slug>`。

---

## 一、目标

让 SkillHub 从"工程师 PR + seed JSON"的 distribution channel，升级为"任何 mozia-sso 用户能自助上传 skill"的个人 skill 仓库（git 风格）。

**Before**：
- 9 条 owned + referenced skill 全部由 `pnpm seed:all` 灌入
- `skills.slug` 全局唯一（`project-mental-map`、`frontend-design` 等）
- API 只读：`GET /api/skills`、`GET /api/skills/:slug`

**After**：
- mozia-sso 用户在 `/publish` 自助创建 owned skill
- slug 命名空间：`<owner>/<slug>`（例：`mozia/project-mental-map`、`zeo/my-helper`）
- 已存在的 9 条 seed 数据自动归到 `mozia` owner 下，URL 从 `/skills/<slug>` 自动 302 到 `/skills/mozia/<slug>`
- API 增加 CRUD：POST/PUT/DELETE
- 详情页有作者名 + 链到 `/u/<owner>`
- 上传时可选 visibility = public 或 private

## 二、架构决策

### 决策 1：owner 用虚拟 user 表示"机构身份"，不引入 organization 表

`mozia` 这个 owner 在 user 表里是一行特殊记录（`is_virtual=true`），不能登录、不绑 SSO。Mozia 团队用各自 SSO 账户登录后，靠**显式权限**（`can_publish_as`）去发布 `mozia/<slug>` 的 skill。

为什么不建 organization 表：
- Phase 2 只需要"Mozia 第一方"和"用户个人"两类 owner，没有第三种聚合需求
- organization 引入会带来 membership / role / billing 一整套，YAGNI
- 后续真有第三方机构需求（matrix 团队？mclaw 团队？），再升级 schema 不晚

### 决策 2：owner 标识用 SSO `name`（不是 email、不是 sub）

URL `/u/<owner>` 里的 `<owner>` 取 user 的 `name` 字段（来自 SSO `displayName` / `preferred_username`），原因：
- 短、可读、对用户友好
- email 太长且包含 `@` 会复杂化 URL 解析
- sub 是 UUID，不可读

**约束**：name 必须满足 `^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$`（lowercase, 1-32 chars, 数字字母连字符），不满足的用户首次发布前会被引导改名（在 `/settings/profile`）。

**唯一性**：`user.name` 加 unique 约束（小写归一化后）。

### 决策 3：旧 slug → 不做长期 redirect 兼容

`/skills/<slug>` 旧 URL **临时**支持（302 → `/skills/mozia/<slug>`），加 deprecation header；3 个月（Phase 3 节奏）后删。

`npx skills add http://skillhub --skill <slug>`（无 owner 前缀）也保留，well-known endpoint 默认按 `mozia/<slug>` 解析。

### 决策 4：上传支持单 SKILL.md 文件 + 后续追加 attachments

MVP 只支持创建时贴 SKILL.md 内容（textarea），不做多文件批量上传。后续要加 references/、assets/ 等附属文件，走 `POST /api/skills/:owner/:slug/files/:path` 单文件接口，前端可以一个一个加。

### 决策 5：visibility 默认 `private`，发布时显式确认 public

减少误操作风险——用户写完 SKILL.md 想先存草稿测试，不会一手滑就公开。public 复选框旁边给"将向所有访客可见"的明确文案。

### 决策 6：编辑权限严格——只有 owner 自己能改自己的 skill

不引入 collaborator / write access 概念。`mozia/<slug>` 只有具有 `can_publish_as_mozia` 权限的用户能改。

## 三、数据模型变动

### Migration `0003_user_upload.sql`

```sql
-- 1) user 表扩字段
ALTER TABLE skillhub."user"
  ADD COLUMN is_virtual BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN can_publish_as TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- name 加唯一约束（lowercase 归一化）
CREATE UNIQUE INDEX user_name_lower_idx ON skillhub."user" (LOWER(name));

-- name 加正则约束
ALTER TABLE skillhub."user"
  ADD CONSTRAINT user_name_format
  CHECK (name ~ '^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$' OR LENGTH(name) <= 1);

-- 2) 插入 mozia 虚拟用户
INSERT INTO skillhub."user" (id, name, email, email_verified, is_virtual, created_at, updated_at)
VALUES ('mozia-virtual', 'mozia', 'team@mozia.local', true, true, NOW(), NOW());

-- 3) skills 加 owner_user_id
ALTER TABLE skillhub.skills
  ADD COLUMN owner_user_id TEXT REFERENCES skillhub."user"(id) ON DELETE RESTRICT;

-- 历史数据全部归到 mozia
UPDATE skillhub.skills SET owner_user_id = 'mozia-virtual';

-- 现在可以加 NOT NULL
ALTER TABLE skillhub.skills ALTER COLUMN owner_user_id SET NOT NULL;

-- 4) slug 唯一性从全局换成 (owner_user_id, slug) 复合唯一
DROP INDEX IF EXISTS skillhub.skills_slug_idx;
CREATE UNIQUE INDEX skills_owner_slug_idx ON skillhub.skills (owner_user_id, slug);

-- 5) referenced skill 也归到 mozia 下（这些是团队精选引用）
-- 已经在 step 3 做了；referenced skill 的 owner = mozia 表示"由 Mozia 团队精选并引用"
```

### Drizzle schema 同步

```ts
// auth-schema.ts
export const user = skillhubSchema.table('user', {
  // ... existing
  isVirtual: boolean('is_virtual').notNull().default(false),
  canPublishAs: text('can_publish_as').array().notNull().default(sql`ARRAY[]::text[]`),
});

// schema.ts
export const skills = skillhubSchema.table('skills', {
  // ... existing
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'restrict' }),
}, (t) => [
  uniqueIndex('skills_owner_slug_idx').on(t.ownerUserId, t.slug),
  // 删 skills_slug_idx
]);
```

## 四、API 契约变动

### 新增端点

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| `POST` | `/api/skills` | 创建 owned skill；body 含 owner、slug、name、description、tags、visibility、skillMdContent | 需登录 + 自己是 owner（普通 case）或 owner ∈ canPublishAs |
| `PUT` | `/api/skills/:owner/:slug` | 更新 metadata + SKILL.md 内容 | 同上 |
| `DELETE` | `/api/skills/:owner/:slug` | 删除 skill 及其 files（CASCADE） | 同上 |
| `POST` | `/api/skills/:owner/:slug/files/:path` | 上传 / 替换附属文件（路径如 `references/foo.md`）；body = raw text | 同上 |
| `DELETE` | `/api/skills/:owner/:slug/files/:path` | 删除附属文件（不能删 SKILL.md） | 同上 |
| `GET` | `/api/users/me` | 当前登录用户基本信息（含 canPublishAs） | 需登录 |
| `GET` | `/api/users/me/skills` | 当前用户所有 skill（含 private） | 需登录（**或** PAT，03 spec） |
| `GET` | `/api/users/:owner/skills` | 公开用户的 public skill 列表 + 该用户 displayName / image | 无需登录 |
| `PATCH` | `/api/users/me/profile` | 更新当前用户的 name（首次发布前可能要求改名） | 需登录 |

### 改动端点

| 路径 | 改动 |
|---|---|
| `GET /api/skills` | 路由签名不变；返回 items 里多 `owner: { name, image }`；查询时 visibility=private 的只对 owner 自己出现 |
| `GET /api/skills/:slug` | **保留**作为 legacy 兼容路径，内部转发到 `mozia/<slug>` 并 302 |
| **新增** `GET /api/skills/:owner/:slug` | 取代上一条；正规路径 |
| `GET /.well-known/agent-skills/index.json` | `name` 必须保持 CLI 可接受格式：`mozia` owner 使用 `<slug>`，其他 owner 使用 `<owner>-<slug>-<hash>`；不返回 `<owner>/<slug>` alias |
| `GET /.well-known/agent-skills/:owner/:slug/SKILL.md` | 新格式；旧 `/.well-known/agent-skills/:slug/SKILL.md` 自动按 `mozia/:slug` 查 |

### DTO 形状（关键）

```ts
// 新增 zod schema in lib/dto.ts

export const slugSegmentSchema = z.string().regex(/^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/);

export const createSkillSchema = z.object({
  owner: slugSegmentSchema,             // 必填，对应 user.name
  slug: slugSegmentSchema,
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  visibility: z.enum(['public', 'private']).default('private'),
  skillMdContent: z.string().min(20).max(200_000),  // 20 字符底线、200KB 上限
  frontmatter: z.record(z.unknown()).optional(),    // 可选；不传则从 SKILL.md 自动 parse
});

export const updateSkillSchema = createSkillSchema
  .omit({ owner: true, slug: true })
  .partial();
```

## 五、前端变动

### 新页面

| 路径 | 内容 |
|---|---|
| `/publish` | 发布表单：owner 下拉（自己 + canPublishAs 列出的虚拟 owner）、slug、name、description、tags（chips 输入）、visibility 单选（默认 private + 提示文案）、SKILL.md textarea（带 monospace + 行号）、底部 Preview + Submit 双按钮 |
| `/u/:owner` | 作者页：头像 + name + skill 数；下面是 skill 列表（仅 public，但如果 viewer === owner 自己也展示 private 标记的）；空状态："这个用户还没发过 skill" |
| `/settings/profile` | 编辑 name + 显示 SSO email（不可改）+ canPublishAs 列表（只读） |

### 改动页面

| 路径 | 改动 |
|---|---|
| `/`（列表）| skill row 多一列"by `<owner>`"；点 owner 跳 `/u/:owner` |
| `/skills/:slug` | 改为 `/skills/:owner/:slug`；旧 URL 加重定向 |
| layout.tsx 顶栏 | 登录后多一个"Publish"按钮（链到 `/publish`）+ "我的 skill"快捷入口 |

### 复用组件

- `<InstallCommand>`：详情页的安装命令展示，不变
- `<SkillRow>`：加 `owner` prop，row 里多一列
- 新增 `<SkillForm>`：上面 `/publish` 用；编辑模式（`/skills/:owner/:slug/edit`，仅 owner）也用

## 六、权限矩阵

| 操作 | 匿名 | 登录用户 X | X 是 skill owner | X 在 canPublishAs 含 owner |
|---|---|---|---|---|
| 看 public skill 详情 | ✓ | ✓ | ✓ | ✓ |
| 看 private skill 详情 | ✗ (404) | ✗ (404) | ✓ | ✗ |
| 列表中出现 private skill | ✗ | ✗ | ✓（自己的） | ✗（不出现别人的） |
| 创建 skill at `<owner>/<slug>` | ✗ | 仅当 owner=X.name | ✓ | ✓ |
| 编辑 / 删除 | ✗ | ✗ | ✓ | ✓ |
| 上传文件 | ✗ | ✗ | ✓ | ✓ |

## 七、实现步骤

1. **migration** `0003_user_upload.sql`（手写）
2. **schema.ts / auth-schema.ts** 改动
3. **service 层**：`skill-service.ts` 加 `createSkill / updateSkill / deleteSkill / addFile / removeFile`；改 `listSkillsForApi` / `findSkillBy` 接受 `viewerUserId` + 按 (owner, slug) 查
4. **route 层**：`routes/api.ts` 加 8 个新 endpoint；旧 `/api/skills/:slug` 走 302 兼容；加 zod 校验
5. **well-known**：`routes/wellknown.ts` 使用 CLI-safe protocol name 解析，避免 `owner/slug` 进入 index `name`
6. **DTO**：`lib/dto.ts` 加 createSkill / updateSkill / userPublic / skillListItemWithOwner schemas
7. **前端 routes**：新增 `publish.tsx`、`user.tsx`（`/u/:owner`）、`settings-profile.tsx`；改动 `skill-detail.tsx`、`skills-list.tsx`、`layout.tsx`
8. **前端 hooks**：新增 `useCurrentUser` / `useMyTokens` 等；扩 `useSkills` 接收 owner 过滤
9. **测试**：`api.test.ts` 大改（按 owner+slug + viewer 鉴权重写所有 case）
10. **seed 脚本**：`seed-owned.ts` 默认把所有 owned 归到 `mozia` owner；`scripts/owned-skills.json` 加 `owner: 'mozia'` 字段
11. **smoke**：脚本里所有 `/api/skills/<slug>` 改成 `/api/skills/mozia/<slug>`

## 八、测试

### service 层单测

- `createSkill` happy path（slug 合法、frontmatter parse 出来）
- `createSkill` 拒绝：slug 已存在、name 不合法、SKILL.md 太短/太长
- `updateSkill` 只能 owner 自己调（否则抛 PermissionDenied）
- `listSkillsForApi` 匿名只看 public、登录看 public + 自己 private
- `findSkillBy(owner, slug)` 找到 / 找不到 / private 但 viewer 是 owner

### route 层（需 better-auth 测试 mock）

- `POST /api/skills` 未登录 → 401
- `POST /api/skills` 登录但 owner != self → 403
- `POST /api/skills` happy path → 201 + 返 detail
- `PUT /api/skills/:owner/:slug` 非 owner → 403
- `DELETE /api/skills/:owner/:slug` happy path → 204；files 也被 cascade 删了
- `GET /api/users/me/skills` 含自己的 private
- `GET /api/users/:owner/skills` 不含 private
- `GET /api/skills/<old-slug>` 没 owner 前缀 → 302 到 `mozia/<old-slug>`

### 端到端（smoke 加章节）

- 创建 skill → 列表里出现 → 详情页正确 → install 命令可用 → 删除 → 列表里消失

## 九、配置

无新增 env。

## 十、验收

**自动化：**
- [ ] typecheck / lint / test 全绿
- [ ] smoke 通过

**手动 demo（对应 overview 的 Demo A）：**
- [ ] 用 mozia-sso 登录 → 顶栏出现 "Publish"
- [ ] `/publish` 写一条 `zeo/test-helper`，visibility=private，提交
- [ ] 列表（首页）匿名打开**不出现** `zeo/test-helper`
- [ ] 在 `/u/zeo` 自己看能看到（带 private 标记）
- [ ] 详情页点 "Edit" 能改；改完保存生效
- [ ] 详情页点 "Delete" 能删；DB 里 skill 和 files 都被 CASCADE 删掉
- [ ] 老 URL `/skills/project-mental-map` 跳到 `/skills/mozia/project-mental-map`
- [ ] `npx skills add http://localhost:3333 --skill project-mental-map --agent claude-code -y` 仍能装（well-known 兜底）

## 十一、不做（明确推后）

- ❌ 多文件批量上传 UI（追加单文件 endpoint 已就位，UI 推后）
- ❌ skill 编辑历史（version / 草稿 / 比较 diff）
- ❌ collaborator（让别人编辑你的 skill）
- ❌ Markdown live preview（`/publish` MVP 只有提交后 preview）
- ❌ 拖拽上传（textarea 粘贴足够）
- ❌ private skill 通过 CLI 安装的 capability URL —— 见 03 spec
- ❌ Frontmatter 字段的结构化编辑器（裸文本就行）
