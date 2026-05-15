# AGENTS.md

本文件用于约束在本仓库内工作的 AI Agent、开发者和协作者。

目标是确保 `SkillHunt` 在产品方向、代码结构、文案语言、测试习惯和交付质量上保持一致，避免在迭代过程中再次退回到旧的 `SkillHub` 心智。

## 1. 项目定位

### 产品名称

- 项目当前产品名为：`SkillHunt`
- 不再使用 `SkillHub` 作为对外主品牌名称
- 如需提及历史阶段，可使用“原 SkillHub”或“SkillHub 阶段”描述演进背景

### 一句话定位

`SkillHunt 是一个面向 AI Agent Skills 的发布、发现与讨论平台。`

英文对外推荐文案：

`SkillHunt is a launch and discovery platform for AI agent skills.`

### 产品心智

本项目不应再被设计为“静态 skill 仓库”或“纯安装目录”。

后续设计、文案、交互和功能实现，必须优先服务以下心智：

- 发布新 skill
- 发现值得关注的 skill
- 围绕 skill 进行讨论和反馈
- 在发现之后完成安装

默认行为顺序应理解为：

`发布 -> 发现 -> 反馈 -> 安装`

而不是：

`上传 -> 存储 -> 安装`

## 2. UI 与文案约定

### 用户界面语言

- **所有用户界面默认使用中文**
- 包括但不限于：
  - 页面标题
  - 导航文案
  - 按钮
  - 表单标签
  - 错误提示
  - 空状态
  - 成功提示
  - 帮助文案
- 除非是有意保留的英文品牌词、技术协议名或行业通用术语，否则不要新增英文 UI

### 文案风格

- 面向真实用户，避免工程化黑话
- 优先清晰、直接、易理解
- 少用“系统内部视角”描述，多用“用户能做什么”描述
- 避免把页面写成文档中心或后台管理台口吻

### 产品表达方向

首页、详情页、发布页等核心页面，优先强调：

- 今日发布
- 推荐内容
- 趋势内容
- maker 身份
- 社区讨论

不要把以下内容作为页面第一优先级：

- 文件列表
- 原始 SKILL.md 内容
- 底层协议说明
- 面向开发者的实现细节

## 3. 仓库结构约定

当前仓库采用 monorepo 结构，核心目录含义如下：

- `apps/web`
  - 前端应用
  - 技术栈为 Vite + React
  - 负责所有用户可见界面与交互

- `apps/api`
  - 后端 API
  - 技术栈为 Hono + Bun + Drizzle + SQLite
  - 负责 skill 数据、认证、协议端点和社区能力

- `packages/shared`
  - 前后端共享类型或通用逻辑

- `scripts`
  - 数据灌种、开发脚本、辅助脚本

- `docs`
  - 产品定位、roadmap、设计说明和阶段文档

### 结构原则

- 前端页面逻辑优先放在 `apps/web/src/routes`
- 可复用组件放在 `apps/web/src/components`
- 后端数据库 schema 放在 `apps/api/src/db`
- 路由处理放在 `apps/api/src/routes`
- 服务层逻辑放在 `apps/api/src/services`
- 不要把大型业务逻辑散落在页面文件和路由文件里

## 4. 开发规范

### 改动原则

- 优先做与 `SkillHunt` 定位一致的改动
- 不要新增会强化“旧 SkillHub 仓库心智”的页面或文案
- 对已有功能做调整时，优先沿用现有结构，避免无必要大拆大改
- 不要为了短期展示效果引入与长期路线冲突的数据结构

### SSO 与第一方应用授权

- 统一登录由 Casdoor 负责，SkillHunt 只消费 Casdoor 已签发的用户身份。
- SkillHunt 的业务用户身份必须通过 `external_identities` 绑定，身份唯一键为：
  `provider + issuer + subject`。当前 provider 使用 `casdoor`。
- 对 Casdoor 应用级 issuer，应通过 `SKILLHUNT_SSO_IDENTITY_ISSUER` 归一到 Casdoor 基础
  issuer，避免 `mospace`、SkillHunt Web、未来 CLI 等入口把同一个 `sub` 拆成多个用户。
- Web OAuth、API bearer、未来 CLI bearer 都必须走同一个 `resolveSsoUser()` 入口，不要在
  路由或业务服务里直接用 `user.ssoSub` 临时拼接身份逻辑。
- `user.ssoSub` 仅作为 better-auth/session 兼容字段保留；新增身份判断、跨系统绑定、
  旧 `sub` 查询和自动建号都必须使用 `external_identities`。
- 项目未正式上线前，SSO 相关表结构调整应合并进初始建库结构并通过重建数据库生效；
  不要为旧 SSO 数据保留增量迁移或运行时 backfill 逻辑。
