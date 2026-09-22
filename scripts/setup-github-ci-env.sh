#!/usr/bin/env bash
# Push QualForge CI Variable + Secret from a local .env (never commit .env).
# Usage:
#   1. Put values in QualForge/.env (see .env.example)
#   2. ./scripts/setup-github-ci-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env}"
REPO="${GITHUB_REPOSITORY:-ashishraj-tyagi/QualForge}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.example and add VERCEL_AUTOMATION_BYPASS_SECRET"
  exit 1
fi

# Parse .env without shell-expanding secret values ($, `, etc.)
eval "$(python3 - "$ENV_FILE" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
vals = {}
for line in path.read_text().splitlines():
    s = line.strip()
    if not s or s.startswith("#") or "=" not in s:
        continue
    k, _, v = s.partition("=")
    k, v = k.strip(), v.strip()
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        v = v[1:-1]
    vals[k] = v

base = vals.get("STOCKROOM_BASE_URL", "https://stock-room-ashishraj-tyagi.vercel.app")
if "127.0.0.1" in base or "localhost" in base:
    base = "https://stock-room-ashishraj-tyagi.vercel.app"
secret = vals.get("VERCEL_AUTOMATION_BYPASS_SECRET", "")

def sh_escape(s: str) -> str:
    return "'" + s.replace("'", "'\"'\"'") + "'"

print(f"STOCKROOM_BASE_URL={sh_escape(base)}")
print(f"VERCEL_AUTOMATION_BYPASS_SECRET={sh_escape(secret)}")
print(f"SECRET_LEN={len(secret)}")
PY
)"

echo "Setting Actions variable STOCKROOM_BASE_URL for $REPO ..."
gh variable set STOCKROOM_BASE_URL --repo "$REPO" --body "$STOCKROOM_BASE_URL"
echo "  → $STOCKROOM_BASE_URL"

if [[ "${SECRET_LEN:-0}" -eq 0 ]]; then
  echo ""
  echo "VERCEL_AUTOMATION_BYPASS_SECRET is empty in $ENV_FILE"
  echo "Add it from Vercel → Project → Settings → Deployment Protection →"
  echo "  Protection Bypass for Automation, then re-run this script."
  exit 1
fi

echo "Setting Actions secret VERCEL_AUTOMATION_BYPASS_SECRET for $REPO ..."
printf '%s' "$VERCEL_AUTOMATION_BYPASS_SECRET" | gh secret set VERCEL_AUTOMATION_BYPASS_SECRET --repo "$REPO"
echo "  → set (length ${SECRET_LEN}, value hidden)"

echo ""
echo "Verify:"
gh variable list --repo "$REPO"
gh secret list --repo "$REPO"
echo ""
echo "Trigger: gh workflow run \"QualForge CI\" --repo $REPO"
