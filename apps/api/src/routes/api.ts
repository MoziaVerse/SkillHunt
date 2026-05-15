import { createHash } from 'node:crypto';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { type AuthContext, getAuthContext, hasScope } from '../lib/auth-context';
import { mimeFromPath } from '../lib/content-type';
import {
  type SkillComment,
  type SkillDetail,
  type SkillListItem,
  completeVideoUploadSchema,
  createReleaseSchema,
  createSkillCommentSchema,
  createSkillPackageItemSchema,
  createSkillPackageSchema,
  createSkillSchema,
  createVideoUploadSchema,
  filePathSchema,
  forkSkillSchema,
  listPackagesQuerySchema,
  listPublishablesQuerySchema,
  listSkillsQuerySchema,
  mintInstallTokenSchema,
  syncUpstreamSchema,
  updateAvatarSchema,
  updateProfileSchema,
  updateSkillPackageItemSchema,
  updateSkillPackageSchema,
  updateSkillSchema,
  updateSubscriptionSchema,
  upsertFileBodySchema,
} from '../lib/dto';
import { skillProtocolName } from '../lib/protocol-name';
import { mintGrant } from '../services/install-grant-service';
import {
  completeUploadedVideo,
  createDemoVideoPlaybackUrl,
  createVideoUploadTicket,
  isS3StorageConfigured,
  isVideoObjectKeyForUser,
} from '../services/s3-storage';
import {
  type SkillPackageDetail as SkillPackageDetailRow,
  SkillPackageError,
  type SkillPackageWithOwner,
  addSkillPackageBookmark,
  addSkillPackageItem,
  addSkillPackageUpvote,
  createSkillPackage,
  createSkillPackageComment,
  createSkillPackageRelease,
  deleteSkillPackage,
  deleteSkillPackageItem,
  findSkillPackageById,
  findSkillPackageByOwnerAndSlug,
  getSkillPackageDetail,
  listSkillPackageComments,
  listSkillPackageReleases,
  listSkillPackagesByOwner,
  listSkillPackagesContainingSkill,
  listSkillPackagesForApi,
  removeSkillPackageBookmark,
  removeSkillPackageUpvote,
  updateSkillPackage,
  updateSkillPackageItem,
} from '../services/skill-package-service';
import {
  type SkillWithOwner,
  addSkillBookmark,
  addSkillUpvote,
  canMintSkillInstallGrant,
  canReadSkill,
  canReadSkillFiles,
  createOwnedSkill,
  createSkillComment,
  createSkillRelease,
  deleteSkill,
  deleteSkillFile,
  findSkillById,
  findSkillByOwnerAndSlug,
  findUserByHandle,
  findUserById,
  forkSkillToOwner,
  getSkillFileContent,
  getSkillSubscription,
  getUnreadNotificationCount,
  getUpstreamStatus,
  listAllTags,
  listNotifications,
  listPublicSkillsByOwner,
  listSkillComments,
  listSkillFilesWithContent,
  listSkillReleases,
  listSkillsByOwner,
  listSkillsForApi,
  listSyncEvents,
  listUserBookmarks,
  markAllNotificationsRead,
  markNotificationRead,
  removeSkillBookmark,
  removeSkillUpvote,
  setSkillSubscription,
  syncForkWithUpstream,
  updateOwnedSkill,
  updateUserProfile,
  upsertSkillFile,
} from '../services/skill-service';

export const apiRoute = new Hono();

const skillAccessActor = (ctx: AuthContext) => ({
  userId: ctx.user?.id ?? null,
  scopes: ctx.scopes,
});

const viewerUserId = (ctx: AuthContext) => ctx.user?.id ?? null;
const canIncludePrivateSkills = (ctx: AuthContext) => hasScope(ctx, 'skills:read_private');

function hashFiles(files: Array<{ path: string; content: string }>): string {
  const hash = createHash('sha256');
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(file.path);
    hash.update('\0');
    hash.update(file.content);
    hash.update('\0');
  }
  return hash.digest('hex');
}

const baseFromRow = (r: SkillWithOwner) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description,
  tags: r.tags,
  icon: r.icon ?? null,
  coverImage: r.coverImage ?? null,
  demoVideoUrl: r.demoVideoUrl ?? null,
  owner: r.owner,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  upvoteCount: r.upvoteCount,
  commentCount: r.commentCount,
  bookmarkCount: r.bookmarkCount,
  viewerHasUpvoted: r.viewerHasUpvoted,
  viewerHasBookmarked: r.viewerHasBookmarked,
});

const toComment = (
  comment: Awaited<ReturnType<typeof listSkillComments>>[number],
): SkillComment => ({
  id: comment.id,
  skillId: comment.skillId,
  parentId: comment.parentId,
  content: comment.content,
  createdAt: comment.createdAt.toISOString(),
  updatedAt: comment.updatedAt.toISOString(),
  author: comment.author,
});

const toListItem = (r: SkillWithOwner): SkillListItem => {
  const base = baseFromRow(r);
  if (r.type === 'owned') {
    return { ...base, type: 'owned' as const, visibility: r.visibility };
  }
  return {
    ...base,
    type: 'referenced' as const,
    sourceRepo: r.sourceRepo ?? '',
    sourceSkillName: r.sourceSkillName ?? '',
  };
};

const toDetail = async (
  origin: string,
  skill: SkillWithOwner,
): Promise<SkillDetail | { error: string }> => {
  const base = baseFromRow(skill);
  if (skill.type === 'owned') {
    const files = await listSkillFilesWithContent(skill.id);
    const skillMd = files.find((f) => f.path === 'SKILL.md');
    if (!skillMd) return { error: 'Skill data corrupted' };
    const installCommand = `npx skills add ${origin} --skill ${skillProtocolName(skill.owner.handle, skill.slug)}`;
    return {
      ...base,
      type: 'owned',
      visibility: skill.visibility,
      skillMdContent: skillMd.content,
      files: files.map((f) => f.path),
      installCommand,
    };
  }
  return {
    ...base,
    type: 'referenced',
    sourceRepo: skill.sourceRepo ?? '',
    sourceSkillName: skill.sourceSkillName ?? '',
    sourceInstallCommand: skill.sourceInstallCommand ?? '',
    sourceUrl: skill.sourceUrl,
  };
};

const toReleaseDto = (release: Awaited<ReturnType<typeof listSkillReleases>>[number]) => ({
  id: release.id,
  skillId: release.skillId,
  version: release.version,
  title: release.title,
  changelog: release.changelog,
  files: release.snapshotFiles.map((file) => file.path),
  createdBy: release.author,
  createdAt: release.createdAt.toISOString(),
});

const toRawReleaseDto = (release: {
  id: string;
  skillId: string;
  version: number;
  title: string;
  changelog: string;
  snapshotFiles: Array<{ path: string; content: string }>;
  createdByUserId: string;
  createdAt: Date;
}) => ({
  id: release.id,
  skillId: release.skillId,
  version: release.version,
  title: release.title,
  changelog: release.changelog,
  files: release.snapshotFiles.map((file) => file.path),
  createdByUserId: release.createdByUserId,
  createdAt: release.createdAt.toISOString(),
});

