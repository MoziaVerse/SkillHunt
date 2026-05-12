export default function WhatIsASkill() {
  return (
    <>
      <header className="pb-8 mb-8 border-b border-neutral-200">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 text-[11px] text-neutral-600 rounded-full mb-4">
          概念 · 01
        </div>
        <h1 className="text-[36px] font-bold leading-[1.08] tracking-[-0.03em] text-[#0f172a]">
          什么是 Skill？
        </h1>
      </header>

      <p>
        Agent skills 是给 AI agent 用的"可复用能力包"。一个 skill 是一个目录, 里面有一份{' '}
        <code>SKILL.md</code>(说明 agent 什么时候该用它、怎么用), 以及可选的模板、参考文档、脚本。
        Agent 在运行时会把这份 SKILL.md 注入自己的上下文, 按里面写的方式执行任务。
      </p>
      <p>你可以把它理解成"给 AI 看的 README + runbook"。</p>

      <h2>Skill、MCP 和 Agent 的区别</h2>
      <div className="my-6 border border-neutral-200 rounded-xl overflow-hidden">
        <table className="w-full text-[13px] font-mono">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left px-4 py-2.5 border-b border-neutral-200 font-medium">
                概念
              </th>
              <th className="text-left px-4 py-2.5 border-b border-neutral-200 font-medium">
                是什么
              </th>
              <th className="text-left px-4 py-2.5 border-b border-neutral-200 font-medium">
                谁消费
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-2.5 border-b border-neutral-100">Skill</td>
              <td className="px-4 py-2.5 border-b border-neutral-100">Prompt + 文件包</td>
              <td className="px-4 py-2.5 border-b border-neutral-100">Agent(上下文)</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 border-b border-neutral-100">MCP Server</td>
              <td className="px-4 py-2.5 border-b border-neutral-100">工具调用协议</td>
              <td className="px-4 py-2.5 border-b border-neutral-100">Agent(工具调用)</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5">Agent</td>
              <td className="px-4 py-2.5">执行主体</td>
              <td className="px-4 py-2.5">人类</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>SkillHunt 的定位</h2>
      <p>SkillHunt 是一个面向 AI agent skills 的发布、发现与讨论平台。它当前承载两类价值：</p>
      <ol>
        <li>
          <strong>发布与发现新 skill</strong>——让 maker 能展示自己刚发布的
          skill，也让用户快速判断哪些 skill 值得关注。
        </li>
        <li>
          <strong>保留可安装与可索引能力</strong>——既支持自有 skill，也支持引用外部
          skill，让发现之后的安装流程保持顺畅。
        </li>
      </ol>

      <h2>延伸阅读</h2>
      <ul>
        <li>
          <a href="https://agentskills.io/" target="_blank" rel="noreferrer">
            Agent Skills Overview
          </a>
          ：了解 Agent Skills 的基本概念、使用场景和渐进式加载机制。
        </li>
        <li>
          <a href="https://agentskills.io/specification" target="_blank" rel="noreferrer">
            Agent Skills Specification
          </a>
          ：查看 <code>SKILL.md</code>、frontmatter、目录结构和资源加载的完整规范。
        </li>
        <li>
          <a href="https://claude.com/docs/skills/overview" target="_blank" rel="noreferrer">
            Claude Skills Overview
          </a>
          ：Anthropic 官方对 Skills、MCP、Projects、Custom Instructions 等能力边界的说明。
        </li>
        <li>
          <a
            href="https://learn.microsoft.com/en-us/agent-framework/agents/skills"
            target="_blank"
            rel="noreferrer"
          >
            Microsoft Agent Framework · Agent Skills
          </a>
          ：了解 Skills 在其他 Agent 框架中的实现方式和安全注意事项。
        </li>
        <li>
          <a
            href="https://modelcontextprotocol.io/specification/2025-06-18/basic"
            target="_blank"
            rel="noreferrer"
          >
            Model Context Protocol Specification
          </a>
          ：如果想深入理解 MCP 与 Skill 的区别，可以阅读 MCP 官方协议说明。
        </li>
      </ul>
    </>
  );
}
