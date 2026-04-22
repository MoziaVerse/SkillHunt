import { InstallCommand } from '@/components/install-command';
import { MarkdownView } from '@/components/markdown-view';
import { SourceBadge } from '@/components/source-badge';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { formatRelative } from '@/lib/format';
import type { SkillDetail } from '@/types/api';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 py-2 border-b border-neutral-100 last:border-b-0">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-400 w-20 shrink-0">
        {label}
      </span>
      <span className="text-[13.5px] text-neutral-800 font-mono break-all">{children}</span>
    </div>
  );
}

function DetailHeader({
  skill,
  right,
}: {
  skill: SkillDetail;
  right?: React.ReactNode;
}) {
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

function OwnedDetail({ skill }: { skill: Extract<SkillDetail, { type: 'owned' }> }) {
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
          <InstallCommand command={skill.installCommand} />

          <div className="mt-10">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-neutral-500">
                SKILL.md
              </div>
              <div className="font-mono text-[11px] text-neutral-400">
                {skill.skillMdContent.split('\n').length} lines
              </div>
            </div>
            <div className="border border-neutral-200 bg-white">
              <div className="px-5 py-5 lg:px-7 lg:py-7">
                <MarkdownView source={skill.skillMdContent} />
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
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    aria-hidden
                    className="text-neutral-400 shrink-0"
                  >
                    <title>file</title>
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

function ReferencedDetail({ skill }: { skill: Extract<SkillDetail, { type: 'referenced' }> }) {
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
        <InstallCommand command={skill.sourceInstallCommand} />

        {skill.sourceUrl && (
          <a
            href={skill.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 font-mono text-[12.5px] border border-neutral-300 px-3 py-2 hover:border-neutral-900 transition"
          >
            view source · {skill.sourceRepo}/{skill.sourceSkillName} ↗
          </a>
        )}

        <div className="mt-10 border border-neutral-200 bg-neutral-50 px-5 py-4">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500 mb-2">
            metadata
          </div>
          <div>
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

export default function SkillDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .getSkill(slug)
      .then((s) => {
        if (!cancelled) {
          setSkill(s);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="py-24 text-center font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-400">
        loading…
      </div>
    );
  }

  if (error || !skill) {
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

  return skill.type === 'owned' ? (
    <OwnedDetail skill={skill} />
  ) : (
    <ReferencedDetail skill={skill} />
  );
}
