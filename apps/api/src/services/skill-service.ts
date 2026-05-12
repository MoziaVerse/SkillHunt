import { and, desc, eq, max, or, sql } from 'drizzle-orm';
import {
  db,
  notifications,
  skillComments,
  skillFiles,
  skillReleases,
  skillSubscriptions,
  skillSyncEvents,
  skillUpvotes,
  skills,
  user,
  userBookmarks,
} from '../db';
import { skillProtocolName } from '../lib/protocol-name';

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

export async function findPublicOwnedSkillByProtocolName(protocolName: string) {
  const rows = await db
    .select({ skill: skills, ownerHandle: user.handle })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(and(eq(skills.type, 'owned'), eq(skills.visibility, 'public')));

  return (
    rows.find((r) => skillProtocolName(r.ownerHandle, r.skill.slug) === protocolName)?.skill ?? null
  );
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
  icon: string | null;
  coverImage: string | null;
  demoVideoUrl: string | null;
  parentSkillId: string | null;
  rootSkillId: string | null;
  forkSourceReleaseId: string | null;
  latestSyncedReleaseId: string | null;
  forkMode: 'linked' | 'detached';
  allowUpstreamSync: number;
  forkNote: string | null;
  ownerUserId: string;
  createdAt: Date;
  updatedAt: Date;
  owner: OwnerInfo;
  upvoteCount: number;
  commentCount: number;
  bookmarkCount: number;
  viewerHasUpvoted: boolean;
  viewerHasBookmarked: boolean;
}

export type SkillAccessScope =
  | 'skills:read'
  | 'skills:read_private'
  | 'skills:files:read'
  | 'skills:install';

export interface SkillAccessActor {
  userId: string | null;
  scopes: readonly string[];
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
  includePrivate?: boolean;
  sort?: 'recent' | 'hottest' | 'az';
  limit?: number;
  offset?: number;
}

export interface SkillCommentWithAuthor {
  id: string;
  skillId: string;
  userId: string;
  parentId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: OwnerInfo;
}

const skillSelectExtras = (viewerUserId: string | null) => ({
  upvoteCount: sql<number>`(
    select count(*) from ${skillUpvotes}
    where ${skillUpvotes.skillId} = ${skills.id}
  )`,
  commentCount: sql<number>`(
    select count(*) from ${skillComments}
    where ${skillComments.skillId} = ${skills.id}
  )`,
  bookmarkCount: sql<number>`(
    select count(*) from ${userBookmarks}
    where ${userBookmarks.skillId} = ${skills.id}
  )`,
  viewerHasUpvoted: viewerUserId
    ? sql<number>`exists(
        select 1 from ${skillUpvotes}
        where ${skillUpvotes.skillId} = ${skills.id}
          and ${skillUpvotes.userId} = ${viewerUserId}
      )`
    : sql<number>`0`,
  viewerHasBookmarked: viewerUserId
    ? sql<number>`exists(
        select 1 from ${userBookmarks}
        where ${userBookmarks.skillId} = ${skills.id}
          and ${userBookmarks.userId} = ${viewerUserId}
      )`
    : sql<number>`0`,
});

function mapSkillRow<
  T extends {
    skill: typeof skills.$inferSelect;
    owner: OwnerInfo;
    upvoteCount: number;
    commentCount: number;
    bookmarkCount: number;
    viewerHasUpvoted: number | boolean;
    viewerHasBookmarked: number | boolean;
  },
>(row: T): SkillWithOwner {
  return {
    ...row.skill,
    owner: row.owner,
    upvoteCount: Number(row.upvoteCount ?? 0),
    commentCount: Number(row.commentCount ?? 0),
    bookmarkCount: Number(row.bookmarkCount ?? 0),
    viewerHasUpvoted: Boolean(row.viewerHasUpvoted),
    viewerHasBookmarked: Boolean(row.viewerHasBookmarked),
  };
}

function actorHasScope(actor: SkillAccessActor, scope: SkillAccessScope): boolean {
  return actor.scopes.includes(scope);
}

export function canReadSkill(skill: SkillWithOwner, actor: SkillAccessActor): boolean {
  if (!actorHasScope(actor, 'skills:read')) return false;
  if (skill.type !== 'owned') return true;
  if (skill.visibility === 'public') return true;
  return (
    Boolean(actor.userId) &&
    skill.ownerUserId === actor.userId &&
    actorHasScope(actor, 'skills:read_private')
  );
}

export function canReadSkillFiles(skill: SkillWithOwner, actor: SkillAccessActor): boolean {
  if (!canReadSkill(skill, actor)) return false;
  if (skill.type !== 'owned') return false;
  if (skill.visibility === 'public') return true;
  return actorHasScope(actor, 'skills:files:read');
}

