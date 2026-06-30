import { and, desc, eq, max, or, sql } from 'drizzle-orm';
import {
  db,
  notifications,
  publishableBookmarks,
  publishableComments,
  publishableExternalTags,
  publishableReleases,
  publishableUpvotes,
  publishables,
  skillFiles,
  skillInstallEvents,
  skillSyncEvents,
  skills,
  user,
} from '../db';
import { skillProtocolName } from '../lib/protocol-name';
import {
  type SkillFilePayload,
  type SkillFileSnapshotEntry,
  normalizeSkillFileEntry,
  ossSkillFile,
  skillFileFingerprint,
  textSkillFile,
} from '../lib/skill-file-payload';
import {
  parseTagJson,
  publishableExternalTagsJson,
  publishableTagFilterCondition,
} from './publishable-external-tag-service';
import {
  addPublishableBookmark,
  addPublishableUpvote,
  createPublishableComment,
  createPublishableRelease,
  getLatestPublishableRelease,
  getPublishableReleaseById,
  getPublishableSubscription,
  listPublishableComments,
  listPublishableReleases,
  removePublishableBookmark,
  removePublishableUpvote,
  setPublishableSubscription,
} from './publishable-service';
import { deleteUploadedObject } from './s3-storage';

// ─── Well-known ───────────────────────────────────────────────────────

/** List all owned + public skills — fuels the well-known index. */
export async function listPublicOwnedSkills() {
  return db
    .select({
      id: skills.id,
      slug: publishables.slug,
      name: publishables.name,
      description: publishables.description,
      ownerHandle: user.handle,
    })
    .from(skills)
    .innerJoin(publishables, eq(skills.id, publishables.id))
    .innerJoin(user, eq(publishables.ownerUserId, user.id))
    .where(and(eq(skills.type, 'owned'), eq(publishables.visibility, 'public')));
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
    .innerJoin(publishables, eq(skills.id, publishables.id))
    .where(
      and(
        eq(publishables.slug, slug),
        eq(skills.type, 'owned'),
        eq(publishables.visibility, 'public'),
      ),
    )
    .limit(1);
  return rows[0]?.skills ?? null;
}

export async function findPublicOwnedSkillByOwnerAndSlug(ownerHandle: string, slug: string) {
  const rows = await db
    .select({ skill: skills })
    .from(skills)
    .innerJoin(publishables, eq(skills.id, publishables.id))
    .innerJoin(user, eq(publishables.ownerUserId, user.id))
    .where(
      and(
        eq(user.handle, ownerHandle),
        eq(publishables.slug, slug),
        eq(skills.type, 'owned'),
        eq(publishables.visibility, 'public'),
      ),
    )
    .limit(1);
  return rows[0]?.skill ?? null;
}

export async function findPublicOwnedSkillByProtocolName(protocolName: string) {
  const rows = await db
    .select({ skill: skills, publishable: publishables, ownerHandle: user.handle })
    .from(skills)
    .innerJoin(publishables, eq(skills.id, publishables.id))
    .innerJoin(user, eq(publishables.ownerUserId, user.id))
    .where(and(eq(skills.type, 'owned'), eq(publishables.visibility, 'public')));

  return (
    rows.find((r) => skillProtocolName(r.ownerHandle, r.publishable.slug) === protocolName)
      ?.skill ?? null
  );
}

const skillFileSelect = {
  path: skillFiles.path,
  content: skillFiles.content,
  storageKind: skillFiles.storageKind,
  objectKey: skillFiles.objectKey,
  contentType: skillFiles.contentType,
  sizeBytes: skillFiles.sizeBytes,
};

function mapSkillFileRow(row: {
  path: string;
  content: string;
  storageKind: 'inline' | 'oss';
  objectKey: string | null;
  contentType: string | null;
  sizeBytes: number;
}): SkillFilePayload {
  return normalizeSkillFileEntry(row);
}

export async function getSkillFilePayload(
  skillId: string,
  path: string,
): Promise<SkillFilePayload | null> {
  const rows = await db
    .select(skillFileSelect)
    .from(skillFiles)
    .where(and(eq(skillFiles.skillId, skillId), eq(skillFiles.path, path)))
    .limit(1);
  return rows[0] ? mapSkillFileRow(rows[0]) : null;
}

