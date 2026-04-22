import { Hono } from 'hono';
import { mimeFromPath } from '../lib/content-type';
import {
  findPublicOwnedSkillBySlug,
  getSkillFileContent,
  listPublicOwnedSkills,
  listSkillFilePaths,
} from '../services/skill-service';

export const wellknownRoute = new Hono();

// GET /.well-known/agent-skills/index.json
wellknownRoute.get('/agent-skills/index.json', async (c) => {
  const rows = await listPublicOwnedSkills();

  const entries = await Promise.all(
    rows.map(async (s) => ({
      // Protocol uses `name`; we store our URL key in `slug`.
      name: s.slug,
      description: s.description,
      files: await listSkillFilePaths(s.id),
    })),
  );

  // Defensive: the DB schema already requires SKILL.md via seed, but filter again.
  const valid = entries.filter((e) => e.files.some((f) => f === 'SKILL.md'));

  return c.json({ skills: valid });
});

// GET /.well-known/agent-skills/:name/*
wellknownRoute.get('/agent-skills/:name/*', async (c) => {
  const name = c.req.param('name');
  const fullPath = c.req.path;
  const prefix = `/.well-known/agent-skills/${name}/`;
  const idx = fullPath.indexOf(prefix);
  if (idx < 0) return c.notFound();
  const filePath = fullPath.slice(idx + prefix.length);

  if (!filePath) return c.text('File path required', 400);
  if (filePath.includes('..') || filePath.startsWith('/')) {
    return c.text('Invalid path', 400);
  }

  const skill = await findPublicOwnedSkillBySlug(name);
  if (!skill) return c.notFound();

  const content = await getSkillFileContent(skill.id, filePath);
  if (content === null) return c.notFound();

  c.header('Content-Type', mimeFromPath(filePath));
  return c.body(content);
});
