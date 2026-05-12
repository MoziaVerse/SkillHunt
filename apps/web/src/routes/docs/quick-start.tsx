export default function QuickStart() {
  return (
    <>
      <header className="pb-8 mb-8 border-b border-neutral-200">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 text-[11px] text-neutral-600 rounded-full mb-4">
          入门 · 02
        </div>
        <h1 className="text-[36px] font-bold leading-[1.08] tracking-[-0.03em] text-[#0f172a]">
          快速开始：发布第一个 Skill
        </h1>
        <p className="mt-3 text-[16px] text-[#64748b] max-w-2xl">
          从准备 <code>SKILL.md</code> 到完成发布，一次走完最短路径。
        </p>
      </header>

      <h2>发布前准备</h2>
      <ul>
        <li>
          准备一份 <code>SKILL.md</code>，写清楚 Agent
          在什么场景下使用、需要哪些输入、按什么步骤执行。
        </li>
        <li>如果 Skill 依赖模板、示例、脚本或参考材料，把它们放在同一个文件夹中。</li>
        <li>确认文件中没有账号、密钥、隐私数据、内部地址等敏感信息。</li>
      </ul>

      <h2>推荐流程</h2>
      <ol>
        <li>
          打开 <strong>发布</strong> 页面。
        </li>
        <li>
          上传单个 <code>SKILL.md</code>，或上传包含 <code>SKILL.md</code> 的 Skill 文件夹。
        </li>
        <li>检查上传预览，确认主说明和附加文件都被正确识别。</li>
        <li>填写名称。名称应让用户一眼看懂它解决什么问题。</li>
        <li>填写一句话介绍。优先写“能帮谁完成什么事”，不要只写技术名词。</li>
        <li>选择 1-4 个官方标签，必要时补充少量自定义标签。</li>
        <li>选择 Emoji 图标或封面图，用来增强列表页识别度。</li>
        <li>可选填写演示视频链接，帮助用户快速判断实际效果。</li>
        <li>
          选择可见性：先设为 <strong>私有</strong> 做检查，确认无误后再改为 <strong>公开</strong>。
        </li>
        <li>
          查看发布预览，确认卡片文案清楚，再点击 <strong>立即发布</strong>。
        </li>
      </ol>

      <h2>发布后检查</h2>
      <ul>
        <li>详情页标题、介绍、标签是否表达清楚。</li>
        <li>
          <code>SKILL.md</code> 是否能在详情页正常预览。
        </li>
        <li>安装命令是否出现，并能被复制。</li>
        <li>如果公开发布，确认页面适合被他人搜索、评论、Fork 和安装。</li>
      </ul>
    </>
  );
}
