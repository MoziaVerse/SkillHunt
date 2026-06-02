import { PublishableCard } from '@/components/publishable-card';
import { TwemojiIcon } from '@/components/twemoji-icon';
import { apiClient } from '@/lib/api-client';
import { DEFAULT_SKILL_ICON, DEFAULT_SKILL_PACKAGE_ICON } from '@/lib/default-icons';
import { cn } from '@/lib/utils';
import type { PublishableListItem } from '@/types/api';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

type ContentFilter = 'all' | 'skills' | 'packages';
type SortMode = 'hottest' | 'recent' | 'az';

const PAGE_SIZE = 24;

function parseContentFilter(value: string | null): ContentFilter {
  if (value === 'skills' || value === 'packages') return value;
  return 'all';
}

function apiKind(content: ContentFilter) {
  if (content === 'skills') return 'skill' as const;
  if (content === 'packages') return 'package' as const;
  return 'all' as const;
}

function contentLabel(content: ContentFilter) {
  if (content === 'skills') return 'Skill';
  if (content === 'packages') return 'Skills 包';
  return '发布内容';
}

function contentCountText(total: number, content: ContentFilter) {
  if (content === 'all') return `${total} 个发布内容`;
  return `${total} 个 ${contentLabel(content)}`;
}

function emptyContentText(content: ContentFilter) {
  if (content === 'all') return '当前还没有任何发布内容。';
  return `当前还没有任何 ${contentLabel(content)}。`;
}

function latestSectionTitle(content: ContentFilter) {
  if (content === 'all') return '社区下一步值得探索的内容';
  return `更多 ${contentLabel(content)}`;
}

function itemTitle(item: PublishableListItem) {
  return item.item.name;
}

function itemIcon(item: PublishableListItem) {
  if (item.kind === 'package') return item.item.icon ?? DEFAULT_SKILL_PACKAGE_ICON;
  return item.item.icon ?? DEFAULT_SKILL_ICON;
}

function itemTarget(item: PublishableListItem) {
  if (item.kind === 'package') return `/packages/${item.item.owner.handle}/${item.item.slug}`;
  return `/skills/${item.item.owner.handle}/${item.item.slug}`;
}

function Metric({
  emoji,
  children,
  className,
}: {
  emoji?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {emoji ? <TwemojiIcon emoji={emoji} /> : null}
      <span>{children}</span>
    </span>
  );
}

