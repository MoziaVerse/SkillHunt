import { sql } from 'drizzle-orm';
import {
  index,
  inet,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Dedicated schema, isolated from other mozia tables.
export const skillhubSchema = pgSchema('skillhub');

export const skillTypeEnum = skillhubSchema.enum('skill_type', ['owned', 'referenced']);
export const visibilityEnum = skillhubSchema.enum('visibility', ['public', 'private']);

export const skills = skillhubSchema.table(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // URL + CLI install identifier. Rule: lowercase, 1-64, [a-z0-9-].
    slug: text('slug').notNull(),

    name: text('name').notNull(),
    description: text('description').notNull(),

    type: skillTypeEnum('type').notNull(),

    // Only meaningful for type='owned'. For 'referenced' we always treat as public.
    visibility: visibilityEnum('visibility').notNull().default('public'),

    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),

    // referenced-only fields (null for owned)
    sourceRepo: text('source_repo'),
    sourceSkillName: text('source_skill_name'),
    sourceInstallCommand: text('source_install_command'),
    sourceUrl: text('source_url'),

    // owned-only field: original SKILL.md frontmatter, kept verbatim for future restore.
    frontmatter: jsonb('frontmatter').$type<Record<string, unknown>>(),

    // Phase 2: every skill belongs to a user (real or virtual). FK is enforced
    // by the DB; not declared here via .references() to avoid a module-import
    // cycle with auth-schema.ts (we don't use drizzle relational queries).
    ownerUserId: text('owner_user_id').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
export const skillFiles = skillhubSchema.table(
  'skill_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),

    path: text('path').notNull(),
    content: text('content').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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

export const installGrants = skillhubSchema.table(
  'install_grants',
  {
    token: text('token').primaryKey(),
    skillId: uuid('skill_id').notNull(),
    grantedBy: text('granted_by').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    maxUses: integer('max_uses').notNull().default(1),
    usedCount: integer('used_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('install_grants_skill_idx').on(t.skillId),
    index('install_grants_expires_idx').on(t.expiresAt),
  ],
);

export const installGrantUses = skillhubSchema.table(
  'install_grant_uses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull(),
    ip: inet('ip'),
    userAgent: text('user_agent'),
    accessedAt: timestamp('accessed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('grant_uses_token_idx').on(t.token),
    index('grant_uses_accessed_idx').on(t.accessedAt),
  ],
);

export type InstallGrant = typeof installGrants.$inferSelect;
