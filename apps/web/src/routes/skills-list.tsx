import { useSkills } from '@/hooks/use-skills';
import { DEFAULT_REFERENCED_SKILL_ICON, DEFAULT_SKILL_ICON } from '@/lib/default-icons';
import { cn } from '@/lib/utils';
import type { SkillListItem } from '@/types/api';
import { useState } from 'react';
import { Link } from 'react-router';

type TypeFilter = 'all' | 'owned' | 'referenced';
type SortMode = 'hottest' | 'recent' | 'az';

function Hero({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (q: string) => void;
}) {
  return (
    <section className="py-16 px-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" aria-hidden>
        <svg width="100%" height="100%">
          <title>SkillHunt 背景网格</title>
          <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0f172a" strokeWidth="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>
      </div>
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[13px] text-emerald-700 mb-6">
          <span>✨</span>
          <span>SkillHunt · 每日发现新的 AI Agent Skills</span>
        </div>
        <h1 className="text-[44px] font-bold leading-[1.08] tracking-[-0.03em] text-[#0f172a] mb-3">
          发现当下值得关注的技能
        </h1>
        <p className="text-[17px] text-[#64748b] max-w-2xl mx-auto mb-8">
          在 SkillHunt 发布、发现并讨论新的 AI Agent
          Skills，让创作者分享新作品，也让团队快速找到下一步值得尝试的能力。
        </p>
        <div className="max-w-[560px] mx-auto relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            aria-hidden
          >
            <title>搜索</title>
            <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line
              x1="12"
              y1="12"
              x2="16"
              y2="16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索发布内容、创作者和主题..."
            className="w-full pl-11 pr-4 py-3.5 border border-neutral-200 rounded-xl text-[14px] focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition shadow-sm bg-white"
          />
        </div>
      </div>
    </section>
  );
}

