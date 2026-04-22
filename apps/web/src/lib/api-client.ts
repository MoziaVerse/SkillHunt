import type { ListSkillsResponse, ListTagsResponse, SkillDetail } from '@/types/api';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface ListSkillsParams {
  type?: 'all' | 'owned' | 'referenced';
  q?: string;
  tag?: string[];
  includeInternal?: boolean;
}

export const apiClient = {
  listSkills(params: ListSkillsParams = {}): Promise<ListSkillsResponse> {
    const usp = new URLSearchParams();
    if (params.type) usp.set('type', params.type);
    if (params.q) usp.set('q', params.q);
    if (params.tag) for (const t of params.tag) usp.append('tag', t);
    if (params.includeInternal) usp.set('includeInternal', 'true');
    const qs = usp.toString();
    return request<ListSkillsResponse>(`/skills${qs ? `?${qs}` : ''}`);
  },

  getSkill(slug: string): Promise<SkillDetail> {
    return request<SkillDetail>(`/skills/${encodeURIComponent(slug)}`);
  },

  listTags(): Promise<ListTagsResponse> {
    return request<ListTagsResponse>('/tags');
  },
};
