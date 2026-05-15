import type { PublishableKind } from '@mozia/skillhub-shared';
import { and, desc, eq, max } from 'drizzle-orm';
import {
  type PublishableReleaseSnapshot,
  db,
  notifications,
  publishableBookmarks,
  publishableComments,
  publishableReleases,
  publishableSubscriptions,
  publishableUpvotes,
  publishables,
  user,
} from '../db';
import type { OwnerInfo } from './skill-service';

const ownerSelect = {
  id: user.id,
  name: user.name,
  handle: user.handle,
  image: user.image,
};

export interface PublishableCommentWithAuthor {
  id: string;
  publishableId: string;
  userId: string;
  parentId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: OwnerInfo;
}

export interface PublishableReleaseWithAuthor {
  id: string;
  publishableId: string;
  version: number;
  title: string;
  changelog: string;
  snapshot: PublishableReleaseSnapshot;
  createdByUserId: string;
  createdAt: Date;
  author: OwnerInfo;
}

export async function findPublishableById(publishableId: string) {
  const rows = await db
    .select({ publishable: publishables, owner: ownerSelect })
    .from(publishables)
    .innerJoin(user, eq(publishables.ownerUserId, user.id))
    .where(eq(publishables.id, publishableId))
    .limit(1);
  const row = rows[0];
  return row ? { ...row.publishable, owner: row.owner } : null;
}

export async function listPublishableComments(
  publishableId: string,
): Promise<PublishableCommentWithAuthor[]> {
  const rows = await db
    .select({ comment: publishableComments, author: ownerSelect })
    .from(publishableComments)
    .innerJoin(user, eq(publishableComments.userId, user.id))
    .where(eq(publishableComments.publishableId, publishableId))
    .orderBy(desc(publishableComments.createdAt));

  return rows.map((row) => ({ ...row.comment, author: row.author }));
}

export async function createPublishableComment(input: {
  publishableId: string;
  userId: string;
  content: string;
  parentId?: string | null;
}): Promise<PublishableCommentWithAuthor> {
  return db.transaction(async (tx) => {
    const [comment] = await tx
      .insert(publishableComments)
      .values({
        publishableId: input.publishableId,
        userId: input.userId,
        content: input.content,
        parentId: input.parentId ?? null,
      })
      .returning();
    if (!comment) throw new Error('createPublishableComment: insert returned no row');

    const [author] = await tx
      .select(ownerSelect)
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);
    if (!author) throw new Error('createPublishableComment: author disappeared mid-tx');

    const [publishable] = await tx
      .select({ publishable: publishables })
      .from(publishables)
      .where(eq(publishables.id, input.publishableId))
      .limit(1);
    if (publishable) {
      const notifyType = input.parentId ? 'reply' : 'comment';
      const targetUserId = input.parentId
        ? (
            await tx
              .select({ userId: publishableComments.userId })
              .from(publishableComments)
              .where(eq(publishableComments.id, input.parentId))
              .limit(1)
          )[0]?.userId
        : publishable.publishable.ownerUserId;

      if (targetUserId && targetUserId !== input.userId) {
        await tx.insert(notifications).values({
          userId: targetUserId,
          type: notifyType,
          actorId: input.userId,
          publishableId: input.publishableId,
          commentId: comment.id,
          read: 0,
        });
      }
    }

    return { ...comment, author };
  });
}

export async function addPublishableUpvote(
  publishableId: string,
  userId: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: publishableUpvotes.id })
    .from(publishableUpvotes)
    .where(
      and(
        eq(publishableUpvotes.publishableId, publishableId),
        eq(publishableUpvotes.userId, userId),
      ),
    )
    .limit(1);
  if (existing[0]) return false;

  await db.insert(publishableUpvotes).values({ publishableId, userId });

  const publishable = await findPublishableById(publishableId);
  if (publishable && publishable.ownerUserId !== userId) {
    await db.insert(notifications).values({
      userId: publishable.ownerUserId,
      type: 'upvote',
      actorId: userId,
      publishableId,
      read: 0,
    });
  }

  return true;
}

export async function removePublishableUpvote(
  publishableId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .delete(publishableUpvotes)
    .where(
      and(
        eq(publishableUpvotes.publishableId, publishableId),
        eq(publishableUpvotes.userId, userId),
      ),
    )
    .returning({ id: publishableUpvotes.id });
  return rows.length > 0;
}

