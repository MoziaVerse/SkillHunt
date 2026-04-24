import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, skillFiles, skills, user } from '../db';
import type { AuthContext } from '../lib/auth-context';
import { skillListItemSchema } from '../lib/dto';

const OWNER_USER_ID = 'test-owner';
const OTHER_USER_ID = 'test-other';

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
  await db.execute(sql`TRUNCATE TABLE skillhub.skills RESTART IDENTITY CASCADE`);
  await db.execute(
    sql`DELETE FROM skillhub."user" WHERE id IN (${OWNER_USER_ID}, ${OTHER_USER_ID})`,
  );

  // Two test users: an owner of the private skill, and an unrelated user.
  await db.insert(user).values([
    {
      id: OWNER_USER_ID,
      name: 'tester',
      email: 'tester@example.com',
      emailVerified: true,
    },
    {
      id: OTHER_USER_ID,
      name: 'other',
      email: 'other@example.com',
      emailVerified: true,
    },
  ]);

  // owned + public, tag=['design'], owner = tester
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

  // owned + private, tag=['writing'], owner = tester. Tester can see this; nobody else.
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
  await db.insert(skillFiles).values({
    skillId: ownedPriv.id,
    path: 'SKILL.md',
    content: '---\nname: test-owned-priv\n---\n# private body\n',
  });

  // referenced, tag=['tooling'], owner = other (referenced is always public regardless of owner)
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
  await db.execute(sql`TRUNCATE TABLE skillhub.skills RESTART IDENTITY CASCADE`);
  await db.execute(
    sql`DELETE FROM skillhub."user" WHERE id IN (${OWNER_USER_ID}, ${OTHER_USER_ID})`,
  );
}

const reqAnon = (path: string) => new Request(`http://localhost${path}`);
const reqAsUser = (path: string, userId: string) =>
  new Request(`http://localhost${path}`, { headers: { [HEADER]: userId } });

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
      expect(body.total).toBe(2);
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

    it('type=referenced filters to referenced only', async () => {
      const res = await app.fetch(reqAnon('/api/skills?type=referenced'));
      const body = (await res.json()) as { items: Array<{ type: string }> };
      expect(body.items.length).toBeGreaterThan(0);
      for (const it of body.items) expect(it.type).toBe('referenced');
    });

    it('q filters by name / description (ILIKE)', async () => {
      const res = await app.fetch(reqAnon('/api/skills?q=magical'));
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.slug).toBe('test-owned-pub');
    });

    it('tag filters by array overlap', async () => {
      const res = await app.fetch(reqAnon('/api/skills?tag=design'));
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.slug).toBe('test-owned-pub');

      const res2 = await app.fetch(reqAnon('/api/skills?tag=tooling'));
      const body2 = (await res2.json()) as { items: Array<{ slug: string }> };
      expect(body2.items).toHaveLength(1);
      expect(body2.items[0]?.slug).toBe('test-ref');
    });

    it('results are ordered by updatedAt DESC', async () => {
      // Bump one skill's updatedAt so it becomes the most recent.
      await db.execute(
        sql`UPDATE skillhub.skills SET description = 'touched' WHERE slug = 'test-ref'`,
      );
      const res = await app.fetch(reqAnon('/api/skills'));
      const body = (await res.json()) as { items: Array<{ slug: string; updatedAt: string }> };
      expect(body.items[0]?.slug).toBe('test-ref');
      const times = body.items.map((i) => new Date(i.updatedAt).getTime());
      for (let i = 1; i < times.length; i++) {
        const prev = times[i - 1];
        const cur = times[i];
        if (prev !== undefined && cur !== undefined) expect(prev).toBeGreaterThanOrEqual(cur);
      }
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

  describe('GET /api/skills/:slug', () => {
    it('owned public skill returns skillMdContent + installCommand', async () => {
      const res = await app.fetch(reqAnon('/api/skills/test-owned-pub'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        type: string;
        skillMdContent: string;
        installCommand: string;
        files: string[];
      };
      expect(body.type).toBe('owned');
      expect(body.skillMdContent).toContain('body');
      expect(body.installCommand).toMatch(
        /^npx skills add http:\/\/.+ --skill test-owned-pub --agent claude-code -y$/,
      );
      expect(body.files).toContain('SKILL.md');
    });

    it('referenced skill returns sourceInstallCommand + sourceUrl', async () => {
      const res = await app.fetch(reqAnon('/api/skills/test-ref'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        type: string;
        sourceInstallCommand: string;
        sourceUrl: string | null;
      };
      expect(body.type).toBe('referenced');
      expect(body.sourceInstallCommand).toBe('npx skills add acme/repo --skill test-ref');
      expect(body.sourceUrl).toBe('https://github.com/acme/repo');
    });

    it('private skill returns 404 to anonymous (leak-prevention)', async () => {
      const res = await app.fetch(reqAnon('/api/skills/test-owned-priv'));
      expect(res.status).toBe(404);
    });

    it('private skill returns 404 to a logged-in non-owner (leak-prevention)', async () => {
      const res = await app.fetch(reqAsUser('/api/skills/test-owned-priv', OTHER_USER_ID));
      expect(res.status).toBe(404);
    });

    it('private skill returns 200 to its owner', async () => {
      const res = await app.fetch(reqAsUser('/api/skills/test-owned-priv', OWNER_USER_ID));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        type: string;
        visibility: string;
        owner: { id: string };
      };
      expect(body.type).toBe('owned');
      expect(body.visibility).toBe('private');
      expect(body.owner.id).toBe(OWNER_USER_ID);
    });

    it('non-existent slug returns 404', async () => {
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
});
