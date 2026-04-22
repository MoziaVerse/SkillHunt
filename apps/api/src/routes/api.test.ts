import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db, skillFiles, skills } from '../db';
import { skillListItemSchema } from '../lib/dto';
import { apiRoute } from './api';

const app = new Hono().route('/api', apiRoute);

async function resetAndSeed() {
  await db.execute(sql`TRUNCATE TABLE skillhub.skills RESTART IDENTITY CASCADE`);

  // owned + public, tag=['design']
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
    })
    .returning();
  if (!ownedPub) throw new Error('seed: ownedPub insert failed');
  await db.insert(skillFiles).values({
    skillId: ownedPub.id,
    path: 'SKILL.md',
    content: '---\nname: test-owned-pub\n---\n# body\n',
  });

  // owned + internal, tag=['writing']
  const [ownedInt] = await db
    .insert(skills)
    .values({
      slug: 'test-owned-int',
      name: 'test-owned-int',
      description: 'internal only',
      type: 'owned',
      visibility: 'internal',
      tags: ['writing'],
      frontmatter: { name: 'test-owned-int' },
    })
    .returning();
  if (!ownedInt) throw new Error('seed: ownedInt insert failed');
  await db.insert(skillFiles).values({
    skillId: ownedInt.id,
    path: 'SKILL.md',
    content: '---\nname: test-owned-int\n---\n# internal body\n',
  });

  // referenced, tag=['tooling']
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
  });
}

async function cleanup() {
  await db.execute(sql`TRUNCATE TABLE skillhub.skills RESTART IDENTITY CASCADE`);
}

describe('business API', () => {
  beforeEach(resetAndSeed);
  afterAll(cleanup);

  describe('GET /api/skills', () => {
    it('default excludes internal skills', async () => {
      const res = await app.fetch(new Request('http://localhost/api/skills'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ slug: string }>; total: number };
      expect(body.items).toHaveLength(2);
      expect(body.items.map((i) => i.slug).sort()).toEqual(['test-owned-pub', 'test-ref']);
      expect(body.total).toBe(2);
    });

    it('includeInternal=true exposes internal skills', async () => {
      const res = await app.fetch(new Request('http://localhost/api/skills?includeInternal=true'));
      const body = (await res.json()) as { items: unknown[] };
      expect(body.items).toHaveLength(3);
    });

    it('type=owned filters to owned only', async () => {
      const res = await app.fetch(
        new Request('http://localhost/api/skills?type=owned&includeInternal=true'),
      );
      const body = (await res.json()) as { items: Array<{ type: string }> };
      expect(body.items.length).toBeGreaterThan(0);
      for (const it of body.items) expect(it.type).toBe('owned');
    });

    it('type=referenced filters to referenced only', async () => {
      const res = await app.fetch(new Request('http://localhost/api/skills?type=referenced'));
      const body = (await res.json()) as { items: Array<{ type: string }> };
      expect(body.items.length).toBeGreaterThan(0);
      for (const it of body.items) expect(it.type).toBe('referenced');
    });

    it('q filters by name / description (ILIKE)', async () => {
      const res = await app.fetch(new Request('http://localhost/api/skills?q=magical'));
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.slug).toBe('test-owned-pub');
    });

    it('tag filters by array overlap', async () => {
      const res = await app.fetch(new Request('http://localhost/api/skills?tag=design'));
      const body = (await res.json()) as { items: Array<{ slug: string }> };
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.slug).toBe('test-owned-pub');

      const res2 = await app.fetch(new Request('http://localhost/api/skills?tag=tooling'));
      const body2 = (await res2.json()) as { items: Array<{ slug: string }> };
      expect(body2.items).toHaveLength(1);
      expect(body2.items[0]?.slug).toBe('test-ref');
    });

    it('results are ordered by updatedAt DESC', async () => {
      // Bump one skill's updatedAt so it becomes the most recent.
      await db.execute(
        sql`UPDATE skillhub.skills SET description = 'touched' WHERE slug = 'test-ref'`,
      );
      const res = await app.fetch(new Request('http://localhost/api/skills'));
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
      const res = await app.fetch(new Request('http://localhost/api/skills?includeInternal=true'));
      const body = (await res.json()) as { items: unknown[] };
      for (const item of body.items) {
        const parsed = skillListItemSchema.safeParse(item);
        expect(parsed.success).toBe(true);
      }
    });
  });

  describe('GET /api/skills/:slug', () => {
    it('owned skill returns skillMdContent + installCommand', async () => {
      const res = await app.fetch(new Request('http://localhost/api/skills/test-owned-pub'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        type: string;
        skillMdContent: string;
        installCommand: string;
        files: string[];
      };
      expect(body.type).toBe('owned');
      expect(body.skillMdContent).toContain('body');
      expect(body.installCommand).toMatch(/^npx skills add http:\/\/.+ --skill test-owned-pub$/);
      expect(body.files).toContain('SKILL.md');
    });

    it('referenced skill returns sourceInstallCommand + sourceUrl', async () => {
      const res = await app.fetch(new Request('http://localhost/api/skills/test-ref'));
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

    it('non-existent slug returns 404', async () => {
      const res = await app.fetch(new Request('http://localhost/api/skills/no-such'));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/tags', () => {
    it('returns distinct tag set', async () => {
      const res = await app.fetch(new Request('http://localhost/api/tags'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { tags: string[] };
      expect(body.tags.sort()).toEqual(['design', 'tooling', 'writing']);
    });
  });
});
