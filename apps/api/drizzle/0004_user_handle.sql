-- Phase 2 · post-pass2c: split URL handle from display name
-- user.name now means "display name" (anything goes — Chinese, spaces, mixed
-- case). user.handle is the new URL-safe identifier (lowercase / dashes).
-- Backfill handle from existing name via the same sanitize logic that
-- mapProfileToUser will use for new accounts.

-- 1) Add the column nullable so backfill works
ALTER TABLE "skillhub"."user" ADD COLUMN IF NOT EXISTS "handle" text;
--> statement-breakpoint

-- 2) Backfill: lower(name) → strip non-[a-z0-9-] (replace runs of bad chars
--    with '-') → trim leading/trailing '-' → cap 32 chars. If empty after
--    sanitize, fall back to 'user-<first 8 of id>'.
UPDATE "skillhub"."user"
SET "handle" = COALESCE(
  NULLIF(
    substring(
      regexp_replace(
        regexp_replace(lower("name"), '[^a-z0-9-]+', '-', 'g'),
        '^-+|-+$', '', 'g'
      )
      FROM 1 FOR 32
    ),
    ''
  ),
  'user-' || substring("id" FROM 1 FOR 8)
)
WHERE "handle" IS NULL;
--> statement-breakpoint

-- 3) Enforce NOT NULL + unique
ALTER TABLE "skillhub"."user" ALTER COLUMN "handle" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_handle_idx" ON "skillhub"."user" ("handle");