export function canMintSkillInstallGrant(skill: SkillWithOwner, actor: SkillAccessActor): boolean {
  if (!actor.userId) return false;
  if (!actorHasScope(actor, 'skills:install')) return false;
  return canReadSkill(skill, actor);
}

export async function listSkillsForApi(
  opts: ListSkillsOptions,
): Promise<{ items: SkillWithOwner[]; total: number }> {
  const conditions = [];

  if (opts.type !== 'all') {
    conditions.push(eq(skills.type, opts.type));
  }

  // Visibility: public + referenced are visible to everyone. A logged-in
  // viewer additionally sees their own private skills.
  const ownPrivate =
    opts.viewerUserId && opts.includePrivate
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
    const cond = or(
      sql`lower(${skills.name}) like lower(${pattern})`,
      sql`lower(${skills.description}) like lower(${pattern})`,
      sql`lower(${user.name}) like lower(${pattern})`,
      sql`lower(${user.handle}) like lower(${pattern})`,
    );
    if (cond) conditions.push(cond);
  }

  // Tag filtering in SQL (instead of post-filtering in JS)
  if (opts.tags.length > 0) {
    conditions.push(
      sql`exists (select 1 from json_each(${skills.tags}) where json_each.value in (${sql.join(
        opts.tags.map((t) => sql`${t}`),
        sql`, `,
      )}))`,
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  // Determine ORDER BY
  const sort = opts.sort ?? 'recent';
  let orderBy: ReturnType<typeof sql>;
  if (sort === 'az') {
    orderBy = sql`${skills.name} ASC`;
  } else if (sort === 'hottest') {
    orderBy = sql`(select count(*) from ${skillUpvotes} where ${skillUpvotes.skillId} = ${skills.id}) * 3 + (select count(*) from ${skillComments} where ${skillComments.skillId} = ${skills.id}) DESC`;
  } else {
    orderBy = sql`${skills.updatedAt} DESC`;
  }

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  // Run count + data queries in parallel
  const [countRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(skills)
      .innerJoin(user, eq(skills.ownerUserId, user.id))
      .where(where),
    db
      .select({ skill: skills, owner: ownerSelect, ...skillSelectExtras(opts.viewerUserId) })
      .from(skills)
      .innerJoin(user, eq(skills.ownerUserId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
  ]);

  const total = Number(countRow[0]?.count ?? 0);
  return { items: rows.map(mapSkillRow), total };
}

export async function findSkillBySlug(
  slug: string,
  viewerUserId: string | null = null,
): Promise<SkillWithOwner | null> {
  const rows = await db
    .select({ skill: skills, owner: ownerSelect, ...skillSelectExtras(viewerUserId) })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(eq(skills.slug, slug))
    .limit(1);
  const r = rows[0];
  return r ? mapSkillRow(r) : null;
}

export async function findSkillById(
  skillId: string,
  viewerUserId: string | null = null,
): Promise<SkillWithOwner | null> {
  const rows = await db
    .select({ skill: skills, owner: ownerSelect, ...skillSelectExtras(viewerUserId) })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(eq(skills.id, skillId))
    .limit(1);
  const r = rows[0];
  return r ? mapSkillRow(r) : null;
}

export async function findSkillByOwnerAndSlug(
  ownerHandle: string,
  slug: string,
  viewerUserId: string | null = null,
): Promise<SkillWithOwner | null> {
  const rows = await db
    .select({ skill: skills, owner: ownerSelect, ...skillSelectExtras(viewerUserId) })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(and(eq(user.handle, ownerHandle), eq(skills.slug, slug)))
    .limit(1);
  const r = rows[0];
  return r ? mapSkillRow(r) : null;
}

export async function listSkillFilesWithContent(skillId: string) {
  const rows = await db
    .select({ path: skillFiles.path, content: skillFiles.content })
    .from(skillFiles)
    .where(eq(skillFiles.skillId, skillId));
  return rows.sort((a, b) => {
    if (a.path === 'SKILL.md') return -1;
    if (b.path === 'SKILL.md') return 1;
    return a.path.localeCompare(b.path, 'zh-CN');
  });
}

export type SkillReleaseSnapshot = Array<{ path: string; content: string }>;

export interface SkillReleaseWithAuthor {
  id: string;
  skillId: string;
  version: number;
  title: string;
  changelog: string;
  snapshotFiles: SkillReleaseSnapshot;
  createdByUserId: string;
  createdAt: Date;
  author: OwnerInfo;
}

export async function listSkillReleases(skillId: string): Promise<SkillReleaseWithAuthor[]> {
  const rows = await db
    .select({ release: skillReleases, author: ownerSelect })
    .from(skillReleases)
    .innerJoin(user, eq(skillReleases.createdByUserId, user.id))
    .where(eq(skillReleases.skillId, skillId))
    .orderBy(desc(skillReleases.version));
  return rows.map((row) => ({ ...row.release, author: row.author }));
}

export async function getSkillReleaseById(releaseId: string) {
  const rows = await db
    .select()
    .from(skillReleases)
    .where(eq(skillReleases.id, releaseId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestSkillRelease(skillId: string) {
  const rows = await db
    .select()
    .from(skillReleases)
    .where(eq(skillReleases.skillId, skillId))
    .orderBy(desc(skillReleases.version))
    .limit(1);
  return rows[0] ?? null;
}

export async function createSkillRelease(input: {
  skillId: string;
  createdByUserId: string;
  title: string;
  changelog?: string;
}) {
  const snapshotFiles = await listSkillFilesWithContent(input.skillId);
  return db.transaction(async (tx) => {
    const [versionRow] = await tx
      .select({ latest: max(skillReleases.version) })
      .from(skillReleases)
      .where(eq(skillReleases.skillId, input.skillId));
    const version = Number(versionRow?.latest ?? 0) + 1;
    const [release] = await tx
      .insert(skillReleases)
      .values({
        skillId: input.skillId,
        version,
        title: input.title,
        changelog: input.changelog ?? '',
        snapshotFiles,
        createdByUserId: input.createdByUserId,
      })
      .returning();
    if (!release) throw new Error('createSkillRelease: insert returned no row');
    return release;
  });
}

export async function ensureLatestSkillRelease(skill: SkillWithOwner) {
  const existing = await getLatestSkillRelease(skill.id);
  if (existing) return existing;
  return createSkillRelease({
    skillId: skill.id,
    createdByUserId: skill.ownerUserId,
    title: '当前快照',
    changelog: '为 Fork 同步生成的当前版本快照。',
  });
}

export async function listAllTags(): Promise<string[]> {
  // Public + referenced rows only — private rows' tags are owner-private
  // and shouldn't leak through the global tag cloud.
  const rows = await db
    .select({ tags: skills.tags })
    .from(skills)
    .where(or(eq(skills.type, 'referenced'), eq(skills.visibility, 'public')));
  return [...new Set(rows.flatMap((r) => r.tags))].sort();
}

// ─── User lookup ──────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  handle: string;
  email: string;
  ssoSub: string | null;
  image: string | null;
  isVirtual: boolean;
  canPublishAs: string[];
}

const userRowSelect = {
  id: user.id,
  name: user.name,
  handle: user.handle,
  email: user.email,
  ssoSub: user.ssoSub,
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

/**
 * Look up a user by their mozia-sso `sub` claim.
 *
 * Used by the matrix proxy auth path (spec 04): matrix backend forwards
 * `Authorization: Bearer <SKILLHUB_SERVICE_TOKEN>` + `X-SSO-SUB: <sub>`
 * and we resolve the sub to a local user row. Returns null if the user has
 * never signed in to SkillHunt directly — caller should 401 + nudge them.
 */
export async function findUserBySsoSub(sub: string): Promise<UserRow | null> {
  const rows = await db.select(userRowSelect).from(user).where(eq(user.ssoSub, sub)).limit(1);
  return rows[0] ?? null;
}

export async function updateUserProfile(
  userId: string,
  patch: { name?: string; handle?: string; image?: string | null },
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.handle !== undefined) set.handle = patch.handle;
  if (patch.image !== undefined) set.image = patch.image;
  await db.update(user).set(set).where(eq(user.id, userId));
}

// ─── User-scoped skill listing ────────────────────────────────────────

/** All skills owned by this user (by handle), including private. */
export async function listSkillsByOwner(ownerHandle: string): Promise<SkillWithOwner[]> {
  const rows = await db
    .select({ skill: skills, owner: ownerSelect, ...skillSelectExtras(null) })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(eq(user.handle, ownerHandle))
    .orderBy(sql`${skills.updatedAt} DESC`);
  return rows.map(mapSkillRow);
}

/** Public-only skills owned by this user (by handle). */
export async function listPublicSkillsByOwner(ownerHandle: string): Promise<SkillWithOwner[]> {
  const rows = await db
    .select({ skill: skills, owner: ownerSelect, ...skillSelectExtras(null) })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(
      and(
        eq(user.handle, ownerHandle),
        or(eq(skills.visibility, 'public'), eq(skills.type, 'referenced')),
      ),
    )
    .orderBy(sql`${skills.updatedAt} DESC`);
  return rows.map(mapSkillRow);
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
  icon?: string | null;
  coverImage?: string | null;
  demoVideoUrl?: string | null;
  parentSkillId?: string | null;
  rootSkillId?: string | null;
  forkSourceReleaseId?: string | null;
  latestSyncedReleaseId?: string | null;
  forkNote?: string | null;
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
        icon: input.icon ?? null,
        coverImage: input.coverImage ?? null,
        demoVideoUrl: input.demoVideoUrl ?? null,
        parentSkillId: input.parentSkillId ?? null,
        rootSkillId: input.rootSkillId ?? null,
        forkSourceReleaseId: input.forkSourceReleaseId ?? null,
        latestSyncedReleaseId: input.latestSyncedReleaseId ?? null,
        forkNote: input.forkNote ?? null,
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

    return {
      ...row,
      owner: ownerRow,
      upvoteCount: 0,
      commentCount: 0,
      bookmarkCount: 0,
      viewerHasUpvoted: false,
      viewerHasBookmarked: false,
    };
  });
}

export interface UpdateSkillData {
  name?: string;
  description?: string;
  tags?: string[];
  visibility?: 'public' | 'private';
  skillMdContent?: string;
  frontmatter?: Record<string, unknown>;
  icon?: string | null;
  coverImage?: string | null;
  demoVideoUrl?: string | null;
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
    if (input.icon !== undefined) patch.icon = input.icon;
    if (input.coverImage !== undefined) patch.coverImage = input.coverImage;
    if (input.demoVideoUrl !== undefined) patch.demoVideoUrl = input.demoVideoUrl;
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

    return {
      ...row,
      owner: ownerRow,
      upvoteCount: 0,
      commentCount: 0,
      bookmarkCount: 0,
      viewerHasUpvoted: false,
      viewerHasBookmarked: false,
    };
  });
}

