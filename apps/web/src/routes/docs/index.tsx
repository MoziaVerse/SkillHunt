import { Link } from 'react-router';

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

export default function DocsIndex() {
  return (
    <>
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
    </>
  );
}
