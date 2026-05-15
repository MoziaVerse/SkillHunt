import { Avatar } from '@/components/avatar';
import { Logo } from '@/components/logo';
import { PublishableCard } from '@/components/publishable-card';
import { ApiError, apiClient } from '@/lib/api-client';
import type { OwnerPublishablesResponse, PublishableListItem } from '@/types/api';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

type ContentFilter = 'all' | 'skills' | 'packages';

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

function UserCard({
  data,
  editable,
  onAvatarUpdate,
}: {
  data: OwnerPublishablesResponse;
  editable?: boolean;
  onAvatarUpdate?: (dataUrl: string) => void;
}) {
  const skillTotal = data.items.filter((item) => item.kind === 'skill').length;
  const packageTotal = data.items.filter((item) => item.kind === 'package').length;
  return (
    <section className="border-b border-neutral-200 px-6 pt-10 pb-8">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex items-start gap-5">
          <Avatar
            src={data.owner.image}
            name={data.owner.name}
            handle={data.owner.handle}
            size={80}
            editable={editable}
            onUpload={onAvatarUpdate}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#0f172a]">
              {data.owner.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] text-[#64748b]">
              <span className="font-mono">@{data.owner.handle}</span>
              <span className="h-1 w-1 rounded-full bg-neutral-300" />
              <span>已发布 {data.total} 个内容</span>
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

export default function UserPage() {
  const { owner = '' } = useParams<{ owner: string }>();
  const [data, setData] = useState<OwnerPublishablesResponse | null>(null);
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
    apiClient
      .getOwnerPublishables(owner)
      .then((res) => {
        if (!cancelled) setData(res);
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

  const visibleItems = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((item) => {
      if (filter === 'skills') return item.kind === 'skill';
      if (filter === 'packages') return item.kind === 'package';
      return true;
    });
  }, [data, filter]);

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return {
      all: items.length,
      skills: items.filter((item) => item.kind === 'skill').length,
      packages: items.filter((item) => item.kind === 'package').length,
    };
  }, [data]);

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
        data={data}
        editable={isOwnPage}
        onAvatarUpdate={isOwnPage ? handleAvatarUpload : undefined}
      />

      <div className="border-b border-neutral-100 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-2">
          <FilterButton
            active={filter === 'all'}
            label="全部"
            count={counts.all}
            onClick={() => setFilter('all')}
          />
          <FilterButton
            active={filter === 'skills'}
            label="只看 Skill"
            count={counts.skills}
            onClick={() => setFilter('skills')}
          />
          <FilterButton
            active={filter === 'packages'}
            label="只看包"
            count={counts.packages}
            onClick={() => setFilter('packages')}
          />
        </div>
      </div>

      {visibleItems.length === 0 ? (
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
            {visibleItems.map((item: PublishableListItem) => (
              <PublishableCard
                key={`${item.kind}:${item.item.owner.handle}/${item.item.slug}`}
                item={item}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
