import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  contestSubmissions,
  contestUsers,
  db,
  notifications,
  publishableBookmarks,
  publishableComments,
  publishableReleases,
  publishableSubscriptions,
  publishableUpvotes,
  publishables,
  skillFiles,
  skillPackageItems,
  skillPackages,
  skillSyncEvents,
  skills,
  user,
} from '../db';
import type { AuthContext } from '../lib/auth-context';
import { VIDEO_UPLOAD_MAX_BYTES, skillListItemSchema } from '../lib/dto';
import { skillProtocolName } from '../lib/protocol-name';

const OWNER_USER_ID = 'test-owner';
const OTHER_USER_ID = 'test-other';
const OWNER_NAME = 'tester';
const OTHER_NAME = 'other';
const FULL_TEST_SCOPES = [
  'profile:read',
  'skills:read',
  'skills:read_private',
  'skills:files:read',
  'skills:install',
  'skills:write',
  'community:write',
  'notifications:read',
];

// Per-request injected auth — read a custom test header so individual cases
// can simulate "no session" vs "logged in".
//   x-test-user: <id>      → logged-in user with that id
//   (header absent)        → anonymous
const HEADER = 'x-test-user';

let mockS3Configured = false;
const mockSkillFileObjects = new Map<string, { body: Uint8Array; contentType: string | null }>();
const mockDeletedObjectKeys: string[] = [];
const mockDeleteFailures = new Set<string>();

const contestVideoObjectKey = (userId: string) =>
  `skillhunt/videos/${userId}/2026/05/demo-video.mp4`;
const skillFileObjectKey = (input: { userId: string; skillId: string; path: string }) =>
  `skillhunt/skill-files/${input.userId}/${input.skillId}/2026/05/${encodeURIComponent(
    input.path,
  )}`;

mock.module('../lib/auth-context', () => ({
  hasScope: (ctx: AuthContext, scope: AuthContext['scopes'][number]) => ctx.scopes.includes(scope),
  getAuthContext: async (c: {
    req: { header: (k: string) => string | undefined };
  }): Promise<AuthContext> => {
    const userId = c.req.header(HEADER);
    if (!userId) {
      return {
        actorType: 'anonymous',
        authMethod: 'anonymous',
        user: null,
        clientId: null,
        scopes: ['skills:read'],
      };
    }
    const scopedHeader = c.req.header('x-test-scopes');
    return {
      actorType: 'user',
      authMethod: 'cookie',
      user: {
        id: userId,
        email: `${userId}@example.com`,
        name: userId,
        ssoSub: `sso-${userId}`,
      },
      clientId: null,
      scopes: (scopedHeader
        ? scopedHeader
            .split(',')
            .map((scope) => scope.trim())
            .filter(Boolean)
        : FULL_TEST_SCOPES) as AuthContext['scopes'],
    };
  },
}));

mock.module('../services/s3-storage', () => ({
  completeUploadedSkillFile: async (
    objectKey: string,
    input: { path: string; contentType?: string | null },
  ) => {
    if (!mockS3Configured) throw new Error('S3 storage is not configured');
    const object = mockSkillFileObjects.get(objectKey);
    if (!object) throw new Error('OSS 对象校验失败：404');
    return {
      objectKey,
      size: object.body.byteLength,
      contentType: object.contentType ?? input.contentType ?? 'application/octet-stream',
    };
  },
  completeUploadedVideo: async (objectKey: string, input?: { durationSeconds?: number }) => {
    if (!mockS3Configured) throw new Error('S3 storage is not configured');
    return {
      objectKey,
      videoUrl: `https://oss.example/${objectKey}`,
      playbackUrl: `https://oss.example/${objectKey}?playback=1`,
      size: 1024,
      contentType: 'video/mp4',
      durationSeconds: input?.durationSeconds,
    };
  },
  createSkillFileUploadTicket: (input: { userId: string; skillId: string; path: string }) => {
    const objectKey = skillFileObjectKey(input);
    return {
      uploadUrl: `https://oss.example/upload/${objectKey}`,
      objectKey,
      maxSizeBytes: 5 * 1024 * 1024,
      expiresInSeconds: 900,
    };
  },
  createDemoVideoPlaybackUrl: (videoUrl: string) => `${videoUrl}?playback=1`,
  createVideoUploadTicket: (input: { userId: string; fileName: string }) => ({
    uploadUrl: `https://oss.example/upload/${input.fileName}`,
    objectKey: contestVideoObjectKey(input.userId),
    videoUrl: `https://oss.example/${contestVideoObjectKey(input.userId)}`,
    maxSizeBytes: VIDEO_UPLOAD_MAX_BYTES,
    expiresInSeconds: 900,
  }),
  deleteUploadedObject: async (objectKey: string) => {
    if (!mockS3Configured) throw new Error('S3 storage is not configured');
    mockDeletedObjectKeys.push(objectKey);
    if (mockDeleteFailures.has(objectKey)) throw new Error('OSS 对象删除失败：500');
    mockSkillFileObjects.delete(objectKey);
  },
  fetchUploadedObject: async (objectKey: string) => {
    if (!mockS3Configured) throw new Error('S3 storage is not configured');
    const object = mockSkillFileObjects.get(objectKey);
    if (!object) throw new Error('OSS 对象读取失败：404');
    return {
      body: object.body,
      size: object.body.byteLength,
      contentType: object.contentType,
    };
  },
  isS3StorageConfigured: () => mockS3Configured,
  isSkillFileObjectKeyForSkill: (objectKey: string, userId: string, skillId: string) =>
    objectKey.startsWith(`skillhunt/skill-files/${userId}/${skillId}/`),
  isVideoObjectKeyForUser: (objectKey: string, userId: string) =>
    objectKey.startsWith(`skillhunt/videos/${userId}/`),
}));

let app: Hono;

beforeAll(async () => {
  const { apiRoute } = await import('./api');
  app = new Hono().route('/api', apiRoute);
});

async function insertTestSkill(input: {
  ownerUserId: string;
  slug: string;
  name: string;
  description: string;
  type: 'owned' | 'referenced';
  visibility: 'public' | 'private';
  tags: string[];
  frontmatter?: Record<string, unknown> | null;
  sourceRepo?: string | null;
  sourceSkillName?: string | null;
  sourceInstallCommand?: string | null;
  sourceUrl?: string | null;
  demoVideoUrl?: string | null;
}) {
  const [publishable] = await db
    .insert(publishables)
    .values({
      kind: 'skill',
      ownerUserId: input.ownerUserId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      tags: input.tags,
    })
    .returning();
  if (!publishable) throw new Error('seed: publishable skill insert failed');

  const [skill] = await db
    .insert(skills)
    .values({
      id: publishable.id,
      type: input.type,
      frontmatter: input.frontmatter ?? null,
      sourceRepo: input.sourceRepo ?? null,
      sourceSkillName: input.sourceSkillName ?? null,
      sourceInstallCommand: input.sourceInstallCommand ?? null,
      sourceUrl: input.sourceUrl ?? null,
      demoVideoUrl: input.demoVideoUrl ?? null,
    })
    .returning();
  if (!skill) throw new Error('seed: skill extension insert failed');
  return { ...publishable, ...skill };
}

async function resetAndSeed() {
  mockS3Configured = false;
  mockSkillFileObjects.clear();
  mockDeletedObjectKeys.length = 0;
  mockDeleteFailures.clear();
  await db.delete(notifications);
  await db.delete(publishableBookmarks);
  await db.delete(publishableUpvotes);
  await db.delete(publishableComments);
  await db.delete(contestSubmissions);
  await db.delete(contestUsers);
  await db.delete(skillSyncEvents);
  await db.delete(publishableSubscriptions);
  await db.delete(publishableReleases);
  await db.delete(skillPackageItems);
  await db.delete(skillPackages);
  await db.delete(skills);
  await db.delete(publishables);
  await db.delete(user).where(inArray(user.id, [OWNER_USER_ID, OTHER_USER_ID]));

  await db.insert(user).values([
    {
      id: OWNER_USER_ID,
      name: OWNER_NAME,
      handle: OWNER_NAME,
      email: 'tester@example.com',
      phone: '13300001064',
      emailVerified: true,
    },
    {
      id: OTHER_USER_ID,
      name: OTHER_NAME,
      handle: OTHER_NAME,
      email: 'other@example.com',
      emailVerified: true,
    },
  ]);
  await db.insert(contestUsers).values({
    eventSlug: 'hdu-skills-2026',
    phone: '13300001064',
    status: 'eligible',
    note: '测试报名用户',
  });

  // owned + public, owned by tester
  const ownedPub = await insertTestSkill({
    slug: 'test-owned-pub',
    name: 'test-owned-pub',
    description: 'magical owned skill',
    type: 'owned',
    visibility: 'public',
    tags: ['design'],
    frontmatter: { name: 'test-owned-pub' },
    ownerUserId: OWNER_USER_ID,
    demoVideoUrl: `https://oss.example/${contestVideoObjectKey(OWNER_USER_ID)}`,
  });
  await db.insert(skillFiles).values({
    skillId: ownedPub.id,
    path: 'SKILL.md',
    content: '---\nname: test-owned-pub\n---\n# body\n',
  });

  // owned + private, owned by tester
  const ownedPriv = await insertTestSkill({
    slug: 'test-owned-priv',
    name: 'test-owned-priv',
    description: 'private only',
    type: 'owned',
    visibility: 'private',
    tags: ['writing'],
    frontmatter: { name: 'test-owned-priv' },
    ownerUserId: OWNER_USER_ID,
  });
  await db.insert(skillFiles).values([
    {
      skillId: ownedPriv.id,
      path: 'SKILL.md',
      content: '---\nname: test-owned-priv\n---\n# private body\n',
    },
    {
      skillId: ownedPriv.id,
      path: 'references/private.md',
      content: '# private reference\n',
    },
  ]);

  // referenced, owned by other
  await insertTestSkill({
    slug: 'test-ref',
    name: 'test-ref',
    description: 'referenced skill',
    type: 'referenced',
    visibility: 'public',
    tags: ['tooling'],
    sourceRepo: 'acme/repo',
    sourceSkillName: 'test-ref',
    sourceInstallCommand: 'npx skills add acme/repo --skill test-ref',
    sourceUrl: 'https://github.com/acme/repo',
    ownerUserId: OTHER_USER_ID,
  });
}

