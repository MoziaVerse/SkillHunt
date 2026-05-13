// Seed builtin owned skills from the repository's builtin-skills/ directory.
// Idempotent: upserts by slug, fully replaces skill_files rows.

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq } from 'drizzle-orm';
import { db, skillFiles, skills, user } from '../apps/api/src/db';

// All seed-driven owned skills are attributed to the `mozia` virtual user
// (created by migration 0003). Phase 2 pass 2 will allow per-entry overrides.
const SEED_OWNER_ID = 'mozia-virtual';
const SEED_OWNER_HANDLE = 'mozia';

async function ensureSeedOwner() {
  await db
    .insert(user)
    .values({
      id: SEED_OWNER_ID,
      name: 'mozia',
      handle: SEED_OWNER_HANDLE,
      email: 'mozia-virtual@skillhub.local',
      emailVerified: true,
      isVirtual: true,
    })
    .onConflictDoUpdate({
      target: user.id,
      set: {
        name: 'mozia',
        handle: SEED_OWNER_HANDLE,
        isVirtual: true,
        updatedAt: new Date(),
      },
    });
}

export interface OwnedEntry {
  slug: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  tags: string[];
  icon?: string | null;
  coverImage?: string | null;
  demoVideoUrl?: string | null;
  files: Array<{ path: string; content: string }>;
}

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;

function parseFrontmatter(md: string): Record<string, unknown> {
  // Minimal YAML frontmatter parse: `key: value` lines only.
  // Good enough for our SKILL.md files; not a general YAML parser.
  const lines = md.split('\n');
  if (lines[0] !== '---') return {};
  const out: Record<string, unknown> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '---') break;
    if (!line || !line.includes(':')) continue;
    const idx = line.indexOf(':');
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

interface BuiltinSkillMeta {
  visibility: 'public' | 'private';
  tags: string[];
  icon?: string | null;
  coverImage?: string | null;
  demoVideoUrl?: string | null;
}

const BUILTIN_META_FILE = 'skill.json';

async function collectBuiltinFiles(
  skillDir: string,
  currentDir = skillDir,
): Promise<Array<{ path: string; content: string }>> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files: Array<{ path: string; content: string }> = [];

  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isSymbolicLink()) continue;

    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectBuiltinFiles(skillDir, fullPath)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name === BUILTIN_META_FILE && currentDir === skillDir) continue;

    files.push({
      path: relative(skillDir, fullPath).replaceAll('\\', '/'),
      content: await readFile(fullPath, 'utf8'),
    });
  }

  return files;
}

export async function loadBuiltinOwnedEntries(
  root = new URL('../builtin-skills/', import.meta.url),
): Promise<OwnedEntry[]> {
  const rootPath = fileURLToPath(root);
  const dirs = await readdir(rootPath, { withFileTypes: true });
  const entries: OwnedEntry[] = [];

  for (const dir of [...dirs].sort((a, b) => a.name.localeCompare(b.name))) {
    if (!dir.isDirectory()) continue;
    if (dir.name.startsWith('.')) continue;

    const slug = dir.name;
    if (!SLUG_RE.test(slug) && slug.length !== 1) {
      throw new Error(`[seed-owned] invalid builtin skill directory: '${slug}'`);
    }

    const skillDir = join(rootPath, slug);
    const metaPath = join(skillDir, BUILTIN_META_FILE);
    const metaRaw = await readFile(metaPath, 'utf8').catch(() => null);
    if (!metaRaw) {
      throw new Error(`[seed-owned] missing ${BUILTIN_META_FILE} for slug '${slug}'`);
    }

    const meta = JSON.parse(metaRaw) as BuiltinSkillMeta;
    if (!['public', 'private'].includes(meta.visibility)) {
      throw new Error(`[seed-owned] invalid visibility for slug '${slug}'`);
    }
    if (!Array.isArray(meta.tags) || meta.tags.some((tag) => typeof tag !== 'string')) {
      throw new Error(`[seed-owned] invalid tags for slug '${slug}'`);
    }
    if (meta.icon !== undefined && meta.icon !== null && typeof meta.icon !== 'string') {
      throw new Error(`[seed-owned] invalid icon for slug '${slug}'`);
    }
    if (
      meta.coverImage !== undefined &&
      meta.coverImage !== null &&
      typeof meta.coverImage !== 'string'
    ) {
      throw new Error(`[seed-owned] invalid coverImage for slug '${slug}'`);
    }
    if (
      meta.demoVideoUrl !== undefined &&
      meta.demoVideoUrl !== null &&
      typeof meta.demoVideoUrl !== 'string'
    ) {
      throw new Error(`[seed-owned] invalid demoVideoUrl for slug '${slug}'`);
    }
    if (meta.icon && meta.coverImage) {
      throw new Error(`[seed-owned] icon and coverImage are mutually exclusive for slug '${slug}'`);
    }

    const files = await collectBuiltinFiles(skillDir);
    const skillMd = files.find((file) => file.path === 'SKILL.md')?.content;
    if (!skillMd) {
      throw new Error(`[seed-owned] missing SKILL.md for slug '${slug}'`);
    }

    const frontmatter = parseFrontmatter(skillMd);
    const name =
      typeof frontmatter.name === 'string' && frontmatter.name.trim().length > 0
        ? frontmatter.name.trim()
        : null;
    const description =
      typeof frontmatter.description === 'string' && frontmatter.description.trim().length > 0
        ? frontmatter.description.trim()
        : null;

    if (!name || !description) {
      throw new Error(`[seed-owned] missing name/description frontmatter for slug '${slug}'`);
    }

    entries.push({
      slug,
      name,
      description,
      visibility: meta.visibility,
      tags: [...meta.tags],
      icon: meta.icon ?? null,
      coverImage: meta.coverImage ?? null,
      demoVideoUrl: meta.demoVideoUrl ?? null,
      files,
    });
  }

  return entries;
}

