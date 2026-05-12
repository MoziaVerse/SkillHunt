#!/usr/bin/env bash
# SkillHunt Phase 0 smoke test
# ---
# Assumes:
#   - `pnpm dev` is already running (api on :3333, web on :5180)
#   - Seeds have been loaded (`pnpm seed:all`): 5 owned (all public) + 4 referenced
#
# Usage:
#   ./scripts/smoke.sh                       # API + protocol checks
#   SKIP_CLI=0 ./scripts/smoke.sh            # also run the official `npx skills` CLI compat
#
# Env overrides: API=http://localhost:3333  WEB=http://localhost:5180
set -uo pipefail

API=${API:-http://localhost:3333}
WEB=${WEB:-http://localhost:5180}
SKIP_CLI=${SKIP_CLI:-1}

red()   { printf "\033[31m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
cyan()  { printf "\033[36m%s\033[0m\n" "$1"; }
dim()   { printf "\033[2m%s\033[0m\n" "$1"; }

PASS=0
FAIL=0

check() {
  local name=$1
  shift
  if "$@" > /dev/null 2>&1; then
    green "  ✓ $name"
    PASS=$((PASS + 1))
  else
    red "  ✗ $name"
    FAIL=$((FAIL + 1))
  fi
}

jq_check() {
  local name=$1
  local url=$2
  local expr=$3
  if curl -fsS "$url" | jq -e "$expr" > /dev/null 2>&1; then
    green "  ✓ $name"
    PASS=$((PASS + 1))
  else
    red "  ✗ $name  [url=$url expr=$expr]"
    FAIL=$((FAIL + 1))
  fi
}

# ─── Preflight ───────────────────────────────────────────────────────
if ! command -v jq > /dev/null; then
  red "jq is required. Install with: brew install jq"
  exit 2
fi

cyan "═══ 1. Health ═══"
check "api /healthz"                    bash -c "curl -fsS $API/healthz | grep -q skillhunt-api"
check "web / returns HTML"              bash -c "curl -fsS $WEB/ | grep -q '<div id=\"root\"'"
check "web / exposes SkillHunt title"    bash -c "curl -fsS $WEB/ | grep -q 'SkillHunt'"

cyan "═══ 2. Business API ═══"
jq_check "/api/skills → items is array"              "$API/api/skills"                             ".items | type == \"array\""
# Phase 2-01: visibility is public/private; all 9 seeded rows are public, anon sees them all.
jq_check "/api/skills total = 9 (all seeded)"             "$API/api/skills"                              ".items | length == 9"
jq_check "/api/skills?type=owned = 5"                     "$API/api/skills?type=owned"                   ".items | length == 5"
jq_check "/api/skills?type=referenced = 4"           "$API/api/skills?type=referenced"              ".items | length == 4"
jq_check "/api/skills?q=design returns ≥ 1"          "$API/api/skills?q=design"                     ".items | length >= 1"
jq_check "/api/tags → tags is array"                 "$API/api/tags"                                ".tags | type == \"array\""
# Phase 2-02: canonical URL is /api/skills/:owner/:slug; legacy /:slug → 302 to canonical.
jq_check "/api/skills/mozia/project-mental-map → owned" "$API/api/skills/mozia/project-mental-map" ".type == \"owned\""
jq_check "  → owner.name = mozia"                       "$API/api/skills/mozia/project-mental-map" ".owner.name == \"mozia\""
jq_check "  → skillMdContent non-empty"                 "$API/api/skills/mozia/project-mental-map" ".skillMdContent | length > 0"
jq_check "  → installCommand has local URL"             "$API/api/skills/mozia/project-mental-map" ".installCommand | contains(\"localhost:3333\")"
jq_check "/api/skills/mozia/frontend-design → referenced" "$API/api/skills/mozia/frontend-design"  ".type == \"referenced\""
jq_check "  → sourceInstallCommand present"             "$API/api/skills/mozia/frontend-design"    ".sourceInstallCommand | length > 0"
check   "legacy /api/skills/:slug returns 302"          bash -c "[ \$(curl -sS -o /dev/null -w '%{http_code}' $API/api/skills/project-mental-map) = '302' ]"
check   "/api/skills/no-such → 404"                  bash -c "[ \$(curl -sS -o /dev/null -w '%{http_code}' $API/api/skills/no-such) = '404' ]"

cyan "═══ 3. Well-Known Protocol ═══"
jq_check "index.json accessible"                     "$API/.well-known/agent-skills/index.json"  ". != null"
jq_check "index.json { skills: [...] } shape"        "$API/.well-known/agent-skills/index.json"  ".skills | type == \"array\""
jq_check "index.json exposes 5 (all owned + public)" "$API/.well-known/agent-skills/index.json"  ".skills | length == 5"
jq_check "every entry has name/description/files"    "$API/.well-known/agent-skills/index.json"  'all(.skills[]; has("name") and has("description") and has("files"))'
jq_check "every entry files contains SKILL.md"       "$API/.well-known/agent-skills/index.json"  'all(.skills[]; .files | any(. == "SKILL.md"))'

FIRST_SLUG=$(curl -fsS "$API/.well-known/agent-skills/index.json" | jq -r '.skills[0].name')
check "first owned SKILL.md starts with frontmatter" \
  bash -c "curl -fsS $API/.well-known/agent-skills/$FIRST_SLUG/SKILL.md | head -1 | grep -q '^---'"
check "previously-internal skill is now public (200)" \
  bash -c "[ \$(curl -sS -o /dev/null -w '%{http_code}' $API/.well-known/agent-skills/internal-rfc-writer/SKILL.md) = '200' ]"
check "referenced skill hidden from well-known (404)" \
  bash -c "[ \$(curl -sS -o /dev/null -w '%{http_code}' $API/.well-known/agent-skills/frontend-design/SKILL.md) = '404' ]"
check "path traversal rejected (400 or 404)" \
  bash -c "code=\$(curl -sS -o /dev/null -w '%{http_code}' $API/.well-known/agent-skills/$FIRST_SLUG/..%2Fetc%2Fpasswd); [ \$code = '400' ] || [ \$code = '404' ]"

cyan "═══ 4. Vite Proxy (web → api) ═══"
jq_check "web /api/skills proxied to api"            "$WEB/api/skills"                              ".items | length == 9"
jq_check "web /api/tags proxied"                     "$WEB/api/tags"                                ".tags | type == \"array\""

if [ "$SKIP_CLI" != "1" ]; then
  cyan "═══ 5. Official CLI Compatibility (opt-in) ═══"
  # NOTE: only verifies protocol compat (list + install exits OK).
  # Filesystem side-effects of `npx skills add` vary across CLI versions
  # (install target, flag names), so we don't assert a specific path.
  TMP=$(mktemp -d)
  pushd "$TMP" > /dev/null

  check "npx skills add --list lists $FIRST_SLUG" \
    bash -c "npx -y skills@latest add $API --list 2>&1 | grep -q '$FIRST_SLUG'"
  check "npx skills add --skill $FIRST_SLUG executes without error" \
    bash -c "npx -y skills@latest add $API --skill $FIRST_SLUG -a claude-code -y 2>&1 | grep -qi 'install\\|added\\|success'"

  popd > /dev/null
  rm -rf "$TMP"
else
  dim "(skipping CLI compat — set SKIP_CLI=0 to run it)"
fi

echo
if [ "$FAIL" -eq 0 ]; then
  green "═══ ALL PASSED ($PASS tests) ═══"
  exit 0
else
  red "═══ FAILED ($FAIL / $((PASS + FAIL)) tests) ═══"
  exit 1
fi
