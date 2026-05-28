import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  db,
  publishableReleases,
  publishables,
  skillFiles,
  skillPackageItems,
  skillPackages,
  skills,
  user,
} from '../db';
import { skillProtocolName } from '../lib/protocol-name';

let app: Hono;
let packageApp: Hono;
const OWNER_ID = 'mozia-virtual';
const ALICE_ID = 'alice-owner';
const BINARY_OBJECT_KEY = 'skillhunt/skill-files/mozia-virtual/test-owned-public/background.webp';
const mockOssObjects = new Map<string, { body: Uint8Array; contentType: string | null }>();
const originalFetch = globalThis.fetch;
const s3EnvKeys = [
  'S3_ENDPOINT',
  'S3_PUBLIC_URL',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_REGION',
] as const;
const originalS3Env = Object.fromEntries(s3EnvKeys.map((key) => [key, process.env[key]]));

beforeAll(async () => {
  process.env.S3_ENDPOINT = 'https://oss.example';
  process.env.S3_PUBLIC_URL = 'https://oss.example';
  process.env.S3_BUCKET = 'skillhunt-test';
  process.env.S3_ACCESS_KEY_ID = 'test-access-key';
  process.env.S3_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.S3_REGION = 'us-east-1';
  const mockedFetch = (async (...args: Parameters<typeof fetch>) => {
    const target = args[0];
    const url = new URL(
      typeof target === 'string' ? target : target instanceof URL ? target.toString() : target.url,
    );
    const decodedPath = decodeURIComponent(url.pathname);
    const objectKey = [...mockOssObjects.keys()].find((key) => decodedPath.endsWith(`/${key}`));
    if (objectKey) {
      const object = mockOssObjects.get(objectKey);
      if (object) {
        return new Response(object.body, {
          headers: {
            'content-type': object.contentType ?? 'application/octet-stream',
            'content-length': String(object.body.byteLength),
          },
        });
      }
    }
    return originalFetch(...args);
  }) as typeof fetch;
  mockedFetch.preconnect = originalFetch.preconnect;
  globalThis.fetch = mockedFetch;

  const { packageWellknownRoute, wellknownRoute } = await import('./wellknown');
  app = new Hono().route('/.well-known', wellknownRoute);
  packageApp = new Hono().route('/p', packageWellknownRoute);
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
    })
    .returning();
  if (!skill) throw new Error('seed: skill extension insert failed');
  return { ...publishable, ...skill };
}

async function insertTestPackage(input: {
  ownerUserId: string;
  slug: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  tags: string[];
}) {
  const [publishable] = await db
    .insert(publishables)
    .values({
      kind: 'package',
      ownerUserId: input.ownerUserId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      tags: input.tags,
    })
    .returning();
  if (!publishable) throw new Error('seed: publishable package insert failed');

  const [pkg] = await db.insert(skillPackages).values({ id: publishable.id }).returning();
  if (!pkg) throw new Error('seed: package extension insert failed');
  return { ...publishable, ...pkg };
}

async function resetAndSeed() {
  mockOssObjects.clear();
  await db.delete(skillPackageItems);
  await db.delete(skillPackages);
  await db.delete(skills);
  await db.delete(publishables);
  await db.delete(user).where(inArray(user.id, [OWNER_ID, ALICE_ID]));
  await db.insert(user).values({
    id: OWNER_ID,
    name: 'Mozia',
    handle: 'mozia',
    email: 'mozia@example.com',
    emailVerified: true,
    isVirtual: true,
  });

  const ownedPublic = await insertTestSkill({
    slug: 'test-owned-public',
    name: 'test-owned-public',
    description: 'owned + public for testing',
    type: 'owned',
    visibility: 'public',
    tags: [],
    frontmatter: { name: 'test-owned-public' },
    ownerUserId: OWNER_ID,
  });

  await db.insert(skillFiles).values([
    {
      skillId: ownedPublic.id,
      path: 'SKILL.md',
      content: '---\nname: test-owned-public\ndescription: x\n---\n# body\n',
    },
    { skillId: ownedPublic.id, path: 'extra.md', content: '# extra\n' },
    {
      skillId: ownedPublic.id,
      path: 'assets/background.webp',
      content: '',
      storageKind: 'oss',
      objectKey: BINARY_OBJECT_KEY,
      contentType: 'image/webp',
      sizeBytes: 5,
    },
  ]);
  mockOssObjects.set(BINARY_OBJECT_KEY, {
    body: new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01]),
    contentType: 'image/webp',
  });

  const ownedPriv = await insertTestSkill({
    slug: 'test-owned-private',
    name: 'test-owned-private',
    description: 'owned + private for testing',
    type: 'owned',
    visibility: 'private',
    tags: [],
    frontmatter: { name: 'test-owned-private' },
    ownerUserId: OWNER_ID,
  });

  await db.insert(skillFiles).values({
    skillId: ownedPriv.id,
    path: 'SKILL.md',
    content: '---\nname: test-owned-private\ndescription: x\n---\n# private\n',
  });

  await insertTestSkill({
    slug: 'test-ref',
    name: 'test-ref',
    description: 'referenced for testing',
    type: 'referenced',
    visibility: 'public',
    tags: [],
    sourceRepo: 'test/repo',
    sourceSkillName: 'test-ref',
    sourceInstallCommand: 'npx skills add test/repo --skill test-ref',
    sourceUrl: 'https://example.com',
    ownerUserId: OWNER_ID,
  });

  const pkg = await insertTestPackage({
    ownerUserId: OWNER_ID,
    slug: 'case-suite',
    name: '案件工作包',
    description: '一次安装案件处理相关 skills',
    visibility: 'public',
    tags: [],
  });

  await db.insert(skillPackageItems).values([
    {
      packageId: pkg.id,
      skillId: ownedPublic.id,
      position: 0,
    },
    {
      packageId: pkg.id,
      skillId: ownedPriv.id,
      position: 1,
    },
  ]);

  await insertTestPackage({
    ownerUserId: OWNER_ID,
    slug: 'private-suite',
    name: '私有工作包',
    description: '不会暴露给 npx skills',
    visibility: 'private',
    tags: [],
  });
}

