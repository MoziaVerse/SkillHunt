import { cn } from '@/lib/utils';
import { Link, Outlet, useLocation } from 'react-router';

export const DOCS = [
  { slug: 'what-is-a-skill', title: '什么是 Skill？' },
  { slug: 'api-reference', title: 'API 参考' },
];

export default function DocsLayout() {
  const { pathname } = useLocation();
  const match = pathname.match(/^\/docs\/([^/]+)/);
  const active = match?.[1] ?? '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10 pt-10">
      <aside className="lg:sticky lg:top-[68px] lg:self-start">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
          文档
        </div>
        <nav className="flex flex-col">
          <Link
            to="/docs"
            className={cn(
              'py-1.5 text-[13.5px] border-l-2 pl-3 -ml-[2px] transition',
              !active
                ? 'border-neutral-900 text-neutral-900 font-medium'
                : 'border-transparent text-neutral-600 hover:text-neutral-900',
            )}
          >
            概览
          </Link>
          {DOCS.map((d) => (
            <Link
              key={d.slug}
              to={`/docs/${d.slug}`}
              className={cn(
                'py-1.5 text-[13.5px] border-l-2 pl-3 -ml-[2px] transition',
                active === d.slug
                  ? 'border-neutral-900 text-neutral-900 font-medium'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900',
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
  );
}
