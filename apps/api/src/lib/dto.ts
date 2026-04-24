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
  name: z.string(),
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
  email: z.string().nullable(),
  image: z.string().nullable(),
  isVirtual: z.boolean(),
  canPublishAs: z.array(z.string()),
});

export type UserPublic = z.infer<typeof userPublicSchema>;

// PATCH /api/users/me/profile — for now only name is editable.
export const updateProfileSchema = z.object({
  name: slugSegmentSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
