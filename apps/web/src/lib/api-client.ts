import type { ListSkillsResponse, ListTagsResponse, OwnerInfo, SkillDetail } from '@/types/api';

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    message?: string,
  ) {
    super(message ?? `${status}: ${body || 'request failed'}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const json = (body: unknown, method: string): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(body),
});

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

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isVirtual: boolean;
  canPublishAs: string[];
}

export interface OwnerSkillsResponse {
  owner: OwnerInfo;
  items: import('@/types/api').SkillListItem[];
  total: number;
}

export interface CreateSkillInput {
  owner: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  visibility: 'public' | 'private';
  skillMdContent: string;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  tags?: string[];
  visibility?: 'public' | 'private';
  skillMdContent?: string;
}

export const apiClient = {
  // ─── Read ────────────────────────────────────────────────────────────

  listSkills(params: ListSkillsParams = {}): Promise<ListSkillsResponse> {
    const usp = new URLSearchParams();
    if (params.type) usp.set('type', params.type);
    if (params.q) usp.set('q', params.q);
    if (params.tag) for (const t of params.tag) usp.append('tag', t);
    const qs = usp.toString();
    return request<ListSkillsResponse>(`/skills${qs ? `?${qs}` : ''}`, { credentials: 'include' });
  },

  getSkill(owner: string, slug: string): Promise<SkillDetail> {
    return request<SkillDetail>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`,
      { credentials: 'include' },
    );
  },

  getSkillBySlug(slug: string): Promise<SkillDetail> {
    return request<SkillDetail>(`/skills/${encodeURIComponent(slug)}`, {
      credentials: 'include',
      redirect: 'follow',
    });
  },

  listTags(): Promise<ListTagsResponse> {
    return request<ListTagsResponse>('/tags', { credentials: 'include' });
  },

  // ─── Mutations ───────────────────────────────────────────────────────

  createSkill(input: CreateSkillInput): Promise<SkillDetail> {
    return request<SkillDetail>('/skills', json(input, 'POST'));
  },

  updateSkill(owner: string, slug: string, input: UpdateSkillInput): Promise<SkillDetail> {
    return request<SkillDetail>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`,
      json(input, 'PUT'),
    );
  },

  deleteSkill(owner: string, slug: string): Promise<void> {
    return request<void>(`/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  },

  upsertSkillFile(owner: string, slug: string, path: string, content: string): Promise<void> {
    return request<void>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/files/${path}`,
      json({ content }, 'POST'),
    );
  },

  deleteSkillFile(owner: string, slug: string, path: string): Promise<void> {
    return request<void>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/files/${path}`,
      { method: 'DELETE', credentials: 'include' },
    );
  },

  // ─── Users ───────────────────────────────────────────────────────────

  getMe(): Promise<MeResponse> {
    return request<MeResponse>('/users/me', { credentials: 'include' });
  },

  updateProfile(input: { name: string }): Promise<MeResponse> {
    return request<MeResponse>('/users/me/profile', json(input, 'PATCH'));
  },

  getMySkills(): Promise<ListSkillsResponse> {
    return request<ListSkillsResponse>('/users/me/skills', { credentials: 'include' });
  },

  getOwnerSkills(ownerName: string): Promise<OwnerSkillsResponse> {
    return request<OwnerSkillsResponse>(`/users/${encodeURIComponent(ownerName)}/skills`, {
      credentials: 'include',
    });
  },

  // ─── Auth status ─────────────────────────────────────────────────────

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
