import { pinyin } from 'pinyin-pro';
import type { OwnedSkillListItem } from '../types/api';

export interface PackageSkillPriorityContext {
  selectedSkillIds: ReadonlySet<string>;
  bookmarkedSkillIds: ReadonlySet<string>;
  ownSkillIds: ReadonlySet<string>;
  ownerHandles: ReadonlySet<string>;
}

export function slugifyPackageName(input: string) {
  const text = pinyin(input.trim(), { toneType: 'none', type: 'string' });
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function parsePackageTags(input: string) {
  return input
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function mergeOwnedSkillCandidates(...groups: OwnedSkillListItem[][]) {
  const byId = new Map<string, OwnedSkillListItem>();
  for (const group of groups) {
    for (const skill of group) {
      byId.set(skill.id, { ...byId.get(skill.id), ...skill });
    }
  }
  return [...byId.values()];
}

export function matchesPackageSkillQuery(skill: OwnedSkillListItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    skill.name,
    skill.description,
    skill.owner.name,
    skill.owner.handle,
    skill.slug,
    ...skill.tags,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function isBookmarkedPackageSkill(
  skill: OwnedSkillListItem,
  context: Pick<PackageSkillPriorityContext, 'bookmarkedSkillIds'>,
) {
  return skill.viewerHasBookmarked || context.bookmarkedSkillIds.has(skill.id);
}

export function isOwnPackageSkill(
  skill: OwnedSkillListItem,
  context: Pick<PackageSkillPriorityContext, 'ownSkillIds' | 'ownerHandles'>,
) {
  return context.ownSkillIds.has(skill.id) || context.ownerHandles.has(skill.owner.handle);
}

export function isPriorityPackageSkill(
  skill: OwnedSkillListItem,
  context: Pick<PackageSkillPriorityContext, 'bookmarkedSkillIds' | 'ownSkillIds' | 'ownerHandles'>,
) {
  return isBookmarkedPackageSkill(skill, context) || isOwnPackageSkill(skill, context);
}

function packageSkillScore(skill: OwnedSkillListItem, context: PackageSkillPriorityContext) {
  let score = 0;
  if (context.selectedSkillIds.has(skill.id)) score += 1000;
  if (isBookmarkedPackageSkill(skill, context)) score += 120;
  if (isOwnPackageSkill(skill, context)) score += 100;
  score += Math.min(skill.bookmarkCount, 40);
  score += Math.min(skill.upvoteCount, 40);
  return score;
}

export function sortPackageSkillCandidates(
  skills: OwnedSkillListItem[],
  context: PackageSkillPriorityContext,
) {
  return [...skills].sort((a, b) => {
    const scoreDiff = packageSkillScore(b, context) - packageSkillScore(a, context);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
