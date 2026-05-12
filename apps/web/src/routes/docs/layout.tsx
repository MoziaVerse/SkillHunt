import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { Link, Outlet, useLocation } from 'react-router';

export const DOCS = [
  { slug: 'what-is-a-skill', title: '什么是 Skill？', icon: '📖' },
  { slug: 'write-skill-md', title: '如何写一份合格的 SKILL.md', icon: '📝' },
  { slug: 'quick-start', title: '快速开始：发布第一个 Skill', icon: '🚀' },
  { slug: 'file-structure', title: 'Skill 文件结构与上传规范', icon: '📁' },
  { slug: 'publish-info', title: '发布信息填写指南', icon: '🎯' },
  { slug: 'quality-checklist', title: '优秀 Skill 自检清单', icon: '✅' },
  {
    slug: 'api-reference',
    title: 'API 参考',
    icon: '🔌',
    sections: [
      { id: 'base-url', title: '基础地址' },
      { id: 'quick-start', title: '最快接入' },
      { id: 'auth', title: '认证方式' },
      { id: 'scopes', title: 'Scope' },
      { id: 'common-flows', title: '常用流程' },
      { id: 'endpoints', title: '端点速查' },
      { id: 'examples', title: '核心示例' },
      { id: 'errors', title: '错误处理' },
      { id: 'well-known', title: '公开 Agent 协议' },
    ],
  },
];

export default function DocsLayout() {
  const { pathname } = useLocation();
  const match = pathname.match(/^\/docs\/([^/]+)/);
  const active = match?.[1] ?? '';
  const activeDoc = DOCS.find((d) => d.slug === active);

  return (
    <>
      {/* Breadcrumb */}
      <nav className="px-6 py-3 border-b border-neutral-100 bg-white">
        <div className="mx-auto max-w-[1200px] flex items-center gap-1.5 text-[13px]">
          <Link to="/" className="text-neutral-500 hover:text-neutral-900 transition">
            <Logo size={16} className="text-neutral-900" />
          </Link>
          <span className="text-neutral-300">/</span>
          <span className={cn(!active ? 'text-neutral-900 font-medium' : 'text-neutral-500')}>
            文档
          </span>
          {active && (
            <>
              <span className="text-neutral-300">/</span>
              <span className="text-neutral-900 font-medium">{activeDoc?.title ?? active}</span>
            </>
          )}
        </div>
      </nav>

      <div className="px-6 py-8">
        <div className="mx-auto max-w-[1200px] grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
          <aside className="lg:sticky lg:top-[68px] lg:self-start">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
              文档
            </div>
            <nav className="flex flex-col">
              <Link
                to="/docs"
                className={cn(
                  'py-1.5 text-[13.5px] border-l-2 pl-3 -ml-[2px] transition rounded-r-sm',
                  !active
                    ? 'border-emerald-500 text-neutral-900 font-medium bg-emerald-50'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50',
                )}
              >
                概览
              </Link>
              {DOCS.map((d) => {
                const isActive = active === d.slug;
                return (
                  <div key={d.slug} className="flex flex-col">
                    <Link
                      to={`/docs/${d.slug}`}
                      className={cn(
                        'py-1.5 text-[13.5px] border-l-2 pl-3 -ml-[2px] transition rounded-r-sm',
                        isActive
                          ? 'border-emerald-500 text-neutral-900 font-medium bg-emerald-50'
                          : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50',
                      )}
                    >
                      {d.title}
                    </Link>
                    {isActive && d.sections && (
                      <div className="mt-1 mb-2 flex flex-col">
                        {d.sections.map((section) => (
                          <a
                            key={section.id}
                            href={`#${section.id}`}
                            className="border-l-2 border-neutral-200 py-1 pl-6 -ml-[2px] text-[12.5px] leading-snug text-neutral-500 transition hover:border-emerald-300 hover:text-neutral-900 hover:bg-neutral-50"
                          >
                            {section.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>
          <article className="min-w-0 max-w-3xl prose-docs">
            <Outlet />
          </article>
        </div>
      </div>
    </>
  );
}
