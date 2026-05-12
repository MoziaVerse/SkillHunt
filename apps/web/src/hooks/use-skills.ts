import { type ListSkillsParams, apiClient } from '@/lib/api-client';
import type { SkillListItem } from '@/types/api';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useSkills(params: ListSkillsParams) {
  const [items, setItems] = useState<SkillListItem[]>([]);
  const [total, setTotal] = useState(0);
  // `loading` only true on first fetch (no items yet). Subsequent refetches
  // keep the previous items visible to avoid layout shift / scroll reset.
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Serialize deps so tag array changes trigger refetch.
  const depKey = `${params.type ?? 'all'}|${params.q ?? ''}|${(params.tag ?? []).join(',')}|${params.sort ?? 'recent'}`;

  // Debounce rapid query changes (typing) to avoid excessive API calls.
  const [debouncedKey, setDebouncedKey] = useState(depKey);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    // If only the query text changed, debounce 300ms; otherwise apply immediately.
    const parts = depKey.split('|');
    const prevParts = debouncedKey.split('|');
    const onlyQueryChanged =
      parts[0] === prevParts[0] && parts[2] === prevParts[2] && parts[3] === prevParts[3];
    const delay = onlyQueryChanged ? 300 : 0;
    timerRef.current = setTimeout(() => setDebouncedKey(depKey), delay);
    return () => clearTimeout(timerRef.current);
  }, [depKey, debouncedKey]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional key-based dep
  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    apiClient
      .listSkills({ ...params, offset: 0 })
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setTotal(r.total);
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
  }, [debouncedKey]);

  const loadMore = useCallback(async () => {
    const nextOffset = items.length;
    if (nextOffset >= total) return;
    try {
      const r = await apiClient.listSkills({ ...params, offset: nextOffset });
      setItems((prev) => [...prev, ...r.items]);
      setTotal(r.total);
    } catch {
      /* non-fatal */
    }
  }, [items.length, total, params]);

  const hasMore = items.length < total;

  return { items, total, loading, fetching, error, hasMore, loadMore };
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
