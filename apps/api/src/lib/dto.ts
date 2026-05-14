import { z } from 'zod';

export const VIDEO_UPLOAD_MAX_BYTES = 500 * 1024 * 1024;

// ─── Query ─────────────────────────────────────────────────────────────

export const listSkillsQuerySchema = z.object({
  type: z.enum(['owned', 'referenced', 'all']).optional().default('all'),

  q: z.string().trim().min(1).max(200).optional(),

  // ?tag=a&tag=b comes through as string or string[]; normalize to string[].
  tag: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),

  sort: z.enum(['recent', 'hottest', 'az']).optional().default('recent'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const listPackagesQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  tag: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
  sort: z.enum(['recent', 'hottest', 'az']).optional().default('recent'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ─── Owner ─────────────────────────────────────────────────────────────

export const ownerInfoSchema = z.object({
  id: z.string(),
  // Display name (free-form, may contain Chinese / spaces / mixed case)
  name: z.string(),
  // URL handle (lowercase + dashes); used in /u/:handle
  handle: z.string(),
  image: z.string().nullable(),
});

export type OwnerInfo = z.infer<typeof ownerInfoSchema>;

// ─── List item ─────────────────────────────────────────────────────────

const baseSkillDto = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  icon: z.string().nullable(),
  coverImage: z.string().nullable(),
  demoVideoUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  owner: ownerInfoSchema,
  upvoteCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  bookmarkCount: z.number().int().nonnegative(),
  viewerHasUpvoted: z.boolean(),
  viewerHasBookmarked: z.boolean(),
});

export const ownedSkillListItemSchema = baseSkillDto.extend({
  type: z.literal('owned'),
  visibility: z.enum(['public', 'private']),
});

export const referencedSkillListItemSchema = baseSkillDto.extend({
  type: z.literal('referenced'),
  sourceRepo: z.string(),
  sourceSkillName: z.string(),
});

export const skillListItemSchema = z.discriminatedUnion('type', [
  ownedSkillListItemSchema,
  referencedSkillListItemSchema,
]);

export type SkillListItem = z.infer<typeof skillListItemSchema>;

// ─── Detail ────────────────────────────────────────────────────────────

export const ownedSkillDetailSchema = ownedSkillListItemSchema.extend({
  skillMdContent: z.string(),
  files: z.array(z.string()),
  installCommand: z.string(),
});

export const referencedSkillDetailSchema = referencedSkillListItemSchema.extend({
  sourceInstallCommand: z.string(),
  sourceUrl: z.string().nullable(),
});

export const skillDetailSchema = z.discriminatedUnion('type', [
  ownedSkillDetailSchema,
  referencedSkillDetailSchema,
]);

export type SkillDetail = z.infer<typeof skillDetailSchema>;

// ─── Skill Package ────────────────────────────────────────────────────

export const skillPackageListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  visibility: z.enum(['public', 'private']),
  tags: z.array(z.string()),
  icon: z.string().nullable(),
  coverImage: z.string().nullable(),
  owner: ownerInfoSchema,
  skillCount: z.number().int().nonnegative(),
  upvoteCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  bookmarkCount: z.number().int().nonnegative(),
  viewerHasUpvoted: z.boolean(),
  viewerHasBookmarked: z.boolean(),
  installCommand: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const skillPackageSkillSchema = z.object({
  itemId: z.string(),
  position: z.number().int().nonnegative(),
  note: z.string().nullable(),
  pinnedReleaseId: z.string().nullable(),
  protocolName: z.string(),
  files: z.array(z.string()),
  skill: ownedSkillListItemSchema,
});

export const skillPackageDetailSchema = skillPackageListItemSchema.extend({
  skills: z.array(skillPackageSkillSchema),
});

export type SkillPackageListItem = z.infer<typeof skillPackageListItemSchema>;
export type SkillPackageDetail = z.infer<typeof skillPackageDetailSchema>;

export const communityCommentSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: ownerInfoSchema,
});