export async function seedOwned(
  entries: OwnedEntry[],
  log: (msg: string) => void = console.log,
): Promise<{ upserted: number; fileCount: number }> {
  let upserted = 0;
  let fileCount = 0;
  await ensureSeedOwner();

  for (const entry of entries) {
    if (!SLUG_RE.test(entry.slug) && entry.slug.length !== 1) {
      throw new Error(`[seed-owned] invalid slug: '${entry.slug}'`);
    }
    const skillMd = entry.files.find((file) => file.path === 'SKILL.md')?.content;
    if (!skillMd) {
      throw new Error(`[seed-owned] missing SKILL.md for slug '${entry.slug}'`);
    }

    const existing = await db
      .select()
      .from(skills)
      .where(and(eq(skills.slug, entry.slug), eq(skills.ownerUserId, SEED_OWNER_ID)))
      .limit(1);

    if (existing[0] && existing[0].type !== 'owned') {
      throw new Error(
        `[seed-owned] slug '${entry.slug}' already exists as ${existing[0].type}. Refusing to overwrite.`,
      );
    }

    const frontmatter = parseFrontmatter(skillMd);
    const name =
      typeof frontmatter.name === 'string' && frontmatter.name.trim().length > 0
        ? frontmatter.name.trim()
        : entry.name;
    const description =
      typeof frontmatter.description === 'string' && frontmatter.description.trim().length > 0
        ? frontmatter.description.trim()
        : entry.description;

    if (!name || !description) {
      throw new Error(`[seed-owned] missing name/description for slug '${entry.slug}'`);
    }

    const [row] = await db
      .insert(skills)
      .values({
        slug: entry.slug,
        name,
        description,
        type: 'owned',
        visibility: entry.visibility,
        tags: entry.tags,
        frontmatter,
        icon: entry.icon ?? null,
        coverImage: entry.coverImage ?? null,
        demoVideoUrl: entry.demoVideoUrl ?? null,
        ownerUserId: SEED_OWNER_ID,
      })
      .onConflictDoUpdate({
        target: [skills.ownerUserId, skills.slug],
        set: {
          name,
          description,
          visibility: entry.visibility,
          tags: entry.tags,
          frontmatter,
          icon: entry.icon ?? null,
          coverImage: entry.coverImage ?? null,
          demoVideoUrl: entry.demoVideoUrl ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error(`[seed-owned] upsert did not return row for '${entry.slug}'`);

    // Full replace of files: simpler than diffing.
    await db.delete(skillFiles).where(eq(skillFiles.skillId, row.id));

    for (const f of entry.files) {
      if (f.path.includes('..') || f.path.startsWith('/')) {
        throw new Error(`[seed-owned] unsafe path '${f.path}' for slug '${entry.slug}'`);
      }
      await db.insert(skillFiles).values({
        skillId: row.id,
        path: f.path,
        content: f.content,
      });
      fileCount++;
    }

    log(
      `[seed-owned] ✓ ${entry.slug} (${entry.files.length} file${entry.files.length === 1 ? '' : 's'}, ${entry.visibility})`,
    );
    upserted++;
  }

  return { upserted, fileCount };
}

if (import.meta.main) {
  const entries = await loadBuiltinOwnedEntries();
  const result = await seedOwned(entries);
  console.log(`[seed-owned] done (${result.upserted} skills, ${result.fileCount} files)`);
  process.exit(0);
}