async function cleanup() {
  await db.delete(publishableBookmarks);
  await db.delete(publishableUpvotes);
  await db.delete(publishableComments);
  await db.delete(contestSubmissions);
  await db.delete(contestUsers);
  await db.delete(skillSyncEvents);
  await db.delete(publishableSubscriptions);
  await db.delete(publishableReleases);
  await db.delete(skillPackageItems);
  await db.delete(skillPackages);
  await db.delete(skills);
  await db.delete(publishables);
  await db.delete(user).where(inArray(user.id, [OWNER_USER_ID, OTHER_USER_ID]));
}

const reqAnon = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init);
const reqAsUser = (path: string, userId: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set(HEADER, userId);
  return new Request(`http://localhost${path}`, { ...init, headers });
};
const reqAsUserWithScopes = (
  path: string,
  userId: string,
  scopes: string[],
  init?: RequestInit,
) => {
  const headers = new Headers(init?.headers);
  headers.set(HEADER, userId);
  headers.set('x-test-scopes', scopes.join(','));
  return new Request(`http://localhost${path}`, { ...init, headers });
};
const jsonInit = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('business API', () => {
  beforeEach(resetAndSeed);
  afterAll(cleanup);

  describe('GET /api/skills', () => {
    it('anonymous: sees only public + referenced (private hidden)', async () => {
      const res = await app.fetch(reqAnon('/api/skills'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ slug: string }>; total: number };
      expect(body.items).toHaveLength(2);
      expect(body.items.map((i) => i.slug).sort()).toEqual(['test-owned-pub', 'test-ref']);
    });

    it('non-owner logged-in user: still cannot see other people private', async () => {
      const res = await app.fetch(reqAsUser('/api/skills', OTHER_USER_ID));
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items).toHaveLength(2);
      expect(body.items.map((i) => i.slug)).not.toContain('test-owned-priv');
    });

    it('owner sees their own private skill in list', async () => {
      const res = await app.fetch(reqAsUser('/api/skills', OWNER_USER_ID));
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items.map((i) => i.slug).sort()).toEqual([
        'test-owned-priv',
        'test-owned-pub',
        'test-ref',
      ]);
    });

    it('every list item carries owner info', async () => {
      const res = await app.fetch(reqAnon('/api/skills'));
      const body = (await res.json()) as {
        items: Array<{ slug: string; owner: { id: string; name: string } }>;
      };
      for (const it of body.items) {
        expect(it.owner).toBeDefined();
        expect(typeof it.owner.id).toBe('string');
        expect(typeof it.owner.name).toBe('string');
      }
    });

    it('type=owned filters to owned only', async () => {
      const res = await app.fetch(reqAnon('/api/skills?type=owned'));
      const body = (await res.json()) as { items: Array<{ type: string }> };
      expect(body.items.length).toBeGreaterThan(0);
      for (const it of body.items) expect(it.type).toBe('owned');
    });

    it('q filters by name / description (ILIKE)', async () => {
      const res = await app.fetch(reqAnon('/api/skills?q=magical'));
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.slug).toBe('test-owned-pub');
    });

    it('q filters by owner name', async () => {
      const res = await app.fetch(reqAnon('/api/skills?q=tester'));
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      // Only public owned skill by tester is visible to anonymous
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(body.items.some((it) => it.slug === 'test-owned-pub')).toBe(true);
    });

    it('q filters by owner handle (case-insensitive)', async () => {
      const res = await app.fetch(reqAnon('/api/skills?q=TESTER'));
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(body.items.some((it) => it.slug === 'test-owned-pub')).toBe(true);
    });

    it('response items match discriminated union schema', async () => {
      const res = await app.fetch(reqAnon('/api/skills'));
      const body = (await res.json()) as { items: unknown[] };
      for (const item of body.items) {
        const parsed = skillListItemSchema.safeParse(item);
        expect(parsed.success).toBe(true);
      }
    });
  });

  describe('GET /api/skills/:owner/:slug (canonical)', () => {
    it('owned public skill returns skillMdContent + generic installCommand + id', async () => {
      const res = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub`));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        id: string;
        type: string;
        skillMdContent: string;
        installCommand: string;
        files: string[];
      };
      expect(body.id).toBeDefined();
      expect(typeof body.id).toBe('string');
      expect(body.type).toBe('owned');
      expect(body.skillMdContent).toContain('body');
      expect(body.installCommand).toBe(
        `npx skills add http://localhost --skill ${skillProtocolName(
          OWNER_NAME,
          'test-owned-pub',
        )}`,
      );
      expect(body.files).toContain('SKILL.md');
    });

    it('referenced skill returns sourceInstallCommand + sourceUrl', async () => {
      const res = await app.fetch(reqAnon(`/api/skills/${OTHER_NAME}/test-ref`));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        type: string;
        sourceInstallCommand: string;
        sourceUrl: string | null;
      };
      expect(body.type).toBe('referenced');
      expect(body.sourceInstallCommand).toBe('npx skills add acme/repo --skill test-ref');
    });

    it('private skill returns 404 to anonymous', async () => {
      const res = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-priv`));
      expect(res.status).toBe(404);
    });

    it('private skill returns 404 to a logged-in non-owner', async () => {
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-priv`, OTHER_USER_ID),
      );
      expect(res.status).toBe(404);
    });

    it('private skill returns 200 to its owner', async () => {
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-priv`, OWNER_USER_ID),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { visibility: string; owner: { name: string } };
      expect(body.visibility).toBe('private');
      expect(body.owner.name).toBe(OWNER_NAME);
    });

    it('non-existent slug returns 404', async () => {
      const res = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/no-such`));
      expect(res.status).toBe(404);
    });

    it('wrong owner for an existing slug returns 404 (no leak)', async () => {
      const res = await app.fetch(reqAnon(`/api/skills/${OTHER_NAME}/test-owned-pub`));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/tags', () => {
    it('returns tags from public + referenced only (private tags hidden)', async () => {
      const res = await app.fetch(reqAnon('/api/tags'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { tags: string[] };
      expect(body.tags.sort()).toEqual(['design', 'tooling']);
      expect(body.tags).not.toContain('writing');
    });
  });

  describe('Skill Package API', () => {
    async function publicSkillId() {
      const res = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub`));
      const body = (await res.json()) as { id: string };
      return body.id;
    }

    async function privateSkillId() {
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-priv`, OWNER_USER_ID),
      );
      const body = (await res.json()) as { id: string };
      return body.id;
    }

    it('creates a public package with an install command tailored for npx skills', async () => {
      const skillId = await publicSkillId();
      const res = await app.fetch(
        reqAsUser(
          '/api/packages',
          OWNER_USER_ID,
          jsonInit({
            owner: OWNER_NAME,
            slug: 'case-suite',
            name: '案件处理工作包',
            description: '一次安装案件处理相关 skills',
            visibility: 'public',
            tags: ['case'],
            skillIds: [skillId],
          }),
        ),
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        slug: string;
        installCommand: string;
        skills: Array<{ protocolName: string; skill: { slug: string } }>;
      };
      expect(body.slug).toBe('case-suite');
      expect(body.installCommand).toBe(
        `npx skills add http://localhost/p/${OWNER_NAME}/case-suite --skill '*' -y`,
      );
      expect(body.skills).toHaveLength(1);
      expect(body.skills[0]?.protocolName).toBe(skillProtocolName(OWNER_NAME, 'test-owned-pub'));
    });

    it('lists skills and packages through the unified publishables API', async () => {
      const skillId = await publicSkillId();
      const created = await app.fetch(
        reqAsUser(
          '/api/packages',
          OWNER_USER_ID,
          jsonInit({
            owner: OWNER_NAME,
            slug: 'publishable-suite',
            name: '统一发现工作包',
            description: '用于测试统一内容列表',
            visibility: 'public',
            tags: ['case'],
            skillIds: [skillId],
          }),
        ),
      );
      expect(created.status).toBe(201);

      const all = await app.fetch(reqAnon('/api/publishables?sort=recent&limit=20'));
      expect(all.status).toBe(200);
      const allBody = (await all.json()) as {
        items: Array<{ kind: 'skill' | 'package'; item: { slug: string } }>;
        total: number;
      };
      expect(allBody.items.some((item) => item.kind === 'skill')).toBe(true);
      expect(
        allBody.items.some(
          (item) => item.kind === 'package' && item.item.slug === 'publishable-suite',
        ),
      ).toBe(true);

      const packagesOnly = await app.fetch(reqAnon('/api/publishables?kind=package'));
      const packagesBody = (await packagesOnly.json()) as {
        items: Array<{ kind: string; item: { slug: string } }>;
      };
      expect(packagesBody.items.every((item) => item.kind === 'package')).toBe(true);
      expect(packagesBody.items.map((item) => item.item.slug)).toContain('publishable-suite');
    });

    it('publishes package releases with changelog and versioned install command', async () => {
      const skillId = await publicSkillId();
      const created = await app.fetch(
        reqAsUser(
          '/api/packages',
          OWNER_USER_ID,
          jsonInit({
            owner: OWNER_NAME,
            slug: 'versioned-suite',
            name: '可版本化工作包',
            description: '用于测试包版本',
            visibility: 'public',
            tags: ['case'],
            skillIds: [skillId],
            releaseChangelog: '创建第一个可安装包版本。',
          }),
        ),
      );
      expect(created.status).toBe(201);

      const firstList = await app.fetch(
        reqAnon(`/api/packages/${OWNER_NAME}/versioned-suite/releases`),
      );
      expect(firstList.status).toBe(200);
      const firstBody = (await firstList.json()) as {
        items: Array<{ version: number; changelog: string; installCommand: string }>;
      };
      expect(firstBody.items[0]?.version).toBe(1);
      expect(firstBody.items[0]?.changelog).toBe('创建第一个可安装包版本。');
      expect(firstBody.items[0]?.installCommand).toBe(
        `npx skills add http://localhost/p/${OWNER_NAME}/versioned-suite/v/1 --skill '*' -y`,
      );

      const second = await app.fetch(
        reqAsUser(
          `/api/packages/${OWNER_NAME}/versioned-suite/releases`,
          OWNER_USER_ID,
          jsonInit({ title: '补充说明', changelog: '更新包内说明。' }),
        ),
      );
      expect(second.status).toBe(201);
      const secondBody = (await second.json()) as { version: number; changelog: string };
      expect(secondBody.version).toBe(2);
      expect(secondBody.changelog).toBe('更新包内说明。');
    });

    it('lists public packages for anonymous users', async () => {
      const skillId = await publicSkillId();
      await app.fetch(
        reqAsUser(
          '/api/packages',
          OWNER_USER_ID,
          jsonInit({
            owner: OWNER_NAME,
            slug: 'public-suite',
            name: '公开工作包',
            description: '公开发现和安装',
            visibility: 'public',
            tags: [],
            skillIds: [skillId],
          }),
        ),
      );

      const res = await app.fetch(reqAnon('/api/packages'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ slug: string; skillCount: number }> };
      expect(body.items.map((item) => item.slug)).toContain('public-suite');
      expect(body.items.find((item) => item.slug === 'public-suite')?.skillCount).toBe(1);
    });

    it('lists packages that include a skill with package visibility rules', async () => {
      const skillId = await publicSkillId();
      for (const pkg of [
        { slug: 'listed-public-suite', visibility: 'public' },
        { slug: 'listed-private-suite', visibility: 'private' },
      ] as const) {
        const created = await app.fetch(
          reqAsUser(
            '/api/packages',
            OWNER_USER_ID,
            jsonInit({
              owner: OWNER_NAME,
              slug: pkg.slug,
              name: pkg.visibility === 'public' ? '公开收录包' : '私有收录包',
              description: '用于测试 skill 的收录包列表',
              visibility: pkg.visibility,
              tags: [],
              skillIds: [skillId],
            }),
          ),
        );
        expect(created.status).toBe(201);
      }

      const anon = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub/packages`));
      expect(anon.status).toBe(200);
      const anonBody = (await anon.json()) as { items: Array<{ slug: string }>; total: number };
      expect(anonBody.items.map((item) => item.slug)).toContain('listed-public-suite');
      expect(anonBody.items.map((item) => item.slug)).not.toContain('listed-private-suite');

      const owner = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/packages`, OWNER_USER_ID),
      );
      expect(owner.status).toBe(200);
      const ownerBody = (await owner.json()) as {
        items: Array<{ slug: string; skillCount: number; installCommand: string }>;
      };
      expect(ownerBody.items.map((item) => item.slug)).toContain('listed-public-suite');
      expect(ownerBody.items.map((item) => item.slug)).toContain('listed-private-suite');
      expect(ownerBody.items.find((item) => item.slug === 'listed-public-suite')?.skillCount).toBe(
        1,
      );
      expect(
        ownerBody.items.find((item) => item.slug === 'listed-public-suite')?.installCommand,
      ).toBe(`npx skills add http://localhost/p/${OWNER_NAME}/listed-public-suite --skill '*' -y`);
    });

    it('sorts packages by package community activity', async () => {
      const skillId = await publicSkillId();
      for (const slug of ['quiet-suite', 'hot-suite']) {
        const created = await app.fetch(
          reqAsUser(
            '/api/packages',
            OWNER_USER_ID,
            jsonInit({
              owner: OWNER_NAME,
              slug,
              name: slug === 'hot-suite' ? '热门工作包' : '普通工作包',
              description: '用于测试包热门排序',
              visibility: 'public',
              tags: [],
              skillIds: [skillId],
            }),
          ),
        );
        expect(created.status).toBe(201);
      }

      await app.fetch(
        reqAsUser(`/api/packages/${OWNER_NAME}/hot-suite/upvote`, OTHER_USER_ID, {
          method: 'POST',
        }),
      );
      await app.fetch(
        reqAsUser(`/api/packages/${OWNER_NAME}/hot-suite/bookmark`, OTHER_USER_ID, {
          method: 'POST',
        }),
      );
      await app.fetch(
        reqAsUser(
          `/api/packages/${OWNER_NAME}/hot-suite/comments`,
          OTHER_USER_ID,
          jsonInit({ content: '这个包值得推荐。' }),
        ),
      );

      const res = await app.fetch(reqAsUser('/api/packages?sort=hottest', OTHER_USER_ID));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        items: Array<{
          slug: string;
          upvoteCount: number;
          commentCount: number;
          bookmarkCount: number;
          viewerHasUpvoted: boolean;
          viewerHasBookmarked: boolean;
        }>;
      };
      expect(body.items[0]?.slug).toBe('hot-suite');
      expect(body.items[0]?.upvoteCount).toBe(1);
      expect(body.items[0]?.commentCount).toBe(1);
      expect(body.items[0]?.bookmarkCount).toBe(1);
      expect(body.items[0]?.viewerHasUpvoted).toBe(true);
      expect(body.items[0]?.viewerHasBookmarked).toBe(true);
    });

    it('hides private packages from anonymous users', async () => {
      await app.fetch(
        reqAsUser(
          '/api/packages',
          OWNER_USER_ID,
          jsonInit({
            owner: OWNER_NAME,
            slug: 'private-suite',
            name: '私有工作包',
            description: '仅自己可见',
            visibility: 'private',
            tags: [],
            skillIds: [],
          }),
        ),
      );

      const hidden = await app.fetch(reqAnon(`/api/packages/${OWNER_NAME}/private-suite`));
      expect(hidden.status).toBe(404);

      const ownerView = await app.fetch(
        reqAsUser(`/api/packages/${OWNER_NAME}/private-suite`, OWNER_USER_ID),
      );
      expect(ownerView.status).toBe(200);
    });

    it('rejects private skills in public packages', async () => {
      const skillId = await privateSkillId();
      const res = await app.fetch(
        reqAsUser(
          '/api/packages',
          OWNER_USER_ID,
          jsonInit({
            owner: OWNER_NAME,
            slug: 'bad-suite',
            name: '错误工作包',
            description: '不能公开私有 skill',
            visibility: 'public',
            tags: [],
            skillIds: [skillId],
          }),
        ),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('private_skill_in_public_package');
    });

    it('adds and removes package items', async () => {
      const skillId = await publicSkillId();
      const created = await app.fetch(
        reqAsUser(
          '/api/packages',
          OWNER_USER_ID,
          jsonInit({
            owner: OWNER_NAME,
            slug: 'editable-suite',
            name: '可编辑工作包',
            description: '用于测试添加和移除',
            visibility: 'public',
            tags: [],
            skillIds: [],
          }),
        ),
      );
      expect(created.status).toBe(201);

      const added = await app.fetch(
        reqAsUser(
          `/api/packages/${OWNER_NAME}/editable-suite/items`,
          OWNER_USER_ID,
          jsonInit({ skillId }),
        ),
      );
      expect(added.status).toBe(201);
      const addedBody = (await added.json()) as { skills: Array<{ itemId: string }> };
      expect(addedBody.skills).toHaveLength(1);

      const itemId = addedBody.skills[0]?.itemId;
      if (!itemId) throw new Error('expected package item id');
      const deleted = await app.fetch(
        reqAsUser(`/api/packages/${OWNER_NAME}/editable-suite/items/${itemId}`, OWNER_USER_ID, {
          method: 'DELETE',
        }),
      );
      expect(deleted.status).toBe(204);
    });

    it('supports package upvotes, bookmarks and comments', async () => {
      const skillId = await publicSkillId();
      const created = await app.fetch(
        reqAsUser(
          '/api/packages',
          OWNER_USER_ID,
          jsonInit({
            owner: OWNER_NAME,
            slug: 'community-suite',
            name: '可互动工作包',
            description: '用于测试包互动',
            visibility: 'public',
            tags: [],
            skillIds: [skillId],
          }),
        ),
      );
      expect(created.status).toBe(201);

      const upvoted = await app.fetch(
        reqAsUser(`/api/packages/${OWNER_NAME}/community-suite/upvote`, OTHER_USER_ID, {
          method: 'POST',
        }),
      );
      expect(upvoted.status).toBe(200);
      const upvotedBody = (await upvoted.json()) as {
        upvoteCount: number;
        viewerHasUpvoted: boolean;
      };
      expect(upvotedBody.upvoteCount).toBe(1);
      expect(upvotedBody.viewerHasUpvoted).toBe(true);

      const bookmarked = await app.fetch(
        reqAsUser(`/api/packages/${OWNER_NAME}/community-suite/bookmark`, OTHER_USER_ID, {
          method: 'POST',
        }),
      );
      expect(bookmarked.status).toBe(200);
      const bookmarkedBody = (await bookmarked.json()) as {
        bookmarkCount: number;
        viewerHasBookmarked: boolean;
      };
      expect(bookmarkedBody.bookmarkCount).toBe(1);
      expect(bookmarkedBody.viewerHasBookmarked).toBe(true);

      const comment = await app.fetch(
        reqAsUser(
          `/api/packages/${OWNER_NAME}/community-suite/comments`,
          OTHER_USER_ID,
          jsonInit({ content: '这个包很适合直接安装。' }),
        ),
      );
      expect(comment.status).toBe(201);
      const commentBody = (await comment.json()) as { id: string; packageId: string };
      expect(commentBody.id).toBeTruthy();
      expect(commentBody.packageId).toBeTruthy();

      const comments = await app.fetch(
        reqAnon(`/api/packages/${OWNER_NAME}/community-suite/comments`),
      );
      expect(comments.status).toBe(200);
      const commentsBody = (await comments.json()) as { total: number };
      expect(commentsBody.total).toBe(1);

      const detail = await app.fetch(
        reqAsUser(`/api/packages/${OWNER_NAME}/community-suite`, OTHER_USER_ID),
      );
      expect(detail.status).toBe(200);
      const detailBody = (await detail.json()) as {
        upvoteCount: number;
        commentCount: number;
        bookmarkCount: number;
        viewerHasUpvoted: boolean;
        viewerHasBookmarked: boolean;
      };
      expect(detailBody.upvoteCount).toBe(1);
      expect(detailBody.commentCount).toBe(1);
      expect(detailBody.bookmarkCount).toBe(1);
      expect(detailBody.viewerHasUpvoted).toBe(true);
      expect(detailBody.viewerHasBookmarked).toBe(true);
    });
  });

  describe('POST /api/uploads/videos', () => {
    const validBody = {
      fileName: 'demo.mp4',
      contentType: 'video/mp4',
      size: 1024,
    };

    it('rejects anonymous users', async () => {
      const res = await app.fetch(reqAnon('/api/uploads/videos', jsonInit(validBody)));
      expect(res.status).toBe(401);
    });

    it('rejects non-video content types', async () => {
      const res = await app.fetch(
        reqAsUser(
          '/api/uploads/videos',
          OWNER_USER_ID,
          jsonInit({ ...validBody, contentType: 'image/png' }),
        ),
      );
      expect(res.status).toBe(400);
    });

    it('rejects videos larger than 500MB', async () => {
      const res = await app.fetch(
        reqAsUser(
          '/api/uploads/videos',
          OWNER_USER_ID,
          jsonInit({ ...validBody, size: VIDEO_UPLOAD_MAX_BYTES + 1 }),
        ),
      );
      expect(res.status).toBe(400);
    });

    it('returns 503 when OSS is not configured', async () => {
      const res = await app.fetch(
        reqAsUser('/api/uploads/videos', OWNER_USER_ID, jsonInit(validBody)),
      );
      expect(res.status).toBe(503);
    });
  });

  // ─── Mutations ──────────────────────────────────────────────────────

  describe('POST /api/skills', () => {
    const validBody = {
      owner: OWNER_NAME,
      slug: 'new-skill',
      name: 'New Skill',
      description: 'a brand new skill from a test',
      tags: ['demo'],
      visibility: 'public' as const,
      skillMdContent: '---\nname: new-skill\n---\n# body of new skill\n',
    };

    it('rejects anonymous (401)', async () => {
      const res = await app.fetch(reqAnon('/api/skills', jsonInit(validBody)));
      expect(res.status).toBe(401);
    });

    it('rejects when owner != logged-in user (403)', async () => {
      const res = await app.fetch(
        reqAsUser('/api/skills', OTHER_USER_ID, jsonInit({ ...validBody, owner: OWNER_NAME })),
      );
      expect(res.status).toBe(403);
    });

    it('creates a skill for logged-in owner (201)', async () => {
      const res = await app.fetch(reqAsUser('/api/skills', OWNER_USER_ID, jsonInit(validBody)));
      expect(res.status).toBe(201);
      const body = (await res.json()) as { slug: string; owner: { name: string } };
      expect(body.slug).toBe('new-skill');
      expect(body.owner.name).toBe(OWNER_NAME);
    });

    it('rejects duplicate (owner, slug) (409)', async () => {
      const res = await app.fetch(
        reqAsUser('/api/skills', OWNER_USER_ID, jsonInit({ ...validBody, slug: 'test-owned-pub' })),
      );
      expect(res.status).toBe(409);
    });

    it('rejects invalid slug format (400)', async () => {
      const res = await app.fetch(
        reqAsUser('/api/skills', OWNER_USER_ID, jsonInit({ ...validBody, slug: 'Has Spaces' })),
      );
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/skills/:owner/:slug', () => {
    const patch = { description: 'updated desc' };

    it('rejects anonymous (401)', async () => {
      const res = await app.fetch(
        reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub`, jsonInit(patch, 'PUT')),
      );
      expect(res.status).toBe(401);
    });

    it('rejects non-owner (403)', async () => {
      const res = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub`,
          OTHER_USER_ID,
          jsonInit(patch, 'PUT'),
        ),
      );
      expect(res.status).toBe(403);
    });

    it('updates fields for owner (200)', async () => {
      const res = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub`,
          OWNER_USER_ID,
          jsonInit(patch, 'PUT'),
        ),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { description: string };
      expect(body.description).toBe('updated desc');
    });

    it('does not create a release for metadata-only edits without changelog', async () => {
      const res = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub`,
          OWNER_USER_ID,
          jsonInit({ visibility: 'private', tags: ['metadata-only'] }, 'PUT'),
        ),
      );
      expect(res.status).toBe(200);

      const releases = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/releases`, OWNER_USER_ID),
      );
      const body = (await releases.json()) as { total: number; items: unknown[] };
      expect(body.total).toBe(0);
      expect(body.items).toHaveLength(0);
    });

    it('creates a release when an edit includes changelog', async () => {
      const res = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub`,
          OWNER_USER_ID,
          jsonInit(
            {
              skillMdContent: '---\nname: test-owned-pub\n---\n# changed body\n',
              releaseTitle: '更新 Skill 内容',
              releaseChangelog: '调整 Agent 使用说明。',
            },
            'PUT',
          ),
        ),
      );
      expect(res.status).toBe(200);

      const releases = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/releases`, OWNER_USER_ID),
      );
      const body = (await releases.json()) as {
        total: number;
        items: Array<{ title: string; changelog: string }>;
      };
      expect(body.total).toBe(1);
      expect(body.items[0]?.title).toBe('更新 Skill 内容');
      expect(body.items[0]?.changelog).toBe('调整 Agent 使用说明。');
    });

    it('refuses to edit a referenced skill (400)', async () => {
      // owner of referenced is OTHER; they can authorize but business rule blocks.
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OTHER_NAME}/test-ref`, OTHER_USER_ID, jsonInit(patch, 'PUT')),
      );
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/skills/:owner/:slug', () => {
    it('rejects non-owner (403)', async () => {
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub`, OTHER_USER_ID, { method: 'DELETE' }),
      );
      expect(res.status).toBe(403);
    });

    it('owner can delete; subsequent GET 404', async () => {
      const del = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub`, OWNER_USER_ID, { method: 'DELETE' }),
      );
      expect(del.status).toBe(204);
      const get = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub`));
      expect(get.status).toBe(404);
    });

    it('owner delete cleans current OSS file objects', async () => {
      mockS3Configured = true;
      const skillRes = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub`));
      const skill = (await skillRes.json()) as { id: string };
      const objectKey = skillFileObjectKey({
        userId: OWNER_USER_ID,
        skillId: skill.id,
        path: 'references/ppt/assets/background.webp',
      });
      mockSkillFileObjects.set(objectKey, {
        body: Uint8Array.of(1, 2, 3),
        contentType: 'image/webp',
      });
      await db.insert(skillFiles).values({
        skillId: skill.id,
        path: 'references/ppt/assets/background.webp',
        content: '',
        storageKind: 'oss',
        objectKey,
        contentType: 'image/webp',
        sizeBytes: 3,
      });

      const del = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub`, OWNER_USER_ID, { method: 'DELETE' }),
      );

      expect(del.status).toBe(204);
      expect(mockDeletedObjectKeys).toEqual([objectKey]);
      expect(mockSkillFileObjects.has(objectKey)).toBe(false);
    });

    it('owner delete succeeds even when OSS cleanup fails', async () => {
      mockS3Configured = true;
      const originalWarn = console.warn;
      const warnings: unknown[][] = [];
      console.warn = (...args: unknown[]) => {
        warnings.push(args);
      };

      try {
        const skillRes = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub`));
        const skill = (await skillRes.json()) as { id: string };
        const objectKey = skillFileObjectKey({
          userId: OWNER_USER_ID,
          skillId: skill.id,
          path: 'assets/failed-cleanup.webp',
        });
        mockDeleteFailures.add(objectKey);
        mockSkillFileObjects.set(objectKey, {
          body: Uint8Array.of(9, 9, 9),
          contentType: 'image/webp',
        });
        await db.insert(skillFiles).values({
          skillId: skill.id,
          path: 'assets/failed-cleanup.webp',
          content: '',
          storageKind: 'oss',
          objectKey,
          contentType: 'image/webp',
          sizeBytes: 3,
        });

        const del = await app.fetch(
          reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub`, OWNER_USER_ID, {
            method: 'DELETE',
          }),
        );
        const get = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub`));

        expect(del.status).toBe(204);
        expect(get.status).toBe(404);
        expect(mockDeletedObjectKeys).toEqual([objectKey]);
        expect(mockSkillFileObjects.has(objectKey)).toBe(true);
        expect(warnings).toHaveLength(1);
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe('POST /api/skills/:owner/:slug/fork', () => {
    it('rejects anonymous users', async () => {
      const res = await app.fetch(
        reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub/fork`, jsonInit({})),
      );
      expect(res.status).toBe(401);
    });

    it('copies a public owned skill to the current user as private', async () => {
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/fork`, OTHER_USER_ID, jsonInit({})),
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        type: string;
        visibility: string;
        owner: { handle: string };
        slug: string;
      };
      expect(body.type).toBe('owned');
      expect(body.visibility).toBe('private');
      expect(body.owner.handle).toBe(OTHER_NAME);
      expect(body.slug).toBe('test-owned-pub');
    });

    it('auto-resolves slug conflicts with -fork suffixes', async () => {
      await app.fetch(
        reqAsUser(
          '/api/skills',
          OTHER_USER_ID,
          jsonInit({
            owner: OTHER_NAME,
            slug: 'test-owned-pub',
            name: 'existing',
            description: 'existing',
            tags: [],
            visibility: 'private',
            skillMdContent: '---\nname: existing\n---\n# existing\n',
          }),
        ),
      );

      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/fork`, OTHER_USER_ID, jsonInit({})),
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { slug: string };
      expect(body.slug).toBe('test-owned-pub-fork');
    });

    it('forks a referenced skill into an owned private skill', async () => {
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OTHER_NAME}/test-ref/fork`, OWNER_USER_ID, jsonInit({})),
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        type: string;
        visibility: string;
        skillMdContent: string;
      };
      expect(body.type).toBe('owned');
      expect(body.visibility).toBe('private');
      expect(body.skillMdContent).toContain('Fork 自 acme/repo/test-ref');
    });

    it('allows the first release without a changelog but requires one later', async () => {
      const first = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/releases`,
          OWNER_USER_ID,
          jsonInit({ title: '缺少说明' }),
        ),
      );
      expect(first.status).toBe(201);
      const firstBody = (await first.json()) as { version: number; changelog: string };
      expect(firstBody.version).toBe(1);
      expect(firstBody.changelog).toBe('');

      const second = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/releases`,
          OWNER_USER_ID,
          jsonInit({ title: '第二次发布' }),
        ),
      );
      expect(second.status).toBe(400);
    });

    it('reports upstream updates for a linked fork', async () => {
      await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/releases`,
          OWNER_USER_ID,
          jsonInit({ title: '首次发布', changelog: '建立初始版本。' }),
        ),
      );
      const fork = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/fork`, OTHER_USER_ID, jsonInit({})),
      );
      expect(fork.status).toBe(201);

      await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/files/reference.md`,
          OWNER_USER_ID,
          jsonInit({ content: '# upstream new file\n' }),
        ),
      );
      await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/releases`,
          OWNER_USER_ID,
          jsonInit({ title: '新增参考文件', changelog: '新增 reference.md 参考文件。' }),
        ),
      );

      const statusRes = await app.fetch(
        reqAsUser(`/api/skills/${OTHER_NAME}/test-owned-pub/upstream-status`, OTHER_USER_ID),
      );
      expect(statusRes.status).toBe(200);
      const status = (await statusRes.json()) as {
        isFork: boolean;
        hasUpdate: boolean;
        behindBy: number;
      };
      expect(status.isFork).toBe(true);
      expect(status.hasUpdate).toBe(true);
      expect(status.behindBy).toBe(1);
    });

    it('syncs upstream changes when fork files are unchanged', async () => {
      await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/releases`,
          OWNER_USER_ID,
          jsonInit({ title: '首次发布', changelog: '建立初始版本。' }),
        ),
      );
      await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/fork`, OTHER_USER_ID, jsonInit({})),
      );
      await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/files/reference.md`,
          OWNER_USER_ID,
          jsonInit({ content: '# upstream new file\n' }),
        ),
      );
      await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/releases`,
          OWNER_USER_ID,
          jsonInit({ title: '新增参考文件', changelog: '新增 reference.md 参考文件。' }),
        ),
      );

      const sync = await app.fetch(
        reqAsUser(
          `/api/skills/${OTHER_NAME}/test-owned-pub/sync-upstream`,
          OTHER_USER_ID,
          jsonInit({ strategy: 'auto' }),
        ),
      );
      expect(sync.status).toBe(200);
      const body = (await sync.json()) as { status: string };
      expect(body.status).toBe('success');

      const file = await app.fetch(
        reqAsUser(`/api/skills/${OTHER_NAME}/test-owned-pub/files/reference.md`, OTHER_USER_ID),
      );
      expect(file.status).toBe(200);
      expect(await file.text()).toBe('# upstream new file\n');
    });

    it('reports conflicts when upstream and fork edit the same base file', async () => {
      await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/releases`,
          OWNER_USER_ID,
          jsonInit({ title: '首次发布', changelog: '建立初始版本。' }),
        ),
      );
      await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/fork`, OTHER_USER_ID, jsonInit({})),
      );
      await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/files/SKILL.md`,
          OWNER_USER_ID,
          jsonInit({ content: '---\nname: test-owned-pub\n---\n# upstream edit\n' }),
        ),
      );
      await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/releases`,
          OWNER_USER_ID,
          jsonInit({ title: '上游修改', changelog: '更新上游 SKILL.md 内容。' }),
        ),
      );
      await app.fetch(
        reqAsUser(
          `/api/skills/${OTHER_NAME}/test-owned-pub/files/SKILL.md`,
          OTHER_USER_ID,
          jsonInit({ content: '---\nname: test-owned-pub\n---\n# fork edit\n' }),
        ),
      );

      const sync = await app.fetch(
        reqAsUser(
          `/api/skills/${OTHER_NAME}/test-owned-pub/sync-upstream`,
          OTHER_USER_ID,
          jsonInit({ strategy: 'auto' }),
        ),
      );
      expect(sync.status).toBe(200);
      const body = (await sync.json()) as { status: string; conflictFiles: string[] };
      expect(body.status).toBe('conflict');
      expect(body.conflictFiles).toContain('SKILL.md');
    });

    it('lets users subscribe to upstream updates', async () => {
      const res = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/subscription`,
          OTHER_USER_ID,
          jsonInit({ active: true, notifyOnRelease: true, notifyOnSync: true }, 'PUT'),
        ),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { active: boolean; notifyOnRelease: boolean };
      expect(body.active).toBe(true);
      expect(body.notifyOnRelease).toBe(true);
    });
  });

  describe('notifications', () => {
    it('returns 401 for anonymous', async () => {
      const res = await app.fetch(reqAnon('/api/notifications'));
      expect(res.status).toBe(401);
    });

    it('lists notifications with unread count', async () => {
      await db.insert(notifications).values({
        userId: OTHER_USER_ID,
        type: 'comment',
        actorId: OWNER_USER_ID,
        publishableId: 'test-skill-id',
        read: 0,
      });

      const res = await app.fetch(reqAsUser('/api/notifications', OTHER_USER_ID));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ type: string }>; total: number };
      expect(body.total).toBe(1);
      expect(body.items[0]?.type).toBe('comment');
    });

    it('returns unread count', async () => {
      await db.insert(notifications).values([
        { userId: OTHER_USER_ID, type: 'upvote', actorId: OWNER_USER_ID, read: 0 },
        { userId: OTHER_USER_ID, type: 'comment', actorId: OWNER_USER_ID, read: 0 },
        { userId: OTHER_USER_ID, type: 'fork', actorId: OWNER_USER_ID, read: 1 },
      ]);

      const res = await app.fetch(reqAsUser('/api/notifications/unread-count', OTHER_USER_ID));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { count: number };
      expect(body.count).toBe(2);
    });

    it('marks a notification as read', async () => {
      const [n] = await db
        .insert(notifications)
        .values({ userId: OTHER_USER_ID, type: 'upvote', actorId: OWNER_USER_ID, read: 0 })
        .returning();
      if (!n) throw new Error('insert failed');

      const res = await app.fetch(
        reqAsUser(`/api/notifications/${n.id}/read`, OTHER_USER_ID, { method: 'POST' }),
      );
      expect(res.status).toBe(200);

      const countRes = await app.fetch(reqAsUser('/api/notifications/unread-count', OTHER_USER_ID));
      const body = (await countRes.json()) as { count: number };
      expect(body.count).toBe(0);
    });

    it('marks all notifications as read', async () => {
      await db.insert(notifications).values([
        { userId: OTHER_USER_ID, type: 'upvote', actorId: OWNER_USER_ID, read: 0 },
        { userId: OTHER_USER_ID, type: 'comment', actorId: OWNER_USER_ID, read: 0 },
      ]);

      const res = await app.fetch(
        reqAsUser('/api/notifications/read-all', OTHER_USER_ID, { method: 'POST' }),
      );
      expect(res.status).toBe(200);

      const countRes = await app.fetch(reqAsUser('/api/notifications/unread-count', OTHER_USER_ID));
      const body = (await countRes.json()) as { count: number };
      expect(body.count).toBe(0);
    });

    it('creates a notification when someone comments', async () => {
      await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/comments`,
          OTHER_USER_ID,
          jsonInit({ content: 'Great skill!' }),
        ),
      );

      const res = await app.fetch(reqAsUser('/api/notifications', OWNER_USER_ID));
      const body = (await res.json()) as { items: Array<{ type: string; actor: { id: string } }> };
      expect(body.items.length).toBe(1);
      expect(body.items[0]?.type).toBe('comment');
      expect(body.items[0]?.actor.id).toBe(OTHER_USER_ID);
    });

    it('creates a notification when someone upvotes', async () => {
      await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/upvote`, OTHER_USER_ID, {
          method: 'POST',
        }),
      );

      const res = await app.fetch(reqAsUser('/api/notifications', OWNER_USER_ID));
      const body = (await res.json()) as { items: Array<{ type: string }> };
      const upvoteNotifs = body.items.filter((n) => n.type === 'upvote');
      expect(upvoteNotifs.length).toBe(1);
    });

    it('does not notify yourself when you upvote your own skill', async () => {
      await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/upvote`, OWNER_USER_ID, {
          method: 'POST',
        }),
      );

      const res = await app.fetch(reqAsUser('/api/notifications', OWNER_USER_ID));
      const body = (await res.json()) as { items: Array<{ type: string }> };
      expect(body.items.length).toBe(0);
    });
  });

  describe('POST /api/skills/:owner/:slug/files/:path — upsert file', () => {
    it('owner uploads a new file', async () => {
      const res = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/files/references/foo.md`,
          OWNER_USER_ID,
          jsonInit({ content: '# foo\n' }),
        ),
      );
      expect(res.status).toBe(204);
      const detail = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub`));
      const body = (await detail.json()) as { files: string[] };
      expect(body.files).toContain('references/foo.md');
    });

    it('owner uploads a binary image file', async () => {
      mockS3Configured = true;
      const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01, 0x02, 0x03, 0x04]);
      const path = 'references/ppt/assets/background.webp';
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      const ticketRes = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/file-uploads`,
          OWNER_USER_ID,
          jsonInit({ path, contentType: 'image/webp', size: bytes.byteLength }),
        ),
      );
      expect(ticketRes.status).toBe(201);
      const ticket = (await ticketRes.json()) as { objectKey: string; uploadUrl: string };
      expect(ticket.uploadUrl).toContain(ticket.objectKey);
      mockSkillFileObjects.set(ticket.objectKey, { body: bytes, contentType: 'image/webp' });

      const complete = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/file-uploads/complete`,
          OWNER_USER_ID,
          jsonInit({ path, objectKey: ticket.objectKey, contentType: 'image/webp' }),
        ),
      );
      expect(complete.status).toBe(200);

      const file = await app.fetch(
        reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub/files/${encoded}`),
      );
      expect(file.status).toBe(200);
      expect(file.headers.get('content-type')).toBe('image/webp');
      expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);

      const pkg = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub/package`));
      const body = (await pkg.json()) as {
        files: Array<{
          path: string;
          content: string;
          storageKind?: string;
          objectKey?: string | null;
          contentType?: string | null;
          sizeBytes?: number;
        }>;
      };
      const uploaded = body.files.find((entry) => entry.path === path);
      expect(uploaded?.storageKind).toBe('oss');
      expect(uploaded?.objectKey).toBe(ticket.objectKey);
      expect(uploaded?.content).toBe('');
      expect(uploaded?.contentType).toBe('image/webp');
      expect(uploaded?.sizeBytes).toBe(bytes.byteLength);
    });

    it('rejects non-owner (403)', async () => {
      const res = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/files/foo.md`,
          OTHER_USER_ID,
          jsonInit({ content: 'x' }),
        ),
      );
      expect(res.status).toBe(403);
    });

    it('rejects unsafe path (400)', async () => {
      const res = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/files/..%2Fetc%2Fpasswd`,
          OWNER_USER_ID,
          jsonInit({ content: 'x' }),
        ),
      );
      expect(res.status).toBe(400);
    });

    it('rejects repository and generated system paths on the API side', async () => {
      for (const path of ['.gitignore', '.git/config', '.DS_Store', '.idea/workspace.xml']) {
        const encoded = path.split('/').map(encodeURIComponent).join('/');
        const res = await app.fetch(
          reqAsUser(
            `/api/skills/${OWNER_NAME}/test-owned-pub/files/${encoded}`,
            OWNER_USER_ID,
            jsonInit({ content: 'ignored' }),
          ),
        );
        expect(res.status).toBe(400);
      }
    });

    it('rejects OSS upload tickets for ignored system paths', async () => {
      mockS3Configured = true;
      const res = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/file-uploads`,
          OWNER_USER_ID,
          jsonInit({ path: 'node_modules/pkg/index.js', contentType: 'text/javascript', size: 10 }),
        ),
      );
      expect(res.status).toBe(400);
    });

    it('round-trips Chinese filename via percent-encoded URL', async () => {
      const path = 'references/laws/02-中国共产党章程.md';
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      const up = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/files/${encoded}`,
          OWNER_USER_ID,
          jsonInit({ content: '# 党章\n' }),
        ),
      );
      expect(up.status).toBe(204);
      const detail = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub`));
      const body = (await detail.json()) as { files: string[] };
      expect(body.files).toContain(path);
    });

    it('round-trips deeply nested path', async () => {
      const path = 'a/b/c/d/e/file.md';
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      const up = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/files/${encoded}`,
          OWNER_USER_ID,
          jsonInit({ content: 'deep' }),
        ),
      );
      expect(up.status).toBe(204);
      const detail = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub`));
      const body = (await detail.json()) as { files: string[] };
      expect(body.files).toContain(path);
    });
  });

  describe('GET /api/skills/:owner/:slug/files/:path', () => {
    it('returns public owned file content to anonymous', async () => {
      await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/files/references/foo.md`,
          OWNER_USER_ID,
          jsonInit({ content: '# foo\n' }),
        ),
      );

      const res = await app.fetch(
        reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub/files/references/foo.md`),
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('# foo\n');
    });

    it('returns private owned file content to owner', async () => {
      const path = 'references/private.md';
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-priv/files/${encoded}`, OWNER_USER_ID),
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('private reference');
    });

    it('hides private owned file content from anonymous', async () => {
      const path = 'references/private.md';
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      const res = await app.fetch(
        reqAnon(`/api/skills/${OWNER_NAME}/test-owned-priv/files/${encoded}`),
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 for referenced skills', async () => {
      const res = await app.fetch(reqAnon(`/api/skills/${OTHER_NAME}/test-ref/files/SKILL.md`));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/skills/:owner/:slug/files and /package', () => {
    it('lists public skill files for anonymous callers', async () => {
      const res = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub/files`));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ path: string }>; total: number };
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.items.some((file) => file.path === 'SKILL.md')).toBe(true);
    });

    it('returns a package snapshot for public owned skills', async () => {
      const res = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub/package`));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        protocolName: string;
        hash: string;
        files: Array<{ path: string; content: string }>;
      };
      expect(body.protocolName).toBe(skillProtocolName(OWNER_NAME, 'test-owned-pub'));
      expect(body.hash).toHaveLength(64);
      expect(body.files.some((file) => file.path === 'SKILL.md')).toBe(true);
    });

    it('returns a private package to the owner with private/file scopes', async () => {
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-priv/package`, OWNER_USER_ID),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { files: Array<{ path: string; content: string }> };
      expect(body.files.some((file) => file.path === 'references/private.md')).toBe(true);
    });

    it('hides private package when the actor lacks private-read scope', async () => {
      const res = await app.fetch(
        reqAsUserWithScopes(`/api/skills/${OWNER_NAME}/test-owned-priv/package`, OWNER_USER_ID, [
          'skills:read',
          'skills:files:read',
        ]),
      );
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/skills/:owner/:slug/files/:path', () => {
    it('owner can remove an extra file', async () => {
      // First upload it
      await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/files/references/foo.md`,
          OWNER_USER_ID,
          jsonInit({ content: '# foo\n' }),
        ),
      );
      const del = await app.fetch(
        reqAsUser(
          `/api/skills/${OWNER_NAME}/test-owned-pub/files/references/foo.md`,
          OWNER_USER_ID,
          { method: 'DELETE' },
        ),
      );
      expect(del.status).toBe(204);
    });

    it('refuses to delete SKILL.md', async () => {
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/files/SKILL.md`, OWNER_USER_ID, {
          method: 'DELETE',
        }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/me', () => {
    it('401 for anonymous', async () => {
      const res = await app.fetch(reqAnon('/api/me'));
      expect(res.status).toBe(401);
    });

    it('returns current user', async () => {
      const res = await app.fetch(reqAsUser('/api/me', OWNER_USER_ID));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { name: string; isVirtual: boolean; phone: string | null };
      expect(body.name).toBe(OWNER_NAME);
      expect(body.isVirtual).toBe(false);
      expect(body.phone).toBe('13300001064');
    });
  });

  describe('PATCH /api/me/profile', () => {
    it('updates display name to anything (including spaces, mixed case)', async () => {
      const res = await app.fetch(
        reqAsUser('/api/me/profile', OWNER_USER_ID, jsonInit({ name: '张三 Mr.' }, 'PATCH')),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { name: string; handle: string };
      expect(body.name).toBe('张三 Mr.');
      expect(body.handle).toBe(OWNER_NAME); // handle unchanged
    });

    it('updates handle to a new url-safe value', async () => {
      const res = await app.fetch(
        reqAsUser('/api/me/profile', OWNER_USER_ID, jsonInit({ handle: 'newhandle' }, 'PATCH')),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { handle: string };
      expect(body.handle).toBe('newhandle');
    });

    it('409 when handle taken', async () => {
      const res = await app.fetch(
        reqAsUser('/api/me/profile', OWNER_USER_ID, jsonInit({ handle: OTHER_NAME }, 'PATCH')),
      );
      expect(res.status).toBe(409);
    });

    it('400 for invalid handle', async () => {
      const res = await app.fetch(
        reqAsUser('/api/me/profile', OWNER_USER_ID, jsonInit({ handle: 'Has Spaces' }, 'PATCH')),
      );
      expect(res.status).toBe(400);
    });

    it('400 for reserved handle', async () => {
      const res = await app.fetch(
        reqAsUser('/api/me/profile', OWNER_USER_ID, jsonInit({ handle: 'admin' }, 'PATCH')),
      );
      expect(res.status).toBe(400);
    });

    it('400 when neither name nor handle provided', async () => {
      const res = await app.fetch(
        reqAsUser('/api/me/profile', OWNER_USER_ID, jsonInit({}, 'PATCH')),
      );
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/me/skills', () => {
    it('lists owner public + private', async () => {
      const res = await app.fetch(reqAsUser('/api/me/skills', OWNER_USER_ID));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items.map((i) => i.slug).sort()).toEqual(['test-owned-priv', 'test-owned-pub']);
    });

    it('honors private-read scope', async () => {
      const res = await app.fetch(
        reqAsUserWithScopes('/api/me/skills', OWNER_USER_ID, ['skills:read']),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items.map((i) => i.slug)).toEqual(['test-owned-pub']);
    });
  });

  describe('contest submissions', () => {
    async function ownerSkillId(slug: string) {
      const res = await app.fetch(reqAsUser('/api/me/skills', OWNER_USER_ID));
      const body = (await res.json()) as { items: Array<{ id: string; slug: string }> };
      const skill = body.items.find((item) => item.slug === slug);
      if (!skill) throw new Error(`missing seeded skill: ${slug}`);
      return skill.id;
    }

    const contestSubmissionInput = (
      skillId: string,
      track: '学习科研' | '校园生活' | '创意应用' | '专业实训' = '学习科研',
    ) => ({
      skillId,
      track,
    });

    it('returns current contest eligibility for the signed-in user', async () => {
      const res = await app.fetch(
        reqAsUser('/api/events/hdu-skills-2026/me/eligibility', OWNER_USER_ID),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        eligible: boolean;
        phone: string | null;
        message: string;
      };
      expect(body.eligible).toBe(true);
      expect(body.phone).toBe('13300001064');
      expect(body.message).toContain('通过活动资格校验');
    });

    it('returns an ineligible result when the user has no synced phone', async () => {
      const res = await app.fetch(
        reqAsUser('/api/events/hdu-skills-2026/me/eligibility', OTHER_USER_ID),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { eligible: boolean; message: string };
      expect(body.eligible).toBe(false);
      expect(body.message).toContain('未同步手机号');
    });

    it('returns an ineligible result when the phone is not marked for the event', async () => {
      await db
        .update(user)
        .set({ phone: '15500001064' })
        .where(inArray(user.id, [OTHER_USER_ID]));
      const res = await app.fetch(
        reqAsUser('/api/events/hdu-skills-2026/me/eligibility', OTHER_USER_ID),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        eligible: boolean;
        phone: string | null;
        message: string;
      };
      expect(body.eligible).toBe(false);
      expect(body.phone).toBe('15500001064');
      expect(body.message).toContain('未完成活动报名');
    });

    it('sets an existing public skill as contest submission and lists it', async () => {
      const skillId = await ownerSkillId('test-owned-pub');
      const created = await app.fetch(
        reqAsUser(
          '/api/events/hdu-skills-2026/submissions',
          OWNER_USER_ID,
          jsonInit(contestSubmissionInput(skillId)),
        ),
      );
      expect(created.status).toBe(201);
      const createdBody = (await created.json()) as {
        track: string;
        videoUrl: string;
        skill: { slug: string };
      };
      expect(createdBody.track).toBe('学习科研');
      expect(createdBody.videoUrl).toContain('skillhunt/videos/test-owner');
      expect(createdBody.skill.slug).toBe('test-owned-pub');

      const list = await app.fetch(
        reqAsUser('/api/events/hdu-skills-2026/me/submissions', OWNER_USER_ID),
      );
      expect(list.status).toBe(200);
      const listBody = (await list.json()) as {
        items: Array<{ track: string; skill: { slug: string } }>;
      };
      expect(listBody.items).toHaveLength(1);
      expect(listBody.items[0]?.skill.slug).toBe('test-owned-pub');
    });

    it('updates the track when the same skill is submitted again', async () => {
      const skillId = await ownerSkillId('test-owned-pub');
      await app.fetch(
        reqAsUser(
          '/api/events/hdu-skills-2026/submissions',
          OWNER_USER_ID,
          jsonInit(contestSubmissionInput(skillId)),
        ),
      );
      const updated = await app.fetch(
        reqAsUser(
          '/api/events/hdu-skills-2026/submissions',
          OWNER_USER_ID,
          jsonInit(contestSubmissionInput(skillId, '创意应用')),
        ),
      );
      expect(updated.status).toBe(201);

      const list = await app.fetch(
        reqAsUser('/api/events/hdu-skills-2026/me/submissions', OWNER_USER_ID),
      );
      const body = (await list.json()) as { items: Array<{ track: string }> };
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.track).toBe('创意应用');
    });

    it('cancels an existing contest submission', async () => {
      const skillId = await ownerSkillId('test-owned-pub');
      await app.fetch(
        reqAsUser(
          '/api/events/hdu-skills-2026/submissions',
          OWNER_USER_ID,
          jsonInit(contestSubmissionInput(skillId)),
        ),
      );

      const deleted = await app.fetch(
        reqAsUser(`/api/events/hdu-skills-2026/submissions/${skillId}`, OWNER_USER_ID, {
          method: 'DELETE',
        }),
      );
      expect(deleted.status).toBe(204);

      const list = await app.fetch(
        reqAsUser('/api/events/hdu-skills-2026/me/submissions', OWNER_USER_ID),
      );
      const body = (await list.json()) as { items: unknown[] };
      expect(body.items).toHaveLength(0);
    });

    it('rejects canceling another user contest submission', async () => {
      const skillId = await ownerSkillId('test-owned-pub');
      const res = await app.fetch(
        reqAsUser(`/api/events/hdu-skills-2026/submissions/${skillId}`, OTHER_USER_ID, {
          method: 'DELETE',
        }),
      );
      expect(res.status).toBe(403);
    });

    it('rejects private skills as contest submissions', async () => {
      const skillId = await ownerSkillId('test-owned-priv');
      const res = await app.fetch(
        reqAsUser(
          '/api/events/hdu-skills-2026/submissions',
          OWNER_USER_ID,
          jsonInit(contestSubmissionInput(skillId)),
        ),
      );
      expect(res.status).toBe(400);
    });

    it('rejects public skills without a demo video', async () => {
      const publicSkill = await insertTestSkill({
        slug: 'contest-no-video',
        name: 'contest-no-video',
        description: 'public skill without demo video',
        type: 'owned',
        visibility: 'public',
        tags: ['contest'],
        frontmatter: { name: 'contest-no-video' },
        ownerUserId: OWNER_USER_ID,
      });
      await db.insert(skillFiles).values({
        skillId: publicSkill.id,
        path: 'SKILL.md',
        content: '---\nname: contest-no-video\n---\n# body\n',
      });

      const res = await app.fetch(
        reqAsUser(
          '/api/events/hdu-skills-2026/submissions',
          OWNER_USER_ID,
          jsonInit(contestSubmissionInput(publicSkill.id)),
        ),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('上传演示视频');
    });

    it('rejects users without synced phone', async () => {
      const publicSkill = await insertTestSkill({
        slug: 'other-public-no-phone',
        name: 'other-public-no-phone',
        description: 'other public skill',
        type: 'owned',
        visibility: 'public',
        tags: ['contest'],
        frontmatter: { name: 'other-public-no-phone' },
        ownerUserId: OTHER_USER_ID,
      });
      await db.insert(skillFiles).values({
        skillId: publicSkill.id,
        path: 'SKILL.md',
        content: '---\nname: other-public-no-phone\n---\n# body\n',
      });

      const res = await app.fetch(
        reqAsUser(
          '/api/events/hdu-skills-2026/submissions',
          OTHER_USER_ID,
          jsonInit(contestSubmissionInput(publicSkill.id)),
        ),
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('未同步手机号');
    });

    it('rejects users whose phone is not marked eligible for the event', async () => {
      await db
        .update(user)
        .set({ phone: '15500001064' })
        .where(inArray(user.id, [OTHER_USER_ID]));
      const publicSkill = await insertTestSkill({
        slug: 'other-public-unregistered',
        name: 'other-public-unregistered',
        description: 'other public skill',
        type: 'owned',
        visibility: 'public',
        tags: ['contest'],
        frontmatter: { name: 'other-public-unregistered' },
        ownerUserId: OTHER_USER_ID,
      });
      await db.insert(skillFiles).values({
        skillId: publicSkill.id,
        path: 'SKILL.md',
        content: '---\nname: other-public-unregistered\n---\n# body\n',
      });

      const res = await app.fetch(
        reqAsUser(
          '/api/events/hdu-skills-2026/submissions',
          OTHER_USER_ID,
          jsonInit(contestSubmissionInput(publicSkill.id)),
        ),
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('未完成活动报名');
    });

    it('rejects disqualified contest users', async () => {
      await db
        .update(user)
        .set({ phone: '16600001064' })
        .where(inArray(user.id, [OTHER_USER_ID]));
      await db.insert(contestUsers).values({
        eventSlug: 'hdu-skills-2026',
        phone: '16600001064',
        status: 'disqualified',
        note: '测试取消资格用户',
      });
      const publicSkill = await insertTestSkill({
        slug: 'other-public-disqualified',
        name: 'other-public-disqualified',
        description: 'other public skill',
        type: 'owned',
        visibility: 'public',
        tags: ['contest'],
        frontmatter: { name: 'other-public-disqualified' },
        ownerUserId: OTHER_USER_ID,
      });
      await db.insert(skillFiles).values({
        skillId: publicSkill.id,
        path: 'SKILL.md',
        content: '---\nname: other-public-disqualified\n---\n# body\n',
      });

      const res = await app.fetch(
        reqAsUser(
          '/api/events/hdu-skills-2026/submissions',
          OTHER_USER_ID,
          jsonInit(contestSubmissionInput(publicSkill.id)),
        ),
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('资格已取消');
    });

    it('rejects submissions for another user skill', async () => {
      const skillId = await ownerSkillId('test-owned-pub');
      const res = await app.fetch(
        reqAsUser(
          '/api/events/hdu-skills-2026/submissions',
          OTHER_USER_ID,
          jsonInit(contestSubmissionInput(skillId)),
        ),
      );
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/users/:owner/skills', () => {
    it('anonymous sees only public', async () => {
      const res = await app.fetch(reqAnon(`/api/users/${OWNER_NAME}/skills`));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        owner: { name: string };
        items: Array<{ slug: string }>;
      };
      expect(body.owner.name).toBe(OWNER_NAME);
      expect(body.items.map((i) => i.slug)).toEqual(['test-owned-pub']);
    });

    it('owner sees own private + public', async () => {
      const res = await app.fetch(reqAsUser(`/api/users/${OWNER_NAME}/skills`, OWNER_USER_ID));
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items.map((i) => i.slug).sort()).toEqual(['test-owned-priv', 'test-owned-pub']);
    });

    it('owner without private-read scope only sees their public skills', async () => {
      const res = await app.fetch(
        reqAsUserWithScopes(`/api/users/${OWNER_NAME}/skills`, OWNER_USER_ID, ['skills:read']),
      );
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items.map((i) => i.slug)).toEqual(['test-owned-pub']);
    });

    it('404 for unknown user', async () => {
      const res = await app.fetch(reqAnon('/api/users/no-such-user/skills'));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/users/:owner/packages', () => {
    async function createOwnerPackages() {
      const skillRes = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub`));
      const skill = (await skillRes.json()) as { id: string };
      for (const pkg of [
        { slug: 'profile-public-suite', visibility: 'public' },
        { slug: 'profile-private-suite', visibility: 'private' },
      ] as const) {
        const created = await app.fetch(
          reqAsUser(
            '/api/packages',
            OWNER_USER_ID,
            jsonInit({
              owner: OWNER_NAME,
              slug: pkg.slug,
              name: pkg.visibility === 'public' ? '公开主页包' : '私有主页包',
              description: '用于测试用户主页包列表',
              visibility: pkg.visibility,
              tags: [],
              skillIds: [skill.id],
            }),
          ),
        );
        expect(created.status).toBe(201);
      }
    }

    it('anonymous sees only public packages', async () => {
      await createOwnerPackages();
      const res = await app.fetch(reqAnon(`/api/users/${OWNER_NAME}/packages`));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        owner: { handle: string };
        items: Array<{ slug: string }>;
        total: number;
      };
      expect(body.owner.handle).toBe(OWNER_NAME);
      expect(body.items.map((item) => item.slug)).toEqual(['profile-public-suite']);
      expect(body.total).toBe(1);
    });

    it('owner sees own public and private packages', async () => {
      await createOwnerPackages();
      const res = await app.fetch(reqAsUser(`/api/users/${OWNER_NAME}/packages`, OWNER_USER_ID));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items.map((item) => item.slug).sort()).toEqual([
        'profile-private-suite',
        'profile-public-suite',
      ]);
    });

    it('supports /api/me/packages and honors private-read scope', async () => {
      await createOwnerPackages();
      const res = await app.fetch(
        reqAsUserWithScopes('/api/me/packages', OWNER_USER_ID, ['skills:read']),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items.map((item) => item.slug)).toEqual(['profile-public-suite']);
    });

    it('404 for unknown user', async () => {
      const res = await app.fetch(reqAnon('/api/users/no-such-user/packages'));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/users/:owner/publishables', () => {
    it('returns a mixed user profile feed with skills and packages', async () => {
      const skillRes = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub`));
      const skill = (await skillRes.json()) as { id: string };
      const created = await app.fetch(
        reqAsUser(
          '/api/packages',
          OWNER_USER_ID,
          jsonInit({
            owner: OWNER_NAME,
            slug: 'profile-mixed-suite',
            name: '主页混合包',
            description: '用于测试用户主页统一内容流',
            visibility: 'public',
            tags: [],
            skillIds: [skill.id],
          }),
        ),
      );
      expect(created.status).toBe(201);

      const res = await app.fetch(reqAnon(`/api/users/${OWNER_NAME}/publishables`));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        owner: { handle: string };
        items: Array<{ kind: 'skill' | 'package'; item: { slug: string } }>;
        total: number;
      };
      expect(body.owner.handle).toBe(OWNER_NAME);
      expect(body.items.some((item) => item.kind === 'skill')).toBe(true);
      expect(
        body.items.some(
          (item) => item.kind === 'package' && item.item.slug === 'profile-mixed-suite',
        ),
      ).toBe(true);
      expect(body.total).toBe(body.items.length);
    });
  });

  // ── Capability URL ─────────────────────────────────────────────────

  describe('Capability URL: mint + consume', () => {
    it('owner mints token for their own private skill', async () => {
      // First find the skill id
      const detail = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-priv`, OWNER_USER_ID),
      );
      const sk = (await detail.json()) as { slug: string };
      // Read the underlying id via a direct DB lookup is too heavy here; query
      // the skills service by hitting a public skill (ids exposed nowhere). We
      // instead fetch the public skill detail to confirm we can hit /api/install-tokens.
      // For private skill we need to look up id — use list-as-owner.
      const list = await app.fetch(reqAsUser('/api/me/skills', OWNER_USER_ID));
      const listBody = (await list.json()) as { items: Array<{ slug: string }> };
      expect(listBody.items.find((i) => i.slug === sk.slug)).toBeDefined();
      // We can't easily get skill.id without DB. Use the helper exported by service.
      const { findSkillByOwnerAndSlug } = await import('../services/skill-service');
      const dbRow = await findSkillByOwnerAndSlug(OWNER_NAME, 'test-owned-priv');
      if (!dbRow) throw new Error('seed: priv skill missing');

      const mint = await app.fetch(
        reqAsUser('/api/install-tokens', OWNER_USER_ID, jsonInit({ skillId: dbRow.id })),
      );
      expect(mint.status).toBe(201);
      const mintBody = (await mint.json()) as { token: string; installCommand: string };
      expect(mintBody.token).toBeDefined();
      expect(mintBody.installCommand).toBe(`npx skills add http://localhost/i/${mintBody.token}`);
    });

    it('non-owner cannot mint token for someone else private skill (404)', async () => {
      const { findSkillByOwnerAndSlug } = await import('../services/skill-service');
      const dbRow = await findSkillByOwnerAndSlug(OWNER_NAME, 'test-owned-priv');
      if (!dbRow) throw new Error('seed: priv skill missing');
      const mint = await app.fetch(
        reqAsUser('/api/install-tokens', OTHER_USER_ID, jsonInit({ skillId: dbRow.id })),
      );
      expect(mint.status).toBe(404);
    });

    it('capability URL serves SKILL.md once then 404s', async () => {
      const { findSkillByOwnerAndSlug } = await import('../services/skill-service');
      const dbRow = await findSkillByOwnerAndSlug(OWNER_NAME, 'test-owned-priv');
      if (!dbRow) throw new Error('seed: priv skill missing');

      const mint = await app.fetch(
        reqAsUser(
          '/api/install-tokens',
          OWNER_USER_ID,
          jsonInit({ skillId: dbRow.id, expiresInHours: 24, maxUses: 1 }),
        ),
      );
      const { token } = (await mint.json()) as { token: string };

      const { capabilityWellknownRoute } = await import('./wellknown');
      const wkApp = new Hono().route('/i', capabilityWellknownRoute);

      const index = await wkApp.fetch(
        new Request(`http://localhost/i/${token}/.well-known/agent-skills/index.json`),
      );
      expect(index.status).toBe(200);
      const indexBody = (await index.json()) as {
        skills: Array<{ name: string; description: string; files: string[] }>;
      };
      expect(indexBody.skills).toHaveLength(1);
      expect(indexBody.skills[0]?.name).toBe(skillProtocolName(OWNER_NAME, 'test-owned-priv'));
      expect(indexBody.skills[0]?.description).toBe('private only');
      expect(indexBody.skills[0]?.files.sort()).toEqual(['SKILL.md', 'references/private.md']);

      const protocolName = skillProtocolName(OWNER_NAME, 'test-owned-priv');
      const url = `/i/${token}/.well-known/agent-skills/${protocolName}/SKILL.md`;

      const first = await wkApp.fetch(new Request(`http://localhost${url}`));
      expect(first.status).toBe(200);
      const text = await first.text();
      expect(text).toContain('private body');

      const extra = await wkApp.fetch(
        new Request(
          `http://localhost/i/${token}/.well-known/agent-skills/${protocolName}/references/private.md`,
        ),
      );
      expect(extra.status).toBe(200);
      expect(await extra.text()).toContain('private reference');

      const second = await wkApp.fetch(new Request(`http://localhost${url}`));
      expect(second.status).toBe(404);
    });

    it('capability URL with mismatched owner/slug returns 404', async () => {
      const { findSkillByOwnerAndSlug } = await import('../services/skill-service');
      const dbRow = await findSkillByOwnerAndSlug(OWNER_NAME, 'test-owned-pub');
      if (!dbRow) throw new Error('seed: pub skill missing');

      const mint = await app.fetch(
        reqAsUser('/api/install-tokens', OWNER_USER_ID, jsonInit({ skillId: dbRow.id })),
      );
      const { token } = (await mint.json()) as { token: string };

      const { capabilityWellknownRoute } = await import('./wellknown');
      const wkApp = new Hono().route('/i', capabilityWellknownRoute);
      const r1 = await wkApp.fetch(
        new Request(`http://localhost/i/${token}/.well-known/agent-skills/not-the-skill/SKILL.md`),
      );
      expect(r1.status).toBe(404);
    });
  });

  describe('GET /api/skills (pagination & sorting)', () => {
    it('returns paginated results with default limit', async () => {
      const res = await app.fetch(reqAnon('/api/skills?limit=1'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: unknown[]; total: number };
      expect(body.items.length).toBeLessThanOrEqual(1);
      expect(body.total).toBeGreaterThanOrEqual(1);
    });

    it('returns second page with offset', async () => {
      const res1 = await app.fetch(reqAnon('/api/skills?limit=1&offset=0'));
      const body1 = (await res1.json()) as { items: Array<{ slug: string }> };
      const firstSlug = body1.items[0]?.slug;

      const res2 = await app.fetch(reqAnon('/api/skills?limit=1&offset=1'));
      const body2 = (await res2.json()) as { items: Array<{ slug: string }> };
      if (body2.items.length > 0) {
        expect(body2.items[0]?.slug).not.toBe(firstSlug);
      }
    });

    it('sorts by hottest', async () => {
      const res = await app.fetch(reqAnon('/api/skills?sort=hottest'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: unknown[] };
      expect(Array.isArray(body.items)).toBe(true);
    });

    it('sorts by recent (default)', async () => {
      const res = await app.fetch(reqAnon('/api/skills?sort=recent'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: unknown[] };
      expect(Array.isArray(body.items)).toBe(true);
    });

    it('sorts by A-Z', async () => {
      const res = await app.fetch(reqAnon('/api/skills?sort=az'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ name: string }> };
      const names = body.items.map((i) => i.name);
      for (let i = 1; i < names.length; i++) {
        const current = names[i];
        const prev = names[i - 1];
        if (current && prev) {
          expect(current >= prev).toBe(true);
        }
      }
    });

    it('filters by tag with pagination', async () => {
      const res = await app.fetch(reqAnon('/api/skills?tag=design&limit=10'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ tags: string[] }>; total: number };
      for (const item of body.items) {
        expect(item.tags).toContain('design');
      }
    });
  });

  describe('POST /api/skills/:owner/:slug/bookmark', () => {
    it('authenticated user can bookmark a skill', async () => {
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/bookmark`, OTHER_USER_ID, {
          method: 'POST',
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { bookmarkCount: number; viewerHasBookmarked: boolean };
      expect(body.viewerHasBookmarked).toBe(true);
      expect(body.bookmarkCount).toBeGreaterThanOrEqual(1);
    });

    it('duplicate bookmark is idempotent', async () => {
      await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/bookmark`, OTHER_USER_ID, {
          method: 'POST',
        }),
      );
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/bookmark`, OTHER_USER_ID, {
          method: 'POST',
        }),
      );
      expect(res.status).toBe(200);
    });

    it('anonymous user cannot bookmark', async () => {
      const res = await app.fetch(
        reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub/bookmark`, { method: 'POST' }),
      );
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/skills/:owner/:slug/bookmark', () => {
    it('authenticated user can remove their bookmark', async () => {
      await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/bookmark`, OTHER_USER_ID, {
          method: 'POST',
        }),
      );
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/bookmark`, OTHER_USER_ID, {
          method: 'DELETE',
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { viewerHasBookmarked: boolean };
      expect(body.viewerHasBookmarked).toBe(false);
    });
  });

  describe('GET /api/me/bookmarks', () => {
    it('returns bookmarks for authenticated user', async () => {
      await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/bookmark`, OTHER_USER_ID, {
          method: 'POST',
        }),
      );
      const res = await app.fetch(reqAsUser('/api/me/bookmarks', OTHER_USER_ID));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(body.items.some((i) => i.slug === 'test-owned-pub')).toBe(true);
    });

    it('401 for anonymous', async () => {
      const res = await app.fetch(reqAnon('/api/me/bookmarks'));
      expect(res.status).toBe(401);
    });
  });

  describe('Comments with parentId (nested)', () => {
    it('creates a top-level comment', async () => {
      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/comments`, OTHER_USER_ID, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: 'Top level comment' }),
        }),
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { parentId: string | null; content: string };
      expect(body.parentId).toBeNull();
      expect(body.content).toBe('Top level comment');
    });

    it('creates a reply comment with parentId', async () => {
      const parentRes = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/comments`, OTHER_USER_ID, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: 'Parent comment' }),
        }),
      );
      const parent = (await parentRes.json()) as { id: string };

      const res = await app.fetch(
        reqAsUser(`/api/skills/${OWNER_NAME}/test-owned-pub/comments`, OWNER_USER_ID, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: 'Reply to parent', parentId: parent.id }),
        }),
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { parentId: string | null; content: string };
      expect(body.parentId).toBe(parent.id);
      expect(body.content).toBe('Reply to parent');
    });
  });
});