- Casdoor 负责证明“这个人是谁”；SkillHunt 负责决定“这个客户端能代表这个人做什么”。
- 在 Casdoor 当前不支持 Token Exchange 的情况下，SkillHunt API 采用正式的 first-party
  trusted client 模型：对来自 `mospace` 等内部应用的 Casdoor access token，严格校验
  `iss`、`exp`、`aud/azp/client_id` 后，再按本地可信客户端配置映射 API scopes。
- 可信客户端配置使用 `SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENT_IDS` 或
  `SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENTS`。默认只给
  `profile:read`、`skills:read`、`skills:read_private`、`skills:files:read`，不要默认给
  `skills:write`。
- 如果未来 Casdoor 支持 Token Exchange，可以新增面向 `skillhunt-api` audience 的 token
  路径，但不能推翻 `external_identities` 和 `resolveSsoUser()` 这条统一身份入口。

### 命名原则

- 对外品牌名统一使用 `SkillHunt`
- 代码中如果需要保留历史兼容命名，必须基于兼容性或迁移成本，而不是因为习惯
- 新增变量、组件、函数时，命名要体现“launch / discover / community”语义，而不是继续强化“hub / registry / install center”语义

### 文档原则

- 重要产品策略、阶段规划、信息架构变更应写入 `docs/`
- 涉及定位调整时，应同步更新相关文档，而不是只改代码
- 新增约定时，优先更新 `AGENTS.md`

## 5. 测试与验证要求

### 基本要求

只要改动了代码，提交前至少应完成与改动范围相匹配的验证。

推荐顺序：

```bash
pnpm typecheck
pnpm lint
pnpm test
```

若涉及前后端联动、页面结构或接口行为变化，建议进一步执行：

```bash
pnpm dev
bash scripts/smoke.sh
```

### 数据库相关要求

如果修改了 schema、migration 或依赖数据库的数据流，必须注意：

- 开发库 migration 要可执行
- 测试库 migration 要可执行
- 本地 dev 数据库若为空或被删除重建，统一运行 `pnpm db:setup`，不要手动拆成多条
  seed 命令

常用命令：

```bash
pnpm db:setup
pnpm db:migrate:test
pnpm db:setup:bridge
```

### 前端改动要求

如果改动了用户可见页面，至少要确认：

- 页面能正常打开
- 没有明显布局错乱
- 中英文文案没有混乱
- 主要操作路径可点击
- 空状态、错误状态、加载状态没有明显失真

## 6. 提交与分支约定

### 提交信息

- 使用**约定式提交**
- **提交注释使用中文**

示例：

- `feat: 首页切换为 SkillHunt 发现页`
- `fix: 修复登录态查询缺少 session 表的问题`
- `docs: 补充 SkillHunt 项目定位与路线图`

### 分支约定

- 新分支命名应语义清晰
- 默认使用功能类型前缀，例如 `feat/xxx`、`fix/xxx`、`docs/xxx`、`chore/xxx`
- 不要默认使用 `codex/` 作为分支前缀，除非用户明确要求
- 当前产品方向相关分支可在名称中体现 `skillhunt` 或具体功能语义

## 7. 设计与交互约定

### 设计方向

SkillHunt 的设计应更接近“发现平台”而不是“后台工具站”。

优先鼓励：

- 更强的内容发现感
- 更清晰的榜单/推荐结构
- 更突出的 maker 信息
- 更明显的社区互动入口

应谨慎避免：

- 过重的后台管理感
- 全站只剩表格和技术字段
- 页面第一屏只有安装命令和文件树
- 把产品做成纯文档目录

### 页面优先级

核心页面的优先级应保持：

1. 首页
   - 发现
   - 推荐
   - 趋势

2. 详情页
   - skill 是什么
   - 为什么值得关注
   - 谁发布的
   - 如何安装

3. 发布页
   - 发布一个新 skill
   - 清楚介绍它的价值
   - 再上传和补充文件

## 8. AI Agent 特别要求

如果你是 AI Agent，请严格遵守以下规则：

- 不要擅自把产品重新描述为 `SkillHub`
- 不要默认新增英文用户界面
- 不要把“技术正确”凌驾于“产品定位一致”之上
- 做改动前优先判断这项改动是否符合 `SkillHunt` 的方向
- 若改动涉及定位、信息架构或用户心智，优先更新 `docs/` 或 `AGENTS.md`
- 若发现数据库、migration、seed 或 dev 环境异常，应优先修复环境，使项目保持可运行状态

## 9. 发生冲突时的优先级

如果不同文档出现冲突，优先级按以下顺序判断：

1. `AGENTS.md`
2. 最新的 `docs/skillhunt-positioning.md`
3. 最新的 `docs/skillhunt-roadmap.md`
4. 旧的 SkillHub 阶段文档

如果旧文档与 `SkillHunt` 定位冲突，应以 `SkillHunt` 相关文档为准，并尽快清理旧内容。
