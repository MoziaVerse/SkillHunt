import type { SkillListItem } from '@/types/api';

export function SourceBadge({
  skill,
}: { skill: Pick<SkillListItem, 'type'> & Partial<{ sourceRepo: string }> }) {
  if (skill.type === 'owned') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-neutral-900">
        <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0" aria-hidden>
          <title>owned</title>
          <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
          <rect x="3" y="3" width="4" height="4" fill="currentColor" />
        </svg>
        mozia-official
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-neutral-600">
      <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0" aria-hidden>
        <title>referenced</title>
        <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
      </svg>
      {skill.sourceRepo}
    </span>
  );
}
