import { z } from 'zod';

// ─── Query ─────────────────────────────────────────────────────────────

export const listSkillsQuerySchema = z.object({
  type: z.enum(['owned', 'referenced', 'all']).optional().default('all'),

  q: z.string().trim().min(1).max(200).optional(),

  // ?tag=a&tag=b comes through as string or string[]; normalize to string[].
  tag: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
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
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  owner: ownerInfoSchema,
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

// ─── Mutations ─────────────────────────────────────────────────────────

// Slug / owner segment: lowercase, 1-64, [a-z0-9-], no leading/trailing dash.
export const slugSegmentSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, 'must be lowercase alphanumeric with dashes');

export const createSkillSchema = z.object({
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
});

export type CreateSkillInput = z.infer<typeof createSkillSchema>;

// Update can change everything except identity (owner, slug).
export const updateSkillSchema = createSkillSchema.omit({ owner: true, slug: true }).partial();

export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;

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

// PATCH /api/users/me/profile — both name (display) and handle (URL) editable,
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

// ─── PAT ───────────────────────────────────────────────────────────────

export const createPatSchema = z.object({
  name: z.string().trim().min(1).max(80),
  // Optional TTL; null/omitted = never expires. Capped client-side at 1 year.
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export type CreatePatInput = z.infer<typeof createPatSchema>;

// ─── Capability URL ────────────────────────────────────────────────────

export const mintInstallTokenSchema = z.object({
  skillId: z.string().uuid(),
  expiresInHours: z.number().int().min(1).max(168).optional().default(24),
  maxUses: z.number().int().min(1).max(100).optional().default(1),
});

export type MintInstallTokenInput = z.infer<typeof mintInstallTokenSchema>;
