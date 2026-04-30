import { randomBytes } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db, installGrantUses, installGrants, skillFiles, skills, user } from '../db';
import { recordSkillInstall } from './install-stats-service';

// 32 random bytes -> 43 chars base64url. URL becomes:
// /i/<token>/.well-known/agent-skills/index.json
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

export interface GrantedSkill {
  skillId: string;
  ownerHandle: string;
  skillSlug: string;
  description: string;
}

export async function peekGrantSkill(token: string): Promise<GrantedSkill | null> {
  const rows = await db
    .select({
      skillId: skills.id,
      ownerHandle: user.handle,
      skillSlug: skills.slug,
      description: skills.description,
    })
    .from(installGrants)
    .innerJoin(skills, eq(installGrants.skillId, skills.id))
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(
      and(
        eq(installGrants.token, token),
        gt(installGrants.expiresAt, new Date()),
        sql`${installGrants.usedCount} < ${installGrants.maxUses}`,
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

function usableGrantCondition(token: string, filePath: string) {
  const isSkillMd = filePath.toLowerCase() === 'skill.md';
  if (isSkillMd) {
    return and(
      eq(installGrants.token, token),
      gt(installGrants.expiresAt, new Date()),
      sql`${installGrants.usedCount} < ${installGrants.maxUses}`,
    );
  }

  return and(
    eq(installGrants.token, token),
    gt(installGrants.expiresAt, new Date()),
    sql`${installGrants.usedCount} > 0`,
    sql`${installGrants.usedCount} <= ${installGrants.maxUses}`,
  );
}

export async function peekGrantSkillForFile(
  token: string,
  filePath: string,
): Promise<GrantedSkill | null> {
  const rows = await db
    .select({
      skillId: skills.id,
      ownerHandle: user.handle,
      skillSlug: skills.slug,
      description: skills.description,
    })
    .from(installGrants)
    .innerJoin(skills, eq(installGrants.skillId, skills.id))
    .innerJoin(user, eq(skills.ownerUserId, user.id))
    .where(usableGrantCondition(token, filePath))
    .limit(1);

  return rows[0] ?? null;
}

async function loadGrantForFile(
  token: string,
  filePath: string,
): Promise<{ skillId: string } | null> {
  const isSkillMd = filePath.toLowerCase() === 'skill.md';
  if (isSkillMd) {
    // Reserve an install attempt only for SKILL.md. The CLI fetches SKILL.md
    // first, then downloads supporting files from the same token URL.
    const reserved = await db
      .update(installGrants)
      .set({ usedCount: sql`${installGrants.usedCount} + 1` })
      .where(usableGrantCondition(token, filePath))
      .returning({ skillId: installGrants.skillId });

    return reserved[0] ?? null;
  }

  const rows = await db
    .select({ skillId: installGrants.skillId })
    .from(installGrants)
    .where(usableGrantCondition(token, filePath))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Resolve a capability URL hit:
 *   - validates token
 *   - looks up the requested file under that skill
 *   - counts SKILL.md as the install attempt, while allowing the CLI to fetch
 *     supporting files afterward
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
  const grant = await loadGrantForFile(token, filePath);
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

  if (filePath.toLowerCase() === 'skill.md') {
    await recordSkillInstall(sk.skillId, 'capability', audit);
  }

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
