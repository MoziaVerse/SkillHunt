import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, skillFiles, skillInstallEvents, skills, user } from '../db';
import { apiV1Route } from './api-v1';

const app = new Hono().route('/api/v1', apiV1Route);
const OWNER_ID = 'api-v1-owner';
const OWNER_HANDLE = 'api-v1-owner';

async function resetAndSeed() {
  await db.delete(skills);
  await db.delete(user).where(eq(user.id, OWNER_ID));
  await db.insert(user).values({
    id: OWNER_ID,
    name: 'Mozia',
    handle: OWNER_HANDLE,
    email: 'api-v1-owner@example.com',
    emailVerified: true,
    isVirtual: true,
  });

  const [owned] = await db
    .insert(skills)
    .values({
      slug: 'api-v1-owned',
      name: 'API v1 Owned',
      description: 'A public owned skill for api v1 tests',
      type: 'owned',
      visibility: 'public',
      tags: ['api'],
      frontmatter: { name: 'api-v1-owned' },
      ownerUserId: OWNER_ID,
    })
    .returning();
  if (!owned) throw new Error('seed failed');

  await db.insert(skillFiles).values([
    { skillId: owned.id, path: 'SKILL.md', content: '---\nname: api-v1-owned\n---\n# Body\n' },
    { skillId: owned.id, path: 'reference/example.md', content: '# Example\n' },
  ]);
  await db.insert(skillInstallEvents).values([
    { skillId: owned.id, dedupeKey: 'install-one', source: 'well-known' },
    { skillId: owned.id, dedupeKey: 'install-two', source: 'well-known' },
  ]);
}

describe('skills.sh API v1 compatibility', () => {
  beforeEach(resetAndSeed);
  afterEach(() => {
    process.env.SKILLS_API_KEYS = undefined;
  });

  it('GET /api/v1/skills returns data + pagination', async () => {
    const res = await app.fetch(new Request('http://localhost/api/v1/skills?per_page=1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-ratelimit-limit')).toBeNull();
    const body = (await res.json()) as {
      data: Array<{ id: string; installs: number; sourceType: string; installUrl: string }>;
      pagination: { page: number; perPage: number; total: number; hasMore: boolean };
    };
    expect(body.data[0]?.id).toBe('localhost/api-v1-owned');
    expect(body.data[0]?.installs).toBe(2);
    expect(body.data[0]?.sourceType).toBe('well-known');
    expect(body.data[0]?.installUrl).toBe('http://localhost');
    expect(body.pagination.perPage).toBe(1);
  });

  it('allows optional API key auth when SKILLS_API_KEYS is configured', async () => {
    process.env.SKILLS_API_KEYS = 'secret-key';
    const unauthenticated = await app.fetch(new Request('http://localhost/api/v1/skills'));
    expect(unauthenticated.status).toBe(401);

    const authenticated = await app.fetch(
      new Request('http://localhost/api/v1/skills', {
        headers: { authorization: 'Bearer secret-key' },
      }),
    );
    expect(authenticated.status).toBe(200);
  });

  it('GET /api/v1/skills/search returns skills.sh search shape', async () => {
    const res = await app.fetch(new Request('http://localhost/api/v1/skills/search?q=owned'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; query: string; searchType: string };
    expect(body.data).toHaveLength(1);
    expect(body.query).toBe('owned');
    expect(body.searchType).toBe('fuzzy');
  });

  it('returns 503 for semantic search when no semantic backend is configured', async () => {
    const res = await app.fetch(new Request('http://localhost/api/v1/skills/search?q=api%20owned'));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('temporarily_unavailable');
  });

  it('GET /api/v1/skills/:source/:skill returns file snapshot and hash', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/v1/skills/localhost/api-v1-owned'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      installs: number;
      hash: string | null;
      files: Array<{ path: string; contents: string }> | null;
    };
    expect(body.id).toBe('localhost/api-v1-owned');
    expect(body.installs).toBe(2);
    expect(body.hash).toBeString();
    expect(body.files?.map((f) => f.path).sort()).toEqual(['SKILL.md', 'reference/example.md']);
  });
});
