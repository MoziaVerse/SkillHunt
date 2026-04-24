import { type ListSkillsParams, apiClient } from '@/lib/api-client';
import type { SkillListItem } from '@/types/api';
import { useEffect, useState } from 'react';

export function useSkills(params: ListSkillsParams) {
  const [items, setItems] = useState<SkillListItem[]>([]);
  // `loading` only true on first fetch (no items yet). Subsequent refetches
  // keep the previous items visible to avoid layout shift / scroll reset.
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Serialize deps so tag array changes trigger refetch.
  const depKey = `${params.type ?? 'all'}|${params.q ?? ''}|${(params.tag ?? []).join(',')}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional key-based dep
  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    apiClient
      .listSkills(params)
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (cancelled) return;
        setFetching(false);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [depKey]);

  return { items, loading, fetching, error };
}

export function useTags() {
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    apiClient
      .listTags()
      .then((r) => {
        if (!cancelled) setTags(r.tags);
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return tags;
}
