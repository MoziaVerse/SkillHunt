# Phase 1 · Spec 01 · Auth with mozia-sso

> 依赖：Phase 0 全部 + mozia-sso (`:8778`) 本机/线上可用
> 产出：better-auth + OIDC 接入 mozia-sso；`internal` visibility skill 只对 Mozia 成员可见（浏览器场景），公开 skill 零影响

> **状态：已实现** — Phase 1-01 已落到 SkillHub 主分支；mozia-sso 侧改动详见 [`mozia-sso/docs/skillhub-onboarding.md`](../../../../mozia-sso/docs/skillhub-onboarding.md)（分支 `feat/skillhub-onboarding-doc`）。
>
> **实现与本 spec 的偏差**（已落地版本）：
> - **groups 存到 `skillhub.user.groups` 而非 `session.additionalFields`**。better-auth 在每次 OAuth 登录都执行 `mapProfileToUser`，user 行被刷新，与 7 天 session 的过期窗口等价；放 user 表省去 `databaseHooks.session.create.before` 的额外 hook。
> - **未实现 `apps/api/test-support/mock-sso.ts`**。改用 `bun:test` 的 `mock.module()` 在 `routes/api.test.ts` 顶部把 `getAuthContext` 替换成读 `x-test-auth-groups` header 的 fake。auth-context 的纯逻辑通过 `computeCanSeeInternal` 单独单测。整套 OIDC 端到端待真做协同方案再加 mock-sso。
> - **callback URL = `/api/auth/oauth2/callback/mozia-sso`**（better-auth genericOAuth 的实际路径），spec 之前写的 `/api/auth/callback/mozia-sso` 仅为 Phase 0 设想。
> - **better-auth 版本**：`^1.6.7`（peer dep `better-call` 期望 zod@4，本仓库 zod@3，不影响运行）。

---

## 一、目标

把 Phase 0 留在 schema 里的 `visibility: internal` 字段从"字段就位但没人校验"升级为"真正的访问控制"。

**Before**（Phase 0 现状）：

- 所有 `/api/skills`、`/.well-known/*`、前端列表——internal skill 都暴露
- 前端 `includeInternal=true` 由客户端说了算（任何人能看）
- `/.well-known` 已经正确 filter 掉 internal（protocol 那侧合规），但 business API 裸奔

**After**（Phase 1-01 完成后）：

- 未登录 / 非 Mozia 成员：看不到 internal skill（列表、详情、well-known 一致）
- Mozia 成员：登录后能看 internal skill（浏览器场景）
- 公开 skill 对外行为 100% 不变，`npx skills add http://skillhub/...` 依然零配置能装 public + owned skill
- CLI 装 internal skill **暂不支持**（留到 Phase 2 的 PAT spec）

---

## 二、架构决策

### 决策 1：对齐 matrix，用 better-auth + generic OIDC provider

matrix 已经趟过这条路（`backend/src/lib/better-auth.ts`）。SkillHub 不另起炉灶：

- `better-auth` 提供 session / user / account 三张表 + Hono 集成
- 用 better-auth 的 **generic OIDC provider** 指向 mozia-sso (Casdoor) 的标准 OIDC endpoints
- 前端 `<a href="/api/auth/signin/mozia-sso">` 就是登录入口

### 决策 2：`internal` 判定 = 有效 session + group claim 包含 `mozia-members`

- OIDC token 里读 `groups` claim（Casdoor 配置）
- 把"允许看 internal 的组名"做成配置项（`INTERNAL_GROUPS`），默认 `mozia-members`，避免写死
- 没有 session → 视为未登录 → 只看 public
- 有 session 但 group 不含 → 还是只看 public（静默降级，不 403）

### 决策 3：Phase 1 不做 CLI token

`npx skills add http://.../ --skill <internal>` 这条路需要 opaque PAT（personal access token）—— 多一张表、多一套 UI、多一套 rotation 策略。Phase 1 不做，内部 skill 通过浏览器访问就够了；真正的 CLI 需求等 mclaw 集成（协同方案里的第 2 条）要远程拉再实现。

### 决策 4：公开接口零改动

- `GET /.well-known/agent-skills/index.json` — 无鉴权，只返 public owned（Phase 0 行为完全保留）
- `GET /.well-known/agent-skills/:slug/*` — 无鉴权，只服务 public owned（Phase 0 行为完全保留）
- `GET /api/skills?type=referenced` — 无鉴权（referenced 天然公开）
- `GET /api/skills` 默认 — 无鉴权，automatically excludes internal（就像 Phase 0）

