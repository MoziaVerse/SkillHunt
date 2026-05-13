import { InstallCommand } from '@/components/install-command';
import { apiClient } from '@/lib/api-client';
import { DEFAULT_SKILL_PACKAGE_ICON } from '@/lib/default-icons';
import { cn } from '@/lib/utils';
import type { SkillPackageListItem } from '@/types/api';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

type SortMode = 'recent' | 'az';

function PackageCover({ pkg }: { pkg: SkillPackageListItem }) {
  if (pkg.coverImage) {
    return (
      <img src={pkg.coverImage} alt={`${pkg.name} 封面`} className="h-full w-full object-cover" />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 text-[46px] text-neutral-800">
      {pkg.icon ?? DEFAULT_SKILL_PACKAGE_ICON}
    </div>
  );
}

function PackageCard({ pkg }: { pkg: SkillPackageListItem }) {
  return (
    <article className="skill-card flex flex-col">
      <Link to={`/packages/${pkg.owner.handle}/${pkg.slug}`} className="block">
        <div className="aspect-square h-40 overflow-hidden bg-gradient-to-br from-neutral-50 to-neutral-100">
          <PackageCover pkg={pkg} />
        </div>
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.14em] text-neutral-400">
            <span>Skill 包</span>
            <span>{pkg.skillCount} 个 skill</span>
          </div>
          <h2 className="truncate text-[15px] font-semibold leading-tight text-[#0f172a]">
            {pkg.name}
          </h2>
          <p className="mt-2 line-clamp-3 min-h-[60px] text-[13px] leading-relaxed text-[#64748b]">
            {pkg.description}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-[12px] text-neutral-500">
            <span>
              发布者 <span className="font-medium text-neutral-800">@{pkg.owner.handle}</span>
            </span>
            <span>{new Date(pkg.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </Link>
      <div className="mt-auto px-4 pb-4">
        <InstallCommand command={pkg.installCommand} style="inline" />
      </div>
    </article>
  );
}

export default function PackagesList() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [packages, setPackages] = useState<SkillPackageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .listPackages({ q: query.trim() || undefined, sort, limit: 60 })
      .then((res) => {
        if (!cancelled) {
          setPackages(res.items);
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
  }, [query, sort]);

  return (
    <div className="min-h-screen bg-white">
      <section className="border-b border-neutral-100 px-6 py-14">
        <div className="mx-auto max-w-[1120px]">
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[13px] text-emerald-800">
            面向场景的一键载入
          </span>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <h1 className="text-[42px] font-bold leading-[1.05] tracking-[-0.04em] text-neutral-950 sm:text-[56px]">
                用 Skill 包一次装好一组能力
              </h1>
              <p className="mt-5 max-w-2xl text-[17px] leading-8 text-neutral-600">
                Skill 包把相关 skills 按使用场景组织起来。它仍然兼容标准{' '}
                <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[14px]">
                  npx skills add
                </code>{' '}
                命令，可以查看、筛选，也可以一条指令安装整包。
              </p>
              <Link
                to="/publish"
                className="mt-7 inline-flex rounded-lg bg-neutral-950 px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-neutral-800"
              >
                创建 Skill 包
              </Link>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-950 p-5 text-neutral-100">
              <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                推荐安装方式
              </div>
              <div className="font-mono text-[13px] leading-7 text-neutral-200">
                <span className="text-emerald-400">$</span> npx skills add &lt;package-url&gt;
                <br />
                <span className="text-emerald-400">$</span> --skill '*' -y
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-6 pb-16">
        <div className="mb-6 mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 Skill 包、场景或发布者..."
            className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[14px] outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
          <div className="flex overflow-hidden rounded-xl border border-neutral-300 text-[12px]">
            {(
              [
                ['recent', '最新'],
                ['az', 'A-Z'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={cn(
                  'px-4 py-2.5 transition',
                  sort === key
                    ? 'bg-neutral-950 text-white'
                    : 'bg-white text-neutral-600 hover:text-neutral-950',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">
            正在加载 Skill 包...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center text-red-700">
            {error}
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
            <h2 className="text-lg font-semibold text-neutral-900">还没有匹配的 Skill 包</h2>
            <p className="mt-2 text-[14px] text-neutral-500">
              可以换个关键词，或先发布一组新的场景能力。
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
