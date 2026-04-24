# Phase 2 · Spec 01 · Visibility Cleanup

> 依赖：Phase 1 已完成（auth + 当前 internal 鉴权代码）
> 产出：visibility enum 简化为 `('public', 'private')`，删除所有 `internal` 残留代码 + 数据迁移；为 02-user-upload 让路。

---

## 一、目标

把 visibility 模型从"`public` / `internal`"换成"`public` / `private`"，对齐 git 仓库范式。

**Before**（Phase 1 收尾状态）：
- enum: `('public', 'internal')`
- internal skill 仅 mozia-members（或 `__org:mozia__` 等虚拟组）可见
- DB 里有 1 条 seed 演示数据 `internal-rfc-writer`

**After**（Phase 2 入口状态）：
- enum: `('public', 'private')`
- public = 任何人可见可装；private = 仅 owner 可见可装
- 旧 internal 数据 → 迁成 public（理由：这些原本就是 Mozia 团队 owned skill，公开化符合"第一信息源 + 软宣传"定位）
- `INTERNAL_GROUPS` env、`canSeeInternal` 鉴权分支、相关测试 mock 全部清理

## 二、架构决策

### 决策 1：迁数据，不删表

`skills.visibility` 列保留，只换 enum 值集合。02 spec 会在此基础上加 `owner_user_id` 列，到时一并形成完整的"作者 + 可见性"模型。

### 决策 2：旧 internal → 全部转 public，不留兼容期

理由：
- 现存 internal 数据只有 1 条 seed 演示（`internal-rfc-writer`），不是真实业务数据
- 真实部署后无 production user 依赖 internal 语义（Phase 1 实际只跑了几天 demo）
- private 概念和 internal 语义本质不同（前者按 owner、后者按 group），不能机械"internal → private"

### 决策 3：rename `INTERNAL_GROUPS` → 删除（不是改名）

`INTERNAL_GROUPS` 这个 env 设计的目的是"哪些 SSO group 算内部"，新模型里没有 group 概念，env 直接删除。

### 决策 4：`getAuthContext` 只返用户身份，不返判定结果

```ts
// Before (Phase 1)
{ user, groups, canSeeInternal }
// After (Phase 2)
{ user }
```

把"能不能看到这条 skill"的判定从 context helper 里移除，转移到 service 层（service 知道当前请求者是谁 + 这条 skill 的 owner / visibility，自己判）。

## 三、数据迁移

### Drizzle migration（手写）

drizzle-kit 不支持自动 RENAME enum value，必须手写 SQL。

```sql
-- 1) 加 'private' 到现有 enum
ALTER TYPE skillhub.visibility ADD VALUE 'private';

-- 2) 把所有 internal 数据迁成 public
UPDATE skillhub.skills SET visibility = 'public' WHERE visibility = 'internal';

-- 3) 重建 enum 把 'internal' 去掉（postgres 不允许直接 DROP VALUE）
ALTER TYPE skillhub.visibility RENAME TO visibility_old;
CREATE TYPE skillhub.visibility AS ENUM ('public', 'private');
ALTER TABLE skillhub.skills ALTER COLUMN visibility TYPE skillhub.visibility
  USING visibility::text::skillhub.visibility;
DROP TYPE skillhub.visibility_old;
```

文件：`apps/api/drizzle/0002_visibility_public_private.sql`（手写 + 加进 `_journal.json`）

### Drizzle schema 同步

`apps/api/src/db/schema.ts`:

```ts
- export const visibilityEnum = skillhubSchema.enum('visibility', ['public', 'internal']);
+ export const visibilityEnum = skillhubSchema.enum('visibility', ['public', 'private']);
```

### Seed 数据更新

`scripts/owned-skills.json` 里 `internal-rfc-writer` 的 `visibility` 字段：

```diff
- "visibility": "internal",
+ "visibility": "public",
```

跑 `pnpm seed:all` 重 upsert，验证迁移后数据正确。

## 四、代码清理清单

按文件分组，每条都要删/改：

### `apps/api/src/lib/auth-context.ts`

```diff
export interface AuthContext {
  user: { id: string; email: string; name: string; ssoSub: string | null } | null;
- groups: string[];
- canSeeInternal: boolean;
}

- const internalGroupsEnv = () => process.env.INTERNAL_GROUPS ?? 'mozia-members';
- const parseInternalGroups = (): string[] => ...
- export function computeCanSeeInternal(...) { ... }

export async function getAuthContext(c: Context): Promise<AuthContext> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
- if (!session?.user) return { user: null, groups: [], canSeeInternal: false };
+ if (!session?.user) return { user: null };
  const u = session.user as { id: string; email: string; name: string; ssoSub?: string | null };
- const groups = ...
- const canSeeInternal = ...
- return { user: { id: u.id, ... }, groups, canSeeInternal };
+ return { user: { id: u.id, email: u.email, name: u.name, ssoSub: u.ssoSub ?? null } };
}
```

### `apps/api/src/lib/auth.ts`

```diff
- // Vite dev origin proxies /api → :3333... trustedOrigins ...
- const arrify = (v: unknown): string[] => ...
- const extractGroups = (profile: ...): string[] => { ... synthesize __org:xxx__ etc ... };
+ // arrify 和 extractGroups 都删除（用户身份足够，不再合成虚拟 group）

  mapProfileToUser: (profile) => ({
    ssoSub: str(profile.sub),
    email: ...,
    name: ...,
    image: ...,
-   groups: extractGroups(profile),
  }),
```

