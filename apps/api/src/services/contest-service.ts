import { and, desc, eq } from 'drizzle-orm';
import { contestSubmissions, contestUsers, db } from '../db';
import { normalizeSsoPhone } from '../lib/sso-user';
import { type SkillWithOwner, findSkillById, findUserById } from './skill-service';

export const HDU_SKILLS_EVENT_SLUG = 'hdu-skills-2026';

export type ContestTrack = '学习科研' | '校园生活' | '创意应用' | '专业实训';

export interface ContestSubmissionWithSkill {
  submission: typeof contestSubmissions.$inferSelect;
  skill: SkillWithOwner;
}

export type ContestEligibility =
  | { ok: true; phone: string }
  | { ok: false; status: 403; message: string };

export async function ensureContestEligibility(input: {
  eventSlug: string;
  userId: string;
}): Promise<ContestEligibility> {
  const user = await findUserById(input.userId);
  const phone = normalizeSsoPhone(user?.phone ?? undefined);
  if (!phone) {
    return {
      ok: false,
      status: 403,
      message: '当前账号未同步手机号，请重新登录后再提交活动作品',
    };
  }

  const rows = await db
    .select()
    .from(contestUsers)
    .where(and(eq(contestUsers.eventSlug, input.eventSlug), eq(contestUsers.phone, phone)))
    .limit(1);

  const contestUser = rows[0];
  if (!contestUser) {
    return {
      ok: false,
      status: 403,
      message: '当前手机号未完成活动报名或未通过资格校验',
    };
  }
  if (contestUser.status !== 'eligible') {
    return {
      ok: false,
      status: 403,
      message: '当前报名资格已取消，无法提交活动作品',
    };
  }

  return { ok: true, phone };
}

export async function listContestSubmissionsByUser(input: {
  eventSlug: string;
  userId: string;
}): Promise<ContestSubmissionWithSkill[]> {
  const rows = await db
    .select({ submission: contestSubmissions })
    .from(contestSubmissions)
    .where(
      and(
        eq(contestSubmissions.eventSlug, input.eventSlug),
        eq(contestSubmissions.submitterUserId, input.userId),
      ),
    )
    .orderBy(desc(contestSubmissions.createdAt));

  const withSkills = await Promise.all(
    rows.map(async ({ submission }) => {
      const skill = await findSkillById(submission.skillId, input.userId);
      return skill ? { submission, skill } : null;
    }),
  );

  return withSkills.filter((item): item is ContestSubmissionWithSkill => Boolean(item));
}

export async function upsertContestSubmission(input: {
  eventSlug: string;
  skillId: string;
  submitterUserId: string;
  track: ContestTrack;
  videoObjectKey?: string | null;
  videoUrl?: string | null;
  videoDurationSeconds?: number | null;
}): Promise<typeof contestSubmissions.$inferSelect> {
  const existing = await db
    .select()
    .from(contestSubmissions)
    .where(
      and(
        eq(contestSubmissions.eventSlug, input.eventSlug),
        eq(contestSubmissions.skillId, input.skillId),
      ),
    )
    .limit(1);

  const current = existing[0];
  if (current) {
    const [updated] = await db
      .update(contestSubmissions)
      .set({
        track: input.track,
        submitterUserId: input.submitterUserId,
        videoObjectKey: input.videoObjectKey ?? null,
        videoUrl: input.videoUrl ?? null,
        videoDurationSeconds: input.videoDurationSeconds ?? null,
        updatedAt: new Date(),
      })
      .where(eq(contestSubmissions.id, current.id))
      .returning();
    if (!updated) throw new Error('upsertContestSubmission: update returned no row');
    return updated;
  }

  const [created] = await db
    .insert(contestSubmissions)
    .values({
      eventSlug: input.eventSlug,
      skillId: input.skillId,
      submitterUserId: input.submitterUserId,
      track: input.track,
      videoObjectKey: input.videoObjectKey ?? null,
      videoUrl: input.videoUrl ?? null,
      videoDurationSeconds: input.videoDurationSeconds ?? null,
    })
    .returning();
  if (!created) throw new Error('upsertContestSubmission: insert returned no row');
  return created;
}
