#!/usr/bin/env bash
# Sync a local Markdown file to a Feishu wiki document via lark-cli.
#
# Usage:
#   scripts/feishu-sync.sh <local.md> <doc-token-or-url>
#
# Examples:
#   scripts/feishu-sync.sh docs/SkillHub/strategy.md Rt0Md4z00oXsGnxRuZdcHdmknzc
#   scripts/feishu-sync.sh docs/SkillHub/strategy.md https://ecn1zd9lqqzk.feishu.cn/wiki/WHRowkRuliXKj0ktiL7cTCv6nxg
#
# Behavior:
#   - Pushes via `lark-cli docs +update --mode overwrite` (whole-doc replacement).
#   - Local md is source of truth. Any blocks you added in Feishu UI that don't
#     exist in the markdown (e.g. manually inserted mermaid graphs) will be
#     OVERWRITTEN. To keep them, either also add them to local md, or use
#     section-level replace_range (see SECTION SYNC below).
#   - Will warn (but succeed) if any HTML-like tags (<whiteboard>, <br/>) get
#     stripped — lark-cli 1.x doesn't yet expose v2 DocxXML.
#
# SECTION SYNC (advanced):
#   For surgical updates that preserve other blocks, use lark-cli directly:
#     awk '/^## 五/{p=1} /^## 六/{p=0} p' docs/SkillHub/strategy.md > /tmp/sec.md
#     lark-cli docs +update --doc <token> \
#       --mode replace_range --selection-by-title '## 五、xxx' \
#       --markdown - < /tmp/sec.md
#
set -euo pipefail

LOCAL_MD="${1:?usage: feishu-sync.sh <local.md> <doc-token-or-url>}"
DOC_REF="${2:?usage: feishu-sync.sh <local.md> <doc-token-or-url>}"

if [ ! -f "$LOCAL_MD" ]; then
  echo "❌ file not found: $LOCAL_MD" >&2
  exit 1
fi

if ! command -v lark-cli >/dev/null 2>&1; then
  echo "❌ lark-cli not installed. Run: npm install -g @larksuite/cli" >&2
  exit 1
fi

# Auth precheck
if ! lark-cli auth status 2>/dev/null | grep -q '"identity": "user"'; then
  echo "❌ lark-cli not logged in. Run: lark-cli auth login --recommend" >&2
  exit 1
fi

# Extract doc token if a URL was passed (handles /wiki/<node>, /docx/<token>)
DOC_TOKEN="$DOC_REF"
if [[ "$DOC_REF" == http* ]]; then
  DOC_TOKEN=$(echo "$DOC_REF" | sed -E 's|.*/(wiki\|docx\|doc)/([^/?#]+).*|\2|')
fi

# Derive title from H1 of the markdown (first `# Heading` line)
TITLE=$(grep -m1 '^# ' "$LOCAL_MD" | sed 's/^# //')

echo "→ pushing $LOCAL_MD ($(wc -l < "$LOCAL_MD") lines) to doc $DOC_TOKEN"
echo "  title: $TITLE"
echo

OUTPUT=$(lark-cli docs +update \
  --doc "$DOC_TOKEN" \
  --mode overwrite \
  ${TITLE:+--new-title "$TITLE"} \
  --markdown - < "$LOCAL_MD" 2>&1)

echo "$OUTPUT" | head -20

if echo "$OUTPUT" | grep -q '"success": true'; then
  echo
  echo "✓ pushed. Open in browser to verify rendering."
  if echo "$OUTPUT" | grep -q "warnings"; then
    echo "⚠ stripped tags reported above (usually harmless: <br/>, <whiteboard>)."
  fi
else
  echo
  echo "❌ push failed. See output above."
  exit 2
fi
