import { sql } from 'drizzle-orm';
import { boolean, text, timestamp } from 'drizzle-orm/pg-core';
import { skillhubSchema } from './schema';

// better-auth core tables, mounted into the same `skillhub` pgSchema as
// `skills` / `skill_files`. Field names match better-auth's drizzleAdapter
// expectations (camelCase TS keys → snake_case DB columns).

export const user = skillhubSchema.table('user', {
  id: text('id').primaryKey(),
  // Display name — anything goes (Chinese, spaces, mixed case). Distinct from
  // `handle` which is the URL-safe identifier (lowercase + dashes).
  name: text('name').notNull(),
  // URL handle — globally unique, used in /u/:handle and /skills/:handle/:slug.
  handle: text('handle').notNull().unique(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  // mozia-sso (Casdoor) `sub` claim — stable identity for cross-system joins later.
  ssoSub: text('sso_sub'),
  // Phase 2: virtual users like `mozia` represent collective publisher
  // identities, not real SSO accounts. Real users have isVirtual=false.
  isVirtual: boolean('is_virtual').notNull().default(false),
  // Owner names (user.name strings) this user can publish skills as. The user
  // can always publish under their own name; this list adds extra owners,
  // typically virtuals like `mozia`. Empty by default.
  canPublishAs: text('can_publish_as').array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = skillhubSchema.table('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = skillhubSchema.table('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = skillhubSchema.table('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AuthUser = typeof user.$inferSelect;
export type AuthSession = typeof session.$inferSelect;
export type AuthAccount = typeof account.$inferSelect;
