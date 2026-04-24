# Phase 2 · Spec 04 · matrix Embedded Skill Store

> 依赖：02-user-upload（API 已稳定）；可与 03-mclaw-api 并行
> 产出：matrix 左侧 nav 多一项 "Skill 商店"，进去看到和 SkillHub 同款数据但视觉是 matrix 风格（复用 matrix 的 `Explore.tsx` 模式）；matrix backend 加 SkillHub proxy；统一 mozia-sso session。

---

## 一、目标

把 SkillHub 当 backend 嵌进 matrix 的 UI 里，**视觉风格用 matrix 的**（不是 iframe，也不是新标签）。完成后 Mozia 用户在 matrix 浏览 skill 是无缝体验，不需要切站点。

**现状（来自摸底）：**
- matrix 的"应用商店"（`/app/explore`）已有完整列表 + 详情 sheet + 搜索 + 状态 tabs 的 UX
- matrix 用 better-auth + OIDC 接 mozia-sso；providerId 默认 `oidc`
- matrix 后端是 Bun + Hono + Drizzle，**和 SkillHub 同款栈**

**目标形态：**
- matrix sidebar 加 "Skill 商店" 入口（`/app/skills`）
- 该页 UI 复用 `Explore.tsx` 的组件树，只把数据源换成 SkillHub
- matrix backend 加 `/api/skills*` proxy 转发到 SkillHub backend，做 auth passthrough
- 用户已经登录 matrix（mozia-sso）→ 进 skill 商店免再登

## 二、架构决策

### 决策 1：proxy 走 matrix backend，不走 frontend 直连

**为什么不让 matrix frontend 直接调 SkillHub `/api/skills`：**
- 跨域 cookie 难搞（matrix `*.mzsjai.com` vs SkillHub `*.mzsjai.com`，子域不同）
- session 不共享：matrix 的 better-auth session 和 SkillHub 的 better-auth session 是两套独立的 cookie
- CORS preflight 增加延迟

**proxy 模式的优点：**
- matrix frontend 当 SkillHub 不存在，就调 `matrix-backend/api/skills/*`
- matrix backend 用自己的 better-auth 验证 cookie 拿到 mozia-sso `sub`
- matrix backend 转发到 SkillHub 时用 **service account PAT**（matrix 在 SkillHub 那边创建一个长期 PAT），同时把当前 matrix 用户的 mozia-sso `sub` 通过 header 透传（如 `X-Acting-User-Sub`），SkillHub 据此判断 viewer 身份

### 决策 2：service account 模式，matrix 在 SkillHub 注册一个"应用身份"

SkillHub 这边新增 user 类型 `is_service_account=true`，matrix 用一个长期 PAT。该 PAT 调 SkillHub 时**额外**带 `X-Acting-User-Sub: <matrix 当前用户的 sso_sub>` header；SkillHub 后端识别 service account PAT + `X-Acting-User-Sub` → 把请求当成 acting user 的请求来处理。

```
matrix 用户 ──[matrix cookie]──> matrix backend
                                        │
                          [Authorization: Bearer mzhk_pat_<service-account>
                           X-Acting-User-Sub: <用户 mozia-sso sub>]
                                        ↓
                                 SkillHub backend
                                 (按 acting user 鉴权)
```

这样 SkillHub 知道 "matrix 替谁来"，private skill 只对该用户出现。

### 决策 3：复用 matrix 的 `Explore.tsx` 组件，不复制粘贴

matrix 那边把 `Explore.tsx` 抽成可复用组件 `<MarketplaceList resource="apps" | "skills">`，按 `resource` prop 切换 API endpoint 和列字段。matrix 已有的 app store 不变，新加 skill store 用同一组件。

如果改 `Explore.tsx` 改动太大，**降级方案**：直接复制 `Explore.tsx` 一份到 `Skills.tsx`，改字段；后续合并复用。

### 决策 4：MVP 不做"在 matrix 内部安装 skill"

