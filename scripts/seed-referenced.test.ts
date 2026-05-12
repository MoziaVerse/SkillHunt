import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db, skills } from '../apps/api/src/db';
import { loadReferencedEntries, seedReferenced } from './seed-referenced';

async function truncate() {
  await db.delete(skills);
}

const silent = (_: string) => {};

describe('seed-referenced', () => {
  beforeEach(truncate);
  afterAll(truncate);

  it('batch inserts 4 referenced skills from the preset JSON', async () => {
    const entries = await loadReferencedEntries();
    expect(entries).toHaveLength(4);
    const result = await seedReferenced(entries, silent);
    expect(result.inserted).toBe(4);
    expect(result.skipped).toBe(0);

    const rows = await db.select().from(skills);
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.type).toBe('referenced');
      expect(r.sourceRepo).toBeTruthy();
      expect(r.sourceInstallCommand).toBeTruthy();
    }
  });

  it('idempotent: running twice yields same row count', async () => {
    const entries = await loadReferencedEntries();
    await seedReferenced(entries, silent);
    await seedReferenced(entries, silent);
    const rows = await db.select().from(skills);
    expect(rows).toHaveLength(4);
  });

  it('refuses to overwrite an owned slug', async () => {
    // Pre-seed 'frontend-design' as owned — it collides with the JSON preset.
    await db.insert(skills).values({
      slug: 'frontend-design',
      name: 'frontend-design',
      description: 'squatted by owned',
      type: 'owned',
      visibility: 'public',
      tags: [],
      frontmatter: { n: 'x' },
      ownerUserId: 'mozia-virtual',
    });

    const entries = await loadReferencedEntries();
    const result = await seedReferenced(entries, silent);
    expect(result.skipped).toBe(1);

    const row = await db.select().from(skills).where(eq(skills.slug, 'frontend-design')).limit(1);
    expect(row[0]?.type).toBe('owned');
  });
});
