import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const nowMs = sql`(unixepoch() * 1000)`;

// better-auth core tables. Field names match better-auth's drizzleAdapter
// expectations (camelCase TS keys → snake_case DB columns).

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  // Display name — anything goes (Chinese, spaces, mixed case). Distinct from
  // `handle` which is the URL-safe identifier (lowercase + dashes).
  name: text('name').notNull(),
  // URL handle — globally unique, used in /u/:handle and /skills/:handle/:slug.
  handle: text('handle').notNull().unique(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  // mozia-sso (Casdoor) `sub` claim — stable identity for cross-system joins later.
  ssoSub: text('sso_sub'),
  // Phase 2: virtual users like `mozia` represent collective publisher
  // identities, not real SSO accounts. Real users have isVirtual=false.
  isVirtual: integer('is_virtual', { mode: 'boolean' }).notNull().default(false),
  // Owner names (user.name strings) this user can publish skills as. The user
  // can always publish under their own name; this list adds extra owners,
  // typically virtuals like `mozia`. Empty by default.
  canPublishAs: text('can_publish_as', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
});

export const externalIdentities = sqliteTable(
  'external_identities',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    issuer: text('issuer').notNull(),
    subject: text('subject').notNull(),
    emailSnapshot: text('email_snapshot'),
    nameSnapshot: text('name_snapshot'),
    avatarSnapshot: text('avatar_snapshot'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('external_identities_provider_issuer_subject_idx').on(
      t.provider,
      t.issuer,
      t.subject,
    ),
    index('external_identities_user_idx').on(t.userId),
  ],
);

export type AuthUser = typeof user.$inferSelect;
export type AuthSession = typeof session.$inferSelect;
export type AuthAccount = typeof account.$inferSelect;
export type ExternalIdentity = typeof externalIdentities.$inferSelect;
