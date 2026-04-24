import { SourceBadge } from '@/components/source-badge';
import { Badge } from '@/components/ui/badge';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SkillListItem } from '@/types/api';
import { Link } from 'react-router';

const GRID_WITH_TAGS = 'grid-cols-[42px_1fr_180px_120px_72px]';
const GRID_WITHOUT_TAGS = 'grid-cols-[42px_1fr_200px_80px]';

export function SkillRow({
  skill,
  index,
  showTagsCol = true,
}: {
  skill: SkillListItem;
  index: number;
  showTagsCol?: boolean;
}) {
  return (
    <Link
      to={`/skills/${skill.owner.handle}/${skill.slug}`}
      className={cn(
        'group grid items-start border-b border-neutral-100 hover:bg-neutral-50 transition px-1 py-5',
        showTagsCol ? GRID_WITH_TAGS : GRID_WITHOUT_TAGS,
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
          <span className="font-mono text-[11px] text-neutral-500" title={`@${skill.owner.handle}`}>
            <span className="text-neutral-400">by </span>
            {skill.owner.name}
          </span>
          {skill.type === 'owned' && skill.visibility === 'private' && (
            <Badge variant="warn">私有</Badge>
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

export { GRID_WITH_TAGS, GRID_WITHOUT_TAGS };
