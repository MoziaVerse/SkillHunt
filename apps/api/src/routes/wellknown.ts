import { Hono } from 'hono';
import { skillProtocolName } from '../lib/protocol-name';
import { createSkillFileResponse } from '../lib/skill-file-response';
import {
  consumeGrant,
  peekGrantSkill,
  peekGrantSkillForFile,
} from '../services/install-grant-service';
import { recordSkillInstall } from '../services/install-stats-service';
import {
  getPublicPackageReleaseSkillFile,
  getPublicPackageSkillFile,
  listPublicPackageReleaseSkillEntries,
  listPublicPackageSkillEntries,
} from '../services/skill-package-service';
import {
  findPublicOwnedSkillByOwnerAndSlug,
  findPublicOwnedSkillByProtocolName,
  getSkillFilePayload,
  listPublicOwnedSkills,
  listSkillFilePaths,
} from '../services/skill-service';

export const wellknownRoute = new Hono();
export const capabilityWellknownRoute = new Hono();
export const packageWellknownRoute = new Hono();

const isUnsafePath = (p: string) => !p || p.includes('..') || p.startsWith('/');
const PUBLIC_WELL_KNOWN_PREFIXES = ['/.well-known/agent-skills/', '/.well-known/skills/'] as const;

// GET /.well-known/agent-skills/index.json
// GET /.well-known/skills/index.json
const handlePublicIndex = async (c: import('hono').Context) => {
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
};

wellknownRoute.get('/agent-skills/index.json', handlePublicIndex);
wellknownRoute.get('/skills/index.json', handlePublicIndex);

// GET /.well-known/agent-skills/<...>/SKILL.md|other-file
// GET /.well-known/skills/<...>/SKILL.md|other-file
//
// Two URL shapes supported in one handler:
//   2 segments -> protocol `<skill-name>/<file>`
//   3+ segments -> canonical `<owner>/<slug>/<file...>`
//
// Two routes both calling the same handler — covers `/A/B`, `/A/B/C`, `/A/B/C/D`.
const handleAgentSkillsFile = async (c: import('hono').Context) => {
  const prefix = PUBLIC_WELL_KNOWN_PREFIXES.find((p) => c.req.path.startsWith(p));
  if (!prefix) return c.notFound();
  const tail = c.req.path.slice(prefix.length);
  const segments = tail.split('/').filter((s) => s.length > 0);
  if (segments.length < 2) return c.text('File path required', 400);

  let skill: Awaited<ReturnType<typeof findPublicOwnedSkillByOwnerAndSlug>> | null = null;
  let filePath = '';

  if (segments.length >= 3) {
    const [ownerName, slug] = segments;
    if (ownerName && slug) {
      skill = await findPublicOwnedSkillByOwnerAndSlug(ownerName, slug);
      if (skill) filePath = segments.slice(2).join('/');
    }
  }

  if (!skill) {
    const [protocolName] = segments;
    if (!protocolName) return c.text('Slug required', 400);
    skill = await findPublicOwnedSkillByProtocolName(protocolName);
    filePath = segments.slice(1).join('/');
  }

  if (isUnsafePath(filePath)) return c.text('Invalid path', 400);
  if (!skill) return c.notFound();

  const file = await getSkillFilePayload(skill.id, filePath);
  if (!file) return c.notFound();

  if (filePath.toLowerCase() === 'skill.md') {
    await recordSkillInstall(skill.id, 'well-known', {
      ip: c.req.header('x-forwarded-for') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
    });
  }

  return createSkillFileResponse(file);
};

// GET /i/:token/.well-known/agent-skills/index.json
// GET /i/:token/.well-known/skills/index.json
const handleCapabilityIndex = async (c: import('hono').Context) => {
  const token = c.req.param('token');
  if (!token) return c.notFound();
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
};

capabilityWellknownRoute.get('/:token/.well-known/agent-skills/index.json', handleCapabilityIndex);
capabilityWellknownRoute.get('/:token/.well-known/skills/index.json', handleCapabilityIndex);

// GET /i/:token/.well-known/agent-skills/:skillName/SKILL.md|other-file
// GET /i/:token/.well-known/skills/:skillName/SKILL.md|other-file
const handleCapabilityFile = async (c: import('hono').Context) => {
  const token = c.req.param('token');
  const skillName = c.req.param('skillName');
  if (!token || !skillName) return c.notFound();

  const prefix = [
    `/i/${token}/.well-known/agent-skills/${skillName}/`,
    `/i/${token}/.well-known/skills/${skillName}/`,
  ].find((p) => c.req.path.startsWith(p));
  if (!prefix) return c.text('File path required', 400);
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

  return createSkillFileResponse(result);
};

