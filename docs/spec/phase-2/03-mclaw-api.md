# Phase 2 · Spec 03 · mclaw API + Capability URL + PAT

> 依赖：02-user-upload（owner_user_id + private 概念已就位）
> 产出：SkillHub 单方面预留好供 mclaw 接入的全部能力——`GET /api/users/me/skills`（PAT 鉴权）+ capability URL（一次性 token 安装）+ PAT 创建/吊销 UI。**mclaw 这边不动**。

---

## 一、目标

mclaw 团队后续接入 SkillHub 时，能够：

1. 让 mclaw 后台用 **PAT（Personal Access Token）** 拉取某 mozia-sso 用户的 skill 列表（含 private）
2. 用 **capability URL** 临时拉单个 SKILL.md 文件（不需要在 mclaw 里管理 PAT 的取用）
3. 用户能在 SkillHub 网页 `/settings/tokens` 自助创建、查看、吊销自己的 PAT

**对 mclaw 团队的承诺（接口契约）：**
- `GET /api/users/me/skills` 接受 `Authorization: Bearer <pat>`，返回当前 PAT owner 的全部 skill（public + private）
- capability URL 形如 `http://skillhub/.well-known/agent-skills/i/<token>/<owner>/<slug>/SKILL.md`，单次有效，24h 过期
- PAT 不放进 cookie，不在 URL 里；mclaw 自己负责安全存储

**SkillHub 这边的承诺（实现）：**
- 上述三个能力完整、有测试、能 demo
- **不实现** mclaw 端的 sync loop / 配置管理 / 用户 PAT 录入流程

## 二、架构决策

### 决策 1：PAT 走 better-auth 的 plugin 机制（如果有）或自己写

调研 better-auth 是否原生支持 PAT。若支持（如 `@better-auth/plugins/api-keys` 之类），优先用；否则自己实现。

PAT 形态：32 字节随机 base64url，前缀 `mzhk_pat_` 便于识别（参考 GitHub `ghp_` / OpenAI `sk-` 风格）。

```
mzhk_pat_a8f3...x9
```

数据库存 `bcrypt(token)`，不可逆；网页只在创建那一瞬间显示完整值，之后只显示前 8 位 + `...`。

### 决策 2：PAT 是 user-scoped，不是 skill-scoped

一个 PAT = 一个用户身份的代理。能做这个用户能做的所有读操作（list skills、get skill detail，**含自己的 private**）。

不做细粒度 scope（`scopes: ['skills:read']` 这种）——YAGNI。后续真有"只读 vs 读写 PAT"需求再加 `scopes` 列。

### 决策 3：capability URL 是 grant-scoped，不是 user-scoped

每个 capability token 绑死一条 skill（一个 (owner, slug)），不能跨 skill 复用。

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

### 决策 4：capability URL 走 well-known 路径，不走 `/api/*`

理由：要让现有 `npx skills` CLI 能直接 fetch（CLI 走的是 well-known 协议）。token 部分放 path 段：

```
GET /.well-known/agent-skills/i/<token>/index.json
GET /.well-known/agent-skills/i/<token>/<owner>/<slug>/SKILL.md
GET /.well-known/agent-skills/i/<token>/<owner>/<slug>/<file-path>
```

`/i/<token>/` 这个段是 capability prefix；后面的路径和正常 well-known 一致。

### 决策 5：每次 capability URL 取用都记审计

`install_grant_uses (token, ip, user_agent, accessed_at)` 表，让 owner 在 `/u/<owner>/audit`（暂不做 UI，先有数据）能看到"我的 private skill 被谁拉过"。

审计日志保留 90 天滚动删除。

## 三、数据模型

### Migration `0004_pat_and_grants.sql`

