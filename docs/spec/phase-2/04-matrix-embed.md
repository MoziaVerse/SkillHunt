# Phase 2 · Spec 04 · matrix Embedded Skill Store

> 依赖：02-user-upload（API 已稳定）；03（capability URL）已落地
> 产出：matrix sidebar 多一项 "Skill 商店"，UI 走 matrix 风格（复用 `Explore.tsx`），数据来源是 SkillHub。鉴权链路用 **mozia 生态既有的 S2S pattern**（matrix backend 早就在这么调 mozia-api），SkillHub 加同款 middleware 就接入了。

---

## 一、目标

把 SkillHub 装进 matrix 的 UI 里，用户在 matrix 内浏览 / 安装 skill，**视觉是 matrix 风格、数据是 SkillHub 的、登录是 mozia-sso 的**。

### 不做（避免偏题）

- ❌ 在 matrix 内部发布 skill —— 发布去 SkillHub 自家前端
- ❌ matrix 主搜索能搜到 skill（跨产品搜索是另一议题）
- ❌ 暴露给"非 matrix 的外部调用方"用同一套 service token —— 那是另一条线（详见第十章）

## 二、关键摸底（决定方案的事实）

> spec 重写前重新摸底了 matrix 仓库；以下事实直接决定了第三章的设计。

| # | 事实 | 出处 |
|---|---|---|
| 1 | matrix 自身**不存 / 不验**用户 API key —— `token` 子模块全是 UI，CRUD 全部转发给 mozia-api | `matrix/backend/src/lib/mozia-user-api.ts`, `service/token.ts` |
| 2 | matrix 调 mozia-api 用的鉴权三件套：`Authorization: Bearer <ADMIN_TOKEN>` + `New-Api-User: <ADMIN_ID>` + `X-SSO-SUB: <user-sub>` | 同上 line 26-64 |
| 3 | matrix 当前**没有** introspect / verify endpoint —— "用 Bearer token 反查 ssoSub" 这件事在生态里还不存在 | matrix `router/` 全文搜索 |
| 4 | matrix 前端 `Explore.tsx` 是成熟的 marketplace 组件，可复用 / 可复制 | `matrix/src/routes/Explore.tsx` |
| 5 | matrix sidebar nav 是简单数组，新增一项零摩擦 | `matrix/src/components/layout/Sidebar.tsx` line 34-41 |
| 6 | matrix 端口：backend `:3257`，frontend `:5173`（react-router 默认） | `matrix/backend/.env.example` |
| 7 | mozia-api 是另一个独立服务，本仓库**没有源码**（黑盒，只有 HTTP 调用） | matrix CLAUDE.md 描述 + .env 引用 |

**最关键的一条是 #2。** mozia 生态目前的 S2S 标准就是 "service Bearer + acting-user header"，且 matrix 已经在用。SkillHub 加一个对称的入口，整条 matrix→SkillHub 链路就和 matrix→mozia-api 完全同构，团队不需要学新概念。

## 三、架构决策

### 决策 1 · matrix backend 走 proxy，不让前端直连 SkillHub

理由（不变）：
- 子域 cookie 不共享、CORS preflight 增加延迟
- session 不共享：matrix 的 better-auth 和 SkillHub 的 better-auth 是两套独立 cookie

proxy 在 matrix backend 这边吃下："matrix 已登录用户"→"代他调 SkillHub"。

### 决策 2 · matrix → SkillHub 复用 mozia 现成的 S2S pattern

`Authorization: Bearer <SKILLHUB_SERVICE_TOKEN>` + `X-SSO-SUB: <用户 ssoSub>`。一致性收益：
- matrix backend 端：写法和它调 mozia-api 完全同构；新建一个 `skillhub-user-api.ts` 几乎是复制 `mozia-user-api.ts`
- 团队认知零负担：不引入新鉴权概念
- 长期演进：以后 mozia-api 真有 introspect endpoint 时，SkillHub 切换是把 middleware 里 "string equals" 换成 "调 introspect"，调用方（matrix）一行不改

