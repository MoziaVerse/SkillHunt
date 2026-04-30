# Phase 2 · Spec 03 · Capability URL（一次性安装链接）

> 依赖：02-user-upload（owner_user_id + private 概念已就位）
> 产出：让 owner 把 **private skill** 通过一次性 token 分享给 CLI / 同事 / mclaw，**不需要让对方持有任何长期凭据**。Bearer 鉴权（PAT 形态）改为 spec 04 转发到 matrix 中央密钥系统，本 spec 不再实现 SkillHub 本地 PAT。

---

## 一、目标

从 owner 视角："我能把这条 private skill 安全地交给 CLI / 别人 / mclaw 临时拉取一次。"

具体能力：

1. owner 在详情页点 "Copy install command" → 后端 mint 一个 **capability URL**
2. CLI（`npx skills add ...`）拿这个 URL 直接 fetch SKILL.md，不需要任何 header
3. token 单次有效，24h 过期；过期 / 用完即 404

**不做（已从本 spec 移出）：**
- ❌ SkillHub 本地 PAT 表 + `/api/personal-access-tokens` CRUD
- ❌ `Authorization: Bearer mzhk_pat_*` 中间件

**理由（生态视角）：** 整个 Mozia 生态（matrix、mclaw、SkillHub）的密钥应当统一收敛在 matrix。matrix 已经在替 mclaw 管模型 API key，再让 SkillHub 自建一份 PAT 表是重复造轮子。spec 04（matrix embed）会把 SkillHub 的 Bearer 入口对接到 matrix 的 introspect 接口——身份走 mozia-sso，密钥走 matrix，本 spec 只负责 capability URL 这一条线。

## 二、架构决策

### 决策 1：capability URL 是 grant-scoped，不是 user-scoped

每个 token 绑死一条 skill（一个 `(owner, slug)`），不能跨 skill 复用。

```sql
install_grants {
  token         text primary key,        -- 32 bytes base64url
  skill_id      uuid not null references skills(id) on delete cascade,
  granted_by    text not null references user(id),  -- mint 时的登录用户
  expires_at    timestamptz not null,
  max_uses      int not null default 1,
  used_count    int not null default 0,
  created_at    timestamptz default now()
}
```

当 `used_count >= max_uses` OR `expires_at < now()` → 视为失效，404。

### 决策 2：capability URL 走 well-known 路径，不走 `/api/*`

理由：要让现有 `npx skills` CLI 能直接 fetch（CLI 走的是 well-known 协议）。token 部分放 path 段：

```
GET /i/<token>/.well-known/agent-skills/index.json
GET /i/<token>/.well-known/agent-skills/<skill-name>/SKILL.md
GET /i/<token>/.well-known/agent-skills/<skill-name>/<file-path>
```

`/i/<token>/` 是 capability base URL；CLI 会在这个 base URL 下继续请求标准
`.well-known/agent-skills` 索引和文件。

### 决策 3：每次 capability URL 取用都记审计

`install_grant_uses (token, ip, user_agent, accessed_at)` 表，让 owner 在 `/u/<owner>/audit`（暂不做 UI，先有数据）能看到"我的 private skill 被谁拉过"。

审计日志保留 90 天滚动删除。

### 决策 4：mint 入口仅接 cookie session，不接 Bearer

mint capability URL 的动作（`POST /api/install-tokens`）是 owner 的"主动授权"操作，必须本人在浏览器登录后亲自触发。Bearer 入口（matrix 转发）的实现到 spec 04 才会出现，到时再决定是否允许 PAT-equivalent 调 mint。

## 三、数据模型

### Migration `0005_install_grants.sql`（实际仓库内文件名以 drizzle 编号为准）

```sql
CREATE TABLE skillhub.install_grants (
  token       text primary key,              -- 32 bytes base64url, in URL path
  skill_id    uuid not null references skillhub.skills(id) on delete cascade,
  granted_by  text not null references skillhub."user"(id),
  expires_at  timestamptz not null,
  max_uses    int not null default 1,
  used_count  int not null default 0,
  created_at  timestamptz default now()
);
CREATE INDEX install_grants_skill_idx ON skillhub.install_grants (skill_id);
CREATE INDEX install_grants_expires_idx ON skillhub.install_grants (expires_at);

CREATE TABLE skillhub.install_grant_uses (
  id           uuid primary key default gen_random_uuid(),
  token        text not null,
  ip           inet,
  user_agent   text,
  accessed_at  timestamptz default now()
);
CREATE INDEX grant_uses_token_idx ON skillhub.install_grant_uses (token);
CREATE INDEX grant_uses_accessed_idx ON skillhub.install_grant_uses (accessed_at);
```

> Migration 0006 显式 DROP `personal_access_tokens` 表（Phase 2 早期实现的本地 PAT 已收回，统一让位给 spec 04 的 matrix 转发）。