export async function getSkillFileContent(skillId: string, path: string): Promise<string | null> {
  const file = await getSkillFilePayload(skillId, path);
  if (!file || file.storageKind !== 'inline') return null;
  return file.content;
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
  externalTags: string[];
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
  downloadCount: number;
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
  downloadCount: sql<number>`(
    select count(*) from ${skillInstallEvents}
    where ${skillInstallEvents.skillId} = ${skills.id}
  )`,
  upvoteCount: sql<number>`(
    select count(*) from ${publishableUpvotes}
    where ${publishableUpvotes.publishableId} = ${publishables.id}
  )`,
  commentCount: sql<number>`(
    select count(*) from ${publishableComments}
    where ${publishableComments.publishableId} = ${publishables.id}
  )`,
  bookmarkCount: sql<number>`(
    select count(*) from ${publishableBookmarks}
    where ${publishableBookmarks.publishableId} = ${publishables.id}
  )`,
  viewerHasUpvoted: viewerUserId
    ? sql<number>`exists(
        select 1 from ${publishableUpvotes}
        where ${publishableUpvotes.publishableId} = ${publishables.id}
          and ${publishableUpvotes.userId} = ${viewerUserId}
      )`
    : sql<number>`0`,
  viewerHasBookmarked: viewerUserId
    ? sql<number>`exists(
        select 1 from ${publishableBookmarks}
        where ${publishableBookmarks.publishableId} = ${publishables.id}
          and ${publishableBookmarks.userId} = ${viewerUserId}
      )`
    : sql<number>`0`,
  externalTags: publishableExternalTagsJson(),
});

function mapSkillRow<
  T extends {
    skill: typeof skills.$inferSelect;
    publishable: typeof publishables.$inferSelect;
    owner: OwnerInfo;
    downloadCount: number;
    upvoteCount: number;
    commentCount: number;
    bookmarkCount: number;
    viewerHasUpvoted: number | boolean;
    viewerHasBookmarked: number | boolean;
    externalTags: unknown;
  },
