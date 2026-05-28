import { describe, expect, it } from 'bun:test';
import { type UploadFileLike, __test__, pickSkillFromFiles } from './skill-uploader';

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
    expect(r.ignoredSystemFiles).toHaveLength(2);
  });

  it('ignores large .git directories before enforcing the 5 MB upload cap', () => {
    const r = pickSkillFromFiles(
      fakeFolder([
        ['skill-x/SKILL.md', 200],
        ['skill-x/templates/prompt.md', 100],
        ['skill-x/.git/objects/pack.bin', 20 * 1024 * 1024],
      ]),
    );
    expect(r.extras.map((e) => e.webkitRelativePath)).toEqual(['templates/prompt.md']);
    expect(r.ignoredSystemFiles.map((f) => f.reason)).toContain('git-directory');
  });

  it('ignores repository and generated folders before enforcing the upload cap', () => {
    const r = pickSkillFromFiles(
      fakeFolder([
        ['skill-x/SKILL.md', 200],
        ['skill-x/.idea/workspace.xml', 2 * 1024 * 1024],
        ['skill-x/node_modules/pkg/index.js', 2 * 1024 * 1024],
        ['skill-x/dist/bundle.js', 2 * 1024 * 1024],
        ['skill-x/.cache/result.bin', 2 * 1024 * 1024],
        ['skill-x/references/keep.md', 100],
      ]),
    );
    expect(r.extras.map((e) => e.webkitRelativePath)).toEqual(['references/keep.md']);
    expect(r.ignoredSystemFiles).toHaveLength(4);
  });

  it('ignores root .gitignore without counting it in upload size', () => {
    const r = pickSkillFromFiles(
      fakeFolder([
        ['skill-x/SKILL.md', 200],
        ['skill-x/.gitignore', 10 * 1024 * 1024],
        ['skill-x/templates/.gitignore', 100],
      ]),
    );
    expect(r.extras.map((e) => e.webkitRelativePath)).toEqual(['templates/.gitignore']);
    expect(r.ignoredSystemFiles).toEqual([
      { relPath: 'skill-x/.gitignore', reason: 'root-gitignore' },
    ]);
  });

  it('allows total size under 5 MB', () => {
    const r = pickSkillFromFiles(
      fakeFolder([
        ['skill-x/SKILL.md', 100],
        ['skill-x/template.md', 5 * 1024 * 1024 - 200],
      ]),
    );

    expect(r.skillMd.name).toBe('SKILL.md');
    expect(r.extras).toHaveLength(1);
  });

  it('rejects total >5 MB', () => {
    expect(() =>
      pickSkillFromFiles(
        fakeFolder([
          ['skill-x/SKILL.md', 100],
          ['skill-x/big.bin', 5 * 1024 * 1024],
        ]),
      ),
    ).toThrow(/超过 5 MB 上限/);
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

describe('upload file type detection', () => {
  it('keeps text-like support files on the text upload path', () => {
    expect(__test__.isTextUpload('references/example.json', 'application/json')).toBe(true);
    expect(__test__.isTextUpload('scripts/run.sh', '')).toBe(true);
  });

  it('routes webp image assets to binary upload', () => {
    expect(__test__.isTextUpload('assets/background.webp', 'image/webp')).toBe(false);
    expect(__test__.inferContentType('assets/background.webp', '')).toBe('image/webp');
  });
});
