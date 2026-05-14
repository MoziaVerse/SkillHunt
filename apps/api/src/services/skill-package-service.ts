import { and, asc, desc, eq, max, or, sql } from 'drizzle-orm';
import {
  db,
  skillFiles,
  skillPackageComments,
  skillPackageItems,
  skillPackageUpvotes,
  skillPackages,
  skillReleases,
  skills,
  user,
  userPackageBookmarks,
} from '../db';
import { skillProtocolName } from '../lib/protocol-name';
import type { OwnerInfo, SkillWithOwner } from './skill-service';

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
  upvoteCount: sql<number>`0`,
  commentCount: sql<number>`0`,
  bookmarkCount: sql<number>`0`,
  viewerHasUpvoted: sql<number>`0`,
  viewerHasBookmarked: sql<number>`0`,
});

const packageSelectExtras = (viewerUserId: string | null) => ({
  upvoteCount: sql<number>`(
    select count(*) from ${skillPackageUpvotes}
    where ${skillPackageUpvotes.packageId} = ${skillPackages.id}
  )`,
  commentCount: sql<number>`(
    select count(*) from ${skillPackageComments}
    where ${skillPackageComments.packageId} = ${skillPackages.id}
  )`,
  bookmarkCount: sql<number>`(
    select count(*) from ${userPackageBookmarks}
    where ${userPackageBookmarks.packageId} = ${skillPackages.id}
  )`,
  viewerHasUpvoted: viewerUserId
    ? sql<number>`exists(
        select 1 from ${skillPackageUpvotes}
        where ${skillPackageUpvotes.packageId} = ${skillPackages.id}
          and ${skillPackageUpvotes.userId} = ${viewerUserId}
      )`
    : sql<number>`0`,
  viewerHasBookmarked: viewerUserId
    ? sql<number>`exists(
        select 1 from ${userPackageBookmarks}
        where ${userPackageBookmarks.packageId} = ${skillPackages.id}
          and ${userPackageBookmarks.userId} = ${viewerUserId}
      )`
    : sql<number>`0`,
});

function mapPackageRow<
  T extends {
    package: typeof skillPackages.$inferSelect;
    owner: OwnerInfo;
    skillCount: number;
    upvoteCount: number;
    commentCount: number;
    bookmarkCount: number;
    viewerHasUpvoted: number | boolean;
    viewerHasBookmarked: number | boolean;
  },