export type CommunityComment = z.infer<typeof communityCommentSchema>;

export const skillCommentSchema = z.object({
  id: z.string(),
  skillId: z.string(),
  parentId: z.string().nullable(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: ownerInfoSchema,
});

export type SkillComment = z.infer<typeof skillCommentSchema>;

export const createSkillCommentSchema = z.object({
  content: z.string().trim().min(1).max(5_000),
  parentId: z.string().optional().nullable(),
});

export type CreateSkillCommentInput = z.infer<typeof createSkillCommentSchema>;

// ─── Mutations ─────────────────────────────────────────────────────────

// Slug / owner segment: lowercase, 1-64, [a-z0-9-], no leading/trailing dash.
export const slugSegmentSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, 'must be lowercase alphanumeric with dashes');

const createSkillSchemaInner = z.object({
  // owner = the publishing user's URL handle (or a virtual handle from
  // canPublishAs, e.g. "mozia"). Must satisfy SLUG_RE.
  owner: slugSegmentSchema,
  slug: slugSegmentSchema,
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  visibility: z.enum(['public', 'private']).default('private'),
  // SKILL.md content. 20 char floor (a meaningful skill has at least a heading
  // and a sentence); 200 KB ceiling (anything more should split into files/).
  skillMdContent: z.string().min(20).max(200_000),
  // Optional: pre-parsed frontmatter; if absent we extract from skillMdContent.
  frontmatter: z.record(z.string(), z.unknown()).optional(),
  // SkillHunt display fields (decoupled from SKILL.md content).
  icon: z.string().max(10).optional().nullable(),
  coverImage: z
    .string()
    .max(2_000_000, 'image data too large')
    .optional()
    .nullable()
    .refine(
      (v) => v === null || v === undefined || v.startsWith('data:image/'),
      'must be a data:image/ URL or null',
    ),
  demoVideoUrl: z.string().url().max(500).optional().nullable(),
});

export const createSkillSchema = createSkillSchemaInner.refine(
  (data) => !(data.icon && data.coverImage),
  {
    message: 'icon and coverImage are mutually exclusive',
    path: ['icon'],
  },
);

export type CreateSkillInput = z.infer<typeof createSkillSchema>;

// Update can change everything except identity (owner, slug).
export const updateSkillSchema = createSkillSchemaInner.omit({ owner: true, slug: true }).partial();

export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;

const packageDisplayFields = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  visibility: z.enum(['public', 'private']).default('private'),
  icon: z.string().max(10).optional().nullable(),
  coverImage: z
    .string()
    .max(2_000_000, 'image data too large')
    .optional()
    .nullable()
    .refine(
      (v) => v === null || v === undefined || v.startsWith('data:image/'),
      'must be a data:image/ URL or null',
    ),
});

export const createSkillPackageSchema = packageDisplayFields
  .extend({
    owner: slugSegmentSchema,
    slug: slugSegmentSchema,
    skillIds: z.array(z.string().min(1)).max(50).optional().default([]),
  })
  .refine((data) => !(data.icon && data.coverImage), {
    message: 'icon and coverImage are mutually exclusive',
    path: ['icon'],
  });

export type CreateSkillPackageInput = z.infer<typeof createSkillPackageSchema>;

export const updateSkillPackageSchema = packageDisplayFields
  .partial()
  .refine((data) => !(data.icon && data.coverImage), {
    message: 'icon and coverImage are mutually exclusive',
    path: ['icon'],
  });

export type UpdateSkillPackageInput = z.infer<typeof updateSkillPackageSchema>;

export const createSkillPackageItemSchema = z.object({
  skillId: z.string().min(1),
  position: z.number().int().min(0).optional(),
  note: z.string().max(500).optional().nullable(),
  pinnedReleaseId: z.string().min(1).optional().nullable(),
});