export async function listSkillComments(skillId: string): Promise<SkillCommentWithAuthor[]> {
  const rows = await db
    .select({ comment: skillComments, author: ownerSelect })
    .from(skillComments)
    .innerJoin(user, eq(skillComments.userId, user.id))
    .where(eq(skillComments.skillId, skillId))
    .orderBy(desc(skillComments.createdAt));

  return rows.map((row) => ({ ...row.comment, author: row.author }));
}

export async function createSkillComment(input: {
  skillId: string;
  userId: string;
  content: string;
  parentId?: string | null;
}): Promise<SkillCommentWithAuthor> {
  return db.transaction(async (tx) => {
    const [comment] = await tx
      .insert(skillComments)
      .values({
        skillId: input.skillId,
        userId: input.userId,
        content: input.content,
        parentId: input.parentId ?? null,
      })
      .returning();
    if (!comment) throw new Error('createSkillComment: insert returned no row');

    const [author] = await tx
      .select(ownerSelect)
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);
    if (!author) throw new Error('createSkillComment: author disappeared mid-tx');

    // Notify skill owner or parent comment author
    const skill = await findSkillById(input.skillId, null);
    if (skill) {
      const notifyType = input.parentId ? 'reply' : 'comment';
      const targetUserId = input.parentId
        ? (
            await db
              .select()
              .from(skillComments)
              .where(eq(skillComments.id, input.parentId))
              .limit(1)
          )?.[0]?.userId
        : skill.ownerUserId;
      if (targetUserId) {
        await tx.insert(notifications).values({
          userId: targetUserId,
          type: notifyType,
          actorId: input.userId,
          skillId: input.skillId,
          commentId: comment.id,
          read: 0,
        });
      }
    }

    return { ...comment, author };
  });
}