export async function addPublishableBookmark(
  publishableId: string,
  userId: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: publishableBookmarks.id })
    .from(publishableBookmarks)
    .where(
      and(
        eq(publishableBookmarks.publishableId, publishableId),
        eq(publishableBookmarks.userId, userId),
      ),
    )
    .limit(1);
  if (existing[0]) return false;

  await db.insert(publishableBookmarks).values({ publishableId, userId });

  const publishable = await findPublishableById(publishableId);
  if (publishable && publishable.ownerUserId !== userId) {
    await db.insert(notifications).values({
      userId: publishable.ownerUserId,
      type: 'bookmark',
      actorId: userId,
      publishableId,
      read: 0,
    });
  }

  return true;
}

export async function removePublishableBookmark(
  publishableId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .delete(publishableBookmarks)
    .where(
      and(
        eq(publishableBookmarks.publishableId, publishableId),
        eq(publishableBookmarks.userId, userId),
      ),
    )
    .returning({ id: publishableBookmarks.id });
  return rows.length > 0;
}

export async function listPublishableReleases(
  publishableId: string,
): Promise<PublishableReleaseWithAuthor[]> {
  const rows = await db
    .select({ release: publishableReleases, author: ownerSelect })
    .from(publishableReleases)
    .innerJoin(user, eq(publishableReleases.createdByUserId, user.id))
    .where(eq(publishableReleases.publishableId, publishableId))
    .orderBy(desc(publishableReleases.version));

  return rows.map((row) => ({ ...row.release, author: row.author }));
}

export async function getPublishableReleaseById(releaseId: string) {
  const rows = await db
    .select()
    .from(publishableReleases)
    .where(eq(publishableReleases.id, releaseId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestPublishableRelease(publishableId: string) {
  const rows = await db
    .select()
    .from(publishableReleases)
    .where(eq(publishableReleases.publishableId, publishableId))
    .orderBy(desc(publishableReleases.version))
    .limit(1);
  return rows[0] ?? null;
}

export async function createPublishableRelease(input: {
  publishableId: string;
  createdByUserId: string;
  title: string;
  changelog: string;
  snapshot: PublishableReleaseSnapshot;
}) {
  return db.transaction(async (tx) => {
    const [versionRow] = await tx
      .select({ latest: max(publishableReleases.version) })
      .from(publishableReleases)
      .where(eq(publishableReleases.publishableId, input.publishableId));
    const version = Number(versionRow?.latest ?? 0) + 1;
    const [release] = await tx
      .insert(publishableReleases)
      .values({
        publishableId: input.publishableId,
        version,
        title: input.title,
        changelog: input.changelog,
        snapshot: input.snapshot,
        createdByUserId: input.createdByUserId,
      })
      .returning();
    if (!release) throw new Error('createPublishableRelease: insert returned no row');
    return release;
  });
}

export async function getPublishableSubscription(userId: string, publishableId: string) {
  const rows = await db
    .select()
    .from(publishableSubscriptions)
    .where(
      and(
        eq(publishableSubscriptions.userId, userId),
        eq(publishableSubscriptions.publishableId, publishableId),
      ),
    )
    .limit(1);
  const sub = rows[0];
  if (!sub) return null;
  return {
    id: sub.id,
    active: Boolean(sub.active),
    notifyOnRelease: Boolean(sub.notifyOnRelease),
    notifyOnSync: Boolean(sub.notifyOnSync),
    updatedAt: sub.updatedAt,
  };
}

export async function setPublishableSubscription(input: {
  userId: string;
  publishableId: string;
  active: boolean;
  notifyOnRelease: boolean;
  notifyOnSync: boolean;
}) {
  const now = new Date();
  await db
    .insert(publishableSubscriptions)
    .values({
      userId: input.userId,
      publishableId: input.publishableId,
      active: input.active ? 1 : 0,
      notifyOnRelease: input.notifyOnRelease ? 1 : 0,
      notifyOnSync: input.notifyOnSync ? 1 : 0,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [publishableSubscriptions.userId, publishableSubscriptions.publishableId],
      set: {
        active: input.active ? 1 : 0,
        notifyOnRelease: input.notifyOnRelease ? 1 : 0,
        notifyOnSync: input.notifyOnSync ? 1 : 0,
        updatedAt: now,
      },
    });
  return getPublishableSubscription(input.userId, input.publishableId);
}

export function publishableReleaseKind(snapshot: PublishableReleaseSnapshot): PublishableKind {
  return snapshot.kind;
}