matrix 的 app store 有 "launch instance" 按钮（启动 k8s app），skill 没有这个动作。MVP 阶段，matrix 内 skill 详情页的 "Install" 按钮**只是展示安装命令 + 复制到剪贴板**（同 SkillHub 自家的体验），不做"在 matrix 这边帮你装到 mclaw"之类的深度 action。

## 三、SkillHub 这边的改动

很小：

### 1. user 表加 service_account 标记

复用 `is_virtual` 列（02 里已加）。service account 也是一种"非真人 user"。如果要进一步区分：

```sql
ALTER TABLE skillhub."user" ADD COLUMN account_type TEXT NOT NULL DEFAULT 'human';
-- 'human' | 'virtual' (mozia 这种聚合 owner) | 'service' (matrix backend)
```

### 2. middleware 解析 acting user

`apps/api/src/middleware/api-auth.ts` 修改：

```ts
// PAT 验证后
if (pat.user.accountType === 'service') {
  const actingSub = c.req.header('X-Acting-User-Sub');
  if (!actingSub) return c.json({ error: 'X-Acting-User-Sub required for service account' }, 400);
  const actingUser = await findUserBySsoSub(actingSub);
  if (!actingUser) return c.json({ error: 'Acting user not found' }, 404);
  c.set('user', actingUser);   // 后续路由全按 acting user 处理
} else {
  c.set('user', pat.user);
}
```

### 3. CORS 加 matrix domain

`trustedOrigins` 加 matrix 的 origin（如 `https://matrix.mzsjai.com` + `http://localhost:<matrix-dev-port>`）。

### 4. 创建 matrix 的 service account（手动 / 一次性 SQL）

```sql
INSERT INTO skillhub."user" (id, name, email, email_verified, account_type, created_at, updated_at)
VALUES ('matrix-svc', 'matrix', 'svc-matrix@mozia.local', true, 'service', NOW(), NOW());

-- 然后通过 admin UI（或直接 SQL）给 matrix-svc 创建一个永不过期的 PAT
-- 把 PAT 给 matrix 团队配置到 matrix backend env
```

## 四、matrix 这边的改动

### Backend

**新增** `apps/backend/src/router/skills.ts`：

