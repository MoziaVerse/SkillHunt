import { createHash } from 'node:crypto';
import { and, count, gte, inArray, lt } from 'drizzle-orm';
import { db, skillInstallEvents } from '../db';

export type InstallSource = 'well-known' | 'capability';

export type InstallStats = {
  total: number;
  recent: number;
  currentHour: number;
  sameHourYesterday: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function dedupeKeyFor(input: { ip?: string | null; userAgent?: string | null }) {
  const ip = input.ip?.split(',')[0]?.trim() || 'unknown-ip';
  const userAgent = input.userAgent?.trim() || 'unknown-agent';
  return createHash('sha256').update(`${ip}\n${userAgent}`).digest('hex');
}

export async function recordSkillInstall(
  skillId: string,
  source: InstallSource,
  input: { ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db
    .insert(skillInstallEvents)
    .values({
      skillId,
      source,
      dedupeKey: dedupeKeyFor(input),
    })
    .onConflictDoNothing();
}

async function countBySkill(
  skillIds: string[],
  since?: Date,
  before?: Date,
): Promise<Map<string, number>> {
  if (skillIds.length === 0) return new Map();
  const conditions = [inArray(skillInstallEvents.skillId, skillIds)];
  if (since) conditions.push(gte(skillInstallEvents.installedAt, since));
  if (before) conditions.push(lt(skillInstallEvents.installedAt, before));

  const rows = await db
    .select({ skillId: skillInstallEvents.skillId, installs: count() })
    .from(skillInstallEvents)
    .where(and(...conditions))
    .groupBy(skillInstallEvents.skillId);

  return new Map(rows.map((row) => [row.skillId, row.installs]));
}

export async function getInstallStatsBySkill(
  skillIds: string[],
  now = new Date(),
): Promise<Map<string, InstallStats>> {
  const currentHourStart = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
  const previousDayHourStart = new Date(currentHourStart.getTime() - DAY_MS);
  const previousDayHourEnd = new Date(previousDayHourStart.getTime() + HOUR_MS);
  const recentStart = new Date(now.getTime() - 7 * DAY_MS);

  const [total, recent, currentHour, sameHourYesterday] = await Promise.all([
    countBySkill(skillIds),
    countBySkill(skillIds, recentStart),
    countBySkill(skillIds, currentHourStart),
    countBySkill(skillIds, previousDayHourStart, previousDayHourEnd),
  ]);

  return new Map(
    skillIds.map((skillId) => [
      skillId,
      {
        total: total.get(skillId) ?? 0,
        recent: recent.get(skillId) ?? 0,
        currentHour: currentHour.get(skillId) ?? 0,
        sameHourYesterday: sameHourYesterday.get(skillId) ?? 0,
      },
    ]),
  );
}
