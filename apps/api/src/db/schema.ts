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

    // GitHub-like fork lineage. Null means this is an original skill.
    parentSkillId: text('parent_skill_id'),
    rootSkillId: text('root_skill_id'),
    forkSourceReleaseId: text('fork_source_release_id'),
    latestSyncedReleaseId: text('latest_synced_release_id'),
    forkMode: text('fork_mode', { enum: ['linked', 'detached'] })
      .notNull()
      .default('linked'),
    allowUpstreamSync: integer('allow_upstream_sync').notNull().default(1),
    forkNote: text('fork_note'),

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
    index('skills_parent_idx').on(t.parentSkillId),
    index('skills_root_idx').on(t.rootSkillId),
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

export const skillReleases = sqliteTable(
  'skill_releases',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    changelog: text('changelog').notNull().default(''),
    snapshotFiles: text('snapshot_files', { mode: 'json' })
      .$type<Array<{ path: string; content: string }>>()
      .notNull(),
    createdByUserId: text('created_by_user_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('skill_releases_skill_version_idx').on(t.skillId, t.version),
    index('skill_releases_skill_idx').on(t.skillId),
    index('skill_releases_created_at_idx').on(t.createdAt),
  ],
);

export const skillSyncEvents = sqliteTable(
  'skill_sync_events',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    forkSkillId: text('fork_skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    upstreamSkillId: text('upstream_skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    fromReleaseId: text('from_release_id'),
    toReleaseId: text('to_release_id').notNull(),
    status: text('status', { enum: ['success', 'conflict', 'failed'] }).notNull(),
    conflictFiles: text('conflict_files', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    summary: text('summary').notNull().default(''),
    createdByUserId: text('created_by_user_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    index('skill_sync_events_fork_idx').on(t.forkSkillId),
    index('skill_sync_events_upstream_idx').on(t.upstreamSkillId),
    index('skill_sync_events_created_at_idx').on(t.createdAt),
  ],
);

export const skillSubscriptions = sqliteTable(
  'skill_subscriptions',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    userId: text('user_id').notNull(),
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    active: integer('active').notNull().default(1),
    notifyOnRelease: integer('notify_on_release').notNull().default(1),
    notifyOnSync: integer('notify_on_sync').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('skill_subscriptions_user_skill_idx').on(t.userId, t.skillId),
    index('skill_subscriptions_skill_idx').on(t.skillId),
    index('skill_subscriptions_user_idx').on(t.userId),
  ],
);

export type SkillRelease = typeof skillReleases.$inferSelect;
export type NewSkillRelease = typeof skillReleases.$inferInsert;
export type SkillSyncEvent = typeof skillSyncEvents.$inferSelect;
export type SkillSubscription = typeof skillSubscriptions.$inferSelect;

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

// ─── SkillHunt: Community Features ─────

// Upvotes table: each user can upvote a skill only once
// Note: FK constraints are enforced at application level (like ownerUserId on skills)
export const skillUpvotes = sqliteTable(
  'skill_upvotes',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    skillId: text('skill_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('skill_upvotes_skill_user_idx').on(t.skillId, t.userId),
    index('skill_upvotes_skill_idx').on(t.skillId),
    index('skill_upvotes_user_idx').on(t.userId),
    index('skill_upvotes_created_at_idx').on(t.createdAt),
  ],
);

// Comments table: supports threaded comments via parent_id
export const skillComments = sqliteTable(
  'skill_comments',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    skillId: text('skill_id').notNull(),
    userId: text('user_id').notNull(),
    parentId: text('parent_id'), // NULL for top-level comments
    content: text('content').notNull(), // Markdown content
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    index('skill_comments_skill_idx').on(t.skillId),
    index('skill_comments_user_idx').on(t.userId),
    index('skill_comments_parent_idx').on(t.parentId),
    index('skill_comments_created_at_idx').on(t.createdAt),
  ],
);

// Bookmarks table: users can bookmark skills for later
export const userBookmarks = sqliteTable(
  'user_bookmarks',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    userId: text('user_id').notNull(),
    skillId: text('skill_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('user_bookmarks_user_skill_idx').on(t.userId, t.skillId),
    index('user_bookmarks_user_idx').on(t.userId),
    index('user_bookmarks_skill_idx').on(t.skillId),
    index('user_bookmarks_created_at_idx').on(t.createdAt),
  ],
);

// Notifications table
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    userId: text('user_id').notNull(),
    type: text('type', {
      enum: ['upvote', 'comment', 'reply', 'bookmark', 'fork', 'sync', 'release'],
    }).notNull(),
    actorId: text('actor_id'), // User who triggered the notification
    skillId: text('skill_id'),
    commentId: text('comment_id'),
    read: integer('read').notNull().default(0), // SQLite doesn't have boolean
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId),
    index('notifications_user_read_idx').on(t.userId, t.read),
    index('notifications_created_at_idx').on(t.createdAt),
  ],
);

// Skill counts cache table (for performance)
export const skillCounts = sqliteTable('skill_counts', {
  skillId: text('skill_id').primaryKey(),
  upvoteCount: integer('upvote_count').notNull().default(0),
  commentCount: integer('comment_count').notNull().default(0),
  bookmarkCount: integer('bookmark_count').notNull().default(0),
  featuredDate: text('featured_date'), // YYYY-MM-DD format
});

export type SkillUpvote = typeof skillUpvotes.$inferSelect;
export type NewSkillUpvote = typeof skillUpvotes.$inferInsert;

export type SkillComment = typeof skillComments.$inferSelect;
export type NewSkillComment = typeof skillComments.$inferInsert;

export type UserBookmark = typeof userBookmarks.$inferSelect;
export type NewUserBookmark = typeof userBookmarks.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type SkillCounts = typeof skillCounts.$inferSelect;
export type NewSkillCounts = typeof skillCounts.$inferInsert;
