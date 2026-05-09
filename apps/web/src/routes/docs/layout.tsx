import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { Link, Outlet, useLocation } from 'react-router';

export const DOCS = [
  { slug: 'what-is-a-skill', title: '什么是 Skill？', icon: '📖' },
  { slug: 'api-reference', title: 'API 参考', icon: '🔌' },
];

export default function DocsLayout() {
  const { pathname } = useLocation();
  const match = pathname.match(/^\/docs\/([^/]+)/);
  const active = match?.[1] ?? '';

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
              <span className="text-neutral-900 font-medium">
                {DOCS.find((d) => d.slug === active)?.title ?? active}
              </span>
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
              {DOCS.map((d) => (
                <Link
                  key={d.slug}
                  to={`/docs/${d.slug}`}
                  className={cn(
                    'py-1.5 text-[13.5px] border-l-2 pl-3 -ml-[2px] transition rounded-r-sm',
                    active === d.slug
                      ? 'border-emerald-500 text-neutral-900 font-medium bg-emerald-50'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50',
                  )}
                >
                  {d.title}
                </Link>
              ))}
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
