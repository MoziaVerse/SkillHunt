import { pinyin } from 'pinyin-pro';
import type { OwnedSkillListItem } from '../types/api';

export const MAX_PACKAGE_TAGS = 10;
export const MAX_PACKAGE_TAG_LENGTH = 40;

export const PACKAGE_TAG_OPTIONS = [
  '编程开发',
  '内容写作',
  '数据分析',
  '自动化',
  '搜索检索',
  '工作流',
  '办公效率',
  '研究分析',
  '文档处理',
  '报告生成',
  '电商',
  '客服支持',
  '案件分析',
  '视频',
  '多技能组合',
  '团队协作',
] as const;

export interface PackageSkillPriorityContext {
  selectedSkillIds: ReadonlySet<string>;
  bookmarkedSkillIds: ReadonlySet<string>;
  ownSkillIds: ReadonlySet<string>;
  ownerHandles: ReadonlySet<string>;
}

const HAN_TEXT_RE = /[\u3400-\u4dbf\u4e00-\u9fff]+/g;
const LEADING_HASH_RE = /^#+/;
const WHITESPACE_RE = /\s+/g;

export function slugifyPackageName(input: string) {
  const text = input
    .trim()
    .replace(
      HAN_TEXT_RE,
      (segment) => ` ${pinyin(segment, { toneType: 'none', type: 'string' })} `,
    );
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function normalizePackageTag(input: string) {
  return input
    .trim()
    .replace(LEADING_HASH_RE, '')
    .replace(WHITESPACE_RE, ' ')
    .trim()
    .slice(0, MAX_PACKAGE_TAG_LENGTH);
}

export function hasPackageTag(tags: string[], tag: string) {
  const normalized = normalizePackageTag(tag).toLowerCase();
  return tags.some((item) => normalizePackageTag(item).toLowerCase() === normalized);
}

export function addPackageTag(tags: string[], tag: string, maxTags = MAX_PACKAGE_TAGS) {
  const normalized = normalizePackageTag(tag);
  if (!normalized || hasPackageTag(tags, normalized) || tags.length >= maxTags) return tags;
  return [...tags, normalized];
}

export function togglePackageTag(tags: string[], tag: string, maxTags = MAX_PACKAGE_TAGS) {
  const normalized = normalizePackageTag(tag);
  if (!normalized) return tags;
  if (hasPackageTag(tags, normalized)) {
    return tags.filter(
      (item) => normalizePackageTag(item).toLowerCase() !== normalized.toLowerCase(),
    );
  }
  return addPackageTag(tags, normalized, maxTags);
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
