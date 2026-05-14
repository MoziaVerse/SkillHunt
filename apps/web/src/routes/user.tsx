import { Avatar } from '@/components/avatar';
import { Logo } from '@/components/logo';
import { TwemojiIcon } from '@/components/twemoji-icon';
import { ApiError, type OwnerSkillsResponse, apiClient } from '@/lib/api-client';
import {
  DEFAULT_REFERENCED_SKILL_ICON,
  DEFAULT_SKILL_ICON,
  DEFAULT_SKILL_PACKAGE_ICON,
} from '@/lib/default-icons';
import type { SkillListItem, SkillPackageListItem } from '@/types/api';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

type UserProfileData = {
  owner: OwnerSkillsResponse['owner'];
  skills: SkillListItem[];
  packages: SkillPackageListItem[];
};

type ContentFilter = 'all' | 'skills' | 'packages';

function UserCard({
  owner,
  total,
  skillTotal,
  packageTotal,
  editable,
  onAvatarUpdate,
}: {
  owner: OwnerSkillsResponse['owner'];
  total: number;
  skillTotal: number;
  packageTotal: number;
  editable?: boolean;
  onAvatarUpdate?: (dataUrl: string) => void;
}) {
  return (
    <section className="border-b border-neutral-200 px-6 pt-10 pb-8">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex items-start gap-5">
          <Avatar
            src={owner.image}
            name={owner.name}
            handle={owner.handle}
            size={80}
            editable={editable}
            onUpload={onAvatarUpdate}
          />

          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#0f172a]">
              {owner.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] text-[#64748b]">
              <span className="font-mono">@{owner.handle}</span>
              <span className="h-1 w-1 rounded-full bg-neutral-300" />
              <span>已发布 {total} 个内容</span>
              <span className="h-1 w-1 rounded-full bg-neutral-300" />
              <span>
                Skill {skillTotal} · 包 {packageTotal}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
        active
          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
          : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900'
      }`}
    >
      <span>{label}</span>
      <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[11px] text-neutral-500">
        {count}
      </span>
    </button>
  );
}

function UserSkillCard({ skill }: { skill: SkillListItem }) {
  return (
    <Link to={`/skills/${skill.owner.handle}/${skill.slug}`} className="skill-card flex flex-col">
      <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 text-[48px] select-none">
        <TwemojiIcon
          emoji={
            skill.icon ??
            (skill.type === 'owned' ? DEFAULT_SKILL_ICON : DEFAULT_REFERENCED_SKILL_ICON)
          }
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold text-[15px] leading-tight text-[#0f172a]">
            {skill.name}
          </h3>
          {skill.type === 'owned' ? (
            <span className="inline-flex shrink-0 items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-700 uppercase">
              自有
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-neutral-600 uppercase">
              引用
            </span>
          )}
        </div>

        <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-[#64748b]">
          {skill.description}
        </p>

        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
          <div className="flex max-h-[20px] flex-wrap items-center gap-1 overflow-hidden">
            {skill.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500"
              >
                #{tag}
              </span>
            ))}
            {skill.tags.length > 2 ? (
              <span className="text-[10px] text-neutral-400">+{skill.tags.length - 2}</span>
            ) : null}
          </div>
          {skill.type === 'owned' && skill.visibility === 'private' ? (
            <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
              私有
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function UserPackageCard({ pkg }: { pkg: SkillPackageListItem }) {
  return (
    <Link
      to={`/packages/${pkg.owner.handle}/${pkg.slug}`}
      className="skill-card flex min-h-[260px] flex-col"
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-neutral-50 to-neutral-100 text-[48px] select-none">
        {pkg.coverImage ? (
          <img
            src={pkg.coverImage}
            alt={`${pkg.name} 封面`}
            className="h-full w-full object-cover"
          />
        ) : (
          <TwemojiIcon emoji={pkg.icon ?? DEFAULT_SKILL_PACKAGE_ICON} />
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold text-[15px] leading-tight text-[#0f172a]">
            {pkg.name}
          </h3>
          <span className="inline-flex shrink-0 items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-700 uppercase">
            包
          </span>
        </div>

        <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-[#64748b]">
          {pkg.description}
        </p>

        <div className="mt-3 border-t border-neutral-100 pt-3">
          <div className="mb-2 flex max-h-[20px] flex-wrap items-center gap-1 overflow-hidden">
            {pkg.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500"
              >
                #{tag}
              </span>
            ))}
            {pkg.tags.length > 2 ? (
              <span className="text-[10px] text-neutral-400">+{pkg.tags.length - 2}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1">
              <TwemojiIcon emoji="🧩" />
              {pkg.skillCount}
            </span>
            <span>▲ {pkg.upvoteCount}</span>
            <span className="inline-flex items-center gap-1">
              <TwemojiIcon emoji="💬" />
              {pkg.commentCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <TwemojiIcon emoji="🔖" />
              {pkg.bookmarkCount}
            </span>
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

export default function UserPage() {
  const { owner = '' } = useParams<{ owner: string }>();
  const [data, setData] = useState<UserProfileData | null>(null);
  const [filter, setFilter] = useState<ContentFilter>('all');
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [myHandle, setMyHandle] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getMe()
      .then((me) => {
        if (me) setMyHandle(me.handle);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setFilter('all');
    Promise.all([apiClient.getOwnerSkills(owner), apiClient.getOwnerPackages(owner)])
      .then(([skillsData, packagesData]) => {
        if (cancelled) return;
        setData({
          owner: skillsData.owner,
          skills: skillsData.items,
          packages: packagesData.items,
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError) setError({ status: e.status, message: e.body });
        else setError({ status: 0, message: e instanceof Error ? e.message : 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [owner]);

  const handleAvatarUpload = async (dataUrl: string) => {
    const result = await apiClient.updateAvatar(dataUrl);
    setData((prev) => (prev ? { ...prev, owner: { ...prev.owner, image: result.image } } : prev));
  };

  const isOwnPage = myHandle === owner;

  if (error?.status === 404) {
    return (
      <div className="py-24 text-center">
        <div className="mb-3 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
          404
        </div>
        <div className="text-neutral-700">
          用户 <code className="font-mono">{owner}</code> 不存在。
        </div>
        <Link
          to="/"
          className="mt-5 inline-block rounded-lg border border-neutral-300 px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.1em] hover:border-neutral-900"
        >
          返回首页
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-24 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
        加载中…
      </div>
    );
  }

  const entries = [
    ...data.skills.map((item) => ({ kind: 'skill' as const, item, updatedAt: item.updatedAt })),
    ...data.packages.map((item) => ({
      kind: 'package' as const,
      item,
      updatedAt: item.updatedAt,
    })),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const visibleEntries = entries.filter((entry) => {
    if (filter === 'skills') return entry.kind === 'skill';
    if (filter === 'packages') return entry.kind === 'package';
    return true;
  });
  const total = data.skills.length + data.packages.length;

  return (
    <>
      <nav className="border-b border-neutral-100 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-[1200px] items-center gap-1.5 text-[13px]">
          <Link to="/" className="text-neutral-500 transition hover:text-neutral-900">
            <Logo size={16} className="text-neutral-900" />
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="font-medium text-neutral-900">@{data.owner.handle}</span>
        </div>
      </nav>

      <UserCard
        owner={data.owner}
        total={total}
        skillTotal={data.skills.length}
        packageTotal={data.packages.length}
        editable={isOwnPage}
        onAvatarUpdate={isOwnPage ? handleAvatarUpload : undefined}
      />

      <div className="border-b border-neutral-100 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-2">
          <FilterButton
            active={filter === 'all'}
            label="全部"
            count={total}
            onClick={() => setFilter('all')}
          />
          <FilterButton
            active={filter === 'skills'}
            label="只看 Skill"
            count={data.skills.length}
            onClick={() => setFilter('skills')}
          />
          <FilterButton
            active={filter === 'packages'}
            label="只看包"
            count={data.packages.length}
            onClick={() => setFilter('packages')}
          />
        </div>
      </div>

      {visibleEntries.length === 0 ? (
        <div className="px-6 py-24 text-center text-neutral-500">
          <div className="mb-3 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
            暂无内容
          </div>
          <p className="text-[14px] text-neutral-500">
            {filter === 'all'
              ? '该用户还没有发布任何 Skill 或 Skills 包。'
              : filter === 'skills'
                ? '该用户还没有发布任何 Skill。'
                : '该用户还没有发布任何 Skills 包。'}
          </p>
        </div>
      ) : (
        <div className="px-6 py-8">
          <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {visibleEntries.map((entry) =>
              entry.kind === 'skill' ? (
                <UserSkillCard key={`skill:${entry.item.id}`} skill={entry.item} />
              ) : (
                <UserPackageCard key={`package:${entry.item.id}`} pkg={entry.item} />
              ),
            )}
          </div>
        </div>
      )}
    </>
  );
}
