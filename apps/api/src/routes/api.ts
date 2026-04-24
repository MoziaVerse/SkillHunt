import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { getAuthContext } from '../lib/auth-context';
import { type SkillDetail, type SkillListItem, listSkillsQuerySchema } from '../lib/dto';
import {
  type SkillWithOwner,
  findSkillBySlug,
  listAllTags,
  listSkillFilesWithContent,
  listSkillsForApi,
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

apiRoute.get('/skills', zValidator('query', listSkillsQuerySchema), async (c) => {
  const { type, q, tag } = c.req.valid('query');
  const { user } = await getAuthContext(c);
  const rows = await listSkillsForApi({ type, q, tags: tag, viewerUserId: user?.id ?? null });

  const items: SkillListItem[] = rows.map((r) => {
    const base = baseFromRow(r);
    if (r.type === 'owned') {
      return { ...base, type: 'owned' as const, visibility: r.visibility };
    }
    // referenced: enforced by DB check constraint to have these non-null.
    return {
      ...base,
      type: 'referenced' as const,
      sourceRepo: r.sourceRepo ?? '',
      sourceSkillName: r.sourceSkillName ?? '',
    };
  });

  return c.json({ items, total: items.length });
});

apiRoute.get('/skills/:slug', async (c) => {
  const slug = c.req.param('slug');
  const { user } = await getAuthContext(c);
  const skill = await findSkillBySlug(slug);
  if (!skill) return c.json({ error: 'Not Found' }, 404);
  // private owned skill is only visible to its owner.
  const isOwner = !!user && skill.ownerUserId === user.id;
  if (skill.type === 'owned' && skill.visibility === 'private' && !isOwner) {
    // 404 (not 403) on purpose — avoids leaking that the slug exists.
    return c.json({ error: 'Not Found' }, 404);
  }

  const base = baseFromRow(skill);

  if (skill.type === 'owned') {
    const files = await listSkillFilesWithContent(skill.id);
    const skillMd = files.find((f) => f.path === 'SKILL.md');
    if (!skillMd) return c.json({ error: 'Skill data corrupted' }, 500);

    const origin = new URL(c.req.url).origin;
    // Include --agent + -y so the command is non-interactive and lands on disk
    // immediately. Users can swap `claude-code` for any agent they prefer.
    const installCommand = `npx skills add ${origin} --skill ${skill.slug} --agent claude-code -y`;

    const detail: SkillDetail = {
      ...base,
      type: 'owned',
      visibility: skill.visibility,
      skillMdContent: skillMd.content,
      files: files.map((f) => f.path),
      installCommand,
    };
    return c.json(detail);
  }

  const detail: SkillDetail = {
    ...base,
    type: 'referenced',
    sourceRepo: skill.sourceRepo ?? '',
    sourceSkillName: skill.sourceSkillName ?? '',
    sourceInstallCommand: skill.sourceInstallCommand ?? '',
    sourceUrl: skill.sourceUrl,
  };
  return c.json(detail);
});

apiRoute.get('/tags', async (c) => {
  const tags = await listAllTags();
  return c.json({ tags });
});
