import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const nowMs = sql`(unixepoch() * 1000)`;
const randomId = () => crypto.randomUUID();

export const skills = sqliteTable(
  'skills',
  {
    id: text('id').primaryKey().$defaultFn(randomId),

    // URL + CLI install identifier. Rule: lowercase, 1-64, [a-z0-9-].
    slug: text('slug').notNull(),

    name: text('name').notNull(),
    description: text('description').notNull(),

    type: text('type', { enum: ['owned', 'referenced'] }).notNull(),

    // Only meaningful for type='owned'. For 'referenced' we always treat as public.
    visibility: text('visibility', { enum: ['public', 'private'] })
      .notNull()
      .default('public'),

    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),

    // referenced-only fields (null for owned)
    sourceRepo: text('source_repo'),
    sourceSkillName: text('source_skill_name'),
    sourceInstallCommand: text('source_install_command'),
    sourceUrl: text('source_url'),

    // owned-only field: original SKILL.md frontmatter, kept verbatim for future restore.
    frontmatter: text('frontmatter', { mode: 'json' }).$type<Record<string, unknown>>(),

    // Phase 2: every skill belongs to a user (real or virtual). FK is enforced
    // by the DB; not declared here via .references() to avoid a module-import
    // cycle with auth-schema.ts (we don't use drizzle relational queries).
    ownerUserId: text('owner_user_id').notNull(),

    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    // Slug is unique per owner — Phase 2 namespacing means two users can each
    // have their own `foo` skill without collision.
    uniqueIndex('skills_owner_slug_idx').on(t.ownerUserId, t.slug),
    index('skills_type_idx').on(t.type),
    index('skills_visibility_idx').on(t.visibility),
  ],
);

// Only type='owned' skills have file records. Each must have at least one row with path='SKILL.md'.
export const skillFiles = sqliteTable(
  'skill_files',
  {
    id: text('id').primaryKey().$defaultFn(randomId),

    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),

    path: text('path').notNull(),
    content: text('content').notNull(),

    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [uniqueIndex('skill_files_skill_path_idx').on(t.skillId, t.path)],
);

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type SkillFile = typeof skillFiles.$inferSelect;
export type NewSkillFile = typeof skillFiles.$inferInsert;

// ─── Phase 2 spec 03 · capability URL (single-shot install grant) ─────
//
// PAT was removed in 0006 — Bearer auth is forwarded to matrix's central
// key system in spec 04 instead of maintaining a parallel SkillHub table.

export const installGrants = sqliteTable(
  'install_grants',
  {
    token: text('token').primaryKey(),
    skillId: text('skill_id').notNull(),
    grantedBy: text('granted_by').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    maxUses: integer('max_uses').notNull().default(1),
    usedCount: integer('used_count').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    index('install_grants_skill_idx').on(t.skillId),
    index('install_grants_expires_idx').on(t.expiresAt),
  ],
);

export const installGrantUses = sqliteTable(
  'install_grant_uses',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    token: text('token').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    accessedAt: integer('accessed_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    index('grant_uses_token_idx').on(t.token),
    index('grant_uses_accessed_idx').on(t.accessedAt),
  ],
);

export type InstallGrant = typeof installGrants.$inferSelect;

export const skillInstallEvents = sqliteTable(
  'skill_install_events',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    dedupeKey: text('dedupe_key').notNull(),
    source: text('source', { enum: ['well-known', 'capability'] }).notNull(),
    installedAt: integer('installed_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('skill_install_events_skill_dedupe_idx').on(t.skillId, t.dedupeKey),
    index('skill_install_events_skill_idx').on(t.skillId),
    index('skill_install_events_installed_at_idx').on(t.installedAt),
  ],
);

export type SkillInstallEvent = typeof skillInstallEvents.$inferSelect;
