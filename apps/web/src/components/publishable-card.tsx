import {
  DEFAULT_REFERENCED_SKILL_ICON,
  DEFAULT_SKILL_ICON,
  DEFAULT_SKILL_PACKAGE_ICON,
} from '@/lib/default-icons';
import type { PublishableListItem, SkillListItem, SkillPackageListItem } from '@/types/api';
import { Link } from 'react-router';
import { TwemojiIcon } from './twemoji-icon';

function Cover({
  coverImage,
  name,
  icon,
}: {
  coverImage: string | null;
  name: string;
  icon: string;
}) {
  if (coverImage) {
    return <img src={coverImage} alt={`${name} 封面`} className="h-full w-full object-cover" />;
  }
  return (
    <div className="flex h-full w-full select-none items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 text-[48px]">
      <TwemojiIcon emoji={icon} />
    </div>
  );
}

function MetricIcon({ emoji, value }: { emoji: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
      <TwemojiIcon emoji={emoji} />
      {value}
    </span>
  );
}

function visibleTags(item: { tags: string[]; externalTags: string[] }) {
  return [...new Set([...item.externalTags, ...item.tags])].slice(0, 3);
}

function SkillCard({ skill }: { skill: SkillListItem }) {
  const icon =
    skill.icon ?? (skill.type === 'owned' ? DEFAULT_SKILL_ICON : DEFAULT_REFERENCED_SKILL_ICON);
  const tags = visibleTags(skill);
  return (
    <Link to={`/skills/${skill.owner.handle}/${skill.slug}`} className="skill-card flex flex-col">
      <div className="aspect-square h-40 overflow-hidden bg-gradient-to-br from-neutral-50 to-neutral-100">
        <Cover coverImage={skill.coverImage} name={skill.name} icon={icon} />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-neutral-400">
          <span>{skill.type === 'owned' ? 'Skill' : '来源推荐'}</span>
          <span>{new Date(skill.updatedAt).toLocaleDateString()}</span>
        </div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-[#0f172a]">
            {skill.name}
          </h3>
          <span className="inline-flex shrink-0 items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
            {skill.type === 'owned' ? 'Skill' : '引用'}
          </span>
        </div>

        <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-[#64748b]">
          {skill.description}
        </p>

        <div className="mt-3 flex flex-wrap gap-1 overflow-hidden">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
          <span className="text-[12px] text-neutral-500">
            作者 <span className="font-medium text-neutral-700">@{skill.owner.handle}</span>
          </span>
          <div className="flex items-center gap-3">
            {skill.downloadCount > 0 ? <MetricIcon emoji="⬇️" value={skill.downloadCount} /> : null}
            <span className="text-[11px] text-neutral-500">▲ {skill.upvoteCount}</span>
            <MetricIcon emoji="💬" value={skill.commentCount} />
            <MetricIcon emoji="🔖" value={skill.bookmarkCount} />
            {skill.type === 'owned' && skill.visibility === 'private' ? (
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

function PackageCard({ pkg }: { pkg: SkillPackageListItem }) {
  const tags = visibleTags(pkg);
  return (
    <Link to={`/packages/${pkg.owner.handle}/${pkg.slug}`} className="skill-card flex flex-col">
      <div className="aspect-square h-40 overflow-hidden bg-gradient-to-br from-neutral-50 to-neutral-100">
        <Cover
          coverImage={pkg.coverImage}
          name={pkg.name}
          icon={pkg.icon ?? DEFAULT_SKILL_PACKAGE_ICON}
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-neutral-400">
          <span>Skills 包</span>
          <span>{new Date(pkg.updatedAt).toLocaleDateString()}</span>
        </div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-[#0f172a]">
            {pkg.name}
          </h3>
          <span className="inline-flex shrink-0 items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
            包
          </span>
        </div>

        <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-[#64748b]">
          {pkg.description}
        </p>

        <div className="mt-3 flex flex-wrap gap-1 overflow-hidden">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
          <span className="text-[12px] text-neutral-500">
            作者 <span className="font-medium text-neutral-700">@{pkg.owner.handle}</span>
          </span>
          <div className="flex items-center gap-3">
            <MetricIcon emoji="🧩" value={pkg.skillCount} />
            <span className="text-[11px] text-neutral-500">▲ {pkg.upvoteCount}</span>
            <MetricIcon emoji="💬" value={pkg.commentCount} />
            <MetricIcon emoji="🔖" value={pkg.bookmarkCount} />
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

export function PublishableCard({ item }: { item: PublishableListItem }) {
  if (item.kind === 'package') return <PackageCard pkg={item.item} />;
  return <SkillCard skill={item.item} />;
}
