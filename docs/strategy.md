# SkillHub · 战略与路线图

> 受众：技术团队 / 跨产品（matrix · mclaw · mozia-sso）/ 上级管理层
> 用途：一文了解 SkillHub 是什么、为什么做、做到了哪、接下来去哪、需要谁配合
> 维护：每个 Phase 节点更新一次；当前快照 = Phase 1 完成、Phase 2 spec 已立

---

## TL;DR（30 秒）

**SkillHub 是 Mozia 生态里的 agent skill 注册中心。**它有三个面孔：(1) Mozia 团队封装的 skill 第一信息源（兼软宣传）；(2) 整个 Mozia 生态共享的 skill 后端（matrix 嵌入式商店 + mclaw 用户私人 skill 库）；(3) Mozia 用户自己上传 skill 的个人仓库（git 风格 public/private）。

**当前进度**：Phase 0（本机能跑通的 mini skills.sh）✓ 完成；Phase 1（mozia-sso 接入 + 远程测试服 SSO 联调）✓ 完成；**Phase 2**（用户上传 + matrix 嵌入 + mclaw API 预留）spec 已写完，**预计 2-3 周交付** 7-9 个工作日的核心，外加 matrix 那边并行 2-3 天。

**最大的协同点**：matrix 团队需要在自家 backend + frontend 接入一个 proxy + 复用现有 `Explore.tsx` 模式做 "Skill 商店"页；mclaw 团队这次**不用动**，等他们之后接 SkillHub 给的 API。

---

## 一、SkillHub 是什么

