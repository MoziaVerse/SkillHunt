import { InstallCommand } from '@/components/install-command';
import { Logo } from '@/components/logo';
import { GRID_WITHOUT_TAGS, GRID_WITH_TAGS, SkillRow } from '@/components/skill-row';
import { Input } from '@/components/ui/input';
import { useSkills, useTags } from '@/hooks/use-skills';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';

type TypeFilter = 'all' | 'owned' | 'referenced';
type SortMode = 'recent' | 'az';

function Hero() {
  return (
    <section className="py-14 border-b border-neutral-200">
      <div className="flex items-center gap-3 mb-4">
        <Logo size={28} />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500">
          phase 0 · localhost
        </span>
      </div>
      <h1 className="font-semibold text-[44px] leading-[1.02] tracking-[-0.03em] text-neutral-900">
        SkillHub
      </h1>
      <p className="mt-2 text-[17px] text-neutral-600 max-w-xl">
        The mozia agent skills 目录。一条命令即可将任意 skill 安装到本地 agent。
      </p>
      <div className="mt-6 max-w-[760px]">
        <InstallCommand command="npx skills add http://localhost:3333 --skill <slug> --agent claude-code -y" />
        <p className="mt-2 font-mono text-[11px] text-neutral-500">
          将 <code className="px-1 bg-neutral-100 rounded text-neutral-700">&lt;slug&gt;</code>{' '}
          替换为 well-known index 中的 skill 名称。用户自有 skill 会使用{' '}
          <code className="px-1 bg-neutral-100 rounded text-neutral-700">owner-slug-hash</code> 这种
          CLI 安全名称。将{' '}
          <code className="px-1 bg-neutral-100 rounded text-neutral-700">claude-code</code>{' '}
          替换为你的 首选 agent（cursor / copilot / opencode …）。
        </p>
      </div>
    </section>
  );
}

function TypeToggle({ value, onChange }: { value: TypeFilter; onChange: (v: TypeFilter) => void }) {
  const opts: Array<[TypeFilter, string]> = [
    ['all', '全部'],
    ['owned', '自有'],
    ['referenced', '引用'],
  ];
  return (
    <div className="flex border border-neutral-300 divide-x divide-neutral-300 font-mono text-[12px]">
      {opts.map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            'px-3 py-2 uppercase tracking-[0.08em] transition',
            value === k
              ? 'bg-neutral-900 text-neutral-100'
              : 'bg-white text-neutral-600 hover:text-neutral-900',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SortToggle({ value, onChange }: { value: SortMode; onChange: (v: SortMode) => void }) {
  const opts: Array<[SortMode, string]> = [
    ['recent', '最近'],
    ['az', 'A-Z'],
  ];
  return (
    <div className="flex border border-neutral-300 divide-x divide-neutral-300 font-mono text-[12px]">
      {opts.map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            'px-3 py-2 uppercase tracking-[0.08em] transition',
            value === k
              ? 'bg-neutral-900 text-neutral-100'
              : 'bg-white text-neutral-600 hover:text-neutral-900',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function SkillsList() {
  const [type, setType] = useState<TypeFilter>('all');
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortMode>('recent');

  const { items, loading, fetching, error } = useSkills({
    type,
    q: query.trim() ? query.trim() : undefined,
    tag: tags,
  });
  const allTags = useTags();

  const sorted = useMemo(() => {
    const xs = items.slice();
    if (sort === 'recent') {
      xs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else {
      xs.sort((a, b) => a.name.localeCompare(b.name));
    }
    return xs;
  }, [items, sort]);

  const toggleTag = (t: string) =>
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const reset = () => {
    setType('all');
    setQuery('');
    setTags([]);
  };

  return (
    <>
      <Hero />

      <div className="py-4 border-b border-neutral-200 sticky top-[49px] bg-white z-10">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              aria-hidden
            >
              <title>search</title>
              <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" />
              <line x1="9.2" y1="9.2" x2="12" y2="12" stroke="currentColor" strokeLinecap="round" />
            </svg>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="按名称或描述搜索 skill…"
              className="pl-9"
            />
          </div>
          <TypeToggle value={type} onChange={setType} />
          <SortToggle value={sort} onChange={setSort} />
        </div>

        {allTags.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
              标签
            </span>
            {allTags.map((t) => {
              const active = tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={cn(
                    'font-mono text-[11.5px] px-2 py-0.5 border transition',
                    active
                      ? 'border-neutral-900 bg-neutral-900 text-neutral-100'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900',
                  )}
                >
                  #{t}
                </button>
              );
            })}
            {tags.length > 0 && (
              <button
                type="button"
                onClick={() => setTags([])}
                className="font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500 hover:text-neutral-900 ml-1"
              >
                × 清除
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          'grid items-center border-b border-neutral-200 py-2 px-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500',
          GRID_WITH_TAGS,
        )}
      >
        <div>#</div>
        <div>skill</div>
        <div>来源</div>
        <div>标签</div>
        <div className="text-right">更新时间</div>
      </div>

      {error && (
        <div className="min-h-[400px] py-12 text-center font-mono text-[13px] text-red-700">
          API 错误：{error.message}。api 是否在 :3333 运行？
        </div>
      )}

      {!error && loading && (
        <div className="min-h-[400px] py-12 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
          loading…
        </div>
      )}

      {!error && !loading && sorted.length === 0 && (
        <div className="min-h-[400px] py-24 text-center">
          <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400 mb-3">
            无匹配结果
          </div>
          <div className="text-neutral-700 text-[15px]">换个关键词或清除筛选条件试试。</div>
          <button
            type="button"
            onClick={reset}
            className="mt-5 font-mono text-[12px] uppercase tracking-[0.1em] border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 transition"
          >
            重置
          </button>
        </div>
      )}

      {!error && !loading && sorted.length > 0 && (
        <>
          <div
            className={cn(
              'transition-opacity duration-150',
              fetching ? 'opacity-60' : 'opacity-100',
            )}
          >
            {sorted.map((s, i) => (
              <SkillRow key={s.slug} skill={s} index={i} />
            ))}
          </div>
          <div className="py-8 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-400">
            — 列表结束 · 共 {sorted.length} 个 skill —
          </div>
        </>
      )}
    </>
  );
}
