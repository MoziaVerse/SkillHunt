import type {
  BaseSkill,
  ListPackagesResponse,
  ListSkillsResponse,
  ListTagsResponse,
  Notification,
  OwnerInfo,
  SkillComment,
  SkillDetail,
  SkillPackageDetail,
  SkillRelease,
  SkillSubscription,
  UpstreamStatus,
} from '@/types/api';

export type { Notification } from '@/types/api';

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

// Encode each path segment but preserve `/` separators (Hono's `:path{.+}`
// captures multi-segment, but each segment needs to be percent-encoded for
// non-ASCII chars like Chinese filenames).
const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

export interface ListSkillsParams {
  type?: 'all' | 'owned' | 'referenced';
  q?: string;
  tag?: string[];
  sort?: 'recent' | 'hottest' | 'az';
  limit?: number;
  offset?: number;
}

export interface ListPackagesParams {
  q?: string;
  tag?: string[];
  sort?: 'recent' | 'az';
  limit?: number;
  offset?: number;
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
  /** Display name (anything goes) */
  name: string;
  /** URL handle (lowercase + dashes) */
  handle: string;
  email: string;
  image: string | null;
  isVirtual: boolean;
  canPublishAs: string[];
}

export interface MintTokenResult {
  token: string;
  expiresAt: string;
  maxUses: number;
  installCommand: string;
}

export interface OwnerSkillsResponse {
  owner: OwnerInfo;
  items: import('@/types/api').SkillListItem[];
  total: number;
}

export interface SkillCommentsResponse {
  items: SkillComment[];
  total: number;
}

export interface CreateVideoUploadInput {
  fileName: string;
  contentType: string;
  size: number;
}

export interface VideoUploadTicket {
  uploadUrl: string;
  objectKey: string;
  videoUrl: string;
  maxSizeBytes: number;
  expiresInSeconds: number;
}

export interface UploadedVideoMetadata {
  objectKey: string;
  videoUrl: string;
  playbackUrl: string;
  size: number;
  contentType: string | null;
}

export interface CreateSkillInput {
  owner: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  visibility: 'public' | 'private';
  skillMdContent: string;
  icon?: string | null;
  coverImage?: string | null;
  demoVideoUrl?: string | null;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  tags?: string[];
  visibility?: 'public' | 'private';
  skillMdContent?: string;
  icon?: string | null;
  coverImage?: string | null;
  demoVideoUrl?: string | null;
}

export interface CreateSkillPackageInput {
  owner: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  visibility: 'public' | 'private';
  icon?: string | null;
  coverImage?: string | null;
  skillIds: string[];
}

