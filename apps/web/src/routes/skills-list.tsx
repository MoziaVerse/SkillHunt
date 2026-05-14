import { TwemojiIcon } from '@/components/twemoji-icon';
import { apiClient } from '@/lib/api-client';
import {
  DEFAULT_REFERENCED_SKILL_ICON,
  DEFAULT_SKILL_ICON,
  DEFAULT_SKILL_PACKAGE_ICON,
} from '@/lib/default-icons';
import { cn } from '@/lib/utils';
import type { SkillListItem, SkillPackageListItem } from '@/types/api';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

type ContentFilter = 'all' | 'skills' | 'packages';
type SortMode = 'hottest' | 'recent' | 'az';

type DiscoveryItem =
  | { kind: 'skill'; skill: SkillListItem }
  | { kind: 'package'; package: SkillPackageListItem };

const PAGE_SIZE = 24;
const MIXED_PAGE_SIZE = 12;

function parseContentFilter(value: string | null): ContentFilter {
  if (value === 'skills' || value === 'packages') return value;
  return 'all';
}

function pageSizeFor(content: ContentFilter) {
  return content === 'all' ? MIXED_PAGE_SIZE : PAGE_SIZE;
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

function spotlightOnlyText(content: ContentFilter) {
  if (content === 'all') return '推荐区已经展示了当前最值得关注的内容。';
  return `推荐区已经展示了当前全部 ${contentLabel(content)}。`;
}

function EmojiMetric({
  emoji,
  children,
  className,
}: {
  emoji: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <TwemojiIcon emoji={emoji} />
      <span>{children}</span>
    </span>
  );
}

function itemTitle(item: DiscoveryItem) {
  return item.kind === 'skill' ? item.skill.name : item.package.name;
}

function itemUpdatedAt(item: DiscoveryItem) {
  return item.kind === 'skill' ? item.skill.updatedAt : item.package.updatedAt;
}

function itemScore(item: DiscoveryItem) {
  if (item.kind === 'package') {
    return (
      item.package.upvoteCount * 3 + item.package.commentCount * 2 + item.package.bookmarkCount
    );
  }
  return item.skill.upvoteCount * 3 + item.skill.commentCount * 2 + item.skill.bookmarkCount;
}

function sortDiscoveryItems(items: DiscoveryItem[], sort: SortMode) {
  return [...items].sort((a, b) => {
    if (sort === 'az') return itemTitle(a).localeCompare(itemTitle(b), 'zh-Hans-CN');
    if (sort === 'hottest') {
      const scoreDelta = itemScore(b) - itemScore(a);
      if (scoreDelta !== 0) return scoreDelta;
    }
    return new Date(itemUpdatedAt(b)).getTime() - new Date(itemUpdatedAt(a)).getTime();
  });
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

        <div className="flex items-center gap-2">
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
    </div>
  );
}

