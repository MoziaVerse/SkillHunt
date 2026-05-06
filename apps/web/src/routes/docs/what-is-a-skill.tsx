export default function WhatIsASkill() {
  return (
    <>
      <header className="border-b border-neutral-200 pb-6 mb-8">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
          概念 · 01
        </div>
        <h1 className="font-semibold text-[36px] leading-[1.05] tracking-[-0.02em]">
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
      <div className="my-6 border border-neutral-200">
        <table className="w-full text-[13px] font-mono">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left px-4 py-2 border-b border-neutral-200 font-medium">概念</th>
              <th className="text-left px-4 py-2 border-b border-neutral-200 font-medium">
                是什么
              </th>
              <th className="text-left px-4 py-2 border-b border-neutral-200 font-medium">
                谁消费
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-2 border-b border-neutral-100">Skill</td>
              <td className="px-4 py-2 border-b border-neutral-100">Prompt + 文件包</td>
              <td className="px-4 py-2 border-b border-neutral-100">Agent(上下文)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 border-b border-neutral-100">MCP Server</td>
              <td className="px-4 py-2 border-b border-neutral-100">工具调用协议</td>
              <td className="px-4 py-2 border-b border-neutral-100">Agent(工具调用)</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Agent</td>
              <td className="px-4 py-2">执行主体</td>
              <td className="px-4 py-2">人类</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>SkillHub 的定位</h2>
      <p>SkillHub 是 Mozia 内部的 skill 目录。它做两件事:</p>
      <ol>
        <li>
          <strong>托管自有 skill</strong>——我们封装的内部 skill,内容存在我们数据库里, 通过
          well-known endpoint 对外 serve。
        </li>
        <li>
          <strong>索引外部 skill</strong>——像 <code>anthropics/skills</code> 这种 公开 skill,
          我们只记元数据 + 原始安装命令,让团队在一个入口就能找到所有可用 skill。
        </li>
      </ol>

      <h2>参考链接</h2>
      <ul>
        <li>
          <a href="https://agentskills.io" target="_blank" rel="noreferrer">
            agentskills.io
          </a>
        </li>
        <li>
          <a href="https://github.com/anthropics/skills" target="_blank" rel="noreferrer">
            github.com/anthropics/skills
          </a>
        </li>
      </ul>
    </>
  );
}
