import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { getAuthContext } from '../lib/auth-context';
import {
  type SkillDetail,
  type SkillListItem,
  createSkillSchema,
  filePathSchema,
  listSkillsQuerySchema,
  updateProfileSchema,
  updateSkillSchema,
  upsertFileBodySchema,
} from '../lib/dto';
import {
  type SkillWithOwner,
  createOwnedSkill,
  deleteSkill,
  deleteSkillFile,
  findSkillByOwnerAndSlug,
  findSkillBySlug,
  findUserByHandle,
  findUserById,
  listAllTags,
  listPublicSkillsByOwner,
  listSkillFilesWithContent,
  listSkillsByOwner,
  listSkillsForApi,
  updateOwnedSkill,
  updateUserProfile,
  upsertSkillFile,
} from '../services/skill-service';

export const apiRoute = new Hono();

const baseFromRow = (r: SkillWithOwner) => ({
  slug: r.slug,
  name: r.name,
  description: r.description,
  tags: r.tags,
  owner: r.owner,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
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
    const installCommand = `npx skills add ${origin} --skill ${skill.slug} --agent claude-code -y`;
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
  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug);
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
  const skill = await findSkillBySlug(slug);
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
  const detail = await toDetail(origin, created);
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

  const skill = await findSkillByOwnerAndSlug(ownerHandle, slug);
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  if (skill.type !== 'owned') return c.json({ error: 'Cannot edit referenced skill' }, 400);

  const updated = await updateOwnedSkill(skill.id, input);
  if (!updated) return c.json({ error: 'Not Found' }, 404);

  const origin = new URL(c.req.url).origin;
  const detail = await toDetail(origin, updated);
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

// ─── File CRUD ────────────────────────────────────────────────────────

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