export type CreateSkillPackageItemInput = z.infer<typeof createSkillPackageItemSchema>;

export const updateSkillPackageItemSchema = z.object({
  position: z.number().int().min(0).optional(),
  note: z.string().max(500).optional().nullable(),
  pinnedReleaseId: z.string().min(1).optional().nullable(),
});

export type UpdateSkillPackageItemInput = z.infer<typeof updateSkillPackageItemSchema>;

export const forkSkillSchema = z.object({
  slug: slugSegmentSchema.optional(),
  note: z.string().max(500).optional(),
});

export type ForkSkillInput = z.infer<typeof forkSkillSchema>;

export const createReleaseSchema = z.object({
  title: z.string().trim().min(1).max(120).default('发布更新'),
  changelog: z.string().trim().max(5_000).default(''),
});

export type CreateReleaseInput = z.infer<typeof createReleaseSchema>;

export const syncUpstreamSchema = z.object({
  strategy: z.enum(['auto']).default('auto'),
});

export type SyncUpstreamInput = z.infer<typeof syncUpstreamSchema>;

export const updateSubscriptionSchema = z.object({
  active: z.boolean(),
  notifyOnRelease: z.boolean().optional().default(true),
  notifyOnSync: z.boolean().optional().default(true),
});

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

// ─── OSS video upload ─────────────────────────────────────────────────

export const createVideoUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((value) => value.toLowerCase().startsWith('video/'), 'must be a video file'),
  size: z.number().int().positive().max(VIDEO_UPLOAD_MAX_BYTES),
});

export type CreateVideoUploadInput = z.infer<typeof createVideoUploadSchema>;

export const completeVideoUploadSchema = z.object({
  objectKey: z.string().min(1).max(1024),
});

export type CompleteVideoUploadInput = z.infer<typeof completeVideoUploadSchema>;

// File path constraint: no leading slash, no `..`, max 512 chars (matches DB constraint)
export const filePathSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[^/]/, 'must not start with /')
  .refine((p) => !p.includes('..'), 'must not contain `..`');

export const upsertFileBodySchema = z.object({
  content: z.string().max(200_000),
});

// ─── Users ─────────────────────────────────────────────────────────────

export const userPublicSchema = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string(),
  email: z.string().nullable(),
  image: z.string().nullable(),
  isVirtual: z.boolean(),
  canPublishAs: z.array(z.string()),
});

export type UserPublic = z.infer<typeof userPublicSchema>;

// Reserved handles — collide with route prefixes or have admin connotations.
export const RESERVED_HANDLES = new Set([
  'admin',
  'anonymous',
  'api',
  'auth',
  'docs',
  'publish',
  'root',
  'settings',
  'skills',
  'system',
  'u',
  'www',
]);

// PATCH /api/me/profile — both name (display) and handle (URL) editable,
// either independently. handle goes through SLUG_RE; name has no charset rule
// beyond a length cap.
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    handle: slugSegmentSchema
      .refine((h) => !RESERVED_HANDLES.has(h), 'this handle is reserved')
      .optional(),
  })
  .refine((v) => v.name !== undefined || v.handle !== undefined, {
    message: 'at least one of name / handle is required',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// PATCH /api/me/avatar — accepts a base64 data-URL or clears with null.
export const updateAvatarSchema = z.object({
  image: z
    .string()
    .max(2_000_000, 'image data too large')
    .nullable()
    .refine((v) => v === null || v.startsWith('data:image/'), 'must be a data:image/ URL or null'),
});

export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;

// ─── Capability URL ────────────────────────────────────────────────────

export const mintInstallTokenSchema = z.object({
  skillId: z.string().uuid(),
  expiresInHours: z.number().int().min(1).max(168).optional().default(24),
  maxUses: z.number().int().min(1).max(100).optional().default(1),
});

export type MintInstallTokenInput = z.infer<typeof mintInstallTokenSchema>;