function FilterBar({
  type,
  setType,
  sort,
  setSort,
}: {
  type: TypeFilter;
  setType: (v: TypeFilter) => void;
  sort: SortMode;
  setSort: (v: SortMode) => void;
}) {
  return (
    <div className="px-6 pb-4">
      <div className="mx-auto max-w-[1200px] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap overflow-x-auto">
          <button
            type="button"
            onClick={() => setType('all')}
            className={cn('category-btn', type === 'all' ? 'active' : '')}
          >
            <span>◆</span>
            <span>全部发布</span>
          </button>
          <button
            type="button"
            onClick={() => setType('owned')}
            className={cn('category-btn', type === 'owned' ? 'active' : '')}
          >
            <span>⚡</span>
            <span>原创</span>
          </button>
          <button
            type="button"
            onClick={() => setType('referenced')}
            className={cn('category-btn', type === 'referenced' ? 'active' : '')}
          >
            <span>🔗</span>
            <span>引用</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border border-neutral-300 divide-x divide-neutral-300 font-mono text-[11.5px] rounded-lg overflow-hidden">
            {(
              [
                ['hottest', '推荐'],
                ['recent', '最新'],
                ['az', 'A-Z'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSort(k)}
                className={cn(
                  'px-3 py-1.5 transition',
                  sort === k
                    ? 'bg-neutral-900 text-neutral-100'
                    : 'bg-white text-neutral-600 hover:text-neutral-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillCard({ skill }: { skill: SkillListItem }) {
  return (
    <Link to={`/skills/${skill.owner.handle}/${skill.slug}`} className="skill-card flex flex-col">
      {/* Thumbnail */}
      <div className="aspect-square h-40 bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center text-[48px] select-none">
        {skill.icon ??
          (skill.type === 'owned' ? DEFAULT_SKILL_ICON : DEFAULT_REFERENCED_SKILL_ICON)}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-neutral-400">
          <span>{skill.type === 'owned' ? '发布' : '来源推荐'}</span>
          <span>{new Date(skill.updatedAt).toLocaleDateString()}</span>
        </div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-[15px] text-[#0f172a] leading-tight truncate">
            {skill.name}
          </h3>
          {skill.type === 'owned' && (
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[10px] font-medium text-emerald-700 uppercase tracking-wide">
              自有
            </span>
          )}
        </div>

        <p className="text-[13px] text-[#64748b] leading-relaxed line-clamp-3 flex-1">
          {skill.description}
        </p>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
          <span className="text-[12px] text-neutral-500">
            作者 <span className="text-neutral-700 font-medium">@{skill.owner.handle}</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-neutral-500">▲ {skill.upvoteCount}</span>
            <span className="text-[11px] text-neutral-500">💬 {skill.commentCount}</span>
            <span className="text-[11px] text-neutral-500">🔖 {skill.bookmarkCount}</span>
            {skill.type === 'owned' && skill.visibility === 'private' && (
              <span className="text-[10px] px-1.5 py-0.5 border border-amber-300 text-amber-700 bg-amber-50 rounded">
                私有
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function SpotlightRow({ items }: { items: SkillListItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="px-6 pb-8">
      <div className="mx-auto max-w-[1200px] grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((skill, index) => (
          <Link
            key={`${skill.owner.handle}-${skill.slug}`}
            to={`/skills/${skill.owner.handle}/${skill.slug}`}
            className="rounded-2xl border border-neutral-200 bg-white p-5 hover:border-neutral-300 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold">
                  {index + 1}
                </span>
                推荐
              </div>
              <span className="text-[11px] text-neutral-400">@{skill.owner.handle}</span>
            </div>
            <div className="text-[18px] font-semibold text-neutral-900 leading-tight">
              {skill.name}
            </div>
            <p className="mt-2 text-[13px] text-neutral-600 leading-relaxed line-clamp-3">
              {skill.description}
            </p>
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {skill.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-100 text-[11px] text-neutral-600"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 text-[12px] text-neutral-500">
              <span>▲ {skill.upvoteCount}</span>
              <span>💬 {skill.commentCount}</span>
              <span>🔖 {skill.bookmarkCount}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function SkillsList() {
  const [type, setType] = useState<TypeFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');

  const { items, total, loading, fetching, error, hasMore, loadMore } = useSkills({
    type,
    q: query.trim() ? query.trim() : undefined,
    tag: [],
    sort,
    limit: 20,
  });

  const reset = () => {
    setType('all');
    setQuery('');
  };

  const hasQuery = query.trim().length > 0;

  // 发现模式：前 3 个为推荐区，搜索模式时不分割
  const spotlight = items.slice(0, 3);
  const freshLaunches = hasQuery ? items : items.slice(3);

  return (
    <>
      <Hero query={query} onQueryChange={setQuery} />

      {/* 发现模式：展示推荐区 */}
      {!loading && !error && !hasQuery && <SpotlightRow items={spotlight} />}

      {/* 发现模式：展示分类与排序 */}
      {!loading && !error && !hasQuery && (
        <FilterBar type={type} setType={setType} sort={sort} setSort={setSort} />
      )}

      {error && (
        <div className="px-6 min-h-[400px] py-12 text-center font-mono text-[13px] text-red-700">
          API 错误：{error.message}。请检查前端代理配置和后端服务是否已启动。
        </div>
      )}

      {!error && loading && (
        <div className="px-6 min-h-[400px] py-12 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
          加载中…
        </div>
      )}

      {!error && !loading && items.length === 0 && (
        <div className="px-6 min-h-[400px] py-24 text-center">
          <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400 mb-3">
            {hasQuery ? '未找到匹配结果' : '无匹配结果'}
          </div>
          <div className="text-neutral-700 text-[15px]">
            {hasQuery ? '换个关键词或清除筛选条件试试。' : '当前还没有任何发布内容。'}
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-5 font-mono text-[12px] uppercase tracking-[0.1em] border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 transition rounded-lg"
          >
            重置
          </button>
        </div>
      )}

      {!error && !loading && items.length > 0 && (
        <>
          <div
            className={cn(
              'px-6 pt-6 transition-opacity duration-150 py-2',
              fetching ? 'opacity-60' : 'opacity-100',
            )}
          >
            {hasQuery ? (
              // 搜索模式：极简标题
              <div className="mx-auto max-w-[1200px] mb-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-1">
                  搜索结果
                </div>
                <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-neutral-900">
                  找到 {total} 个与「{query.trim()}」相关的 skill
                </h2>
              </div>
            ) : (
              // 发现模式：原有标题
              <div className="mx-auto max-w-[1200px] mb-4 flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-1">
                    最新发布
                  </div>
                  <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-neutral-900">
                    社区下一步值得探索的内容
                  </h2>
                </div>
                <div className="text-[13px] text-neutral-500">共发现 {total} 个 skill</div>
              </div>
            )}
            <div className="mx-auto max-w-[1200px] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {freshLaunches.map((s) => (
                <SkillCard key={`${s.owner.handle}-${s.slug}`} skill={s} />
              ))}
            </div>
          </div>

          {/* 加载更多 */}
          {!hasQuery && hasMore && (
            <div className="flex justify-center py-8">
              <button
                type="button"
                onClick={loadMore}
                disabled={fetching}
                className="font-mono text-[12px] uppercase tracking-[0.1em] border border-neutral-300 px-4 py-2 hover:border-neutral-900 transition rounded-lg disabled:opacity-50"
              >
                {fetching ? '加载中…' : '加载更多'}
              </button>
            </div>
          )}

          {/* 发现模式：CTA 区 */}
          {!hasQuery && (
            <section className="px-6 py-16 mt-8 text-center">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-[28px] font-bold text-[#0f172a] mb-2">发布你的下一个 Skill</h2>
                <p className="text-[15px] text-[#64748b] mb-6">
                  分享你构建的能力，说明它的价值，让社区发现并尝试它。
                </p>
                <Link
                  to="/publish"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-[14px] rounded-lg transition shadow-sm"
                >
                  在 SkillHunt 发布 →
                </Link>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