function packageInstallCommand(origin: string, pkg: SkillPackageWithOwner) {
  return `npx skills add ${origin}/p/${pkg.owner.handle}/${pkg.slug} --skill '*' -y`;
}

const toPackageListItem = (origin: string, pkg: SkillPackageWithOwner) => ({
  id: pkg.id,
  slug: pkg.slug,
  name: pkg.name,
  description: pkg.description,
  visibility: pkg.visibility,
  tags: pkg.tags,
  icon: pkg.icon,
  coverImage: pkg.coverImage,
  owner: pkg.owner,
  skillCount: pkg.skillCount,
  upvoteCount: pkg.upvoteCount,
  commentCount: pkg.commentCount,
  bookmarkCount: pkg.bookmarkCount,
  viewerHasUpvoted: pkg.viewerHasUpvoted,
  viewerHasBookmarked: pkg.viewerHasBookmarked,
  installCommand: packageInstallCommand(origin, pkg),
  createdAt: pkg.createdAt.toISOString(),
  updatedAt: pkg.updatedAt.toISOString(),
});

const toPackageDetail = (origin: string, pkg: SkillPackageDetailRow) => ({
  ...toPackageListItem(origin, pkg),
  skills: pkg.skills.map((item) => ({
    itemId: item.id,
    position: item.position,
    note: item.note,
    pinnedReleaseId: item.pinnedReleaseId,
    protocolName: item.protocolName,
    files: item.files,
    skill: toListItem(item.skill),
  })),
});

const packageErrorResponse = (c: import('hono').Context, error: unknown) => {
  if (error instanceof SkillPackageError) {
    return c.json({ error: error.message, code: error.code }, error.status as 400 | 404 | 409);
  }
  throw error;
};

const toPackageComment = (
  comment: Awaited<ReturnType<typeof listSkillPackageComments>>[number],
) => ({
  id: comment.id,
  packageId: comment.packageId,
  parentId: comment.parentId,
  content: comment.content,
  createdAt: comment.createdAt.toISOString(),
  updatedAt: comment.updatedAt.toISOString(),
  author: comment.author,
});

const toPackageReleaseDto = (
  origin: string,
  pkg: SkillPackageWithOwner,
  release: Awaited<ReturnType<typeof listSkillPackageReleases>>[number],
) => ({
  id: release.id,
  packageId: release.packageId,
  publishableId: release.packageId,
  kind: 'package' as const,
  version: release.version,
  title: release.title,
  changelog: release.changelog,
  installCommand: `npx skills add ${origin}/p/${pkg.owner.handle}/${pkg.slug}/v/${release.version} --skill '*' -y`,
  files: release.items.flatMap((item) =>
    item.files.map((file) => `${item.protocolName}/${file.path}`),
  ),
  skills: release.items.map((item) => ({
    skillId: item.skillId,
    ownerHandle: item.ownerHandle,
    skillSlug: item.skillSlug,
    skillName: item.skillName,
    skillDescription: item.skillDescription,
    protocolName: item.protocolName,
    position: item.position,
    note: item.note,
    skillReleaseId: item.skillReleaseId,
    skillVersion: item.skillVersion,
    files: item.files.map((file) => file.path),
  })),
  createdBy: release.author,
  createdByUserId: release.createdByUserId,
  createdAt: release.createdAt.toISOString(),
});

type PublishableApiItem =
  | { kind: 'skill'; item: ReturnType<typeof toListItem>; updatedAt: string; score: number }
  | {
      kind: 'package';
      item: ReturnType<typeof toPackageListItem>;
      updatedAt: string;
      score: number;
    };
type PublicUserRow = NonNullable<Awaited<ReturnType<typeof findUserByHandle>>>;

