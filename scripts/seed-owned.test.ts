import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import { db, skillFiles, skills } from '../apps/api/src/db';
import { loadBuiltinOwnedEntries, seedOwned } from './seed-owned';

async function truncate() {
  await db.delete(skills);
}

const silent = (_: string) => {};

async function createBuiltinFixture(
  dirs: Array<{
    slug: string;
    meta: { visibility: 'public' | 'private'; tags: string[] };
    files: Record<string, string>;
  }>,
) {
  const root = await mkdtemp(join(tmpdir(), 'skillhub-builtin-'));
  for (const dir of dirs) {
    const skillDir = join(root, dir.slug);
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'skill.json'), JSON.stringify(dir.meta, null, 2), 'utf8');
    for (const [path, content] of Object.entries(dir.files)) {
      const fullPath = join(skillDir, path);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, 'utf8');
    }
  }
  return root;
}

describe('seed-owned', () => {
  beforeEach(truncate);
  afterAll(truncate);

  it('batch inserts builtin owned skills from the builtin-skills directory', async () => {
    const entries = await loadBuiltinOwnedEntries();
    expect(entries.length).toBeGreaterThanOrEqual(5);
    expect(entries.map((entry) => entry.slug)).toEqual(
      expect.arrayContaining(['project-mental-map', 'commit-message-cn']),
    );
    const result = await seedOwned(entries, silent);
    expect(result.upserted).toBe(entries.length);
    expect(result.fileCount).toBeGreaterThanOrEqual(entries.length); // at least one SKILL.md each

    const rows = await db.select().from(skills);
    expect(rows).toHaveLength(entries.length);
    for (const r of rows) {
      expect(r.type).toBe('owned');
      expect(r.frontmatter).toBeTruthy();
    }

    // Every owned skill has at least one 'SKILL.md' file
    for (const r of rows) {
      const files = await db.select().from(skillFiles).where(eq(skillFiles.skillId, r.id));
      expect(files.some((f) => f.path === 'SKILL.md')).toBe(true);
    }
  });

  it('idempotent: second run keeps row count stable, bumps updatedAt', async () => {
    const entries = await loadBuiltinOwnedEntries();
    await seedOwned(entries, silent);
    const first = await db.select({ slug: skills.slug, updatedAt: skills.updatedAt }).from(skills);

    await new Promise((r) => setTimeout(r, 30)); // let clock advance
    await seedOwned(entries, silent);

    const second = await db.select({ slug: skills.slug, updatedAt: skills.updatedAt }).from(skills);
    expect(second).toHaveLength(first.length);
    for (const row of second) {
      const prev = first.find((f) => f.slug === row.slug);
      expect(prev).toBeDefined();
      if (prev) expect(row.updatedAt.getTime()).toBeGreaterThanOrEqual(prev.updatedAt.getTime());
    }
  });

  it('rejects overwriting a referenced slug', async () => {
    // Pre-seed 'commit-message-cn' as referenced to collide with the builtin preset.
    await db.insert(skills).values({
      slug: 'commit-message-cn',
      name: 'commit-message-cn',
      description: 'squatted by referenced',
      type: 'referenced',
      visibility: 'public',
      tags: [],
      sourceRepo: 'a/b',
      sourceSkillName: 'x',
      sourceInstallCommand: 'npx skills add a/b --skill x',
      sourceUrl: null,
      ownerUserId: 'mozia-virtual',
    });

    const entries = await loadBuiltinOwnedEntries();
    await expect(seedOwned(entries, silent)).rejects.toThrow(/already exists as referenced/);
  });

  it('rejects invalid slug', async () => {
    await expect(
      seedOwned(
        [
          {
            slug: 'Invalid Slug',
            name: 'x',
            description: 'x',
            visibility: 'public',
            tags: [],
            files: [{ path: 'SKILL.md', content: '---\nname: x\n---\n# x\n' }],
          },
        ],
        silent,
      ),
    ).rejects.toThrow(/invalid slug/);
  });

  it('rejects unsafe path in files', async () => {
    await expect(
      seedOwned(
        [
          {
            slug: 'evil-path',
            name: 'evil-path',
            description: 'x',
            visibility: 'public',
            tags: [],
            files: [
              { path: 'SKILL.md', content: '---\nname: evil-path\n---\n# x\n' },
              { path: '../etc/passwd', content: 'pwn' },
            ],
          },
        ],
        silent,
      ),
    ).rejects.toThrow(/unsafe path/);
  });

  it('loads nested files from builtin-skills and excludes skill.json', async () => {
    const root = await createBuiltinFixture([
      {
        slug: 'nested-skill',
        meta: { visibility: 'public', tags: ['nested'] },
        files: {
          'SKILL.md': '---\nname: nested-skill\ndescription: nested desc\n---\n# Body\n',
          'references/checklist.md': '# Checklist\n',
          '.DS_Store': 'ignored',
        },
      },
    ]);

    try {
      const entries = await loadBuiltinOwnedEntries(pathToFileURL(`${root}/`));
      expect(entries).toHaveLength(1);
      expect(entries[0]?.files.map((file) => file.path).sort()).toEqual([
        'SKILL.md',
        'references/checklist.md',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects builtin skill directory without SKILL.md', async () => {
    const root = await createBuiltinFixture([
      {
        slug: 'broken-skill',
        meta: { visibility: 'public', tags: [] },
        files: {
          'README.md': '# nope\n',
        },
      },
    ]);

    try {
      await expect(loadBuiltinOwnedEntries(pathToFileURL(`${root}/`))).rejects.toThrow(
        /missing SKILL\.md/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects builtin skill directory without metadata file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skillhub-builtin-'));
    const skillDir = join(root, 'broken-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      '---\nname: broken-skill\ndescription: broken\n---\n# Broken\n',
      'utf8',
    );

    try {
      await expect(loadBuiltinOwnedEntries(pathToFileURL(`${root}/`))).rejects.toThrow(
        /missing skill\.json/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