```sql
CREATE TABLE skillhub.personal_access_tokens (
  id          text primary key,
  user_id     text not null references skillhub."user"(id) on delete cascade,
  name        text not null,                 -- 用户给 PAT 起的标识，如 "mclaw on macbook"
  token_hash  text not null,                 -- bcrypt
  token_prefix text not null,                 -- 显示用，如 "mzhk_pat_a8f3"
  last_used_at timestamptz,
  expires_at  timestamptz,                   -- null = 永不过期；UI 默认推 90d
  created_at  timestamptz default now()
);
CREATE INDEX pat_user_idx ON skillhub.personal_access_tokens (user_id);
CREATE INDEX pat_token_hash_idx ON skillhub.personal_access_tokens (token_hash);

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

## 四、API 契约

### PAT CRUD

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| `POST` | `/api/personal-access-tokens` | 创建 PAT；body `{ name: string, expiresInDays?: number }`；**响应只在这一次返完整 token** | cookie session |
| `GET` | `/api/personal-access-tokens` | 列出当前用户所有 PAT 元数据（不含 token） | cookie session |
| `DELETE` | `/api/personal-access-tokens/:id` | 吊销 PAT | cookie session |

响应示例：

```json
// POST 201
{
  "id": "...",
  "name": "mclaw on macbook",
  "token": "mzhk_pat_a8f3...x9",   // 完整值，仅这次响应给
  "tokenPrefix": "mzhk_pat_a8f3",
  "expiresAt": "2026-07-22T00:00:00Z"
}