### 决策 3 · 不依赖 matrix introspect endpoint（短期）

事实 #3：introspect endpoint 现在不存在。如果硬等 matrix / mozia-api 团队加，spec 04 卡住。

短期 SkillHub 自己签发 `SKILLHUB_SERVICE_TOKEN`，作为信任 matrix 这一个具体调用方的密钥。**这不是"重新自建 PAT 系统"**——区别：
- PAT walkback：避免 SkillHub 维护**面向用户**的长效 token CRUD（matrix 已经在干，重复）
- 本决策：SkillHub 维护**一个**面向**matrix 这一个服务**的固定 secret，env 配一次，不进 DB、不要 UI

中长期当 mozia-api introspect 上线，SkillHub 改 middleware 走那条路，service token 退役。这是**演进路径明确的过渡方案**，不是技术债。

### 决策 4 · acting user 不存在时返回 401，不自动 upsert

matrix 用户首次访问 skill 商店时，SkillHub 那边大概率没他的 user 行。原本想自动 upsert 求"无感"，但仔细看 schema：

- `user.sso_sub` 列无 unique index（02 加 user 表时没加）
- 如果 matrix proxy 先 upsert 了 stub 行，后续该用户走 OIDC 直接登 SkillHub，better-auth 会插入**第二行**（不同 id、相同 ssoSub），技能权属裂成两份
- 加 unique index 又会反过来破坏 better-auth 的首次创建流（约束冲突）

权衡：用 401 让 matrix 引导用户到 SkillHub 完成首次登录（mozia-sso 已登 → 一次重定向 → 回来）。多一次点击换零脏数据风险。matrix 端展示样例：

> Skill 商店需要您先在 SkillHub 完成一次首次访问 [→ 跳转 SkillHub]

后续 Phase 3 真要做"无感"，路径是给 ssoSub 加 unique index + 给 better-auth `databaseHooks.user.create.before` 加"找到 ssoSub 已存在 → 返回现有行"逻辑。本 spec 不做。

### 决策 5 · X-SSO-SUB header 只对 service token 生效

普通 cookie session 请求即使带 `X-SSO-SUB` 也忽略。防止任何"持普通 PAT-equivalent + 伪造 X-SSO-SUB → 冒充别人"的可能。middleware 必须先验 service token，才解 acting header。

### 决策 6 · 前端 UI 复用 `Explore.tsx`

matrix 团队选择：
- 上策：抽 `<MarketplaceList resource="apps" | "skills">` 复用
- 下策：复制 `Explore.tsx` → `Skills.tsx` 改字段

不强求，由 matrix 工程师定。

## 四、SkillHub 这边的改动

### 1. env

```
# apps/api/.env
SKILLHUB_SERVICE_TOKEN=<openssl rand -hex 32>
TRUSTED_ORIGINS=https://matrix.mzsjai.com,http://localhost:5173
```

`TRUSTED_ORIGINS` 已有，追加 matrix origin 即可。

### 2. auth-context middleware 加 service-token 分支

`apps/api/src/lib/auth-context.ts`：

```ts
const SERVICE_TOKEN = process.env.SKILLHUB_SERVICE_TOKEN;

export async function getAuthContext(c: Context): Promise<AuthContext> {
  // 1) Service token (matrix proxy 等受信内部服务)
  const authHeader = c.req.header('authorization') ?? c.req.header('Authorization');
  if (SERVICE_TOKEN && authHeader === `Bearer ${SERVICE_TOKEN}`) {
    const sub = c.req.header('x-sso-sub');
    if (!sub) return { user: null }; // 调用方约定必带 X-SSO-SUB
    const row = await findUserBySsoSub(sub);
    if (!row) return { user: null }; // 用户尚未首次登录 SkillHub —— 路由层 401
    return { user: { id: row.id, email: row.email, name: row.name, ssoSub: sub } };
  }

  // 2) Cookie session (better-auth, 现有路径)
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return { user: null };
  // ... 现有逻辑
}
```