function sortPublishableApiItems(items: PublishableApiItem[], sort: 'recent' | 'hottest' | 'az') {
  return [...items].sort((a, b) => {
    if (sort === 'az') return a.item.name.localeCompare(b.item.name, 'zh-Hans-CN');
    if (sort === 'hottest') {
      const scoreDelta = b.score - a.score;
      if (scoreDelta !== 0) return scoreDelta;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

async function listPublishablesResponse(
  c: import('hono').Context,
  opts: {
    kind: 'all' | 'skill' | 'package';
    q?: string;
    tag: string[];
    sort: 'recent' | 'hottest' | 'az';
    limit: number;
    offset: number;
  },
) {
  const auth = await getAuthContext(c);
  const origin = new URL(c.req.url).origin;
  const fetchLimit = opts.kind === 'all' ? opts.limit + opts.offset : opts.limit;
  const fetchOffset = opts.kind === 'all' ? 0 : opts.offset;
  const [skillsRes, packagesRes] = await Promise.all([
    opts.kind !== 'package'
      ? listSkillsForApi({
          type: 'all',
          q: opts.q,
          tags: opts.tag,
          viewerUserId: viewerUserId(auth),
          includePrivate: canIncludePrivateSkills(auth),
          sort: opts.sort,
          limit: fetchLimit,
          offset: fetchOffset,
        })
      : Promise.resolve({ items: [], total: 0 }),
    opts.kind !== 'skill'
      ? listSkillPackagesForApi({
          q: opts.q,
          tags: opts.tag,
          sort: opts.sort,
          limit: fetchLimit,
          offset: fetchOffset,
          viewerUserId: viewerUserId(auth),
          includePrivate: canIncludePrivateSkills(auth),
        })
      : Promise.resolve({ items: [], total: 0 }),
  ]);

  const items = sortPublishableApiItems(
    [
      ...skillsRes.items.map(
        (skill): PublishableApiItem => ({
          kind: 'skill',
          item: toListItem(skill),
          updatedAt: skill.updatedAt.toISOString(),
          score: skill.upvoteCount * 3 + skill.commentCount * 2 + skill.bookmarkCount,
        }),
      ),
      ...packagesRes.items.map(
        (pkg): PublishableApiItem => ({
          kind: 'package',
          item: toPackageListItem(origin, pkg),
          updatedAt: pkg.updatedAt.toISOString(),
          score: pkg.upvoteCount * 3 + pkg.commentCount * 2 + pkg.bookmarkCount,
        }),
      ),
    ],
    opts.sort,
  );
  const sliced = opts.kind === 'all' ? items.slice(opts.offset, opts.offset + opts.limit) : items;
  return c.json({ items: sliced, total: skillsRes.total + packagesRes.total });
}

async function listOwnerPublishablesResponse(
  c: import('hono').Context,
  ownerRow: PublicUserRow,
  opts: {
    kind: 'all' | 'skill' | 'package';
    sort: 'recent' | 'hottest' | 'az';
    includePrivate: boolean;
    viewerUserId: string | null;
  },
) {
  const origin = new URL(c.req.url).origin;
  const [skillsRows, packageRows] = await Promise.all([
    opts.kind !== 'package'
      ? opts.includePrivate
        ? listSkillsByOwner(ownerRow.handle)
        : listPublicSkillsByOwner(ownerRow.handle)
      : Promise.resolve([]),
    opts.kind !== 'skill'
      ? listSkillPackagesByOwner(ownerRow.id, {
          viewerUserId: opts.viewerUserId,
          includePrivate: opts.includePrivate,
        })
      : Promise.resolve({ items: [], total: 0 }),
  ]);
  const items = sortPublishableApiItems(
    [
      ...skillsRows.map(
        (skill): PublishableApiItem => ({
          kind: 'skill',
          item: toListItem(skill),
          updatedAt: skill.updatedAt.toISOString(),
          score: skill.upvoteCount * 3 + skill.commentCount * 2 + skill.bookmarkCount,
        }),
      ),
      ...packageRows.items.map(
        (pkg): PublishableApiItem => ({
          kind: 'package',
          item: toPackageListItem(origin, pkg),
          updatedAt: pkg.updatedAt.toISOString(),
          score: pkg.upvoteCount * 3 + pkg.commentCount * 2 + pkg.bookmarkCount,
        }),
      ),
    ],
    opts.sort,
  );
  return c.json({
    owner: {
      id: ownerRow.id,
      name: ownerRow.name,
      handle: ownerRow.handle,
      image: ownerRow.image,
    },
    items,
    total: items.length,
  });
}

// ─── User-context API: uploads ───────────────────────────────────────

apiRoute.post('/uploads/videos', zValidator('json', createVideoUploadSchema), async (c) => {
  const input = c.req.valid('json');
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'skills:write')) {
    return c.json({ error: 'Missing scope: skills:write' }, 403);
  }
  if (!isS3StorageConfigured()) return c.json({ error: 'OSS storage is not configured' }, 503);

  const ticket = createVideoUploadTicket({
    userId: user.id,
    fileName: input.fileName,
  });
  return c.json(ticket, 201);
});

apiRoute.post(
  '/uploads/videos/complete',
  zValidator('json', completeVideoUploadSchema),
  async (c) => {
    const input = c.req.valid('json');
    const auth = await getAuthContext(c);
    const { user } = auth;
    if (!user) return c.json({ error: 'Authentication required' }, 401);
    if (!hasScope(auth, 'skills:write')) {
      return c.json({ error: 'Missing scope: skills:write' }, 403);
    }
    if (!isS3StorageConfigured()) return c.json({ error: 'OSS storage is not configured' }, 503);
    if (!isVideoObjectKeyForUser(input.objectKey, user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    try {
      const metadata = await completeUploadedVideo(input.objectKey);
      return c.json(metadata);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OSS 对象校验失败';
      return c.json({ error: message }, 400);
    }
  },
);

// ─── Public discovery API ────────────────────────────────────────────

apiRoute.get('/skills', zValidator('query', listSkillsQuerySchema), async (c) => {
  const { type, q, tag, sort, limit, offset } = c.req.valid('query');
  const auth = await getAuthContext(c);
  const { items: rows, total } = await listSkillsForApi({
    type,
    q,
    tags: tag,
    viewerUserId: viewerUserId(auth),
    includePrivate: canIncludePrivateSkills(auth),
    sort,
    limit,
    offset,
  });
  const items = rows.map(toListItem);
  return c.json({ items, total });
});

apiRoute.get('/publishables', zValidator('query', listPublishablesQuerySchema), async (c) => {
  const { kind, q, tag, sort, limit, offset } = c.req.valid('query');
  return listPublishablesResponse(c, { kind, q, tag, sort, limit, offset });
});

apiRoute.get('/tags', async (c) => {
  const tags = await listAllTags();
  return c.json({ tags });
});

// ─── Detail ───────────────────────────────────────────────────────────

// Canonical: /api/skills/:owner/:slug
apiRoute.get('/skills/:owner/:slug', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, viewerUserId(auth));
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  if (!canReadSkill(skill, skillAccessActor(auth))) return c.json({ error: 'Not Found' }, 404);
  const origin = new URL(c.req.url).origin;
  const detail = await toDetail(origin, skill);
  if ('error' in detail) return c.json(detail, 500);
  return c.json(detail);
});

apiRoute.get('/skills/:owner/:slug/demo-video', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, viewerUserId(auth));
  if (!skill || !canReadSkill(skill, skillAccessActor(auth))) {
    return c.json({ error: 'Not Found' }, 404);
  }
  if (!skill.demoVideoUrl) return c.json({ error: 'Not Found' }, 404);

  const playbackUrl = createDemoVideoPlaybackUrl(skill.demoVideoUrl) ?? skill.demoVideoUrl;
  return c.redirect(playbackUrl, 302);
});

apiRoute.get('/skills/:owner/:slug/packages', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, viewerUserId(auth));
  if (!skill || !canReadSkill(skill, skillAccessActor(auth))) {
    return c.json({ error: 'Not Found' }, 404);
  }

  const { items, total } = await listSkillPackagesContainingSkill(skill.id, {
    viewerUserId: viewerUserId(auth),
    includePrivate: canIncludePrivateSkills(auth),
  });
  const origin = new URL(c.req.url).origin;
  return c.json({ items: items.map((item) => toPackageListItem(origin, item)), total });
});

// ─── Mutations: skills ────────────────────────────────────────────────

async function authorizeOwner(ctx: AuthContext, ownerHandle: string) {
  const actor = ctx.user;
  if (!actor)
    return { ok: false as const, status: 401 as const, message: 'Authentication required' };
  if (!hasScope(ctx, 'skills:write')) {
    return { ok: false as const, status: 403 as const, message: 'Missing scope: skills:write' };
  }
  const actorRow = await findUserById(actor.id);
  if (!actorRow)
    return { ok: false as const, status: 401 as const, message: 'Authenticated user not found' };
  const ownerRow = await findUserByHandle(ownerHandle);
  if (!ownerRow) return { ok: false as const, status: 404 as const, message: 'Owner not found' };
  if (actorRow.handle === ownerHandle) return { ok: true as const, ownerRow, actorRow };
  if (actorRow.canPublishAs.includes(ownerHandle)) return { ok: true as const, ownerRow, actorRow };
  return { ok: false as const, status: 403 as const, message: 'Forbidden' };
}

// ─── Mutations + discovery: skill packages ───────────────────────────

apiRoute.get('/packages', zValidator('query', listPackagesQuerySchema), async (c) => {
  const { q, tag, sort, limit, offset } = c.req.valid('query');
  const auth = await getAuthContext(c);
  const { items, total } = await listSkillPackagesForApi({
    q,
    tags: tag,
    sort,
    limit,
    offset,
    viewerUserId: viewerUserId(auth),
    includePrivate: canIncludePrivateSkills(auth),
  });
  const origin = new URL(c.req.url).origin;
  return c.json({ items: items.map((item) => toPackageListItem(origin, item)), total });
});

apiRoute.get('/packages/:owner/:slug', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const pkg = await getSkillPackageDetail(ownerHandle, slug, {
    viewerUserId: viewerUserId(auth),
    includePrivate: canIncludePrivateSkills(auth),
  });
  if (!pkg) return c.json({ error: 'Not Found' }, 404);
  const origin = new URL(c.req.url).origin;
  return c.json(toPackageDetail(origin, pkg));
});

apiRoute.get('/packages/:owner/:slug/releases', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
    viewerUserId: viewerUserId(auth),
    includePrivate: canIncludePrivateSkills(auth),
  });
  if (!pkg) return c.json({ error: 'Not Found' }, 404);
  const releases = await listSkillPackageReleases(pkg.id);
  const origin = new URL(c.req.url).origin;
  return c.json({
    items: releases.map((release) => toPackageReleaseDto(origin, pkg, release)),
    total: releases.length,
  });
});

