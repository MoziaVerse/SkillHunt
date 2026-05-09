import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { getAuthContext } from '../lib/auth-context';
import { mimeFromPath } from '../lib/content-type';
import {
  type SkillComment,
  type SkillDetail,
  type SkillListItem,
  createReleaseSchema,
  createSkillCommentSchema,
  createSkillSchema,
  filePathSchema,
  forkSkillSchema,
  listSkillsQuerySchema,
  mintInstallTokenSchema,
  syncUpstreamSchema,
  updateAvatarSchema,
  updateProfileSchema,
  updateSkillSchema,
  updateSubscriptionSchema,
  upsertFileBodySchema,
} from '../lib/dto';
import { skillProtocolName } from '../lib/protocol-name';
import { mintGrant } from '../services/install-grant-service';
import {
  type SkillWithOwner,
  addSkillUpvote,
  createOwnedSkill,
  createSkillComment,
  createSkillRelease,
  deleteSkill,
  deleteSkillFile,
  findSkillById,
  findSkillByOwnerAndSlug,
  findSkillBySlug,
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
  markAllNotificationsRead,
  markNotificationRead,
  removeSkillUpvote,
  setSkillSubscription,
  syncForkWithUpstream,
  updateOwnedSkill,
  updateUserProfile,
  upsertSkillFile,
} from '../services/skill-service';

export const apiRoute = new Hono();

const baseFromRow = (r: SkillWithOwner) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description,
  tags: r.tags,
  owner: r.owner,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  upvoteCount: r.upvoteCount,
  commentCount: r.commentCount,
  bookmarkCount: r.bookmarkCount,
  viewerHasUpvoted: r.viewerHasUpvoted,
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
    const installCommand = `npx skills add ${origin} --skill ${skillProtocolName(skill.owner.handle, skill.slug)} --agent claude-code -y`;
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

function canViewSkill(skill: SkillWithOwner, viewerUserId: string | null) {
  return (
    skill.type !== 'owned' || skill.visibility !== 'private' || skill.ownerUserId === viewerUserId
  );
}

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

// ─── List + tags ──────────────────────────────────────────────────────

apiRoute.get('/skills', zValidator('query', listSkillsQuerySchema), async (c) => {
  const { type, q, tag } = c.req.valid('query');
  const { user } = await getAuthContext(c);
  const rows = await listSkillsForApi({ type, q, tags: tag, viewerUserId: user?.id ?? null });
  const items = rows.map(toListItem);
  return c.json({ items, total: items.length });
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
  const { user } = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user?.id ?? null);
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  const isOwner = !!user && skill.ownerUserId === user.id;
  if (skill.type === 'owned' && skill.visibility === 'private' && !isOwner) {
    return c.json({ error: 'Not Found' }, 404);
  }
  const origin = new URL(c.req.url).origin;
  const detail = await toDetail(origin, skill);
  if ('error' in detail) return c.json(detail, 500);
  return c.json(detail);
});

// Legacy: /api/skills/:slug — auto-resolves to mozia/<slug> via slug uniqueness
// fallback. Returns 302 to the canonical URL when found, 404 otherwise.
apiRoute.get('/skills/:slug', async (c) => {
  const slug = c.req.param('slug');
  const { user } = await getAuthContext(c);
  const skill = await findSkillBySlug(slug, user?.id ?? null);
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  const url = new URL(c.req.url);
  url.pathname = `/api/skills/${skill.owner.handle}/${skill.slug}`;
  return c.redirect(url.toString(), 302);
});

// ─── Mutations: skills ────────────────────────────────────────────────

