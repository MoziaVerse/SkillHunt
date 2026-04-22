import { InstallCommand } from '@/components/install-command';

export default function HowToInstall() {
  return (
    <>
      <header className="border-b border-neutral-200 pb-6 mb-8">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
          guide · 02
        </div>
        <h1 className="font-semibold text-[36px] leading-[1.05] tracking-[-0.02em]">
          How to Install
        </h1>
      </header>

      <h2>Prerequisites</h2>
      <ul>
        <li>Node.js 20+ / Bun 1.1+(两者都行)</li>
        <li>
          <code>npx</code> 可用
        </li>
        <li>
          本机启动了 SkillHub API(Phase 0:<code>http://localhost:3333</code>)
        </li>
      </ul>

      <h2>Install from SkillHub</h2>
      <div className="my-5">
        <InstallCommand command="npx skills add http://localhost:3333 --skill <skill-name>" />
      </div>
      <p>
        这条命令会从 SkillHub 的 well-known endpoint 拉取 skill 内容, 解包到当前 agent 的 skill
        目录。
      </p>

      <h2>Install from GitHub</h2>
      <div className="my-5">
        <InstallCommand command="npx skills add anthropics/skills --skill frontend-design" />
      </div>

      <h2>Per-agent Paths</h2>
      <div className="my-6 border border-neutral-200">
        <table className="w-full text-[13px] font-mono">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left px-4 py-2 border-b border-neutral-200 font-medium">Agent</th>
              <th className="text-left px-4 py-2 border-b border-neutral-200 font-medium">
                Skills 目录
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-2 border-b border-neutral-100">Claude Code</td>
              <td className="px-4 py-2 border-b border-neutral-100 text-neutral-600">
                ~/.claude/skills/
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 border-b border-neutral-100">Codex</td>
              <td className="px-4 py-2 border-b border-neutral-100 text-neutral-600">
                ~/.codex/skills/
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 border-b border-neutral-100">Cursor</td>
              <td className="px-4 py-2 border-b border-neutral-100 text-neutral-600">
                ~/.cursor/skills/
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2">OpenCode</td>
              <td className="px-4 py-2 text-neutral-600">~/.opencode/skills/</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Verify</h2>
      <p>装完后,在对应 agent 里输入:</p>
      <div className="my-5">
        <InstallCommand command="ls ~/.claude/skills/ && cat ~/.claude/skills/<skill>/SKILL.md" />
      </div>
      <p>能看到目录和 SKILL.md 内容就成功了。</p>
    </>
  );
}
