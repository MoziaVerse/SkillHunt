# SkillHunt Skill 包设计

## 目标

Skill 包用于把同一使用场景下会一起安装的多个 skills 组织成一个发布对象。

第一版优先服务 `npx skills add` CLI，不新增自定义安装协议，不要求 CLI 理解 SkillHunt 专属 manifest。

## 核心设计

Skill 包在产品层是一个独立发布对象，在协议层表现为一个标准 well-known skills source。

示例：

```bash
npx skills add https://skillhunt.mozia.ai/p/alice/video-case-suite --list
npx skills add https://skillhunt.mozia.ai/p/alice/video-case-suite --skill '*' -y
```

对应协议端点：

```text
GET /p/:owner/:packageSlug/.well-known/agent-skills/index.json
GET /p/:owner/:packageSlug/.well-known/agent-skills/:skillName/SKILL.md
GET /p/:owner/:packageSlug/.well-known/agent-skills/:skillName/:file
```

这样 `npx skills` 可以原生完成列出、筛选和整包安装。

## 数据模型

- `skill_packages` 存储包的发布信息、归属者、可见性和展示字段。
- `skill_package_items` 存储包内 skills、排序、说明和可选的 release 锁定。

第一版不复制 skill 文件，安装时从包内 skill 的当前文件或 pinned release 快照读取。

## 可见性规则

- 公开 Skill 包只能包含公开 owned skills。
- referenced skills 第一版不加入包，因为 SkillHunt 不持有其文件内容，无法稳定通过 well-known 路由供 CLI 安装。
- 私有 Skill 包可以在 API 中存在，但不会暴露到公开 package well-known 路由。

## 发布入口

`/publish` 是统一发布入口，用户先选择：

- 发布一个 Skill
- 发布一个 Skill 包

再进入对应表单，保持 SkillHunt 的“发布 -> 发现 -> 反馈 -> 安装”心智一致。