**唯一改动**：客户端不能再通过 `?includeInternal=true` 绕过——这个 flag 服务端**改为忽略**，真正决定权 = session group。

---

## 三、数据模型变动

在 Phase 0 的 schema 基础上**只加 better-auth 四张表**，不动 `skills` / `skill_files`。

```
skillhub.user          (better-auth 管理：id, email, name, image, created_at, updated_at, sso_sub)
skillhub.session       (token, user_id, expires_at, ip_address, user_agent, created_at)
skillhub.account       (provider_id='mozia-sso', account_id=sso_sub, user_id, access_token, id_token, expires_at, ...)
skillhub.verification  (identifier, value, expires_at)
```

better-auth CLI 会自动 generate 这些表的 Drizzle schema。把它们放到 `apps/api/src/db/auth-schema.ts`，从主 schema.ts re-export。

**关键字段**：`user.sso_sub`（Casdoor 颁发的 sub，唯一身份）——后续所有"这个 skill 是谁的"逻辑都用它。

**不加**：`skills.owner_sso_sub`（留 Phase 2 的 private skill spec 再加）、`group_memberships` 表（group 信息从 OIDC token 现取，不存库，避免同步地狱）。

---

## 四、认证流程

### 浏览器登录（sequence）

```
User → SkillHub web: 点 "Sign in"
SkillHub web → SkillHub api: GET /api/auth/signin/mozia-sso
SkillHub api → mozia-sso: 302 redirect 带 client_id + redirect_uri + state + code_challenge
mozia-sso: 用户登录 Casdoor
mozia-sso → SkillHub api: 302 /api/auth/callback/mozia-sso?code=...&state=...
SkillHub api → mozia-sso: POST /api/login/oauth/access_token (code → token)
SkillHub api → mozia-sso: GET /api/userinfo (带 access_token)
SkillHub api: upsert user (按 sso_sub), create session, set cookie
SkillHub api → SkillHub web: 302 /
```

### 请求时鉴权

```
Browser → SkillHub api: GET /api/skills  (Cookie: better-auth.session=...)
SkillHub api:
  session = await auth.api.getSession(cookie)
  if session:
    groups = session.user.groups     ← 已在 signin 时从 OIDC userinfo 存入 session
    canSeeInternal = groups.includes('mozia-members')
  else:
    canSeeInternal = false
  → listSkillsForApi({ includeInternal: canSeeInternal, ... })
```

### OIDC claim 存到哪儿

better-auth 的 `session.user` 是 "user 表的行"。group 是运行时从 userinfo 拿的，不能塞进 user 表（组织关系会变）。两个做法：

- **A（轻）**：登录时把 groups 写进 `session` 表的 extension 字段（better-auth 支持 additionalFields），session 存活期内有效
- **B（严）**：每次请求都现调 mozia-sso 的 userinfo

选 **A**。session 默认 7 天，组织关系变动 7 天内生效够快；B 会让 mozia-sso 变成 SkillHub 每个请求的瓶颈。

---

## 五、API 契约变动

### 新端点（better-auth 自动挂载）

| 方法 | 路径                                    | 说明                        |
| ---- | --------------------------------------- | --------------------------- |
| GET  | `/api/auth/signin/mozia-sso`            | 发起登录                    |
| GET  | `/api/auth/callback/mozia-sso`          | OIDC 回调                   |
| POST | `/api/auth/signout`                     | 登出                        |
| GET  | `/api/auth/session`                     | 当前 session 信息（前端 polling 用） |

### 改动端点

| 路径                      | 改动                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| `GET /api/skills`         | 忽略客户端传的 `?includeInternal`，由 session group 决定。未登录或非 mozia 成员永远看不到 internal |
| `GET /api/skills/:slug`   | 如果 skill 是 owned+internal 且调用方不是 mozia 成员 → 404（**不 403**，避免枚举） |
| `GET /api/tags`           | tag 来源只数非 internal 的 skill（避免 internal skill 的独占 tag 泄露元信息）    |

### 零改动端点

- `GET /healthz`
- `GET /.well-known/agent-skills/*`（已经正确只 serve public + owned）

---

## 六、实现步骤

### 6.1 装依赖（apps/api）

```json
{
  "dependencies": {
    "better-auth": "^1.0.0"
  }
}
```

better-auth 不需要额外 OIDC library，generic OIDC provider 是内置的。

### 6.2 生成 auth schema

```bash
cd apps/api
pnpm dlx @better-auth/cli generate --config ./src/lib/auth.ts --output ./src/db/auth-schema.ts
```

