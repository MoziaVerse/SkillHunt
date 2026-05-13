import { Hono } from 'hono';
import { mimeFromPath } from '../lib/content-type';
import { skillProtocolName } from '../lib/protocol-name';
import {
  consumeGrant,
  peekGrantSkill,
  peekGrantSkillForFile,
} from '../services/install-grant-service';
import { recordSkillInstall } from '../services/install-stats-service';
import {
  getPublicPackageSkillFile,
  listPublicPackageSkillEntries,
} from '../services/skill-package-service';
import {
  findPublicOwnedSkillByOwnerAndSlug,
  findPublicOwnedSkillByProtocolName,
  getSkillFileContent,
  listPublicOwnedSkills,
  listSkillFilePaths,
} from '../services/skill-service';

export const wellknownRoute = new Hono();
export const capabilityWellknownRoute = new Hono();
export const packageWellknownRoute = new Hono();

const isUnsafePath = (p: string) => !p || p.includes('..') || p.startsWith('/');

// GET /.well-known/agent-skills/index.json
wellknownRoute.get('/agent-skills/index.json', async (c) => {
  const rows = await listPublicOwnedSkills();

  const entries = await Promise.all(
    rows.map(async (s) => {
      return {
        name: skillProtocolName(s.ownerHandle, s.slug),
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
// Two URL shapes supported in one handler:
//   2 segments -> protocol `<skill-name>/<file>`
//   3+ segments -> canonical `<owner>/<slug>/<file...>`
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
    [slug, filePath] = segments as [string, string];
  } else {
    [ownerName, slug] = segments;
    filePath = segments.slice(2).join('/');
  }
  if (!slug) return c.text('Slug required', 400);
  if (isUnsafePath(filePath)) return c.text('Invalid path', 400);

  const skill = ownerName
    ? await findPublicOwnedSkillByOwnerAndSlug(ownerName, slug)
    : await findPublicOwnedSkillByProtocolName(slug);
  if (!skill) return c.notFound();

  const content = await getSkillFileContent(skill.id, filePath);
  if (content === null) return c.notFound();

  if (filePath.toLowerCase() === 'skill.md') {
    await recordSkillInstall(skill.id, 'well-known', {
      ip: c.req.header('x-forwarded-for') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
    });
  }

  c.header('Content-Type', mimeFromPath(filePath));
  return c.body(content);
};

// GET /i/:token/.well-known/agent-skills/index.json
capabilityWellknownRoute.get('/:token/.well-known/agent-skills/index.json', async (c) => {
  const token = c.req.param('token');
  const grant = await peekGrantSkill(token);
  if (!grant) return c.notFound();

  const files = await listSkillFilePaths(grant.skillId);
  if (!files.some((f) => f === 'SKILL.md')) return c.notFound();

  return c.json({
    skills: [
      {
        name: skillProtocolName(grant.ownerHandle, grant.skillSlug),
        description: grant.description,
        files,
      },
    ],
  });
});

// GET /i/:token/.well-known/agent-skills/:skillName/SKILL.md|other-file
const handleCapabilityFile = async (c: import('hono').Context) => {
  const token = c.req.param('token');
  const skillName = c.req.param('skillName');
  if (!token || !skillName) return c.notFound();

  const prefix = `/i/${token}/.well-known/agent-skills/${skillName}/`;
  if (!c.req.path.startsWith(prefix)) return c.text('File path required', 400);
  const filePath = c.req.path.slice(prefix.length);
  if (isUnsafePath(filePath)) return c.text('Invalid path', 400);

  const grant = await peekGrantSkillForFile(token, filePath);
  if (!grant || skillProtocolName(grant.ownerHandle, grant.skillSlug) !== skillName) {
    return c.notFound();
  }

  const result = await consumeGrant(token, grant.ownerHandle, grant.skillSlug, filePath, {
    ip: c.req.header('x-forwarded-for') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  });
  if (!result) return c.notFound();

  c.header('Content-Type', result.contentType ?? mimeFromPath(filePath));
  return c.body(result.content);
};

wellknownRoute.get('/agent-skills/:a/:b', handleAgentSkillsFile);
wellknownRoute.get('/agent-skills/:a/:b/*', handleAgentSkillsFile);
capabilityWellknownRoute.get('/:token/.well-known/agent-skills/:skillName', handleCapabilityFile);
capabilityWellknownRoute.get('/:token/.well-known/agent-skills/:skillName/*', handleCapabilityFile);

// GET /p/:owner/:packageSlug/.well-known/agent-skills/index.json
packageWellknownRoute.get('/:owner/:packageSlug/.well-known/agent-skills/index.json', async (c) => {
  const ownerHandle = c.req.param('owner');
  const packageSlug = c.req.param('packageSlug');
  const items = await listPublicPackageSkillEntries(ownerHandle, packageSlug);
  if (!items) return c.notFound();

  return c.json({
    skills: items
      .map((item) => ({
        name: item.protocolName,
        description: item.skill.description,
        files: item.files,
      }))
      .filter((entry) => entry.files.some((file) => file === 'SKILL.md')),
  });
});

const handlePackageFile = async (c: import('hono').Context) => {
  const ownerHandle = c.req.param('owner');
  const packageSlug = c.req.param('packageSlug');
  const skillName = c.req.param('skillName');
  if (!ownerHandle || !packageSlug || !skillName) return c.notFound();

  const prefix = `/p/${ownerHandle}/${packageSlug}/.well-known/agent-skills/${skillName}/`;
  if (!c.req.path.startsWith(prefix)) return c.text('File path required', 400);
  const filePath = c.req.path.slice(prefix.length);
  if (isUnsafePath(filePath)) return c.text('Invalid path', 400);

  const result = await getPublicPackageSkillFile({
    ownerHandle,
    packageSlug,
    protocolName: skillName,
    path: filePath,
  });
  if (!result) return c.notFound();

  if (filePath.toLowerCase() === 'skill.md') {
    await recordSkillInstall(result.skillId, 'well-known', {
      ip: c.req.header('x-forwarded-for') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
    });
  }

  c.header('Content-Type', mimeFromPath(filePath));
  return c.body(result.content);
};

packageWellknownRoute.get(
  '/:owner/:packageSlug/.well-known/agent-skills/:skillName',
  handlePackageFile,
);
packageWellknownRoute.get(
  '/:owner/:packageSlug/.well-known/agent-skills/:skillName/*',
  handlePackageFile,
);