**一句话**：Mozia 生态里的 agent skill 注册 + 分发中心，对标公开生态里的 [skills.sh](https://skills.sh)，但定位是 **Mozia 旗下基础设施**。

### 三种身份并存

| 身份 | 内容来源 | 主要消费者 |
|---|---|---|
| **(1) Mozia 第一信息源** | Mozia 团队封装的 owned skill | SkillHub 自家前端 + matrix 内嵌商店 + 公网 |
| **(2) 生态 skill registry** | (1) + (3) 的统一目录 | matrix 商店页 / mclaw runtime 拉取用户 skill |
| **(3) 用户个人 skill 仓库** | mozia-sso 用户自助上传 | 用户自己（private）+ 公网（public）|

### 与 skills.sh 的两点核心差异

1. **包含 Mozia 第一方内容**——团队封装的 skill 在这里有"出品方"印章，对外起到产品/方法论展示作用
2. **与 matrix/mclaw 原生集成**——不是孤立站点，是 Mozia 这套 agent 工具链的内嵌组件

### 不是什么

避免被错位理解：

- **不是公开的开放市场**——没有第三方机构入驻、没有交易、不做内容审核工作流
- **不是 npm/pypi 那种代码包仓库**——skill 是 markdown 文档（SKILL.md）+ 可选附件，不是可执行 binary
- **不是替换 anthropic.com/skills**——后者是 Anthropic 官方的全球公开仓库，我们对内 + 对接 Mozia 自己的工具

---

## 二、为什么做（业务理由）

| 角度 | 说明 |
|---|---|
| **拓展 Mozia 工具链** | matrix（应用商店 + 部署引擎）+ mclaw（agent runtime）+ SkillHub 形成"能用 / 能装 / 能部署"的完整链路 |
| **第一方内容分发** | Mozia 团队产出的 skill（产品方法论、行业模板、内部最佳实践）有官方分发通道，不必散落在各处 |
| **用户粘性** | mozia-sso 用户在 SkillHub 上传 skill → 自动同步到 mclaw → 在 matrix 部署的应用里调用，**生态闭环**，提高用户留存 |
| **轻量级软宣传** | 公开的 owned skill 在 SEO + 社区分享时挂 "Mozia 出品" 标识，**变相产品营销**，零额外投入 |

---

## 三、当前状态（Phase 0 + Phase 1 已完成）

### Phase 0 · 本机骨架（✓ 完成）

- `skillhub.skills` + `skillhub.skill_files` schema 就位
- API：`/api/skills` 列表、`/api/skills/:slug` 详情、`/api/tags`
- 协议端点：`/.well-known/agent-skills/index.json`、`/.well-known/agent-skills/:slug/SKILL.md`
- 前端：列表页 + 详情页 + Docs（参照 skills.sh 排行榜布局）
- 数据：5 owned skill（Mozia 团队封装）+ 4 referenced skill（精选引用 anthropics/skills）
- CLI 兼容：`npx skills add http://localhost:3333 --skill <slug> --agent claude-code -y` 端到端可用

### Phase 1 · 接入 mozia-sso（✓ 完成）

- 后端 better-auth + generic OIDC 接 mozia-sso（Casdoor）
- 测试服 SSO（`116.136.189.21:8778`）已注册 application `mozia-skills-hub`，client_id/secret 已联调
- 用户能在网页 Sign in / Sign out，cookie session 工作
- 老的 `internal` visibility tier（mozia-members 才能看）实现完成 —— 但 Phase 2 会废弃这一档，简化为 public/private（详见路线图）

### 已部署位置

- 本地开发：`localhost:3333`（api）+ `localhost:5180`（web）+ `localhost:36915`（pg）+ `localhost:8778`（local Casdoor，可选）
- 测试服 SSO：`http://116.136.189.21:8778`（已对接）
- **SkillHub 测试服部署**：尚未；Phase 2 同期推进

### 文档与代码索引

- 仓库：`/Users/apple/Desktop/work/Mskills`（本地路径；远程仓库 `MoziaVerse/mozia-skillhub`）
- Phase 0 spec：`docs/spec/phase-0/`（00 总纲 + 01-07 子 spec）
- Phase 1 spec：`docs/spec/phase-1/01-auth.md`
- Phase 2 spec：`docs/spec/phase-2/`（00 总纲 + 01-04 子 spec）
- mozia-sso 对接手册：`/Users/apple/Desktop/work/mozia-sso/docs/skillhub-onboarding.md`（分支 `feat/skillhub-onboarding-doc`）
- 本地启动 / 测试 / 故障排查：仓库根 `README.md`

---

## 四、Phase 2 路线图（进行中）

### 目标

把 SkillHub 从"工程师 PR + seed JSON"的内部货架，升级为：
1. 用户能自助发布 skill（git 风格 public/private 命名空间 `<owner>/<slug>`）
2. matrix 内嵌一个 "Skill 商店" 页，无缝消费 SkillHub 数据
3. mclaw 接入所需的 API + capability URL + PAT 全部预留好

### 子 Spec 拆分

| Spec | 内容 | 估计 | 阻塞关系 |
|---|---|---|---|
| **01 · visibility cleanup** | 删 internal tier、迁数据、清 Phase 1 残留 | 0.5-1d | 阻塞所有 |
| **02 · user upload** | schema 加 owner_user_id；CRUD API；前端发布表单 + 作者页；slug 命名空间迁移 | 5-7d | 依赖 01 |
| **03 · mclaw API** | PAT 系统；capability URL；`/settings/tokens` UI；mclaw 自己**不动** | 3d | 依赖 02 |
| **04 · matrix embed** | matrix backend proxy + service-account PAT + acting-user header；matrix frontend 复用 `Explore.tsx` | SkillHub 1.5d + matrix 2-3d | 依赖 02，与 03 并行 |

**SkillHub 总计 7-9 工作日；matrix 团队额外 2-3 天**。

### 三个验收 Demo

- **Demo A**（用户上传 + 私域分发）：登录 → `/publish` 写 SKILL.md 选 private → 在 `/u/zeo` 看到 → 详情页"Copy install command" → 终端粘贴 → SKILL.md 落 `~/.claude/skills/zeo/<slug>/`
- **Demo B**（matrix 嵌入式 skill 商店）：matrix 左侧 nav 看到"Skill 商店" → 点开看到列表（matrix 视觉风格）→ 详情 + 安装命令
- **Demo C**（mclaw API 预留可用）：在 `/settings/tokens` 创 PAT → `curl -H "Authorization: Bearer <pat>" /api/users/me/skills` 拿到自己 skill → capability URL 拉单个 SKILL.md

### 同期推进的运维事项（不算 Phase 2，但同步落地）

- **测试服部署**（同域反代避免跨域 cookie，2-3 小时）
- **撤掉调试日志**（auth.ts 里的 `[oidc-profile-debug]` 必须在生产前删除，防止 PII 泄露）
- **真实 internal skill 内容补 5-10 条**（手动通过 seed JSON + git PR）

---

## 五、跨团队依赖

### mozia-sso（Casdoor）

**已完成的对接**：
- 测试服注册 application `mozia-skills-hub`
- redirect URI 走通配 regex（`^https?://localhost...`），新部署 IP 无需逐条加白名单
- Token 字段已配齐（email / displayName / phone / Owner / Groups / roles / permissions / IsAdmin / Affiliation 等 12 项）

**Phase 2 期需要 mozia-sso 协助的事**：
- **生产 application 注册**（部署生产时一次性，redirect URI 加生产域名）
- 暂无其他改动需求

### matrix

**Phase 2 期需要 matrix 团队做的事**（Spec 04）：

| 任务 | 工作量 | 谁动 |
|---|---|---|
| backend 加 `/api/skills*` proxy router | 0.5d | matrix 工程师 |
| 把现有 `Explore.tsx` 抽成可复用 `<MarketplaceList>` 组件 | 1d | matrix 工程师 |
| 新增 `Skills.tsx` 页 + sidebar 加"Skill 商店"入口 | 0.5d | matrix 工程师 |
| 配置 SKILLHUB_URL + SKILLHUB_SERVICE_PAT env | 0.1d | matrix devops |
| 联调 | 0.5d | 双方 |

**关键技术决策需要 matrix owner 同意**：service account PAT + `X-Acting-User-Sub` header 的 proxy 模式（避免跨域 cookie 复杂度）。

### mclaw

**Phase 2 期 mclaw 团队不需要做任何事**——SkillHub 单方面把 API 准备好（Spec 03），等 mclaw 团队后续节奏接入。

**Phase 3+ 期 mclaw 需要做的事**（参考性，不强制时间表）：
- 在 mclaw 配置加 `MCLAW_SKILLHUB_URL` + `MCLAW_SKILLHUB_PAT`
- 启动时 / 定时 sync：调 `/api/users/me/skills` → mint capability URL → 拉 SKILL.md → 写到 `~/.agents/skills/<owner>/<slug>/`
- mclaw 改 `ensureBundledSkillsInstalled()` 加远程 sync 路径

**预计 mclaw 端工作量**：1-1.5 天（参考 SkillHub spec 03 第十节给出的 mini doc）。

---

## 六、关键技术决策（备查）

### 为什么 visibility 选 git 风格 public/private 而不是三档

讨论过 `(public / internal / private)` 三档方案，最终选 `(public / private)` 两档：
- "实在不适合公开的内容也不会上传到这里"——内部敏感内容走 mozia 自家其他渠道，SkillHub 不承载
- 模型简单 + 用户心智一致（git/GitHub 标准）
- Phase 1 的 internal 鉴权代码作为"练手"完成了 mozia-sso 集成，技术成果保留，业务概念废弃

### 为什么走 capability URL 而不是 fork `skills` CLI 加 `--token`

- `skills` CLI 是上游开源项目，要让用户改 ~/.skillsrc 或 fork CLI 摩擦巨大
- capability URL 让 CLI 看到的就是普通 URL，鉴权对 CLI 完全透明
- 单次 + 24h TTL，泄露面最小
- 同样的机制可以服务 mclaw（mclaw 通过 PAT 列举后给每条 mint 短期 capability URL）

### 为什么 matrix 集成走深度嵌入而不是简单链接

- 简单链接（matrix nav 跳到 SkillHub）UI 风格不匹配，体验割裂
- matrix 已有 `Explore.tsx` 是成熟的 marketplace 组件，复用成本低
- 服务端 proxy 解决跨域 cookie 问题，比 frontend 直连 + CORS 简单可靠

### 为什么 mozia 第一方内容用 virtual user 而不是 organization 表

- Phase 2 只需要 "Mozia 第一方" + "用户个人" 两类 owner，没有第三种聚合需求
- organization 表会带来 membership / role / billing 一整套，YAGNI
- 后续真有第三方机构需求（matrix 团队？mclaw 团队？），再升级 schema 不晚

---

## 七、风险与未决项

### 已识别风险

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| matrix proxy 是单点；SkillHub 挂了 matrix skill 商店也挂 | 中 | matrix proxy 降级时返"暂时不可用"友好页 |
| service account PAT 泄露 → 可 spoof 任何用户身份 | 高 | PAT 加 IP allowlist（matrix 出口 IP）；定期轮换；secret manager |
| skill 跑在用户终端有 agent 完整权限 → 恶意 skill 可执行任意代码 | 高 | "对齐市场"模式：CLI 输出 warning（已有）；事后举报 + admin 下架（Phase 3）|
| mclaw 现在没有用户身份层，集成需要 mclaw 自己加 | 中 | Spec 03 完整给出 mini doc；mclaw 团队按节奏接 |
| 测试套件 TRUNCATE 表 → 误在生产跑测试会冲数据 | 高 | 部署机器不装 dev 依赖；CI 严格隔离测试 DB |

### 未决项（需要决策）

| # | 议题 | 待决方 | 阻塞性 |
|---|---|---|---|
| 1 | 生产域名（`skillhub.mzsjai.com`？）| 业务方 | 测试服部署可以先用 IP，但 SSO 注册和 cookie 域名最终需要 |
| 2 | matrix 团队是否同意 proxy + service account 模式 | matrix owner | Spec 04 |
| 3 | mclaw 团队接 SkillHub 的优先级 | mclaw owner | Phase 3 节奏 |
| 4 | 内容运营：谁负责给 Mozia 第一方账号上传 5-10 条真实 skill | 业务方 | Demo 完整性 |
| 5 | 是否做"跨团队 organization"概念（让 matrix / mclaw 也能以机构身份发 skill）| Phase 3 决定 | 不阻塞 Phase 2 |

---

## 八、资源诉求

| 资源 | 阶段 | 量 |
|---|---|---|
| SkillHub 工程 | Phase 2 完整交付 | 7-9 工作日（一人） |
| matrix 工程 | Spec 04 协同 | 2-3 工作日 |
| 测试服 / 生产服 PG 实例 | 部署期 | 1 个 PG database（建议复用 mozia-sso 同实例的不同 DB）|
| 域名 | 部署期 | `skillhub-test.mzsjai.com` + 后期 `skillhub.mzsjai.com`（HTTPS 必需）|
| 内容 | 上线前 | 5-10 条真实 owned skill 内容（业务/运营产出）|

---

## 九、长远展望（Phase 3+，仅作参考）

不在当前承诺范围，列出来是为对齐"长期方向"：

- **发现机制**：install count、trending、按 tag 浏览、首页编辑精选
- **治理工具**：举报、admin 后台审核队列、内容下架、用户封禁
- **多版本支持**：skill 的 v1/v2/latest pinning
- **organization 概念**：matrix 团队、mclaw 团队、第三方合作机构作为 skill publisher
- **mclaw 深度集成**：mclaw 端的 sync loop 实现 + 配置 UI
- **API 文档化**：OpenAPI / 公开开发者文档
- **审计与合规**：用户协议、内容政策、DMCA / 投诉处理流程

哪条优先取决于 Phase 2 上线后的真实使用反馈，**不预设时间表**。

---

## 附录：术语表

| 术语 | 含义 |
|---|---|
| **owned skill** | 内容（SKILL.md + 文件）托管在 SkillHub 自己 DB 的 skill |
| **referenced skill** | 内容在外部仓库（如 GitHub `anthropics/skills`），SkillHub 只存元数据 + 跳转链接 |
| **owner** | skill 的发布主体；user 表里的一行（真人 user 或 virtual `mozia` 这样的聚合身份）|
| **capability URL** | 短期一次性 URL，URL 本身就是凭据；用于 CLI 安装 private/internal skill |
| **PAT (Personal Access Token)** | 长期 token，用户在 `/settings/tokens` 创建；mclaw 等外部工具用它代用户身份调 SkillHub API |
| **service account** | SkillHub user 表里的特殊行（`account_type='service'`）；matrix backend 用它的 PAT + `X-Acting-User-Sub` header 替真实用户访问 |
| **`mozia` virtual user** | user 表里 `is_virtual=true` 的聚合身份，代表"Mozia 团队"；具有发布权限的工程师在 `canPublishAs=['mozia']` 列表里，能发 `mozia/<slug>` |
| **mozia-sso** | Mozia 团队的统一身份提供商，基于 Casdoor fork |
| **matrix** | Mozia 旗下应用部署平台，已有"应用商店"模块 |
| **mclaw** | Mozia 旗下 agent runtime，基于 ACP 协议 |
