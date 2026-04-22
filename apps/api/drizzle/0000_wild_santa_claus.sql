CREATE SCHEMA "skillhub";
--> statement-breakpoint
CREATE TYPE "skillhub"."skill_type" AS ENUM('owned', 'referenced');--> statement-breakpoint
CREATE TYPE "skillhub"."visibility" AS ENUM('public', 'internal');--> statement-breakpoint
CREATE TABLE "skillhub"."skill_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skillhub"."skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"type" "skillhub"."skill_type" NOT NULL,
	"visibility" "skillhub"."visibility" DEFAULT 'public' NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"source_repo" text,
	"source_skill_name" text,
	"source_install_command" text,
	"source_url" text,
	"frontmatter" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skillhub"."skill_files" ADD CONSTRAINT "skill_files_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "skillhub"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "skill_files_skill_path_idx" ON "skillhub"."skill_files" USING btree ("skill_id","path");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_slug_idx" ON "skillhub"."skills" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "skills_type_idx" ON "skillhub"."skills" USING btree ("type");--> statement-breakpoint
CREATE INDEX "skills_visibility_idx" ON "skillhub"."skills" USING btree ("visibility");--> statement-breakpoint
ALTER TABLE "skillhub"."skills" ADD CONSTRAINT "skills_owned_has_frontmatter" CHECK (
  type <> 'owned' OR frontmatter IS NOT NULL
);--> statement-breakpoint
ALTER TABLE "skillhub"."skills" ADD CONSTRAINT "skills_referenced_has_source" CHECK (
  type <> 'referenced' OR (
    source_repo IS NOT NULL
    AND source_skill_name IS NOT NULL
    AND source_install_command IS NOT NULL
  )
);--> statement-breakpoint
ALTER TABLE "skillhub"."skills" ADD CONSTRAINT "skills_slug_format" CHECK (
  slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$' OR length(slug) = 1
);--> statement-breakpoint
ALTER TABLE "skillhub"."skill_files" ADD CONSTRAINT "skill_files_path_safe" CHECK (
  path !~ '\.\.' AND path !~ '^/' AND length(path) <= 512
);--> statement-breakpoint
CREATE OR REPLACE FUNCTION skillhub.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER skills_touch_updated_at
  BEFORE UPDATE ON skillhub.skills
  FOR EACH ROW
  EXECUTE FUNCTION skillhub.touch_updated_at();