```ts
import { Hono } from 'hono';

const SKILLHUB_URL = process.env.SKILLHUB_URL!;
const SKILLHUB_PAT = process.env.SKILLHUB_SERVICE_PAT!;

export const skillsRouter = new Hono()
  .use('*', requireAuth())   // matrix 自己的 better-auth middleware
  .all('/*', async (c) => {
    const subPath = c.req.path.replace('/api/skills', '/api/skills');
    const url = new URL(SKILLHUB_URL + subPath);
    url.search = c.req.url.split('?')[1] ?? '';

    const session = c.get('session');
    const actingSub = session.user.ssoSub;  // matrix 这边 better-auth 也存了 sso_sub

    const upstream = await fetch(url, {
      method: c.req.method,
      headers: {
        'Authorization': `Bearer ${SKILLHUB_PAT}`,
        'X-Acting-User-Sub': actingSub,
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

挂载在 `app.route('/api/skills', skillsRouter)`。

### Frontend

**新增** `src/routes/Skills.tsx`：

如果 `Explore.tsx` 已抽成 `<MarketplaceList>`：

```tsx
import { MarketplaceList } from '@/components/marketplace-list';
export default function Skills() {
  return <MarketplaceList
    resource="skills"
    apiPath="/api/skills"
    detailFields={SKILL_DETAIL_FIELDS}
    statusFilter={false}
  />;
}
```

否则复制 `Explore.tsx` 一份改字段（apps → skills）。

**修改** `src/routes.ts`：

```ts
route("skills", "routes/Skills.tsx"),
```

**修改** `src/components/layout/Sidebar.tsx`：

```ts
mainNavItems.push({
  to: '/app/skills',
  icon: BookOpen,    // lucide-react
  label: 'Skill 商店',
});
```

### Env

```env
# matrix backend .env
SKILLHUB_URL=https://skillhub.mzsjai.com
SKILLHUB_SERVICE_PAT=mzhk_pat_<由 SkillHub admin 给>
```

## 五、协作分工

| 谁 | 做什么 |
|---|---|
| **SkillHub 团队（你 + me）** | 决策 1-4 全部 + 创建 matrix-svc + 把 PAT 安全传给 matrix 团队 |
| **matrix 团队** | proxy router + Skills.tsx + sidebar 加 nav + env 配置 + 联调 |

整个 spec 的 SkillHub 部分**约 1-1.5 天**；matrix 部分约 2-3 天。两边独立 PR，**SkillHub 先合**（matrix 才有可调用的服务）。

## 六、测试

### SkillHub 单测新增

- service account PAT 不带 `X-Acting-User-Sub` → 400
- service account PAT 带未知 acting sub → 404
- service account PAT 带合法 acting sub → 请求被当作 acting user 处理（看到 acting user 的 private skill）
- 普通用户 PAT 带 `X-Acting-User-Sub` → header **被忽略**（不允许 escalation）

### 联调验收（matrix + SkillHub 都起着）

按 overview Demo B：

1. Zeo 登录 matrix
2. 左侧 nav 看到 "Skill 商店"
3. 点开看到列表 = SkillHub 上当前 Zeo 能看到的所有 skill（含他自己的 private）
4. 点一条 → 详情 sheet 打开 → SKILL.md 渲染正常
5. 点 "Install" → 弹出包含 install command 的 dialog → 复制 → 终端粘贴运行成功

## 七、配置

### SkillHub side

`trustedOrigins` 加 matrix 的 origin（env `TRUSTED_ORIGINS` 已有，追加即可）。

### matrix side

```env
SKILLHUB_URL=https://skillhub.mzsjai.com
SKILLHUB_SERVICE_PAT=...
```

## 八、验收（对应 overview 的 Demo B）

**SkillHub 自动化：**
- [ ] service account 鉴权单测 4 case 全过
- [ ] CORS 改动后 matrix origin 不再 "Invalid origin"

**matrix 端（matrix 团队验收）：**
- [ ] proxy 转发 GET /api/skills 工作
- [ ] sidebar 出现 "Skill 商店"
- [ ] Explore.tsx 复用 / Skills.tsx 渲染正常

**联调：**
- [ ] 在 matrix 内做完一遍上面"Demo B"流程

## 九、风险 / 已知 trade-off

| 风险 | 缓解 |
|---|---|
| matrix proxy 是 matrix backend 单点；SkillHub 挂了 matrix skill 商店也挂 | matrix proxy 错误时返"SkillHub 暂时不可用"友好页 |
| service account PAT 一旦泄露，能 spoof 任何 mozia-sso 用户身份 | PAT 加 IP allowlist（matrix backend 出口 IP）；定期轮换；纳入 secret manager |
| matrix UI 和 SkillHub UI 双套维护成本 | MVP 阶段接受；后续如果 matrix 内嵌方案足够好用，可以考虑停掉 SkillHub 自家前端，让 matrix 当唯一入口 |
| acting user 还没在 SkillHub 那边注册（首次访问）→ 404 | middleware 自动 upsert：`X-Acting-User-Sub` 找不到时按 SSO sub 创建 user 行（用 SSO 的 displayName / email） |

## 十、不做

- ❌ "在 matrix 里发布 skill" UI（matrix 内嵌只读，发布去 SkillHub 自家前端）
- ❌ matrix 项目和 skill 的关联（"这个 app 推荐安装这些 skill"）
- ❌ 跨产品搜索（matrix 主搜索能搜到 skill）
- ❌ matrix 和 SkillHub session 真融合（service account proxy 就够；session 融合是 SSO 改造，不是 SkillHub/matrix 单产品能决定的）
