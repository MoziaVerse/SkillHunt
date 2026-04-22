// List page — ranking-table layout echoing skills.sh, with hero + search + filters.

function Hero({ variant }) {
  const stat = (
    <div className="flex items-center gap-4 mt-5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-500">
      <span>
        <span className="text-neutral-900 font-semibold">{SKILLS.length}</span> skills
      </span>
      <span className="w-1 h-1 rounded-full bg-neutral-300" />
      <span>
        <span className="text-neutral-900 font-semibold">
          {SKILLS.filter((s) => s.type === 'owned').length}
        </span>{' '}
        owned
      </span>
      <span className="w-1 h-1 rounded-full bg-neutral-300" />
      <span>
        <span className="text-neutral-900 font-semibold">
          {SKILLS.filter((s) => s.type === 'referenced').length}
        </span>{' '}
        referenced
      </span>
    </div>
  );

  if (variant === 'minimal') {
    return (
      <section className="py-10 border-b border-neutral-200">
        <div className="font-mono text-[13px] text-neutral-500 mb-1">
          <span className="text-neutral-400">$</span> npx skills add{' '}
          <span className="text-neutral-900">http://localhost:3333</span>{' '}
          <span className="text-neutral-400">&lt;skill&gt;</span>
        </div>
      </section>
    );
  }

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
        The mozia agent skills directory. Install any skill into your local agent with one command.
      </p>
      <div className="mt-6 max-w-[640px]">
        <CopyCommand command="npx skills add http://localhost:3333 <skill>" />
      </div>
      {stat}
    </section>
  );
}

function Logo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="22" height="22" fill="none" stroke="#111" strokeWidth="1.5" />
      <rect x="5" y="5" width="6" height="6" fill="#111" />
      <rect x="13" y="5" width="6" height="6" fill="none" stroke="#111" strokeWidth="1.5" />
      <rect x="5" y="13" width="6" height="6" fill="none" stroke="#111" strokeWidth="1.5" />
      <rect x="13" y="13" width="6" height="6" fill="#111" />
    </svg>
  );
}