// GET 200
{
  "items": [
    { "id": "...", "name": "mclaw on macbook", "tokenPrefix": "mzhk_pat_a8f3",
      "lastUsedAt": "2026-04-23T...", "expiresAt": "2026-07-22T...", "createdAt": "..." }
  ]
}
```

### 用 PAT 调 API

凡是接受 cookie 的 `/api/*` endpoint，**同样接受** `Authorization: Bearer <pat>` 头部。中间件优先级：
1. `Authorization: Bearer mzhk_pat_*` → 走 PAT 验证
2. 否则走 better-auth cookie session

### Capability URL endpoints（well-known 下）

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| `POST` | `/api/install-tokens` | 给一条 skill 生成一个 capability token；body `{ skillId, expiresInHours?, maxUses? }`；返 `{ token, installCommand, expiresAt }` | cookie 或 PAT；caller 必须能看到这条 skill（否则 403） |
| `GET` | `/.well-known/agent-skills/i/:token/index.json` | 返单条 skill 的 well-known index（仅这一条 skill）| 无（token 自己就是凭据） |
| `GET` | `/.well-known/agent-skills/i/:token/:owner/:slug/*` | 返 skill 文件；每次成功命中 `used_count++` 并写 `install_grant_uses` | 无（token 自己就是凭据） |

## 五、前端

### `/settings/tokens` 页

布局：

```
┌─ Personal Access Tokens ─────────────────────┐
│  Used by mclaw and other CLIs to fetch your   │
│  skills (incl. private).                      │
│                                               │
│  [ + Generate new token ]                     │
│                                               │
│  Active tokens                                │
│  ┌────────────────────────────────────────┐   │
│  │ mclaw on macbook                       │   │
│  │ mzhk_pat_a8f3... · last used 2 days ago│   │
│  │ expires 2026-07-22  [ Revoke ]         │   │
│  └────────────────────────────────────────┘   │
└────────────────────────────────────────────────┘
```

创建时弹 modal，**只此一次**展示完整 token 给用户复制；用户关闭 modal 后不再有任何途径取回。

### 详情页 "Copy install command" 按钮

private skill 详情页（仅 owner 可见）：原本"Copy install command"按钮的行为变成：

```
[点击 Copy install command]
  → POST /api/install-tokens { skillId, expiresInHours: 24, maxUses: 1 }
  → 后端 mint 一个 token
  → 前端把返回的 installCommand 写进剪贴板：
    npx skills add http://skillhub.../i/<token> --skill <owner>/<slug> --agent claude-code -y
  → 提示 "Token expires in 24 hours, single use"
```

public skill 不需要 capability URL，按钮还是直接给永久可用的 install command（不变）。

## 六、实现步骤

1. migration `0004_pat_and_grants.sql`
2. schema 同步：`auth-schema.ts` 加 `personalAccessTokens`、`schema.ts` 加 `installGrants` + `installGrantUses`
3. 服务层 `services/pat-service.ts`：`createPat / listPats / revokePat / verifyPat` (bcrypt compare)
4. 服务层 `services/install-grant-service.ts`：`mintGrant / consumeGrant`
5. middleware `middleware/api-auth.ts`：解析 Authorization header → 调 verifyPat → set context
6. routes `routes/api.ts`：5 个新 endpoint
7. routes `routes/wellknown.ts`：加 `/i/:token/*` 路径处理
8. 前端 `routes/settings-tokens.tsx`、`hooks/use-pats.ts`
9. 前端详情页 owner 视角的 "Copy install command" 流程改造
10. 测试 + smoke

## 七、测试

### service 单测

- PAT 创建后 hash 正确、prefix 正确
- verifyPat 对正确 token 返用户、对错误 token 返 null
- 过期 PAT verifyPat 返 null
- mint grant happy path
- consume grant：过期 / 用完 / 正常使用三种 case

### route 测试

- `POST /api/personal-access-tokens` 未登录 → 401
- 创建后 `GET /api/personal-access-tokens` 列表里出现
- 用 PAT 调 `GET /api/users/me/skills` 返当前 user 全部 skill（含 private）
- PAT revoke 后再用 → 401
- mint capability URL → 用一次成功 → 第二次 404
- 给别人 skill mint capability URL → 403
- capability URL 过期后 → 404

### smoke 加章节

```bash
# 创建 PAT
PAT=$(curl -X POST -H 'cookie: ...' http://localhost:3333/api/personal-access-tokens \
  -d '{"name":"smoke"}' | jq -r '.token')

# 用 PAT 列表
curl -H "Authorization: Bearer $PAT" http://localhost:3333/api/users/me/skills | jq '.items | length'

# mint capability URL
TOK=$(curl -X POST -H "Authorization: Bearer $PAT" http://localhost:3333/api/install-tokens \
  -d '{"skillId":"<some-id>"}' | jq -r '.token')

# 拉 SKILL.md
curl -fsS http://localhost:3333/.well-known/agent-skills/i/$TOK/mozia/project-mental-map/SKILL.md
# 第二次应该 404
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3333/.well-known/agent-skills/i/$TOK/...
# 期望: 404
```

## 八、配置

无新增 env。bcrypt rounds 用 12（默认）。

## 九、验收（对应 overview 的 Demo C）

**自动化：**
- [ ] typecheck / lint / test 全绿
- [ ] smoke 包含上面 PAT + capability 流程，全绿

**手动：**
- [ ] 在 `/settings/tokens` 创建一个 PAT 名 "test-mclaw"，弹出 modal 显示完整 token
- [ ] 复制 token，关闭 modal；列表里只能看到 prefix 不能看完整值
- [ ] 终端 `curl -H "Authorization: Bearer mzhk_pat_..." http://localhost:3333/api/users/me/skills` 返自己 skill 列表（含 private）
- [ ] private skill 详情页点 "Copy install command" → 拿到含 `/i/<token>/` 的 URL → 终端 npx 安装成功
- [ ] 同一 token URL 再次访问 → 404
- [ ] DB 里 `install_grant_uses` 表有一条访问记录，含 ip + user_agent
- [ ] `/settings/tokens` 列表 PAT 的 last_used_at 已更新

## 十、给 mclaw 团队的对接 mini doc

**SkillHub 这边写完后**，单独产出一份 `mozia-sso/docs/skillhub-mclaw-integration.md`（或放在 mclaw 仓库下），说明：

```markdown
# mclaw 集成 SkillHub 用户私人 skill 库

## 配置
用户在 SkillHub 创建 PAT 后，写到 mclaw 配置（位置/格式由 mclaw 团队定）：
  MCLAW_SKILLHUB_URL=https://skillhub.mzsjai.com
  MCLAW_SKILLHUB_PAT=mzhk_pat_xxx

## sync 流程（建议实现）
1. 启动 / 定时（推荐每 30 分钟一次）：
   GET $URL/api/users/me/skills
   Authorization: Bearer $PAT
2. 对每条返回的 skill：
   POST $URL/api/install-tokens body={"skillId": <id>, "expiresInHours": 1}
3. 用返回的 installCommand 里的 capability URL 直接拉 SKILL.md：
   GET $URL/.well-known/agent-skills/i/<token>/<owner>/<slug>/SKILL.md
4. 写入 ~/.agents/skills/<owner>/<slug>/SKILL.md

## 注意
- PAT 泄露 = 用户所有 skill 暴露；建议 mclaw 配置文件 chmod 0600
- capability URL 一次性，**别缓存 URL 本身**，缓存的是 SKILL.md 内容
- 网络失败回退到本地缓存，不阻塞 agent 启动
```

## 十一、不做

- ❌ PAT 自动轮换（用户手动 revoke + 重建）
- ❌ PAT scope 细分（一律 user-level read-only-equivalent）
- ❌ rate limit on PAT calls（Phase 3）
- ❌ webhook（"我的 skill 更新了通知 mclaw"）—— pull 模型够
- ❌ mclaw 端的任何代码改动