## 四、API 契约

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| `POST` | `/api/install-tokens` | 给一条 skill 生成一个 capability token；body `{ skillId, expiresInHours?, maxUses? }`；返 `{ token, installCommand, expiresAt, maxUses }` | cookie session；caller 必须能看到这条 skill（否则 404） |
| `GET` | `/i/:token/.well-known/agent-skills/index.json` | 返单条 skill 的 well-known index（仅这一条 skill）| 无（token 自己就是凭据） |
| `GET` | `/i/:token/.well-known/agent-skills/:skillName/*` | 返 skill 文件；`SKILL.md` 命中时 `used_count++`，后续附属文件允许在同一次 token 使用后继续拉取 | 无（token 自己就是凭据） |

响应示例：

```json
// POST /api/install-tokens 201
{
  "token": "Hk9q...x4",
  "expiresAt": "2026-04-25T13:00:00Z",
  "maxUses": 1,
  "installCommand": "npx skills add http://localhost:3333/i/Hk9q...x4 --agent claude-code -y"
}
```

## 五、前端

### 详情页 "Copy install command" 按钮

private skill 详情页（仅 owner 可见）：原本"Copy install command"按钮的行为变成：

```
[点击 Copy install command]
  → POST /api/install-tokens { skillId, expiresInHours: 24, maxUses: 1 }
  → 后端 mint 一个 token
  → 前端把返回的 installCommand 写进剪贴板：
    npx skills add http://skillhub.../i/<token> --agent claude-code -y
  → 提示 "Token expires in 24 hours, single use"
```

public skill 不需要 capability URL，按钮还是直接给永久可用的 install command（不变）。

### `/settings/tokens` 页

**移除**。本 spec 早期版本曾包含 PAT 管理 UI；随 PAT 走回收（migration 0006 + spec 04），settings 下只剩 `/profile`。

## 六、实现步骤

1. migration `0005_install_grants.sql`（实际为 `0005_pat_and_install_grants.sql` 历史名；0006 移除 PAT 表）
2. schema 同步：`schema.ts` 加 `installGrants` + `installGrantUses`
3. 服务层 `services/install-grant-service.ts`：`mintGrant / consumeGrant`
4. routes `routes/api.ts`：`POST /api/install-tokens`
5. routes `routes/wellknown.ts`：加 `/i/:token/*` 路径处理（注意：必须 register 在通用 `/agent-skills/:owner/:slug/*` 之前，否则会被前者吞掉）
6. 前端详情页 owner 视角的 "Copy install command" 流程改造
7. 测试 + smoke

## 七、测试

### service 单测

- mint grant happy path
- consume grant：过期 / 用完 / 正常使用三种 case

### route 测试

- mint capability URL → 用一次成功 → 第二次 404
- 给别人 private skill mint → 404（不暴露存在性）
- mint 接口未登录 → 401
- capability URL 过期后 → 404
- capability URL 路径里的 skillName 与 grant 的 skill 不一致 → 404

### smoke 加章节

```bash
# 假设已 cookie 登录，从 me/skills 拿到一条 private skill 的 id
SKILL_ID=$(curl -fsS -b "$CK" http://localhost:3333/api/users/me/skills \
  | jq -r '.items[] | select(.visibility=="private") | .id' | head -1)

# mint capability URL
TOK=$(curl -fsS -X POST -b "$CK" -H 'content-type: application/json' \
  http://localhost:3333/api/install-tokens \
  -d "{\"skillId\":\"$SKILL_ID\"}" | jq -r '.token')

# 拉 SKILL.md（应 200）
curl -fsS http://localhost:3333/i/$TOK/.well-known/agent-skills/foo/SKILL.md

# 第二次（应 404）
curl -sS -o /dev/null -w '%{http_code}\n' \
  http://localhost:3333/i/$TOK/.well-known/agent-skills/foo/SKILL.md
# 期望: 404
```

## 八、配置

无新增 env。

## 九、验收（对应 overview 的 Demo C）

**自动化：**
- [x] typecheck / lint / test 全绿
- [x] smoke 包含 capability 流程，全绿

**手动：**
- [x] private skill 详情页点 "Copy install command" → 拿到含 `/i/<token>/` 的 URL → 终端 `npx skills add ...` 安装成功
- [x] 同一 token URL 再次访问 → 404
- [x] DB 里 `install_grant_uses` 表有一条访问记录，含 ip + user_agent

## 十、与 mclaw / matrix 的对接

mclaw / 任何 CLI 当下就能用 capability URL：owner 把 mint 出来的链接交出去，对方一次性拉走。这是**人对人**的临时分享路径，不需要 mclaw 自身具备身份。

**程序化的、长期的、用 mclaw 自己身份去拉自己 skill** 的路径，由 spec 04（matrix embed）补完：
- SkillHub Bearer 入口转发到 matrix introspect endpoint
- matrix 已经替 mclaw 管模型 API key，让 SkillHub 复用同一套密钥分发即可
- 用户不需要在 SkillHub 单独管理 PAT；密钥的"一次性 issue / 长期持有"两条线在 matrix 一处统一

## 十一、不做

- ❌ SkillHub 本地 PAT 表（已 walked back，让位 spec 04）
- ❌ `Authorization: Bearer ...` middleware（spec 04 加上，转发到 matrix）
- ❌ rate limit on capability URL（Phase 3）
- ❌ webhook（"我的 skill 更新了通知 mclaw"）—— pull 模型够
- ❌ mclaw 端的任何代码改动
