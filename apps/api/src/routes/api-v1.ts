import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { type InstallStats, getInstallStatsBySkill } from '../services/install-stats-service';
import {
  type SkillWithOwner,
  listSkillFilesWithContent,
  listSkillsForApi,
} from '../services/skill-service';

export const apiV1Route = new Hono();

apiV1Route.use('*', async (c, next) => {
  const configuredKeys = (process.env.SKILLS_API_KEYS ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  const authorization = c.req.header('authorization');
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (configuredKeys.length > 0 && (!bearer || !configuredKeys.includes(bearer))) {
    return c.json(error('invalid_api_key', 'Invalid or revoked API key.'), 401);
  }
  await next();
});

type V1Skill = {
  id: string;
  slug: string;
  name: string;
  source: string;
  installs: number;
  sourceType: 'github' | 'well-known';
  installUrl: string | null;
  url: string;
  installsYesterday?: number;
  change?: number;
};

const parseIntQuery = (raw: string | undefined, fallback: number, min: number, max: number) => {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const error = (code: string, message: string) => ({ error: code, message });

function publicOrigin(c: import('hono').Context): string {
  return new URL(c.req.url).origin;
}

function sourceForSkill(origin: string, skill: SkillWithOwner): string {
  if (skill.type === 'referenced' && skill.sourceRepo) return skill.sourceRepo;
  return new URL(origin).host;
}

function installUrlForSkill(origin: string, skill: SkillWithOwner): string | null {
  if (skill.type === 'owned') return origin;
  if (skill.sourceUrl) return skill.sourceUrl;
  if (skill.sourceRepo) return `https://github.com/${skill.sourceRepo}`;
  return null;
}

function toV1Skill(
  origin: string,
  skill: SkillWithOwner,
  stats: InstallStats,
  view?: string,
): V1Skill {
  const source = sourceForSkill(origin, skill);
  const item: V1Skill = {
    id: `${source}/${skill.slug}`,
    slug: skill.slug,
    name: skill.name,
    source,
    installs: stats.total,
    sourceType: skill.type === 'referenced' ? 'github' : 'well-known',
    installUrl: installUrlForSkill(origin, skill),
    url: `${origin}/skills/${skill.owner.handle}/${skill.slug}`,
  };
  if (view === 'hot') {
    item.installsYesterday = stats.sameHourYesterday;
    item.change = stats.currentHour - stats.sameHourYesterday;
  }
  return item;
}

async function publicSkills() {
  return listSkillsForApi({ type: 'all', tags: [], viewerUserId: null });
}

function matchesV1Id(origin: string, skill: SkillWithOwner, id: string) {
  return `${sourceForSkill(origin, skill)}/${skill.slug}` === id;
}

async function findByV1Id(origin: string, id: string) {
  const rows = await publicSkills();
  return rows.find((skill) => matchesV1Id(origin, skill, id)) ?? null;
}

function hashFiles(files: Array<{ path: string; contents: string }>): string {
  const hash = createHash('sha256');
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(file.path);
    hash.update('\0');
    hash.update(file.contents);
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function v1SkillsForRows(origin: string, rows: SkillWithOwner[], view?: string) {
  const stats = await getInstallStatsBySkill(rows.map((skill) => skill.id));
  return rows.map((skill) => ({
    skill,
    stats: stats.get(skill.id) ?? {
      total: 0,
      recent: 0,
      currentHour: 0,
      sameHourYesterday: 0,
    },
    item: toV1Skill(
      origin,
      skill,
      stats.get(skill.id) ?? {
        total: 0,
        recent: 0,
        currentHour: 0,
        sameHourYesterday: 0,
      },
      view,
    ),
  }));
}

apiV1Route.get('/skills', async (c) => {
  const view = c.req.query('view') ?? 'all-time';
  if (!['all-time', 'trending', 'hot'].includes(view)) {
    return c.json(error('invalid_request', 'view must be all-time, trending, or hot.'), 400);
  }

  const page = parseIntQuery(c.req.query('page'), 0, 0, Number.MAX_SAFE_INTEGER);
  const perPage = parseIntQuery(c.req.query('per_page'), 100, 1, 500);
  const origin = publicOrigin(c);
  const withStats = await v1SkillsForRows(origin, await publicSkills(), view);
  const all = withStats
    .sort((a, b) => {
      if (view === 'trending') return b.stats.recent - a.stats.recent;
      if (view === 'hot') {
        return (
          b.stats.currentHour -
          b.stats.sameHourYesterday -
          (a.stats.currentHour - a.stats.sameHourYesterday)
        );
      }
      return b.stats.total - a.stats.total;
    })
    .map((entry) => entry.item);
  const start = page * perPage;
  const data = all.slice(start, start + perPage);

  c.header('Cache-Control', 'public, max-age=60');
  return c.json({
    data,
    pagination: {
      page,
      perPage,
      total: all.length,
      hasMore: start + perPage < all.length,
    },
  });
});

apiV1Route.get('/skills/search', async (c) => {
  const started = performance.now();
  const q = c.req.query('q')?.trim() ?? '';
  if (q.length < 2) {
    return c.json(error('invalid_request', 'q must be at least 2 characters.'), 400);
  }

  const limit = parseIntQuery(c.req.query('limit'), 50, 1, 200);
  const origin = publicOrigin(c);
  const wantsSemantic = /\s/.test(q);
  if (wantsSemantic && process.env.SKILLHUB_SEMANTIC_SEARCH !== '1') {
    return c.json(
      error('temporarily_unavailable', 'Semantic search is not configured for this SkillHub.'),
      503,
    );
  }

  const rows = await listSkillsForApi({ type: 'all', q, tags: [], viewerUserId: null });
  const data = (await v1SkillsForRows(origin, rows))
    .sort((a, b) => b.stats.total - a.stats.total)
    .slice(0, limit)
    .map((entry) => entry.item);

  c.header('Cache-Control', 'public, max-age=30');
  return c.json({
    data,
    query: q,
    searchType: /\s/.test(q) ? 'semantic' : 'fuzzy',
    count: data.length,
    durationMs: Math.max(0, Math.round(performance.now() - started)),
  });
});

apiV1Route.get('/skills/curated', async (c) => {
  const origin = publicOrigin(c);
  const owned = (await publicSkills()).filter((skill) => skill.type === 'owned');
  const stats = await getInstallStatsBySkill(owned.map((skill) => skill.id));
  const byOwner = new Map<string, SkillWithOwner[]>();
  for (const skill of owned) {
    const bucket = byOwner.get(skill.owner.handle) ?? [];
    bucket.push(skill);
    byOwner.set(skill.owner.handle, bucket);
  }

  const data = Array.from(byOwner.entries()).map(([owner, skills]) => {
    const featured = skills[0];
    const v1Skills = skills
      .map((skill) => ({
        skill,
        stats: stats.get(skill.id) ?? {
          total: 0,
          recent: 0,
          currentHour: 0,
          sameHourYesterday: 0,
        },
      }))
      .sort((a, b) => b.stats.total - a.stats.total)
      .map((entry) => toV1Skill(origin, entry.skill, entry.stats));
    return {
      owner,
      totalInstalls: v1Skills.reduce((sum, skill) => sum + skill.installs, 0),
      featuredRepo: featured ? sourceForSkill(origin, featured) : '',
      featuredSkill: featured?.name ?? '',
      skills: v1Skills,
    };
  });

  c.header('Cache-Control', 'public, max-age=300');
  return c.json({
    data,
    totalOwners: data.length,
    totalSkills: owned.length,
    generatedAt: new Date().toISOString(),
  });
});

apiV1Route.get('/skills/audit/*', async (c) => {
  const id = c.req.path.slice('/api/v1/skills/audit/'.length);
  const skill = await findByV1Id(publicOrigin(c), id);
  if (!skill) return c.json(error('not_found', 'Skill not found.'), 404);
  return c.json(error('not_found', 'No audits exist for this skill yet.'), 404);
});

apiV1Route.get('/skills/*', async (c) => {
  const id = c.req.path.slice('/api/v1/skills/'.length);
  const origin = publicOrigin(c);
  const skill = await findByV1Id(origin, id);
  if (!skill) return c.json(error('not_found', 'Skill not found.'), 404);
  const stats = (await getInstallStatsBySkill([skill.id])).get(skill.id) ?? {
    total: 0,
    recent: 0,
    currentHour: 0,
    sameHourYesterday: 0,
  };

  if (skill.type !== 'owned') {
    return c.json({
      id: `${sourceForSkill(origin, skill)}/${skill.slug}`,
      source: sourceForSkill(origin, skill),
      slug: skill.slug,
      installs: stats.total,
      hash: null,
      files: null,
    });
  }

  const files = (await listSkillFilesWithContent(skill.id))
    .map((file) => ({ path: file.path, contents: file.content }))
    .sort((a, b) => a.path.localeCompare(b.path));

  c.header('Cache-Control', 'public, max-age=300');
  return c.json({
    id: `${sourceForSkill(origin, skill)}/${skill.slug}`,
    source: sourceForSkill(origin, skill),
    slug: skill.slug,
    installs: stats.total,
    hash: hashFiles(files),
    files,
  });
});