产出 `auth-schema.ts`（user / session / account / verification 四张表的 drizzle 定义）。把它们加到 `skillhub` pgSchema 里（手动微调 CLI 输出），re-export 到 `db/index.ts`。

### 6.3 `apps/api/src/lib/auth.ts`

```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth } from 'better-auth/plugins';
import { db } from '../db';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: 'mozia-sso',
          clientId: process.env.OIDC_CLIENT_ID!,
          clientSecret: process.env.OIDC_CLIENT_SECRET!,
          discoveryUrl: `${process.env.OIDC_ISSUER}/.well-known/openid-configuration`,
          scopes: ['openid', 'profile', 'email', 'groups'],
          // 把 groups claim 存到 session.user 的 additional field
          mapProfileToUser: (profile) => ({
            ssoSub: profile.sub,
            email: profile.email,
            name: profile.name ?? profile.preferred_username,
            image: profile.picture,
          }),
        },
      ],
    }),
  ],
  session: {
    additionalFields: {
      groups: { type: 'string[]', required: false },
    },
  },
  // 登录成功的 hook：把 groups 写进 session
  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path.startsWith('/callback/mozia-sso'),
        handler: async (ctx) => {
          // 从 OIDC userinfo 里拿 groups,写到 session
          // 具体 API 取决于 better-auth 版本,伪代码
          const groups = (ctx.context.user as { groups?: string[] }).groups ?? [];
          await db
            .update(sessions)
            .set({ groups })
            .where(eq(sessions.token, ctx.newSession!.token));
        },
      },
    ],
  },
});
```

### 6.4 `apps/api/src/lib/auth-context.ts`

```ts
import type { Context } from 'hono';
import { auth } from './auth';

const INTERNAL_GROUPS = (process.env.INTERNAL_GROUPS ?? 'mozia-members').split(',');

export async function getAuthContext(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return { user: null, canSeeInternal: false };

  const groups = (session.session as { groups?: string[] }).groups ?? [];
  const canSeeInternal = groups.some((g) => INTERNAL_GROUPS.includes(g));
  return { user: session.user, canSeeInternal };
}
```

### 6.5 改 `apps/api/src/routes/api.ts`

```ts
apiRoute.get('/skills', zValidator('query', listSkillsQuerySchema), async (c) => {
  const { type, q, tag } = c.req.valid('query');  // 去掉 includeInternal
  const { canSeeInternal } = await getAuthContext(c);
  const rows = await listSkillsForApi({ type, q, tags: tag, includeInternal: canSeeInternal });
  // ... 其余不变
});

apiRoute.get('/skills/:slug', async (c) => {
  const { canSeeInternal } = await getAuthContext(c);
  const skill = await findSkillBySlug(slug);
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  if (skill.type === 'owned' && skill.visibility === 'internal' && !canSeeInternal) {
    return c.json({ error: 'Not Found' }, 404);  // 不是 403
  }
  // ... 其余不变
});
```

### 6.6 改 `apps/api/src/index.ts`

```ts
import { auth } from './lib/auth';
// ...
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));
```

### 6.7 前端：登录状态显示 + sign in/out 按钮

改 `apps/web/src/routes/layout.tsx` 的 `TopNav`：

```tsx
const [session, setSession] = useState<Session | null>(null);
useEffect(() => { fetch('/api/auth/session').then(r => r.json()).then(setSession) }, []);

// 右侧 nav 里多一项：
{session?.user ? (
  <span className="font-mono text-[12.5px]">
    {session.user.name} · <a href="/api/auth/signout">signout</a>
  </span>
) : (
  <a href="/api/auth/signin/mozia-sso" className="...">Sign in</a>
)}
```

前端其他地方零改动——因为 `/api/skills` 响应过滤已经在后端完成，前端永远只拿到"它有权看到的"。

### 6.8 Zod DTO

`lib/dto.ts` 里 `listSkillsQuerySchema` **删除 `includeInternal` 字段**。

---

## 七、配置

`apps/api/.env.example` 追加：

```env
# OIDC against mozia-sso (Casdoor)
OIDC_ISSUER=http://localhost:8778
OIDC_CLIENT_ID=skillhub
OIDC_CLIENT_SECRET=<fill from mozia-sso admin>

# better-auth
BETTER_AUTH_URL=http://localhost:3333
BETTER_AUTH_SECRET=<openssl rand -hex 32>

# 哪些 mozia-sso group 视为"可看 internal"
INTERNAL_GROUPS=mozia-members
```

