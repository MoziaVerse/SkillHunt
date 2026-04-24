-- Phase 2 · spec 03 walkback: drop SkillHub-local PAT system
--
-- Decision: matrix is the central key authority for the Mozia ecosystem
-- (mclaw's model API keys already live there). SkillHub should forward
-- Bearer auth to that central system rather than maintain a parallel PAT
-- table. Capability URL (single-shot, server-minted) stays — different
-- mechanism, no overlap.
--
-- The matrix-token forwarding middleware will land in spec 04 (matrix embed)
-- when we have access to the central introspect endpoint.

DROP TABLE IF EXISTS "skillhub"."personal_access_tokens";