apiRoute.post(
  '/packages/:owner/:slug/releases',
  zValidator('json', createReleaseSchema),
  async (c) => {
    const ownerHandle = c.req.param('owner');
    const slug = c.req.param('slug');
    const input = c.req.valid('json');
    const authContext = await getAuthContext(c);
    const ownerAuth = await authorizeOwner(authContext, ownerHandle);
    if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

    const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
      viewerUserId: ownerAuth.ownerRow.id,
      includePrivate: true,
    });
    if (!pkg) return c.json({ error: 'Not Found' }, 404);
    if (!input.changelog) return c.json({ error: 'Changelog is required' }, 400);

    try {
      const release = await createSkillPackageRelease({
        packageId: pkg.id,
        createdByUserId: ownerAuth.actorRow.id,
        title: input.title,
        changelog: input.changelog,
      });
      const origin = new URL(c.req.url).origin;
      return c.json(toPackageReleaseDto(origin, pkg, release), 201);
    } catch (error) {
      return packageErrorResponse(c, error);
    }
  },
);

apiRoute.post('/packages', zValidator('json', createSkillPackageSchema), async (c) => {
  const input = c.req.valid('json');
  const authContext = await getAuthContext(c);
  const ownerAuth = await authorizeOwner(authContext, input.owner);
  if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

  const existing = await findSkillPackageByOwnerAndSlug(input.owner, input.slug, {
    viewerUserId: ownerAuth.ownerRow.id,
    includePrivate: true,
  });
  if (existing) return c.json({ error: 'Skill package already exists' }, 409);

  try {
    const created = await createSkillPackage({
      ownerUserId: ownerAuth.ownerRow.id,
      slug: input.slug,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      tags: input.tags,
      icon: input.icon,
      coverImage: input.coverImage,
      skillIds: input.skillIds,
      initialRelease: {
        title: input.releaseTitle ?? '首次发布',
        changelog: input.releaseChangelog ?? '创建 Skills 包初始版本。',
        createdByUserId: ownerAuth.actorRow.id,
      },
    });
    const detail = await getSkillPackageDetail(input.owner, created.slug, {
      viewerUserId: ownerAuth.ownerRow.id,
      includePrivate: true,
    });
    if (!detail) return c.json({ error: 'Not Found' }, 404);
    const origin = new URL(c.req.url).origin;
    return c.json(toPackageDetail(origin, detail), 201);
  } catch (error) {
    return packageErrorResponse(c, error);
  }
});

apiRoute.put('/packages/:owner/:slug', zValidator('json', updateSkillPackageSchema), async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const input = c.req.valid('json');
  const authContext = await getAuthContext(c);
  const ownerAuth = await authorizeOwner(authContext, ownerHandle);
  if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

  const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
    viewerUserId: ownerAuth.ownerRow.id,
    includePrivate: true,
  });
  if (!pkg) return c.json({ error: 'Not Found' }, 404);

  try {
    await updateSkillPackage(pkg.id, input);
    const detail = await getSkillPackageDetail(ownerHandle, slug, {
      viewerUserId: ownerAuth.ownerRow.id,
      includePrivate: true,
    });
    if (!detail) return c.json({ error: 'Not Found' }, 404);
    const origin = new URL(c.req.url).origin;
    return c.json(toPackageDetail(origin, detail));
  } catch (error) {
    return packageErrorResponse(c, error);
  }
});

apiRoute.delete('/packages/:owner/:slug', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const authContext = await getAuthContext(c);
  const ownerAuth = await authorizeOwner(authContext, ownerHandle);
  if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

  const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
    viewerUserId: ownerAuth.ownerRow.id,
    includePrivate: true,
  });
  if (!pkg) return c.json({ error: 'Not Found' }, 404);
  const ok = await deleteSkillPackage(pkg.id);
  return ok ? c.body(null, 204) : c.json({ error: 'Not Found' }, 404);
});

apiRoute.post(
  '/packages/:owner/:slug/items',
  zValidator('json', createSkillPackageItemSchema),
  async (c) => {
    const ownerHandle = c.req.param('owner');
    const slug = c.req.param('slug');
    const input = c.req.valid('json');
    const authContext = await getAuthContext(c);
    const ownerAuth = await authorizeOwner(authContext, ownerHandle);
    if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

    const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
      viewerUserId: ownerAuth.ownerRow.id,
      includePrivate: true,
    });
    if (!pkg) return c.json({ error: 'Not Found' }, 404);

    try {
      await addSkillPackageItem({
        packageId: pkg.id,
        packageVisibility: pkg.visibility,
        skillId: input.skillId,
        position: input.position,
        note: input.note,
        pinnedReleaseId: input.pinnedReleaseId,
      });
      const detail = await getSkillPackageDetail(ownerHandle, slug, {
        viewerUserId: ownerAuth.ownerRow.id,
        includePrivate: true,
      });
      if (!detail) return c.json({ error: 'Not Found' }, 404);
      const origin = new URL(c.req.url).origin;
      return c.json(toPackageDetail(origin, detail), 201);
    } catch (error) {
      return packageErrorResponse(c, error);
    }
  },
);

apiRoute.put(
  '/packages/:owner/:slug/items/:itemId',
  zValidator('json', updateSkillPackageItemSchema),
  async (c) => {
    const ownerHandle = c.req.param('owner');
    const slug = c.req.param('slug');
    const itemId = c.req.param('itemId');
    const input = c.req.valid('json');
    const authContext = await getAuthContext(c);
    const ownerAuth = await authorizeOwner(authContext, ownerHandle);
    if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

    const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
      viewerUserId: ownerAuth.ownerRow.id,
      includePrivate: true,
    });
    if (!pkg) return c.json({ error: 'Not Found' }, 404);

    try {
      const updated = await updateSkillPackageItem(pkg.id, itemId, input);
      if (!updated) return c.json({ error: 'Not Found' }, 404);
      const detail = await getSkillPackageDetail(ownerHandle, slug, {
        viewerUserId: ownerAuth.ownerRow.id,
        includePrivate: true,
      });
      if (!detail) return c.json({ error: 'Not Found' }, 404);
      const origin = new URL(c.req.url).origin;
      return c.json(toPackageDetail(origin, detail));
    } catch (error) {
      return packageErrorResponse(c, error);
    }
  },
);

apiRoute.delete('/packages/:owner/:slug/items/:itemId', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const itemId = c.req.param('itemId');
  const authContext = await getAuthContext(c);
  const ownerAuth = await authorizeOwner(authContext, ownerHandle);
  if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

  const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
    viewerUserId: ownerAuth.ownerRow.id,
    includePrivate: true,
  });
  if (!pkg) return c.json({ error: 'Not Found' }, 404);
  const ok = await deleteSkillPackageItem(pkg.id, itemId);
  if (!ok) return c.json({ error: 'Not Found' }, 404);
  return c.body(null, 204);
});

apiRoute.get('/packages/:owner/:slug/comments', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
    viewerUserId: viewerUserId(auth),
    includePrivate: canIncludePrivateSkills(auth),
  });
  if (!pkg) return c.json({ error: 'Not Found' }, 404);

  const comments = await listSkillPackageComments(pkg.id);
  return c.json({ items: comments.map(toPackageComment), total: comments.length });
});

