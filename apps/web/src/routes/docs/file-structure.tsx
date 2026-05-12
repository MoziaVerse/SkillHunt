export default function FileStructure() {
  return (
    <>
      <header className="pb-8 mb-8 border-b border-neutral-200">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 text-[11px] text-neutral-600 rounded-full mb-4">
          规范 · 04
        </div>
        <h1 className="text-[36px] font-bold leading-[1.08] tracking-[-0.03em] text-[#0f172a]">
          Skill 文件结构与上传规范
        </h1>
        <p className="mt-3 text-[16px] text-[#64748b] max-w-2xl">
          一个 Skill 可以只有 <code>SKILL.md</code>，也可以带模板、脚本和参考资料。
        </p>
      </header>

      <h2>最小结构</h2>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`my-skill/
└── SKILL.md`}
      </pre>

      <h2>推荐结构</h2>
      <pre className="my-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 font-mono text-[13px] overflow-x-auto">
        {`my-skill/
├── SKILL.md
├── templates/
│   └── output-template.md
├── references/
│   └── examples.md
└── scripts/
    └── helper.sh`}
      </pre>

      <h2>上传规则</h2>
      <ul>
        <li>
          上传单个文件时，文件应为 <code>.md</code>，系统会把它作为主说明。
        </li>
        <li>
          上传文件夹时，系统会寻找根目录下的 <code>SKILL.md</code>。
        </li>
        <li>
          <code>SKILL.md</code> 同级及其子目录中的文件会作为附加文件一并上传。
        </li>
        <li>总上传大小上限为 1 MB，适合放轻量模板和文本材料。</li>
        <li>支持预览常见文本文件，如 md、txt、json、yaml、ts、js、py、sh 等。</li>
      </ul>

      <h2>会被拒绝或忽略的内容</h2>
      <ul>
        <li>
          没有 <code>SKILL.md</code> 的文件夹。
        </li>
        <li>
          以 <code>.</code> 开头的隐藏文件或隐藏目录，例如 <code>.git</code>、<code>.DS_Store</code>
          。
        </li>
        <li>位于 Skill 根目录外的文件。</li>
        <li>
          路径中包含 <code>..</code> 的不安全路径。
        </li>
        <li>超过大小限制的文件包。</li>
      </ul>

      <h2>命名建议</h2>
      <ul>
        <li>
          主说明固定使用 <code>SKILL.md</code>，注意全部大写。
        </li>
        <li>目录名使用小写英文、数字和短横线，便于生成 URL 标识。</li>
        <li>模板放在 templates，参考材料放在 references，脚本放在 scripts。</li>
        <li>不要上传二进制大文件；需要演示时优先使用外部视频链接。</li>
      </ul>

      <h2>延伸阅读</h2>
      <ul>
        <li>
          <a href="https://agentskills.io/specification" target="_blank" rel="noreferrer">
            Agent Skills Specification
          </a>
          ：查看标准目录结构、frontmatter 字段、<code>scripts</code>、<code>references</code>、
          <code>assets</code> 的定义。
        </li>
        <li>
          <a href="https://claude.com/docs/skills/how-to" target="_blank" rel="noreferrer">
            Creating custom skills
          </a>
          ：参考 Anthropic 对 Skill 目录、附加资源、打包和上传前检查的建议。
        </li>
        <li>
          <a
            href="https://agentskills.io/skill-creation/using-scripts"
            target="_blank"
            rel="noreferrer"
          >
            Using scripts in skills
          </a>
          ：如果 Skill 需要可执行脚本，可继续阅读脚本设计和依赖处理方式。
        </li>
      </ul>
    </>
  );
}