function SkillCover({ skill }: { skill: SkillListItem }) {
  if (skill.coverImage) {
    return (
      <img
        src={skill.coverImage}
        alt={`${skill.name} 封面`}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-full w-full select-none items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 text-[48px]">
      <TwemojiIcon
        emoji={
          skill.icon ??
          (skill.type === 'owned' ? DEFAULT_SKILL_ICON : DEFAULT_REFERENCED_SKILL_ICON)
        }
      />
    </div>
  );
}

function PackageCover({ pkg }: { pkg: SkillPackageListItem }) {
  if (pkg.coverImage) {
    return (
      <img src={pkg.coverImage} alt={`${pkg.name} 封面`} className="h-full w-full object-cover" />
    );
  }

  return (
    <div className="flex h-full w-full select-none items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 text-[48px]">
      <TwemojiIcon emoji={pkg.icon ?? DEFAULT_SKILL_PACKAGE_ICON} />
    </div>
  );
}

function SkillCard({ skill }: { skill: SkillListItem }) {
  return (
    <Link to={`/skills/${skill.owner.handle}/${skill.slug}`} className="skill-card flex flex-col">
      <div className="aspect-square h-40 overflow-hidden bg-gradient-to-br from-neutral-50 to-neutral-100">
        <SkillCover skill={skill} />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-neutral-400">
          <span>{skill.type === 'owned' ? 'Skill' : '来源推荐'}</span>
          <span>{new Date(skill.updatedAt).toLocaleDateString()}</span>
        </div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-[#0f172a]">
            {skill.name}
          </h3>
          {skill.type === 'owned' && (
            <span className="inline-flex shrink-0 items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
              Skill
            </span>
          )}
        </div>

        <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-[#64748b]">
          {skill.description}
        </p>

        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
          <span className="text-[12px] text-neutral-500">
            作者 <span className="font-medium text-neutral-700">@{skill.owner.handle}</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-neutral-500">▲ {skill.upvoteCount}</span>
            <EmojiMetric emoji="💬" className="text-[11px] text-neutral-500">
              {skill.commentCount}
            </EmojiMetric>
            <EmojiMetric emoji="🔖" className="text-[11px] text-neutral-500">
              {skill.bookmarkCount}
            </EmojiMetric>
            {skill.type === 'owned' && skill.visibility === 'private' && (
              <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                私有
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function PackageCard({ pkg }: { pkg: SkillPackageListItem }) {
  return (
    <Link to={`/packages/${pkg.owner.handle}/${pkg.slug}`} className="skill-card flex flex-col">
      <div className="aspect-square h-40 overflow-hidden bg-gradient-to-br from-neutral-50 to-neutral-100">
        <PackageCover pkg={pkg} />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-neutral-400">
          <span>Skills 包</span>
          <span>{new Date(pkg.updatedAt).toLocaleDateString()}</span>
        </div>

        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="truncate text-[15px] font-semibold leading-tight text-[#0f172a]">
            {pkg.name}
          </h2>
          <span className="inline-flex shrink-0 items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
            包
          </span>
        </div>

        <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-[#64748b]">
          {pkg.description}
        </p>

        <div className="mt-3 flex flex-wrap gap-1 overflow-hidden">
          {pkg.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
          <span className="text-[12px] text-neutral-500">
            作者 <span className="font-medium text-neutral-700">@{pkg.owner.handle}</span>
          </span>
          <div className="flex items-center gap-3">
            <EmojiMetric emoji="🧩" className="text-[11px] text-neutral-500">
              {pkg.skillCount}
            </EmojiMetric>
            <span className="text-[11px] text-neutral-500">▲ {pkg.upvoteCount}</span>
            <EmojiMetric emoji="💬" className="text-[11px] text-neutral-500">
              {pkg.commentCount}
            </EmojiMetric>
            <EmojiMetric emoji="🔖" className="text-[11px] text-neutral-500">
              {pkg.bookmarkCount}
            </EmojiMetric>
            {pkg.visibility === 'private' ? (
              <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                私有
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

function DiscoveryCard({ item }: { item: DiscoveryItem }) {
  if (item.kind === 'package') return <PackageCard pkg={item.package} />;
  return <SkillCard skill={item.skill} />;
}

function SpotlightRow({ items }: { items: DiscoveryItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="px-6 pb-8">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 md:grid-cols-3">
        {items.map((item, index) => {
          const isPackage = item.kind === 'package';
          const target = isPackage
            ? `/packages/${item.package.owner.handle}/${item.package.slug}`
            : `/skills/${item.skill.owner.handle}/${item.skill.slug}`;
          const owner = isPackage ? item.package.owner : item.skill.owner;
          const tags = isPackage ? item.package.tags : item.skill.tags;
          const description = isPackage ? item.package.description : item.skill.description;
          const metrics = isPackage
            ? [
                { emoji: '🧩', label: item.package.skillCount },
                { label: `▲ ${item.package.upvoteCount}` },
                { emoji: '💬', label: item.package.commentCount },
                { emoji: '🔖', label: item.package.bookmarkCount },
              ]
            : [
                { label: `▲ ${item.skill.upvoteCount}` },
                { emoji: '💬', label: item.skill.commentCount },
                { emoji: '🔖', label: item.skill.bookmarkCount },
              ];

          return (
            <Link
              key={`${item.kind}-${owner.handle}-${isPackage ? item.package.slug : item.skill.slug}`}
              to={target}
              className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700">
                    {index + 1}
                  </span>
                  {isPackage ? '推荐包' : '推荐'}
                </div>
                <span className="text-[11px] text-neutral-400">@{owner.handle}</span>
              </div>
              <div className="flex items-center gap-2 text-[18px] font-semibold leading-tight text-neutral-900">
                <TwemojiIcon
                  emoji={
                    isPackage
                      ? (item.package.icon ?? DEFAULT_SKILL_PACKAGE_ICON)
                      : (item.skill.icon ?? DEFAULT_SKILL_ICON)
                  }
                />
                <span className="min-w-0 truncate">{itemTitle(item)}</span>
              </div>
              <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-neutral-600">
                {description}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {tags.slice(0, 3).map((tag) => (
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
                  <span
                    key={`${metric.emoji ?? 'text'}-${metric.label}`}
                    className="inline-flex items-center gap-1"
                  >
                    {metric.emoji ? <TwemojiIcon emoji={metric.emoji} /> : null}
                    <span>{metric.label}</span>
                  </span>
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
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [packages, setPackages] = useState<SkillPackageListItem[]>([]);
  const [skillsTotal, setSkillsTotal] = useState(0);
  const [packagesTotal, setPackagesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setContentState(parseContentFilter(searchParams.get('content')));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const q = query.trim() || undefined;
    const limit = pageSizeFor(content);

    setLoading(true);
    setFetching(true);

    Promise.all([
      content !== 'packages'
        ? apiClient.listSkills({ type: 'all', q, tag: [], sort, limit, offset: 0 })
        : Promise.resolve({ items: [], total: 0 }),
      content !== 'skills'
        ? apiClient.listPackages({ q, tag: [], sort, limit, offset: 0 })
        : Promise.resolve({ items: [], total: 0 }),
    ])
      .then(([skillsRes, packagesRes]) => {
        if (cancelled) return;
        setSkills(skillsRes.items);
        setPackages(packagesRes.items);
        setSkillsTotal(skillsRes.total);
        setPackagesTotal(packagesRes.total);
        setError(null);
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
    if (next === 'all') {
      nextParams.delete('content');
    } else {
      nextParams.set('content', next);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const loadMore = async () => {
    const limit = pageSizeFor(content);
    const q = query.trim() || undefined;
    const shouldLoadSkills = content !== 'packages' && skills.length < skillsTotal;
    const shouldLoadPackages = content !== 'skills' && packages.length < packagesTotal;
    if (!shouldLoadSkills && !shouldLoadPackages) return;

    setFetching(true);
    try {
      const [skillsRes, packagesRes] = await Promise.all([
        shouldLoadSkills
          ? apiClient.listSkills({ type: 'all', q, tag: [], sort, limit, offset: skills.length })
          : Promise.resolve(null),
        shouldLoadPackages
          ? apiClient.listPackages({
              q,
              tag: [],
              sort,
              limit,
              offset: packages.length,
            })
          : Promise.resolve(null),
      ]);
      if (skillsRes) {
        setSkills((prev) => [...prev, ...skillsRes.items]);
        setSkillsTotal(skillsRes.total);
      }
      if (packagesRes) {
        setPackages((prev) => [...prev, ...packagesRes.items]);
        setPackagesTotal(packagesRes.total);
      }
    } catch {
      /* 加载更多失败不打断当前发现流。 */
    } finally {
      setFetching(false);
    }
  };

  const items = useMemo(
    () =>
      sortDiscoveryItems(
        [
          ...skills.map((skill): DiscoveryItem => ({ kind: 'skill', skill })),
          ...packages.map((pkg): DiscoveryItem => ({ kind: 'package', package: pkg })),
        ],
        sort,
      ),
    [skills, packages, sort],
  );

  const total = skillsTotal + packagesTotal;
  const hasQuery = query.trim().length > 0;
  const showSpotlight = !hasQuery && items.length > 0;
  const spotlight = showSpotlight ? items.slice(0, 3) : [];
  const freshLaunches = hasQuery ? items : items.slice(3);
  const hasMore =
    (content !== 'packages' && skills.length < skillsTotal) ||
    (content !== 'skills' && packages.length < packagesTotal);

  const reset = () => {
    setContent('all');
    setQuery('');
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
                {freshLaunches.map((item) => {
                  const key =
                    item.kind === 'package'
                      ? `package-${item.package.owner.handle}-${item.package.slug}`
                      : `skill-${item.skill.owner.handle}-${item.skill.slug}`;
                  return <DiscoveryCard key={key} item={item} />;
                })}
              </div>
            ) : (
              <div className="mx-auto max-w-[1200px] rounded-xl border border-dashed border-neutral-200 bg-white px-5 py-8 text-center text-[14px] text-neutral-500">
                {spotlightOnlyText(content)}
              </div>
            )}
          </div>

          {!hasQuery && hasMore && (
            <div className="flex justify-center py-8">
              <button
                type="button"
                onClick={loadMore}
                disabled={fetching}
                className="rounded-lg border border-neutral-300 px-4 py-2 font-mono text-[12px] uppercase tracking-[0.1em] transition hover:border-neutral-900 disabled:opacity-50"
              >
                {fetching ? '加载中…' : '加载更多'}
              </button>
            </div>
          )}

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
