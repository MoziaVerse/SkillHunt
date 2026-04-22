// Docs pages — index + 3 articles, sidebar-layout.

const DOCS = [
  {
    slug: 'what-is-a-skill',
    title: 'What is a Skill?',
    summary: '从 Agent Skill 的定义讲起,说清楚它和 MCP、Agent 的区别,以及 SkillHub 的定位。',
    minutes: 3,
  },
  {
    slug: 'how-to-install',
    title: 'How to Install',
    summary: '前置依赖、基础命令、不同 agent 的路径差异,以及装完之后的验证方法。',
    minutes: 4,
  },
  {
    slug: 'how-to-publish',
    title: 'How to Publish',
    summary: 'Phase 0 内部流程,Phase 1 开放申请。目前如何联系维护者提交 skill。',
    minutes: 2,
  },
];

function DocsLayout({ slug, children }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10 pt-10">
      <aside className="lg:sticky lg:top-[68px] lg:self-start">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
          docs
        </div>
        <nav className="flex flex-col">
          <Link
            to="/docs"
            className={cx(
              'py-1.5 text-[13.5px] border-l-2 pl-3 -ml-[2px] transition',
              !slug
                ? 'border-neutral-900 text-neutral-900 font-medium'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            )}
          >
            Overview
          </Link>
          {DOCS.map((d) => (
            <Link
              key={d.slug}
              to={`/docs/${d.slug}`}
              className={cx(
                'py-1.5 text-[13.5px] border-l-2 pl-3 -ml-[2px] transition',
                slug === d.slug
                  ? 'border-neutral-900 text-neutral-900 font-medium'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              )}
            >
              {d.title}
            </Link>
          ))}
        </nav>
      </aside>
      <article className="min-w-0 max-w-3xl prose-docs">{children}</article>
    </div>
  );
}

function DocsIndex() {
  return (
    <DocsLayout>
      <header className="border-b border-neutral-200 pb-6 mb-8">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
          documentation
        </div>
        <h1 className="font-semibold text-[36px] leading-[1.05] tracking-[-0.02em]">
          SkillHub Docs
        </h1>
        <p className="mt-3 text-neutral-600 max-w-2xl">
          Phase 0 只有三篇:什么是 skill、怎么装、怎么发。Phase 1 会扩展。
        </p>
      </header>

      <div className="grid gap-0 border border-neutral-200">
        {DOCS.map((d, i) => (
          <Link
            key={d.slug}
            to={`/docs/${d.slug}`}
            className="grid grid-cols-[40px_1fr_auto] items-center gap-5 px-5 py-5 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition"
          >
            <div className="font-mono text-[12px] text-neutral-400 tabular-nums">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[15px] font-medium text-neutral-900">{d.title}</div>
              <div className="mt-1 text-[13px] text-neutral-600">{d.summary}</div>
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-400">
              {d.minutes} min read →
            </div>
          </Link>
        ))}
      </div>
    </DocsLayout>
  );
}

function ArticleHeader({ title, kicker }) {
  return (
    <header className="border-b border-neutral-200 pb-6 mb-8">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        {kicker}
      </div>
      <h1 className="font-semibold text-[36px] leading-[1.05] tracking-[-0.02em]">{title}</h1>
    </header>
  );
}

