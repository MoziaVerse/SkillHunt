import { InstallCommand } from '@/components/install-command';
import { apiClient } from '@/lib/api-client';
import { DEFAULT_SKILL_PACKAGE_ICON } from '@/lib/default-icons';
import type { SkillPackageDetail } from '@/types/api';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

function PackageCover({ pkg }: { pkg: SkillPackageDetail }) {
  if (pkg.coverImage) {
    return (
      <img
        src={pkg.coverImage}
        alt={`${pkg.name} 封面`}
        className="h-full w-full rounded-xl object-cover"
      />
    );
  }

  return (
    <div className="flex h-full min-h-[280px] w-full items-center justify-center rounded-xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-neutral-100 text-[86px] text-neutral-800">
      {pkg.icon ?? DEFAULT_SKILL_PACKAGE_ICON}
    </div>
  );
}

export default function PackageDetail() {
  const { owner, slug } = useParams<{ owner: string; slug: string }>();
  const [pkg, setPkg] = useState<SkillPackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-[1120px] rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">
          正在加载 Skill 包...
        </div>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-[720px] rounded-xl border border-red-200 bg-red-50 p-10 text-center text-red-700">
          {error ?? '没有找到这个 Skill 包'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <section className="border-b border-neutral-100 px-6 py-14">
        <div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <Link to="/packages" className="text-[13px] text-neutral-500 hover:text-neutral-900">
              ← 返回 Skill 包
            </Link>
            <div className="mt-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[13px] text-emerald-800">
              {pkg.skillCount} 个 skill · @{pkg.owner.handle}
            </div>
            <h1 className="mt-5 text-[42px] font-bold leading-[1.05] tracking-[-0.04em] text-neutral-950 sm:text-[58px]">
              {pkg.name}
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-8 text-neutral-600">
              {pkg.description}
            </p>
            {pkg.tags.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {pkg.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-[12px] text-neutral-600"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <PackageCover pkg={pkg} />
        </div>
      </section>

      <section className="mx-auto grid max-w-[1120px] gap-6 px-6 pb-16 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-neutral-950">
                包内 skills
              </h2>
              <p className="mt-1 text-[14px] text-neutral-500">
                `npx skills` 会从这个列表读取并安装文件。
              </p>
            </div>
          </div>

          {pkg.skills.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-neutral-500">
              这个 Skill 包暂时还没有公开可安装的 skill。
            </div>
          ) : (
            <div className="space-y-3">
              {pkg.skills.map((item) => (
                <Link
                  key={item.itemId}
                  to={`/skills/${item.skill.owner.handle}/${item.skill.slug}`}
                  className="block rounded-xl border border-neutral-200 p-4 transition hover:border-neutral-300 hover:bg-neutral-50"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-mono text-[12px] text-emerald-700">
                        {item.protocolName}
                      </div>
                      <h3 className="mt-1 text-lg font-semibold text-neutral-950">
                        {item.skill.name}
                      </h3>
                      <p className="mt-1 text-[14px] leading-6 text-neutral-600">
                        {item.skill.description}
                      </p>
                      {item.note ? (
                        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                          {item.note}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-[12px] text-neutral-600">
                      {item.files.length} 个文件
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-neutral-950">一键安装整包</h2>
            <p className="mt-2 text-[14px] leading-6 text-neutral-600">
              这个命令使用标准 well-known 协议，不需要 SkillHunt 自定义 CLI 参数。
            </p>
            <div className="mt-4">
              <InstallCommand command={pkg.installCommand} />
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 text-neutral-950">
            <h2 className="text-lg font-semibold">只安装部分 skill</h2>
            <p className="mt-2 text-[14px] leading-6 text-neutral-600">
              先用 `--list` 查看，再把需要的名称放到 `--skill` 后面。
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-neutral-950 p-4 font-mono text-[12px] leading-6 text-neutral-100">
              {`npx skills add ${window.location.origin}/p/${pkg.owner.handle}/${pkg.slug} --list
npx skills add ${window.location.origin}/p/${pkg.owner.handle}/${pkg.slug} --skill ${pkg.skills
                .slice(0, 2)
                .map((item) => item.protocolName)
                .join(' ')}`}
            </pre>
          </div>
        </aside>
      </section>
    </div>
  );
}
