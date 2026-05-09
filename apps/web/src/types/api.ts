export interface OwnerInfo {
  id: string;
  /** Display name — anything (Chinese, spaces, mixed case) */
  name: string;
  /** URL handle — lowercase + dashes; used in /u/:handle */
  handle: string;
  image: string | null;
}

export interface BaseSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  owner: OwnerInfo;
  upvoteCount: number;
  commentCount: number;
  bookmarkCount: number;
  viewerHasUpvoted: boolean;
}

export interface OwnedSkillListItem extends BaseSkill {
  type: 'owned';
  visibility: 'public' | 'private';
}

export interface ReferencedSkillListItem extends BaseSkill {
  type: 'referenced';
  sourceRepo: string;
  sourceSkillName: string;
}

export type SkillListItem = OwnedSkillListItem | ReferencedSkillListItem;

export interface OwnedSkillDetail extends OwnedSkillListItem {
  skillMdContent: string;
  files: string[];
  installCommand: string;
}

export interface ReferencedSkillDetail extends ReferencedSkillListItem {
  sourceInstallCommand: string;
  sourceUrl: string | null;
}

export type SkillDetail = OwnedSkillDetail | ReferencedSkillDetail;

export interface SkillComment {
  id: string;
  skillId: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: OwnerInfo;
}

export interface SkillRelease {
  id: string;
  skillId: string;
  version: number;
  title: string;
  changelog: string;
  files: string[];
  createdBy?: OwnerInfo;
  createdByUserId?: string;
  createdAt: string;
}

export interface SkillSubscription {
  id?: string;
  active: boolean;
  notifyOnRelease: boolean;
  notifyOnSync: boolean;
  updatedAt?: string;
}

export interface SkillSyncEvent {
  id: string;
  status: 'success' | 'conflict' | 'failed';
  conflictFiles: string[];
  summary: string;
  createdAt: string;
}

export type NotificationType =
  | 'upvote'
  | 'comment'
  | 'reply'
  | 'bookmark'
  | 'fork'
  | 'sync'
  | 'release';

export interface Notification {
  id: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actor: OwnerInfo | null;
  skill: { id: string; slug: string; name: string; owner: OwnerInfo } | null;
}

export type UpstreamStatus =
  | {
      isFork: false;
      forkCount: number;
      ownReleases: SkillRelease[];
      subscription: SkillSubscription | null;
      syncEvents: SkillSyncEvent[];
      baseRelease: null;
      latestUpstreamRelease: null;
    }
  | {
      isFork: true;
      upstream: {
        id: string;
        slug: string;
        name: string;
        owner: OwnerInfo;
      } | null;
      forkCount: number;
      ownReleases: SkillRelease[];
      baseRelease: SkillRelease | null;
      latestUpstreamRelease: SkillRelease | null;
      hasUpdate: boolean;
      behindBy: number;
      conflictFiles: string[];
      subscription: SkillSubscription | null;
      syncEvents: SkillSyncEvent[];
    };

export interface ListSkillsResponse {
  items: SkillListItem[];
  total: number;
}

export interface ListTagsResponse {
  tags: string[];
}