export async function addSkillUpvote(skillId: string, userId: string): Promise<boolean> {
  const existing = await db
    .select({ id: skillUpvotes.id })
    .from(skillUpvotes)
    .where(and(eq(skillUpvotes.skillId, skillId), eq(skillUpvotes.userId, userId)))
    .limit(1);
  if (existing[0]) return false;

  await db.insert(skillUpvotes).values({ skillId, userId });

  // Notify skill owner
  const skill = await findSkillById(skillId, null);
  if (skill && skill.ownerUserId !== userId) {
    await db.insert(notifications).values({
      userId: skill.ownerUserId,
      type: 'upvote',
      actorId: userId,
      skillId,
      read: 0,
    });
  }

  return true;
}

export async function removeSkillUpvote(skillId: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(skillUpvotes)
    .where(and(eq(skillUpvotes.skillId, skillId), eq(skillUpvotes.userId, userId)))
    .returning({ id: skillUpvotes.id });
  return rows.length > 0;
}

// ─── Bookmarks ──────────────────────────────────────────────────────

export async function addSkillBookmark(skillId: string, userId: string): Promise<boolean> {
  const existing = await db
    .select({ id: userBookmarks.id })
    .from(userBookmarks)
    .where(and(eq(userBookmarks.skillId, skillId), eq(userBookmarks.userId, userId)))
    .limit(1);
  if (existing[0]) return false;

  await db.insert(userBookmarks).values({ skillId, userId });

  // Notify skill owner
  const skill = await findSkillById(skillId, null);
  if (skill && skill.ownerUserId !== userId) {
    await db.insert(notifications).values({
      userId: skill.ownerUserId,
      type: 'bookmark',
      actorId: userId,
      skillId,
      read: 0,
    });
  }

  return true;
}

