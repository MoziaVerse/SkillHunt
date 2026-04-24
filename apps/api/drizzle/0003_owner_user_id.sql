-- Phase 2 · Spec 02 · Pass 1 · author plumbing
-- Add owner_user_id to every skill, introduce a `mozia` virtual user as the
-- owner of all existing seed data, and switch slug uniqueness from global to
-- (owner_user_id, slug) — paving the way for `<user>/<slug>` namespacing in
-- pass 2.
--
-- Defers (handled in pass 2 when the /publish UI lands):
--   - user.name UNIQUE (lower) constraint
--   - user.name format CHECK constraint
--   - URL-level namespacing (/api/skills/:owner/:slug)

-- 1) user table extras
ALTER TABLE "skillhub"."user"
  ADD COLUMN IF NOT EXISTS "is_virtual" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "skillhub"."user"
  ADD COLUMN IF NOT EXISTS "can_publish_as" text[] NOT NULL DEFAULT ARRAY[]::text[];
--> statement-breakpoint

-- 2) Insert the `mozia` virtual user (idempotent — safe to re-run)
INSERT INTO "skillhub"."user"
  ("id", "name", "email", "email_verified", "is_virtual", "created_at", "updated_at")
VALUES
  ('mozia-virtual', 'mozia', 'team@mozia.local', true, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- 3) skills.owner_user_id (nullable first, backfill, then NOT NULL)
ALTER TABLE "skillhub"."skills"
  ADD COLUMN IF NOT EXISTS "owner_user_id" text REFERENCES "skillhub"."user"("id") ON DELETE RESTRICT;
--> statement-breakpoint
UPDATE "skillhub"."skills" SET "owner_user_id" = 'mozia-virtual' WHERE "owner_user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "skillhub"."skills" ALTER COLUMN "owner_user_id" SET NOT NULL;
--> statement-breakpoint

-- 4) Switch slug uniqueness: global → (owner_user_id, slug)
DROP INDEX IF EXISTS "skillhub"."skills_slug_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "skills_owner_slug_idx"
  ON "skillhub"."skills" ("owner_user_id", "slug");
