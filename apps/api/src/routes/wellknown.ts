import { Hono } from 'hono';
import { mimeFromPath } from '../lib/content-type';
import {
  findPublicOwnedSkillByOwnerAndSlug,
  findPublicOwnedSkillBySlug,
  getSkillFileContent,
  listPublicOwnedSkills,
  listSkillFilePaths,
} from '../services/skill-service';

export const wellknownRoute = new Hono();

const MOZIA_OWNER = 'mozia';
const isUnsafePath = (p: string) => !p || p.includes('..') || p.startsWith('/');

// GET /.well-known/agent-skills/index.json
//
// Phase 2 namespacing: entries owned by `mozia` continue to use bare `<slug>`
// as their `name` for backward CLI compat. Non-mozia owners get a namespaced
// `<owner>/<slug>` name to avoid slug collisions across users.
wellknownRoute.get('/agent-skills/index.json', async (c) => {
  const rows = await listPublicOwnedSkills();

  const entries = await Promise.all(
    rows.map(async (s) => {
      const protocolName = s.ownerHandle === MOZIA_OWNER ? s.slug : `${s.ownerHandle}/${s.slug}`;
      return {
        name: protocolName,
        description: s.description,
        files: await listSkillFilePaths(s.id),
      };
    }),
  );

  // Defensive: skip rows missing SKILL.md.
  const valid = entries.filter((e) => e.files.some((f) => f === 'SKILL.md'));

  return c.json({ skills: valid });
});

// GET /.well-known/agent-skills/<...>/SKILL.md|other-file
//
// Two URL shapes supported in one handler (segment-count dispatch):
//   2 segments → legacy `<slug>/<file>` (auto-resolves to mozia/<slug>)
//   3+ segments → canonical `<owner>/<slug>/<file...>` (Phase 2)
//
// Two routes both calling the same handler — covers `/A/B`, `/A/B/C`, `/A/B/C/D`.
const handleAgentSkillsFile = async (c: import('hono').Context) => {
  const PREFIX = '/.well-known/agent-skills/';
  const tail = c.req.path.slice(PREFIX.length);
  const segments = tail.split('/').filter((s) => s.length > 0);
  if (segments.length < 2) return c.text('File path required', 400);

  let ownerName: string | undefined;
  let slug: string | undefined;
  let filePath: string;
  if (segments.length === 2) {
    // Legacy single-slug. ownerName left undefined → resolved by bare-slug lookup.
    [slug, filePath] = segments as [string, string];
  } else {
    [ownerName, slug] = segments;
    filePath = segments.slice(2).join('/');
  }
  if (!slug) return c.text('Slug required', 400);
  if (isUnsafePath(filePath)) return c.text('Invalid path', 400);

  const skill = ownerName
    ? await findPublicOwnedSkillByOwnerAndSlug(ownerName, slug)
    : await findPublicOwnedSkillBySlug(slug);
  if (!skill) return c.notFound();

  const content = await getSkillFileContent(skill.id, filePath);
  if (content === null) return c.notFound();

  c.header('Content-Type', mimeFromPath(filePath));
  return c.body(content);
};

wellknownRoute.get('/agent-skills/:a/:b', handleAgentSkillsFile);
wellknownRoute.get('/agent-skills/:a/:b/*', handleAgentSkillsFile);
