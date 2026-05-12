import { afterEach, describe, expect, it } from 'bun:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { importLocalSkills } from './import-builtin-skills';

const tempRoots: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'skillhub-import-'));
  tempRoots.push(dir);
  return dir;
}

async function writeFixtureFile(root: string, relativePath: string, content: string | Uint8Array) {
  const fullPath = join(root, relativePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
}

afterEach(async () => {
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

describe('import-builtin-skills', () => {
  it('imports text files and generates skill.json', async () => {
    const source = await createTempDir();
    const dest = await createTempDir();

    await writeFixtureFile(
      source,
      'alpha-skill/SKILL.md',
      '---\nname: alpha-skill\ndescription: alpha desc\n---\n# Alpha\n',
    );
    await writeFixtureFile(source, 'alpha-skill/references/checklist.md', '# Checklist\n');

    const result = await importLocalSkills({
      sourceRoot: pathToFileURL(`${source}/`),
      destinationRoot: pathToFileURL(`${dest}/`),
      log: () => {},
    });

    expect(result.imported).toBe(1);
    expect(result.skippedSkills).toBe(0);
    expect(result.skippedFiles).toBe(0);

    const meta = JSON.parse(await readFile(join(dest, 'alpha-skill', 'skill.json'), 'utf8')) as {
      visibility: string;
      tags: string[];
    };
    expect(meta.visibility).toBe('public');
    expect(meta.tags).toEqual([]);
    expect(await readFile(join(dest, 'alpha-skill', 'SKILL.md'), 'utf8')).toContain('Alpha');
    expect(await readFile(join(dest, 'alpha-skill', 'references/checklist.md'), 'utf8')).toContain(
      'Checklist',
    );
  });

  it('skips hidden, cache, and binary files', async () => {
    const source = await createTempDir();
    const dest = await createTempDir();

    await writeFixtureFile(
      source,
      'beta-skill/SKILL.md',
      '---\nname: beta-skill\ndescription: beta desc\n---\n# Beta\n',
    );
    await writeFixtureFile(source, 'beta-skill/.DS_Store', 'ignored');
    await writeFixtureFile(source, 'beta-skill/__pycache__/cache.pyc', new Uint8Array([0, 1, 2]));
    await writeFixtureFile(
      source,
      'beta-skill/scripts/_vendor/python/pydantic_core/core.py',
      'print("ok")\n',
    );
    await writeFixtureFile(
      source,
      'beta-skill/scripts/_vendor/python/pydantic_core/binary.so',
      new Uint8Array([127, 69, 76, 70, 0, 1]),
    );

    const result = await importLocalSkills({
      sourceRoot: pathToFileURL(`${source}/`),
      destinationRoot: pathToFileURL(`${dest}/`),
      log: () => {},
    });

    expect(result.imported).toBe(1);
    expect(result.skippedFiles).toBeGreaterThanOrEqual(2);
    expect(
      await readFile(
        join(dest, 'beta-skill', 'scripts/_vendor/python/pydantic_core/core.py'),
        'utf8',
      ),
    ).toContain('print');
    await expect(access(join(dest, 'beta-skill', '.DS_Store'))).rejects.toThrow();
    await expect(access(join(dest, 'beta-skill', '__pycache__/cache.pyc'))).rejects.toThrow();
    await expect(
      access(join(dest, 'beta-skill', 'scripts/_vendor/python/pydantic_core/binary.so')),
    ).rejects.toThrow();
  });

  it('skips conflicting destination skills when overwrite is false', async () => {
    const source = await createTempDir();
    const dest = await createTempDir();

    await writeFixtureFile(
      source,
      'gamma-skill/SKILL.md',
      '---\nname: gamma-skill\ndescription: gamma desc\n---\n# Gamma\n',
    );
    await writeFixtureFile(
      dest,
      'gamma-skill/SKILL.md',
      '---\nname: gamma-skill\ndescription: existing\n---\n# Existing\n',
    );
    await writeFixtureFile(
      dest,
      'gamma-skill/skill.json',
      JSON.stringify({ visibility: 'public', tags: ['existing'] }, null, 2),
    );

    const result = await importLocalSkills({
      sourceRoot: pathToFileURL(`${source}/`),
      destinationRoot: pathToFileURL(`${dest}/`),
      log: () => {},
    });

    expect(result.imported).toBe(0);
    expect(result.skippedSkills).toBe(1);
    expect(await readFile(join(dest, 'gamma-skill', 'SKILL.md'), 'utf8')).toContain('Existing');
  });
});