>(row: T): SkillPackageWithOwner {
  return {
    ...row.package,
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

function canReadPackage(pkg: typeof skillPackages.$inferSelect, opts: ListSkillPackagesOptions) {
  if (pkg.visibility === 'public') return true;
  return Boolean(opts.viewerUserId && opts.includePrivate && pkg.ownerUserId === opts.viewerUserId);
}

async function listFilesForPackageItem(skillId: string, pinnedReleaseId: string | null) {
  if (pinnedReleaseId) {
    const rows = await db
      .select({ snapshotFiles: skillReleases.snapshotFiles })
      .from(skillReleases)
      .where(and(eq(skillReleases.id, pinnedReleaseId), eq(skillReleases.skillId, skillId)))
      .limit(1);
    return rows[0]?.snapshotFiles.map((file) => file.path) ?? [];
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
}) {
  if (input.pinnedReleaseId) {
    const rows = await db
      .select({ snapshotFiles: skillReleases.snapshotFiles })
      .from(skillReleases)
      .where(
        and(eq(skillReleases.id, input.pinnedReleaseId), eq(skillReleases.skillId, input.skillId)),
      )
      .limit(1);
    const release = rows[0];
    return release?.snapshotFiles.find((file) => file.path === input.path)?.content ?? null;
  }

  const rows = await db
    .select({ content: skillFiles.content })
    .from(skillFiles)
    .where(and(eq(skillFiles.skillId, input.skillId), eq(skillFiles.path, input.path)))
    .limit(1);
  return rows[0]?.content ?? null;
}

async function assertPackageCanUseSkill(input: {
  skillId: string;
  packageVisibility: 'public' | 'private';
  pinnedReleaseId?: string | null;
}) {
  const rows = await db.select().from(skills).where(eq(skills.id, input.skillId)).limit(1);
  const skill = rows[0];
  if (!skill) throw new SkillPackageError(404, 'skill_not_found', 'Skill not found');
  if (skill.type !== 'owned') {
    throw new SkillPackageError(
      400,
      'unsupported_skill_type',
      'Skill packages only support owned skills',
    );
  }
  if (input.packageVisibility === 'public' && skill.visibility !== 'public') {
    throw new SkillPackageError(
      400,
      'private_skill_in_public_package',
      'Public packages can only include public skills',
    );
  }
  if (input.pinnedReleaseId) {
    const releases = await db
      .select({ id: skillReleases.id })
      .from(skillReleases)
      .where(and(eq(skillReleases.id, input.pinnedReleaseId), eq(skillReleases.skillId, skill.id)))
      .limit(1);
    if (!releases[0]) {
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
    .select({ skill: skills })
    .from(skillPackageItems)
    .innerJoin(skills, eq(skillPackageItems.skillId, skills.id))
    .where(eq(skillPackageItems.packageId, packageId));
  const invalid = rows.find(
    (row) => row.skill.type !== 'owned' || row.skill.visibility !== 'public',
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
      ? and(
          eq(skillPackages.visibility, 'private'),
          eq(skillPackages.ownerUserId, opts.viewerUserId),
        )
      : undefined;
  const visibilityCond = or(
    eq(skillPackages.visibility, 'public'),
    ...(ownPrivate ? [ownPrivate] : []),
  );
  if (visibilityCond) conditions.push(visibilityCond);

  if (opts.q) {
    const pattern = `%${opts.q}%`;
    const cond = or(
      sql`lower(${skillPackages.name}) like lower(${pattern})`,
      sql`lower(${skillPackages.description}) like lower(${pattern})`,
      sql`lower(${user.name}) like lower(${pattern})`,
      sql`lower(${user.handle}) like lower(${pattern})`,
    );
    if (cond) conditions.push(cond);
  }

  if (opts.tags.length > 0) {
    conditions.push(
      sql`exists (select 1 from json_each(${skillPackages.tags}) where json_each.value in (${sql.join(
        opts.tags.map((tag) => sql`${tag}`),
        sql`, `,
      )}))`,
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const orderBy =
    opts.sort === 'az'
      ? sql`${skillPackages.name} ASC`
      : opts.sort === 'hottest'
        ? sql`(
            select count(*) from ${skillPackageUpvotes}
            where ${skillPackageUpvotes.packageId} = ${skillPackages.id}
          ) * 3 + (
            select count(*) from ${skillPackageComments}
            where ${skillPackageComments.packageId} = ${skillPackages.id}
          ) * 2 + (
            select count(*) from ${userPackageBookmarks}
            where ${userPackageBookmarks.packageId} = ${skillPackages.id}
          ) DESC`
        : sql`${skillPackages.updatedAt} DESC`;
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
      .innerJoin(user, eq(skillPackages.ownerUserId, user.id))
      .where(where),
    db
      .select({
        package: skillPackages,
        owner: ownerSelect,
        skillCount,
        ...packageSelectExtras(opts.viewerUserId),
      })
      .from(skillPackages)
      .innerJoin(user, eq(skillPackages.ownerUserId, user.id))
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
      ? and(
          eq(skillPackages.visibility, 'private'),
          eq(skillPackages.ownerUserId, opts.viewerUserId),
        )
      : undefined;
  const visibilityCond = or(
    eq(skillPackages.visibility, 'public'),
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
      .innerJoin(user, eq(skillPackages.ownerUserId, user.id))
      .where(where),
    db
      .select({
        package: skillPackages,
        owner: ownerSelect,
        skillCount,
        ...packageSelectExtras(opts.viewerUserId ?? null),
      })
      .from(skillPackageItems)
      .innerJoin(skillPackages, eq(skillPackageItems.packageId, skillPackages.id))
      .innerJoin(user, eq(skillPackages.ownerUserId, user.id))
      .where(where)
      .orderBy(desc(skillPackages.updatedAt)),
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
  const visibilityCond = canSeeOwnPrivate ? undefined : eq(skillPackages.visibility, 'public');
  const where = visibilityCond
    ? and(eq(skillPackages.ownerUserId, ownerUserId), visibilityCond)
    : eq(skillPackages.ownerUserId, ownerUserId);
  const skillCount = sql<number>`(
    select count(*) from ${skillPackageItems}
    where ${skillPackageItems.packageId} = ${skillPackages.id}
  )`;

  const [countRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(skillPackages)
      .innerJoin(user, eq(skillPackages.ownerUserId, user.id))
      .where(where),
    db
      .select({
        package: skillPackages,
        owner: ownerSelect,
        skillCount,
        ...packageSelectExtras(opts.viewerUserId ?? null),
      })
      .from(skillPackages)
      .innerJoin(user, eq(skillPackages.ownerUserId, user.id))
      .where(where)
      .orderBy(desc(skillPackages.updatedAt)),
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
      owner: ownerSelect,
      skillCount,
      ...packageSelectExtras(opts.viewerUserId ?? null),
    })
    .from(skillPackages)
    .innerJoin(user, eq(skillPackages.ownerUserId, user.id))
    .where(and(eq(user.handle, ownerHandle), eq(skillPackages.slug, slug)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (
    !canReadPackage(row.package, {
      tags: [],
      viewerUserId: opts.viewerUserId ?? null,
      includePrivate: opts.includePrivate,
    })
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
      owner: ownerSelect,
      skillCount,
      ...packageSelectExtras(viewerUserId),
    })
    .from(skillPackages)
    .innerJoin(user, eq(skillPackages.ownerUserId, user.id))
    .where(eq(skillPackages.id, packageId))
    .limit(1);
  return rows[0] ? mapPackageRow(rows[0]) : null;
}

export async function listSkillPackageItems(
  packageId: string,
  opts: { includePrivateSkills?: boolean } = {},
): Promise<SkillPackageItemWithSkill[]> {
  const conditions = [eq(skillPackageItems.packageId, packageId), eq(skills.type, 'owned')];
  if (!opts.includePrivateSkills) conditions.push(eq(skills.visibility, 'public'));

  const rows = await db
    .select({
      item: skillPackageItems,
      skill: skills,
      owner: ownerSelect,
      ...skillSelectExtras(),
    })
    .from(skillPackageItems)
    .innerJoin(skills, eq(skillPackageItems.skillId, skills.id))
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(and(...conditions))
    .orderBy(asc(skillPackageItems.position), asc(skills.name));

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

export async function listSkillPackageComments(
  packageId: string,
): Promise<SkillPackageCommentWithAuthor[]> {
  const rows = await db
    .select({ comment: skillPackageComments, author: ownerSelect })
    .from(skillPackageComments)
    .innerJoin(user, eq(skillPackageComments.userId, user.id))
    .where(eq(skillPackageComments.packageId, packageId))
    .orderBy(desc(skillPackageComments.createdAt));

  return rows.map((row) => ({ ...row.comment, author: row.author }));
}

export async function createSkillPackageComment(input: {
  packageId: string;
  userId: string;
  content: string;
  parentId?: string | null;
}): Promise<SkillPackageCommentWithAuthor> {
  return db.transaction(async (tx) => {
    const [comment] = await tx
      .insert(skillPackageComments)
      .values({
        packageId: input.packageId,
        userId: input.userId,
        content: input.content,
        parentId: input.parentId ?? null,
      })
      .returning();
    if (!comment) throw new Error('createSkillPackageComment: insert returned no row');

    const [author] = await tx
      .select(ownerSelect)
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);
    if (!author) throw new Error('createSkillPackageComment: author disappeared mid-tx');

    return { ...comment, author };
  });
}

export async function addSkillPackageUpvote(packageId: string, userId: string): Promise<boolean> {
  const existing = await db
    .select({ id: skillPackageUpvotes.id })
    .from(skillPackageUpvotes)
    .where(
      and(eq(skillPackageUpvotes.packageId, packageId), eq(skillPackageUpvotes.userId, userId)),
    )
    .limit(1);
  if (existing[0]) return false;

  await db.insert(skillPackageUpvotes).values({ packageId, userId });
  return true;
}

export async function removeSkillPackageUpvote(
  packageId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .delete(skillPackageUpvotes)
    .where(
      and(eq(skillPackageUpvotes.packageId, packageId), eq(skillPackageUpvotes.userId, userId)),
    )
    .returning({ id: skillPackageUpvotes.id });
  return rows.length > 0;
}

export async function addSkillPackageBookmark(packageId: string, userId: string): Promise<boolean> {
  const existing = await db
    .select({ id: userPackageBookmarks.id })
    .from(userPackageBookmarks)
    .where(
      and(eq(userPackageBookmarks.packageId, packageId), eq(userPackageBookmarks.userId, userId)),
    )
    .limit(1);
  if (existing[0]) return false;

  await db.insert(userPackageBookmarks).values({ packageId, userId });
  return true;
}

export async function removeSkillPackageBookmark(
  packageId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .delete(userPackageBookmarks)
    .where(
      and(eq(userPackageBookmarks.packageId, packageId), eq(userPackageBookmarks.userId, userId)),
    )
    .returning({ id: userPackageBookmarks.id });
  return rows.length > 0;
}

export async function createSkillPackage(input: CreateSkillPackageData) {
  const uniqueSkillIds = [...new Set(input.skillIds ?? [])];
  for (const skillId of uniqueSkillIds) {
    await assertPackageCanUseSkill({ skillId, packageVisibility: input.visibility });
  }

  return db.transaction(async (tx) => {
    const [pkg] = await tx
      .insert(skillPackages)
      .values({
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
    return pkg;
  });
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
    .update(skillPackages)
    .set(patch)
    .where(eq(skillPackages.id, packageId))
    .returning();
  return updated ?? null;
}

export async function deleteSkillPackage(packageId: string) {
  const deleted = await db
    .delete(skillPackages)
    .where(eq(skillPackages.id, packageId))
    .returning({ id: skillPackages.id });
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
    .update(skillPackages)
    .set({ updatedAt: new Date() })
    .where(eq(skillPackages.id, input.packageId));
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
    .update(skillPackages)
    .set({ updatedAt: new Date() })
    .where(eq(skillPackages.id, packageId));
  return updated ?? null;
}

export async function deleteSkillPackageItem(packageId: string, itemId: string) {
  const deleted = await db
    .delete(skillPackageItems)
    .where(and(eq(skillPackageItems.id, itemId), eq(skillPackageItems.packageId, packageId)))
    .returning({ id: skillPackageItems.id });
  if (deleted.length > 0) {
    await db
      .update(skillPackages)
      .set({ updatedAt: new Date() })
      .where(eq(skillPackages.id, packageId));
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
    content,
  };
}
