# Skillhunt 项目定位

## 一句话定位

**Skillhunt 是一个面向 AI Agent Skills 的发布、发现与讨论平台。**

对外英文版本建议统一为：

> **Skillhunt is a launch and discovery platform for AI agent skills.**

如果需要更有社区感和 Product Hunt 气质的版本，可以使用：

> **Launch, discover, and discuss the best new skills for AI agents.**

## 产品定位

Skillhunt 不再只是一个 skill 的存储、管理和安装中心，而是一个围绕 **新 skill 发布** 和 **社区发现机制** 构建的平台。

它的核心目标不是“收录更多 skill”，而是：

- 帮助 skill maker 发布自己的新 skill 或重大更新
- 帮助用户发现值得关注和尝试的 skill
- 通过投票、评论和榜单机制形成社区反馈
- 在发现和讨论之后，再完成安装与使用

## 与 SkillHub 的核心区别

SkillHub 更偏向：

- skill registry
- skill directory
- skill installation center
- 文档与文件驱动的分发平台

Skillhunt 更偏向：

- launch platform
- discovery feed
- community leaderboard
- maker 与用户互动的平台

简化来说：

- **SkillHub 关注“这个 skill 在哪里、怎么装”**
- **Skillhunt 关注“今天有什么值得关注的新 skill、大家怎么看”**

## 核心心智

Skillhunt 需要建立的新用户心智是：

> 这里不是一个静态技能仓库，而是一个每天都能发现新技能的地方。

因此产品重心需要从以下内容前移：

- 今日发布
- Featured / Trending
- Upvotes
- Comments
- Maker identity
- 社区讨论

而以下内容应继续保留，但降级为后置能力：

- 安装命令
- 文件列表
- SKILL.md 原文
- 协议兼容能力

## 目标用户

Skillhunt 的核心用户可以分为两类。

### 1. Makers

即 skill 的创建者、封装者、维护者。他们希望：

- 发布自己的新 skill
- 获得曝光
- 收集反馈
- 积累口碑和社交证明

### 2. Hunters / Users

即发现和尝试新 skill 的用户。他们希望：

- 快速看到最近值得关注的 skill
- 通过榜单和评论判断是否值得尝试
- 在少量上下文里理解 skill 的用途和价值
- 最后再决定是否安装

## 核心产品行为

Skillhunt 的最小闭环应该是：

1. Maker 发布一个新 skill
2. 社区用户看到这个 skill
3. 用户投票、评论、讨论
4. 平台形成今日榜单或趋势信号
5. 感兴趣的用户进一步安装和使用

这意味着产品的核心行为顺序应当从：

`上传 -> 存储 -> 安装`

转变为：

`发布 -> 发现 -> 反馈 -> 安装`

## 首页应传达的价值

首页不应该再主要表达“搜索和管理 skill”，而应该表达：

- 今天有什么新 skill
- 哪些 skill 正在被讨论
- 哪些 skill 获得了更多认可
- 哪些 maker 正在发布有意思的东西

首页的默认体验应更接近：

- Today
- Featured
- Trending
- New launches

而不是一个纯粹的目录搜索页。

## 详情页应传达的价值

详情页不应该优先展示文件树和技术细节，而应该优先回答：

- 这是什么 skill
- 适合谁
- 为什么值得关注
- 别人怎么看
- 怎么安装

建议优先级顺序为：

1. 标题 + tagline / 简介
2. maker 信息
3. upvote / comment / 社区信号
4. 使用场景 / demo / 亮点
5. 安装方式
6. 文件内容 / SKILL.md / extras

## 当前阶段建议

在当前仓库阶段，Skillhunt 最重要的不是一次性做完整社区系统，而是先完成心智切换：

- 把名字从 SkillHub 切换到 Skillhunt
- 把“目录/仓库”叙事切换为“发布/发现”叙事
- 把首页、发布页、详情页改造成围绕 launch 和社区反馈的结构

只有在这个产品定位稳定之后，再继续往更复杂的榜单、推荐和反作弊机制推进，才不会反复返工。