async function cleanup() {
  await db.delete(skillPackageItems);
  await db.delete(skillPackages);
  await db.delete(skills);
  await db.delete(publishables);
  await db.delete(user).where(inArray(user.id, [OWNER_ID, ALICE_ID]));
}

describe('well-known endpoint', () => {
  beforeEach(resetAndSeed);
  afterAll(async () => {
    await cleanup();
    globalThis.fetch = originalFetch;
    for (const key of s3EnvKeys) {
      const original = originalS3Env[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  it('index.json contains only owned + public skills', async () => {
    const res = await app.fetch(
      new Request('http://localhost/.well-known/agent-skills/index.json'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { skills: Array<{ name: string }> };
    expect(body.skills).toHaveLength(1);
    expect(body.skills[0]?.name).toBe('test-owned-public');
  });

  it('index.json entry carries full files list', async () => {
    const res = await app.fetch(
      new Request('http://localhost/.well-known/agent-skills/index.json'),
    );
    const body = (await res.json()) as {
      skills: Array<{ files: string[] }>;
    };
    const entry = body.skills[0];
    expect(entry).toBeDefined();
    expect(entry?.files).toContain('SKILL.md');
    expect(entry?.files).toContain('extra.md');
  });

  it('SKILL.md returns 200 with text/markdown', async () => {
    const res = await app.fetch(
      new Request('http://localhost/.well-known/agent-skills/test-owned-public/SKILL.md'),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    const body = await res.text();
    expect(body).toStartWith('---');
  });

  it('extra.md returns 200 with text/markdown', async () => {
    const res = await app.fetch(
      new Request('http://localhost/.well-known/agent-skills/test-owned-public/extra.md'),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    const body = await res.text();
    expect(body).toContain('extra');
  });

  it('binary assets return original bytes with image content type', async () => {
    const res = await app.fetch(
      new Request(
        'http://localhost/.well-known/agent-skills/test-owned-public/assets/background.webp',
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01]),
    );
  });

  it('private skill returns 404', async () => {
    const res = await app.fetch(
      new Request('http://localhost/.well-known/agent-skills/test-owned-private/SKILL.md'),
    );
    expect(res.status).toBe(404);
  });

  it('referenced skill returns 404', async () => {
    const res = await app.fetch(
      new Request('http://localhost/.well-known/agent-skills/test-ref/SKILL.md'),
    );
    expect(res.status).toBe(404);
  });

  it('path traversal is rejected', async () => {
    const res = await app.fetch(
      new Request('http://localhost/.well-known/agent-skills/test-owned-public/..%2Fetc%2Fpasswd'),
    );
    expect([400, 404]).toContain(res.status);
  });

  it('non-existent skill returns 404', async () => {
    const res = await app.fetch(
      new Request('http://localhost/.well-known/agent-skills/no-such-skill/SKILL.md'),
    );
    expect(res.status).toBe(404);
  });

  it('protocol compliance: each entry passes the vercel-labs/skills validator', async () => {
    const res = await app.fetch(
      new Request('http://localhost/.well-known/agent-skills/index.json'),
    );
    const body = (await res.json()) as { skills: unknown[] };
    for (const entry of body.skills) {
      expect(isValidSkillEntry(entry)).toBe(true);
    }
  });

  it('non-mozia public skills use CLI-safe protocol names, not owner/slug', async () => {
    await db.insert(user).values({
      id: ALICE_ID,
      name: 'Alice',
      handle: 'alice',
      email: 'alice@example.com',
      emailVerified: true,
    });

    const skill = await insertTestSkill({
      slug: 'shared-skill',
      name: 'shared-skill',
      description: 'alice owned public skill',
      type: 'owned',
      visibility: 'public',
      tags: [],
      frontmatter: { name: 'shared-skill' },
      ownerUserId: ALICE_ID,
    });

    await db.insert(skillFiles).values({
      skillId: skill.id,
      path: 'SKILL.md',
      content: '---\nname: shared-skill\n---\n# alice body\n',
    });

    const index = await app.fetch(
      new Request('http://localhost/.well-known/agent-skills/index.json'),
    );
    const body = (await index.json()) as { skills: Array<{ name: string }> };
    const names = body.skills.map((s) => s.name);
    const protocolName = skillProtocolName('alice', 'shared-skill');
    expect(names).toContain(protocolName);
    expect(names).not.toContain('alice/shared-skill');

    const file = await app.fetch(
      new Request(`http://localhost/.well-known/agent-skills/${protocolName}/SKILL.md`),
    );
    expect(file.status).toBe(200);
    expect(await file.text()).toContain('alice body');
  });

  it('package index exposes only public owned skills inside the package', async () => {
    const res = await packageApp.fetch(
      new Request('http://localhost/p/mozia/case-suite/.well-known/agent-skills/index.json'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { skills: Array<{ name: string; files: string[] }> };
    expect(body.skills).toHaveLength(1);
    expect(body.skills[0]?.name).toBe('test-owned-public');
    expect(body.skills[0]?.files).toContain('SKILL.md');
    expect(body.skills[0]?.files).toContain('extra.md');
  });

  it('package file route returns files for npx skills add', async () => {
    const res = await packageApp.fetch(
      new Request(
        'http://localhost/p/mozia/case-suite/.well-known/agent-skills/test-owned-public/SKILL.md',
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(await res.text()).toContain('test-owned-public');
  });

  it('package version route serves a frozen release snapshot', async () => {
    const [pkg] = await db
      .select({ package: skillPackages, publishable: publishables })
      .from(skillPackages)
      .innerJoin(publishables, eq(skillPackages.id, publishables.id))
      .where(eq(publishables.slug, 'case-suite'))
      .limit(1);
    const [skill] = await db
      .select({ skill: skills, publishable: publishables })
      .from(skills)
      .innerJoin(publishables, eq(skills.id, publishables.id))
      .where(eq(publishables.slug, 'test-owned-public'))
      .limit(1);
    if (!pkg || !skill) throw new Error('seed missing package or skill');

    await db.insert(publishableReleases).values({
      publishableId: pkg.package.id,
      version: 1,
      title: '冻结版本',
      changelog: '固定包内 Skill 文件。',
      snapshot: {
        kind: 'package',
        items: [
          {
            skillId: skill.skill.id,
            ownerHandle: 'mozia',
            skillSlug: skill.publishable.slug,
            skillName: skill.publishable.name,
            skillDescription: skill.publishable.description,
            protocolName: skillProtocolName('mozia', skill.publishable.slug),
            position: 0,
            note: null,
            skillReleaseId: 'release-snapshot',
            skillVersion: 1,
            files: [{ path: 'SKILL.md', content: '# frozen package release\n' }],
          },
        ],
      },
      createdByUserId: OWNER_ID,
    });

    const index = await packageApp.fetch(
      new Request('http://localhost/p/mozia/case-suite/v/1/.well-known/agent-skills/index.json'),
    );
    expect(index.status).toBe(200);
    const body = (await index.json()) as { skills: Array<{ name: string; files: string[] }> };
    expect(body.skills[0]?.name).toBe('test-owned-public');
    expect(body.skills[0]?.files).toEqual(['SKILL.md']);

    const file = await packageApp.fetch(
      new Request(
        'http://localhost/p/mozia/case-suite/v/1/.well-known/agent-skills/test-owned-public/SKILL.md',
      ),
    );
    expect(file.status).toBe(200);
    expect(await file.text()).toBe('# frozen package release\n');
  });

  it('package file route does not expose private package items', async () => {
    const res = await packageApp.fetch(
      new Request(
        'http://localhost/p/mozia/case-suite/.well-known/agent-skills/test-owned-private/SKILL.md',
      ),
    );
    expect(res.status).toBe(404);
  });

  it('private packages are hidden from package well-known routes', async () => {
    const res = await packageApp.fetch(
      new Request('http://localhost/p/mozia/private-suite/.well-known/agent-skills/index.json'),
    );
    expect(res.status).toBe(404);
  });

  it('package well-known route rejects path traversal', async () => {
    const res = await packageApp.fetch(
      new Request(
        'http://localhost/p/mozia/case-suite/.well-known/agent-skills/test-owned-public/..%2Fetc%2Fpasswd',
      ),
    );
    expect([400, 404]).toContain(res.status);
  });
});

// Mirrors vercel-labs/skills src/providers/wellknown.ts isValidSkillEntry.
function isValidSkillEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.name !== 'string' || e.name.length === 0) return false;
  if (!/^[a-z0-9-]+$/.test(e.name)) return false;
  if (typeof e.description !== 'string' || e.description.length === 0) return false;
  if (!Array.isArray(e.files) || e.files.length === 0) return false;
  let hasSkillMd = false;
  for (const f of e.files) {
    if (typeof f !== 'string') return false;
    if (f.startsWith('/') || f.startsWith('\\') || f.includes('..')) return false;
    if (f.toLowerCase() === 'skill.md') hasSkillMd = true;
  }
  return hasSkillMd;
}
