import { GRID_WITH_TAGS, SkillRow } from '@/components/skill-row';
import { ApiError, type OwnerSkillsResponse, apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

export default function UserPage() {
  const { owner = '' } = useParams<{ owner: string }>();
  const [data, setData] = useState<OwnerSkillsResponse | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);

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

  if (error?.status === 404) {
    return (
      <div className="py-24 text-center">
        <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400 mb-3">
          404
        </div>
        <div className="text-neutral-700">
          User <code className="font-mono">{owner}</code> not found.
        </div>
        <Link
          to="/"
          className="mt-5 inline-block font-mono text-[12px] uppercase tracking-[0.1em] border border-neutral-300 px-3 py-1.5 hover:border-neutral-900"
        >
          back home
        </Link>
      </div>
    );
  }

  if (!data)
    return (
      <div className="py-24 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
        loading…
      </div>
    );

  return (
    <>
      <section className="py-12 border-b border-neutral-200">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
          author
        </div>
        <h1 className="font-mono text-[36px] tracking-[-0.02em] text-neutral-900 font-medium">
          {data.owner.name}
        </h1>
        <p className="mt-2 font-mono text-[12.5px] text-neutral-500">
          {data.total} skill{data.total === 1 ? '' : 's'}
        </p>
      </section>

      {data.items.length === 0 ? (
        <div className="py-24 text-center text-neutral-500">
          <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400 mb-3">
            no skills yet
          </div>
        </div>
      ) : (
        <>
          <div
            className={cn(
              'grid items-center border-b border-neutral-200 py-2 px-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500',
              GRID_WITH_TAGS,
            )}
          >
            <div>#</div>
            <div>skill</div>
            <div>source</div>
            <div>tags</div>
            <div className="text-right">updated</div>
          </div>
          <div>
            {data.items.map((s, i) => (
              <SkillRow key={s.slug} skill={s} index={i} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
