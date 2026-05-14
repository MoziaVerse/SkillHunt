import { CommentsSection, CommunityStats } from '@/components/community-panel';
import { InstallCommand } from '@/components/install-command';
import { Logo } from '@/components/logo';
import { type MeResponse, apiClient } from '@/lib/api-client';
import { DEFAULT_SKILL_ICON, DEFAULT_SKILL_PACKAGE_ICON } from '@/lib/default-icons';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SkillPackageDetail, SkillPackageSkill } from '@/types/api';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

type PackageDetailTab = 'overview' | 'skills' | 'install' | 'discussion';
type PackageStatsPatch = Pick<
  SkillPackageDetail,
  'upvoteCount' | 'commentCount' | 'bookmarkCount' | 'viewerHasUpvoted' | 'viewerHasBookmarked'
>;

function buildPackageAgentInstallPrompt(pkg: SkillPackageDetail) {
  const skillLines = pkg.skills.length
    ? pkg.skills
        .slice(0, 8)
        .map((item) => `- ${item.protocolName}：${item.skill.name}`)
        .join('\n')
    : '- 暂无可安装的公开 Skill';
  const moreCount = Math.max(pkg.skills.length - 8, 0);
  const lines = [
    '请帮我安装这个 Skills 包，并使用你当前环境支持的通用 Skill 安装方式完成，不要假设某个特定的 Agent 客户端。',
    '',
    `Skills 包名称：${pkg.name}`,
    `发布者：@${pkg.owner.handle}`,
    `包标识：${pkg.owner.handle}/${pkg.slug}`,
    `包含 Skill 数量：${pkg.skillCount}`,
    '',
    '包内 Skill：',
    skillLines,
  ];

  if (moreCount > 0) {
    lines.push(`- 另外还有 ${moreCount} 个 Skill，可安装后查看完整列表。`);
  }

  lines.push(
    '',
    `通用整包安装命令：${pkg.installCommand}`,
    '',
    '请优先安装整包。安装完成后，请确认包内 Skill 已经可用，并告诉我下一步如何调用这些能力。',
  );

  return lines.join('\n');
}

function Breadcrumb({ pkg }: { pkg: SkillPackageDetail }) {
  return (
    <nav className="border-b border-neutral-100 bg-white px-6 py-3">
      <div className="mx-auto flex max-w-[1200px] items-center gap-1.5 text-[13px]">
        <Link to="/" className="text-neutral-500 transition hover:text-neutral-900">
          <Logo size={16} className="text-neutral-900" />
        </Link>
        <span className="text-neutral-300">/</span>
        <Link
          to="/?content=packages"
          className="text-neutral-500 transition hover:text-neutral-900"
        >
          发现
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="font-medium text-neutral-900">{pkg.name}</span>
      </div>
    </nav>
  );
}

