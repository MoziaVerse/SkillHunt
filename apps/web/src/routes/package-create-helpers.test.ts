import { describe, expect, it } from 'bun:test';
import type { OwnedSkillListItem } from '../types/api';
import {
  matchesPackageSkillQuery,
  mergeOwnedSkillCandidates,
  parsePackageTags,
  slugifyPackageName,
  sortPackageSkillCandidates,
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

  it('parses Chinese and English comma-separated tags', () => {
    expect(parsePackageTags('案件分析, 视频，报告')).toEqual(['案件分析', '视频', '报告']);
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

  it('prioritizes selected, bookmarked and own skills before ordinary candidates', () => {
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

    expect(sorted.map((item) => item.id)).toEqual(['selected', 'bookmarked', 'own', 'ordinary']);
  });
});
