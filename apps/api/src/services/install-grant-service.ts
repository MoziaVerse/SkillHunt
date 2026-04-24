import { randomBytes } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db, installGrantUses, installGrants, skillFiles, skills, user } from '../db';

// 32 random bytes → 43 chars base64url. URL becomes
// /.well-known/agent-skills/i/<token>/<owner>/<slug>/<file>
function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface MintGrantInput {
  skillId: string;
  grantedBy: string;
  expiresInHours: number;
  maxUses: number;
}

export interface Grant {
  token: string;
  expiresAt: Date;
  maxUses: number;
}

const HOUR_MS = 60 * 60 * 1000;
const MAX_TTL_HOURS = 24 * 7; // 7 days hard cap
const MAX_USES = 100; // sanity cap

export async function mintGrant(input: MintGrantInput): Promise<Grant> {
  const expiresInHours = Math.min(Math.max(input.expiresInHours, 1), MAX_TTL_HOURS);
  const maxUses = Math.min(Math.max(input.maxUses, 1), MAX_USES);
  const token = randomToken();
  const expiresAt = new Date(Date.now() + expiresInHours * HOUR_MS);

  await db.insert(installGrants).values({
    token,
    skillId: input.skillId,
    grantedBy: input.grantedBy,
    expiresAt,
    maxUses,
    usedCount: 0,
  });

  return { token, expiresAt, maxUses };
}

export interface GrantedSkillFile {
  skillId: string;
  ownerHandle: string;
  skillSlug: string;
  filePath: string;
  content: string;
  contentType?: string;
}

/**
 * Resolve a capability URL hit:
 *   - validates token (not expired, used_count < max_uses)
 *   - looks up the requested file under that skill
 *   - if found, atomically increments used_count (race-safe via WHERE) and
 *     records an audit entry
 *
 * Returns null if any step fails (treat as 404 to caller — single
 * 404-or-content code path keeps tokens un-enumerable).
 */
export async function consumeGrant(
  token: string,
  ownerHandle: string,
  skillSlug: string,
  filePath: string,
  audit: { ip?: string | null; userAgent?: string | null },
): Promise<{ content: string; contentType?: string } | null> {
  // Atomically reserve a use slot — only succeeds if not expired and
  // used_count < max_uses.
  const now = new Date();
  const reserved = await db
    .update(installGrants)
    .set({ usedCount: sql`${installGrants.usedCount} + 1` })
    .where(
      and(
        eq(installGrants.token, token),
        gt(installGrants.expiresAt, now),
        sql`${installGrants.usedCount} < ${installGrants.maxUses}`,
      ),
    )
    .returning({ skillId: installGrants.skillId });
  const grant = reserved[0];
  if (!grant) return null;

  // Load skill + verify owner/slug match (so a token for skill A can't be
  // used to fetch skill B's file via URL substitution)
  const skillRow = await db
    .select({ skillId: skills.id, ownerHandle: user.handle, skillSlug: skills.slug })
    .from(skills)
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(and(eq(skills.id, grant.skillId)))
    .limit(1);
  const sk = skillRow[0];
  if (!sk || sk.ownerHandle !== ownerHandle || sk.skillSlug !== skillSlug) {
    // Slot is consumed but content doesn't match — return null. (Edge case:
    // owner renamed handle between mint and consume. Acceptable to fail.)
    return null;
  }

  const fileRow = await db
    .select({ content: skillFiles.content })
    .from(skillFiles)
    .where(and(eq(skillFiles.skillId, sk.skillId), eq(skillFiles.path, filePath)))
    .limit(1);
  if (!fileRow[0]) return null;

  // Audit (fire-and-forget — don't block the response)
  void db.insert(installGrantUses).values({
    token,
    ip: audit.ip ?? null,
    userAgent: audit.userAgent ?? null,
  });

  return { content: fileRow[0].content };
}

export async function gcExpiredGrants(): Promise<number> {
  const result = await db
    .delete(installGrants)
    .where(sql`${installGrants.expiresAt} < ${new Date()}`)
    .returning({ token: installGrants.token });
  return result.length;
}
