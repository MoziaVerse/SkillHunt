// Seed the 4 referenced skills from scripts/referenced-skills.json.
// Idempotent: upserts by slug. Refuses to overwrite owned slugs.

import { readFile } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import { db, publishables, skills, user } from '../apps/api/src/db';

const SEED_OWNER_ID = 'mozia-virtual';
const SEED_OWNER_HANDLE = 'mozia';

async function ensureSeedOwner() {
  await db
    .insert(user)
    .values({
      id: SEED_OWNER_ID,
      name: 'mozia',
      handle: SEED_OWNER_HANDLE,
      email: 'mozia-virtual@skillhub.local',
      emailVerified: true,
      isVirtual: true,
    })
    .onConflictDoUpdate({
      target: user.id,
      set: {
        name: 'mozia',
        handle: SEED_OWNER_HANDLE,
        isVirtual: true,
        updatedAt: new Date(),
      },
    });
}

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
  await ensureSeedOwner();

  for (const entry of entries) {
    const existing = await db
      .select({ skill: skills })
      .from(publishables)
      .innerJoin(skills, eq(publishables.id, skills.id))
      .where(
        and(
          eq(publishables.kind, 'skill'),
          eq(publishables.slug, entry.slug),
          eq(publishables.ownerUserId, SEED_OWNER_ID),
        ),
      )
      .limit(1);

    if (existing[0] && existing[0].skill.type !== 'referenced') {
      log(`[seed-referenced] skip '${entry.slug}': already exists as ${existing[0].skill.type}`);
      skipped++;
      continue;
    }

    const [publishable] = await db
      .insert(publishables)
      .values({
        kind: 'skill',
        ownerUserId: SEED_OWNER_ID,
        slug: entry.slug,
        name: entry.name,
        description: entry.description,
        visibility: 'public',
        tags: entry.tags,
      })
      .onConflictDoUpdate({
        target: [publishables.ownerUserId, publishables.kind, publishables.slug],
        set: {
          name: entry.name,
          description: entry.description,
          visibility: 'public',
          tags: entry.tags,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!publishable) throw new Error(`[seed-referenced] upsert failed for '${entry.slug}'`);

    await db
      .insert(skills)
      .values({
        id: publishable.id,
        type: 'referenced',
        sourceRepo: entry.sourceRepo,
        sourceSkillName: entry.sourceSkillName,
        sourceInstallCommand: entry.sourceInstallCommand,
        sourceUrl: entry.sourceUrl,
      })
      .onConflictDoUpdate({
        target: skills.id,
        set: {
          type: 'referenced',
          sourceRepo: entry.sourceRepo,
          sourceSkillName: entry.sourceSkillName,
          sourceInstallCommand: entry.sourceInstallCommand,
          sourceUrl: entry.sourceUrl,
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
