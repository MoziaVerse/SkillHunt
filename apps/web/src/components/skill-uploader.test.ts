import { describe, expect, it } from 'bun:test';
import { type UploadFileLike, pickSkillFromFiles } from './skill-uploader';

describe('pickSkillFromFiles · single file', () => {
  it('picks .md file as SKILL.md (no extras)', () => {
    const files: UploadFileLike[] = [
      { name: 'SKILL.md', webkitRelativePath: '', size: 100, readText: async () => 'x' },
    ];
    const r = pickSkillFromFiles(files);
    expect(r.skillMd.name).toBe('SKILL.md');
    expect(r.extras).toHaveLength(0);
  });

  it('rejects when the only file is non-md', () => {
    const files: UploadFileLike[] = [
      { name: 'data.json', webkitRelativePath: '', size: 50, readText: async () => '{}' },
    ];
    expect(() => pickSkillFromFiles(files)).toThrow(/No SKILL\.md/);
  });
});

describe('pickSkillFromFiles · folder', () => {
  function fakeFolder(spec: Array<[string, number]>): UploadFileLike[] {
    return spec.map(([rel, size]) => ({
      name: rel.split('/').pop() ?? '',
      webkitRelativePath: rel,
      size,
      readText: async () => '',
    }));
  }

  it('finds shallowest SKILL.md and bundles siblings', () => {
    const r = pickSkillFromFiles(
      fakeFolder([
        ['skill-x/SKILL.md', 200],
        ['skill-x/assets/a.md', 100],
        ['skill-x/references/b.md', 100],
      ]),
    );
    expect(r.skillMdRoot).toBe('skill-x');
    expect(r.extras.map((e) => e.webkitRelativePath).sort()).toEqual([
      'assets/a.md',
      'references/b.md',
    ]);
  });

  it('skips dotfiles like .DS_Store', () => {
    const r = pickSkillFromFiles(
      fakeFolder([
        ['skill-x/.DS_Store', 6148],
        ['skill-x/SKILL.md', 200],
        ['skill-x/.git/HEAD', 50], // also hidden, segment-level
      ]),
    );
    expect(r.extras).toHaveLength(0);
    expect(r.rejected.find((x) => x.relPath.endsWith('.DS_Store'))).toBeDefined();
  });

  it('rejects total >1MB', () => {
    expect(() =>
      pickSkillFromFiles(
        fakeFolder([
          ['skill-x/SKILL.md', 100],
          ['skill-x/big.bin', 2_000_000],
        ]),
      ),
    ).toThrow(/exceeds 1 MB/);
  });

  it('preserves nested paths in extras', () => {
    const r = pickSkillFromFiles(
      fakeFolder([
        ['s/SKILL.md', 100],
        ['s/references/laws/01.md', 100],
        ['s/references/laws/02.md', 100],
      ]),
    );
    expect(r.extras.map((e) => e.webkitRelativePath).sort()).toEqual([
      'references/laws/01.md',
      'references/laws/02.md',
    ]);
  });

  it('uses shallowest SKILL.md when multiple present', () => {
    const r = pickSkillFromFiles(
      fakeFolder([
        ['outer/inner/SKILL.md', 100],
        ['outer/SKILL.md', 100],
      ]),
    );
    expect(r.skillMdRoot).toBe('outer');
    // outer/inner/SKILL.md ends up "outside" the chosen root prefix is "outer/" so
    // the inner one stays as an extra named "inner/SKILL.md" — acceptable, content
    // path is just a name once stored.
  });
});