apiRoute.post(
  '/packages/:owner/:slug/comments',
  zValidator('json', createSkillCommentSchema),
  async (c) => {
    const ownerHandle = c.req.param('owner');
    const slug = c.req.param('slug');
    const auth = await getAuthContext(c);
    const { user } = auth;
    if (!user) return c.json({ error: 'Authentication required' }, 401);
    if (!hasScope(auth, 'community:write')) {
      return c.json({ error: 'Missing scope: community:write' }, 403);
    }

    const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
      viewerUserId: user.id,
      includePrivate: canIncludePrivateSkills(auth),
    });
    if (!pkg) return c.json({ error: 'Not Found' }, 404);

    const input = c.req.valid('json');
    const comment = await createSkillPackageComment({
      packageId: pkg.id,
      userId: user.id,
      content: input.content,
      parentId: input.parentId ?? null,
    });
    return c.json(toPackageComment(comment), 201);
  },
);

apiRoute.post('/packages/:owner/:slug/upvote', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'community:write')) {
    return c.json({ error: 'Missing scope: community:write' }, 403);
  }

  const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
    viewerUserId: user.id,
    includePrivate: canIncludePrivateSkills(auth),
  });
  if (!pkg) return c.json({ error: 'Not Found' }, 404);

  await addSkillPackageUpvote(pkg.id, user.id);
  const refreshed = await findSkillPackageById(pkg.id, user.id);
  if (!refreshed) return c.json({ error: 'Not Found' }, 404);
  const origin = new URL(c.req.url).origin;
  return c.json(toPackageListItem(origin, refreshed));
});

apiRoute.delete('/packages/:owner/:slug/upvote', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'community:write')) {
    return c.json({ error: 'Missing scope: community:write' }, 403);
  }

  const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
    viewerUserId: user.id,
    includePrivate: canIncludePrivateSkills(auth),
  });
  if (!pkg) return c.json({ error: 'Not Found' }, 404);

  await removeSkillPackageUpvote(pkg.id, user.id);
  const refreshed = await findSkillPackageById(pkg.id, user.id);
  if (!refreshed) return c.json({ error: 'Not Found' }, 404);
  const origin = new URL(c.req.url).origin;
  return c.json(toPackageListItem(origin, refreshed));
});

apiRoute.post('/packages/:owner/:slug/bookmark', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'community:write')) {
    return c.json({ error: 'Missing scope: community:write' }, 403);
  }

  const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
    viewerUserId: user.id,
    includePrivate: canIncludePrivateSkills(auth),
  });
  if (!pkg) return c.json({ error: 'Not Found' }, 404);

  await addSkillPackageBookmark(pkg.id, user.id);
  const refreshed = await findSkillPackageById(pkg.id, user.id);
  if (!refreshed) return c.json({ error: 'Not Found' }, 404);
  const origin = new URL(c.req.url).origin;
  return c.json(toPackageListItem(origin, refreshed));
});

apiRoute.delete('/packages/:owner/:slug/bookmark', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'community:write')) {
    return c.json({ error: 'Missing scope: community:write' }, 403);
  }

  const pkg = await findSkillPackageByOwnerAndSlug(ownerHandle, slug, {
    viewerUserId: user.id,
    includePrivate: canIncludePrivateSkills(auth),
  });
  if (!pkg) return c.json({ error: 'Not Found' }, 404);

  await removeSkillPackageBookmark(pkg.id, user.id);
  const refreshed = await findSkillPackageById(pkg.id, user.id);
  if (!refreshed) return c.json({ error: 'Not Found' }, 404);
  const origin = new URL(c.req.url).origin;
  return c.json(toPackageListItem(origin, refreshed));
});

apiRoute.post('/skills', zValidator('json', createSkillSchema), async (c) => {
  const input = c.req.valid('json');
  const authContext = await getAuthContext(c);
  const { user } = authContext;
  const ownerAuth = await authorizeOwner(authContext, input.owner);
  if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

  const existing = await findSkillByOwnerAndSlug(input.owner, input.slug);
  if (existing) return c.json({ error: 'Skill already exists' }, 409);

  const created = await createOwnedSkill({
    ownerUserId: ownerAuth.ownerRow.id,
    slug: input.slug,
    name: input.name,
    description: input.description,
    tags: input.tags,
    visibility: input.visibility,
    skillMdContent: input.skillMdContent,
    frontmatter: input.frontmatter,
    icon: input.icon,
    coverImage: input.coverImage,
    demoVideoUrl: input.demoVideoUrl,
    initialRelease:
      input.releaseTitle || input.releaseChangelog !== undefined
        ? {
            title: input.releaseTitle ?? '首次发布',
            changelog: input.releaseChangelog ?? '',
            createdByUserId: ownerAuth.actorRow.id,
          }
        : undefined,
  });

  const origin = new URL(c.req.url).origin;
  const createdWithCounts = await findSkillById(created.id, user?.id ?? null);
  if (!createdWithCounts) return c.json({ error: 'Not Found' }, 404);
  const detail = await toDetail(origin, createdWithCounts);
  if ('error' in detail) return c.json(detail, 500);
  return c.json(detail, 201);
});

apiRoute.put('/skills/:owner/:slug', zValidator('json', updateSkillSchema), async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const input = c.req.valid('json');
  const authContext = await getAuthContext(c);
  const { user } = authContext;
  const ownerAuth = await authorizeOwner(authContext, ownerHandle);
  if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user?.id ?? null);
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  if (skill.type !== 'owned') return c.json({ error: 'Cannot edit referenced skill' }, 400);

  const updated = await updateOwnedSkill(skill.id, {
    ...input,
    release: input.releaseChangelog
      ? {
          title: input.releaseTitle ?? '发布更新',
          changelog: input.releaseChangelog,
          createdByUserId: ownerAuth.actorRow.id,
        }
      : undefined,
  });
  if (!updated) return c.json({ error: 'Not Found' }, 404);

  const origin = new URL(c.req.url).origin;
  const updatedWithCounts = await findSkillById(updated.id, user?.id ?? null);
  if (!updatedWithCounts) return c.json({ error: 'Not Found' }, 404);
  const detail = await toDetail(origin, updatedWithCounts);
  if ('error' in detail) return c.json(detail, 500);
  return c.json(detail);
});

apiRoute.delete('/skills/:owner/:slug', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const authContext = await getAuthContext(c);
  const ownerAuth = await authorizeOwner(authContext, ownerHandle);
  if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug);
  if (!skill) return c.json({ error: 'Not Found' }, 404);

  const ok = await deleteSkill(skill.id);
  return ok ? c.body(null, 204) : c.json({ error: 'Not Found' }, 404);
});

