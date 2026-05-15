# 更新日志

本项目遵循语义化版本号。发布说明使用中文维护。

## v0.1.0 - 2026-05-15

这是 SkillHunt 的第一个版本化发布，标志着项目从早期 SkillHub 阶段进入以“发布、发现、反馈、安装”为主路径的 SkillHunt 阶段。

### 新增

- 新增 Skills 包发布、发现、详情、版本与安装能力，支持 Skill 与 Skills 包统一展示。
- 新增发布对象模型，将 Skill 与 Skills 包抽象为统一的 publishable 资源，便于后续扩展更多可发布内容。
- 新增 Casdoor SSO 统一身份绑定模型，通过 `external_identities` 按 `provider + issuer + subject` 解析用户身份。
- 新增 first-party trusted client 授权模型，用于支持 Mospace 等内部应用访问 SkillHunt API。
- 新增 `db:setup` 标准初始化命令，统一执行数据库建表与内置 Skill 种子写入。
- 新增内置 Skill 数据种子，数据库重建后可自动写入官方预置 Skill。

### 优化

- 优化发现页、详情页、个人页、通知页和发布页体验，让 SkillHunt 更贴近发布与发现平台。
- 优化首次发布流程，创建 Skill 时不再展示版本发布说明卡片。
- 优化 Skill 与 Skills 包的卡片展示、版本信息、社区互动与安装入口。
- 统一使用 Twemoji 渲染图标，改善不同平台上的图标一致性。
- 更新 API 参考文档与项目约定，明确 SSO、数据库初始化和产品定位规则。

### 移除

- 移除旧的 API v1 路由实现与旧式 SkillHub 兼容心智中的部分临时逻辑。
- 移除历史增量迁移文件，当前未上线阶段使用新的初始建库结构直接重建数据库。

### 部署说明

- 本版本需要使用新的初始数据库结构；已有测试或开发数据库应删除后执行 `pnpm db:setup`。
- 生产环境需确认 `OIDC_ISSUER`、`SKILLHUNT_SSO_IDENTITY_ISSUER` 与可信客户端配置已正确设置。
