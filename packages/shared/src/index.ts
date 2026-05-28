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

export type SkillUploadIgnoredReason =
  | 'git-directory'
  | 'system-file'
  | 'ide-directory'
  | 'dependency-directory'
  | 'build-directory'
  | 'cache-directory'
  | 'root-gitignore';

export interface SkillUploadIgnoredPath {
  ignored: true;
  reason: SkillUploadIgnoredReason;
  message: string;
}

export type SkillUploadIgnoreResult = SkillUploadIgnoredPath | { ignored: false };

const CACHE_DIRECTORY_NAMES = new Set([
  '.cache',
  '.mypy_cache',
  '.pytest_cache',
  '.ruff_cache',
  '.turbo',
  '.vite',
  '__pycache__',
  'cache',
  'caches',
]);

export function normalizeSkillUploadPath(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).join('/');
}

export function getSkillUploadIgnoredPath(
  path: string,
  options: { rootRelative?: boolean } = {},
): SkillUploadIgnoreResult {
  const normalized = normalizeSkillUploadPath(path);
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return { ignored: false };

  for (const segment of segments) {
    const lower = segment.toLowerCase();
    if (lower === '.git') {
      return { ignored: true, reason: 'git-directory', message: 'Git 仓库目录' };
    }
    if (lower === '.ds_store') {
      return { ignored: true, reason: 'system-file', message: '系统文件' };
    }
    if (lower === '.idea') {
      return { ignored: true, reason: 'ide-directory', message: 'IDE 配置目录' };
    }
    if (lower === 'node_modules') {
      return { ignored: true, reason: 'dependency-directory', message: '依赖目录' };
    }
    if (lower === 'dist') {
      return { ignored: true, reason: 'build-directory', message: '构建产物目录' };
    }
    if (CACHE_DIRECTORY_NAMES.has(lower)) {
      return { ignored: true, reason: 'cache-directory', message: '缓存目录' };
    }
  }

  if (
    options.rootRelative &&
    segments.length === 1 &&
    segments[0]?.toLowerCase() === '.gitignore'
  ) {
    return { ignored: true, reason: 'root-gitignore', message: '根目录 Git 忽略规则' };
  }

  return { ignored: false };
}

export function isSkillUploadIgnoredPath(path: string, options?: { rootRelative?: boolean }) {
  return getSkillUploadIgnoredPath(path, options).ignored;
}
