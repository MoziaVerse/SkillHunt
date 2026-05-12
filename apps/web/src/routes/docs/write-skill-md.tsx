export default function WriteSkillMd() {
  return (
    <>
      <header className="pb-8 mb-8 border-b border-neutral-200">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 text-[11px] text-neutral-600 rounded-full mb-4">
          编写 · 03
        </div>
        <h1 className="text-[36px] font-bold leading-[1.08] tracking-[-0.03em] text-[#0f172a]">
          如何写一份合格的 SKILL.md
        </h1>
        <p className="mt-3 text-[16px] text-[#64748b] max-w-2xl">
          好的 <code>SKILL.md</code> 不是给人看的说明书，而是给 Agent 执行任务的操作手册。
        </p>
      </header>

      <h2>基本模板</h2>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`---
name: 会议纪要整理助手
description: 将会议录音转写或会议记录整理为结构化纪要
tags: [办公效率, 文档处理]
---

# 会议纪要整理助手

## 何时使用
当用户提供会议记录、访谈记录、语音转写文本，且希望整理为可分发纪要时使用。

## 输入要求
- 会议原文或转写文本
- 可选：会议主题、参会人、纪要格式要求

## 执行步骤
1. 先识别会议主题、讨论对象和决策事项。
2. 合并重复表达，保留明确结论和待办。
3. 按“会议摘要、关键讨论、决策、待办、风险”输出。
4. 对不确定信息标注“待确认”，不要自行补全事实。

## 输出格式
- 会议摘要
- 关键讨论
- 决策事项
- 待办清单
- 待确认问题

## 注意事项
- 不编造未出现的结论。
- 人名、时间、金额等关键信息必须来自原文。
- 原文信息不足时，先列出需要补充的问题。

## 示例
输入：这次会主要讨论新版首页上线……
输出：会议摘要：本次会议围绕新版首页上线计划展开……`}
      </pre>

      <h2>字段解释</h2>
      <div className="my-6 border border-neutral-200 rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left px-4 py-2.5 border-b border-neutral-200 font-medium">
                字段
              </th>
              <th className="text-left px-4 py-2.5 border-b border-neutral-200 font-medium">
                写法
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-2.5 border-b border-neutral-100 font-mono">name</td>
              <td className="px-4 py-2.5 border-b border-neutral-100">短名称，表达能力对象。</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 border-b border-neutral-100 font-mono">description</td>
              <td className="px-4 py-2.5 border-b border-neutral-100">
                一句话说明价值，优先写结果。
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-mono">tags</td>
              <td className="px-4 py-2.5">2-5 个标签，用于搜索和分类。</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>常见结构</h2>
      <ul>
        <li>
          <strong>何时使用：</strong>触发条件。说明哪些任务适合用，哪些不适合用。
        </li>
        <li>
          <strong>输入要求：</strong>需要用户提供什么材料，哪些字段可选。
        </li>
        <li>
          <strong>执行步骤：</strong>让 Agent 按顺序处理，不要只写目标。
        </li>
        <li>
          <strong>输出格式：</strong>固定标题、字段、表格或 JSON 结构。
        </li>
        <li>
          <strong>注意事项：</strong>边界、禁区、失败处理、需要追问的情况。
        </li>
        <li>
          <strong>示例：</strong>给一组短输入和短输出，帮助 Agent 对齐风格。
        </li>
      </ul>

      <h2>好坏示例</h2>
      <h3>不推荐</h3>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {'帮我写会议纪要，要专业一点。'}
      </pre>
      <p>问题：没有触发条件、输入要求、步骤、输出结构，也没有边界。</p>

      <h3>推荐</h3>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`当用户提供会议记录时，先提取主题、结论、待办和风险。
输出必须包含“摘要 / 决策 / 待办 / 待确认问题”四部分。
缺少责任人或截止时间时，标记为“待补充”，不要自行编造。`}
      </pre>
      <p>优点：场景明确、步骤可执行、输出稳定、边界清楚。</p>

      <h2>延伸阅读</h2>
      <ul>
        <li>
          <a href="https://agentskills.io/specification" target="_blank" rel="noreferrer">
            Agent Skills Specification
          </a>
          ：核对 <code>name</code>、<code>description</code>、可选目录和渐进式加载规则。
        </li>
        <li>
          <a href="https://claude.com/docs/skills/how-to" target="_blank" rel="noreferrer">
            Creating custom skills
          </a>
          ：Anthropic 官方的 Skill 创建、结构、测试和上传前检查指南。
        </li>
        <li>
          <a
            href="https://agentskills.io/skill-creation/best-practices"
            target="_blank"
            rel="noreferrer"
          >
            Best practices for skill creators
          </a>
          ：学习如何控制 Skill 范围、减少冗余、使用模板和验证循环。
        </li>
        <li>
          <a
            href="https://agentskills.io/skill-creation/optimizing-descriptions"
            target="_blank"
            rel="noreferrer"
          >
            Optimizing skill descriptions
          </a>
          ：专门讲 <code>description</code> 如何影响 Skill 触发准确率。
        </li>
        <li>
          <a
            href="https://help.openai.com/en/articles/6654000-playground-and-prompt-engineering"
            target="_blank"
            rel="noreferrer"
          >
            OpenAI · Prompt engineering best practices
          </a>
          ：补充学习清晰指令、示例、格式约束和减少模糊表达的方法。
        </li>
      </ul>
    </>
  );
}