export async function removeSkillBookmark(skillId: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(userBookmarks)
    .where(and(eq(userBookmarks.skillId, skillId), eq(userBookmarks.userId, userId)))
    .returning({ id: userBookmarks.id });
  return rows.length > 0;
}

export async function listUserBookmarks(userId: string): Promise<SkillWithOwner[]> {
  const rows = await db
    .select({ skill: skills, owner: ownerSelect, ...skillSelectExtras(userId) })
    .from(userBookmarks)
    .innerJoin(skills, eq(userBookmarks.skillId, skills.id))
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(eq(userBookmarks.userId, userId))
    .orderBy(desc(userBookmarks.createdAt));

  return rows.map(mapSkillRow);
}

export async function deleteSkill(skillId: string): Promise<boolean> {
  const result = await db.delete(skills).where(eq(skills.id, skillId)).returning({ id: skills.id });
  return result.length > 0;
}

function parseFrontmatterValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => String(item)).join(', ')}]`;
  return String(value ?? '');
}

function buildSkillMdFromParts(input: {
  name: string;
  description: string;
  tags: string[];
  body: string;
}): string {
  return [
    '---',
    `name: ${parseFrontmatterValue(input.name)}`,
    `description: ${parseFrontmatterValue(input.description)}`,
    `tags: [${input.tags.join(', ')}]`,
    '---',
    '',
    input.body.trim(),
    '',
  ].join('\n');
}

function buildForkedReferencedSkillMd(skill: SkillWithOwner): string {
  const sourceLine = skill.sourceRepo
    ? `这个 Skill Fork 自 ${skill.sourceRepo}/${skill.sourceSkillName ?? skill.slug}。`
    : `这个 Skill Fork 自 ${skill.owner.handle}/${skill.slug}。`;
  const sourceUrlLine = skill.sourceUrl ? `\n\n原始来源：${skill.sourceUrl}` : '';
  return buildSkillMdFromParts({
    name: skill.name,
    description: skill.description,
    tags: skill.tags,
    body: `# ${skill.name}\n\n## 简介\n\n${skill.description}\n\n## 来源\n\n${sourceLine}${sourceUrlLine}\n\n## 如何继续完善\n\n请在这里补充你的使用场景、执行步骤和注意事项。\n`,
  });
}

async function resolveForkSlug(ownerHandle: string, preferredSlug: string): Promise<string> {
  const base = preferredSlug.trim();
  const candidates = [base, `${base}-fork`];
  for (const candidate of candidates) {
    const existing = await findSkillByOwnerAndSlug(ownerHandle, candidate);
    if (!existing) return candidate;
  }

  let suffix = 2;
  while (true) {
    const candidate = `${base}-fork-${suffix}`;
    const existing = await findSkillByOwnerAndSlug(ownerHandle, candidate);
    if (!existing) return candidate;
    suffix += 1;
  }
}

