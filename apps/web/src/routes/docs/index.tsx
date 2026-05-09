import { Link } from 'react-router';

const DOCS = [
  {
    slug: 'what-is-a-skill',
    title: '什么是 Skill？',
    summary: '从 Agent Skill 的定义讲起，说清楚它和 MCP、Agent 的区别，以及 SkillHunt 的定位。',
    minutes: 3,
    icon: '📖',
  },
  {
    slug: 'api-reference',
    title: 'API 参考',
    summary: 'SkillHunt REST API 完整参考：skill 增删改查、文件管理、安装令牌、well-known 协议。',
    minutes: 8,
    icon: '🔌',
  },
];

export default function DocsIndex() {
  return (
    <>
      <header className="pb-8 mb-8 border-b border-neutral-200">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[12px] text-emerald-700 mb-4">
          📚 文档
        </div>
        <h1 className="text-[36px] font-bold leading-[1.08] tracking-[-0.03em] text-[#0f172a]">
          SkillHunt 文档
        </h1>
        <p className="mt-3 text-[16px] text-[#64748b] max-w-2xl">
          了解什么是 skill、SkillHunt 如何工作，以及完整的 API 参考。
        </p>
      </header>

      <div className="grid gap-4">
        {DOCS.map((d) => (
          <Link
            key={d.slug}
            to={`/docs/${d.slug}`}
            className="group flex items-start gap-4 p-5 border border-neutral-200 rounded-xl hover:border-neutral-300 hover:shadow-sm transition"
          >
            <div className="w-12 h-12 shrink-0 bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-center text-[24px] select-none group-hover:border-neutral-300 transition">
              {d.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-[#0f172a] group-hover:text-emerald-600 transition">
                {d.title}
              </div>
              <div className="mt-1 text-[13px] text-[#64748b] leading-relaxed">{d.summary}</div>
            </div>
            <div className="shrink-0 text-[12px] text-neutral-400 pt-0.5">
              {d.minutes} 分钟阅读 →
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
