import { describe, expect, it } from 'bun:test';
import type { OwnedSkillListItem } from '../types/api';
import {
  MAX_PACKAGE_TAGS,
  MAX_PACKAGE_TAG_LENGTH,
  addPackageTag,
  hasPackageTag,
  matchesPackageSkillQuery,
  mergeOwnedSkillCandidates,
  normalizePackageTag,
  slugifyPackageName,
  sortPackageSkillCandidates,
  togglePackageTag,
} from './package-create-helpers';

function skill(id: string, overrides: Partial<OwnedSkillListItem> = {}): OwnedSkillListItem {
  return {
    id,
    type: 'owned',
    slug: id,
    name: `Skill ${id}`,
    description: `Description ${id}`,
    tags: [],
    icon: null,
    coverImage: null,
    demoVideoUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    owner: {
      id: `owner-${id}`,
      name: `Owner ${id}`,
      handle: `owner-${id}`,
      image: null,
    },
    upvoteCount: 0,
    commentCount: 0,
    bookmarkCount: 0,
    viewerHasUpvoted: false,
    viewerHasBookmarked: false,
    visibility: 'public',
    ...overrides,
  };
}

describe('package create helpers', () => {
  it('slugifies Chinese package names for URL-safe publishing', () => {
    expect(slugifyPackageName('视频案件分析包')).toBe('shi-pin-an-jian-fen-xi-bao');
  });

  it('preserves English words and existing separators when slugifying', () => {
    expect(slugifyPackageName('video-case-suite')).toBe('video-case-suite');
    expect(slugifyPackageName('AI工具包')).toBe('ai-gong-ju-bao');
    expect(slugifyPackageName('C++ 工具包')).toBe('c-gong-ju-bao');
  });

  it('toggles package tags through button-style selection', () => {
    expect(togglePackageTag([], '案件分析')).toEqual(['案件分析']);
    expect(togglePackageTag(['案件分析'], '案件分析')).toEqual([]);
    expect(
      togglePackageTag(
        Array.from({ length: MAX_PACKAGE_TAGS }, (_, i) => `tag-${i}`),
        '额外标签',
      ),
    ).toHaveLength(MAX_PACKAGE_TAGS);
  });

  it('adds custom tags with normalization and duplicate protection', () => {
    expect(normalizePackageTag('  #AI   Agent  ')).toBe('AI Agent');
    expect(normalizePackageTag('很长'.repeat(40))).toHaveLength(MAX_PACKAGE_TAG_LENGTH);
    expect(addPackageTag(['视频'], '  #AI   Agent  ')).toEqual(['视频', 'AI Agent']);
    expect(addPackageTag(['AI Agent'], 'ai agent')).toEqual(['AI Agent']);
    expect(hasPackageTag(['AI Agent'], '#ai agent')).toBe(true);
  });

  it('deduplicates candidate skills by id and keeps latest data', () => {
    const merged = mergeOwnedSkillCandidates(
      [skill('alpha', { name: '旧名称' })],
      [skill('alpha', { name: '新名称' }), skill('beta')],
    );
    expect(merged.map((item) => item.id)).toEqual(['alpha', 'beta']);
    expect(merged[0]?.name).toBe('新名称');
  });

  it('matches search against name, author, slug and tags', () => {
    const item = skill('video-case', {
      name: '视频案件分析',
      owner: { id: 'u1', name: '摩云', handle: 'mozia', image: null },
      tags: ['案件分析'],
    });
    expect(matchesPackageSkillQuery(item, 'mozia')).toBe(true);
    expect(matchesPackageSkillQuery(item, '案件')).toBe(true);
    expect(matchesPackageSkillQuery(item, 'missing')).toBe(false);
  });

  it('prioritizes bookmarked and own skills without moving selected candidates', () => {
    const ordinary = skill('ordinary', { updatedAt: '2026-05-01T00:00:00.000Z' });
    const own = skill('own', {
      owner: { id: 'u1', name: '我', handle: 'me', image: null },
      updatedAt: '2026-04-01T00:00:00.000Z',
    });
    const bookmarked = skill('bookmarked', {
      viewerHasBookmarked: true,
      updatedAt: '2026-03-01T00:00:00.000Z',
    });
    const selected = skill('selected', { updatedAt: '2026-02-01T00:00:00.000Z' });

    const sorted = sortPackageSkillCandidates([ordinary, own, bookmarked, selected], {
      selectedSkillIds: new Set(['selected']),
      bookmarkedSkillIds: new Set(),
      ownSkillIds: new Set(),
      ownerHandles: new Set(['me']),
    });

    expect(sorted.map((item) => item.id)).toEqual(['bookmarked', 'own', 'ordinary', 'selected']);
  });
});
