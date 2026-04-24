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
      ownerHandle: user.handle,
    })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
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

export async function findPublicOwnedSkillByOwnerAndSlug(ownerHandle: string, slug: string) {
  const rows = await db
    .select({ skill: skills })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(
      and(
        eq(user.handle, ownerHandle),
        eq(skills.slug, slug),
        eq(skills.type, 'owned'),
        eq(skills.visibility, 'public'),
      ),
    )
    .limit(1);
  return rows[0]?.skill ?? null;
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
  /** Display name (anything goes — Chinese, mixed case, etc.) */
  name: string;
  /** URL handle (lowercase + dashes) */
  handle: string;
  image: string | null;
}

const ownerSelect = {
  id: user.id,
  name: user.name,
  handle: user.handle,
  image: user.image,
};

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
    .select({ skill: skills, owner: ownerSelect })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${skills.updatedAt} DESC`);

  return rows.map((r) => ({ ...r.skill, owner: r.owner }));
}

export async function findSkillBySlug(slug: string): Promise<SkillWithOwner | null> {
  const rows = await db
    .select({ skill: skills, owner: ownerSelect })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(eq(skills.slug, slug))
    .limit(1);
  const r = rows[0];
  return r ? { ...r.skill, owner: r.owner } : null;
}

export async function findSkillByOwnerAndSlug(
  ownerHandle: string,
  slug: string,
): Promise<SkillWithOwner | null> {
  const rows = await db
    .select({ skill: skills, owner: ownerSelect })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(and(eq(user.handle, ownerHandle), eq(skills.slug, slug)))
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

// ─── User lookup ──────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  handle: string;
  email: string;
  image: string | null;
  isVirtual: boolean;
  canPublishAs: string[];
}

const userRowSelect = {
  id: user.id,
  name: user.name,
  handle: user.handle,
  email: user.email,
  image: user.image,
  isVirtual: user.isVirtual,
  canPublishAs: user.canPublishAs,
};

export async function findUserById(id: string): Promise<UserRow | null> {
  const rows = await db.select(userRowSelect).from(user).where(eq(user.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findUserByHandle(handle: string): Promise<UserRow | null> {
  const rows = await db.select(userRowSelect).from(user).where(eq(user.handle, handle)).limit(1);
  return rows[0] ?? null;
}

export async function updateUserProfile(
  userId: string,
  patch: { name?: string; handle?: string },
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.handle !== undefined) set.handle = patch.handle;
  await db.update(user).set(set).where(eq(user.id, userId));
}

// ─── User-scoped skill listing ────────────────────────────────────────

/** All skills owned by this user (by handle), including private. */
export async function listSkillsByOwner(ownerHandle: string): Promise<SkillWithOwner[]> {
  const rows = await db
    .select({ skill: skills, owner: ownerSelect })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(eq(user.handle, ownerHandle))
    .orderBy(sql`${skills.updatedAt} DESC`);
  return rows.map((r) => ({ ...r.skill, owner: r.owner }));
}

/** Public-only skills owned by this user (by handle). */
export async function listPublicSkillsByOwner(ownerHandle: string): Promise<SkillWithOwner[]> {
  const rows = await db
    .select({ skill: skills, owner: ownerSelect })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(
      and(
        eq(user.handle, ownerHandle),
        or(eq(skills.visibility, 'public'), eq(skills.type, 'referenced')),
      ),
    )
    .orderBy(sql`${skills.updatedAt} DESC`);
  return rows.map((r) => ({ ...r.skill, owner: r.owner }));
}

// ─── Create / update / delete owned skill ─────────────────────────────

function parseFrontmatter(md: string): Record<string, unknown> {
  // Minimal `key: value` YAML — same approach as seed-owned. Good enough for
  // SKILL.md headers; not a general parser.
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

export interface CreateSkillData {
  ownerUserId: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  visibility: 'public' | 'private';
  skillMdContent: string;
  frontmatter?: Record<string, unknown>;
}

export async function createOwnedSkill(input: CreateSkillData): Promise<SkillWithOwner> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(skills)
      .values({
        slug: input.slug,
        name: input.name,
        description: input.description,
        type: 'owned',
        visibility: input.visibility,
        tags: input.tags,
        frontmatter: input.frontmatter ?? parseFrontmatter(input.skillMdContent),
        ownerUserId: input.ownerUserId,
      })
      .returning();
    if (!row) throw new Error('createOwnedSkill: insert returned no row');

    await tx
      .insert(skillFiles)
      .values({ skillId: row.id, path: 'SKILL.md', content: input.skillMdContent });

    const [ownerRow] = await tx
      .select(ownerSelect)
      .from(user)
      .where(eq(user.id, input.ownerUserId))
      .limit(1);
    if (!ownerRow) throw new Error('createOwnedSkill: owner user disappeared mid-tx');

    return { ...row, owner: ownerRow };
  });
}

export interface UpdateSkillData {
  name?: string;
  description?: string;
  tags?: string[];
  visibility?: 'public' | 'private';
  skillMdContent?: string;
  frontmatter?: Record<string, unknown>;
}

export async function updateOwnedSkill(
  skillId: string,
  input: UpdateSkillData,
): Promise<SkillWithOwner | null> {
  return db.transaction(async (tx) => {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.tags !== undefined) patch.tags = input.tags;
    if (input.visibility !== undefined) patch.visibility = input.visibility;
    if (input.frontmatter !== undefined) {
      patch.frontmatter = input.frontmatter;
    } else if (input.skillMdContent !== undefined) {
      patch.frontmatter = parseFrontmatter(input.skillMdContent);
    }

    const [row] = await tx.update(skills).set(patch).where(eq(skills.id, skillId)).returning();
    if (!row) return null;

    if (input.skillMdContent !== undefined) {
      // Upsert SKILL.md content
      await tx
        .insert(skillFiles)
        .values({ skillId, path: 'SKILL.md', content: input.skillMdContent })
        .onConflictDoUpdate({
          target: [skillFiles.skillId, skillFiles.path],
          set: { content: input.skillMdContent },
        });
    }

    const [ownerRow] = await tx
      .select(ownerSelect)
      .from(user)
      .where(eq(user.id, row.ownerUserId))
      .limit(1);
    if (!ownerRow) throw new Error('updateOwnedSkill: owner user disappeared mid-tx');

    return { ...row, owner: ownerRow };
  });
}

export async function deleteSkill(skillId: string): Promise<boolean> {
  const result = await db.delete(skills).where(eq(skills.id, skillId)).returning({ id: skills.id });
  return result.length > 0;
}

// ─── File CRUD on owned skills ────────────────────────────────────────

export async function upsertSkillFile(
  skillId: string,
  path: string,
  content: string,
): Promise<void> {
  await db
    .insert(skillFiles)
    .values({ skillId, path, content })
    .onConflictDoUpdate({
      target: [skillFiles.skillId, skillFiles.path],
      set: { content },
    });
}

export async function deleteSkillFile(skillId: string, path: string): Promise<boolean> {
  const result = await db
    .delete(skillFiles)
    .where(and(eq(skillFiles.skillId, skillId), eq(skillFiles.path, path)))
    .returning({ id: skillFiles.id });
  return result.length > 0;
}
