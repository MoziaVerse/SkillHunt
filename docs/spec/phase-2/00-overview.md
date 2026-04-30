# SkillHub · Phase 2 · Overview

> 本文档是 Phase 2 的总纲。所有子 spec 遵循本文定义的目标、定位和约束。
>
> 交付物：把 SkillHub 从"Mozia 团队封装的精品货架"升级为"Mozia 生态的 skill registry backend + 用户个人 skill 仓库"，并完成与 matrix（深度嵌入）+ mclaw（API 预留）的初始集成。

---

## 一、Phase 2 的战略定位

经内部讨论，SkillHub 在 Mozia 生态里同时承担**三个职能**：

| # | 职能 | 内容来源 | 主要消费者 |
|---|---|---|---|
| 1 | **Mozia 第一信息源** | Mozia 团队封装的 owned skill | SkillHub 自家前端 + matrix + 公网 |
| 2 | **生态 skill registry backend** | 1 + 3 的统一目录 | matrix（嵌入式 skill 商店）+ mclaw（运行时 user skill 库）|
| 3 | **用户个人 skill 仓库** | mozia-sso 用户自助上传 | 用户自己（private） + 公网（public） |

**与公开 skills.sh 的两点差异：**
1. 包含 Mozia 团队封装的 owned skill，作为第一信息源（变相宣传 Mozia 产品/方法论）
2. 与 matrix/mclaw **原生集成**——matrix 嵌一个"skill 商店"页直接消费 SkillHub API；mclaw 用 SkillHub 当用户私人 skill 库

**职能 3 借鉴 git 仓库范式：**
- `public` = 任何人在 SkillHub 列表可见、可 `npx skills add` 安装
- `private` = 仅 owner 自己可见可用（在自己的 mclaw / 自己的浏览器）

不引入 `internal` 第三档——"实在不适合公开的我们也不会直接上传到这里"。

## 二、关键架构决策

### 决策 1：visibility 简化为 `public` / `private` 两档

**取消** Phase 1 引入的 `internal` 概念。Phase 1 完成的 mozia-sso group 鉴权工作不浪费——它的代码骨架（`getAuthContext`、cookie session、SSO 集成）继续承载 Phase 2 的用户身份；只是 `canSeeInternal` 这条判定支线删除。

详见 [`01-visibility-cleanup.md`](./01-visibility-cleanup.md)。

### 决策 2：slug 命名空间走 `<owner>/<slug>`

对齐 git / GitHub / npm 的命名空间传统，避免长期撞名问题：

```
旧：  /skills/project-mental-map
新：  /skills/mozia/project-mental-map        ← Mozia 第一方
新：  /skills/zeo/my-private-helper           ← 用户上传
```

owner 部分使用 SSO 用户的 short identifier（取 `name` 或派生）。Mozia 第一方 skill 使用统一 owner `mozia`（一个虚拟"组织"账户）。

详见 [`02-user-upload.md`](./02-user-upload.md) 第三节。

### 决策 3：API-first，前端是 consumer 之一

SkillHub 的 `/api/skills*` 是**多 consumer 服务**，不是只服务自己前端。这意味着：

- 所有 endpoint 必须能用 PAT（personal access token）认证，不只是 cookie
- DTO 形状要稳定且向后兼容（matrix 和 mclaw 都依赖它）
- 文档化 API contract（OpenAPI 风格的轻量 markdown 即可，不强制 swagger）

### 决策 4：matrix 走深度嵌入，mclaw 走 API 预留

| 集成 | 形态 | 这次做什么 | 谁动手 |
|---|---|---|---|
| matrix | 在 matrix 里复用 `Explore.tsx` 模式做"skill 商店"页，backend 加 `/api/skills*` proxy 到 SkillHub | matrix backend + frontend 改动；SkillHub 配合提供 CORS / auth-passthrough | SkillHub + matrix 协同 |
| mclaw | 仅在 SkillHub 这边**预留 API**（`GET /api/users/me/skills` + capability URL）+ PAT 创建 UI；mclaw 的 sync loop 后续他们自己接 | SkillHub 单方面完成 API 预留 | SkillHub |

详见 [`03-mclaw-api.md`](./03-mclaw-api.md) 和 [`04-matrix-embed.md`](./04-matrix-embed.md)。

### 决策 5：private skill 的 CLI 安装走 capability URL

`skills` CLI 不支持 `--token` flag 也不支持 device flow（已确认）。private skill 的 `npx skills add` 安装路径靠**网页 → 复制带 token 的安装命令 → CLI 当普通 URL 处理**。

```
[网页详情页（已登录, 是 owner）]
  → 点 "Copy install command"
  → 后端 mint 一次性 token (24h TTL, 1 use)
  → 剪贴板: npx skills add http://skillhub.../i/<token> --agent claude-code -y
  → 终端粘贴执行 → token 失效
```

详见 [`03-mclaw-api.md`](./03-mclaw-api.md) 第四节（capability URL 协议是 mclaw 集成和 private 安装共用的机制）。

## 三、技术栈

