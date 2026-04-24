import { and, arrayOverlaps, eq, ilike, or, sql } from 'drizzle-orm';
import { db, skillFiles, skills, user } from '../db';

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

export interface OwnerInfo {
  id: string;
  name: string;
  image: string | null;
}

export interface SkillWithOwner {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: 'owned' | 'referenced';
  visibility: 'public' | 'private';
  tags: string[];
  sourceRepo: string | null;
  sourceSkillName: string | null;
  sourceInstallCommand: string | null;
  sourceUrl: string | null;
  frontmatter: Record<string, unknown> | null;
  ownerUserId: string;
  createdAt: Date;
  updatedAt: Date;
  owner: OwnerInfo;
}

export interface ListSkillsOptions {
  type: 'owned' | 'referenced' | 'all';
  q?: string;
  tags: string[];
  /**
   * Currently logged-in user's id, or null for anonymous.
   * Used so that the viewer can see their own private skills in the list.
   */
  viewerUserId: string | null;
}

export async function listSkillsForApi(opts: ListSkillsOptions): Promise<SkillWithOwner[]> {
  const conditions = [];

  if (opts.type !== 'all') {
    conditions.push(eq(skills.type, opts.type));
  }

  // Visibility: public + referenced are visible to everyone. A logged-in
  // viewer additionally sees their own private skills.
  const ownPrivate = opts.viewerUserId
    ? and(eq(skills.visibility, 'private'), eq(skills.ownerUserId, opts.viewerUserId))
    : undefined;
  const visibilityCond = or(
    eq(skills.visibility, 'public'),
    eq(skills.type, 'referenced'),
    ...(ownPrivate ? [ownPrivate] : []),
  );
  if (visibilityCond) conditions.push(visibilityCond);

  if (opts.q) {
    const pattern = `%${opts.q}%`;
    const cond = or(ilike(skills.name, pattern), ilike(skills.description, pattern));
    if (cond) conditions.push(cond);
  }

  if (opts.tags.length > 0) {
    conditions.push(arrayOverlaps(skills.tags, opts.tags));
  }

  const rows = await db
    .select({ skill: skills, owner: { id: user.id, name: user.name, image: user.image } })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${skills.updatedAt} DESC`);

  return rows.map((r) => ({ ...r.skill, owner: r.owner }));
}

export async function findSkillBySlug(slug: string): Promise<SkillWithOwner | null> {
  const rows = await db
    .select({ skill: skills, owner: { id: user.id, name: user.name, image: user.image } })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(eq(skills.slug, slug))
    .limit(1);
  const r = rows[0];
  return r ? { ...r.skill, owner: r.owner } : null;
}

export async function findSkillByOwnerAndSlug(
  ownerName: string,
  slug: string,
): Promise<SkillWithOwner | null> {
  const rows = await db
    .select({ skill: skills, owner: { id: user.id, name: user.name, image: user.image } })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(and(eq(user.name, ownerName), eq(skills.slug, slug)))
    .limit(1);
  const r = rows[0];
  return r ? { ...r.skill, owner: r.owner } : null;
}

export async function listSkillFilesWithContent(skillId: string) {
  return db
    .select({ path: skillFiles.path, content: skillFiles.content })
    .from(skillFiles)
    .where(eq(skillFiles.skillId, skillId));
}

export async function listAllTags(): Promise<string[]> {
  // Public + referenced rows only — private rows' tags are owner-private
  // and shouldn't leak through the global tag cloud.
  const rows = await db.execute<{ tag: string }>(
    sql`SELECT DISTINCT unnest(tags) AS tag
        FROM skillhub.skills
        WHERE cardinality(tags) > 0
          AND (type = 'referenced' OR visibility = 'public')
        ORDER BY tag`,
  );
  return Array.from(rows, (r: { tag: string }) => r.tag);
}