### 3. service 加 `findUserBySsoSub`

`apps/api/src/services/skill-service.ts`：

```ts
export async function findUserBySsoSub(sub: string): Promise<UserRow | null> {
  const rows = await db.select(userRowSelect).from(user).where(eq(user.ssoSub, sub)).limit(1);
  return rows[0] ?? null;
}
```

### 4. CORS

`auth.ts` 的 `trustedOrigins` 已经从 `TRUSTED_ORIGINS` env 读，第 1 步追加 origin 后立即生效。

### 5. 不需要新表 / 新 migration

唯一的"身份"是 env 里那个 secret。SkillHub 这边 schema 一动不动。

## 五、matrix 这边的改动

由 matrix 团队实施，本 spec 给参考实现。

### Backend

新增 `apps/backend/src/router/skills.ts`：

```ts
import { Hono } from 'hono';

const SKILLHUB_URL = process.env.SKILLHUB_URL!;
const SKILLHUB_SERVICE_TOKEN = process.env.SKILLHUB_SERVICE_TOKEN!;

export const skillsRouter = new Hono()
  .use('*', requireAuth())
  .all('/*', async (c) => {
    const session = c.get('session');
    const url = new URL(SKILLHUB_URL + c.req.path);
    url.search = c.req.url.split('?')[1] ?? '';

    const upstream = await fetch(url, {
      method: c.req.method,
      headers: {
        Authorization: `Bearer ${SKILLHUB_SERVICE_TOKEN}`,
        'X-SSO-SUB': session.user.ssoSub,
        'Content-Type': c.req.header('content-type') ?? 'application/json',
      },
      body: ['POST', 'PUT', 'PATCH'].includes(c.req.method) ? await c.req.text() : undefined,
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  });
```

挂载：`app.route('/api/skills', skillsRouter)`。

**首次登录引导：** matrix frontend 的 `Skills.tsx` 拿到 401 时，展示一次性提示：

```
Skill 商店需要您先在 SkillHub 完成一次首次访问 [→ 跳转 SkillHub]
```

跳到 `${SKILLHUB_URL}/?from=matrix` 即可（用户已登 mozia-sso，OIDC 一次重定向就回来）。

### Frontend

- `src/routes/Skills.tsx`：复用 / 复制 `Explore.tsx`，把 fetch 路径换成 `/api/skills`
- `src/components/layout/Sidebar.tsx`：加 `{ path: '/app/skills', label: 'Skill 商店', icon: BookOpen }`
- `src/routes.ts`：加 `route("skills", "routes/Skills.tsx")`

### env

```
# matrix backend .env
SKILLHUB_URL=http://localhost:3333          # dev
SKILLHUB_SERVICE_TOKEN=<由 SkillHub 团队给>
```

## 六、协作 / 时序

| 阶段 | 谁 | 做什么 |
|---|---|---|
| 1 | SkillHub | 实现第四章 1-4 步、生成 `SKILLHUB_SERVICE_TOKEN`、单测过、commit |
| 2 | SkillHub | 把 token 通过受信渠道（不是 IM 明文）传给 matrix 团队 |
| 3 | matrix | 配 env、实现 backend proxy + frontend 页 + sidebar |
| 4 | 双方 | 联调（按第八章 Demo B） |

SkillHub 部分**预计 2-4 小时**（一个 middleware 分支、两个 service 函数、env、4 case 测试）；matrix 部分由 matrix 团队自评。

## 七、测试

### SkillHub 单测新增 4 case

`auth-context.test.ts` 加：

- `service token + 合法 X-SSO-SUB（user 已存在）` → 鉴权为该 user
- `service token + 未知 X-SSO-SUB` → user: null（路由层 401，matrix 端引导首次登录）
- `service token + 缺 X-SSO-SUB` → user: null
- `错的 service token + X-SSO-SUB` → 走 cookie 分支（cookie 也无 → user: null），不允许 token 覆盖 cookie

