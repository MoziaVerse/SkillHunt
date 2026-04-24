import { randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { db, personalAccessTokens } from '../db';

// PAT format: `mzhk_pat_<32-byte-base64url>`
// Prefix is human-recognizable (cf. GitHub `ghp_*`, OpenAI `sk-*`).
const PAT_FORMAT_PREFIX = 'mzhk_pat_';
// 32 bytes → 43 base64url chars; total length ≈ 52
const TOKEN_BYTES = 32;
// Hashed prefix used for human-display & lookup hint. NOT the secret part.
const DISPLAY_PREFIX_LEN = 14; // covers "mzhk_pat_" + first 5 chars of secret

export interface CreatePatInput {
  userId: string;
  name: string;
  expiresInDays?: number;
}

export interface CreatePatResult {
  id: string;
  name: string;
  /** Plain token — only available at creation. */
  token: string;
  tokenPrefix: string;
  expiresAt: Date | null;
  createdAt: Date;
}

function randomToken(): string {
  return PAT_FORMAT_PREFIX + randomBytes(TOKEN_BYTES).toString('base64url');
}

export async function createPat(input: CreatePatInput): Promise<CreatePatResult> {
  const token = randomToken();
  const tokenPrefix = token.slice(0, DISPLAY_PREFIX_LEN);
  const tokenHash = await Bun.password.hash(token);
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  const [row] = await db
    .insert(personalAccessTokens)
    .values({
      userId: input.userId,
      name: input.name,
      tokenHash,
      tokenPrefix,
      expiresAt,
    })
    .returning({
      id: personalAccessTokens.id,
      name: personalAccessTokens.name,
      tokenPrefix: personalAccessTokens.tokenPrefix,
      expiresAt: personalAccessTokens.expiresAt,
      createdAt: personalAccessTokens.createdAt,
    });
  if (!row) throw new Error('createPat: insert returned no row');
  return { ...row, token };
}

export interface PatRow {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export async function listPats(userId: string): Promise<PatRow[]> {
  return db
    .select({
      id: personalAccessTokens.id,
      name: personalAccessTokens.name,
      tokenPrefix: personalAccessTokens.tokenPrefix,
      lastUsedAt: personalAccessTokens.lastUsedAt,
      expiresAt: personalAccessTokens.expiresAt,
      createdAt: personalAccessTokens.createdAt,
    })
    .from(personalAccessTokens)
    .where(eq(personalAccessTokens.userId, userId));
}

export async function revokePat(userId: string, patId: string): Promise<boolean> {
  const result = await db
    .delete(personalAccessTokens)
    .where(and(eq(personalAccessTokens.id, patId), eq(personalAccessTokens.userId, userId)))
    .returning({ id: personalAccessTokens.id });
  return result.length > 0;
}

/**
 * Verify a presented token. Returns the userId that owns it on success, null
 * otherwise. Updates `last_used_at` opportunistically.
 *
 * Linear scan + bcrypt verify is fine at our scale (≤100 PATs total expected
 * for a long while). If we hit 10k+ PATs, switch to keyed lookup with a
 * deterministic hash prefix.
 */
export async function verifyPat(presented: string): Promise<string | null> {
  if (!presented.startsWith(PAT_FORMAT_PREFIX)) return null;
  const prefix = presented.slice(0, DISPLAY_PREFIX_LEN);

  const candidates = await db
    .select({
      id: personalAccessTokens.id,
      userId: personalAccessTokens.userId,
      tokenHash: personalAccessTokens.tokenHash,
      expiresAt: personalAccessTokens.expiresAt,
    })
    .from(personalAccessTokens)
    .where(
      and(
        eq(personalAccessTokens.tokenPrefix, prefix),
        // not expired (or no expiry)
        or(isNull(personalAccessTokens.expiresAt), gt(personalAccessTokens.expiresAt, new Date())),
      ),
    );

  for (const c of candidates) {
    if (await Bun.password.verify(presented, c.tokenHash)) {
      // fire-and-forget last_used_at touch
      void db
        .update(personalAccessTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(personalAccessTokens.id, c.id));
      return c.userId;
    }
  }
  return null;
}

/**
 * Garbage-collect expired PATs. Call from a cron / scheduled task. Not used
 * automatically yet (Phase 3+).
 */
export async function gcExpiredPats(): Promise<number> {
  const result = await db
    .delete(personalAccessTokens)
    .where(
      and(
        // expired
        // (cant use `isNotNull` + `lte` cleanly without re-importing; using lte alone is enough
        //  because lte returns false for NULL, so NULL rows are kept)
        lte(personalAccessTokens.expiresAt, new Date()),
      ),
    )
    .returning({ id: personalAccessTokens.id });
  return result.length;
}