function HeroSection({
  pkg,
  me,
  onUpvote,
  onBookmark,
  onCommentOpen,
}: {
  pkg: SkillPackageDetail;
  me: MeResponse | null;
  onUpvote: (patch: PackageStatsPatch) => void;
  onBookmark: (patch: PackageStatsPatch) => void;
  onCommentOpen: () => void;
}) {
  return (
    <div className="bg-white px-6 pt-10 pb-8">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="text-[12px] uppercase tracking-[0.16em] text-neutral-400">
            Skill 包详情
          </div>
          <Link
            to="/?content=packages"
            className="text-[13px] text-neutral-500 hover:text-neutral-900"
          >
            ← 返回发现
          </Link>
        </div>

        {pkg.coverImage ? (
          <img
            src={pkg.coverImage}
            alt={`${pkg.name} 封面`}
            className="mb-6 max-h-64 w-full rounded-2xl object-cover"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {!pkg.coverImage ? (
            <span className="select-none text-[36px] leading-none">
              {pkg.icon ?? DEFAULT_SKILL_PACKAGE_ICON}
            </span>
          ) : null}
          <h1 className="text-[34px] font-bold tracking-[-0.03em] text-[#0f172a]">{pkg.name}</h1>
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            Skills 包
          </span>
          {pkg.visibility === 'private' ? (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              私有
            </span>
          ) : null}
        </div>

        <p className="mt-4 max-w-3xl text-[18px] leading-8 text-[#475569]">{pkg.description}</p>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-[#64748b]">
          <span>
            发布者{' '}
            <Link
              to={`/u/${pkg.owner.handle}`}
              className="font-medium text-[#0f172a] hover:underline"
            >
              @{pkg.owner.handle}
            </Link>
          </span>
          <span className="h-1 w-1 rounded-full bg-neutral-300" />
          <span>{pkg.skillCount} 个 Skill</span>
          <span className="h-1 w-1 rounded-full bg-neutral-300" />
          <span>首次发布 {formatRelative(pkg.createdAt)}</span>
          <span className="h-1 w-1 rounded-full bg-neutral-300" />
          <span>最近更新 {formatRelative(pkg.updatedAt)}</span>
        </div>

        {pkg.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {pkg.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-[12px] text-neutral-600"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        <CommunityStats
          target={pkg}
          onUpvoteClick={() => {
            if (!me) {
              window.alert('登录后才能点赞。');
              return;
            }
            void (async () => {
              try {
                const next = pkg.viewerHasUpvoted
                  ? await apiClient.removePackageUpvote(pkg.owner.handle, pkg.slug)
                  : await apiClient.upvotePackage(pkg.owner.handle, pkg.slug);
                onUpvote({
                  upvoteCount: next.upvoteCount,
                  commentCount: next.commentCount,
                  bookmarkCount: next.bookmarkCount,
                  viewerHasUpvoted: next.viewerHasUpvoted,
                  viewerHasBookmarked: next.viewerHasBookmarked,
                });
              } catch (err) {
                window.alert(err instanceof Error ? err.message : '点赞失败');
              }
            })();
          }}
          onBookmarkClick={() => {
            if (!me) {
              window.alert('登录后才能收藏。');
              return;
            }
            void (async () => {
              try {
                const next = pkg.viewerHasBookmarked
                  ? await apiClient.removePackageBookmark(pkg.owner.handle, pkg.slug)
                  : await apiClient.bookmarkPackage(pkg.owner.handle, pkg.slug);
                onBookmark({
                  upvoteCount: next.upvoteCount,
                  commentCount: next.commentCount,
                  bookmarkCount: next.bookmarkCount,
                  viewerHasUpvoted: next.viewerHasUpvoted,
                  viewerHasBookmarked: next.viewerHasBookmarked,
                });
              } catch (err) {
                window.alert(err instanceof Error ? err.message : '收藏操作失败');
              }
            })();
          }}
          onCommentClick={onCommentOpen}
        />
      </div>
    </div>
  );
}

function TabNav({
  active,
  onChange,
}: {
  active: PackageDetailTab;
  onChange: (tab: PackageDetailTab) => void;
}) {
  const tabs: Array<{ key: PackageDetailTab; label: string; icon: string }> = [
    { key: 'overview', label: '概览', icon: '📖' },
    { key: 'skills', label: '包内 Skill', icon: '🧩' },
    { key: 'install', label: '安装', icon: '⬇️' },
    { key: 'discussion', label: '讨论', icon: '💬' },
  ];

  return (
    <div className="sticky top-[58px] z-10 border-b border-neutral-200 bg-white/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-[1200px] items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-[13px] font-medium transition',
              active === tab.key
                ? 'border-emerald-500 text-[#0f172a]'
                : 'border-transparent text-neutral-500 hover:text-neutral-700',
            )}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PackageStatusSidebar({
  pkg,
  onOpenSkills,
}: {
  pkg: SkillPackageDetail;
  onOpenSkills: () => void;
}) {
  return (
    <aside className="space-y-5">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm shadow-neutral-100/80">
        <div className="mb-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          包状态
        </div>
        <div className="space-y-3 text-[14px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-neutral-500">包内 Skill</span>
            <button
              type="button"
              onClick={onOpenSkills}
              className="font-medium text-neutral-900 hover:underline"
            >
              {pkg.skillCount} 个
            </button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-neutral-500">可见性</span>
            <span className="font-medium text-neutral-900">
              {pkg.visibility === 'public' ? '公开' : '私有'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-neutral-500">发布者</span>
            <Link
              to={`/u/${pkg.owner.handle}`}
              className="font-medium text-neutral-900 hover:underline"
            >
              @{pkg.owner.handle}
            </Link>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-neutral-500">最近更新</span>
            <span className="font-medium text-neutral-900">{formatRelative(pkg.updatedAt)}</span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm shadow-neutral-100/80">
        <div className="mb-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          标签
        </div>
        {pkg.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {pkg.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-100 px-2.5 py-1 text-[12px] text-neutral-600"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-neutral-500">这个包还没有添加标签。</p>
        )}
      </section>
    </aside>
  );
}

function PackageSkillCard({ item }: { item: SkillPackageSkill }) {
  return (
    <Link
      to={`/skills/${item.skill.owner.handle}/${item.skill.slug}`}
      className="block rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:bg-neutral-50"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-[24px]">
          {item.skill.icon ?? DEFAULT_SKILL_ICON}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[17px] font-semibold text-neutral-950">
              {item.skill.name}
            </h3>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-500">
              {item.protocolName}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-[14px] leading-6 text-neutral-600">
            {item.skill.description}
          </p>
          {item.note ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              {item.note}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-neutral-500">
            <span>@{item.skill.owner.handle}</span>
            <span>{item.files.length} 个文件</span>
            {item.pinnedReleaseId ? <span>固定版本</span> : <span>使用最新文件</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

function OverviewTab({
  pkg,
  onOpenSkills,
}: {
  pkg: SkillPackageDetail;
  onOpenSkills: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-10">
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm shadow-neutral-100/80">
          <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            关于这个包
          </div>
          <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-neutral-950">
            一组面向同一场景的 Agent Skills
          </h2>
          <p className="mt-4 text-[15px] leading-8 text-neutral-700">{pkg.description}</p>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm shadow-neutral-100/80">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                包内速览
              </div>
              <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-neutral-950">
                {pkg.skillCount} 个 Skill 会一起安装
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenSkills}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-[12px] text-neutral-700 transition hover:border-neutral-900"
            >
              查看全部
            </button>
          </div>

          {pkg.skills.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-neutral-500">
              这个 Skill 包暂时还没有公开可安装的 Skill。
            </div>
          ) : (
            <div className="grid gap-3">
              {pkg.skills.slice(0, 4).map((item) => (
                <PackageSkillCard key={item.itemId} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>
      <PackageStatusSidebar pkg={pkg} onOpenSkills={onOpenSkills} />
    </div>
  );
}

function SkillsTab({ pkg }: { pkg: SkillPackageDetail }) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm shadow-neutral-100/80">
      <div className="mb-6">
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          包内 Skill
        </div>
        <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-neutral-950">
          安装时会载入这些能力
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-neutral-500">
          npx skills 会从这个列表读取每个 Skill 的 well-known 文件。
        </p>
      </div>

      {pkg.skills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-neutral-500">
          这个 Skill 包暂时还没有公开可安装的 Skill。
        </div>
      ) : (
        <div className="grid gap-3">
          {pkg.skills.map((item) => (
            <PackageSkillCard key={item.itemId} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function InstallTab({
  pkg,
  onOpenSkills,
}: {
  pkg: SkillPackageDetail;
  onOpenSkills: () => void;
}) {
  const installPrompt = buildPackageAgentInstallPrompt(pkg);
  const [tab, setTab] = useState<'agent' | 'human'>('agent');
  const activeInstallContent = tab === 'agent' ? installPrompt : pkg.installCommand;

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-10">
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm shadow-neutral-100/80">
          <div id="install-section" className="scroll-mt-24">
            <div className="mb-3 text-[12px] font-semibold tracking-[0.16em] text-neutral-500">
              安装使用
            </div>
            <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-neutral-950">
              安装整个 Skills 包
            </h2>
            <p className="mt-3 text-[14px] leading-7 text-neutral-600">
              可以把安装任务交给 Agent，也可以自己复制命令执行。整包安装会一次性载入包内所有公开
              Skill。
            </p>
          </div>

          <div className="mt-5 flex w-fit divide-x divide-neutral-200 overflow-hidden rounded-xl bg-neutral-100">
            {(['agent', 'human'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTab(mode)}
                className={cn(
                  'px-4 py-2 text-[12px] font-medium transition',
                  tab === mode
                    ? 'bg-neutral-900 text-white'
                    : 'bg-transparent text-neutral-600 hover:text-neutral-900',
                )}
              >
                {mode === 'agent' ? '面向 Agent' : '面向人工'}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <InstallCommand
              command={activeInstallContent}
              style={tab === 'agent' ? 'prompt' : 'terminal'}
              title={tab === 'agent' ? '给 Agent 的提示词' : '通用安装命令'}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(activeInstallContent)}
              className="rounded-lg bg-neutral-100 px-4 py-2 text-[13px] font-medium text-neutral-700 transition hover:bg-neutral-200"
            >
              {tab === 'agent' ? '复制提示词' : '复制命令'}
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="rounded-lg bg-neutral-100 px-4 py-2 text-[13px] font-medium text-neutral-700 transition hover:bg-neutral-200"
            >
              分享 Skills 包
            </button>
          </div>
        </section>
      </div>
      <PackageStatusSidebar pkg={pkg} onOpenSkills={onOpenSkills} />
    </div>
  );
}

function DetailContent({
  pkg,
  me,
  activeTab,
  onChangeTab,
  onPackageUpdate,
}: {
  pkg: SkillPackageDetail;
  me: MeResponse | null;
  activeTab: PackageDetailTab;
  onChangeTab: (tab: PackageDetailTab) => void;
  onPackageUpdate: (patch: PackageStatsPatch) => void;
}) {
  if (activeTab === 'skills') return <SkillsTab pkg={pkg} />;
  if (activeTab === 'install')
    return <InstallTab pkg={pkg} onOpenSkills={() => onChangeTab('skills')} />;
  if (activeTab === 'discussion') {
    return (
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-10">
          <CommentsSection
            targetName="Skills 包"
            commentCount={pkg.commentCount}
            me={me}
            loadComments={() => apiClient.listPackageComments(pkg.owner.handle, pkg.slug)}
            createComment={(input) =>
              apiClient.createPackageComment(pkg.owner.handle, pkg.slug, input)
            }
            onCommentCreated={() =>
              onPackageUpdate({
                upvoteCount: pkg.upvoteCount,
                commentCount: pkg.commentCount + 1,
                bookmarkCount: pkg.bookmarkCount,
                viewerHasUpvoted: pkg.viewerHasUpvoted,
                viewerHasBookmarked: pkg.viewerHasBookmarked,
              })
            }
          />
        </div>
        <PackageStatusSidebar pkg={pkg} onOpenSkills={() => onChangeTab('skills')} />
      </div>
    );
  }
  return <OverviewTab pkg={pkg} onOpenSkills={() => onChangeTab('skills')} />;
}

export default function PackageDetail() {
  const { owner, slug } = useParams<{ owner: string; slug: string }>();
  const [pkg, setPkg] = useState<SkillPackageDetail | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PackageDetailTab>('overview');

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getMe()
      .then((res) => {
        if (!cancelled) setMe(res);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!owner || !slug) return;
    let cancelled = false;
    setLoading(true);
    apiClient
      .getPackage(owner, slug)
      .then((res) => {
        if (!cancelled) {
          setPkg(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载 Skill 包失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [owner, slug]);

  const updatePackageStats = (patch: PackageStatsPatch) => {
    setPkg((current) => (current ? { ...current, ...patch } : current));
  };

  const openTabSection = (tab: PackageDetailTab, targetId: string) => {
    setActiveTab(tab);
    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  };

  if (loading) {
    return (
      <div className="py-24 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
        加载中…
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="py-24 text-center">
        <div className="mb-3 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
          404
        </div>
        <div className="text-neutral-700">{error ?? '没有找到这个 Skill 包'}</div>
        <Link
          to="/?content=packages"
          className="mt-5 inline-block rounded-lg border border-neutral-300 px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.1em] hover:border-neutral-900"
        >
          返回发现
        </Link>
      </div>
    );
  }

  return (
    <>
      <Breadcrumb pkg={pkg} />
      <HeroSection
        pkg={pkg}
        me={me}
        onUpvote={updatePackageStats}
        onBookmark={updatePackageStats}
        onCommentOpen={() => openTabSection('discussion', 'comments-section')}
      />
      <TabNav active={activeTab} onChange={setActiveTab} />

      <div className="bg-[#fcfcfb] px-6 py-10">
        <div className="mx-auto max-w-[1200px]">
          <DetailContent
            pkg={pkg}
            me={me}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            onPackageUpdate={updatePackageStats}
          />
        </div>
      </div>
    </>
  );
}
