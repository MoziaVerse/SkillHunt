# Skillhunt 改造 Roadmap

## 目标

把当前偏向 skill registry / directory 的 SkillHub，逐步改造成更接近 Product Hunt 模式的 **Skillhunt**：

- 面向 AI agent skills 的发布平台
- 以发现、投票、评论和趋势榜单为核心
- 安装能力继续保留，但不再是唯一主线

## 总体原则

- 先改产品定位，再改视觉
- 先改信息架构，再补复杂机制
- 先做最小社区闭环，再做更完整的 launch 系统
- 优先复用现有代码和已有 schema 演进，而不是推倒重做

## MVP 必做

MVP 的目标不是把所有 Product Hunt 能力搬进来，而是让用户第一次进入站点时，已经能明显感受到它是一个“skill 发布与发现平台”。

### 1. 品牌切换

- 全站名称从 `SkillHub` 调整为 `Skillhunt`
- 导航、首页、发布页、详情页、README、战略文档统一文案
- 统一一句话定位和对外描述

### 2. 首页改造

- 把首页从“目录搜索页”改成“榜单/发现页”
- 首页默认强调 `Today`、`Featured`、`Trending`
- 列表项展示 maker、upvote、comment、发布时间等社区信号
- 搜索仍保留，但降级为辅助能力

### 3. 发布页改造

- 把 `Publish a Skill` 语义改为 `Launch a Skill`
- 上传 SKILL.md 和文件夹保留，但只是 launch 流程的一步
- 增加面向展示的发布内容，例如简介、亮点、适用场景
- 让 maker 更像是在“发布一个新技能”，而不是“上传一份文件”

### 4. 详情页改造

- 把“安装”和“文件内容”从第一优先级后移
- 把 skill 介绍、maker、评论、投票前置
- 让详情页更像一个 launch page，而不是一个 package detail page

### 5. 社区最小闭环

- 接通 upvote
- 接通 comment
- 列表页和详情页展示社区互动数据
- 支持 maker 身份展示

### 6. 榜单与排序基础

- 为首页定义基础排序逻辑
- 区分 `recent` 和 `trending`
- 支持最基础的 featured 能力，即使第一版是手工或简化规则

## 建议的阶段拆分

## Phase 1：产品心智切换

目标：先让站点“看起来已经是 Skillhunt”

主要工作：

- 替换品牌名和核心文案
- 重写首页 hero 和导航表达
- 调整首页内容结构
- 调整详情页展示顺序
- 调整发布页表达方式

预期结果：

- 用户第一次打开站点时，感受到的是“发现新 skill”
- 不再把站点理解成单纯的 skill 仓库或内部管理系统

## Phase 2：社区闭环打通

目标：让 Skillhunt 具备最小可用的社区属性

主要工作：

- 补齐 upvote API 和前端交互
- 补齐 comment API 和前端交互
- 在列表页展示热度信息
- 在详情页展示讨论内容
- 在用户页强化 maker 视角

预期结果：

- skill 不再只是被浏览和安装，也会被评价和讨论
- 平台开始具备基础社交证明能力

## Phase 3：榜单机制成型

目标：让 Skillhunt 真正具备 Product Hunt 式“日榜/趋势榜”的骨架

主要工作：

- 定义 featured / trending / latest 的排序逻辑
- 引入按日期维度聚合的榜单视图
- 视情况新增 `launch` 概念，区分 skill 本体与发布事件

预期结果：

- 首页不只是“最近修改的 skill 列表”
- 平台有更清晰的节奏感和竞争感

## Phase 4：从 Skill 到 Launch 的模型升级

目标：支持一次 skill 的多次发布、重大更新再发布和更真实的 launch 生命周期

建议新增的数据模型：

- `skills`：技能本体
- `skill_launches`：一次发布事件
- `launch_upvotes`
- `launch_comments`

为什么值得做：

- Product Hunt 的核心对象本质上是 launch，不是静态条目
- 同一个 skill 后续做重大更新时，可以再次发布
- 更适合做“Today”“This Week”“Past Launches”这类结构

这一阶段不是 MVP 必需，但很可能是中期必须演进的方向。

## 以后再做

以下能力建议在 MVP 跑通后再推进：

- Collections
- Upcoming launches
- Notifications
- Follow makers
- 更完整的 featured 审核流
- 排序权重优化
- 反作弊机制
- 周榜、月榜、年度榜
- 编辑推荐和专题内容

## 面向当前仓库的实际优先级

如果按当前代码状态来排，我建议优先级如下：

1. 先统一品牌和产品文案
2. 先改首页、发布页、详情页的信息架构
3. 接通已有 community schema 对应的前后端能力
4. 再决定是否立即引入 `launch` 模型
5. 最后再做更复杂的榜单机制和社区增强功能

## 一个务实判断

当前仓库已经不是从零开始，数据库里也已经出现了 community feature 的雏形。因此最合理的方式不是彻底重做，而是：

- 用最小改动先完成 `SkillHub -> Skillhunt` 的定位转换
- 在现有 skill 模型上先跑通第一版社区体验
- 等首页、详情页和发布流程稳定后，再决定是否升级到完整的 launch 模型

这样既能尽快看到产品形态变化，也能避免过早做重型后端设计。
