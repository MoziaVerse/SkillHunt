import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { db, skillFiles, skills } from '../apps/api/src/db';
import { loadOwnedEntries, seedOwned } from './seed-owned';

async function truncate() {
  await db.execute(sql`TRUNCATE TABLE skillhub.skills RESTART IDENTITY CASCADE`);
}

const silent = (_: string) => {};

describe('seed-owned', () => {
  beforeEach(truncate);
  afterAll(truncate);

  it('batch inserts 5 owned skills from the preset JSON', async () => {
    const entries = await loadOwnedEntries();
    expect(entries).toHaveLength(5);
    const result = await seedOwned(entries, silent);
    expect(result.upserted).toBe(5);
    expect(result.fileCount).toBeGreaterThanOrEqual(5); // at least one SKILL.md each

    const rows = await db.select().from(skills);
    expect(rows).toHaveLength(5);
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
    const entries = await loadOwnedEntries();
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
    // Pre-seed 'commit-message-cn' as referenced to collide with owned JSON preset.
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
    });

    const entries = await loadOwnedEntries();
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
            skillMd: '---\nname: x\n---\n# x\n',
          },
        ],
        silent,
      ),
    ).rejects.toThrow(/invalid slug/);
  });

  it('rejects unsafe path in extraFiles', async () => {
    await expect(
      seedOwned(
        [
          {
            slug: 'evil-path',
            name: 'evil-path',
            description: 'x',
            visibility: 'public',
            tags: [],
            skillMd: '---\nname: evil-path\n---\n# x\n',
            extraFiles: [{ path: '../etc/passwd', content: 'pwn' }],
          },
        ],
        silent,
      ),
    ).rejects.toThrow(/unsafe path/);
  });
});