apiRoute.post('/skills/:owner/:slug/fork', zValidator('json', forkSkillSchema), async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const input = c.req.valid('json');
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'skills:write')) {
    return c.json({ error: 'Missing scope: skills:write' }, 403);
  }

  const targetOwner = await findUserById(user.id);
  if (!targetOwner) return c.json({ error: 'Authenticated user not found' }, 401);

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  if (!canReadSkill(skill, skillAccessActor(auth))) return c.json({ error: 'Not Found' }, 404);

  const created = await forkSkillToOwner({
    sourceSkill: skill,
    targetOwnerUserId: targetOwner.id,
    targetOwnerHandle: targetOwner.handle,
    preferredSlug: input.slug,
    note: input.note,
  });

  const origin = new URL(c.req.url).origin;
  const createdWithCounts = await findSkillById(created.id, user.id);
  if (!createdWithCounts) return c.json({ error: 'Not Found' }, 404);
  const detail = await toDetail(origin, createdWithCounts);
  if ('error' in detail) return c.json(detail, 500);
  return c.json(detail, 201);
});

apiRoute.get('/skills/:owner/:slug/releases', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, viewerUserId(auth));
  if (!skill || !canReadSkill(skill, skillAccessActor(auth))) {
    return c.json({ error: 'Not Found' }, 404);
  }
  const releases = await listSkillReleases(skill.id);
  return c.json({ items: releases.map(toReleaseDto), total: releases.length });
});

apiRoute.post(
  '/skills/:owner/:slug/releases',
  zValidator('json', createReleaseSchema),
  async (c) => {
    const ownerHandle = c.req.param('owner');
    const slug = c.req.param('slug');
    const input = c.req.valid('json');
    const authContext = await getAuthContext(c);
    const { user } = authContext;
    const ownerAuth = await authorizeOwner(authContext, ownerHandle);
    if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

    const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user?.id ?? null);
    if (!skill) return c.json({ error: 'Not Found' }, 404);
    if (skill.type !== 'owned') return c.json({ error: 'Cannot release referenced skill' }, 400);

    const existingReleases = await listSkillReleases(skill.id);
    if (existingReleases.length > 0 && !input.changelog) {
      return c.json({ error: 'Changelog is required after the first release' }, 400);
    }

    const release = await createSkillRelease({
      skillId: skill.id,
      createdByUserId: ownerAuth.actorRow.id,
      title: input.title,
      changelog: input.changelog,
    });
    return c.json(toRawReleaseDto(release), 201);
  },
);

apiRoute.get('/skills/:owner/:slug/upstream-status', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, viewerUserId(auth));
  if (!skill || !canReadSkill(skill, skillAccessActor(auth))) {
    return c.json({ error: 'Not Found' }, 404);
  }

  const status = await getUpstreamStatus({ skill, viewerUserId: viewerUserId(auth) });
  const syncEvents = await listSyncEvents(skill.id);
  return c.json({
    ...status,
    ownReleases: status.ownReleases.map(toReleaseDto),
    baseRelease:
      'baseRelease' in status && status.baseRelease ? toRawReleaseDto(status.baseRelease) : null,
    latestUpstreamRelease:
      'latestUpstreamRelease' in status && status.latestUpstreamRelease
        ? toRawReleaseDto(status.latestUpstreamRelease)
        : null,
    syncEvents: syncEvents.map((event) => ({
      id: event.id,
      status: event.status,
      conflictFiles: event.conflictFiles,
      summary: event.summary,
      createdAt: event.createdAt.toISOString(),
    })),
  });
});

apiRoute.post(
  '/skills/:owner/:slug/sync-upstream',
  zValidator('json', syncUpstreamSchema),
  async (c) => {
    const ownerHandle = c.req.param('owner');
    const slug = c.req.param('slug');
    c.req.valid('json');
    const authContext = await getAuthContext(c);
    const { user } = authContext;
    const ownerAuth = await authorizeOwner(authContext, ownerHandle);
    if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

    const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user?.id ?? null);
    if (!skill) return c.json({ error: 'Not Found' }, 404);
    const result = await syncForkWithUpstream({ forkSkill: skill, userId: ownerAuth.actorRow.id });
    if (result.status === 'failed') return c.json({ error: result.error }, 400);
    if (result.status === 'conflict') {
      return c.json({
        status: 'conflict',
        conflictFiles: result.conflictFiles,
        latestUpstreamRelease: toRawReleaseDto(result.latestUpstreamRelease),
      });
    }
    return c.json({
      status: 'success',
      latestUpstreamRelease: toRawReleaseDto(result.latestUpstreamRelease),
      forkRelease: toRawReleaseDto(result.forkRelease),
    });
  },
);

apiRoute.get('/skills/:owner/:slug/subscription', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ active: false, notifyOnRelease: true, notifyOnSync: true });
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
  if (!skill || !canReadSkill(skill, skillAccessActor(auth))) {
    return c.json({ error: 'Not Found' }, 404);
  }
  const subscription = await getSkillSubscription(user.id, skill.id);
  return c.json(subscription ?? { active: false, notifyOnRelease: true, notifyOnSync: true });
});

apiRoute.put(
  '/skills/:owner/:slug/subscription',
  zValidator('json', updateSubscriptionSchema),
  async (c) => {
    const ownerHandle = c.req.param('owner');
    const slug = c.req.param('slug');
    const input = c.req.valid('json');
    const auth = await getAuthContext(c);
    const { user } = auth;
    if (!user) return c.json({ error: 'Authentication required' }, 401);
    const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
    if (!skill || !canReadSkill(skill, skillAccessActor(auth))) {
      return c.json({ error: 'Not Found' }, 404);
    }
    const subscription = await setSkillSubscription({
      userId: user.id,
      skillId: skill.id,
      active: input.active,
      notifyOnRelease: input.notifyOnRelease,
      notifyOnSync: input.notifyOnSync,
    });
    return c.json(subscription);
  },
);

// ─── Skill package/install API ───────────────────────────────────────

apiRoute.get('/skills/:owner/:slug/files', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, viewerUserId(auth));
  if (!skill || !canReadSkillFiles(skill, skillAccessActor(auth))) {
    return c.json({ error: 'Not Found' }, 404);
  }

  const files = await listSkillFilesWithContent(skill.id);
  return c.json({
    items: files.map((file) => ({ path: file.path })),
    total: files.length,
  });
});

apiRoute.get('/skills/:owner/:slug/package', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, viewerUserId(auth));
  if (!skill || !canReadSkillFiles(skill, skillAccessActor(auth))) {
    return c.json({ error: 'Not Found' }, 404);
  }

  const files = await listSkillFilesWithContent(skill.id);
  const origin = new URL(c.req.url).origin;
  return c.json({
    id: skill.id,
    owner: skill.owner,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    visibility: skill.visibility,
    protocolName: skillProtocolName(skill.owner.handle, skill.slug),
    installCommand: `npx skills add ${origin} --skill ${skillProtocolName(
      skill.owner.handle,
      skill.slug,
    )}`,
    hash: hashFiles(files),
    files,
    updatedAt: skill.updatedAt.toISOString(),
  });
});

apiRoute.get('/skills/:owner/:slug/files/:path{.+}', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const filePath = c.req.param('path');
  const pathParse = filePathSchema.safeParse(filePath);
  if (!pathParse.success) return c.json({ error: 'Invalid path' }, 400);

  const auth = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, viewerUserId(auth));
  if (!skill || !canReadSkillFiles(skill, skillAccessActor(auth))) {
    return c.json({ error: 'Not Found' }, 404);
  }

  const content = await getSkillFileContent(skill.id, pathParse.data);
  if (content === null) return c.json({ error: 'Not Found' }, 404);

  c.header('Content-Type', mimeFromPath(pathParse.data));
  return c.body(content);
});

