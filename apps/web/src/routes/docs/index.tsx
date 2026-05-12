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
    slug: 'write-skill-md',
    title: '如何写一份合格的 SKILL.md',
    summary: '提供模板、字段解释、好坏示例，以及何时使用、输入、步骤、输出和注意事项的写法。',
    minutes: 7,
    icon: '📝',
  },
  {
    slug: 'quick-start',
    title: '快速开始：发布第一个 Skill',
    summary: '从准备 SKILL.md、上传文件、填写发布信息，到点击发布的一条最短路径。',
    minutes: 4,
    icon: '🚀',
  },
  {
    slug: 'file-structure',
    title: 'Skill 文件结构与上传规范',
    summary: '解释 SKILL.md 根文件、附加文件、文件夹上传、隐藏文件、大小限制和路径规则。',
    minutes: 5,
    icon: '📁',
  },
  {
    slug: 'publish-info',
    title: '发布信息填写指南',
    summary: '说明名称、一句话介绍、标签、图标/封面、演示视频、公开与私有的填写策略。',
    minutes: 5,
    icon: '🎯',
  },
  {
    slug: 'quality-checklist',
    title: '优秀 Skill 自检清单',
    summary: '发布前检查场景、步骤、输入输出、边界、安全信息和作品表达是否达标。',
    minutes: 4,
    icon: '✅',
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