继续严格对齐 Phase 0 + Phase 1 的栈，**无新增依赖**：Bun + Hono + Drizzle + Zod + better-auth + React 19 + Tailwind + Biome。

## 四、Phase 2 明确不做的事

防 scope creep，列出延后到 Phase 3+ 的事：

- ❌ skill 安装数 / 浏览数 / 评分 / 评论
- ❌ trending / featured / 推荐算法
- ❌ skill 多版本（version pinning）
- ❌ 举报 / 审核工作流 / 内容治理后台
- ❌ skill 的二进制资源（图片、模型权重）→ 仍走 `skill_files.content` text 列；后续真有需求再上对象存储
- ❌ mclaw 端的 sync loop 实现（API 这边预留即可）
- ❌ 用户协议 / 隐私政策（公开市场化产品才需要）
- ❌ author 头像 / bio / homepage（取 SSO profile 的就够，不再额外存储）

## 五、子 spec 依赖图

```
01-visibility-cleanup（删 internal 残留，1d）
    ↓
02-user-upload（schema + CRUD API + 前端发布表单 + 作者命名空间，5d）
    ↓
    ├── 03-mclaw-api（PAT + capability URL + /api/users/me/skills，3d）
    └── 04-matrix-embed（matrix backend proxy + frontend 复用，4d）
```

**01 阻塞所有后续**——必须先把 visibility 模型简化到位，否则 02 schema 改起来会和 internal 残留打架。

**03 和 04 互相独立**，可并行开两条线。

## 六、交付物清单

Phase 2 完成时：

1. visibility enum = `('public', 'private')`，旧 internal 数据已迁移
2. `skills` 表加 `owner_user_id`（FK 到 `skillhub.user.id`），slug 在 `(owner, slug)` 上唯一
3. 新增 endpoint：
   - `POST /api/skills` — 创建（需登录）
   - `PUT /api/skills/:owner/:slug` — 更新（需 owner）
   - `DELETE /api/skills/:owner/:slug` — 删除（需 owner）
   - `POST /api/skills/:owner/:slug/files/:path` — 上传/替换文件
   - `GET /api/users/me/skills` — 当前登录用户的所有 skill（公私通取）
   - `GET /api/users/:owner/skills` — 公开用户的 public skill 列表
   - `POST /api/install-tokens` — mint capability URL token
   - `GET /i/:token/.well-known/agent-skills/...` — capability URL serve
   - `POST /api/personal-access-tokens` + `DELETE /api/personal-access-tokens/:id` — PAT CRUD
4. 前端新增：
   - `/publish` — 发布表单（创建 owned skill）
   - `/u/:owner` — 作者页（该用户的 public skill 列表 + 自己看时还看到 private）
   - `/settings/tokens` — PAT 管理页
   - 详情页加 "Copy install command" 按钮（含 capability URL 流程）
5. matrix 那边新增：
   - `/api/skills*` proxy（matrix backend → SkillHub backend）
   - `/app/skills` 页面（复用 `Explore.tsx` 模式）
   - sidebar 加一项 "Skill 商店"
6. **没有** mclaw 改动——只确保 SkillHub 那边 `/api/users/me/skills` + capability URL + PAT 全部能用，等 mclaw 团队接

## 七、不向后兼容的破坏性变更

需要提前广播给（潜在的）现有 consumer：

| 变更 | 影响 | 缓解 |
|---|---|---|
| URL 从 `/skills/<slug>` → `/skills/<owner>/<slug>` | 旧链接 404 | 加临时路由 `/skills/<slug>` → 302 到 `/skills/mozia/<slug>` 或全局搜索（Phase 2 内置）|
| `npx skills add http://skillhub --skill <slug>` 旧形式 | CLI 找不到 skill | well-known endpoint 新增 fallback：旧 slug 全部前缀 `mozia/`；后续 deprecation 周期再去掉 |
| visibility enum 删 `internal` | DB 里 internal 记录被改成 public | 现存只有 1 条 seed 演示用 `internal-rfc-writer`，迁移成 public 即可；写在 01 里 |

## 八、验收线

Phase 2 三个 demo 走完即认为完成：

1. **Demo A（用户上传 + 私域分发）**
   - Zeo 用 mozia-sso 登录 SkillHub → `/publish` 页面贴 SKILL.md → 选 private 保存 → 在 `/u/zeo` 看到自己的 skill
   - 详情页点 "Copy install command" → 终端粘贴 → SKILL.md 落到 `~/.claude/skills/zeo/<slug>/`

2. **Demo B（matrix 嵌入式 skill 商店）**
   - Zeo 在 matrix 左侧 nav 看到"Skill 商店" → 点开看到和 SkillHub 一样的列表（视觉是 matrix 风格）→ 详情页能看 SKILL.md → 点安装显示安装命令

3. **Demo C（mclaw API 预留可用）**
   - Zeo 在 SkillHub `/settings/tokens` 创建一个 PAT
   - 用 `curl -H "Authorization: Bearer <pat>" http://skillhub/api/users/me/skills` 拿到自己的 skill 列表（含 private）
   - 用 capability URL 单独拉取一个 SKILL.md 文件
