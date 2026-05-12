import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, skillFiles, skills, user } from '../db';
import { skillProtocolName } from '../lib/protocol-name';
import { wellknownRoute } from './wellknown';

const app = new Hono().route('/.well-known', wellknownRoute);
const OWNER_ID = 'mozia-virtual';
const ALICE_ID = 'alice-owner';

async function resetAndSeed() {
  await db.delete(skills);
  await db.delete(user).where(inArray(user.id, [OWNER_ID, ALICE_ID]));
  await db.insert(user).values({
    id: OWNER_ID,
    name: 'Mozia',
    handle: 'mozia',
    email: 'mozia@example.com',
    emailVerified: true,
    isVirtual: true,
  });

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
      ownerUserId: OWNER_ID,
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
      ownerUserId: OWNER_ID,
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
    ownerUserId: OWNER_ID,
  });
}

async function cleanup() {
  await db.delete(skills);
  await db.delete(user).where(inArray(user.id, [OWNER_ID, ALICE_ID]));
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

  it('non-mozia public skills use CLI-safe protocol names, not owner/slug', async () => {
    await db.insert(user).values({
      id: ALICE_ID,
      name: 'Alice',
      handle: 'alice',
      email: 'alice@example.com',
      emailVerified: true,
    });

    const [skill] = await db
      .insert(skills)
      .values({
        slug: 'shared-skill',
        name: 'shared-skill',
        description: 'alice owned public skill',
        type: 'owned',
        visibility: 'public',
        tags: [],
        frontmatter: { name: 'shared-skill' },
        ownerUserId: ALICE_ID,
      })
      .returning();
    if (!skill) throw new Error('seed: alice skill insert failed');

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