export async function forkSkillToOwner(input: {
  sourceSkill: SkillWithOwner;
  targetOwnerUserId: string;
  targetOwnerHandle: string;
  preferredSlug?: string;
  note?: string;
}): Promise<SkillWithOwner> {
  const slug = await resolveForkSlug(
    input.targetOwnerHandle,
    input.preferredSlug ?? input.sourceSkill.slug,
  );
  const sourceRelease =
    input.sourceSkill.type === 'owned' ? await ensureLatestSkillRelease(input.sourceSkill) : null;
  const rootSkillId = input.sourceSkill.rootSkillId ?? input.sourceSkill.id;
  const forkLineage = {
    parentSkillId: input.sourceSkill.id,
    rootSkillId,
    forkSourceReleaseId: sourceRelease?.id ?? null,
    latestSyncedReleaseId: sourceRelease?.id ?? null,
    forkNote: input.note ?? null,
  };

  if (input.sourceSkill.type === 'owned') {
    const sourceFiles = await listSkillFilesWithContent(input.sourceSkill.id);
    const skillMdContent =
      sourceFiles.find((file) => file.path === 'SKILL.md')?.content ??
      buildSkillMdFromParts({
        name: input.sourceSkill.name,
        description: input.sourceSkill.description,
        tags: input.sourceSkill.tags,
        body: `# ${input.sourceSkill.name}\n\n${input.sourceSkill.description}\n`,
      });

    const created = await createOwnedSkill({
      ownerUserId: input.targetOwnerUserId,
      slug,
      name: input.sourceSkill.name,
      description: input.sourceSkill.description,
      tags: input.sourceSkill.tags,
      visibility: 'private',
      skillMdContent,
      frontmatter: input.sourceSkill.frontmatter ?? undefined,
      ...forkLineage,
    });

    await Promise.all(
      sourceFiles
        .filter((file) => file.path !== 'SKILL.md')
        .map((file) => upsertSkillFile(created.id, file.path, file.content)),
    );

    await createSkillRelease({
      skillId: created.id,
      createdByUserId: input.targetOwnerUserId,
      title: 'Fork 创建',
      changelog: `Fork 自 @${input.sourceSkill.owner.handle}/${input.sourceSkill.slug}。`,
    });

    // Notify upstream owner about the fork
    if (input.sourceSkill.ownerUserId !== input.targetOwnerUserId) {
      await db.insert(notifications).values({
        userId: input.sourceSkill.ownerUserId,
        type: 'fork',
        actorId: input.targetOwnerUserId,
        skillId: created.id,
        read: 0,
      });
    }

    return created;
  }

  const created = await createOwnedSkill({
    ownerUserId: input.targetOwnerUserId,
    slug,
    name: input.sourceSkill.name,
    description: input.sourceSkill.description,
    tags: input.sourceSkill.tags,
    visibility: 'private',
    skillMdContent: buildForkedReferencedSkillMd(input.sourceSkill),
    frontmatter: input.sourceSkill.frontmatter ?? undefined,
    ...forkLineage,
  });
  await createSkillRelease({
    skillId: created.id,
    createdByUserId: input.targetOwnerUserId,
    title: 'Fork 创建',
    changelog: `Fork 自 @${input.sourceSkill.owner.handle}/${input.sourceSkill.slug}。`,
  });
  return created;
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

function filesToMap(files: SkillReleaseSnapshot): Map<string, string> {
  return new Map(files.map((file) => [file.path, file.content]));
}

function contentChanged(a: string | undefined, b: string | undefined) {
  return (a ?? null) !== (b ?? null);
}

export async function getUpstreamStatus(input: {
  skill: SkillWithOwner;
  viewerUserId: string | null;
}) {
  const ownReleases = await listSkillReleases(input.skill.id);
  const forkCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(skills)
    .where(eq(skills.parentSkillId, input.skill.id));
  const forkCount = Number(forkCountRows[0]?.count ?? 0);

  if (!input.skill.parentSkillId) {
    return {
      isFork: false as const,
      forkCount,
      ownReleases,
      subscription: input.viewerUserId
        ? await getSkillSubscription(input.viewerUserId, input.skill.id)
        : null,
    };
  }

  const upstream = await findSkillById(input.skill.parentSkillId, input.viewerUserId);
  if (!upstream) {
    return {
      isFork: true as const,
      upstream: null,
      forkCount,
      ownReleases,
      hasUpdate: false,
      behindBy: 0,
      conflictFiles: [],
      subscription: null,
    };
  }

  const latestUpstreamRelease = await ensureLatestSkillRelease(upstream);
  const baseRelease =
    (input.skill.latestSyncedReleaseId
      ? await getSkillReleaseById(input.skill.latestSyncedReleaseId)
      : null) ??
    (input.skill.forkSourceReleaseId
      ? await getSkillReleaseById(input.skill.forkSourceReleaseId)
      : null);
  const conflictFiles = baseRelease
    ? await previewSyncConflicts(
        input.skill,
        baseRelease.snapshotFiles,
        latestUpstreamRelease.snapshotFiles,
      )
    : [];
  const behindBy = baseRelease
    ? Math.max(0, latestUpstreamRelease.version - baseRelease.version)
    : 0;

  return {
    isFork: true as const,
    upstream: {
      id: upstream.id,
      slug: upstream.slug,
      name: upstream.name,
      owner: upstream.owner,
    },
    forkCount,
    ownReleases,
    baseRelease,
    latestUpstreamRelease,
    hasUpdate: !baseRelease || latestUpstreamRelease.id !== baseRelease.id,
    behindBy,
    conflictFiles,
    subscription: input.viewerUserId
      ? await getSkillSubscription(input.viewerUserId, upstream.id)
      : null,
  };
}

async function previewSyncConflicts(
  forkSkill: SkillWithOwner,
  baseFiles: SkillReleaseSnapshot,
  upstreamFiles: SkillReleaseSnapshot,
) {
  const currentMap = filesToMap(await listSkillFilesWithContent(forkSkill.id));
  const baseMap = filesToMap(baseFiles);
  const upstreamMap = filesToMap(upstreamFiles);
  const paths = new Set([...baseMap.keys(), ...upstreamMap.keys()]);
  const conflicts: string[] = [];

  for (const path of paths) {
    const baseContent = baseMap.get(path);
    const upstreamContent = upstreamMap.get(path);
    const currentContent = currentMap.get(path);
    const forkChanged = contentChanged(currentContent, baseContent);
    const upstreamChanged = contentChanged(upstreamContent, baseContent);
    if (forkChanged && upstreamChanged) conflicts.push(path);
  }

  return conflicts;
}

export async function syncForkWithUpstream(input: {
  forkSkill: SkillWithOwner;
  userId: string;
}) {
  if (!input.forkSkill.parentSkillId) {
    return { status: 'failed' as const, error: 'Not a fork' };
  }
  if (input.forkSkill.type !== 'owned') {
    return { status: 'failed' as const, error: 'Only owned forks can sync upstream' };
  }
  if (!input.forkSkill.allowUpstreamSync || input.forkSkill.forkMode === 'detached') {
    return { status: 'failed' as const, error: 'Fork is detached from upstream' };
  }

  const upstream = await findSkillById(input.forkSkill.parentSkillId, input.userId);
  if (!upstream) return { status: 'failed' as const, error: 'Upstream not found' };
  if (upstream.type !== 'owned') {
    return {
      status: 'failed' as const,
      error: 'Referenced upstream cannot be synced automatically',
    };
  }

  const latestUpstreamRelease = await ensureLatestSkillRelease(upstream);
  const baseRelease =
    (input.forkSkill.latestSyncedReleaseId
      ? await getSkillReleaseById(input.forkSkill.latestSyncedReleaseId)
      : null) ??
    (input.forkSkill.forkSourceReleaseId
      ? await getSkillReleaseById(input.forkSkill.forkSourceReleaseId)
      : null) ??
    latestUpstreamRelease;
  const conflictFiles = await previewSyncConflicts(
    input.forkSkill,
    baseRelease.snapshotFiles,
    latestUpstreamRelease.snapshotFiles,
  );

  if (conflictFiles.length > 0) {
    await db.insert(skillSyncEvents).values({
      forkSkillId: input.forkSkill.id,
      upstreamSkillId: upstream.id,
      fromReleaseId: baseRelease.id,
      toReleaseId: latestUpstreamRelease.id,
      status: 'conflict',
      conflictFiles,
      summary: '同步被冲突阻止。',
      createdByUserId: input.userId,
    });
    return { status: 'conflict' as const, conflictFiles, latestUpstreamRelease };
  }

  const baseMap = filesToMap(baseRelease.snapshotFiles);
  const upstreamMap = filesToMap(latestUpstreamRelease.snapshotFiles);
  const paths = new Set([...baseMap.keys(), ...upstreamMap.keys()]);

  await db.transaction(async (tx) => {
    for (const path of paths) {
      const nextContent = upstreamMap.get(path);
      if (nextContent === undefined) {
        await tx
          .delete(skillFiles)
          .where(and(eq(skillFiles.skillId, input.forkSkill.id), eq(skillFiles.path, path)));
      } else {
        await tx
          .insert(skillFiles)
          .values({ skillId: input.forkSkill.id, path, content: nextContent })
          .onConflictDoUpdate({
            target: [skillFiles.skillId, skillFiles.path],
            set: { content: nextContent },
          });
      }
    }

    await tx
      .update(skills)
      .set({
        latestSyncedReleaseId: latestUpstreamRelease.id,
        updatedAt: new Date(),
      })
      .where(eq(skills.id, input.forkSkill.id));

    await tx.insert(skillSyncEvents).values({
      forkSkillId: input.forkSkill.id,
      upstreamSkillId: upstream.id,
      fromReleaseId: baseRelease.id,
      toReleaseId: latestUpstreamRelease.id,
      status: 'success',
      conflictFiles: [],
      summary: `已同步到上游 v${latestUpstreamRelease.version}。`,
      createdByUserId: input.userId,
    });
  });

  const forkRelease = await createSkillRelease({
    skillId: input.forkSkill.id,
    createdByUserId: input.userId,
    title: `同步上游 v${latestUpstreamRelease.version}`,
    changelog: `从 @${upstream.owner.handle}/${upstream.slug} 同步到 v${latestUpstreamRelease.version}。`,
  });

  // Notify upstream owner about sync (if they subscribed)
  const upstreamSub = await getSkillSubscription(upstream.ownerUserId, upstream.id);
  if (upstreamSub?.active && upstreamSub.notifyOnSync) {
    await db.insert(notifications).values({
      userId: upstream.ownerUserId,
      type: 'sync',
      actorId: input.userId,
      skillId: input.forkSkill.id,
      read: 0,
    });
  }

  return { status: 'success' as const, latestUpstreamRelease, forkRelease };
}

export async function listSyncEvents(forkSkillId: string) {
  return db
    .select()
    .from(skillSyncEvents)
    .where(eq(skillSyncEvents.forkSkillId, forkSkillId))
    .orderBy(desc(skillSyncEvents.createdAt));
}

export async function getSkillSubscription(userId: string, skillId: string) {
  const rows = await db
    .select()
    .from(skillSubscriptions)
    .where(and(eq(skillSubscriptions.userId, userId), eq(skillSubscriptions.skillId, skillId)))
    .limit(1);
  const sub = rows[0];
  if (!sub) return null;
  return {
    id: sub.id,
    active: Boolean(sub.active),
    notifyOnRelease: Boolean(sub.notifyOnRelease),
    notifyOnSync: Boolean(sub.notifyOnSync),
    updatedAt: sub.updatedAt,
  };
}

export async function setSkillSubscription(input: {
  userId: string;
  skillId: string;
  active: boolean;
  notifyOnRelease: boolean;
  notifyOnSync: boolean;
}) {
  const now = new Date();
  await db
    .insert(skillSubscriptions)
    .values({
      userId: input.userId,
      skillId: input.skillId,
      active: input.active ? 1 : 0,
      notifyOnRelease: input.notifyOnRelease ? 1 : 0,
      notifyOnSync: input.notifyOnSync ? 1 : 0,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [skillSubscriptions.userId, skillSubscriptions.skillId],
      set: {
        active: input.active ? 1 : 0,
        notifyOnRelease: input.notifyOnRelease ? 1 : 0,
        notifyOnSync: input.notifyOnSync ? 1 : 0,
        updatedAt: now,
      },
    });
  return getSkillSubscription(input.userId, input.skillId);
}

// ─── Notifications ──────────────────────────────────────────────────

export type NotificationType =
  | 'upvote'
  | 'comment'
  | 'reply'
  | 'bookmark'
  | 'fork'
  | 'sync'
  | 'release';

export interface NotificationWithActor {
  id: string;
  userId: string;
  type: NotificationType;
  actorId: string | null;
  skillId: string | null;
  commentId: string | null;
  read: number;
  createdAt: Date;
  actor: OwnerInfo | null;
  skill: { id: string; slug: string; name: string; owner: OwnerInfo } | null;
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  skillId?: string | null;
  commentId?: string | null;
}): Promise<void> {
  // Don't notify yourself
  if (input.actorId && input.userId === input.actorId) return;

  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    actorId: input.actorId ?? null,
    skillId: input.skillId ?? null,
    commentId: input.commentId ?? null,
    read: 0,
  });
}

export async function listNotifications(
  userId: string,
  limit = 50,
): Promise<NotificationWithActor[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  const result: NotificationWithActor[] = [];
  for (const row of rows) {
    let actor: OwnerInfo | null = null;
    if (row.actorId) {
      const actorUser = await findUserById(row.actorId);
      if (actorUser) {
        actor = {
          id: actorUser.id,
          name: actorUser.name,
          handle: actorUser.handle,
          image: actorUser.image,
        };
      }
    }

    let skillInfo: { id: string; slug: string; name: string; owner: OwnerInfo } | null = null;
    if (row.skillId) {
      const skillRow = await findSkillById(row.skillId, userId);
      if (skillRow) {
        skillInfo = {
          id: skillRow.id,
          slug: skillRow.slug,
          name: skillRow.name,
          owner: skillRow.owner,
        };
      }
    }

    result.push({
      ...row,
      actor,
      skill: skillInfo,
    });
  }

  return result;
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, 0)));
  return Number(rows[0]?.count ?? 0);
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .update(notifications)
    .set({ read: 1 })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning({ id: notifications.id });
  return rows.length > 0;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ read: 1 })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, 0)));
}
