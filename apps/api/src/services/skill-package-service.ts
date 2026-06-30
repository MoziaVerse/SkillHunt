import { and, asc, desc, eq, max, or, sql } from 'drizzle-orm';
import {
  db,
  publishableBookmarks,
  publishableComments,
  publishableUpvotes,
  publishables,
  skillFiles,
  skillInstallEvents,
  skillPackageItems,
  skillPackages,
  skills,
  user,
} from '../db';
import { skillProtocolName } from '../lib/protocol-name';
import {
  type SkillFilePayload,
  type SkillFileSnapshotEntry,
  normalizeSkillFileEntry,
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
  listPublishableComments,
  listPublishableReleases,
  removePublishableBookmark,
  removePublishableUpvote,
} from './publishable-service';
import {
  type OwnerInfo,
  type SkillWithOwner,
  ensureLatestSkillRelease,
  getSkillReleaseById,
} from './skill-service';

const ownerSelect = {
  id: user.id,
  name: user.name,
  handle: user.handle,
  image: user.image,
};

export class SkillPackageError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface SkillPackageWithOwner {
  id: string;
  ownerUserId: string;
  slug: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  tags: string[];
  externalTags: string[];
  icon: string | null;
  coverImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner: OwnerInfo;
  skillCount: number;
  upvoteCount: number;
  commentCount: number;
  bookmarkCount: number;
  viewerHasUpvoted: boolean;
  viewerHasBookmarked: boolean;
}

export interface SkillPackageItemWithSkill {
  id: string;
  packageId: string;
  skillId: string;
  position: number;
  note: string | null;
  pinnedReleaseId: string | null;
  createdAt: Date;
  protocolName: string;
  files: string[];
  skill: SkillWithOwner;
}

export interface SkillPackageDetail extends SkillPackageWithOwner {
  skills: SkillPackageItemWithSkill[];
}

export interface SkillPackageCommentWithAuthor {
  id: string;
  packageId: string;
  userId: string;
  parentId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: OwnerInfo;
}

export interface SkillPackageReleaseWithAuthor {
  id: string;
  packageId: string;
  version: number;
  title: string;
  changelog: string;
  items: Array<{
    skillId: string;
    ownerHandle: string;
    skillSlug: string;
    skillName: string;
    skillDescription: string;
    protocolName: string;
    position: number;
    note: string | null;
    skillReleaseId: string;
    skillVersion: number;
    files: SkillFileSnapshotEntry[];
  }>;
  createdByUserId: string;
  createdAt: Date;
  author: OwnerInfo;
}

export interface ListSkillPackagesOptions {
  q?: string;
  tags: string[];
  viewerUserId: string | null;
  includePrivate?: boolean;
  sort?: 'recent' | 'hottest' | 'az';
  limit?: number;
  offset?: number;
}

export interface CreateSkillPackageData {
  ownerUserId: string;
  slug: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  tags: string[];
  icon?: string | null;
  coverImage?: string | null;
  skillIds?: string[];
  initialRelease?: {
    title: string;
    changelog: string;
    createdByUserId: string;
  };
}

export interface UpdateSkillPackageData {
  name?: string;
  description?: string;
  visibility?: 'public' | 'private';
  tags?: string[];
  icon?: string | null;
  coverImage?: string | null;
}

const skillSelectExtras = () => ({
  downloadCount: sql<number>`(
    select count(*) from ${skillInstallEvents}
    where ${skillInstallEvents.skillId} = ${skills.id}
  )`,
  upvoteCount: sql<number>`0`,
  commentCount: sql<number>`0`,
  bookmarkCount: sql<number>`0`,
  viewerHasUpvoted: sql<number>`0`,
  viewerHasBookmarked: sql<number>`0`,
  externalTags: publishableExternalTagsJson(),
});

