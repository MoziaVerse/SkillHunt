import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { SkillFileSnapshotEntry } from '../lib/skill-file-payload';

const nowMs = sql`(unixepoch() * 1000)`;
const randomId = () => crypto.randomUUID();

export const publishables = sqliteTable(
  'publishables',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    kind: text('kind', { enum: ['skill', 'package'] }).notNull(),
    ownerUserId: text('owner_user_id').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    visibility: text('visibility', { enum: ['public', 'private'] })
      .notNull()
      .default('private'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    icon: text('icon'),
    coverImage: text('cover_image'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('publishables_owner_kind_slug_idx').on(t.ownerUserId, t.kind, t.slug),
    index('publishables_kind_idx').on(t.kind),
    index('publishables_visibility_idx').on(t.visibility),
    index('publishables_updated_at_idx').on(t.updatedAt),
  ],
);

export type PublishableKind = 'skill' | 'package';
export type SkillReleaseSnapshot = {
  kind: 'skill';
  files: SkillFileSnapshotEntry[];
};
export type PackageReleaseSnapshot = {
  kind: 'package';
  items: Array<{
    skillId: string;
    ownerHandle: string;
    skillSlug: string;
    skillName: string;
    skillDescription: string;
    protocolName: string;
    position: number;
    note: string | null;
    skillReleaseId: string;
    skillVersion: number;
    files: SkillFileSnapshotEntry[];
  }>;
};
export type PublishableReleaseSnapshot = SkillReleaseSnapshot | PackageReleaseSnapshot;

export const publishableReleases = sqliteTable(
  'publishable_releases',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    publishableId: text('publishable_id')
      .notNull()
      .references(() => publishables.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    changelog: text('changelog').notNull().default(''),
    snapshot: text('snapshot', { mode: 'json' }).$type<PublishableReleaseSnapshot>().notNull(),
    createdByUserId: text('created_by_user_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('publishable_releases_publishable_version_idx').on(t.publishableId, t.version),
    index('publishable_releases_publishable_idx').on(t.publishableId),
    index('publishable_releases_created_at_idx').on(t.createdAt),
  ],
);

export const skills = sqliteTable(
  'skills',
  {
    id: text('id')
      .primaryKey()
      .references(() => publishables.id, { onDelete: 'cascade' }),

    type: text('type', { enum: ['owned', 'referenced'] }).notNull(),

    // referenced-only fields (null for owned)
    sourceRepo: text('source_repo'),
    sourceSkillName: text('source_skill_name'),
    sourceInstallCommand: text('source_install_command'),
    sourceUrl: text('source_url'),

    // owned-only field: original SKILL.md frontmatter, kept verbatim for future restore.
    frontmatter: text('frontmatter', { mode: 'json' }).$type<Record<string, unknown>>(),

    // SkillHunt display field (decoupled from SKILL.md content).
    demoVideoUrl: text('demo_video_url'), // external video URL

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
  },
  (t) => [
    index('skills_type_idx').on(t.type),
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
    storageKind: text('storage_kind', { enum: ['inline', 'oss'] })
      .notNull()
      .default('inline'),
    objectKey: text('object_key'),
    contentType: text('content_type'),
    sizeBytes: integer('size_bytes').notNull().default(0),

    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [uniqueIndex('skill_files_skill_path_idx').on(t.skillId, t.path)],
);

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type SkillFile = typeof skillFiles.$inferSelect;
export type NewSkillFile = typeof skillFiles.$inferInsert;

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

export type Publishable = typeof publishables.$inferSelect;
export type NewPublishable = typeof publishables.$inferInsert;
export type PublishableRelease = typeof publishableReleases.$inferSelect;
export type NewPublishableRelease = typeof publishableReleases.$inferInsert;
export type SkillSyncEvent = typeof skillSyncEvents.$inferSelect;

// ─── Capability URL (single-shot install grant) ─────
//
// Bearer auth is forwarded to matrix's central key system instead of
// maintaining a parallel SkillHunt PAT table.

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

// ─── SkillHunt: Skill Packages ─────

export const skillPackages = sqliteTable('skill_packages', {
  id: text('id')
    .primaryKey()
    .references(() => publishables.id, { onDelete: 'cascade' }),
});

export const skillPackageItems = sqliteTable(
  'skill_package_items',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    packageId: text('package_id')
      .notNull()
      .references(() => skillPackages.id, { onDelete: 'cascade' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    note: text('note'),
    pinnedReleaseId: text('pinned_release_id').references(() => publishableReleases.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('skill_package_items_package_skill_idx').on(t.packageId, t.skillId),
    index('skill_package_items_package_position_idx').on(t.packageId, t.position),
    index('skill_package_items_skill_idx').on(t.skillId),
  ],
);

export type SkillPackage = typeof skillPackages.$inferSelect;
export type NewSkillPackage = typeof skillPackages.$inferInsert;
export type SkillPackageItem = typeof skillPackageItems.$inferSelect;
export type NewSkillPackageItem = typeof skillPackageItems.$inferInsert;

export const publishableUpvotes = sqliteTable(
  'publishable_upvotes',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    publishableId: text('publishable_id')
      .notNull()
      .references(() => publishables.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('publishable_upvotes_publishable_user_idx').on(t.publishableId, t.userId),
    index('publishable_upvotes_publishable_idx').on(t.publishableId),
    index('publishable_upvotes_user_idx').on(t.userId),
    index('publishable_upvotes_created_at_idx').on(t.createdAt),
  ],
);

export const publishableComments = sqliteTable(
  'publishable_comments',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    publishableId: text('publishable_id')
      .notNull()
      .references(() => publishables.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    parentId: text('parent_id'),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    index('publishable_comments_publishable_idx').on(t.publishableId),
    index('publishable_comments_user_idx').on(t.userId),
    index('publishable_comments_parent_idx').on(t.parentId),
    index('publishable_comments_created_at_idx').on(t.createdAt),
  ],
);

export const publishableBookmarks = sqliteTable(
  'publishable_bookmarks',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    userId: text('user_id').notNull(),
    publishableId: text('publishable_id')
      .notNull()
      .references(() => publishables.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('publishable_bookmarks_user_publishable_idx').on(t.userId, t.publishableId),
    index('publishable_bookmarks_user_idx').on(t.userId),
    index('publishable_bookmarks_publishable_idx').on(t.publishableId),
    index('publishable_bookmarks_created_at_idx').on(t.createdAt),
  ],
);

export const publishableSubscriptions = sqliteTable(
  'publishable_subscriptions',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    userId: text('user_id').notNull(),
    publishableId: text('publishable_id')
      .notNull()
      .references(() => publishables.id, { onDelete: 'cascade' }),
    active: integer('active').notNull().default(1),
    notifyOnRelease: integer('notify_on_release').notNull().default(1),
    notifyOnSync: integer('notify_on_sync').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('publishable_subscriptions_user_publishable_idx').on(t.userId, t.publishableId),
    index('publishable_subscriptions_publishable_idx').on(t.publishableId),
    index('publishable_subscriptions_user_idx').on(t.userId),
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
    publishableId: text('publishable_id'),
    commentId: text('comment_id'),
    read: integer('read').notNull().default(0), // SQLite doesn't have boolean
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId),
    index('notifications_user_read_idx').on(t.userId, t.read),
    index('notifications_publishable_idx').on(t.publishableId),
    index('notifications_created_at_idx').on(t.createdAt),
  ],
);

export type PublishableUpvote = typeof publishableUpvotes.$inferSelect;
export type NewPublishableUpvote = typeof publishableUpvotes.$inferInsert;
export type PublishableComment = typeof publishableComments.$inferSelect;
export type NewPublishableComment = typeof publishableComments.$inferInsert;
export type PublishableBookmark = typeof publishableBookmarks.$inferSelect;
export type NewPublishableBookmark = typeof publishableBookmarks.$inferInsert;
export type PublishableSubscription = typeof publishableSubscriptions.$inferSelect;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export const contestUsers = sqliteTable(
  'contest_users',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    eventSlug: text('event_slug').notNull(),
    phone: text('phone').notNull(),
    status: text('status', { enum: ['eligible', 'disqualified'] })
      .notNull()
      .default('eligible'),
    note: text('note'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('contest_users_event_phone_idx').on(t.eventSlug, t.phone),
    index('contest_users_event_status_idx').on(t.eventSlug, t.status),
  ],
);

export const contestSubmissions = sqliteTable(
  'contest_submissions',
  {
    id: text('id').primaryKey().$defaultFn(randomId),
    eventSlug: text('event_slug').notNull(),
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    submitterUserId: text('submitter_user_id').notNull(),
    track: text('track', { enum: ['学习科研', '校园生活', '创意应用', '专业实训'] }).notNull(),
    videoObjectKey: text('video_object_key'),
    videoUrl: text('video_url'),
    videoDurationSeconds: integer('video_duration_seconds'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('contest_submissions_event_skill_idx').on(t.eventSlug, t.skillId),
    index('contest_submissions_event_user_idx').on(t.eventSlug, t.submitterUserId),
    index('contest_submissions_event_track_idx').on(t.eventSlug, t.track),
    index('contest_submissions_created_at_idx').on(t.createdAt),
  ],
);

export type ContestSubmission = typeof contestSubmissions.$inferSelect;
export type NewContestSubmission = typeof contestSubmissions.$inferInsert;
export type ContestUser = typeof contestUsers.$inferSelect;
export type NewContestUser = typeof contestUsers.$inferInsert;