### smoke 加章节（手动跑一次确认）

```bash
# 已登录 SkillHub 的用户，先拿到他的 ssoSub
SUB=$(curl -fsS -b "$CK" http://localhost:3333/api/users/me | jq -r '.id')
# (实际 ssoSub 取法看你测试 user，下面以 sso_sub 列值为准)

curl -fsS -H "Authorization: Bearer $SKILLHUB_SERVICE_TOKEN" \
     -H "X-SSO-SUB: $SUB" \
     http://localhost:3333/api/users/me | jq
# 期望：200，返回该 user 的行；handle / name / canPublishAs 都正常

# 未知 sub → 401
curl -sS -o /dev/null -w '%{http_code}\n' \
     -H "Authorization: Bearer $SKILLHUB_SERVICE_TOKEN" \
     -H "X-SSO-SUB: never-seen-this-sub" \
     http://localhost:3333/api/users/me
# 期望：401
```

## 八、验收（对应 overview 的 Demo B）

**SkillHub 自动化：**
- [ ] `auth-context.test.ts` 4 case 全过
- [ ] `pnpm typecheck && pnpm lint && pnpm test` 全绿
- [ ] smoke 章节手跑成功

**matrix 端（matrix 团队验收）：**
- [ ] `/api/skills` proxy 转发 GET / POST / DELETE 全工作
- [ ] sidebar 出现 "Skill 商店"
- [ ] Skills.tsx 列表 + 详情渲染正常

**联调（端到端）：**
- [ ] Zeo 在 matrix 登录（mozia-sso）
- [ ] 进 "Skill 商店" → 看到的列表 = SkillHub 上 Zeo 能看到的所有 skill（含他自己 private）
- [ ] 详情页 → SKILL.md 渲染正常
- [ ] 点 "Install" → 拿到 install command（capability URL，spec 03 已实现）→ 终端粘贴运行成功

## 九、风险

| 风险 | 缓解 |
|---|---|
| `SKILLHUB_SERVICE_TOKEN` 泄露 → 攻击者可冒充任意已登录 sso_sub | secret manager；定期轮换；matrix 出口 IP allowlist（生产）；调用日志可审计 |
| matrix proxy 单点：SkillHub 挂 matrix skill 商店也挂 | matrix 端友好降级页（不阻塞主导航） |
| 用户首次从 matrix 进 → 401 → 引导到 SkillHub → 体验摩擦 | acceptable（一次性）；Phase 3 加 ssoSub unique index + better-auth user-create hook 后可改成 auto-link |
| acting user 在 matrix 改了 displayName，SkillHub 这边的 `name` 不会自动同步 | acceptable，用户在 SkillHub 自己 settings 改一次即可 |

## 十、长期演进（mozia-api introspect 上线后）

当 mozia-api 暴露 `POST /api/sso/introspect`（Bearer → `{ ssoSub, email, name }`）：

- SkillHub middleware 把 service-token 分支替换成"任何 Bearer → 调 introspect → 拿 ssoSub → 后续相同"
- matrix proxy 不变（仍带 Bearer + X-SSO-SUB；SkillHub 这边的 X-SSO-SUB 当成 introspect 结果的校验项即可）
- mclaw / curl / 任何持有 mozia 生态 key 的调用方**自然就能直连 SkillHub**，不再需要走 matrix proxy
- `SKILLHUB_SERVICE_TOKEN` 退役

这条路径在本 spec 里**只描述、不实现**。Phase 3 / mozia-api owner 排期触发。

## 十一、不做

- ❌ matrix 内发 skill UI（只读嵌入）
- ❌ matrix project ↔ skill 关联推荐
- ❌ 跨产品搜索
- ❌ matrix / SkillHub session 真融合（service proxy 够用）
- ❌ mozia-api introspect endpoint（不在 SkillHub 团队范围；本 spec 走自签 service token，等生态侧推进）
