-- Phase 2 · Spec 03 · PAT + capability URL backend
-- Three new tables to support:
--   1) Personal Access Tokens (long-lived, user-scoped, for mclaw / curl / CI)
--   2) Capability URL grants (one-shot, short-TTL, server-minted)
--   3) Audit log for capability URL accesses

-- ─── Personal Access Tokens ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "skillhub"."personal_access_tokens" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"       text NOT NULL REFERENCES "skillhub"."user"("id") ON DELETE CASCADE,
  "name"          text NOT NULL,                 -- user-supplied label, e.g. "mclaw on macbook"
  "token_hash"    text NOT NULL,                 -- bcrypt of full token
  "token_prefix"  text NOT NULL,                 -- e.g. "mzhk_pat_a8f3" (first 14 chars), shown to user
  "last_used_at"  timestamp with time zone,
  "expires_at"    timestamp with time zone,      -- NULL = never expires
  "created_at"    timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pat_user_idx" ON "skillhub"."personal_access_tokens" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pat_token_prefix_idx" ON "skillhub"."personal_access_tokens" ("token_prefix");
--> statement-breakpoint

-- ─── Install grants (capability URL tokens) ───────────────────────────
CREATE TABLE IF NOT EXISTS "skillhub"."install_grants" (
  "token"        text PRIMARY KEY,                -- 32 bytes base64url, embedded in URL
  "skill_id"     uuid NOT NULL REFERENCES "skillhub"."skills"("id") ON DELETE CASCADE,
  "granted_by"   text NOT NULL REFERENCES "skillhub"."user"("id"),
  "expires_at"   timestamp with time zone NOT NULL,
  "max_uses"     integer NOT NULL DEFAULT 1,
  "used_count"   integer NOT NULL DEFAULT 0,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "install_grants_skill_idx" ON "skillhub"."install_grants" ("skill_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "install_grants_expires_idx" ON "skillhub"."install_grants" ("expires_at");
--> statement-breakpoint

-- ─── Audit log: every capability URL hit ─────────────────────────────
CREATE TABLE IF NOT EXISTS "skillhub"."install_grant_uses" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "token"        text NOT NULL,                  -- not FK on purpose: keep audit even if grant deleted
  "ip"           inet,
  "user_agent"   text,
  "accessed_at"  timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grant_uses_token_idx" ON "skillhub"."install_grant_uses" ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grant_uses_accessed_idx" ON "skillhub"."install_grant_uses" ("accessed_at");
