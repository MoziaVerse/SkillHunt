-- Phase 2 · Spec 01 · visibility cleanup
-- Switch visibility enum from ('public', 'internal') to ('public', 'private')
-- and drop the now-unused user.groups column.

-- 1) Migrate existing internal data to public.
--    Phase 1's internal tier is being retired; the only existing internal row
--    is the seeded `internal-rfc-writer` demo, which is fine to make public.
ALTER TYPE "skillhub"."visibility" ADD VALUE IF NOT EXISTS 'private';
--> statement-breakpoint
UPDATE "skillhub"."skills" SET "visibility" = 'public' WHERE "visibility" = 'internal';
--> statement-breakpoint

-- 2) Recreate the enum to drop the 'internal' value (Postgres has no DROP VALUE).
ALTER TYPE "skillhub"."visibility" RENAME TO "visibility_old";
--> statement-breakpoint
CREATE TYPE "skillhub"."visibility" AS ENUM('public', 'private');
--> statement-breakpoint
ALTER TABLE "skillhub"."skills" ALTER COLUMN "visibility" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "skillhub"."skills"
  ALTER COLUMN "visibility" TYPE "skillhub"."visibility"
  USING "visibility"::text::"skillhub"."visibility";
--> statement-breakpoint
ALTER TABLE "skillhub"."skills" ALTER COLUMN "visibility" SET DEFAULT 'public';
--> statement-breakpoint
DROP TYPE "skillhub"."visibility_old";
--> statement-breakpoint

-- 3) Drop user.groups — Phase 1 stored synthesized virtual groups here, but
--    Phase 2 has no group-based visibility. Fresh logins don't need it.
ALTER TABLE "skillhub"."user" DROP COLUMN IF EXISTS "groups";