function Hero({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (q: string) => void;
}) {
  return (
    <section className="relative overflow-hidden px-6 py-16 text-center">
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
        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[13px] text-emerald-700">
          <TwemojiIcon emoji="✨" />
          <span>SkillHunt · 每日发现新的 AI Agent Skills</span>
        </div>
        <h1 className="mb-3 text-[44px] font-bold leading-[1.08] tracking-[-0.03em] text-[#0f172a]">
          发现当下值得关注的技能
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-[17px] text-[#64748b]">
          在 SkillHunt 发布、发现并讨论新的 AI Agent Skills，也可以找到围绕同一场景打包好的 Skills
          包。
        </p>
        <div className="relative mx-auto max-w-[560px]">
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
            placeholder="搜索 Skill、Skills 包、创作者和主题..."
            className="w-full rounded-xl border border-neutral-200 bg-white py-3.5 pl-11 pr-4 text-[14px] shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-50"
          />
        </div>
      </div>
    </section>
  );
}

function FilterBar({
  content,
  setContent,
  sort,
  setSort,
}: {
  content: ContentFilter;
  setContent: (v: ContentFilter) => void;
  sort: SortMode;
  setSort: (v: SortMode) => void;
}) {
  return (
    <div className="px-6 pb-4">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
          {(
            [
              ['all', '◆', '全部'],
              ['skills', '🧩', '只看 Skill'],
              ['packages', '📦', '只看包'],
            ] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setContent(key)}
              className={cn('category-btn', content === key ? 'active' : '')}
            >
              {icon === '◆' ? <span>{icon}</span> : <TwemojiIcon emoji={icon} />}
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="flex overflow-hidden rounded-lg border border-neutral-300 font-mono text-[11.5px]">
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
                'border-r border-neutral-300 px-3 py-1.5 transition last:border-r-0',
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
  );
}

function SpotlightRow({ items }: { items: PublishableListItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="px-6 pb-8">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 md:grid-cols-3">
        {items.map((item, index) => {
          const metrics =
            item.kind === 'package'
              ? [
                  { emoji: '🧩', label: item.item.skillCount },
                  { label: `▲ ${item.item.upvoteCount}` },
                  { emoji: '💬', label: item.item.commentCount },
                  { emoji: '🔖', label: item.item.bookmarkCount },
                ]
              : [
                  ...(item.item.downloadCount > 0
                    ? [{ emoji: '⬇️', label: item.item.downloadCount }]
                    : []),
                  { label: `▲ ${item.item.upvoteCount}` },
                  { emoji: '💬', label: item.item.commentCount },
                  { emoji: '🔖', label: item.item.bookmarkCount },
                ];
          return (
            <Link
              key={`${item.kind}-${item.item.owner.handle}-${item.item.slug}`}
              to={itemTarget(item)}
              className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700">
                    {index + 1}
                  </span>
                  {item.kind === 'package' ? '推荐包' : '推荐'}
                </div>
                <span className="text-[11px] text-neutral-400">@{item.item.owner.handle}</span>
              </div>
              <div className="flex items-center gap-2 text-[18px] font-semibold leading-tight text-neutral-900">
                <TwemojiIcon emoji={itemIcon(item)} />
                <span className="min-w-0 truncate">{itemTitle(item)}</span>
              </div>
              <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-neutral-600">
                {item.item.description}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {item.item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-4 text-[12px] text-neutral-500">
                {metrics.map((metric) => (
                  <Metric key={`${metric.emoji ?? 'text'}-${metric.label}`} emoji={metric.emoji}>
                    {metric.label}
                  </Metric>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function SkillsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [content, setContentState] = useState<ContentFilter>(() =>
    parseContentFilter(searchParams.get('content')),
  );
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [items, setItems] = useState<PublishableListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setContentState(parseContentFilter(searchParams.get('content')));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetching(true);
    apiClient
      .listPublishables({
        kind: apiKind(content),
        q: query.trim() || undefined,
        tag: [],
        sort,
        limit: PAGE_SIZE,
        offset: 0,
      })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
        setError(null);
        setLoadMoreError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled) return;
        setFetching(false);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [content, query, sort]);

  const setContent = (next: ContentFilter) => {
    setContentState(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'all') nextParams.delete('content');
    else nextParams.set('content', next);
    setSearchParams(nextParams, { replace: true });
  };

  const loadMore = useCallback(async () => {
    if (loading || fetching || items.length >= total) return;
    setFetching(true);
    setLoadMoreError(null);
    try {
      const res = await apiClient.listPublishables({
        kind: apiKind(content),
        q: query.trim() || undefined,
        tag: [],
        sort,
        limit: PAGE_SIZE,
        offset: items.length,
      });
      setItems((prev) => [...prev, ...res.items]);
      setTotal(res.total);
    } catch {
      setLoadMoreError('继续发现失败，请稍后重试。');
    } finally {
      setFetching(false);
    }
  }, [content, fetching, items.length, loading, query, sort, total]);

  const hasQuery = query.trim().length > 0;
  const showSpotlight = !hasQuery && items.length > 0;
  const spotlight = useMemo(() => (showSpotlight ? items.slice(0, 3) : []), [items, showSpotlight]);
  const freshLaunches = hasQuery ? items : items.slice(3);
  const hasMore = items.length < total;

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || loading || fetching || loadMoreError) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadMore();
      },
      { rootMargin: '360px 0px 520px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [fetching, hasMore, loadMore, loadMoreError, loading]);

  const reset = () => {
    setContent('all');
    setQuery('');
    setLoadMoreError(null);
  };

  return (
    <>
      <Hero query={query} onQueryChange={setQuery} />
      <FilterBar content={content} setContent={setContent} sort={sort} setSort={setSort} />

      {!loading && !error && showSpotlight && <SpotlightRow items={spotlight} />}

      {error && (
        <div className="min-h-[400px] px-6 py-12 text-center font-mono text-[13px] text-red-700">
          API 错误：{error.message}。请检查前端代理配置和后端服务是否已启动。
        </div>
      )}

      {!error && loading && (
        <div className="min-h-[400px] px-6 py-12 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
          加载中…
        </div>
      )}

      {!error && !loading && items.length === 0 && (
        <div className="min-h-[400px] px-6 py-24 text-center">
          <div className="mb-3 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
            {hasQuery ? '未找到匹配结果' : '无匹配结果'}
          </div>
          <div className="text-[15px] text-neutral-700">
            {hasQuery ? '换个关键词或清除筛选条件试试。' : emptyContentText(content)}
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-5 rounded-lg border border-neutral-300 px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.1em] transition hover:border-neutral-900"
          >
            重置
          </button>
        </div>
      )}

      {!error && !loading && items.length > 0 && (
        <>
          <div
            className={cn(
              'px-6 py-2 pt-6 transition-opacity duration-150',
              fetching ? 'opacity-60' : 'opacity-100',
            )}
          >
            {hasQuery ? (
              <div className="mx-auto mb-4 max-w-[1200px]">
                <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                  搜索结果
                </div>
                <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-neutral-900">
                  找到 {contentCountText(total, content)}与「{query.trim()}」相关
                </h2>
              </div>
            ) : (
              <div className="mx-auto mb-4 flex max-w-[1200px] flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                    {content === 'all' ? '最新发布' : '继续发现'}
                  </div>
                  <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-neutral-900">
                    {latestSectionTitle(content)}
                  </h2>
                </div>
                <div className="text-[13px] text-neutral-500">
                  共发现 {contentCountText(total, content)}
                </div>
              </div>
            )}
            {freshLaunches.length > 0 ? (
              <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {freshLaunches.map((item) => (
                  <PublishableCard
                    key={`${item.kind}:${item.item.owner.handle}/${item.item.slug}`}
                    item={item}
                  />
                ))}
              </div>
            ) : (
              <div className="mx-auto max-w-[1200px] rounded-xl border border-dashed border-neutral-200 bg-white px-5 py-8 text-center text-[14px] text-neutral-500">
                推荐区已经展示了当前全部 {contentLabel(content)}。
              </div>
            )}
          </div>

          <div ref={loadMoreRef} className="flex justify-center px-6 py-8" aria-live="polite">
            {hasMore ? (
              <div className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-[13px] text-neutral-500 shadow-sm shadow-neutral-950/5">
                {loadMoreError ? (
                  <span className="inline-flex items-center gap-3">
                    <span>{loadMoreError}</span>
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={fetching}
                      className="font-medium text-neutral-900 underline-offset-4 hover:underline disabled:text-neutral-400"
                    >
                      重试
                    </button>
                  </span>
                ) : fetching ? (
                  '正在加载更多…'
                ) : (
                  '继续向下滚动，自动发现更多'
                )}
              </div>
            ) : (
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-400">
                已展示全部内容
              </div>
            )}
          </div>

          {!hasQuery && (
            <section className="mt-8 px-6 py-16 text-center">
              <div className="mx-auto max-w-2xl">
                <h2 className="mb-2 text-[28px] font-bold text-[#0f172a]">发布你的下一个 Skill</h2>
                <p className="mb-6 text-[15px] text-[#64748b]">
                  分享你构建的能力，或把一组相关 Skills 打包成一个可一键安装的场景方案。
                </p>
                <Link
                  to="/publish"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-[14px] font-medium text-white shadow-sm transition hover:bg-emerald-600"
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