const packageSelectExtras = (viewerUserId: string | null) => ({
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

function mapPackageRow<
  T extends {
    package: typeof skillPackages.$inferSelect;
    publishable: typeof publishables.$inferSelect;
    owner: OwnerInfo;
    skillCount: number;
    upvoteCount: number;
    commentCount: number;
    bookmarkCount: number;
    viewerHasUpvoted: number | boolean;
    viewerHasBookmarked: number | boolean;
    externalTags: unknown;
  },
>(row: T): SkillPackageWithOwner {
  return {
    ...row.publishable,
    ...row.package,
    externalTags: parseTagJson(row.externalTags),
    owner: row.owner,
    skillCount: Number(row.skillCount ?? 0),
    upvoteCount: Number(row.upvoteCount ?? 0),
    commentCount: Number(row.commentCount ?? 0),
    bookmarkCount: Number(row.bookmarkCount ?? 0),
    viewerHasUpvoted: Boolean(row.viewerHasUpvoted),
    viewerHasBookmarked: Boolean(row.viewerHasBookmarked),
  };
}

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

function canReadPackage(
  pkg: Pick<SkillPackageWithOwner, 'visibility' | 'ownerUserId'>,
  opts: ListSkillPackagesOptions,
) {
  if (pkg.visibility === 'public') return true;
  return Boolean(opts.viewerUserId && opts.includePrivate && pkg.ownerUserId === opts.viewerUserId);
}

async function listFilesForPackageItem(skillId: string, pinnedReleaseId: string | null) {
  if (pinnedReleaseId) {
    const release = await getSkillReleaseById(pinnedReleaseId);
    if (release?.skillId === skillId) return release.snapshotFiles.map((file) => file.path);
    return [];
  }

  const rows = await db
    .select({ path: skillFiles.path })
    .from(skillFiles)
    .where(eq(skillFiles.skillId, skillId));
  return rows
    .map((row) => row.path)
    .sort((a, b) => {
      if (a === 'SKILL.md') return -1;
      if (b === 'SKILL.md') return 1;
      return a.localeCompare(b, 'zh-CN');
    });
}

async function getPackageItemFileContent(input: {
  skillId: string;
  pinnedReleaseId: string | null;
  path: string;
}): Promise<SkillFilePayload | null> {
  if (input.pinnedReleaseId) {
    const release = await getSkillReleaseById(input.pinnedReleaseId);
    if (release?.skillId !== input.skillId) return null;
    const file = release.snapshotFiles.find((entry) => entry.path === input.path);
    return file ? normalizeSkillFileEntry(file) : null;
  }

  const rows = await db
    .select({
      path: skillFiles.path,
      content: skillFiles.content,
      storageKind: skillFiles.storageKind,
      objectKey: skillFiles.objectKey,
      contentType: skillFiles.contentType,
      sizeBytes: skillFiles.sizeBytes,
    })
    .from(skillFiles)
    .where(and(eq(skillFiles.skillId, input.skillId), eq(skillFiles.path, input.path)))
    .limit(1);
  return rows[0] ? normalizeSkillFileEntry(rows[0]) : null;
}

async function assertPackageCanUseSkill(input: {
  skillId: string;
  packageVisibility: 'public' | 'private';
  pinnedReleaseId?: string | null;
}) {
  const rows = await db
    .select({ skill: skills, publishable: publishables })
    .from(skills)
    .innerJoin(publishables, eq(skills.id, publishables.id))
    .where(eq(skills.id, input.skillId))
    .limit(1);
  const row = rows[0];
  const skill = row?.skill;
  if (!skill) throw new SkillPackageError(404, 'skill_not_found', 'Skill not found');
  if (skill.type !== 'owned') {
    throw new SkillPackageError(
      400,
      'unsupported_skill_type',
      'Skill packages only support owned skills',
    );
  }
  if (input.packageVisibility === 'public' && row.publishable.visibility !== 'public') {
    throw new SkillPackageError(
      400,
      'private_skill_in_public_package',
      'Public packages can only include public skills',
    );
  }
  if (input.pinnedReleaseId) {
    const release = await getSkillReleaseById(input.pinnedReleaseId);
    if (!release || release.skillId !== skill.id) {
      throw new SkillPackageError(
        400,
        'release_not_found',
        'Pinned release does not belong to this skill',
      );
    }
  }
  return skill;
}

async function assertPackageCanBecomePublic(packageId: string) {
  const rows = await db
    .select({ skill: skills, publishable: publishables })
    .from(skillPackageItems)
    .innerJoin(skills, eq(skillPackageItems.skillId, skills.id))
    .innerJoin(publishables, eq(skills.id, publishables.id))
    .where(eq(skillPackageItems.packageId, packageId));
  const invalid = rows.find(
    (row) => row.skill.type !== 'owned' || row.publishable.visibility !== 'public',
  );
  if (invalid) {
    throw new SkillPackageError(
      400,
      'private_skill_in_public_package',
      'Public packages can only include public skills',
    );
  }
}

export async function listSkillPackagesForApi(
  opts: ListSkillPackagesOptions,
): Promise<{ items: SkillPackageWithOwner[]; total: number }> {
  const conditions = [];
  const ownPrivate =
    opts.viewerUserId && opts.includePrivate
      ? and(eq(publishables.visibility, 'private'), eq(publishables.ownerUserId, opts.viewerUserId))
      : undefined;
  const visibilityCond = or(
    eq(publishables.visibility, 'public'),
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

  if (opts.tags.length > 0) {
    const tagCond = publishableTagFilterCondition(opts.tags);
    if (tagCond) conditions.push(tagCond);
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const orderBy =
    opts.sort === 'az'
      ? sql`${publishables.name} ASC`
      : opts.sort === 'hottest'
        ? sql`(
            select count(*) from ${publishableUpvotes}
            where ${publishableUpvotes.publishableId} = ${publishables.id}
          ) * 3 + (
            select count(*) from ${publishableComments}
            where ${publishableComments.publishableId} = ${publishables.id}
          ) * 2 + (
            select count(*) from ${publishableBookmarks}
            where ${publishableBookmarks.publishableId} = ${publishables.id}
          ) DESC`
        : sql`${publishables.updatedAt} DESC`;
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const skillCount = sql<number>`(
    select count(*) from ${skillPackageItems}
    where ${skillPackageItems.packageId} = ${skillPackages.id}
  )`;

  const [countRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(skillPackages)
      .innerJoin(publishables, eq(skillPackages.id, publishables.id))
      .innerJoin(user, eq(publishables.ownerUserId, user.id))
      .where(where),
    db
      .select({
        package: skillPackages,
        publishable: publishables,
        owner: ownerSelect,
        skillCount,
        ...packageSelectExtras(opts.viewerUserId),
      })
      .from(skillPackages)
      .innerJoin(publishables, eq(skillPackages.id, publishables.id))
      .innerJoin(user, eq(publishables.ownerUserId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
  ]);

  return { items: rows.map(mapPackageRow), total: Number(countRow[0]?.count ?? 0) };
}

export async function listSkillPackagesContainingSkill(
  skillId: string,
  opts: Pick<ListSkillPackagesOptions, 'viewerUserId' | 'includePrivate'> = {
    viewerUserId: null,
    includePrivate: false,
  },
): Promise<{ items: SkillPackageWithOwner[]; total: number }> {
  const ownPrivate =
    opts.viewerUserId && opts.includePrivate
      ? and(eq(publishables.visibility, 'private'), eq(publishables.ownerUserId, opts.viewerUserId))
      : undefined;
  const visibilityCond = or(
    eq(publishables.visibility, 'public'),
    ...(ownPrivate ? [ownPrivate] : []),
  );
  const where = and(eq(skillPackageItems.skillId, skillId), visibilityCond);
  const skillCount = sql<number>`(
    select count(*) from ${skillPackageItems}
    where ${skillPackageItems.packageId} = ${skillPackages.id}
  )`;

  const [countRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(skillPackageItems)
      .innerJoin(skillPackages, eq(skillPackageItems.packageId, skillPackages.id))
      .innerJoin(publishables, eq(skillPackages.id, publishables.id))
      .innerJoin(user, eq(publishables.ownerUserId, user.id))
      .where(where),
    db
      .select({
        package: skillPackages,
        publishable: publishables,
        owner: ownerSelect,
        skillCount,
        ...packageSelectExtras(opts.viewerUserId ?? null),
      })
      .from(skillPackageItems)
      .innerJoin(skillPackages, eq(skillPackageItems.packageId, skillPackages.id))
      .innerJoin(publishables, eq(skillPackages.id, publishables.id))
      .innerJoin(user, eq(publishables.ownerUserId, user.id))
      .where(where)
      .orderBy(desc(publishables.updatedAt)),
  ]);

  return { items: rows.map(mapPackageRow), total: Number(countRow[0]?.count ?? 0) };
}

export async function listSkillPackagesByOwner(
  ownerUserId: string,
  opts: Pick<ListSkillPackagesOptions, 'viewerUserId' | 'includePrivate'> = {
    viewerUserId: null,
    includePrivate: false,
  },
): Promise<{ items: SkillPackageWithOwner[]; total: number }> {
  const canSeeOwnPrivate = opts.viewerUserId === ownerUserId && Boolean(opts.includePrivate);
  const visibilityCond = canSeeOwnPrivate ? undefined : eq(publishables.visibility, 'public');
  const where = visibilityCond
    ? and(eq(publishables.ownerUserId, ownerUserId), visibilityCond)
    : eq(publishables.ownerUserId, ownerUserId);
  const skillCount = sql<number>`(
    select count(*) from ${skillPackageItems}
    where ${skillPackageItems.packageId} = ${skillPackages.id}
  )`;

  const [countRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(skillPackages)
      .innerJoin(publishables, eq(skillPackages.id, publishables.id))
      .innerJoin(user, eq(publishables.ownerUserId, user.id))
      .where(where),
    db
      .select({
        package: skillPackages,
        publishable: publishables,
        owner: ownerSelect,
        skillCount,
        ...packageSelectExtras(opts.viewerUserId ?? null),
      })
      .from(skillPackages)
      .innerJoin(publishables, eq(skillPackages.id, publishables.id))
      .innerJoin(user, eq(publishables.ownerUserId, user.id))
      .where(where)
      .orderBy(desc(publishables.updatedAt)),
  ]);

  return { items: rows.map(mapPackageRow), total: Number(countRow[0]?.count ?? 0) };
}

export async function findSkillPackageByOwnerAndSlug(
  ownerHandle: string,
  slug: string,
  opts: Pick<ListSkillPackagesOptions, 'viewerUserId' | 'includePrivate'> = {
    viewerUserId: null,
    includePrivate: false,
  },
): Promise<SkillPackageWithOwner | null> {
  const skillCount = sql<number>`(
    select count(*) from ${skillPackageItems}
    where ${skillPackageItems.packageId} = ${skillPackages.id}
  )`;
  const rows = await db
    .select({
      package: skillPackages,
      publishable: publishables,
      owner: ownerSelect,
      skillCount,
      ...packageSelectExtras(opts.viewerUserId ?? null),
    })
    .from(skillPackages)
    .innerJoin(publishables, eq(skillPackages.id, publishables.id))
    .innerJoin(user, eq(publishables.ownerUserId, user.id))
    .where(and(eq(user.handle, ownerHandle), eq(publishables.slug, slug)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (
    !canReadPackage(
      { ...row.publishable, ...row.package },
      {
        tags: [],
        viewerUserId: opts.viewerUserId ?? null,
        includePrivate: opts.includePrivate,
      },
    )
  ) {
    return null;
  }
  return mapPackageRow(row);
}

export async function findSkillPackageById(packageId: string, viewerUserId: string | null = null) {
  const skillCount = sql<number>`(
    select count(*) from ${skillPackageItems}
    where ${skillPackageItems.packageId} = ${skillPackages.id}
  )`;
  const rows = await db
    .select({
      package: skillPackages,
      publishable: publishables,
      owner: ownerSelect,
      skillCount,
      ...packageSelectExtras(viewerUserId),
    })
    .from(skillPackages)
    .innerJoin(publishables, eq(skillPackages.id, publishables.id))
    .innerJoin(user, eq(publishables.ownerUserId, user.id))
    .where(eq(skillPackages.id, packageId))
    .limit(1);
  return rows[0] ? mapPackageRow(rows[0]) : null;
}

export async function listSkillPackageItems(
  packageId: string,
  opts: { includePrivateSkills?: boolean } = {},
): Promise<SkillPackageItemWithSkill[]> {
  const conditions = [eq(skillPackageItems.packageId, packageId), eq(skills.type, 'owned')];
  if (!opts.includePrivateSkills) conditions.push(eq(publishables.visibility, 'public'));

  const rows = await db
    .select({
      item: skillPackageItems,
      skill: skills,
      publishable: publishables,
      owner: ownerSelect,
      ...skillSelectExtras(),
    })
    .from(skillPackageItems)
    .innerJoin(skills, eq(skillPackageItems.skillId, skills.id))
    .innerJoin(publishables, eq(skills.id, publishables.id))
    .innerJoin(user, eq(publishables.ownerUserId, user.id))
    .where(and(...conditions))
    .orderBy(asc(skillPackageItems.position), asc(publishables.name));

  return Promise.all(
    rows.map(async (row) => {
      const skill = mapSkillRow(row);
      return {
        ...row.item,
        skill,
        protocolName: skillProtocolName(skill.owner.handle, skill.slug),
        files: await listFilesForPackageItem(skill.id, row.item.pinnedReleaseId),
      };
    }),
  );
}

export async function getSkillPackageDetail(
  ownerHandle: string,
  slug: string,
  opts: Pick<ListSkillPackagesOptions, 'viewerUserId' | 'includePrivate'> = {
    viewerUserId: null,
    includePrivate: false,
  },
): Promise<SkillPackageDetail | null> {
  const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, opts);
  if (!pkg) return null;
  return {
    ...pkg,
    skills: await listSkillPackageItems(pkg.id, {
      includePrivateSkills: Boolean(
        opts.viewerUserId && opts.includePrivate && opts.viewerUserId === pkg.ownerUserId,
      ),
    }),
  };
}

function mapPackageReleaseRow(
  row: Awaited<ReturnType<typeof listPublishableReleases>>[number],
): SkillPackageReleaseWithAuthor | null {
  if (row.snapshot.kind !== 'package') return null;
  return {
    id: row.id,
    packageId: row.publishableId,
    version: row.version,
    title: row.title,
    changelog: row.changelog,
    items: row.snapshot.items,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    author: row.author,
  };
}

async function buildPackageReleaseItems(
  packageId: string,
): Promise<SkillPackageReleaseWithAuthor['items']> {
  const items = await listSkillPackageItems(packageId, { includePrivateSkills: true });
  const snapshotItems: SkillPackageReleaseWithAuthor['items'] = [];

  for (const item of items) {
    const release = item.pinnedReleaseId
      ? await getSkillReleaseById(item.pinnedReleaseId)
      : await ensureLatestSkillRelease(item.skill);
    if (!release || release.skillId !== item.skill.id) {
      throw new SkillPackageError(
        400,
        'release_not_found',
        'Pinned release does not belong to this skill',
      );
    }
    snapshotItems.push({
      skillId: item.skill.id,
      ownerHandle: item.skill.owner.handle,
      skillSlug: item.skill.slug,
      skillName: item.skill.name,
      skillDescription: item.skill.description,
      protocolName: item.protocolName,
      position: item.position,
      note: item.note,
      skillReleaseId: release.id,
      skillVersion: release.version,
      files: release.snapshotFiles,
    });
  }

  return snapshotItems.sort(
    (a, b) => a.position - b.position || a.skillName.localeCompare(b.skillName, 'zh-CN'),
  );
}

export async function listSkillPackageReleases(
  packageId: string,
): Promise<SkillPackageReleaseWithAuthor[]> {
  const rows = await listPublishableReleases(packageId);
  return rows.flatMap((row) => {
    const mapped = mapPackageReleaseRow(row);
    return mapped ? [mapped] : [];
  });
}

export async function getSkillPackageReleaseByVersion(packageId: string, version: number) {
  const releases = await listSkillPackageReleases(packageId);
  return releases.find((release) => release.version === version) ?? null;
}

export async function getLatestSkillPackageRelease(packageId: string) {
  const releases = await listSkillPackageReleases(packageId);
  return releases[0] ?? null;
}

export async function createSkillPackageRelease(input: {
  packageId: string;
  createdByUserId: string;
  title: string;
  changelog: string;
}): Promise<SkillPackageReleaseWithAuthor> {
  const items = await buildPackageReleaseItems(input.packageId);
  const release = await createPublishableRelease({
    publishableId: input.packageId,
    createdByUserId: input.createdByUserId,
    title: input.title,
    changelog: input.changelog,
    snapshot: { kind: 'package', items },
  });
  const authorRows = await db
    .select(ownerSelect)
    .from(user)
    .where(eq(user.id, input.createdByUserId))
    .limit(1);
  const author = authorRows[0];
  if (!author) throw new Error('createSkillPackageRelease: author not found');
  if (release.snapshot.kind !== 'package') {
    throw new Error('createSkillPackageRelease: unexpected snapshot kind');
  }
  return {
    id: release.id,
    packageId: release.publishableId,
    version: release.version,
    title: release.title,
    changelog: release.changelog,
    items: release.snapshot.items,
    createdByUserId: release.createdByUserId,
    createdAt: release.createdAt,
    author,
  };
}

export async function listSkillPackageComments(
  packageId: string,
): Promise<SkillPackageCommentWithAuthor[]> {
  const rows = await listPublishableComments(packageId);
  return rows.map((row) => ({ ...row, packageId: row.publishableId }));
}

export async function createSkillPackageComment(input: {
  packageId: string;
  userId: string;
  content: string;
  parentId?: string | null;
}): Promise<SkillPackageCommentWithAuthor> {
  const comment = await createPublishableComment({
    publishableId: input.packageId,
    userId: input.userId,
    content: input.content,
    parentId: input.parentId ?? null,
  });
  return { ...comment, packageId: comment.publishableId };
}

export async function addSkillPackageUpvote(packageId: string, userId: string): Promise<boolean> {
  return addPublishableUpvote(packageId, userId);
}

export async function removeSkillPackageUpvote(
  packageId: string,
  userId: string,
): Promise<boolean> {
  return removePublishableUpvote(packageId, userId);
}

export async function addSkillPackageBookmark(packageId: string, userId: string): Promise<boolean> {
  return addPublishableBookmark(packageId, userId);
}

export async function removeSkillPackageBookmark(
  packageId: string,
  userId: string,
): Promise<boolean> {
  return removePublishableBookmark(packageId, userId);
}

export async function createSkillPackage(input: CreateSkillPackageData) {
  const uniqueSkillIds = [...new Set(input.skillIds ?? [])];
  for (const skillId of uniqueSkillIds) {
    await assertPackageCanUseSkill({ skillId, packageVisibility: input.visibility });
  }

  const created = await db.transaction(async (tx) => {
    const [publishable] = await tx
      .insert(publishables)
      .values({
        kind: 'package',
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
    if (!publishable) throw new Error('createSkillPackage: publishable insert returned no row');

    const [pkg] = await tx
      .insert(skillPackages)
      .values({
        id: publishable.id,
      })
      .returning();
    if (!pkg) throw new Error('createSkillPackage: insert returned no row');

    for (let position = 0; position < uniqueSkillIds.length; position += 1) {
      const skillId = uniqueSkillIds[position];
      if (!skillId) continue;
      await tx.insert(skillPackageItems).values({
        packageId: pkg.id,
        skillId,
        position,
      });
    }
    return { ...publishable, ...pkg };
  });

  if (input.initialRelease) {
    await createSkillPackageRelease({
      packageId: created.id,
      createdByUserId: input.initialRelease.createdByUserId,
      title: input.initialRelease.title,
      changelog: input.initialRelease.changelog,
    });
  }

  return created;
}

export async function updateSkillPackage(packageId: string, input: UpdateSkillPackageData) {
  if (input.visibility === 'public') await assertPackageCanBecomePublic(packageId);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.coverImage !== undefined) patch.coverImage = input.coverImage;

  const [updated] = await db
    .update(publishables)
    .set(patch)
    .where(and(eq(publishables.id, packageId), eq(publishables.kind, 'package')))
    .returning();
  return updated ?? null;
}

export async function deleteSkillPackage(packageId: string) {
  const deleted = await db
    .delete(publishables)
    .where(and(eq(publishables.id, packageId), eq(publishables.kind, 'package')))
    .returning({ id: publishables.id });
  return deleted.length > 0;
}

export async function addSkillPackageItem(input: {
  packageId: string;
  skillId: string;
  packageVisibility: 'public' | 'private';
  position?: number;
  note?: string | null;
  pinnedReleaseId?: string | null;
}) {
  await assertPackageCanUseSkill({
    skillId: input.skillId,
    packageVisibility: input.packageVisibility,
    pinnedReleaseId: input.pinnedReleaseId,
  });

  const existing = await db
    .select({ id: skillPackageItems.id })
    .from(skillPackageItems)
    .where(
      and(
        eq(skillPackageItems.packageId, input.packageId),
        eq(skillPackageItems.skillId, input.skillId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    throw new SkillPackageError(409, 'package_item_exists', 'Skill already exists in package');
  }

  const [maxRow] = await db
    .select({ latest: max(skillPackageItems.position) })
    .from(skillPackageItems)
    .where(eq(skillPackageItems.packageId, input.packageId));
  const position = input.position ?? Number(maxRow?.latest ?? -1) + 1;

  const [item] = await db
    .insert(skillPackageItems)
    .values({
      packageId: input.packageId,
      skillId: input.skillId,
      position,
      note: input.note ?? null,
      pinnedReleaseId: input.pinnedReleaseId ?? null,
    })
    .returning();
  await db
    .update(publishables)
    .set({ updatedAt: new Date() })
    .where(eq(publishables.id, input.packageId));
  return item;
}

export async function updateSkillPackageItem(
  packageId: string,
  itemId: string,
  input: { position?: number; note?: string | null; pinnedReleaseId?: string | null },
) {
  const existingRows = await db
    .select()
    .from(skillPackageItems)
    .where(and(eq(skillPackageItems.id, itemId), eq(skillPackageItems.packageId, packageId)))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) return null;

  if (input.pinnedReleaseId !== undefined && input.pinnedReleaseId !== null) {
    await assertPackageCanUseSkill({
      skillId: existing.skillId,
      packageVisibility: 'private',
      pinnedReleaseId: input.pinnedReleaseId,
    });
  }

  const patch: Record<string, unknown> = {};
  if (input.position !== undefined) patch.position = input.position;
  if (input.note !== undefined) patch.note = input.note;
  if (input.pinnedReleaseId !== undefined) patch.pinnedReleaseId = input.pinnedReleaseId;
  if (Object.keys(patch).length === 0) return existing;

  const [updated] = await db
    .update(skillPackageItems)
    .set(patch)
    .where(and(eq(skillPackageItems.id, itemId), eq(skillPackageItems.packageId, packageId)))
    .returning();
  await db
    .update(publishables)
    .set({ updatedAt: new Date() })
    .where(eq(publishables.id, packageId));
  return updated ?? null;
}

export async function deleteSkillPackageItem(packageId: string, itemId: string) {
  const deleted = await db
    .delete(skillPackageItems)
    .where(and(eq(skillPackageItems.id, itemId), eq(skillPackageItems.packageId, packageId)))
    .returning({ id: skillPackageItems.id });
  if (deleted.length > 0) {
    await db
      .update(publishables)
      .set({ updatedAt: new Date() })
      .where(eq(publishables.id, packageId));
  }
  return deleted.length > 0;
}

export async function listPublicPackageSkillEntries(ownerHandle: string, slug: string) {
  const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
    viewerUserId: null,
    includePrivate: false,
  });
  if (!pkg || pkg.visibility !== 'public') return null;
  return listSkillPackageItems(pkg.id);
}

export async function listPublicPackageReleaseSkillEntries(
  ownerHandle: string,
  slug: string,
  version: number,
) {
  const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
    viewerUserId: null,
    includePrivate: false,
  });
  if (!pkg || pkg.visibility !== 'public') return null;
  const release = await getSkillPackageReleaseByVersion(pkg.id, version);
  if (!release) return null;
  return release.items
    .map((item) => ({
      ...item,
      files: item.files.map((file) => file.path),
    }))
    .filter((item) => item.files.some((file) => file === 'SKILL.md'));
}

export async function getPublicPackageSkillFile(input: {
  ownerHandle: string;
  packageSlug: string;
  protocolName: string;
  path: string;
}) {
  const items = await listPublicPackageSkillEntries(input.ownerHandle, input.packageSlug);
  if (!items) return null;
  const item = items.find((entry) => entry.protocolName === input.protocolName);
  if (!item) return null;
  const content = await getPackageItemFileContent({
    skillId: item.skillId,
    pinnedReleaseId: item.pinnedReleaseId,
    path: input.path,
  });
  if (content === null) return null;
  return {
    skillId: item.skillId,
    file: content,
  };
}

export async function getPublicPackageReleaseSkillFile(input: {
  ownerHandle: string;
  packageSlug: string;
  version: number;
  protocolName: string;
  path: string;
}) {
  const pkg = await findSkillPackageByOwnerAndSlug(input.ownerHandle, input.packageSlug, {
    viewerUserId: null,
    includePrivate: false,
  });
  if (!pkg || pkg.visibility !== 'public') return null;
  const release = await getSkillPackageReleaseByVersion(pkg.id, input.version);
  if (!release) return null;
  const item = release.items.find((entry) => entry.protocolName === input.protocolName);
  if (!item) return null;
  const file = item.files.find((entry) => entry.path === input.path);
  if (!file) return null;
  return {
    skillId: item.skillId,
    file: normalizeSkillFileEntry(file),
  };
}
