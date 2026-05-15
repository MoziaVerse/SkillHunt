export type PublishableKind = 'skill' | 'package';

export interface SharedOwnerInfo {
  id: string;
  name: string;
  handle: string;
  image: string | null;
}

export interface SharedPublishableBase {
  id: string;
  kind: PublishableKind;
  slug: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  tags: string[];
  icon: string | null;
  coverImage: string | null;
  owner: SharedOwnerInfo;
  upvoteCount: number;
  commentCount: number;
  bookmarkCount: number;
  viewerHasUpvoted: boolean;
  viewerHasBookmarked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SharedPublishableRelease {
  id: string;
  publishableId: string;
  kind: PublishableKind;
  version: number;
  title: string;
  changelog: string;
  files: string[];
  createdBy?: SharedOwnerInfo;
  createdByUserId?: string;
  createdAt: string;
}
