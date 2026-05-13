import { Avatar } from '@/components/avatar';
import { Logo } from '@/components/logo';
import { ApiError, type OwnerSkillsResponse, apiClient } from '@/lib/api-client';
import { DEFAULT_REFERENCED_SKILL_ICON, DEFAULT_SKILL_ICON } from '@/lib/default-icons';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

function UserCard({
  owner,
  total,
  editable,
  onAvatarUpdate,
}: {
  owner: OwnerSkillsResponse['owner'];
  total: number;
  editable?: boolean;
  onAvatarUpdate?: (dataUrl: string) => void;
}) {
  return (
    <section className="px-6 pt-10 pb-8 border-b border-neutral-200">
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
            <h1 className="text-[28px] font-bold text-[#0f172a] tracking-[-0.02em]">
              {owner.name}
            </h1>
            <div className="mt-1 flex items-center gap-3 text-[13px] text-[#64748b]">
              <span className="font-mono">@{owner.handle}</span>
              <span className="w-1 h-1 rounded-full bg-neutral-300" />
              <span>已发布 {total} 个技能</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function UserSkillCard({ skill }: { skill: import('@/types/api').SkillListItem }) {
  return (
    <Link to={`/skills/${skill.owner.handle}/${skill.slug}`} className="skill-card flex flex-col">
      {/* Thumbnail */}
      <div className="aspect-square bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center text-[48px] select-none">
        {skill.icon ??
          (skill.type === 'owned' ? DEFAULT_SKILL_ICON : DEFAULT_REFERENCED_SKILL_ICON)}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
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
          <div className="flex items-center gap-1 flex-wrap overflow-hidden max-h-[20px]">
            {skill.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="inline-flex items-center px-1.5 py-0.5 bg-neutral-100 text-[10px] text-neutral-500 rounded-full"
              >
                #{t}
              </span>
            ))}
            {skill.tags.length > 2 && (
              <span className="text-[10px] text-neutral-400">+{skill.tags.length - 2}</span>
            )}
          </div>
          {skill.type === 'owned' && skill.visibility === 'private' && (
            <span className="text-[10px] px-1.5 py-0.5 border border-amber-300 text-amber-700 bg-amber-50 rounded">
              私有
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function UserPage() {
  const { owner = '' } = useParams<{ owner: string }>();
  const [data, setData] = useState<OwnerSkillsResponse | null>(null);
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
    apiClient
      .getOwnerSkills(owner)
      .then((d) => {
        if (!cancelled) setData(d);
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
        <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400 mb-3">
          404
        </div>
        <div className="text-neutral-700">
          用户 <code className="font-mono">{owner}</code> 不存在。
        </div>
        <Link
          to="/"
          className="mt-5 inline-block font-mono text-[12px] uppercase tracking-[0.1em] border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 rounded-lg"
        >
          返回首页
        </Link>
      </div>
    );
  }

  if (!data)
    return (
      <div className="py-24 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
        加载中…
      </div>
    );

  return (
    <>
      {/* Breadcrumb */}
      <nav className="px-6 py-3 border-b border-neutral-100 bg-white">
        <div className="mx-auto max-w-[1200px] flex items-center gap-1.5 text-[13px]">
          <Link to="/" className="text-neutral-500 hover:text-neutral-900 transition">
            <Logo size={16} className="text-neutral-900" />
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-900 font-medium">@{data.owner.handle}</span>
        </div>
      </nav>

      <UserCard
        owner={data.owner}
        total={data.total}
        editable={isOwnPage}
        onAvatarUpdate={isOwnPage ? handleAvatarUpload : undefined}
      />

      {data.items.length === 0 ? (
        <div className="px-6 py-24 text-center text-neutral-500">
          <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400 mb-3">
            暂无 skill
          </div>
          <p className="text-[14px] text-neutral-500">该用户还没有发布任何 skill。</p>
        </div>
      ) : (
        <div className="px-6 py-8">
          <div className="mx-auto max-w-[1200px] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {data.items.map((s) => (
              <UserSkillCard key={s.slug} skill={s} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