async function authorizeOwner(actor: { id: string } | null, ownerHandle: string) {
  if (!actor)
    return { ok: false as const, status: 401 as const, message: 'Authentication required' };
  const actorRow = await findUserById(actor.id);
  if (!actorRow)
    return { ok: false as const, status: 401 as const, message: 'Authenticated user not found' };
  const ownerRow = await findUserByHandle(ownerHandle);
  if (!ownerRow) return { ok: false as const, status: 404 as const, message: 'Owner not found' };
  if (actorRow.handle === ownerHandle) return { ok: true as const, ownerRow, actorRow };
  if (actorRow.canPublishAs.includes(ownerHandle)) return { ok: true as const, ownerRow, actorRow };
  return { ok: false as const, status: 403 as const, message: 'Forbidden' };
}

apiRoute.post('/skills', zValidator('json', createSkillSchema), async (c) => {
  const input = c.req.valid('json');
  const { user } = await getAuthContext(c);
  const auth = await authorizeOwner(user, input.owner);
  if (!auth.ok) return c.json({ error: auth.message }, auth.status);

  const existing = await findSkillByOwnerAndSlug(input.owner, input.slug);
  if (existing) return c.json({ error: 'Skill already exists' }, 409);

  const created = await createOwnedSkill({
    ownerUserId: auth.ownerRow.id,
    slug: input.slug,
    name: input.name,
    description: input.description,
    tags: input.tags,
    visibility: input.visibility,
    skillMdContent: input.skillMdContent,
    frontmatter: input.frontmatter,
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
  const { user } = await getAuthContext(c);
  const auth = await authorizeOwner(user, ownerHandle);
  if (!auth.ok) return c.json({ error: auth.message }, auth.status);

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user?.id ?? null);
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  if (skill.type !== 'owned') return c.json({ error: 'Cannot edit referenced skill' }, 400);

  const updated = await updateOwnedSkill(skill.id, input);
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
  const { user } = await getAuthContext(c);
  const auth = await authorizeOwner(user, ownerHandle);
  if (!auth.ok) return c.json({ error: auth.message }, auth.status);

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug);
  if (!skill) return c.json({ error: 'Not Found' }, 404);

  const ok = await deleteSkill(skill.id);
  return ok ? c.body(null, 204) : c.json({ error: 'Not Found' }, 404);
});

apiRoute.post('/skills/:owner/:slug/fork', zValidator('json', forkSkillSchema), async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const input = c.req.valid('json');
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);

  const targetOwner = await findUserById(user.id);
  if (!targetOwner) return c.json({ error: 'Authenticated user not found' }, 401);

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
  if (!skill) return c.json({ error: 'Not Found' }, 404);

  const isOwner = skill.ownerUserId === user.id;
  if (skill.type === 'owned' && skill.visibility === 'private' && !isOwner) {
    return c.json({ error: 'Not Found' }, 404);
  }

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
  const { user } = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user?.id ?? null);
  if (!skill || !canViewSkill(skill, user?.id ?? null)) return c.json({ error: 'Not Found' }, 404);
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
    const { user } = await getAuthContext(c);
    const auth = await authorizeOwner(user, ownerHandle);
    if (!auth.ok) return c.json({ error: auth.message }, auth.status);

    const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user?.id ?? null);
    if (!skill) return c.json({ error: 'Not Found' }, 404);
    if (skill.type !== 'owned') return c.json({ error: 'Cannot release referenced skill' }, 400);

    const release = await createSkillRelease({
      skillId: skill.id,
      createdByUserId: auth.actorRow.id,
      title: input.title,
      changelog: input.changelog,
    });
    return c.json(toRawReleaseDto(release), 201);
  },
);

