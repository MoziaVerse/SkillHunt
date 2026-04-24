import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, skillFiles, skills } from '../db';
import { wellknownRoute } from './wellknown';

const app = new Hono().route('/.well-known', wellknownRoute);

async function resetAndSeed() {
  await db.execute(sql`TRUNCATE TABLE skillhub.skills RESTART IDENTITY CASCADE`);

  const [ownedPublic] = await db
    .insert(skills)
    .values({
      slug: 'test-owned-public',
      name: 'test-owned-public',
      description: 'owned + public for testing',
      type: 'owned',
      visibility: 'public',
      tags: [],
      frontmatter: { name: 'test-owned-public' },
      ownerUserId: 'mozia-virtual',
    })
    .returning();
  if (!ownedPublic) throw new Error('seed: ownedPublic insert failed');

  await db.insert(skillFiles).values([
    {
      skillId: ownedPublic.id,
      path: 'SKILL.md',
      content: '---\nname: test-owned-public\ndescription: x\n---\n# body\n',
    },
    { skillId: ownedPublic.id, path: 'extra.md', content: '# extra\n' },
  ]);

  const [ownedPriv] = await db
    .insert(skills)
    .values({
      slug: 'test-owned-private',
      name: 'test-owned-private',
      description: 'owned + private for testing',
      type: 'owned',
      visibility: 'private',
      tags: [],
      frontmatter: { name: 'test-owned-private' },
      ownerUserId: 'mozia-virtual',
    })
    .returning();
  if (!ownedPriv) throw new Error('seed: ownedPriv insert failed');

  await db.insert(skillFiles).values({
    skillId: ownedPriv.id,
    path: 'SKILL.md',
    content: '---\nname: test-owned-private\ndescription: x\n---\n# private\n',
  });

  await db.insert(skills).values({
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
    ownerUserId: 'mozia-virtual',
  });
}

async function cleanup() {
  await db.execute(sql`TRUNCATE TABLE skillhub.skills RESTART IDENTITY CASCADE`);
}

describe('well-known endpoint', () => {
  beforeEach(resetAndSeed);
  afterAll(cleanup);

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
});

// Mirrors vercel-labs/skills src/providers/wellknown.ts isValidSkillEntry.
function isValidSkillEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.name !== 'string' || e.name.length === 0) return false;
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