**mozia-sso 侧要做的准备工作** —— 已经写成手册：[`mozia-sso/docs/skillhub-onboarding.md`](../../../../mozia-sso/docs/skillhub-onboarding.md)（分支 `feat/skillhub-onboarding-doc`）。摘要：

- Casdoor 后台注册 application `skillhub`，redirect URIs：
  - `http://localhost:3333/api/auth/oauth2/callback/mozia-sso`（开发）
  - `https://skillhub.mzsjai.com/api/auth/oauth2/callback/mozia-sso`（生产）
- 建 group `mozia-members`（与 SkillHub `INTERNAL_GROUPS` 默认值对齐），把内部成员加入
- Casdoor 默认就在 JWT/userinfo 里返 `groups` claim（`object/token_jwt.go:146,297`），**不需要改 Go 源码**
- 把 Casdoor 给的 client_id / secret 填到 SkillHub `apps/api/.env` 的 `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET`

---

## 八、测试

### 新增单测

`apps/api/src/lib/auth-context.test.ts`：

- `getAuthContext` 无 cookie → `{ user: null, canSeeInternal: false }`
- 有 session 但 groups 空 → `canSeeInternal: false`
- groups 含 `mozia-members` → `canSeeInternal: true`
- `INTERNAL_GROUPS=ops-team` 时 `mozia-members` → `canSeeInternal: false`

### 修改 `routes/api.test.ts`

现有 `includeInternal=true exposes internal skills` 测试**改语义**：

- 无 session 且 query 带 `includeInternal=true` → **仍然只看到 non-internal**（证明 client 不能绕过）
- 模拟一个带 `mozia-members` group 的 session → 能看到 internal
- 模拟一个带 `customers` group 的 session → 看不到 internal

session mock：测试里直接用 `auth.api.signInEmail` 或注入 `Cookie` header，具体写法看 better-auth 测试文档。

### well-known test 不动

Phase 0 已经正确只 serve public+owned，auth 改动不触达该路径。

### 测试 fixture

有一份 mozia-sso **mock server**（Hono 起一个 dev-only 假 OIDC provider），放在 `apps/api/test-support/mock-sso.ts`。beforeAll 起 mock，OIDC_ISSUER 指向它。避免测试依赖真实 mozia-sso 实例。

---

## 九、验收

**自动化**：

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 通过（含新加的 auth-context + 修过的 api.test）
- [ ] `pnpm lint` 通过

**手动**：

- [ ] 无 cookie 访问 `/api/skills` 返 8 条（Phase 0 行为）
- [ ] 无 cookie 访问 `/api/skills?includeInternal=true` 仍然返 8 条（client 绕不过）
- [ ] 无 cookie 访问 `/api/skills/internal-rfc-writer` 返 404
- [ ] 浏览器访问 `/` → 右上 Sign in → Casdoor 登录 → 跳回 → 右上显示用户名
- [ ] 登录后（属 `mozia-members`）访问 `/api/skills` 返 9 条，`/api/skills/internal-rfc-writer` 返 200
- [ ] 登录后（不属 `mozia-members`，新建一个测试用户）访问 `/api/skills` 仍返 8 条
- [ ] `/.well-known/agent-skills/index.json` 无论登录与否都返 4 条（public owned）
- [ ] `npx skills add http://localhost:3333 --list` 依然工作

---

## 十、反例 / 不做

- ❌ 不做 CLI PAT（留 Phase 2）
- ❌ 不做 session 里存更多用户元信息（只 groups 够用）
- ❌ 不改 `skills` 表 schema
- ❌ 不用 access_token 每次现查 userinfo（群变化 7 天内生效够快）
- ❌ 不做"per-user 私有 skill"（留 Phase 2）
- ❌ internal skill 返 404 而非 403，避免枚举攻击
- ❌ 不给 `/.well-known` 加 bearer token 变种（Phase 2 PAT spec 里再考虑）
- ❌ 不做 `@better-auth/client` 前端包的深度集成（Phase 1 前端只读 `/api/auth/session`，没必要引一整套 client SDK）

---

## 工作量估计

约 3-4 个工作日：

- 0.5d：better-auth 接入 + schema generate + migration
- 1d：OIDC 回调 + session 写 groups + 对接本地 mozia-sso 的 mock
- 0.5d：改 `/api/skills`、`/api/skills/:slug`、`/api/tags` 三处
- 0.5d：前端 Sign in/out UI
- 1d：测试（auth-context + api.test 修改 + mock-sso）
- 0.5d：文档 + 验收