apiRoute.get('/skills/:owner/:slug/upstream-status', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const { user } = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user?.id ?? null);
  if (!skill || !canViewSkill(skill, user?.id ?? null)) return c.json({ error: 'Not Found' }, 404);

  const status = await getUpstreamStatus({ skill, viewerUserId: user?.id ?? null });
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
    const { user } = await getAuthContext(c);
    const auth = await authorizeOwner(user, ownerHandle);
    if (!auth.ok) return c.json({ error: auth.message }, auth.status);

    const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user?.id ?? null);
    if (!skill) return c.json({ error: 'Not Found' }, 404);
    const result = await syncForkWithUpstream({ forkSkill: skill, userId: auth.actorRow.id });
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
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ active: false, notifyOnRelease: true, notifyOnSync: true });
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
  if (!skill || !canViewSkill(skill, user.id)) return c.json({ error: 'Not Found' }, 404);
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
    const { user } = await getAuthContext(c);
    if (!user) return c.json({ error: 'Authentication required' }, 401);
    const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
    if (!skill || !canViewSkill(skill, user.id)) return c.json({ error: 'Not Found' }, 404);
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

// ─── File CRUD ────────────────────────────────────────────────────────

apiRoute.get('/skills/:owner/:slug/files/:path{.+}', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const filePath = c.req.param('path');
  const pathParse = filePathSchema.safeParse(filePath);
  if (!pathParse.success) return c.json({ error: 'Invalid path' }, 400);

  const { user } = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug);
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  if (skill.type !== 'owned') return c.json({ error: 'Not Found' }, 404);

  const isOwner = !!user && skill.ownerUserId === user.id;
  if (skill.visibility === 'private' && !isOwner) {
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

    const { user } = await getAuthContext(c);
    const auth = await authorizeOwner(user, ownerHandle);
    if (!auth.ok) return c.json({ error: auth.message }, auth.status);

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

  const { user } = await getAuthContext(c);
  const auth = await authorizeOwner(user, ownerHandle);
  if (!auth.ok) return c.json({ error: auth.message }, auth.status);

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug);
  if (!skill) return c.json({ error: 'Not Found' }, 404);

  const ok = await deleteSkillFile(skill.id, pathParse.data);
  return ok ? c.body(null, 204) : c.json({ error: 'Not Found' }, 404);
});

// ─── Users ────────────────────────────────────────────────────────────

apiRoute.get('/users/me', async (c) => {
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
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
});

apiRoute.patch('/users/me/profile', zValidator('json', updateProfileSchema), async (c) => {
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const { name, handle } = c.req.valid('json');

  if (handle !== undefined) {
    const taken = await findUserByHandle(handle);
    if (taken && taken.id !== user.id) return c.json({ error: 'Handle already taken' }, 409);
  }

  await updateUserProfile(user.id, { name, handle });
  const updated = await findUserById(user.id);
  return c.json(updated);
});

apiRoute.patch('/users/me/avatar', zValidator('json', updateAvatarSchema), async (c) => {
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const { image } = c.req.valid('json');

  await updateUserProfile(user.id, { image });
  const updated = await findUserById(user.id);
  return c.json({ image: updated?.image ?? null });
});

apiRoute.get('/users/me/skills', async (c) => {
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const me = await findUserById(user.id);
  if (!me) return c.json({ error: 'Not Found' }, 404);
  const rows = await listSkillsByOwner(me.handle);
  const items = rows.map(toListItem);
  return c.json({ items, total: items.length });
});

apiRoute.get('/users/:owner/skills', async (c) => {
  const ownerHandle = c.req.param('owner');
  const ownerRow = await findUserByHandle(ownerHandle);
  if (!ownerRow) return c.json({ error: 'Not Found' }, 404);
  const { user } = await getAuthContext(c);
  // If the viewer IS this owner, give them the full list (incl private).
  // Otherwise only public.
  const rows =
    user && user.id === ownerRow.id
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

// ─── Notifications ───────────────────────────────────────────────────

apiRoute.get('/notifications', async (c) => {
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const items = await listNotifications(user.id);
  return c.json({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      read: Boolean(n.read),
      createdAt: n.createdAt.toISOString(),
      actor: n.actor,
      skill: n.skill
        ? {
            id: n.skill.id,
            slug: n.skill.slug,
            name: n.skill.name,
            owner: n.skill.owner,
          }
        : null,
    })),
    total: items.length,
  });
});