apiRoute.post(
  '/skills/:owner/:slug/files/:path{.+}',
  zValidator('json', upsertFileBodySchema),
  async (c) => {
    const ownerHandle = c.req.param('owner');
    const slug = c.req.param('slug');
    const filePath = c.req.param('path');
    const pathParse = filePathSchema.safeParse(filePath);
    if (!pathParse.success) return c.json({ error: 'Invalid path' }, 400);

    const authContext = await getAuthContext(c);
    const ownerAuth = await authorizeOwner(authContext, ownerHandle);
    if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

    const skill = await findSkillByOwnerAndSlug(ownerHandle, slug);
    if (!skill) return c.json({ error: 'Not Found' }, 404);
    if (skill.type !== 'owned')
      return c.json({ error: 'Cannot attach files to referenced skill' }, 400);

    const { content } = c.req.valid('json');
    await upsertSkillFile(skill.id, pathParse.data, content);
    return c.body(null, 204);
  },
);

apiRoute.delete('/skills/:owner/:slug/files/:path{.+}', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const filePath = c.req.param('path');
  const pathParse = filePathSchema.safeParse(filePath);
  if (!pathParse.success) return c.json({ error: 'Invalid path' }, 400);
  if (pathParse.data === 'SKILL.md')
    return c.json({ error: 'Cannot delete SKILL.md (delete the skill instead)' }, 400);

  const authContext = await getAuthContext(c);
  const ownerAuth = await authorizeOwner(authContext, ownerHandle);
  if (!ownerAuth.ok) return c.json({ error: ownerAuth.message }, ownerAuth.status);

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug);
  if (!skill) return c.json({ error: 'Not Found' }, 404);

  const ok = await deleteSkillFile(skill.id, pathParse.data);
  return ok ? c.body(null, 204) : c.json({ error: 'Not Found' }, 404);
});

// ─── User-context API: profile + personal collections ───────────────

const handleGetMe = async (c: import('hono').Context) => {
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'profile:read')) {
    return c.json({ error: 'Missing scope: profile:read' }, 403);
  }
  const row = await findUserById(user.id);
  if (!row) return c.json({ error: 'Not Found' }, 404);
  return c.json({
    id: row.id,
    name: row.name,
    handle: row.handle,
    email: row.email,
    image: row.image,
    isVirtual: row.isVirtual,
    canPublishAs: row.canPublishAs,
  });
};

const handleUpdateProfile = async (c: import('hono').Context) => {
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const { name, handle } = (
    c.req as typeof c.req & {
      valid: (target: 'json') => { name?: string; handle?: string };
    }
  ).valid('json');

  if (handle !== undefined) {
    const taken = await findUserByHandle(handle);
    if (taken && taken.id !== user.id) return c.json({ error: 'Handle already taken' }, 409);
  }

  await updateUserProfile(user.id, { name, handle });
  const updated = await findUserById(user.id);
  return c.json(updated);
};

const handleUpdateAvatar = async (c: import('hono').Context) => {
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const { image } = (
    c.req as typeof c.req & {
      valid: (target: 'json') => { image: string | null };
    }
  ).valid('json');

  await updateUserProfile(user.id, { image });
  const updated = await findUserById(user.id);
  return c.json({ image: updated?.image ?? null });
};

const handleListMySkills = async (c: import('hono').Context) => {
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'skills:read')) {
    return c.json({ error: 'Missing scope: skills:read' }, 403);
  }
  const me = await findUserById(user.id);
  if (!me) return c.json({ error: 'Not Found' }, 404);
  const rows = hasScope(auth, 'skills:read_private')
    ? await listSkillsByOwner(me.handle)
    : await listPublicSkillsByOwner(me.handle);
  const items = rows.map(toListItem);
  return c.json({ items, total: items.length });
};

const handleListMyBookmarks = async (c: import('hono').Context) => {
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'skills:read')) {
    return c.json({ error: 'Missing scope: skills:read' }, 403);
  }
  const rows = await listUserBookmarks(user.id);
  const items = rows.map(toListItem);
  return c.json({ items, total: items.length });
};

const handleListMyPackages = async (c: import('hono').Context) => {
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'skills:read')) {
    return c.json({ error: 'Missing scope: skills:read' }, 403);
  }
  const me = await findUserById(user.id);
  if (!me) return c.json({ error: 'Not Found' }, 404);
  const { items, total } = await listSkillPackagesByOwner(me.id, {
    viewerUserId: user.id,
    includePrivate: hasScope(auth, 'skills:read_private'),
  });
  const origin = new URL(c.req.url).origin;
  return c.json({
    owner: {
      id: me.id,
      name: me.name,
      handle: me.handle,
      image: me.image,
    },
    items: items.map((item) => toPackageListItem(origin, item)),
    total,
  });
};

apiRoute.get('/me', handleGetMe);
apiRoute.patch('/me/profile', zValidator('json', updateProfileSchema), handleUpdateProfile);
apiRoute.patch('/me/avatar', zValidator('json', updateAvatarSchema), handleUpdateAvatar);
apiRoute.get('/me/skills', handleListMySkills);
apiRoute.get('/me/bookmarks', handleListMyBookmarks);
apiRoute.get('/me/packages', handleListMyPackages);
apiRoute.get('/me/publishables', zValidator('query', listPublishablesQuerySchema), async (c) => {
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'skills:read')) {
    return c.json({ error: 'Missing scope: skills:read' }, 403);
  }
  const me = await findUserById(user.id);
  if (!me) return c.json({ error: 'Not Found' }, 404);
  const { kind, sort } = c.req.valid('query');
  return listOwnerPublishablesResponse(c, me, {
    kind,
    sort,
    viewerUserId: user.id,
    includePrivate: hasScope(auth, 'skills:read_private'),
  });
});

apiRoute.get('/users/:owner/skills', async (c) => {
  const ownerHandle = c.req.param('owner');
  const ownerRow = await findUserByHandle(ownerHandle);
  if (!ownerRow) return c.json({ error: 'Not Found' }, 404);
  const auth = await getAuthContext(c);
  const { user } = auth;
  // If the viewer IS this owner, give them the full list (incl private).
  // Otherwise only public.
  const rows =
    user && user.id === ownerRow.id && hasScope(auth, 'skills:read_private')
      ? await listSkillsByOwner(ownerHandle)
      : await listPublicSkillsByOwner(ownerHandle);
  const items = rows.map(toListItem);
  return c.json({
    owner: {
      id: ownerRow.id,
      name: ownerRow.name,
      handle: ownerRow.handle,
      image: ownerRow.image,
    },
    items,
    total: items.length,
  });
});

