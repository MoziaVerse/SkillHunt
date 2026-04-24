import { Hono } from 'hono';
import { mimeFromPath } from '../lib/content-type';
import { consumeGrant } from '../services/install-grant-service';
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

// ─── Capability URL: GET /.well-known/agent-skills/i/:token/:owner/:slug/* ────
//
// Bearer-less access for one-shot capability tokens. Used by `npx skills`
// CLI to install private/owner-restricted skills without requiring auth.
// MUST be registered BEFORE the generic `/agent-skills/:a/:b` routes.
const handleCapabilityFile = async (c: import('hono').Context) => {
  const PREFIX = '/.well-known/agent-skills/i/';
  const tail = c.req.path.slice(PREFIX.length);
  const segments = tail.split('/').filter((s) => s.length > 0);
  if (segments.length < 4) return c.text('Path too short', 400);

  const [token, ownerHandle, skillSlug, ...fileSegs] = segments;
  if (!token || !ownerHandle || !skillSlug) return c.notFound();
  const filePath = fileSegs.join('/');
  if (isUnsafePath(filePath)) return c.text('Invalid path', 400);

  const result = await consumeGrant(token, ownerHandle, skillSlug, filePath, {
    ip: c.req.header('x-forwarded-for') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  });
  if (!result) return c.notFound();

  c.header('Content-Type', result.contentType ?? mimeFromPath(filePath));
  return c.body(result.content);
};

wellknownRoute.get('/agent-skills/i/:token/:owner/:slug', handleCapabilityFile);
wellknownRoute.get('/agent-skills/i/:token/:owner/:slug/*', handleCapabilityFile);

wellknownRoute.get('/agent-skills/:a/:b', handleAgentSkillsFile);
wellknownRoute.get('/agent-skills/:a/:b/*', handleAgentSkillsFile);
