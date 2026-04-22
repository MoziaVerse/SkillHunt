// Seed the 5 owned skills from scripts/owned-skills.json.
// Reads JSON (not the filesystem) — "simulated preset" per Phase 0 decision.
// Idempotent: upserts by slug, fully replaces skill_files rows.

import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { db, skillFiles, skills } from '../apps/api/src/db';

export interface OwnedEntry {
  slug: string;
  name: string;
  description: string;
  visibility: 'public' | 'internal';
  tags: string[];
  skillMd: string;
  extraFiles?: Array<{ path: string; content: string }>;
}

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;

export async function loadOwnedEntries(
  path = new URL('./owned-skills.json', import.meta.url),
): Promise<OwnedEntry[]> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as OwnedEntry[];
}

function parseFrontmatter(md: string): Record<string, unknown> {
  // Minimal YAML frontmatter parse: `key: value` lines only.
  // Good enough for our SKILL.md files; not a general YAML parser.
  const lines = md.split('\n');
  if (lines[0] !== '---') return {};
  const out: Record<string, unknown> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '---') break;
    if (!line || !line.includes(':')) continue;
    const idx = line.indexOf(':');
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

export async function seedOwned(
  entries: OwnedEntry[],
  log: (msg: string) => void = console.log,
): Promise<{ upserted: number; fileCount: number }> {
  let upserted = 0;
  let fileCount = 0;

  for (const entry of entries) {
    if (!SLUG_RE.test(entry.slug) && entry.slug.length !== 1) {
      throw new Error(`[seed-owned] invalid slug: '${entry.slug}'`);
    }
    if (!entry.skillMd) {
      throw new Error(`[seed-owned] missing skillMd for slug '${entry.slug}'`);
    }

    const existing = await db.select().from(skills).where(eq(skills.slug, entry.slug)).limit(1);

    if (existing[0] && existing[0].type !== 'owned') {
      throw new Error(
        `[seed-owned] slug '${entry.slug}' already exists as ${existing[0].type}. Refusing to overwrite.`,
      );
    }

    const frontmatter = parseFrontmatter(entry.skillMd);

    const [row] = await db
      .insert(skills)
      .values({
        slug: entry.slug,
        name: entry.name,
        description: entry.description,
        type: 'owned',
        visibility: entry.visibility,
        tags: entry.tags,
        frontmatter,
      })
      .onConflictDoUpdate({
        target: skills.slug,
        set: {
          name: entry.name,
          description: entry.description,
          visibility: entry.visibility,
          tags: entry.tags,
          frontmatter,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error(`[seed-owned] upsert did not return row for '${entry.slug}'`);

    // Full replace of files: simpler than diffing.
    await db.delete(skillFiles).where(eq(skillFiles.skillId, row.id));

    const files: Array<{ path: string; content: string }> = [
      { path: 'SKILL.md', content: entry.skillMd },
      ...(entry.extraFiles ?? []),
    ];

    for (const f of files) {
      if (f.path.includes('..') || f.path.startsWith('/')) {
        throw new Error(`[seed-owned] unsafe path '${f.path}' for slug '${entry.slug}'`);
      }
      await db.insert(skillFiles).values({
        skillId: row.id,
        path: f.path,
        content: f.content,
      });
      fileCount++;
    }

    log(
      `[seed-owned] ✓ ${entry.slug} (${files.length} file${files.length === 1 ? '' : 's'}, ${entry.visibility})`,
    );
    upserted++;
  }

  return { upserted, fileCount };
}

if (import.meta.main) {
  const entries = await loadOwnedEntries();
  const result = await seedOwned(entries);
  console.log(`[seed-owned] done (${result.upserted} skills, ${result.fileCount} files)`);
  process.exit(0);
}