function WhatIsASkill() {
  return (
    <DocsLayout slug="what-is-a-skill">
      <ArticleHeader title="What is a Skill?" kicker="concepts · 01" />
      <p>
        Agent skills 是给 AI agent 用的"可复用能力包"。一个 skill 是一个目录,
        里面有一份 <code>SKILL.md</code>(说明 agent 什么时候该用它、怎么用),
        以及可选的模板、参考文档、脚本。Agent 在运行时会把这份 SKILL.md 注入自己的上下文,
        按里面写的方式执行任务。
      </p>
      <p>
        你可以把它理解成"给 AI 看的 README + runbook"。
      </p>

      <h2>Skill vs MCP vs Agent</h2>
      <div className="my-6 border border-neutral-200">
        <table className="w-full text-[13px] font-mono">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left px-4 py-2 border-b border-neutral-200 font-medium">
                概念
              </th>
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
      <p>
        SkillHub 是 Mozia 内部的 skill 目录。它做两件事:
      </p>
      <ol>
        <li>
          <strong>托管自有 skill</strong>——我们封装的内部 skill,内容存在我们数据库里,
          通过 well-known endpoint 对外 serve。
        </li>
        <li>
          <strong>索引外部 skill</strong>——像 <code>anthropics/skills</code> 这种
          公开 skill,我们只记元数据 + 原始安装命令,让团队在一个入口就能找到所有可用 skill。
        </li>
      </ol>

      <h2>References</h2>
      <ul>
        <li>
          <a href="https://agentskills.io" target="_blank" rel="noreferrer">agentskills.io</a>
        </li>
        <li>
          <a href="https://github.com/anthropics/skills" target="_blank" rel="noreferrer">
            github.com/anthropics/skills
          </a>
        </li>
      </ul>
    </DocsLayout>
  );
}

function HowToInstall() {
  return (
    <DocsLayout slug="how-to-install">
      <ArticleHeader title="How to Install" kicker="guide · 02" />
      <h2>Prerequisites</h2>
      <ul>
        <li>Node.js 20+ / Bun 1.1+(两者都行)</li>
        <li><code>npx</code> 可用</li>
        <li>本机启动了 SkillHub API(Phase 0:<code>http://localhost:3333</code>)</li>
      </ul>

      <h2>Install from SkillHub</h2>
      <div className="my-5">
        <CopyCommand command="npx skills add http://localhost:3333 --skill <skill-name>" />
      </div>
      <p>
        这条命令会从 SkillHub 的 well-known endpoint 拉取 skill 内容,
        解包到当前 agent 的 skill 目录。
      </p>

      <h2>Install from GitHub</h2>
      <div className="my-5">
        <CopyCommand command="npx skills add anthropics/skills --skill frontend-design" />
      </div>

      <h2>Per-agent Paths</h2>
      <div className="my-6 border border-neutral-200">
        <table className="w-full text-[13px] font-mono">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left px-4 py-2 border-b border-neutral-200 font-medium">
                Agent
              </th>
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
        <CopyCommand command="ls ~/.claude/skills/ && cat ~/.claude/skills/<skill>/SKILL.md" />
      </div>
      <p>能看到目录和 SKILL.md 内容就成功了。</p>
    </DocsLayout>
  );
}

function HowToPublish() {
  return (
    <DocsLayout slug="how-to-publish">
      <ArticleHeader title="How to Publish" kicker="guide · 03" />
      <div className="border-l-2 border-amber-400 bg-amber-50 pl-4 py-3 my-6">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-amber-700 mb-1">
          phase 0
        </div>
        <p className="text-[13.5px] text-amber-900 m-0">
          外部发布流程 Phase 1 开放。目前通过内部脚本录入。
        </p>
      </div>

      <h2>Internal: Import Script</h2>
      <p>Mozia 内部成员可以用 import 脚本把本地目录录入为 owned skill:</p>
      <div className="my-5">
        <CopyCommand command="pnpm --filter @mozia/skillhub-api run import-skills ./path/to/skill" />
      </div>

      <h2>Submit a Skill</h2>
      <p>如果你有一个想加入 SkillHub 的 skill:</p>
      <ol>
        <li>开一个 issue 到 <code>MoziaVerse/mozia-skillhub</code></li>
        <li>附上 SKILL.md 草稿和 3 个使用场景</li>
        <li>维护者 review 后走 import 脚本录入</li>
      </ol>

      <h2>Phase 1 Roadmap</h2>
      <ul>
        <li>Web UI 提交 + 预览</li>
        <li>基于 GitHub OAuth 的发布者身份</li>
        <li>自动爬取公开仓库的 skill 并索引</li>
      </ul>
    </DocsLayout>
  );
}

Object.assign(window, { DocsIndex, WhatIsASkill, HowToInstall, HowToPublish });
