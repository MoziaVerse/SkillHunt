import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { type SkillDetail, type SkillListItem, listSkillsQuerySchema } from '../lib/dto';
import {
  findSkillBySlug,
  listAllTags,
  listSkillFilesWithContent,
  listSkillsForApi,
} from '../services/skill-service';

export const apiRoute = new Hono();

apiRoute.get('/skills', zValidator('query', listSkillsQuerySchema), async (c) => {
  const { type, q, tag, includeInternal } = c.req.valid('query');
  const rows = await listSkillsForApi({ type, q, tags: tag, includeInternal });

  const items: SkillListItem[] = rows.map((r) => {
    const base = {
      slug: r.slug,
      name: r.name,
      description: r.description,
      tags: r.tags,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };

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
  const skill = await findSkillBySlug(slug);
  if (!skill) return c.json({ error: 'Not Found' }, 404);

  const base = {
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    tags: skill.tags,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
  };

  if (skill.type === 'owned') {
    const files = await listSkillFilesWithContent(skill.id);
    const skillMd = files.find((f) => f.path === 'SKILL.md');
    if (!skillMd) return c.json({ error: 'Skill data corrupted' }, 500);

    const origin = new URL(c.req.url).origin;
    const installCommand = `npx skills add ${origin} --skill ${skill.slug}`;

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
