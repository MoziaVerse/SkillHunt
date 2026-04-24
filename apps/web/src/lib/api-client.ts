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
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

export interface SessionResponse {
  user: SessionUser | null;
}

export const apiClient = {
  listSkills(params: ListSkillsParams = {}): Promise<ListSkillsResponse> {
    const usp = new URLSearchParams();
    if (params.type) usp.set('type', params.type);
    if (params.q) usp.set('q', params.q);
    if (params.tag) for (const t of params.tag) usp.append('tag', t);
    const qs = usp.toString();
    return request<ListSkillsResponse>(`/skills${qs ? `?${qs}` : ''}`, { credentials: 'include' });
  },

  // Canonical detail by (owner, slug). For legacy single-slug callers,
  // use `getSkillBySlug`, which goes through the 302 redirect.
  getSkill(owner: string, slug: string): Promise<SkillDetail> {
    return request<SkillDetail>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`,
      { credentials: 'include' },
    );
  },

  // Legacy: hits /api/skills/:slug → 302 → followed by fetch.
  getSkillBySlug(slug: string): Promise<SkillDetail> {
    return request<SkillDetail>(`/skills/${encodeURIComponent(slug)}`, {
      credentials: 'include',
      redirect: 'follow',
    });
  },

  listTags(): Promise<ListTagsResponse> {
    return request<ListTagsResponse>('/tags', { credentials: 'include' });
  },

  // better-auth returns { session, user } when authenticated, or null otherwise.
  async getSession(): Promise<SessionUser | null> {
    const res = await fetch(`${BASE}/auth/get-session`, { credentials: 'include' });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      const body = JSON.parse(text) as { user?: SessionUser } | null;
      return body?.user ?? null;
    } catch {
      return null;
    }
  },

  async getAuthStatus(): Promise<{
    ssoConfigured: boolean;
    issuer: string | null;
    providerId: string;
  }> {
    const res = await fetch(`${BASE}/auth-status`);
    if (!res.ok) return { ssoConfigured: false, issuer: null, providerId: 'mozia-sso' };
    return (await res.json()) as {
      ssoConfigured: boolean;
      issuer: string | null;
      providerId: string;
    };
  },
};
