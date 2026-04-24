// Seed the 4 referenced skills from scripts/referenced-skills.json.
// Idempotent: upserts by slug. Refuses to overwrite owned slugs.

import { readFile } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import { db, skills } from '../apps/api/src/db';

const SEED_OWNER_ID = 'mozia-virtual';

export interface ReferencedEntry {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  sourceRepo: string;
  sourceSkillName: string;
  sourceInstallCommand: string;
  sourceUrl: string | null;
}

export async function loadReferencedEntries(
  path = new URL('./referenced-skills.json', import.meta.url),
): Promise<ReferencedEntry[]> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as ReferencedEntry[];
}

export async function seedReferenced(
  entries: ReferencedEntry[],
  log: (msg: string) => void = console.log,
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const entry of entries) {
    const existing = await db
      .select()
      .from(skills)
      .where(and(eq(skills.slug, entry.slug), eq(skills.ownerUserId, SEED_OWNER_ID)))
      .limit(1);

    if (existing[0] && existing[0].type !== 'referenced') {
      log(`[seed-referenced] skip '${entry.slug}': already exists as ${existing[0].type}`);
      skipped++;
      continue;
    }

    await db
      .insert(skills)
      .values({
        slug: entry.slug,
        name: entry.name,
        description: entry.description,
        type: 'referenced',
        visibility: 'public',
        tags: entry.tags,
        sourceRepo: entry.sourceRepo,
        sourceSkillName: entry.sourceSkillName,
        sourceInstallCommand: entry.sourceInstallCommand,
        sourceUrl: entry.sourceUrl,
        ownerUserId: SEED_OWNER_ID,
      })
      .onConflictDoUpdate({
        target: [skills.ownerUserId, skills.slug],
        set: {
          name: entry.name,
          description: entry.description,
          tags: entry.tags,
          sourceRepo: entry.sourceRepo,
          sourceSkillName: entry.sourceSkillName,
          sourceInstallCommand: entry.sourceInstallCommand,
          sourceUrl: entry.sourceUrl,
          updatedAt: new Date(),
        },
      });

    log(`[seed-referenced] ✓ ${entry.slug}`);
    inserted++;
  }

  return { inserted, skipped };
}

// Entrypoint when run directly
if (import.meta.main) {
  const entries = await loadReferencedEntries();
  const result = await seedReferenced(entries);
  console.log(`[seed-referenced] done (${result.inserted} upserted, ${result.skipped} skipped)`);
  process.exit(0);
}