>(row: T): SkillWithOwner {
  return {
    ...row.publishable,
    ...row.skill,
    externalTags: parseTagJson(row.externalTags),
    owner: row.owner,
    downloadCount: Number(row.downloadCount ?? 0),
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
      ? and(eq(publishables.visibility, 'private'), eq(publishables.ownerUserId, opts.viewerUserId))
      : undefined;
  const visibilityCond = or(
    eq(publishables.visibility, 'public'),
    eq(skills.type, 'referenced'),
    ...(ownPrivate ? [ownPrivate] : []),
  );
  if (visibilityCond) conditions.push(visibilityCond);

  if (opts.q) {
    const pattern = `%${opts.q}%`;
    const cond = or(
      sql`lower(${publishables.name}) like lower(${pattern})`,
      sql`lower(${publishables.description}) like lower(${pattern})`,
      sql`lower(${user.name}) like lower(${pattern})`,
      sql`lower(${user.handle}) like lower(${pattern})`,
    );
    if (cond) conditions.push(cond);
  }

  // Tag filtering in SQL (instead of post-filtering in JS)
  if (opts.tags.length > 0) {
    const tagCond = publishableTagFilterCondition(opts.tags);
    if (tagCond) conditions.push(tagCond);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  // Determine ORDER BY
  const sort = opts.sort ?? 'recent';
  let orderBy: ReturnType<typeof sql>;
  if (sort === 'az') {
    orderBy = sql`${publishables.name} ASC`;
  } else if (sort === 'hottest') {
    orderBy = sql`(select count(*) from ${publishableUpvotes} where ${publishableUpvotes.publishableId} = ${publishables.id}) * 3 + (select count(*) from ${publishableComments} where ${publishableComments.publishableId} = ${publishables.id}) DESC`;
  } else {
    orderBy = sql`${publishables.updatedAt} DESC`;
  }

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  // Run count + data queries in parallel
  const [countRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(skills)
      .innerJoin(publishables, eq(skills.id, publishables.id))
      .innerJoin(user, eq(publishables.ownerUserId, user.id))
      .where(where),
    db
      .select({
        skill: skills,
        publishable: publishables,
        owner: ownerSelect,
        ...skillSelectExtras(opts.viewerUserId),
      })
      .from(skills)
      .innerJoin(publishables, eq(skills.id, publishables.id))
      .innerJoin(user, eq(publishables.ownerUserId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
  ]);

  const total = Number(countRow[0]?.count ?? 0);
  return { items: rows.map(mapSkillRow), total };
}

export async function findSkillById(
  skillId: string,
  viewerUserId: string | null = null,
): Promise<SkillWithOwner | null> {
  const rows = await db
    .select({
      skill: skills,
      publishable: publishables,
      owner: ownerSelect,
      ...skillSelectExtras(viewerUserId),
    })
    .from(skills)
    .innerJoin(publishables, eq(skills.id, publishables.id))
    .innerJoin(user, eq(publishables.ownerUserId, user.id))
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
    .select({
      skill: skills,
      publishable: publishables,
      owner: ownerSelect,
      ...skillSelectExtras(viewerUserId),
    })
    .from(skills)
    .innerJoin(publishables, eq(skills.id, publishables.id))
    .innerJoin(user, eq(publishables.ownerUserId, user.id))
    .where(and(eq(user.handle, ownerHandle), eq(publishables.slug, slug)))
    .limit(1);
  const r = rows[0];
  return r ? mapSkillRow(r) : null;
}

export async function listSkillFilesWithContent(skillId: string) {
  const rows = await db
    .select(skillFileSelect)
    .from(skillFiles)
    .where(eq(skillFiles.skillId, skillId));
  return rows.map(mapSkillFileRow).sort((a, b) => {
    if (a.path === 'SKILL.md') return -1;
    if (b.path === 'SKILL.md') return 1;
    return a.path.localeCompare(b.path, 'zh-CN');
  });
}

export type SkillReleaseSnapshot = SkillFileSnapshotEntry[];

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
  const rows = await listPublishableReleases(skillId);
  return rows.flatMap((row) => {
    if (row.snapshot.kind !== 'skill') return [];
    return [
      {
        id: row.id,
        skillId: row.publishableId,
        version: row.version,
        title: row.title,
        changelog: row.changelog,
        snapshotFiles: row.snapshot.files,
        createdByUserId: row.createdByUserId,
        createdAt: row.createdAt,
        author: row.author,
      },
    ];
  });
}

export async function getSkillReleaseById(releaseId: string) {
  const release = await getPublishableReleaseById(releaseId);
  if (!release || release.snapshot.kind !== 'skill') return null;
  return {
    id: release.id,
    skillId: release.publishableId,
    version: release.version,
    title: release.title,
    changelog: release.changelog,
    snapshotFiles: release.snapshot.files,
    createdByUserId: release.createdByUserId,
    createdAt: release.createdAt,
  };
}

export async function getLatestSkillRelease(skillId: string) {
  const release = await getLatestPublishableRelease(skillId);
  if (!release || release.snapshot.kind !== 'skill') return null;
  return {
    id: release.id,
    skillId: release.publishableId,
    version: release.version,
    title: release.title,
    changelog: release.changelog,
    snapshotFiles: release.snapshot.files,
    createdByUserId: release.createdByUserId,
    createdAt: release.createdAt,
  };
}

export async function createSkillRelease(input: {
  skillId: string;
  createdByUserId: string;
  title: string;
  changelog?: string;
}) {
  const snapshotFiles = await listSkillFilesWithContent(input.skillId);
  const release = await createPublishableRelease({
    publishableId: input.skillId,
    createdByUserId: input.createdByUserId,
    title: input.title,
    changelog: input.changelog ?? '',
    snapshot: { kind: 'skill', files: snapshotFiles },
  });
  if (release.snapshot.kind !== 'skill') {
    throw new Error('createSkillRelease: unexpected snapshot kind');
  }
  return {
    id: release.id,
    skillId: release.publishableId,
    version: release.version,
    title: release.title,
    changelog: release.changelog,
    snapshotFiles: release.snapshot.files,
    createdByUserId: release.createdByUserId,
    createdAt: release.createdAt,
  };
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

export async function listAllTags(opts: { includeExternal?: boolean } = {}): Promise<string[]> {
  if (!opts.includeExternal) {
    const rows = await db
      .select({ tags: publishables.tags })
      .from(publishables)
      .where(eq(publishables.visibility, 'public'));
    return [...new Set(rows.flatMap((r) => r.tags))].sort();
  }

  const [publishableRows, externalRows] = await Promise.all([
    db
      .select({ tags: publishables.tags })
      .from(publishables)
      .where(eq(publishables.visibility, 'public')),
    db
      .select({ tag: publishableExternalTags.tag })
      .from(publishableExternalTags)
      .innerJoin(publishables, eq(publishableExternalTags.publishableId, publishables.id))
      .where(eq(publishables.visibility, 'public')),
  ]);

  return [
    ...new Set([...publishableRows.flatMap((r) => r.tags), ...externalRows.map((r) => r.tag)]),
  ].sort();
}

// ─── User lookup ──────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  handle: string;
  email: string;
  ssoSub: string | null;
  phone: string | null;
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
  phone: user.phone,
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
    .select({
      skill: skills,
      publishable: publishables,
      owner: ownerSelect,
      ...skillSelectExtras(null),
    })
    .from(skills)
    .innerJoin(publishables, eq(skills.id, publishables.id))
    .innerJoin(user, eq(publishables.ownerUserId, user.id))
    .where(eq(user.handle, ownerHandle))
    .orderBy(sql`${publishables.updatedAt} DESC`);
  return rows.map(mapSkillRow);
}

/** Public-only skills owned by this user (by handle). */
export async function listPublicSkillsByOwner(ownerHandle: string): Promise<SkillWithOwner[]> {
  const rows = await db
    .select({
      skill: skills,
      publishable: publishables,
      owner: ownerSelect,
      ...skillSelectExtras(null),
    })
    .from(skills)
    .innerJoin(publishables, eq(skills.id, publishables.id))
    .innerJoin(user, eq(publishables.ownerUserId, user.id))
    .where(
      and(
        eq(user.handle, ownerHandle),
        or(eq(publishables.visibility, 'public'), eq(skills.type, 'referenced')),
      ),
    )
    .orderBy(sql`${publishables.updatedAt} DESC`);
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
  initialRelease?: {
    title: string;
    changelog: string;
    createdByUserId: string;
  };
}

export async function createOwnedSkill(input: CreateSkillData): Promise<SkillWithOwner> {
  return db.transaction(async (tx) => {
    const [publishable] = await tx
      .insert(publishables)
      .values({
        kind: 'skill',
        ownerUserId: input.ownerUserId,
        slug: input.slug,
        name: input.name,
        description: input.description,
        visibility: input.visibility,
        tags: input.tags,
        icon: input.icon ?? null,
        coverImage: input.coverImage ?? null,
      })
      .returning();
    if (!publishable) throw new Error('createOwnedSkill: publishable insert returned no row');

    const [row] = await tx
      .insert(skills)
      .values({
        id: publishable.id,
        type: 'owned',
        frontmatter: input.frontmatter ?? parseFrontmatter(input.skillMdContent),
        demoVideoUrl: input.demoVideoUrl ?? null,
        parentSkillId: input.parentSkillId ?? null,
        rootSkillId: input.rootSkillId ?? null,
        forkSourceReleaseId: input.forkSourceReleaseId ?? null,
        latestSyncedReleaseId: input.latestSyncedReleaseId ?? null,
        forkNote: input.forkNote ?? null,
      })
      .returning();
    if (!row) throw new Error('createOwnedSkill: insert returned no row');

    const skillMdFile = textSkillFile('SKILL.md', input.skillMdContent);
    await tx.insert(skillFiles).values({
      skillId: row.id,
      path: skillMdFile.path,
      content: skillMdFile.content,
      storageKind: skillMdFile.storageKind,
      objectKey: skillMdFile.objectKey,
      contentType: skillMdFile.contentType,
      sizeBytes: skillMdFile.sizeBytes,
    });

    if (input.initialRelease) {
      await tx.insert(publishableReleases).values({
        publishableId: publishable.id,
        version: 1,
        title: input.initialRelease.title,
        changelog: input.initialRelease.changelog,
        snapshot: {
          kind: 'skill',
          files: [skillMdFile],
        },
        createdByUserId: input.initialRelease.createdByUserId,
      });
    }

    const [ownerRow] = await tx
      .select(ownerSelect)
      .from(user)
      .where(eq(user.id, publishable.ownerUserId))
      .limit(1);
    if (!ownerRow) throw new Error('createOwnedSkill: owner user disappeared mid-tx');

    return {
      ...publishable,
      ...row,
      owner: ownerRow,
      downloadCount: 0,
      upvoteCount: 0,
      commentCount: 0,
      bookmarkCount: 0,
      viewerHasUpvoted: false,
      viewerHasBookmarked: false,
      externalTags: [],
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
  release?: {
    title: string;
    changelog: string;
    createdByUserId: string;
  };
}

export async function updateOwnedSkill(
  skillId: string,
  input: UpdateSkillData,
): Promise<SkillWithOwner | null> {
  return db.transaction(async (tx) => {
    const publishablePatch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) publishablePatch.name = input.name;
    if (input.description !== undefined) publishablePatch.description = input.description;
    if (input.tags !== undefined) publishablePatch.tags = input.tags;
    if (input.visibility !== undefined) publishablePatch.visibility = input.visibility;
    if (input.icon !== undefined) publishablePatch.icon = input.icon;
    if (input.coverImage !== undefined) publishablePatch.coverImage = input.coverImage;

    const skillPatch: Record<string, unknown> = {};
    if (input.frontmatter !== undefined) {
      skillPatch.frontmatter = input.frontmatter;
    } else if (input.skillMdContent !== undefined) {
      skillPatch.frontmatter = parseFrontmatter(input.skillMdContent);
    }
    if (input.demoVideoUrl !== undefined) skillPatch.demoVideoUrl = input.demoVideoUrl;

    const [publishable] = await tx
      .update(publishables)
      .set(publishablePatch)
      .where(eq(publishables.id, skillId))
      .returning();
    if (!publishable) return null;

    const [row] =
      Object.keys(skillPatch).length > 0
        ? await tx.update(skills).set(skillPatch).where(eq(skills.id, skillId)).returning()
        : await tx.select().from(skills).where(eq(skills.id, skillId)).limit(1);
    if (!row) return null;

    if (input.skillMdContent !== undefined) {
      // Upsert SKILL.md content
      const skillMdFile = textSkillFile('SKILL.md', input.skillMdContent);
      await tx
        .insert(skillFiles)
        .values({
          skillId,
          path: skillMdFile.path,
          content: skillMdFile.content,
          storageKind: skillMdFile.storageKind,
          objectKey: skillMdFile.objectKey,
          contentType: skillMdFile.contentType,
          sizeBytes: skillMdFile.sizeBytes,
        })
        .onConflictDoUpdate({
          target: [skillFiles.skillId, skillFiles.path],
          set: {
            content: skillMdFile.content,
            storageKind: skillMdFile.storageKind,
            objectKey: skillMdFile.objectKey,
            contentType: skillMdFile.contentType,
            sizeBytes: skillMdFile.sizeBytes,
          },
        });
    }

    if (input.release) {
      const snapshotFiles = await tx
        .select(skillFileSelect)
        .from(skillFiles)
        .where(eq(skillFiles.skillId, skillId));
      const [versionRow] = await tx
        .select({ latest: max(publishableReleases.version) })
        .from(publishableReleases)
        .where(eq(publishableReleases.publishableId, skillId));
      await tx.insert(publishableReleases).values({
        publishableId: skillId,
        version: Number(versionRow?.latest ?? 0) + 1,
        title: input.release.title,
        changelog: input.release.changelog,
        snapshot: {
          kind: 'skill',
          files: snapshotFiles.map(mapSkillFileRow).sort((a, b) => {
            if (a.path === 'SKILL.md') return -1;
            if (b.path === 'SKILL.md') return 1;
            return a.path.localeCompare(b.path, 'zh-CN');
          }),
        },
        createdByUserId: input.release.createdByUserId,
      });
    }

    const [ownerRow] = await tx
      .select(ownerSelect)
      .from(user)
      .where(eq(user.id, publishable.ownerUserId))
      .limit(1);
    if (!ownerRow) throw new Error('updateOwnedSkill: owner user disappeared mid-tx');

    return {
      ...publishable,
      ...row,
      owner: ownerRow,
      downloadCount: 0,
      upvoteCount: 0,
      commentCount: 0,
      bookmarkCount: 0,
      viewerHasUpvoted: false,
      viewerHasBookmarked: false,
      externalTags: [],
    };
  });
}

export async function listSkillComments(skillId: string): Promise<SkillCommentWithAuthor[]> {
  const rows = await listPublishableComments(skillId);
  return rows.map((row) => ({ ...row, skillId: row.publishableId }));
}

export async function createSkillComment(input: {
  skillId: string;
  userId: string;
  content: string;
  parentId?: string | null;
}): Promise<SkillCommentWithAuthor> {
  const comment = await createPublishableComment({
    publishableId: input.skillId,
    userId: input.userId,
    content: input.content,
    parentId: input.parentId ?? null,
  });
  return { ...comment, skillId: comment.publishableId };
}

export async function addSkillUpvote(skillId: string, userId: string): Promise<boolean> {
  return addPublishableUpvote(skillId, userId);
}

export async function removeSkillUpvote(skillId: string, userId: string): Promise<boolean> {
  return removePublishableUpvote(skillId, userId);
}

// ─── Bookmarks ──────────────────────────────────────────────────────

export async function addSkillBookmark(skillId: string, userId: string): Promise<boolean> {
  return addPublishableBookmark(skillId, userId);
}

export async function removeSkillBookmark(skillId: string, userId: string): Promise<boolean> {
  return removePublishableBookmark(skillId, userId);
}

export async function listUserBookmarks(userId: string): Promise<SkillWithOwner[]> {
  const rows = await db
    .select({
      skill: skills,
      publishable: publishables,
      owner: ownerSelect,
      ...skillSelectExtras(userId),
    })
    .from(publishableBookmarks)
    .innerJoin(skills, eq(publishableBookmarks.publishableId, skills.id))
    .innerJoin(publishables, eq(skills.id, publishables.id))
    .innerJoin(user, eq(publishables.ownerUserId, user.id))
    .where(eq(publishableBookmarks.userId, userId))
    .orderBy(desc(publishableBookmarks.createdAt));

  return rows.map(mapSkillRow);
}

async function listCurrentSkillOssObjectKeys(skillId: string): Promise<string[]> {
  const rows = await db
    .select({ objectKey: skillFiles.objectKey })
    .from(skillFiles)
    .where(and(eq(skillFiles.skillId, skillId), eq(skillFiles.storageKind, 'oss')));

  return [
    ...new Set(rows.map((row) => row.objectKey).filter((value): value is string => Boolean(value))),
  ];
}

export async function deleteSkill(skillId: string): Promise<boolean> {
  const ossObjectKeys = await listCurrentSkillOssObjectKeys(skillId);
  const result = await db
    .delete(publishables)
    .where(and(eq(publishables.id, skillId), eq(publishables.kind, 'skill')))
    .returning({ id: publishables.id });
  const deleted = result.length > 0;
  if (!deleted) return false;

  await Promise.all(
    ossObjectKeys.map(async (objectKey) => {
      try {
        await deleteUploadedObject(objectKey);
      } catch (error) {
        console.warn('[skill-delete] OSS 对象删除失败', {
          skillId,
          objectKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  return true;
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
        .map((file) => upsertSkillFilePayload(created.id, file)),
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
        publishableId: created.id,
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

export async function upsertSkillFilePayload(
  skillId: string,
  file: SkillFilePayload,
): Promise<void> {
  await db
    .insert(skillFiles)
    .values({
      skillId,
      path: file.path,
      content: file.content,
      storageKind: file.storageKind,
      objectKey: file.objectKey,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
    })
    .onConflictDoUpdate({
      target: [skillFiles.skillId, skillFiles.path],
      set: {
        content: file.content,
        storageKind: file.storageKind,
        objectKey: file.objectKey,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
      },
    });
}

export async function upsertSkillFile(
  skillId: string,
  path: string,
  content: string,
): Promise<void> {
  await upsertSkillFilePayload(skillId, textSkillFile(path, content));
}

export async function upsertSkillOssFile(
  skillId: string,
  path: string,
  input: { objectKey: string; contentType?: string | null; sizeBytes: number },
): Promise<void> {
  await upsertSkillFilePayload(skillId, ossSkillFile(path, input));
}

export async function deleteSkillFile(skillId: string, path: string): Promise<boolean> {
  const result = await db
    .delete(skillFiles)
    .where(and(eq(skillFiles.skillId, skillId), eq(skillFiles.path, path)))
    .returning({ id: skillFiles.id });
  return result.length > 0;
}

function filesToMap(files: SkillReleaseSnapshot): Map<string, SkillFilePayload> {
  return new Map(files.map((file) => [file.path, normalizeSkillFileEntry(file)]));
}

function contentChanged(a: SkillFilePayload | undefined, b: SkillFilePayload | undefined) {
  return (a ? skillFileFingerprint(a) : null) !== (b ? skillFileFingerprint(b) : null);
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
      const nextFile = upstreamMap.get(path);
      if (nextFile === undefined) {
        await tx
          .delete(skillFiles)
          .where(and(eq(skillFiles.skillId, input.forkSkill.id), eq(skillFiles.path, path)));
      } else {
        await tx
          .insert(skillFiles)
          .values({
            skillId: input.forkSkill.id,
            path,
            content: nextFile.content,
            storageKind: nextFile.storageKind,
            objectKey: nextFile.objectKey,
            contentType: nextFile.contentType,
            sizeBytes: nextFile.sizeBytes,
          })
          .onConflictDoUpdate({
            target: [skillFiles.skillId, skillFiles.path],
            set: {
              content: nextFile.content,
              storageKind: nextFile.storageKind,
              objectKey: nextFile.objectKey,
              contentType: nextFile.contentType,
              sizeBytes: nextFile.sizeBytes,
            },
          });
      }
    }

    await tx
      .update(skills)
      .set({
        latestSyncedReleaseId: latestUpstreamRelease.id,
      })
      .where(eq(skills.id, input.forkSkill.id));
    await tx
      .update(publishables)
      .set({ updatedAt: new Date() })
      .where(eq(publishables.id, input.forkSkill.id));

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
      publishableId: input.forkSkill.id,
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
  return getPublishableSubscription(userId, skillId);
}

export async function setSkillSubscription(input: {
  userId: string;
  skillId: string;
  active: boolean;
  notifyOnRelease: boolean;
  notifyOnSync: boolean;
}) {
  return setPublishableSubscription({
    userId: input.userId,
    publishableId: input.skillId,
    active: input.active,
    notifyOnRelease: input.notifyOnRelease,
    notifyOnSync: input.notifyOnSync,
  });
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
  publishableId: string | null;
  commentId: string | null;
  read: number;
  createdAt: Date;
  actor: OwnerInfo | null;
  publishable: {
    id: string;
    kind: 'skill' | 'package';
    slug: string;
    name: string;
    owner: OwnerInfo;
  } | null;
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  publishableId?: string | null;
  commentId?: string | null;
}): Promise<void> {
  // Don't notify yourself
  if (input.actorId && input.userId === input.actorId) return;

  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    actorId: input.actorId ?? null,
    publishableId: input.publishableId ?? null,
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

    let publishableInfo: NotificationWithActor['publishable'] = null;
    if (row.publishableId) {
      const publishableRows = await db
        .select({ publishable: publishables, owner: ownerSelect })
        .from(publishables)
        .innerJoin(user, eq(publishables.ownerUserId, user.id))
        .where(eq(publishables.id, row.publishableId))
        .limit(1);
      const publishableRow = publishableRows[0];
      if (publishableRow) {
        publishableInfo = {
          id: publishableRow.publishable.id,
          kind: publishableRow.publishable.kind,
          slug: publishableRow.publishable.slug,
          name: publishableRow.publishable.name,
          owner: publishableRow.owner,
        };
      }
    }

    result.push({
      ...row,
      actor,
      publishable: publishableInfo,
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
