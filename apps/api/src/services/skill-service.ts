import { and, arrayOverlaps, eq, ilike, or, sql } from 'drizzle-orm';
import { db, skillFiles, skills } from '../db';

// ─── Well-known ───────────────────────────────────────────────────────

/** List all owned + public skills — fuels the well-known index. */
export async function listPublicOwnedSkills() {
  return db
    .select({
      id: skills.id,
      slug: skills.slug,
      name: skills.name,
      description: skills.description,
    })
    .from(skills)
    .where(and(eq(skills.type, 'owned'), eq(skills.visibility, 'public')));
}

export async function listSkillFilePaths(skillId: string): Promise<string[]> {
  const rows = await db
    .select({ path: skillFiles.path })
    .from(skillFiles)
    .where(eq(skillFiles.skillId, skillId));
  return rows.map((r) => r.path);
}

export async function findPublicOwnedSkillBySlug(slug: string) {
  const rows = await db
    .select()
    .from(skills)
    .where(and(eq(skills.slug, slug), eq(skills.type, 'owned'), eq(skills.visibility, 'public')))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSkillFileContent(skillId: string, path: string): Promise<string | null> {
  const rows = await db
    .select({ content: skillFiles.content })
    .from(skillFiles)
    .where(and(eq(skillFiles.skillId, skillId), eq(skillFiles.path, path)))
    .limit(1);
  return rows[0]?.content ?? null;
}

// ─── Business API ─────────────────────────────────────────────────────

export interface ListSkillsOptions {
  type: 'owned' | 'referenced' | 'all';
  q?: string;
  tags: string[];
  includeInternal: boolean;
}

export async function listSkillsForApi(opts: ListSkillsOptions) {
  const conditions = [];

  if (opts.type !== 'all') {
    conditions.push(eq(skills.type, opts.type));
  }

  if (!opts.includeInternal) {
    // Public visibility, OR referenced (referenced is always visible).
    const cond = or(eq(skills.visibility, 'public'), eq(skills.type, 'referenced'));
    if (cond) conditions.push(cond);
  }

  if (opts.q) {
    const pattern = `%${opts.q}%`;
    const cond = or(ilike(skills.name, pattern), ilike(skills.description, pattern));
    if (cond) conditions.push(cond);
  }

  if (opts.tags.length > 0) {
    // text[] overlap: matches if any tag intersects.
    conditions.push(arrayOverlaps(skills.tags, opts.tags));
  }

  return db
    .select()
    .from(skills)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${skills.updatedAt} DESC`);
}

export async function findSkillBySlug(slug: string) {
  const rows = await db.select().from(skills).where(eq(skills.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function listSkillFilesWithContent(skillId: string) {
  return db
    .select({ path: skillFiles.path, content: skillFiles.content })
    .from(skillFiles)
    .where(eq(skillFiles.skillId, skillId));
}

export async function listAllTags(): Promise<string[]> {
  const rows = await db.execute<{ tag: string }>(
    sql`SELECT DISTINCT unnest(tags) AS tag FROM skillhub.skills WHERE cardinality(tags) > 0 ORDER BY tag`,
  );
  // postgres-js driver returns an array-like result of rows.
  return Array.from(rows, (r: { tag: string }) => r.tag);
}
