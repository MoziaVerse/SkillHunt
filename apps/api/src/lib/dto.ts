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

  // Opt-in to see internal skills. Phase 0 defaults to false.
  includeInternal: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
});

// ─── List item ─────────────────────────────────────────────────────────

const baseSkillDto = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ownedSkillListItemSchema = baseSkillDto.extend({
  type: z.literal('owned'),
  visibility: z.enum(['public', 'internal']),
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
