export default function QualityChecklist() {
  return (
    <>
      <header className="pb-8 mb-8 border-b border-neutral-200">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 text-[11px] text-neutral-600 rounded-full mb-4">
          检查 · 06
        </div>
        <h1 className="text-[36px] font-bold leading-[1.08] tracking-[-0.03em] text-[#0f172a]">
          优秀 Skill 自检清单
        </h1>
        <p className="mt-3 text-[16px] text-[#64748b] max-w-2xl">
          发布前用这份清单快速判断：它是不是一个可复用的 Skill，而不只是一段提示词。
        </p>
      </header>

      <h2>场景是否明确</h2>
      <ul>
        <li>能用一句话说清楚它服务什么任务。</li>
        <li>写明适用场景，也写明不适用场景。</li>
        <li>不是“什么都能做”的泛化描述。</li>
      </ul>

      <h2>步骤是否可复用</h2>
      <ul>
        <li>有稳定的执行顺序，而不是只给一个目标。</li>
        <li>关键判断条件、分支处理和失败处理都有说明。</li>
        <li>换一个相似输入，仍能按同样流程产出结果。</li>
      </ul>

      <h2>输入和输出是否清楚</h2>
      <ul>
        <li>用户需要提供什么材料，是否写明。</li>
        <li>缺少信息时，是追问、标注待确认，还是继续处理，是否写明。</li>
        <li>输出结构固定，标题、字段、表格或 JSON 规则清楚。</li>
      </ul>

      <h2>边界是否足够清楚</h2>
      <ul>
        <li>不让 Agent 编造事实、来源、数据、结论。</li>
        <li>遇到不确定内容时，有明确处理方式。</li>
        <li>不把敏感、违法、危险或超出能力范围的任务写成默认流程。</li>
      </ul>

      <h2>是否适合公开</h2>
      <ul>
        <li>没有密钥、账号、Cookie、内网地址、个人隐私或未授权材料。</li>
        <li>示例数据经过脱敏。</li>
        <li>附加文件都是理解和执行 Skill 所必需的材料。</li>
      </ul>

      <h2>发布信息是否像作品</h2>
      <ul>
        <li>名称具体，不像临时文件名。</li>
        <li>一句话介绍说明实际价值。</li>
        <li>标签能帮助用户发现，而不是堆关键词。</li>
        <li>图标、封面或演示视频能增强理解，不只是装饰。</li>
      </ul>

      <h2>最后判断</h2>
      <p>
        如果删除 <code>SKILL.md</code> 里的某一段后，Agent
        仍然不知道该怎么执行，这段就值得保留；如果删掉也不影响执行，它可能只是介绍文案。
      </p>

      <h2>延伸阅读</h2>
      <ul>
        <li>
          <a
            href="https://agentskills.io/skill-creation/best-practices"
            target="_blank"
            rel="noreferrer"
          >
            Best practices for skill creators
          </a>
          ：用于检查 Skill 是否范围合适、步骤具体、上下文占用合理。
        </li>
        <li>
          <a
            href="https://agentskills.io/skill-creation/evaluating-skills"
            target="_blank"
            rel="noreferrer"
          >
            Evaluating skill output quality
          </a>
          ：学习如何用测试用例、断言和评分方式迭代 Skill。
        </li>
        <li>
          <a
            href="https://learn.microsoft.com/en-us/agent-framework/agents/skills"
            target="_blank"
            rel="noreferrer"
          >
            Microsoft Agent Framework · Security best practices
          </a>
          ：从依赖治理、脚本审查和注入风险角度检查 Skill 安全性。
        </li>
        <li>
          <a
            href="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview"
            target="_blank"
            rel="noreferrer"
          >
            Anthropic · Prompt engineering overview
          </a>
          ：补充理解成功标准、测试、示例和提示词迭代方法。
        </li>
      </ul>
    </>
  );
}