export const apiClient = {
  // ─── Read ────────────────────────────────────────────────────────────

  listSkills(params: ListSkillsParams = {}): Promise<ListSkillsResponse> {
    const usp = new URLSearchParams();
    if (params.type) usp.set('type', params.type);
    if (params.q) usp.set('q', params.q);
    if (params.tag) for (const t of params.tag) usp.append('tag', t);
    if (params.sort) usp.set('sort', params.sort);
    if (params.limit) usp.set('limit', String(params.limit));
    if (params.offset) usp.set('offset', String(params.offset));
    const qs = usp.toString();
    return request<ListSkillsResponse>(`/skills${qs ? `?${qs}` : ''}`, { credentials: 'include' });
  },

  getSkill(owner: string, slug: string): Promise<SkillDetail> {
    return request<SkillDetail>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`,
      { credentials: 'include' },
    );
  },

  async getSkillFile(owner: string, slug: string, path: string): Promise<string> {
    const res = await fetch(
      `${BASE}/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/files/${encodePath(path)}`,
      { credentials: 'include' },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError(res.status, text);
    }
    return res.text();
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

  listPackages(params: ListPackagesParams = {}): Promise<ListPackagesResponse> {
    const usp = new URLSearchParams();
    if (params.q) usp.set('q', params.q);
    if (params.tag) for (const t of params.tag) usp.append('tag', t);
    if (params.sort) usp.set('sort', params.sort);
    if (params.limit) usp.set('limit', String(params.limit));
    if (params.offset) usp.set('offset', String(params.offset));
    const qs = usp.toString();
    return request<ListPackagesResponse>(`/packages${qs ? `?${qs}` : ''}`, {
      credentials: 'include',
    });
  },

  getPackage(owner: string, slug: string): Promise<SkillPackageDetail> {
    return request<SkillPackageDetail>(
      `/packages/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`,
      { credentials: 'include' },
    );
  },

  createPackage(input: CreateSkillPackageInput): Promise<SkillPackageDetail> {
    return request<SkillPackageDetail>('/packages', json(input, 'POST'));
  },

  listSkillComments(owner: string, slug: string): Promise<SkillCommentsResponse> {
    return request<SkillCommentsResponse>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/comments`,
      { credentials: 'include' },
    );
  },

  getSkillDemoVideoUrl(owner: string, slug: string): string {
    return `${BASE}/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/demo-video`;
  },

  // ─── Mutations ───────────────────────────────────────────────────────

  createVideoUpload(input: CreateVideoUploadInput): Promise<VideoUploadTicket> {
    return request<VideoUploadTicket>('/uploads/videos', json(input, 'POST'));
  },

  completeVideoUpload(objectKey: string): Promise<UploadedVideoMetadata> {
    return request<UploadedVideoMetadata>('/uploads/videos/complete', json({ objectKey }, 'POST'));
  },

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
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/files/${encodePath(path)}`,
      json({ content }, 'POST'),
    );
  },

  deleteSkillFile(owner: string, slug: string, path: string): Promise<void> {
    return request<void>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/files/${encodePath(path)}`,
      { method: 'DELETE', credentials: 'include' },
    );
  },

  upvoteSkill(owner: string, slug: string): Promise<BaseSkill> {
    return request<BaseSkill>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/upvote`,
      { method: 'POST', credentials: 'include' },
    );
  },

  removeSkillUpvote(owner: string, slug: string): Promise<BaseSkill> {
    return request<BaseSkill>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/upvote`,
      { method: 'DELETE', credentials: 'include' },
    );
  },

  bookmarkSkill(owner: string, slug: string): Promise<BaseSkill> {
    return request<BaseSkill>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/bookmark`,
      { method: 'POST', credentials: 'include' },
    );
  },

  removeSkillBookmark(owner: string, slug: string): Promise<BaseSkill> {
    return request<BaseSkill>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/bookmark`,
      { method: 'DELETE', credentials: 'include' },
    );
  },

  getMyBookmarks(): Promise<ListSkillsResponse> {
    return request<ListSkillsResponse>('/me/bookmarks', { credentials: 'include' });
  },

  createSkillComment(
    owner: string,
    slug: string,
    input: { content: string; parentId?: string | null },
  ): Promise<SkillComment> {
    return request<SkillComment>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/comments`,
      json(input, 'POST'),
    );
  },

  forkSkill(owner: string, slug: string, input: { slug?: string } = {}): Promise<SkillDetail> {
    return request<SkillDetail>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/fork`,
      json(input, 'POST'),
    );
  },

  listSkillReleases(
    owner: string,
    slug: string,
  ): Promise<{ items: SkillRelease[]; total: number }> {
    return request<{ items: SkillRelease[]; total: number }>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/releases`,
      { credentials: 'include' },
    );
  },

  createSkillRelease(
    owner: string,
    slug: string,
    input: { title: string; changelog?: string },
  ): Promise<SkillRelease> {
    return request<SkillRelease>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/releases`,
      json(input, 'POST'),
    );
  },

  getUpstreamStatus(owner: string, slug: string): Promise<UpstreamStatus> {
    return request<UpstreamStatus>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/upstream-status`,
      { credentials: 'include' },
    );
  },

  syncUpstream(
    owner: string,
    slug: string,
  ): Promise<
    | { status: 'success'; latestUpstreamRelease: SkillRelease; forkRelease: SkillRelease }
    | { status: 'conflict'; conflictFiles: string[]; latestUpstreamRelease: SkillRelease }
  > {
    return request(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/sync-upstream`,
      json({ strategy: 'auto' }, 'POST'),
    );
  },

  getSkillSubscription(owner: string, slug: string): Promise<SkillSubscription> {
    return request<SkillSubscription>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/subscription`,
      { credentials: 'include' },
    );
  },

  setSkillSubscription(
    owner: string,
    slug: string,
    input: { active: boolean; notifyOnRelease?: boolean; notifyOnSync?: boolean },
  ): Promise<SkillSubscription> {
    return request<SkillSubscription>(
      `/skills/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/subscription`,
      json(input, 'PUT'),
    );
  },

  // ─── Users ───────────────────────────────────────────────────────────

  getMe(): Promise<MeResponse> {
    return request<MeResponse>('/me', { credentials: 'include' });
  },

  updateAvatar(image: string | null): Promise<{ image: string | null }> {
    return request<{ image: string | null }>('/me/avatar', json({ image }, 'PATCH'));
  },

  getMySkills(): Promise<ListSkillsResponse> {
    return request<ListSkillsResponse>('/me/skills', { credentials: 'include' });
  },

  getOwnerSkills(ownerName: string): Promise<OwnerSkillsResponse> {
    return request<OwnerSkillsResponse>(`/users/${encodeURIComponent(ownerName)}/skills`, {
      credentials: 'include',
    });
  },

  // ─── Capability URL ──────────────────────────────────────────────────

  mintInstallToken(input: {
    skillId: string;
    expiresInHours?: number;
    maxUses?: number;
  }): Promise<MintTokenResult> {
    return request<MintTokenResult>('/install-tokens', json(input, 'POST'));
  },

  // ─── Notifications ───────────────────────────────────────────────────

  listNotifications(): Promise<{ items: Notification[]; total: number }> {
    return request<{ items: Notification[]; total: number }>('/notifications', {
      credentials: 'include',
    });
  },

  getUnreadNotificationCount(): Promise<{ count: number }> {
    return request<{ count: number }>('/notifications/unread-count', {
      credentials: 'include',
    });
  },

  markNotificationRead(id: string): Promise<{ status: 'ok' }> {
    return request<{ status: 'ok' }>(`/notifications/${id}/read`, {
      method: 'POST',
      credentials: 'include',
    });
  },

  markAllNotificationsRead(): Promise<{ status: 'ok' }> {
    return request<{ status: 'ok' }>('/notifications/read-all', {
      method: 'POST',
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
