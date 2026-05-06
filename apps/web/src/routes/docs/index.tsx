import { Link } from 'react-router';

const DOCS = [
  {
    slug: 'what-is-a-skill',
    title: '什么是 Skill？',
    summary: '从 Agent Skill 的定义讲起,说清楚它和 MCP、Agent 的区别,以及 SkillHub 的定位。',
    minutes: 3,
  },
  {
    slug: 'api-reference',
    title: 'API 参考',
    summary: 'SkillHub REST API 完整参考：skill 增删改查、文件管理、安装令牌、well-known 协议。',
    minutes: 8,
  },
];

export default function DocsIndex() {
  return (
    <>
      <header className="border-b border-neutral-200 pb-6 mb-8">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
          文档
        </div>
        <h1 className="font-semibold text-[36px] leading-[1.05] tracking-[-0.02em]">
          SkillHub 文档
        </h1>
        <p className="mt-3 text-neutral-600 max-w-2xl">
          什么是 skill，以及完整的 API 参考。
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
              {d.minutes} 分钟阅读 →
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