function FilterBar({ type, setType, query, setQuery, tags, setTags, sort, setSort }) {
  const toggleTag = (t) =>
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
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
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" />
            <line x1="9.2" y1="9.2" x2="12" y2="12" stroke="currentColor" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills by name or description…"
            className="w-full pl-9 pr-3 py-2 border border-neutral-300 text-[13.5px] focus:outline-none focus:border-neutral-900 transition font-mono bg-white"
          />
        </div>

        <div className="flex border border-neutral-300 divide-x divide-neutral-300 font-mono text-[12px]">
          {[
            ['all', '全部'],
            ['owned', '自有'],
            ['referenced', '引用'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setType(k)}
              className={cx(
                'px-3 py-2 uppercase tracking-[0.08em] transition',
                type === k
                  ? 'bg-neutral-900 text-neutral-100'
                  : 'bg-white text-neutral-600 hover:text-neutral-900'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex border border-neutral-300 divide-x divide-neutral-300 font-mono text-[12px]">
          {[
            ['recent', '最近'],
            ['az', 'A-Z'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={cx(
                'px-3 py-2 uppercase tracking-[0.08em] transition',
                sort === k
                  ? 'bg-neutral-900 text-neutral-100'
                  : 'bg-white text-neutral-600 hover:text-neutral-900'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-neutral-500">
          tags
        </span>
        {ALL_TAGS.map((t) => {
          const active = tags.includes(t);
          return (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              className={cx(
                'font-mono text-[11.5px] px-2 py-0.5 border transition',
                active
                  ? 'border-neutral-900 bg-neutral-900 text-neutral-100'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900'
              )}
            >
              #{t}
            </button>
          );
        })}
        {tags.length > 0 && (
          <button
            onClick={() => setTags([])}
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500 hover:text-neutral-900 ml-1"
          >
            × clear
          </button>
        )}
      </div>
    </div>
  );
}

function SkillRow({ skill, index, density, showTagsCol }) {
  const pad = density === 'compact' ? 'py-3' : 'py-5';
  return (
    <Link
      to={`/skills/${skill.slug}`}
      className={cx(
        'group grid items-start border-b border-neutral-100 hover:bg-neutral-50 transition px-1',
        pad,
        showTagsCol
          ? 'grid-cols-[42px_1fr_180px_120px_72px]'
          : 'grid-cols-[42px_1fr_200px_80px]'
      )}
    >
      <div className="font-mono text-[12px] text-neutral-400 tabular-nums pt-0.5">
        {String(index + 1).padStart(2, '0')}
      </div>

      <div className="min-w-0 pr-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[15px] font-medium text-neutral-900 group-hover:underline decoration-neutral-400 underline-offset-4">
            {skill.name}
          </span>
          {skill.type === 'owned' && skill.visibility === 'internal' && (
            <Badge variant="warn">internal</Badge>
          )}
        </div>
        <p className="mt-1 text-[13px] text-neutral-600 line-clamp-2 leading-relaxed">
          {skill.description}
        </p>
      </div>

      <div className="pt-1">
        <SourceBadge skill={skill} />
      </div>

      {showTagsCol && (
        <div className="pt-1 flex items-center gap-1 flex-wrap overflow-hidden max-h-[22px]">
          {skill.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="font-mono text-[10.5px] text-neutral-500 border border-neutral-200 px-1.5 py-0.5"
            >
              #{t}
            </span>
          ))}
          {skill.tags.length > 2 && (
            <span className="font-mono text-[10.5px] text-neutral-400">
              +{skill.tags.length - 2}
            </span>
          )}
        </div>
      )}

      <div className="font-mono text-[12px] text-neutral-500 text-right tabular-nums pt-1">
        {formatRelative(skill.updatedAt)}
      </div>
    </Link>
  );
}

function EmptyState({ onReset }) {
  return (
    <div className="py-24 text-center">
      <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400 mb-3">
        no matches
      </div>
      <div className="text-neutral-700 text-[15px]">
        Try a different query or clear the filters.
      </div>
      <button
        onClick={onReset}
        className="mt-5 font-mono text-[12px] uppercase tracking-[0.1em] border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 transition"
      >
        reset
      </button>
    </div>
  );
}

function ListPage({ tweaks }) {
  const [type, setType] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [tags, setTags] = React.useState([]);
  const [sort, setSort] = React.useState('recent');

  const filtered = React.useMemo(() => {
    let xs = SKILLS.slice();
    if (type !== 'all') xs = xs.filter((s) => s.type === type);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      xs = xs.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (tags.length > 0) {
      xs = xs.filter((s) => tags.every((t) => s.tags.includes(t)));
    }
    if (sort === 'recent') {
      xs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } else {
      xs.sort((a, b) => a.name.localeCompare(b.name));
    }
    return xs;
  }, [type, query, tags, sort]);

  return (
    <>
      <Hero variant={tweaks.heroVariant} />
      <FilterBar
        type={type}
        setType={setType}
        query={query}
        setQuery={setQuery}
        tags={tags}
        setTags={setTags}
        sort={sort}
        setSort={setSort}
      />

      <div
        className={cx(
          'grid items-center border-b border-neutral-200 py-2 px-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500',
          tweaks.showTagsCol
            ? 'grid-cols-[42px_1fr_180px_120px_72px]'
            : 'grid-cols-[42px_1fr_200px_80px]'
        )}
      >
        <div>#</div>
        <div>skill</div>
        <div>source</div>
        {tweaks.showTagsCol && <div>tags</div>}
        <div className="text-right">updated</div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          onReset={() => {
            setType('all');
            setQuery('');
            setTags([]);
          }}
        />
      ) : (
        <div>
          {filtered.map((s, i) => (
            <SkillRow
              key={s.slug}
              skill={s}
              index={i}
              density={tweaks.density}
              showTagsCol={tweaks.showTagsCol}
            />
          ))}
        </div>
      )}

      <div className="py-8 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-400">
        — end of list · {filtered.length} of {SKILLS.length} —
      </div>
    </>
  );
}

Object.assign(window, { ListPage, Logo });
