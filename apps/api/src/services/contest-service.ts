import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { contestSubmissions, contestUsers, contestVotes, db } from '../db';
import { normalizeSsoPhone } from '../lib/sso-user';
import { type SkillWithOwner, findSkillById, findUserById } from './skill-service';

export const HDU_SKILLS_EVENT_SLUG = 'hdu-skills-2026';

export const contestTracks = ['学习科研', '校园生活', '创意应用', '专业实训'] as const;

export type ContestTrack = (typeof contestTracks)[number];
export type ContestVotingStatus = 'before' | 'open' | 'ended';

const hduVotingStartsAt = new Date('2026-06-01T00:00:00+08:00');
const hduVotingEndsAt = new Date('2026-06-11T00:00:00+08:00');

export const hduContestConfig = {
  slug: HDU_SKILLS_EVENT_SLUG,
  votingStartsAt: hduVotingStartsAt,
  votingEndsAt: hduVotingEndsAt,
  maxVotes: 5,
  tracks: contestTracks,
};

export class ContestVoteError extends Error {
  constructor(
    public status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export interface ContestSubmissionWithSkill {
  submission: typeof contestSubmissions.$inferSelect;
  skill: SkillWithOwner;
  voteCount: number;
  viewerHasVoted: boolean;
}

export type ContestEligibility =
  | { ok: true; phone: string }
  | { ok: false; status: 403; message: string };

export interface ContestVoteSummary {
  status: ContestVotingStatus;
  maxVotes: number;
  startsAt: string;
  endsAt: string;
  used: number;
  remaining: number;
}

function contestNow(): Date {
  const override = process.env.SKILLHUNT_CONTEST_NOW;
  if (!override) return new Date();
  const parsed = new Date(override);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function getContestVotingStatus(now = contestNow()): ContestVotingStatus {
  if (now < hduContestConfig.votingStartsAt) return 'before';
  if (now >= hduContestConfig.votingEndsAt) return 'ended';
  return 'open';
}

function ensureVotingOpen(now = contestNow()) {
  const status = getContestVotingStatus(now);
  if (status === 'before') {
    throw new ContestVoteError(400, '投票将于 2026 年 6 月 1 日开启');
  }
  if (status === 'ended') {
    throw new ContestVoteError(400, '投票已结束，不能再修改投票');
  }
}

async function countActiveVotesForSubmission(
  eventSlug: string,
  submissionId: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(contestVotes)
    .where(
      and(
        eq(contestVotes.eventSlug, eventSlug),
        eq(contestVotes.submissionId, submissionId),
        isNull(contestVotes.canceledAt),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

async function viewerHasVotedForSubmission(input: {
  eventSlug: string;
  submissionId: string;
  userId: string | null;
}): Promise<boolean> {
  if (!input.userId) return false;
  const rows = await db
    .select({ id: contestVotes.id })
    .from(contestVotes)
    .where(
      and(
        eq(contestVotes.eventSlug, input.eventSlug),
        eq(contestVotes.submissionId, input.submissionId),
        eq(contestVotes.userId, input.userId),
        isNull(contestVotes.canceledAt),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
}

async function buildContestSubmissionItems(
  rows: Array<typeof contestSubmissions.$inferSelect>,
  opts: {
    viewerUserId: string | null;
    publicOnly: boolean;
  },
): Promise<ContestSubmissionWithSkill[]> {
  const items = await Promise.all(
    rows.map(async (submission) => {
      const skill = await findSkillById(submission.skillId, opts.viewerUserId);
      if (!skill) return null;
      if (opts.publicOnly && (skill.type !== 'owned' || skill.visibility !== 'public')) return null;

      const [voteCount, viewerHasVoted] = await Promise.all([
        countActiveVotesForSubmission(submission.eventSlug, submission.id),
        viewerHasVotedForSubmission({
          eventSlug: submission.eventSlug,
          submissionId: submission.id,
          userId: opts.viewerUserId,
        }),
      ]);

      return { submission, skill, voteCount, viewerHasVoted };
    }),
  );

  return items.filter((item): item is ContestSubmissionWithSkill => Boolean(item));
}

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
        eq(contestSubmissions.status, 'submitted'),
      ),
    )
    .orderBy(desc(contestSubmissions.createdAt));

  return buildContestSubmissionItems(
    rows.map(({ submission }) => submission),
    { viewerUserId: input.userId, publicOnly: false },
  );
}

export async function listContestSubmissionsForEvent(input: {
  eventSlug: string;
  viewerUserId: string | null;
}): Promise<ContestSubmissionWithSkill[]> {
  const rows = await db
    .select({ submission: contestSubmissions })
    .from(contestSubmissions)
    .where(
      and(
        eq(contestSubmissions.eventSlug, input.eventSlug),
        eq(contestSubmissions.status, 'submitted'),
      ),
    )
    .orderBy(desc(contestSubmissions.createdAt));

  return buildContestSubmissionItems(
    rows.map(({ submission }) => submission),
    { viewerUserId: input.viewerUserId, publicOnly: true },
  );
}

export async function getContestVoteSummary(input: {
  eventSlug: string;
  userId: string | null;
  now?: Date;
}): Promise<ContestVoteSummary> {
  const status = getContestVotingStatus(input.now ?? contestNow());
  const used = input.userId
    ? Number(
        (
          await db
            .select({ count: sql<number>`count(*)` })
            .from(contestVotes)
            .where(
              and(
                eq(contestVotes.eventSlug, input.eventSlug),
                eq(contestVotes.userId, input.userId),
                isNull(contestVotes.canceledAt),
              ),
            )
        )[0]?.count ?? 0,
      )
    : 0;

  return {
    status,
    maxVotes: hduContestConfig.maxVotes,
    startsAt: hduContestConfig.votingStartsAt.toISOString(),
    endsAt: hduContestConfig.votingEndsAt.toISOString(),
    used,
    remaining: Math.max(0, hduContestConfig.maxVotes - used),
  };
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
  return db.transaction(async (tx) => {
    const existing = await tx
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
      if (current.status !== 'submitted' || current.track !== input.track) {
        await tx
          .update(contestVotes)
          .set({ canceledAt: new Date() })
          .where(
            and(
              eq(contestVotes.eventSlug, input.eventSlug),
              eq(contestVotes.submissionId, current.id),
              isNull(contestVotes.canceledAt),
            ),
          );
      }

      const [updated] = await tx
        .update(contestSubmissions)
        .set({
          track: input.track,
          status: 'submitted',
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

    const [created] = await tx
      .insert(contestSubmissions)
      .values({
        eventSlug: input.eventSlug,
        skillId: input.skillId,
        submitterUserId: input.submitterUserId,
        track: input.track,
        status: 'submitted',
        videoObjectKey: input.videoObjectKey ?? null,
        videoUrl: input.videoUrl ?? null,
        videoDurationSeconds: input.videoDurationSeconds ?? null,
      })
      .returning();
    if (!created) throw new Error('upsertContestSubmission: insert returned no row');
    return created;
  });
}

export async function deleteContestSubmission(input: {
  eventSlug: string;
  skillId: string;
  submitterUserId: string;
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(contestSubmissions)
      .where(
        and(
          eq(contestSubmissions.eventSlug, input.eventSlug),
          eq(contestSubmissions.skillId, input.skillId),
          eq(contestSubmissions.submitterUserId, input.submitterUserId),
          eq(contestSubmissions.status, 'submitted'),
        ),
      )
      .limit(1);

    const current = rows[0];
    if (!current) return false;

    await tx
      .update(contestVotes)
      .set({ canceledAt: new Date() })
      .where(
        and(
          eq(contestVotes.eventSlug, input.eventSlug),
          eq(contestVotes.submissionId, current.id),
          isNull(contestVotes.canceledAt),
        ),
      );

    await tx
      .update(contestSubmissions)
      .set({ status: 'withdrawn', updatedAt: new Date() })
      .where(eq(contestSubmissions.id, current.id));

    return true;
  });
}

export async function addContestVote(input: {
  eventSlug: string;
  submissionId: string;
  userId: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? contestNow();
  ensureVotingOpen(now);

  const submissionRows = await db
    .select()
    .from(contestSubmissions)
    .where(
      and(
        eq(contestSubmissions.eventSlug, input.eventSlug),
        eq(contestSubmissions.id, input.submissionId),
        eq(contestSubmissions.status, 'submitted'),
      ),
    )
    .limit(1);
  const submission = submissionRows[0];
  if (!submission) throw new ContestVoteError(404, '该作品当前不可投票');

  const skill = await findSkillById(submission.skillId, input.userId);
  if (!skill || skill.type !== 'owned' || skill.visibility !== 'public') {
    throw new ContestVoteError(404, '该作品当前不可投票');
  }

  await db.transaction(async (tx) => {
    const freshRows = await tx
      .select()
      .from(contestSubmissions)
      .where(
        and(
          eq(contestSubmissions.eventSlug, input.eventSlug),
          eq(contestSubmissions.id, input.submissionId),
          eq(contestSubmissions.status, 'submitted'),
        ),
      )
      .limit(1);
    const freshSubmission = freshRows[0];
    if (!freshSubmission) throw new ContestVoteError(404, '该作品当前不可投票');

    const existingRows = await tx
      .select()
      .from(contestVotes)
      .where(
        and(
          eq(contestVotes.eventSlug, input.eventSlug),
          eq(contestVotes.submissionId, input.submissionId),
          eq(contestVotes.userId, input.userId),
        ),
      )
      .limit(1);
    const existing = existingRows[0];
    if (existing && !existing.canceledAt) return;

    const usedRows = await tx
      .select({ count: sql<number>`count(*)` })
      .from(contestVotes)
      .where(
        and(
          eq(contestVotes.eventSlug, input.eventSlug),
          eq(contestVotes.userId, input.userId),
          isNull(contestVotes.canceledAt),
        ),
      );
    const used = Number(usedRows[0]?.count ?? 0);
    if (used >= hduContestConfig.maxVotes) {
      throw new ContestVoteError(409, `每位用户总共最多可投 ${hduContestConfig.maxVotes} 票`);
    }

    if (existing) {
      await tx
        .update(contestVotes)
        .set({
          track: freshSubmission.track,
          createdAt: now,
          canceledAt: null,
        })
        .where(eq(contestVotes.id, existing.id));
      return;
    }

    await tx.insert(contestVotes).values({
      eventSlug: input.eventSlug,
      submissionId: input.submissionId,
      track: freshSubmission.track,
      userId: input.userId,
      createdAt: now,
    });
  });
}

export async function removeContestVote(input: {
  eventSlug: string;
  submissionId: string;
  userId: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? contestNow();
  ensureVotingOpen(now);

  const submissionRows = await db
    .select({ id: contestSubmissions.id })
    .from(contestSubmissions)
    .where(
      and(
        eq(contestSubmissions.eventSlug, input.eventSlug),
        eq(contestSubmissions.id, input.submissionId),
        eq(contestSubmissions.status, 'submitted'),
      ),
    )
    .limit(1);
  if (!submissionRows[0]) throw new ContestVoteError(404, '该作品当前不可投票');

  await db
    .update(contestVotes)
    .set({ canceledAt: now })
    .where(
      and(
        eq(contestVotes.eventSlug, input.eventSlug),
        eq(contestVotes.submissionId, input.submissionId),
        eq(contestVotes.userId, input.userId),
        isNull(contestVotes.canceledAt),
      ),
    );
}