wellknownRoute.get('/agent-skills/:a/:b', handleAgentSkillsFile);
wellknownRoute.get('/agent-skills/:a/:b/*', handleAgentSkillsFile);
wellknownRoute.get('/skills/:a/:b', handleAgentSkillsFile);
wellknownRoute.get('/skills/:a/:b/*', handleAgentSkillsFile);
capabilityWellknownRoute.get('/:token/.well-known/agent-skills/:skillName', handleCapabilityFile);
capabilityWellknownRoute.get('/:token/.well-known/agent-skills/:skillName/*', handleCapabilityFile);
capabilityWellknownRoute.get('/:token/.well-known/skills/:skillName', handleCapabilityFile);
capabilityWellknownRoute.get('/:token/.well-known/skills/:skillName/*', handleCapabilityFile);

// GET /p/:owner/:packageSlug/.well-known/agent-skills/index.json
// GET /p/:owner/:packageSlug/.well-known/skills/index.json
const handlePackageIndex = async (c: import('hono').Context) => {
  const ownerHandle = c.req.param('owner');
  const packageSlug = c.req.param('packageSlug');
  if (!ownerHandle || !packageSlug) return c.notFound();
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
};

packageWellknownRoute.get(
  '/:owner/:packageSlug/.well-known/agent-skills/index.json',
  handlePackageIndex,
);
packageWellknownRoute.get('/:owner/:packageSlug/.well-known/skills/index.json', handlePackageIndex);

// GET /p/:owner/:packageSlug/v/:version/.well-known/agent-skills/index.json
// GET /p/:owner/:packageSlug/v/:version/.well-known/skills/index.json
const handlePackageVersionIndex = async (c: import('hono').Context) => {
  const ownerHandle = c.req.param('owner');
  const packageSlug = c.req.param('packageSlug');
  const version = Number(c.req.param('version'));
  if (!ownerHandle || !packageSlug || !Number.isInteger(version) || version < 1) {
    return c.notFound();
  }
  const items = await listPublicPackageReleaseSkillEntries(ownerHandle, packageSlug, version);
  if (!items) return c.notFound();

  return c.json({
    skills: items.map((item) => ({
      name: item.protocolName,
      description: item.skillDescription,
      files: item.files,
    })),
  });
};

packageWellknownRoute.get(
  '/:owner/:packageSlug/v/:version/.well-known/agent-skills/index.json',
  handlePackageVersionIndex,
);
packageWellknownRoute.get(
  '/:owner/:packageSlug/v/:version/.well-known/skills/index.json',
  handlePackageVersionIndex,
);

const handlePackageFile = async (c: import('hono').Context) => {
  const ownerHandle = c.req.param('owner');
  const packageSlug = c.req.param('packageSlug');
  const skillName = c.req.param('skillName');
  if (!ownerHandle || !packageSlug || !skillName) return c.notFound();

  const prefix = [
    `/p/${ownerHandle}/${packageSlug}/.well-known/agent-skills/${skillName}/`,
    `/p/${ownerHandle}/${packageSlug}/.well-known/skills/${skillName}/`,
  ].find((p) => c.req.path.startsWith(p));
  if (!prefix) return c.text('File path required', 400);
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

  return createSkillFileResponse(result.file);
};

const handlePackageVersionFile = async (c: import('hono').Context) => {
  const ownerHandle = c.req.param('owner');
  const packageSlug = c.req.param('packageSlug');
  const version = Number(c.req.param('version'));
  const skillName = c.req.param('skillName');
  if (!ownerHandle || !packageSlug || !Number.isInteger(version) || version < 1 || !skillName) {
    return c.notFound();
  }

  const prefix = [
    `/p/${ownerHandle}/${packageSlug}/v/${version}/.well-known/agent-skills/${skillName}/`,
    `/p/${ownerHandle}/${packageSlug}/v/${version}/.well-known/skills/${skillName}/`,
  ].find((p) => c.req.path.startsWith(p));
  if (!prefix) return c.text('File path required', 400);
  const filePath = c.req.path.slice(prefix.length);
  if (isUnsafePath(filePath)) return c.text('Invalid path', 400);

  const result = await getPublicPackageReleaseSkillFile({
    ownerHandle,
    packageSlug,
    version,
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

  return createSkillFileResponse(result.file);
};

packageWellknownRoute.get(
  '/:owner/:packageSlug/.well-known/agent-skills/:skillName',
  handlePackageFile,
);
packageWellknownRoute.get(
  '/:owner/:packageSlug/.well-known/agent-skills/:skillName/*',
  handlePackageFile,
);
packageWellknownRoute.get('/:owner/:packageSlug/.well-known/skills/:skillName', handlePackageFile);
packageWellknownRoute.get(
  '/:owner/:packageSlug/.well-known/skills/:skillName/*',
  handlePackageFile,
);
packageWellknownRoute.get(
  '/:owner/:packageSlug/v/:version/.well-known/agent-skills/:skillName',
  handlePackageVersionFile,
);
packageWellknownRoute.get(
  '/:owner/:packageSlug/v/:version/.well-known/agent-skills/:skillName/*',
  handlePackageVersionFile,
);
packageWellknownRoute.get(
  '/:owner/:packageSlug/v/:version/.well-known/skills/:skillName',
  handlePackageVersionFile,
);
packageWellknownRoute.get(
  '/:owner/:packageSlug/v/:version/.well-known/skills/:skillName/*',
  handlePackageVersionFile,
);
