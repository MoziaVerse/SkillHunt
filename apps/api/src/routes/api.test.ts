import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, skillFiles, skills, user } from '../db';
import type { AuthContext } from '../lib/auth-context';
import { skillListItemSchema } from '../lib/dto';
import { skillProtocolName } from '../lib/protocol-name';

const OWNER_USER_ID = 'test-owner';
const OTHER_USER_ID = 'test-other';
const OWNER_NAME = 'tester';
const OTHER_NAME = 'other';

// Per-request injected auth — read a custom test header so individual cases
// can simulate "no session" vs "logged in".
//   x-test-user: <id>      → logged-in user with that id
//   (header absent)        → anonymous
const HEADER = 'x-test-user';

mock.module('../lib/auth-context', () => ({
  getAuthContext: async (c: {
    req: { header: (k: string) => string | undefined };
  }): Promise<AuthContext> => {
    const userId = c.req.header(HEADER);
    if (!userId) return { user: null };
    return {
      user: {
        id: userId,
        email: `${userId}@example.com`,
        name: userId,
        ssoSub: `sso-${userId}`,
      },
    };
  },
}));

let app: Hono;

beforeAll(async () => {
  const { apiRoute } = await import('./api');
  app = new Hono().route('/api', apiRoute);
});

async function resetAndSeed() {
  await db.delete(skills);
  await db.delete(user).where(inArray(user.id, [OWNER_USER_ID, OTHER_USER_ID]));

  await db.insert(user).values([
    {
      id: OWNER_USER_ID,
      name: OWNER_NAME,
      handle: OWNER_NAME,
      email: 'tester@example.com',
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

  // owned + public, owned by tester
  const [ownedPub] = await db
    .insert(skills)
    .values({
      slug: 'test-owned-pub',
      name: 'test-owned-pub',
      description: 'magical owned skill',
      type: 'owned',
      visibility: 'public',
      tags: ['design'],
      frontmatter: { name: 'test-owned-pub' },
      ownerUserId: OWNER_USER_ID,
    })
    .returning();
  if (!ownedPub) throw new Error('seed: ownedPub insert failed');
  await db.insert(skillFiles).values({
    skillId: ownedPub.id,
    path: 'SKILL.md',
    content: '---\nname: test-owned-pub\n---\n# body\n',
  });

  // owned + private, owned by tester
  const [ownedPriv] = await db
    .insert(skills)
    .values({
      slug: 'test-owned-priv',
      name: 'test-owned-priv',
      description: 'private only',
      type: 'owned',
      visibility: 'private',
      tags: ['writing'],
      frontmatter: { name: 'test-owned-priv' },
      ownerUserId: OWNER_USER_ID,
    })
    .returning();
  if (!ownedPriv) throw new Error('seed: ownedPriv insert failed');
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
  await db.insert(skills).values({
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
  await db.delete(skills);
  await db.delete(user).where(inArray(user.id, [OWNER_USER_ID, OTHER_USER_ID]));
}

const reqAnon = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init);
const reqAsUser = (path: string, userId: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set(HEADER, userId);
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
    it('owned public skill returns skillMdContent + installCommand + id', async () => {
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
        )} --agent claude-code -y`,
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

  describe('GET /api/skills/:slug (legacy)', () => {
    it('returns 302 to canonical URL when slug exists', async () => {
      const res = await app.fetch(reqAnon('/api/skills/test-owned-pub'));
      expect(res.status).toBe(302);
      const loc = res.headers.get('location') ?? '';
      expect(loc).toContain(`/api/skills/${OWNER_NAME}/test-owned-pub`);
    });

    it('returns 404 when slug does not exist', async () => {
      const res = await app.fetch(reqAnon('/api/skills/no-such'));
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

      const res = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-pub/files/references/foo.md`));
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
      const res = await app.fetch(reqAnon(`/api/skills/${OWNER_NAME}/test-owned-priv/files/${encoded}`));
      expect(res.status).toBe(404);
    });

    it('returns 404 for referenced skills', async () => {
      const res = await app.fetch(reqAnon(`/api/skills/${OTHER_NAME}/test-ref/files/SKILL.md`));
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

  describe('GET /api/users/me', () => {
    it('401 for anonymous', async () => {
      const res = await app.fetch(reqAnon('/api/users/me'));
      expect(res.status).toBe(401);
    });

    it('returns current user', async () => {
      const res = await app.fetch(reqAsUser('/api/users/me', OWNER_USER_ID));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { name: string; isVirtual: boolean };
      expect(body.name).toBe(OWNER_NAME);
      expect(body.isVirtual).toBe(false);
    });
  });

  describe('PATCH /api/users/me/profile', () => {
    it('updates display name to anything (including spaces, mixed case)', async () => {
      const res = await app.fetch(
        reqAsUser('/api/users/me/profile', OWNER_USER_ID, jsonInit({ name: '张三 Mr.' }, 'PATCH')),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { name: string; handle: string };
      expect(body.name).toBe('张三 Mr.');
      expect(body.handle).toBe(OWNER_NAME); // handle unchanged
    });

    it('updates handle to a new url-safe value', async () => {
      const res = await app.fetch(
        reqAsUser(
          '/api/users/me/profile',
          OWNER_USER_ID,
          jsonInit({ handle: 'newhandle' }, 'PATCH'),
        ),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { handle: string };
      expect(body.handle).toBe('newhandle');
    });

    it('409 when handle taken', async () => {
      const res = await app.fetch(
        reqAsUser(
          '/api/users/me/profile',
          OWNER_USER_ID,
          jsonInit({ handle: OTHER_NAME }, 'PATCH'),
        ),
      );
      expect(res.status).toBe(409);
    });

    it('400 for invalid handle', async () => {
      const res = await app.fetch(
        reqAsUser(
          '/api/users/me/profile',
          OWNER_USER_ID,
          jsonInit({ handle: 'Has Spaces' }, 'PATCH'),
        ),
      );
      expect(res.status).toBe(400);
    });

    it('400 for reserved handle', async () => {
      const res = await app.fetch(
        reqAsUser('/api/users/me/profile', OWNER_USER_ID, jsonInit({ handle: 'admin' }, 'PATCH')),
      );
      expect(res.status).toBe(400);
    });

    it('400 when neither name nor handle provided', async () => {
      const res = await app.fetch(
        reqAsUser('/api/users/me/profile', OWNER_USER_ID, jsonInit({}, 'PATCH')),
      );
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/users/me/skills', () => {
    it('lists owner public + private', async () => {
      const res = await app.fetch(reqAsUser('/api/users/me/skills', OWNER_USER_ID));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items.map((i) => i.slug).sort()).toEqual(['test-owned-priv', 'test-owned-pub']);
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

    it('404 for unknown user', async () => {
      const res = await app.fetch(reqAnon('/api/users/no-such-user/skills'));
      expect(res.status).toBe(404);
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
      const list = await app.fetch(reqAsUser('/api/users/me/skills', OWNER_USER_ID));
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
      expect(mintBody.installCommand).toBe(
        `npx skills add http://localhost/i/${mintBody.token} --agent claude-code -y`,
      );
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
});