同时 user.additionalFields 里的 `groups: { type: 'string[]', ... }` 删除。

### `apps/api/src/db/auth-schema.ts`

```diff
export const user = skillhubSchema.table('user', {
  ...
  ssoSub: text('sso_sub'),
- groups: text('groups').array(),
  ...
});
```

migration 里加 `ALTER TABLE skillhub.user DROP COLUMN groups;`

### `apps/api/src/services/skill-service.ts`

`listSkillsForApi` / `listAllTags` 把 `includeInternal` 参数完全移除。Phase 2 service 层只接受 `viewerUserId`（or null for anon），按 owner+visibility 自己判。

```ts
export interface ListSkillsOptions {
  type: 'owned' | 'referenced' | 'all';
  q?: string;
  tags: string[];
- includeInternal: boolean;
+ viewerUserId: string | null;     // null = 匿名；非 null 时也能看到自己的 private
}
```

WHERE 子句：

```sql
-- 匿名 / 非作者：只看 public
visibility = 'public'

-- 登录用户：看所有 public + 自己的 private
visibility = 'public' OR (viewerUserId IS NOT NULL AND owner_user_id = viewerUserId)
```

注：`owner_user_id` 列在 02 spec 里加，01 阶段先用 `visibility = 'public'` 简单条件（此时数据全是 public）。

### `apps/api/src/routes/api.ts`

```diff
- const { canSeeInternal } = await getAuthContext(c);
- const rows = await listSkillsForApi({ ..., includeInternal: canSeeInternal });
+ const { user } = await getAuthContext(c);
+ const rows = await listSkillsForApi({ ..., viewerUserId: user?.id ?? null });
```

`/skills/:slug` 同理；`internal && !canSeeInternal → 404` 这条改成"private && viewer != owner → 404"（02 spec 里完整实现，01 先简化为：visibility 不是 'public' 就 404）。

### `apps/api/src/routes/api.test.ts`

测试 mock 的 `getAuthContext` 形状改成新的；改测试用例：删除 mozia-members 相关 case，改成"匿名 vs 登录"两种身份。

具体 case 重命名：
- `mozia-members session sees internal skills` → 删除（internal 不存在了）
- `non-mozia session does not see internal skills` → 删除
- `internal skill returns 404 for anonymous user` → 改为"private skill 404 to non-owner"（02 实现后再写）
- `client cannot use ?includeInternal=true to bypass auth` → 删除（query 参数本来就没了）
- 新增：`anon sees only public skills`（trivial，所有现存 seed 都是 public，列表全可见）

### `apps/api/src/lib/auth-context.test.ts`

整个文件删除（`computeCanSeeInternal` 没了）。

### `apps/api/src/lib/dto.ts`

无变动（`includeInternal` 早已删除）。

### `apps/api/.env.example`

```diff
- # Comma-separated identity tokens that grant "view internal skills"...
- INTERNAL_GROUPS=mozia-members
```

### `apps/api/.env`（本地）

```bash
sed -i '' '/^INTERNAL_GROUPS=/d' apps/api/.env
```

### `scripts/smoke.sh`

把"includeInternal"相关断言全删除，改成"匿名能看到所有 seed（因为现在全是 public）"。

## 五、实现步骤

1. 写 migration `0002_visibility_public_private.sql`
2. 改 schema.ts 和 auth-schema.ts
3. `pnpm db:generate` 检查没生成新的 diff（如果生成了就把 0002 调整对齐）
4. `pnpm db:migrate` 执行
5. 改 auth.ts、auth-context.ts、skill-service.ts、routes/api.ts
6. 改 seed JSON + `pnpm seed:all`
7. 改 / 删测试，跑 `pnpm typecheck && pnpm lint && pnpm test`
8. 跑 smoke

## 六、验收

**自动化：**
- [ ] `pnpm typecheck` / `pnpm lint` 通过
- [ ] `pnpm test` 通过（测试已按新 mock 改完）
- [ ] `bash scripts/smoke.sh` 通过

**手动：**
- [ ] DB 里 `SELECT DISTINCT visibility FROM skillhub.skills` 返回只有 `public`
- [ ] DB 里 `SELECT typname, enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'visibility'` 返回 `(public, private)`
- [ ] `apps/api/src/lib/auth.ts` grep `groups`、`extractGroups`、`__org:`、`__sso-admin__` 应该全部无匹配
- [ ] `apps/api/.env` 里没有 `INTERNAL_GROUPS`
- [ ] 浏览器匿名访问首页能看到全部 9 条 seed skill（之前的 internal-rfc-writer 现在公开可见）
- [ ] 详情页 `internal-rfc-writer` 显示 visibility = public

## 七、反例

- ❌ 不要保留 `internal` 作为 enum 历史值"以防万一"——一并清理干净
- ❌ 不要把 `internal` 数据迁成 `private`（语义不对，private 需要 owner，迁过去会变成"无主 private"= 谁都看不到）
- ❌ 不要在 01 这步就把 `owner_user_id` 加上——schema 改动留给 02 一次完成，避免来回改
- ❌ 不要保留 `groups` 列在 user 表里"以备后用"——真要用再加，YAGNI
