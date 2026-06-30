import { type SQL, and, eq, or, sql } from 'drizzle-orm';
import { contestSubmissions, db, publishableExternalTags, publishables } from '../db';

export type PublishableExternalTagSourceType = 'event' | 'manual' | 'system';

export function publishableExternalTagsJson(): SQL<string> {
  return sql<string>`coalesce((
    select json_group_array(distinct ${publishableExternalTags.tag})
    from ${publishableExternalTags}
    where ${publishableExternalTags.publishableId} = ${publishables.id}
  ), '[]')`;
}

export function parseTagJson(value: unknown): string[] {
  let parsed: unknown;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
}

export function publishableTagFilterCondition(tags: string[]): SQL | undefined {
  const normalizedTags = tags.map((tag) => tag.trim()).filter(Boolean);
  if (normalizedTags.length === 0) return undefined;

  const tagList = sql.join(
    normalizedTags.map((tag) => sql`${tag}`),
    sql`, `,
  );

  return or(
    sql`exists (
      select 1 from json_each(${publishables.tags})
      where json_each.value in (${tagList})
    )`,
    sql`exists (
      select 1 from ${publishableExternalTags}
      where ${publishableExternalTags.publishableId} = ${publishables.id}
        and ${publishableExternalTags.tag} in (${tagList})
    )`,
  );
}

export async function syncEventSubmissionExternalTag(input: {
  eventSlug: string;
  tag: string;
  sourceId?: string;
}) {
  const tag = input.tag.trim();
  if (!tag) throw new Error('syncEventSubmissionExternalTag: tag is required');

  const sourceId = input.sourceId?.trim() || input.eventSlug;
  const rows = await db
    .select({ publishableId: contestSubmissions.skillId })
    .from(contestSubmissions)
    .innerJoin(publishables, eq(contestSubmissions.skillId, publishables.id))
    .where(
      and(
        eq(contestSubmissions.eventSlug, input.eventSlug),
        eq(contestSubmissions.status, 'submitted'),
        eq(publishables.kind, 'skill'),
      ),
    );

  await db.transaction(async (tx) => {
    await tx
      .delete(publishableExternalTags)
      .where(
        and(
          eq(publishableExternalTags.tag, tag),
          eq(publishableExternalTags.sourceType, 'event'),
          eq(publishableExternalTags.sourceId, sourceId),
        ),
      );

    if (rows.length === 0) return;

    await tx.insert(publishableExternalTags).values(
      rows.map((row) => ({
        publishableId: row.publishableId,
        tag,
        sourceType: 'event' as const,
        sourceId,
      })),
    );
  });

  return {
    eventSlug: input.eventSlug,
    tag,
    sourceType: 'event' as const,
    sourceId,
    count: rows.length,
  };
}
