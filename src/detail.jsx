// Detail pages for owned & referenced skills.

function DetailPage({ slug }) {
  const skill = SKILLS.find((s) => s.slug === slug);
  if (!skill) {
    return (
      <div className="py-24 text-center">
        <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400 mb-3">
          404
        </div>
        <div className="text-neutral-700">
          Skill <code className="font-mono">{slug}</code> not found.
        </div>
        <Link
          to="/"
          className="mt-5 inline-block font-mono text-[12px] uppercase tracking-[0.1em] border border-neutral-300 px-3 py-1.5 hover:border-neutral-900"
        >
          ← back to list
        </Link>
      </div>
    );
  }
  return skill.type === 'owned' ? <OwnedDetail skill={skill} /> : <ReferencedDetail skill={skill} />;
}

function DetailHeader({ skill, right }) {
  return (
    <div className="pt-10 pb-8 border-b border-neutral-200">
      <Link
        to="/"
        className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-500 hover:text-neutral-900"
      >
        ← all skills
      </Link>
      <div className="mt-5 flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <SourceBadge skill={skill} />
            {skill.type === 'owned' && skill.visibility === 'internal' && (
              <Badge variant="warn">internal</Badge>
            )}
            <Badge variant="subtle">{skill.type}</Badge>
          </div>
          <h1 className="font-mono text-[36px] leading-[1.05] tracking-[-0.02em] text-neutral-900 font-medium">
            {skill.name}
          </h1>
          <p className="mt-3 text-[16px] text-neutral-600 max-w-2xl leading-relaxed">
            {skill.description}
          </p>
          <div className="mt-4 flex items-center gap-1 flex-wrap">
            {skill.tags.map((t) => (
              <span
                key={t}
                className="font-mono text-[11px] text-neutral-600 border border-neutral-200 px-1.5 py-0.5"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0">{right}</div>
      </div>
    </div>
  );
}

function MetaRow({ label, children }) {
  return (
    <div className="flex items-baseline gap-4 py-2 border-b border-neutral-100 last:border-b-0">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-400 w-20 shrink-0">
        {label}
      </span>
      <span className="text-[13.5px] text-neutral-800 font-mono">{children}</span>
    </div>
  );
}

function OwnedDetail({ skill }) {
  const installCommand = `npx skills add http://localhost:3333 --skill ${skill.slug}`;

  return (
    <>
      <DetailHeader
        skill={skill}
        right={
          <div className="font-mono text-[11px] text-neutral-500 text-right">
            updated
            <div className="text-neutral-900 text-[13px] mt-0.5">
              {formatRelative(skill.updatedAt)}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 pt-8">
        <div className="min-w-0">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
            install
          </div>
          <CopyCommand command={installCommand} />

          <div className="mt-10">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500">
                SKILL.md
              </div>
              <div className="font-mono text-[11px] text-neutral-400">
                {skill.skillMd.split('\n').length} lines
              </div>
            </div>
            <div className="border border-neutral-200 bg-white">
              <div className="px-5 py-5 lg:px-7 lg:py-7">
                <Markdown source={skill.skillMd} />
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-[68px] lg:self-start">
          <div className="border border-neutral-200 bg-white">
            <div className="px-4 py-3 border-b border-neutral-100">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500">
                metadata
              </div>
            </div>
            <div className="px-4 py-2">
              <MetaRow label="type">{skill.type}</MetaRow>
              <MetaRow label="visibility">{skill.visibility}</MetaRow>
              <MetaRow label="slug">{skill.slug}</MetaRow>
              <MetaRow label="created">{formatRelative(skill.createdAt)}</MetaRow>
              <MetaRow label="updated">{formatRelative(skill.updatedAt)}</MetaRow>
            </div>
          </div>

          <div className="mt-5 border border-neutral-200 bg-white">
            <div className="px-4 py-3 border-b border-neutral-100">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500">
                files · {skill.files.length}
              </div>
            </div>
            <ul className="px-4 py-2 font-mono text-[12.5px]">
              {skill.files.map((f) => (
                <li
                  key={f}
                  className="py-1.5 border-b border-neutral-100 last:border-b-0 flex items-center gap-2"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="text-neutral-400 shrink-0">
                    <rect x="1.5" y="0.5" width="6" height="9" fill="none" stroke="currentColor" />
                    <line x1="3" y1="3" x2="6" y2="3" stroke="currentColor" />
                    <line x1="3" y1="5" x2="6" y2="5" stroke="currentColor" />
                  </svg>
                  <span className="text-neutral-800 truncate">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}

function ReferencedDetail({ skill }) {
  return (
    <>
      <DetailHeader
        skill={skill}
        right={
          <div className="font-mono text-[11px] text-neutral-500 text-right">
            updated
            <div className="text-neutral-900 text-[13px] mt-0.5">
              {formatRelative(skill.updatedAt)}
            </div>
          </div>
        }
      />

      <div className="pt-8 max-w-3xl">
        <div className="border-l-2 border-neutral-900 pl-4 mb-8">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-neutral-500 mb-1">
            referenced skill
          </div>
          <p className="text-[14px] text-neutral-700 leading-relaxed">
            This skill is maintained by <span className="font-mono">{skill.sourceRepo}</span>. We
            don't host its content — install directly from the origin:
          </p>
        </div>

        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
          install
        </div>
        <CopyCommand command={skill.sourceInstallCommand} />

        {skill.sourceUrl && (
          <a
            href={skill.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 font-mono text-[12.5px] border border-neutral-300 px-3 py-2 hover:border-neutral-900 transition"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path
                d="M6 0.5c-3 0-5.5 2.5-5.5 5.5 0 2.4 1.6 4.5 3.8 5.2.3 0 .4-.1.4-.3v-1c-1.5.3-1.9-.6-1.9-.6-.3-.6-.6-.8-.6-.8-.5-.3 0-.3 0-.3.6 0 .9.6.9.6.5.9 1.4.6 1.7.5.1-.4.2-.6.4-.8-1.2-.1-2.5-.6-2.5-2.7 0-.6.2-1.1.6-1.5-.1-.2-.3-.7.1-1.5 0 0 .5-.2 1.5.6.4-.1.9-.2 1.4-.2s1 .1 1.4.2c1-.7 1.5-.6 1.5-.6.3.8.1 1.3 0 1.5.4.4.6.9.6 1.5 0 2.1-1.3 2.6-2.5 2.7.2.2.4.5.4 1v1.5c0 .2.1.3.4.3 2.2-.7 3.8-2.8 3.8-5.2 0-3-2.5-5.5-5.5-5.5z"
                fill="currentColor"
              />
            </svg>
            view source · {skill.sourceRepo}/{skill.sourceSkillName}
          </a>
        )}

        <div className="mt-10 border border-neutral-200 bg-neutral-50 px-5 py-4">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500 mb-2">
            metadata
          </div>
          <div className="grid grid-cols-2 gap-y-1">
            <MetaRow label="type">referenced</MetaRow>
            <MetaRow label="source">{skill.sourceRepo}</MetaRow>
            <MetaRow label="skill">{skill.sourceSkillName}</MetaRow>
            <MetaRow label="slug">{skill.slug}</MetaRow>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { DetailPage });
