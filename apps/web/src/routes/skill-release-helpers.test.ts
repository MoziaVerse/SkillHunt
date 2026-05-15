import { describe, expect, it } from 'bun:test';
import {
  firstReleaseId,
  releaseChangelogText,
  releaseVersionLabel,
  sortReleaseFiles,
} from './skill-release-helpers';

describe('skill release helpers', () => {
  it('formats release version labels', () => {
    expect(releaseVersionLabel(3)).toBe('v3');
  });

  it('uses SKILL.md as the first file in release file lists', () => {
    expect(sortReleaseFiles(['scripts/run.sh', 'SKILL.md', 'README.md'])).toEqual([
      'SKILL.md',
      'README.md',
      'scripts/run.sh',
    ]);
  });

  it('normalizes empty changelog text', () => {
    expect(releaseChangelogText('  新增安装说明  ')).toBe('新增安装说明');
    expect(releaseChangelogText('   ')).toBe('这个版本没有填写发布说明。');
  });

  it('selects the first release by default', () => {
    expect(firstReleaseId([{ id: 'release-2' }, { id: 'release-1' }])).toBe('release-2');
    expect(firstReleaseId([])).toBeNull();
  });
});