apiRoute.get('/notifications/unread-count', async (c) => {
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const count = await getUnreadNotificationCount(user.id);
  return c.json({ count });
});

apiRoute.post('/notifications/:id/read', async (c) => {
  const id = c.req.param('id');
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const ok = await markNotificationRead(id, user.id);
  return ok ? c.json({ status: 'ok' }) : c.json({ error: 'Not Found' }, 404);
});

apiRoute.post('/notifications/read-all', async (c) => {
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  await markAllNotificationsRead(user.id);
  return c.json({ status: 'ok' });
});

// ─── Community: upvotes + comments ───────────────────────────────────

apiRoute.get('/skills/:owner/:slug/comments', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const { user } = await getAuthContext(c);
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user?.id ?? null);
  if (!skill) return c.json({ error: 'Not Found' }, 404);

  const isOwner = !!user && skill.ownerUserId === user.id;
  if (skill.type === 'owned' && skill.visibility === 'private' && !isOwner) {
    return c.json({ error: 'Not Found' }, 404);
  }

  const comments = await listSkillComments(skill.id);
  return c.json({ items: comments.map(toComment), total: comments.length });
});

apiRoute.post(
  '/skills/:owner/:slug/comments',
  zValidator('json', createSkillCommentSchema),
  async (c) => {
    const ownerHandle = c.req.param('owner');
    const slug = c.req.param('slug');
    const { user } = await getAuthContext(c);
    if (!user) return c.json({ error: 'Authentication required' }, 401);

    const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
    if (!skill) return c.json({ error: 'Not Found' }, 404);

    const isOwner = skill.ownerUserId === user.id;
    if (skill.type === 'owned' && skill.visibility === 'private' && !isOwner) {
      return c.json({ error: 'Not Found' }, 404);
    }

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
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
  if (!skill) return c.json({ error: 'Not Found' }, 404);

  const isOwner = skill.ownerUserId === user.id;
  if (skill.type === 'owned' && skill.visibility === 'private' && !isOwner) {
    return c.json({ error: 'Not Found' }, 404);
  }

  await addSkillUpvote(skill.id, user.id);
  const refreshed = await findSkillById(skill.id, user.id);
  if (!refreshed) return c.json({ error: 'Not Found' }, 404);
  return c.json(baseFromRow(refreshed));
});

apiRoute.delete('/skills/:owner/:slug/upvote', async (c) => {
  const ownerHandle = c.req.param('owner');
  const slug = c.req.param('slug');
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug, user.id);
  if (!skill) return c.json({ error: 'Not Found' }, 404);

  const isOwner = skill.ownerUserId === user.id;
  if (skill.type === 'owned' && skill.visibility === 'private' && !isOwner) {
    return c.json({ error: 'Not Found' }, 404);
  }

  await removeSkillUpvote(skill.id, user.id);
  const refreshed = await findSkillById(skill.id, user.id);
  if (!refreshed) return c.json({ error: 'Not Found' }, 404);
  return c.json(baseFromRow(refreshed));
});

// ─── Capability URL: mint install token ──────────────────────────────

apiRoute.post('/install-tokens', zValidator('json', mintInstallTokenSchema), async (c) => {
  const { user } = await getAuthContext(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const input = c.req.valid('json');

  const skill = await findSkillById(input.skillId);
  if (!skill) return c.json({ error: 'Skill not found' }, 404);
  const isOwner = skill.ownerUserId === user.id;
  const visible = skill.visibility === 'public' || skill.type === 'referenced' || isOwner;
  if (!visible) return c.json({ error: 'Not Found' }, 404);

  const grant = await mintGrant({
    skillId: skill.id,
    grantedBy: user.id,
    expiresInHours: input.expiresInHours,
    maxUses: input.maxUses,
  });

  const origin = new URL(c.req.url).origin;
  const installCommand = `npx skills add ${origin}/i/${grant.token} --agent claude-code -y`;
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
