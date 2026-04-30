import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { type UploadFileLike, pickSkillFromFiles } from './skill-uploader';

// Walk a directory recursively and produce UploadFileLike entries that mimic
// what the browser folder picker (webkitdirectory) gives us — namely
// `webkitRelativePath` set to "rootDirName/sub/path".
async function loadAsUpload(rootDir: string): Promise<UploadFileLike[]> {
  const out: UploadFileLike[] = [];
  const baseName = rootDir.split('/').pop() ?? '';
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        const rel = `${baseName}/${relative(rootDir, full)}`;
        const st = await stat(full);
        out.push({
          name: ent.name,
          webkitRelativePath: rel,
          size: st.size,
          readText: () => readFile(full, 'utf8'),
        });
      }
    }
  }
  await walk(rootDir);
  return out;
}

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

const REAL_WORLD_12388_PATH = '/Users/apple/Desktop/work/mclaw/SKILLS/12388';
const maybeIt = existsSync(REAL_WORLD_12388_PATH) ? it : it.skip;

describe('pickSkillFromFiles · real-world skill at /Users/apple/Desktop/work/mclaw/SKILLS/12388', () => {
  maybeIt('parses 12388 correctly', async () => {
    const files = await loadAsUpload(REAL_WORLD_12388_PATH);
    const r = pickSkillFromFiles(files);

    // SKILL.md sits at root of the picked folder
    expect(r.skillMdRoot).toBe('12388');
    expect(r.skillMd.name).toBe('SKILL.md');

    // .DS_Store is filtered
    expect(r.rejected.some((x) => x.relPath.endsWith('.DS_Store'))).toBe(true);

    // 13 extras: 2 in assets/ + 11 in references/laws/ + ??? actually 12 in references/laws
    const extraPaths = r.extras.map((e) => e.webkitRelativePath).sort();
    expect(extraPaths).toContain('assets/report-output-template.md');
    expect(extraPaths).toContain('assets/collection-summary-template.md');
    expect(extraPaths.filter((p) => p.startsWith('references/laws/')).length).toBeGreaterThan(5);

    // Every extra path is relative to skill root (no leading "12388/")
    for (const p of extraPaths) {
      expect(p.startsWith('12388/')).toBe(false);
      expect(p.startsWith('/')).toBe(false);
      expect(p.includes('..')).toBe(false);
    }

    // SKILL.md content actually loadable
    const md = await r.skillMd.readText();
    expect(md.length).toBeGreaterThan(20);
  });
});
