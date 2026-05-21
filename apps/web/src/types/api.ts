import type { PublishableKind, SharedPublishableRelease } from '@mozia/skillhub-shared';

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
  icon: string | null;
  coverImage: string | null;
  demoVideoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  owner: OwnerInfo;
  upvoteCount: number;
  commentCount: number;
  bookmarkCount: number;
  viewerHasUpvoted: boolean;
  viewerHasBookmarked: boolean;
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

export interface SkillPackageListItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  tags: string[];
  icon: string | null;
  coverImage: string | null;
  owner: OwnerInfo;
  skillCount: number;
  upvoteCount: number;
  commentCount: number;
  bookmarkCount: number;
  viewerHasUpvoted: boolean;
  viewerHasBookmarked: boolean;
  installCommand: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillPackageSkill {
  itemId: string;
  position: number;
  note: string | null;
  pinnedReleaseId: string | null;
  protocolName: string;
  files: string[];
  skill: OwnedSkillListItem;
}

export interface SkillPackageDetail extends SkillPackageListItem {
  skills: SkillPackageSkill[];
}

export type PublishableListItem =
  | { kind: 'skill'; item: SkillListItem; updatedAt: string; score: number }
  | { kind: 'package'; item: SkillPackageListItem; updatedAt: string; score: number };

export interface CommunityComment {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: OwnerInfo;
}

export interface SkillComment extends CommunityComment {
  skillId: string;
}

export interface SkillPackageComment extends CommunityComment {
  packageId: string;
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

export interface SkillPackageRelease extends SharedPublishableRelease {
  kind: 'package';
  packageId: string;
  publishableId: string;
  installCommand: string;
  skills: Array<{
    skillId: string;
    ownerHandle: string;
    skillSlug: string;
    skillName: string;
    skillDescription: string;
    protocolName: string;
    position: number;
    note: string | null;
    skillReleaseId: string;
    skillVersion: number;
    files: string[];
  }>;
}

export type PublishableReleaseKind = PublishableKind;

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
  publishable: {
    id: string;
    kind: 'skill' | 'package';
    slug: string;
    name: string;
    owner: OwnerInfo;
  } | null;
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

export interface ListPackagesResponse {
  items: SkillPackageListItem[];
  total: number;
}

export interface ListPublishablesResponse {
  items: PublishableListItem[];
  total: number;
}

export interface OwnerPublishablesResponse {
  owner: OwnerInfo;
  items: PublishableListItem[];
  total: number;
}

export interface ListTagsResponse {
  tags: string[];
}

export type ContestTrack = '学习科研' | '校园生活' | '创意应用' | '专业实训';

export interface ContestSubmission {
  id: string;
  eventSlug: string;
  track: ContestTrack;
  videoObjectKey: string | null;
  videoUrl: string | null;
  videoPlaybackUrl: string | null;
  videoDurationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
  skill: SkillListItem;
}

export interface ListContestSubmissionsResponse {
  items: ContestSubmission[];
  total: number;
}