apiRoute.get('/users/:owner/packages', async (c) => {
  const ownerHandle = c.req.param('owner');
  const ownerRow = await findUserByHandle(ownerHandle);
  if (!ownerRow) return c.json({ error: 'Not Found' }, 404);
  const auth = await getAuthContext(c);
  const { user } = auth;
  const { items, total } = await listSkillPackagesByOwner(ownerRow.id, {
    viewerUserId: viewerUserId(auth),
    includePrivate: Boolean(
      user && user.id === ownerRow.id && hasScope(auth, 'skills:read_private'),
    ),
  });
  const origin = new URL(c.req.url).origin;
  return c.json({
    owner: {
      id: ownerRow.id,
      name: ownerRow.name,
      handle: ownerRow.handle,
      image: ownerRow.image,
    },
    items: items.map((item) => toPackageListItem(origin, item)),
    total,
  });
});

apiRoute.get(
  '/users/:owner/publishables',
  zValidator('query', listPublishablesQuerySchema),
  async (c) => {
    const ownerHandle = c.req.param('owner');
    const ownerRow = await findUserByHandle(ownerHandle);
    if (!ownerRow) return c.json({ error: 'Not Found' }, 404);
    const auth = await getAuthContext(c);
    const { user } = auth;
    const { kind, sort } = c.req.valid('query');
    return listOwnerPublishablesResponse(c, ownerRow, {
      kind,
      sort,
      viewerUserId: viewerUserId(auth),
      includePrivate: Boolean(
        user && user.id === ownerRow.id && hasScope(auth, 'skills:read_private'),
      ),
    });
  },
);

// ─── Notifications ───────────────────────────────────────────────────

apiRoute.get('/notifications', async (c) => {
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'notifications:read')) {
    return c.json({ error: 'Missing scope: notifications:read' }, 403);
  }
  const items = await listNotifications(user.id);
  return c.json({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      read: Boolean(n.read),
      createdAt: n.createdAt.toISOString(),
      actor: n.actor,
      publishable: n.publishable
        ? {
            id: n.publishable.id,
            kind: n.publishable.kind,
            slug: n.publishable.slug,
            name: n.publishable.name,
            owner: n.publishable.owner,
          }
        : null,
    })),
    total: items.length,
  });
});

apiRoute.get('/notifications/unread-count', async (c) => {
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'notifications:read')) {
    return c.json({ error: 'Missing scope: notifications:read' }, 403);
  }
  const count = await getUnreadNotificationCount(user.id);
  return c.json({ count });
});

apiRoute.post('/notifications/:id/read', async (c) => {
  const id = c.req.param('id');
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'notifications:read')) {
    return c.json({ error: 'Missing scope: notifications:read' }, 403);
  }
  const ok = await markNotificationRead(id, user.id);
  return ok ? c.json({ status: 'ok' }) : c.json({ error: 'Not Found' }, 404);
});

apiRoute.post('/notifications/read-all', async (c) => {
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'notifications:read')) {
    return c.json({ error: 'Missing scope: notifications:read' }, 403);
  }
  await markAllNotificationsRead(user.id);
  return c.json({ status: 'ok' });
});

// ─── Community: upvotes + comments ───────────────────────────────────

apiRoute.get('/skills/:owner/:slug/comments', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, viewerUserId(auth));
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  if (!canReadSkill(skill, skillAccessActor(auth))) return c.json({ error: 'Not Found' }, 404);

  const comments = await listSkillComments(skill.id);
  return c.json({ items: comments.map(toComment), total: comments.length });
});

apiRoute.post(
  '/skills/:owner/:slug/comments',
  zValidator('json', createSkillCommentSchema),
  async (c) => {
    const ownerHandle = c.req.param('owner');
    const slug = c.req.param('slug');
    const auth = await getAuthContext(c);
    const { user } = auth;
    if (!user) return c.json({ error: 'Authentication required' }, 401);
    if (!hasScope(auth, 'community:write')) {
      return c.json({ error: 'Missing scope: community:write' }, 403);
    }

    const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
    if (!skill) return c.json({ error: 'Not Found' }, 404);
    if (!canReadSkill(skill, skillAccessActor(auth))) return c.json({ error: 'Not Found' }, 404);

    const input = c.req.valid('json');
    const comment = await createSkillComment({
      skillId: skill.id,
      userId: user.id,
      content: input.content,
      parentId: input.parentId ?? null,
    });
    return c.json(toComment(comment), 201);
  },
);

apiRoute.post('/skills/:owner/:slug/upvote', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'community:write')) {
    return c.json({ error: 'Missing scope: community:write' }, 403);
  }

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  if (!canReadSkill(skill, skillAccessActor(auth))) return c.json({ error: 'Not Found' }, 404);

  await addSkillUpvote(skill.id, user.id);
  const refreshed = await findSkillById(skill.id, user.id);
  if (!refreshed) return c.json({ error: 'Not Found' }, 404);
  return c.json(baseFromRow(refreshed));
});

apiRoute.delete('/skills/:owner/:slug/upvote', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'community:write')) {
    return c.json({ error: 'Missing scope: community:write' }, 403);
  }

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  if (!canReadSkill(skill, skillAccessActor(auth))) return c.json({ error: 'Not Found' }, 404);

  await removeSkillUpvote(skill.id, user.id);
  const refreshed = await findSkillById(skill.id, user.id);
  if (!refreshed) return c.json({ error: 'Not Found' }, 404);
  return c.json(baseFromRow(refreshed));
});

// ─── Bookmarks ───────────────────────────────────────────────────────

apiRoute.post('/skills/:owner/:slug/bookmark', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'community:write')) {
    return c.json({ error: 'Missing scope: community:write' }, 403);
  }

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  if (!canReadSkill(skill, skillAccessActor(auth))) return c.json({ error: 'Not Found' }, 404);

  await addSkillBookmark(skill.id, user.id);
  const refreshed = await findSkillById(skill.id, user.id);
  if (!refreshed) return c.json({ error: 'Not Found' }, 404);
  return c.json(baseFromRow(refreshed));
});

apiRoute.delete('/skills/:owner/:slug/bookmark', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!hasScope(auth, 'community:write')) {
    return c.json({ error: 'Missing scope: community:write' }, 403);
  }

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  if (!canReadSkill(skill, skillAccessActor(auth))) return c.json({ error: 'Not Found' }, 404);

  await removeSkillBookmark(skill.id, user.id);
  const refreshed = await findSkillById(skill.id, user.id);
  if (!refreshed) return c.json({ error: 'Not Found' }, 404);
  return c.json(baseFromRow(refreshed));
});

// ─── Capability URL: mint install token ──────────────────────────────

apiRoute.post('/install-tokens', zValidator('json', mintInstallTokenSchema), async (c) => {
  const auth = await getAuthContext(c);
  const { user } = auth;
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const input = c.req.valid('json');

  const skill = await findSkillById(input.skillId, user.id);
  if (!skill) return c.json({ error: 'Skill not found' }, 404);
  if (!canMintSkillInstallGrant(skill, skillAccessActor(auth))) {
    return c.json({ error: 'Not Found' }, 404);
  }

  const grant = await mintGrant({
    skillId: skill.id,
    grantedBy: user.id,
    expiresInHours: input.expiresInHours,
    maxUses: input.maxUses,
  });

  const origin = new URL(c.req.url).origin;
  const installCommand = `npx skills add ${origin}/i/${grant.token}`;
  return c.json(
    {
      token: grant.token,
      expiresAt: grant.expiresAt.toISOString(),
      maxUses: grant.maxUses,
      installCommand,
    },
    201,
  );
});
